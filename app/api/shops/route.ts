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
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Paging through results is a few requests a second at most; this only
  // stops a runaway script from scraping the index through us.
  const rl = await spendQuotas(FAIR_USE.shops(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  const sp = Object.fromEntries(req.nextUrl.searchParams);
  try {
    const data = await loadShops(ctx, sp);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/shops]', err);
    return NextResponse.json({ error: 'Shops could not be loaded' }, { status: 502 });
  }
}
