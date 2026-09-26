// HTTP client for the PlatformDTC market API (Go, internal/market).
// Retries idempotent GETs on transient failure; surfaces everything else so a
// page renders an explicit error state rather than silently-empty data.
import { marketToken } from './token';

const BASE = process.env.MARKET_API_BASE || 'https://api.platformdtc.com/api/v1';
const TIMEOUT_MS = Number(process.env.MARKET_TIMEOUT_MS || 12_000);

export class MarketError extends Error {
  constructor(public readonly status: number, public readonly path: string, msg?: string) {
    super(msg || `market ${path} → ${status}`);
    this.name = 'MarketError';
  }
}

export interface GetOpts {
  auth?: boolean;
  revalidate?: number;
  retries?: number;
}

export async function marketGet<T = unknown>(path: string, opts: GetOpts = {}): Promise<T> {
  const { auth = false, revalidate = 300, retries = 2 } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) headers.Authorization = `Bearer ${await marketToken()}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers,
        signal: ac.signal,
        next: { revalidate },
      } as RequestInit);
      if (res.ok) return (await res.json()) as T;

      // 4xx (except 429) is our bug or a genuine "not found" — don't retry.
      if (res.status < 500 && res.status !== 429) {
        throw new MarketError(res.status, path);
      }
      lastErr = new MarketError(res.status, path);
    } catch (err) {
      if (err instanceof MarketError && err.status < 500 && err.status !== 429) throw err;
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 250 * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new MarketError(0, path, String(lastErr));
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

/** POST variant — /top-brands/filter takes its criteria as a JSON body. */
export async function marketPost<T = unknown>(
  path: string,
  body: unknown,
  opts: { auth?: boolean; revalidate?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (opts.auth) headers.Authorization = `Bearer ${await marketToken()}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
      next: { revalidate: opts.revalidate ?? 300 },
    } as RequestInit);
    if (!res.ok) throw new MarketError(res.status, path);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
