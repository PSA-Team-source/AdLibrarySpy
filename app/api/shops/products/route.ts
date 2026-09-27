import { NextRequest, NextResponse } from 'next/server';
import { ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { storefrontCatalogPage } from '@/lib/market/storefront';
import { cleanDomain } from '@/lib/market/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/shops/products?domain=<store>&page=<n> — one page (48) of a store's
 * published catalogue for the shop dossier's "Show more". The first page ships
 * with the dossier; this serves the rest. The domain is fetched through
 * safeFetch, which refuses private and loopback addresses.
 */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rl = await spendQuotas(FAIR_USE.products(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  const domain = cleanDomain(req.nextUrl.searchParams.get('domain'));
  const page = Number(req.nextUrl.searchParams.get('page'));
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || !Number.isInteger(page) || page < 2 || page > 500) {
    return NextResponse.json({ error: 'domain and page (2-500) are required' }, { status: 400 });
  }
  const products = await storefrontCatalogPage(domain, page);
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
