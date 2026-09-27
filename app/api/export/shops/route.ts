import { NextRequest, NextResponse } from 'next/server';
import { audit, ctxOrNull } from '@/lib/auth/guard';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';
import { EXPORT_MAX_ROWS, collectPages, csvFileName, csvResponse, toCsv } from '@/lib/csv';
import { bandLabel, shopTraffic } from '@/lib/traffic/crux-bands';
import { SITE_URL } from '@/lib/public/site';
import { loadShops } from '@/app/(app)/shops/load';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The index serves at most 100 shops a page. */
const PAGE = 100;

const HEADER = [
  'rank', 'domain', 'name', 'url', 'adlibraryspy_url', 'platform', 'category', 'country', 'launch_date',
  'monthly_visits', 'traffic_source', 'traffic_month', 'traffic_growth_pct', 'chrome_ux_rank', 'aov_usd', 'live_meta_ads',
  'max_ads_7d', 'product_count', 'top_products',
];

/**
 * The Shops explorer as CSV: the same query string, the same loader
 * (app/(app)/shops/load.ts) and the same sort as the table, from the first
 * row, up to EXPORT_MAX_ROWS. Every cell is what the table would print; a
 * value the table leaves blank is blank here too.
 */
export async function GET(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rl = await spendQuotas(FAIR_USE.export(ctx.user.id, clientIp(req.headers)));
  if (!rl.allowed) return NextResponse.json({ error: quotaWait(rl) }, { status: 429, headers: quotaHeaders(rl) });

  const sp: Record<string, string> = Object.fromEntries(req.nextUrl.searchParams);
  try {
    // Sequential pages: each one also reads the workspace's lists from Postgres.
    const rows = await collectPages(
      page => loadShops(ctx, { ...sp, page: String(page) }, PAGE).then(r => ({ items: r.rows, total: r.total, hasMore: r.hasMore })),
      { pageSize: PAGE, maxRows: EXPORT_MAX_ROWS },
    );
    const lines = rows.map((s, i) => {
      const t = shopTraffic(s);
      return [
        i + 1, s.domain, s.name, `https://${s.domain}`, `${SITE_URL}/shops/${encodeURIComponent(s.id)}`,
        s.platform, s.niches.join('; '), s.country, s.createdOn ? s.createdOn.slice(0, 10) : '',
        t.visits, t.visits != null ? t.source : '', t.visits != null ? t.period : '', t.growth != null ? Math.round(t.growth * 10) / 10 : null,
        s.cruxBucket != null ? bandLabel(s.cruxBucket) : '',
        s.avgPrice > 0 ? Math.round(s.avgPrice * 100) / 100 : null, s.metaAds > 0 ? s.metaAds : null,
        s.maxAds7d, s.productCount > 0 ? s.productCount : null,
        s.bestSellers.map(p => p.title).filter(Boolean).join(' | '),
      ];
    });
    await audit(ctx, 'export.shops', `${rows.length} shops`, { query: req.nextUrl.search });
    return csvResponse(toCsv(HEADER, lines), csvFileName('shops'), quotaHeaders(rl));
  } catch (err) {
    console.error('[api/export/shops]', err);
    return NextResponse.json({ error: 'The export could not be built — try again.' }, { status: 502 });
  }
}
