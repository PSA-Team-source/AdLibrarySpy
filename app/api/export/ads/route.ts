import { NextRequest, NextResponse } from 'next/server';
import { audit, ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { EXPORT_MAX_ROWS, collectPages, csvFileName, csvResponse, toCsv } from '@/lib/csv';
import { SITE_URL } from '@/lib/public/site';
import { queryAds } from '@/lib/data';
import { metaAdLibraryUrl } from '@/lib/market/creatives';
import { creativeNiches } from '@/lib/market/shops';
import { adFilterFromParams } from '@/lib/market/ads-params';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** listAds serves at most 60 ads a page. */
const PAGE = 60;

const HEADER = [
  'ad_id', 'advertiser', 'domain', 'adlibraryspy_url', 'meta_page_id', 'meta_ad_library_url', 'status',
  'start_date', 'last_seen', 'days_running', 'media_type', 'format', 'placements', 'country', 'niche',
  'headline', 'ad_text', 'landing_url', 'media_url',
];

/**
 * The Ads grid as CSV: the same query string and filter parser as /ads
 * (lib/market/ads-params.ts), from the first ad, up to EXPORT_MAX_ROWS.
 */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rl = await spendQuotas(FAIR_USE.export(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  const filter = adFilterFromParams(Object.fromEntries(req.nextUrl.searchParams));
  // Format/placement are filtered here, not by the index: each page re-scans
  // from the start, so those pages load one at a time. Otherwise 4 at once.
  const concurrency = filter.format || filter.placement ? 1 : 4;
  try {
    const [ads, niches] = await Promise.all([
      collectPages(page => queryAds({ ...filter, page, limit: PAGE }), { pageSize: PAGE, maxRows: EXPORT_MAX_ROWS, concurrency }),
      creativeNiches(),
    ]);
    // Same niche naming as the ad cards: the first top-level category we know.
    const nicheName = new Map(niches.map(n => [n.id, n.name]));
    const lines = ads.map(a => [
      a.id, a.advertiser, a.domain, `${SITE_URL}/ads/${encodeURIComponent(a.id)}`, a.pageId, metaAdLibraryUrl(a),
      a.isActive ? 'active' : 'inactive', a.startDate, a.lastSeenAt ? a.lastSeenAt.slice(0, 10) : '', a.daysRunning,
      a.mediaType, a.format, a.placements.join(', '), a.country,
      a.niche || a.storeCategoryIds.map(id => nicheName.get(id)).find(Boolean) || '',
      a.headline, a.adCopy, a.linkUrl, a.videoUrl || a.image,
    ]);
    await audit(ctx, 'export.ads', `${ads.length} ads`, { query: req.nextUrl.search });
    return csvResponse(toCsv(HEADER, lines), csvFileName('ads'), quotaHeaders(rl));
  } catch (err) {
    console.error('[api/export/ads]', err);
    return NextResponse.json({ error: 'The export could not be built — try again.' }, { status: 502 });
  }
}
