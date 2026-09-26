// Query layer. Reads go to the market index (lib/market/*); tenant state
// (favorites, trackers) lives in Postgres, scoped to a workspace.
import type { Shop, Ad } from './types';
import { cache } from 'react';
import { listShops, getShop as mktGetShop, getShops as mktGetShops, similarShops, categoryRanking, type ShopFilter } from './market/shops';
import { listAds, getAd as mktGetAd, getAds as mktGetAds, storeAdBundle, storeAdCountries, storeAds, storeAdPreviews, storeMetaPages, labelFacets, type AdFilter } from './market/creatives';
import { query, one } from './db';
import { markFirst } from '@/lib/analytics/events';

export type { ShopFilter, AdFilter };

// ---------- smart segments ----------
// Each segment is a sort the index genuinely supports. They were previously
// defined with traffic thresholds, but GET /top-brands accepts no numeric range
// filters at all, so those thresholds were silently dropped and every segment
// returned the same rows in a different order.
export const SEGMENTS = {
  'traffic-peak':    { label: 'Most traffic',    sortBy: 'sw_visits',                    sortOrder: 'desc' as const },
  'fastest-growing': { label: 'Fastest growing', sortBy: 'sw_growth_pct',                 sortOrder: 'desc' as const },
  'ad-peak':         { label: 'Ads running now', sortBy: 'db_num_ads',                  sortOrder: 'desc' as const },
  'peak-ads-7d':     { label: 'Peak ads (7d)',   sortBy: 'max_ads_7d',                   sortOrder: 'desc' as const },
  'top-scaling':     { label: 'Scaling ads',     sortBy: 'percentage_num_ads_increase',  sortOrder: 'desc' as const },
  'newest':          { label: 'Newest stores',   sortBy: 'store_created_at',             sortOrder: 'desc' as const },
} as const;
export type SegmentKey = keyof typeof SEGMENTS;

/**
 * Columns the shops table can sort by, mapped to the index field. Verified
 * against the live API in both directions. Anything not on this list is
 * rejected, so a crafted `?sort=` cannot reach Elasticsearch as a field name.
 */
export const SHOP_SORTS = {
  // SimilarWeb's measured visits for the exact host. The API sorts stores the
  // crawl has not reached last (missing:_last, in both directions) and keeps
  // their monthly_traffic order underneath, so no store falls out of a list
  // while coverage fills.
  traffic:  'sw_visits',
  revenue:  'estimated_sales',
  // SimilarWeb's measured month-over-month change, sorted the same way as
  // sw_visits: measured stores first on the real figure, the index's own
  // growth_rate underneath for the ones the crawl has not reached, and
  // missing:_last in both directions so "unknown" never reads as "flat".
  growth:   'sw_growth_pct',
  aov:      'avg_product_price',
  ads:      'db_num_ads',
  maxads:   'max_ads_7d',
  products: 'total_product',
  launched: 'store_created_at',
} as const;
export type ShopSortKey = keyof typeof SHOP_SORTS;

/**
 * The shops table opens on peak concurrent ads (7d), descending: the ad-volume
 * read is what the Shops page is for. Measured traffic stays one header click
 * away. (SimilarWeb measures the exact host, so
 * the old parent-domain traffic inflation no longer decides this either way.)
 */
export const DEFAULT_SORT: ShopSortKey = 'maxads';
export const DEFAULT_DIR: 'asc' | 'desc' = 'desc';

export function isShopSort(v: string | undefined): v is ShopSortKey {
  return !!v && Object.prototype.hasOwnProperty.call(SHOP_SORTS, v);
}

export interface ShopQuery extends ShopFilter {
  view?: string;
  /** Column key from SHOP_SORTS. */
  sort?: string;
  /** 'asc' | 'desc'; anything else falls back to desc. */
  dir?: string;
}

export async function queryShops(qp: ShopQuery, opts?: { crux?: boolean }) {
  const f: ShopFilter = { ...qp };

  // An explicit column sort wins over a segment: a reader who clicks a header
  // expects that header to take effect, not to be silently overridden.
  if (isShopSort(qp.sort)) {
    f.sortBy = SHOP_SORTS[qp.sort];
    f.sortOrder = qp.dir === 'asc' ? 'asc' : 'desc';
  } else {
    const seg = qp.view ? SEGMENTS[qp.view as SegmentKey] : undefined;
    if (seg) {
      f.sortBy = seg.sortBy;
      f.sortOrder = seg.sortOrder;
    } else {
      f.sortBy = SHOP_SORTS[DEFAULT_SORT];
      f.sortOrder = DEFAULT_DIR;
    }
  }
  return listShops(f, opts);
}

export const getShop = cache(async (id: string): Promise<Shop | null> => mktGetShop(id));
export async function getShops(ids: string[]): Promise<Shop[]> { return mktGetShops(ids); }
export { similarShops, storeAds, storeAdBundle, storeAdPreviews, storeAdCountries, storeMetaPages, labelFacets };

export async function queryAds(qp: AdFilter) {
  return listAds(qp);
}
export const getAd = cache(async (id: string): Promise<Ad | null> => mktGetAd(id));
export async function getAds(ids: string[]): Promise<Ad[]> { return mktGetAds(ids); }

export async function similarAds(ad: Ad, limit = 8): Promise<Ad[]> {
  // Same advertiser — the only similarity the index can actually assert, and it
  // is scoped by domain because the endpoint has no store filter.
  if (ad.domain) {
    const same = (await storeAds(ad.domain, limit + 1)).filter(a => a.id !== ad.id);
    if (same.length) return same.slice(0, limit);
  }
  return [];
}

// ---------- categories ----------
/**
 * Store categories ranked by total creative count, from the full index snapshot.
 *
 * The index's `/market/store-categories` endpoint carries server-side aggregates
 * (brand_count and creative_count) computed across all stores — not a 100-row
 * sample — so we read the real numbers from there rather than summing the
 * top-100 shops by ad count (which under-reported shop counts by ~5 orders of
 * magnitude and surfaced one-shop categories as trending). The MCP
 * trending_categories tool reads it. (The /trends screen ranks niches by measured
 * traffic growth instead — app/(app)/trends/load.ts.)
 *
 * There is no per-category monthly-visits aggregate in the index, so that field
 * is deliberately absent rather than fabricated from a shop sample.
 */
export async function categoryAdRanking(limit = 50): Promise<
  { category: string; shops: number; liveAds: number }[]
> {
  const rows = await categoryRanking();
  return rows
    .filter(r => r.creativeCount > 0)
    .slice(0, limit)
    .map(r => ({ category: r.category, shops: r.shops, liveAds: r.creativeCount }));
}

// ---------- favorites (workspace-scoped) ----------
export type FavType = 'shop' | 'ad';

export async function toggleFavorite(workspaceId: string, userId: string, type: FavType, entityId: string): Promise<boolean> {
  const del = await query(
    `DELETE FROM favorites WHERE workspace_id=$1 AND user_id=$2 AND entity_type=$3 AND entity_id=$4 RETURNING id`,
    [workspaceId, userId, type, entityId],
  );
  if (del.length) return false;
  await query(
    `INSERT INTO favorites (workspace_id, user_id, entity_type, entity_id) VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING`,
    [workspaceId, userId, type, entityId],
  );
  await markFirst('save', userId, workspaceId); // funnel stamp: exactly-once, never throws
  return true;
}

export async function favoriteIds(workspaceId: string, userId: string, type: FavType, shared = false): Promise<string[]> {
  const rows = await query<{ entity_id: string }>(
    shared
      ? `SELECT entity_id FROM favorites WHERE workspace_id=$1 AND entity_type=$2
         GROUP BY entity_id ORDER BY max(created_at) DESC`
      : `SELECT entity_id FROM favorites WHERE workspace_id=$1 AND user_id=$3 AND entity_type=$2 ORDER BY created_at DESC`,
    shared ? [workspaceId, type] : [workspaceId, type, userId],
  );
  return rows.map(r => r.entity_id);
}

export async function favoriteCount(workspaceId: string, userId: string, type: FavType): Promise<number> {
  const r = await one<{ n: string }>(
    `SELECT count(*) AS n FROM favorites WHERE workspace_id=$1 AND user_id=$2 AND entity_type=$3`,
    [workspaceId, userId, type],
  );
  return Number(r?.n ?? 0);
}

// ---------- brandtracker (workspace-scoped) ----------
export interface TrackerRow { id: string; shopId: string; domain: string; name: string; createdAt: Date }

export async function listTrackers(workspaceId: string): Promise<TrackerRow[]> {
  const rows = await query<{ id: string; shop_id: string; domain: string; name: string; created_at: Date }>(
    `SELECT id, shop_id, domain, name, created_at FROM trackers WHERE workspace_id=$1 ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(r => ({ id: r.id, shopId: r.shop_id, domain: r.domain, name: r.name, createdAt: r.created_at }));
}

export async function trackerCount(workspaceId: string): Promise<number> {
  const r = await one<{ n: string }>(`SELECT count(*) AS n FROM trackers WHERE workspace_id=$1`, [workspaceId]);
  return Number(r?.n ?? 0);
}

export async function addTracker(workspaceId: string, userId: string, shop: { id: string; domain: string; name: string }): Promise<void> {
  await query(
    `INSERT INTO trackers (workspace_id, shop_id, domain, name, created_by) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (workspace_id, shop_id) DO NOTHING`,
    [workspaceId, shop.id, shop.domain, shop.name, userId],
  );
  await markFirst('track', userId, workspaceId); // funnel stamp: exactly-once, never throws
}

export async function removeTracker(workspaceId: string, shopId: string): Promise<void> {
  await query(`DELETE FROM trackers WHERE workspace_id=$1 AND shop_id=$2`, [workspaceId, shopId]);
}

export async function isTracked(workspaceId: string, shopId: string): Promise<boolean> {
  const r = await one(`SELECT 1 FROM trackers WHERE workspace_id=$1 AND shop_id=$2`, [workspaceId, shopId]);
  return !!r;
}

/** One tenant-scoped query for list pages; avoids one Postgres round trip per row. */
export async function trackedShopIds(workspaceId: string, shopIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(shopIds.filter(Boolean))];
  if (!ids.length) return new Set();
  const rows = await query<{ shop_id: string }>(
    `SELECT shop_id FROM trackers WHERE workspace_id=$1 AND shop_id = ANY($2::text[])`,
    [workspaceId, ids],
  );
  return new Set(rows.map(row => row.shop_id));
}
