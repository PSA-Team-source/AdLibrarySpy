import { NextRequest, NextResponse } from 'next/server';
import { ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { loadShops } from '@/app/(app)/shops/load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One Shops explorer page as JSON — the explorer's filter, sort and page
 * changes fetch this instead of re-rendering the whole route on the server.
 * Takes exactly the /shops query string.
 */
// A user refused by the quota, until their window resets: turned away before any
// index work. Per process (pm2 cluster), so a refusal costs at most one wasted load
// per worker. ponytail: unbounded only by distinct refused users per window.
const refusedUntil = new Map<string, number>();

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const tAuth = performance.now();

  const until = refusedUntil.get(ctx.user.id);
  if (until && until > Date.now()) return NextResponse.json({ error: 'Too many requests — try again in a minute.' }, { status: 429 });
  refusedUntil.delete(ctx.user.id);

  // Paging through results is a few requests a second at most; this only
  // stops a runaway script from scraping the index through us. The quota is
  // spent beside the load (three Postgres round trips that used to come first);
  // a refusal discards the rows, so nothing is served past the limit.
  const timing = [`auth;dur=${Math.round(tAuth - t0)}`];
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const load = loadShops(ctx, sp, undefined, timing).then(data => ({ data }), err => ({ err }));
  const rl = await spendQuotas(FAIR_USE.shops(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) {
    refusedUntil.set(ctx.user.id, rl.resetAt.getTime());
    return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });
  }
  const res = await load;
  if ('err' in res) {
    console.error('[api/shops]', res.err);
    return NextResponse.json({ error: 'Shops could not be loaded' }, { status: 502 });
  }
  return NextResponse.json(res.data, { headers: { 'Cache-Control': 'private, no-store', 'Server-Timing': timing.join(', ') } });
}
