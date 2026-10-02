// Fixed-window rate limiting backed by Postgres, so the limit holds across
// every process rather than per-instance like an in-memory counter would.
import { one } from './db';

export interface RateResult { allowed: boolean; remaining: number; resetAt: Date }

/**
 * Count hits for `key` in the current window. Uses the audit-free rate table
 * created on first use so a limiter never fails open silently. `cost` is how
 * many hits this request spends (a JSON-RPC batch spends one per item).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, cost = 1): Promise<RateResult> {
  const row = await one<{ hits: string; window_start: Date }>(
    `INSERT INTO rate_limits (key, window_start, hits)
     VALUES ($1, date_trunc('second', now()), $3)
     ON CONFLICT (key) DO UPDATE SET
       hits = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval
                   THEN $3 ELSE rate_limits.hits + $3 END,
       window_start = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval
                   THEN date_trunc('second', now()) ELSE rate_limits.window_start END
     RETURNING hits, window_start`,
    [key, String(windowSeconds), Math.max(1, Math.floor(cost))],
  );
  const hits = Number(row?.hits ?? 1);
  const start = row?.window_start ?? new Date();
  return {
    allowed: hits <= limit,
    remaining: Math.max(0, limit - hits),
    resetAt: new Date(start.getTime() + windowSeconds * 1000),
  };
}

/** Client IP from the proxy chain; nginx sets X-Forwarded-For on this box. */
export function clientIp(h: Headers): string {
  // Behind Cloudflare the visitor is CF-Connecting-IP. The FIRST X-Forwarded-For
  // hop is whatever the client sent, so keying limits on it let anyone rotate a
  // header to dodge them; without CF, use the hop our own proxy appended (last).
  const cf = h.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const hops = (h.get('x-forwarded-for') || '').split(',').map(s => s.trim()).filter(Boolean);
  return hops[hops.length - 1] || h.get('x-real-ip') || 'unknown';
}

/** One budget a request spends from: `limit` hits per `windowSeconds` under `key`. */
export interface Quota { key: string; limit: number; windowSeconds: number }
export interface QuotaResult extends RateResult { limit: number; windowSeconds: number }

/**
 * Every feature is free, so a per-minute burst limit alone lets one account
 * (or a farm of sign-ups behind one IP) page the whole index in a day. Callers
 * pass the burst limit first and the daily fair-use caps after it. Quotas are
 * spent in order and stop at the first refusal, so hammering a burst limit
 * does not also burn the day's allowance. The result is the refusing quota,
 * or the one with the least headroom left, for the X-RateLimit headers.
 */
export async function spendQuotas(quotas: Quota[], cost = 1): Promise<QuotaResult> {
  let tightest: QuotaResult | null = null;
  for (const q of quotas) {
    const r = { ...(await rateLimit(q.key, q.limit, q.windowSeconds, cost)), limit: q.limit, windowSeconds: q.windowSeconds };
    if (!r.allowed) return r;
    if (!tightest || r.remaining < tightest.remaining) tightest = r;
  }
  if (!tightest) throw new Error('spendQuotas needs at least one quota');
  return tightest;
}

/** Standard headers so clients can pace themselves; Retry-After only on a refusal. */
export function quotaHeaders(r: QuotaResult): Record<string, string> {
  const reset = Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 1000));
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(reset),
    ...(r.allowed ? {} : { 'Retry-After': String(reset) }),
  };
}

/** Human wording for a refusal: "a minute" for burst limits, "tomorrow" for daily caps. */
export function quotaWait(r: QuotaResult): string {
  return r.windowSeconds >= 86400 ? 'The daily fair-use limit is reached; it resets within 24 hours.' : 'Too many requests — try again in a minute.';
}

const DAY = 86400;

/**
 * Fair-use caps for the free API. Keyed by workspace, user AND IP: a user can
 * own several workspaces and one script can sign up several users, so no
 * single key is enough on its own.
 */
export const FAIR_USE = {
  /** MCP / API-key tool calls. search_* return up to 50 rows per call. */
  mcp: (workspaceId: string, userId: string, ip: string): Quota[] => [
    { key: `mcp:${workspaceId}`, limit: 120, windowSeconds: 60 },
    { key: `mcp-day:ws:${workspaceId}`, limit: 1000, windowSeconds: DAY },
    { key: `mcp-day:user:${userId}`, limit: 1500, windowSeconds: DAY },
    { key: `mcp-day:ip:${ip}`, limit: 3000, windowSeconds: DAY },
  ],
  /** The signed-in Shops explorer's JSON pages. */
  shops: (userId: string, ip: string): Quota[] => [
    { key: `shops:${userId}`, limit: 240, windowSeconds: 60 },
    { key: `shops-day:user:${userId}`, limit: 3000, windowSeconds: DAY },
    { key: `shops-day:ip:${ip}`, limit: 6000, windowSeconds: DAY },
  ],
  /** The signed-in Products explorer's JSON pages (same budget as Shops). */
  products: (userId: string, ip: string): Quota[] => [
    { key: `products:${userId}`, limit: 240, windowSeconds: 60 },
    { key: `products-day:user:${userId}`, limit: 3000, windowSeconds: DAY },
    { key: `products-day:ip:${ip}`, limit: 6000, windowSeconds: DAY },
  ],
  /** The Landing pages explorer's JSON pages (same budget as Products). */
  landingPages: (userId: string, ip: string): Quota[] => [
    { key: `landing-pages:${userId}`, limit: 240, windowSeconds: 60 },
    { key: `landing-pages-day:user:${userId}`, limit: 3000, windowSeconds: DAY },
    { key: `landing-pages-day:ip:${ip}`, limit: 6000, windowSeconds: DAY },
  ],
  /** CSV exports of Shops / Ads: each one reads up to 1,000 rows (10–17 index pages). */
  export: (userId: string, ip: string): Quota[] => [
    { key: `export:${userId}`, limit: 10, windowSeconds: 60 },
    { key: `export-day:user:${userId}`, limit: 50, windowSeconds: DAY },
    { key: `export-day:ip:${ip}`, limit: 100, windowSeconds: DAY },
  ],
  /** In-app feedback (lib/feedback.ts): each message is a stored row plus an email to the team. */
  feedback: (userId: string): Quota[] => [
    { key: `feedback:${userId}`, limit: 10, windowSeconds: 3600 },
  ],
  /** Anonymous public endpoints (most hits are absorbed by the edge cache). */
  public: (name: string, ip: string): Quota[] => [
    { key: `${name}:${ip}`, limit: 60, windowSeconds: 60 },
    { key: `${name}-day:${ip}`, limit: 1000, windowSeconds: DAY },
  ],
};
