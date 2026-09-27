import { NextRequest, NextResponse } from 'next/server';
import { ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { loadProducts } from '@/app/(app)/products/load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One Products explorer page as JSON — the explorer's filter, sort and page
 * changes fetch this instead of re-rendering the route. Takes exactly the
 * /products query string.
 */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rl = await spendQuotas(FAIR_USE.products(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  try {
    const data = await loadProducts(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/products]', err);
    return NextResponse.json({ error: 'Products could not be loaded' }, { status: 502 });
  }
}
