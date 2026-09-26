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
