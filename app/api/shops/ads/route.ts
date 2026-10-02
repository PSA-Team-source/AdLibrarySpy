import { NextRequest, NextResponse } from 'next/server';
import { ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { cleanDomain } from '@/lib/market/shops';
import { loadShopAds } from '@/app/(app)/shops/load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/shops/ads?domains=a.com,b.com — the Shops table's ad thumbnails, fetched
 * after the rows (GET /api/shops) so the slow creative lookup never holds the page up.
 * Returns { ads: { [domain]: AdPreview[] } } for at most one page (50) of domains.
 */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rl = await spendQuotas(FAIR_USE.shops(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  // Keyed by each domain exactly as the table sent it (its row's `domain`).
  const domains = [...new Set((req.nextUrl.searchParams.get('domains') ?? '').split(','))]
    .filter(d => d.length <= 255 && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain(d))).slice(0, 50);
  const ads = domains.length ? await loadShopAds(domains) : {};
  return NextResponse.json({ ads }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
