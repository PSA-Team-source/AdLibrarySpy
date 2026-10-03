// HTTP client for the PlatformDTC market API (Go, internal/market).
//
// The Go API is restarted by every backend deploy (several an hour on busy days), and
// each restart closes :5900 for ~1–20s. Reads must ride that out, never fail the page:
//   1. transient failures (connection refused/reset, timeout, 429, 5xx) retry with
//      backoff until a deadline (OUTAGE_BUDGET_MS) rather than a fixed small count;
//   2. every successful read is remembered (bounded LRU), and if the API is still
//      down when the budget runs out, the last good copy is served. With a copy in
//      hand the budget is short (STALE_BUDGET_MS) so a restart costs latency, not a page.
// 4xx (except 429) is a real answer ("not found", our bug) and is thrown at once.

const BASE = process.env.MARKET_API_BASE || 'https://api.platformdtc.com/api/v1';
// Hot standby (.220 :5911). The primary refuses connections for the seconds a
// restart takes; nginx fails over for api.platformdtc.com, this process talks to
// :5900 directly, so it fails over itself — at once, no backoff.
const FALLBACK = process.env.MARKET_API_FALLBACK || '';
const TIMEOUT_MS = Number(process.env.MARKET_TIMEOUT_MS || 12_000);
const OUTAGE_BUDGET_MS = Number(process.env.MARKET_OUTAGE_BUDGET_MS || 25_000);
const STALE_BUDGET_MS = Number(process.env.MARKET_STALE_BUDGET_MS || 2_500);
const LAST_GOOD_MAX = 1_500;              // entries, per process
const LAST_GOOD_MAX_BYTES = 2_000_000;    // don't pin huge payloads in memory

export class MarketError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(status: number, path: string, msg?: string) {
    super(msg || `market ${path} → ${status}`);
    this.name = 'MarketError';
    this.status = status;
    this.path = path;
  }
}

export interface GetOpts {
  auth?: boolean;
  revalidate?: number;
  /** Any value marks an optional read (a headline count etc.): retry only briefly
   *  (STALE_BUDGET_MS) and let the caller degrade, instead of holding the page. */
  retries?: number;
}

// ponytail: per-process LRU (pm2 cluster x4 → each worker warms its own). Upgrade path is
// Redis if a cold worker serving through a restart ever matters.
const g = globalThis as unknown as { __ML_LAST_GOOD?: Map<string, unknown> };
const lastGood = (g.__ML_LAST_GOOD ??= new Map<string, unknown>());

function remember(key: string, value: unknown) {
  lastGood.delete(key);
  lastGood.set(key, value);
  if (lastGood.size > LAST_GOOD_MAX) lastGood.delete(lastGood.keys().next().value as string);
}

/** Retry-worthy: the request never got a real answer (network, timeout, overload, restart). */
export function isTransient(err: unknown): boolean {
  if (err instanceof MarketError) return err.status === 0 || err.status === 429 || err.status >= 500;
  return true; // fetch TypeError (ECONNREFUSED/ECONNRESET), AbortError (timeout), bad JSON mid-restart
}

/** The process is not listening (a restart): nothing was sent, so another host is safe. */
function isRefused(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  return code === 'ECONNREFUSED';
}

export async function marketRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { auth?: boolean; revalidate?: number; body?: unknown; optional?: boolean } = {},
  deps: { fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; base?: string; fallback?: string } = {},
): Promise<T> {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  const key = `${method} ${path} ${body ?? ''}`;
  const stale = lastGood.get(key);
  const deadline = now() + (stale !== undefined || opts.optional ? STALE_BUDGET_MS : OUTAGE_BUDGET_MS);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    // Lazy so the retry logic stays importable by `node --test` (tests/market-client.test.mjs).
    const { marketToken } = await import('./token');
    headers.Authorization = `Bearer ${await marketToken()}`;
  }

  let lastErr: unknown;
  let base = deps.base ?? BASE;
  const fallback = deps.fallback ?? FALLBACK;
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.max(1_000, Math.min(TIMEOUT_MS, deadline - now())));
    let refused = false;
    try {
      const res = await doFetch(`${base}${path}`, {
        method, headers, body, signal: ac.signal,
        next: { revalidate: opts.revalidate ?? 300 },
      } as RequestInit);
      if (!res.ok) throw new MarketError(res.status, path);
      const text = await res.text();
      const value = JSON.parse(text) as T;
      if (text.length <= LAST_GOOD_MAX_BYTES) remember(key, value);
      return value;
    } catch (err) {
      if (!isTransient(err)) throw err;
      lastErr = err;
      refused = isRefused(err);
    } finally {
      clearTimeout(timer);
    }
    if (refused && fallback && base !== fallback) { base = fallback; continue; }
    const wait = Math.min(1_500, 200 * 2 ** attempt);
    if (now() + wait >= deadline) break;
    await sleep(wait);
    base = deps.base ?? BASE; // both refused: after the wait, the primary first again
  }
  if (stale !== undefined) {
    console.warn(`[market] ${key.trim()} unavailable (${String((lastErr as Error)?.message ?? lastErr)}); serving last good copy`);
    return stale as T;
  }
  throw lastErr instanceof Error ? lastErr : new MarketError(0, path, String(lastErr));
}

export function marketGet<T = unknown>(path: string, opts: GetOpts = {}): Promise<T> {
  return marketRequest<T>('GET', path, { auth: opts.auth, revalidate: opts.revalidate, optional: opts.retries !== undefined });
}

/** Unwrap the API's `{data:{items:[…]}}` / `{data:[…]}` / `[…]` shapes. */
export function unwrapItems(payload: unknown): Record<string, unknown>[] {
  const d = (payload as { data?: unknown })?.data ?? payload;
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  const items = (d as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

/**
 * Total row count reported by the API, when it reports one. top-brands puts it
 * on `data.pagination.total`; null means the endpoint did not report a count
 * and the UI must show no number rather than guess one.
 */
export function unwrapTotal(payload: unknown): number | null {
  const d = ((payload as { data?: unknown })?.data ?? payload) as Record<string, unknown>;
  const pagination = d?.pagination as Record<string, unknown> | undefined;
  for (const source of [pagination, d]) {
    if (!source) continue;
    for (const k of ['total', 'totalCount', 'total_count', 'count']) {
      const v = source[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
  }
  return null;
}

export function marketBase(): string { return BASE; }

/** POST variant — /top-brands/filter takes its criteria as a JSON body (a read, so safe to retry). */
export function marketPost<T = unknown>(
  path: string,
  body: unknown,
  opts: { auth?: boolean; revalidate?: number } = {},
): Promise<T> {
  return marketRequest<T>('POST', path, { ...opts, body });
}
