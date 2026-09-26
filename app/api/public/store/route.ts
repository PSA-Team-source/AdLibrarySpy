import { NextRequest, NextResponse } from 'next/server';
import { getShop } from '@/lib/data';
import { storeProfile } from '@/lib/market/storefront';
import { creativeCountFor } from '@/lib/market/creatives';
import { MarketError } from '@/lib/market/client';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { trafficCaption } from '@/lib/traffic/similarweb';
import { normaliseDomain } from './domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://adlibraryspy.com';

/**
 * Public, anonymous store card for the AdLibrarySpy browser extension (and
 * anyone else): GET /api/public/store?domain=fashionnova.com.
 *
 * Identical for every caller — no cookies or session are read — so Cloudflare
 * caches it (/api/public/* cache rule) and the per-IP limit below only meters
 * origin misses. `Access-Control-Allow-Origin: *` rather than an echoed origin
 * on purpose: an echoed origin in a shared edge-cached body would be served to
 * the next caller from a different origin. The data is public and credential-free.
 *
 * Every figure is the one the signed-in dossier shows; anything the index has
 * not measured is null / [] and the extension renders nothing for it.
 */
const CACHE_OK = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_404 = 'public, max-age=300, s-maxage=600';
const NO_STORE = 'no-store';

function json(body: unknown, status: number, cache: string, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cache,
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req: NextRequest) {
  const domain = normaliseDomain(req.nextUrl.searchParams.get('domain'));
  if (!domain) return json({ error: 'invalid_domain', message: 'Pass ?domain= with a store hostname, e.g. fashionnova.com.' }, 400, CACHE_404);

  // Cloudflare overwrites CF-Connecting-IP with the real client; X-Forwarded-For's
  // first hop is whatever the client claimed, so it only stands in off-edge.
  const ip = req.headers.get('cf-connecting-ip')?.trim() || clientIp(req.headers);
  try {
    const rl = await rateLimit(`pubstore:${ip}`, 60, 60);
    if (!rl.allowed) {
      const retry = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
      return json({ error: 'rate_limited', message: 'Too many lookups — try again in a minute.' }, 429, NO_STORE, { 'Retry-After': String(retry) });
    }
  } catch (err) {
    console.error('[api/public/store] rate limiter unavailable', err);
    return json({ error: 'unavailable', message: 'Lookup is temporarily unavailable.' }, 503, NO_STORE, { 'Retry-After': '30' });
  }

  let shop;
  try {
    shop = await getShop(domain);
  } catch (err) {
    if (err instanceof MarketError && err.status === 404) shop = null;
    else {
      console.error('[api/public/store] market lookup failed', domain, err);
      return json({ error: 'unavailable', message: 'Store data is temporarily unavailable.' }, 502, NO_STORE, { 'Retry-After': '30' });
    }
  }
  // getShop's list fallback can match on id; only an exact host is this store.
  if (!shop || shop.domain !== domain) {
    return json({ error: 'not_found', domain, message: 'AdLibrarySpy has not indexed this store yet.' }, 404, CACHE_404);
  }

  const [profile, libraryAds] = await Promise.all([
    storeProfile(shop.storeId),
    creativeCountFor(shop.domain),
  ]);

  const measured = shop.trafficSource === 'similarweb';
  const period = measured ? shop.similarweb?.period ?? '' : '';
  const growth = measured ? shop.similarweb?.growthPct ?? null : (shop.visitsGrowth || null);
  const history = (shop.similarwebDetail?.history.length ?? 0) >= 2
    ? shop.similarwebDetail!.history
    : (!measured && shop.trafficSeries.length >= 2 ? shop.trafficSeries : []);

  const body = {
    domain: shop.domain,
    name: shop.name,
    logo: /^https:\/\//.test(shop.logo) ? shop.logo : null,
    platform: shop.platform,
    country: shop.country || null,
    createdOn: shop.createdOn || null,
    niche: profile?.categoryPath.length ? profile.categoryPath : shop.niches,
    traffic: shop.monthlyVisits > 0 ? {
      visits: shop.monthlyVisits,
      growthPct: growth == null ? null : Math.round(growth * 10) / 10,
      source: shop.trafficSource,
      sourceLabel: trafficCaption(shop.trafficSource, period) || null,
      period: period || null,
      history: history.map(p => ({ month: p.t, visits: p.v })),
    } : null,
    metaAds: {
      // db_num_ads: the store's live Meta ads as last counted by the index (the
      // dossier's "Live Meta Ads" tile). null = never counted, not zero.
      live: shop.metaAds > 0 ? shop.metaAds : null,
      // Creatives AdLibrarySpy holds for this store (what "Meta Ads" opens).
      inLibrary: libraryAds && libraryAds > 0 ? libraryAds : null,
    },
    products: shop.bestSellers
      .filter(p => p.title && p.image && /^https:\/\//.test(p.image))
      .slice(0, 3)
      .map(p => ({ title: p.title, image: p.image })),
    apps: (profile?.apps ?? shop.apps).slice(0, 24),
    pixels: (profile?.pixels ?? shop.pixels).slice(0, 24),
    urls: {
      analysis: `${SITE}/store/${shop.domain}`,
      app: `${SITE}/shops/${encodeURIComponent(shop.id)}`,
    },
  };
  return json(body, 200, CACHE_OK);
}
