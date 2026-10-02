// One Shops explorer page for the signed-in workspace: the index query, the
// workspace's hidden/viewed/tracked lists and row signals. Shared
// by the server render of /shops (first paint) and GET /api/shops (every
// filter, sort and page change after it), so both always return the same rows.
import type { Ctx } from '@/lib/auth/guard';
import type { AdPreview, Shop, ShopRow } from '@/lib/types';
import { queryShops, favoriteIds } from '@/lib/data';
import { applyCrux, cleanDomain, countShops } from '@/lib/market/shops';
import { parseShopQuery } from '@/lib/market/shop-query';
import { storeAdPreviews } from '@/lib/market/creatives';
import { shopRowSignals, applyRowSignals } from '@/lib/market/shop-signals';
import { hiddenShopIds, storeIdOf, trackedShopIdList, viewedShopIds } from './data';

export const PAGE_SIZE = 25;

export interface ShopsRow extends ShopRow {
  saved: boolean;
  viewed: boolean;
  /** Up to three of the store's live ad creatives (pictured only); [] = none shown.
   *  Filled in by GET /api/shops/ads after the rows land (loadShopAds). */
  ads: AdPreview[];
}

export interface ShopsPayload {
  rows: ShopsRow[];
  total: number | null;
  /** Shops across every platform under the same filters (headline); null = use total. */
  allPlatformsTotal: number | null;
  page: number;
  limit: number;
  hasMore: boolean;
  hiddenCount: number;
}

const num = (v: string | undefined) => (v && Number.isFinite(+v) ? +v : undefined);

function toRow(s: Shop, saved: boolean, viewed: boolean): ShopsRow {
  return {
    id: s.id, name: s.name, domain: s.domain, fullTitle: s.fullTitle, screenshot: s.screenshot,
    logo: s.logo, country: s.country, platform: s.platform, createdOn: s.createdOn,
    // The table shows up to three pictured best sellers; the rest never render.
    bestSellers: s.bestSellers.filter(p => p.image).slice(0, 3),
    productCount: s.productCount, niches: s.niches, trafficSource: s.trafficSource,
    monthlyVisits: s.monthlyVisits, cruxBucket: s.cruxBucket, similarWebRank: s.similarWebRank,
    similarweb: s.similarweb, visitorCountries: s.visitorCountries,
    trafficSeries: s.trafficSeries, metaAds: s.metaAds,
    targetedCountries: s.targetedCountries, liveAdsSeries: s.liveAdsSeries,
    visitsGrowth: s.visitsGrowth, avgPrice: s.avgPrice, maxAds7d: s.maxAds7d,
    saved, viewed,
    ads: [],
  };
}

/** `limit` is the page size: the explorer uses PAGE_SIZE, the CSV export up to 100 (the index's cap).
 *  Rows come back without ad thumbnails: the creative index takes 0.5-1.4s cold for a
 *  page of stores (one sorted search per store on 11M docs), five times everything else
 *  here, so the table asks for them separately (loadShopAds) once the rows are on screen. */
/** `timing` (optional) collects `name;dur=ms` entries for a Server-Timing header. */
export async function loadShops(ctx: Ctx, sp: Record<string, string | undefined>, limit = PAGE_SIZE, timing?: string[]): Promise<ShopsPayload> {
  let t = performance.now();
  const mark = (name: string) => { const now = performance.now(); timing?.push(`${name};dur=${Math.round(now - t)}`); t = now; };
  const page = Math.max(1, num(sp.page) ?? 1);
  const showHidden = sp.hidden === 'show';

  const [savedIds, hidden, viewed, tracked] = await Promise.all([
    favoriteIds(ctx.workspaceId, ctx.user.id, 'shop'),
    hiddenShopIds(ctx.workspaceId),
    viewedShopIds(ctx.workspaceId, ctx.user.id),
    sp.tracked ? trackedShopIdList(ctx.workspaceId) : Promise.resolve([] as string[]),
  ]);
  mark('lists');
  const hiddenSet = new Set(hidden);
  const viewedSet = new Set(viewed);
  const trackedSet = new Set(tracked);
  const savedSet = new Set(savedIds);

  // Workspace lists become index filters (store_id terms), so every page stays
  // full and the total counts only matching shops. `keep` narrows to a list,
  // `drop` removes one; both compose with every other filter and sort.
  let keep: Set<string> | null = null;
  const narrow = (ids: Set<string>) => { keep = keep ? new Set([...keep].filter(id => ids.has(id))) : new Set(ids); };
  const drop = new Set<string>();
  if (showHidden) narrow(hiddenSet); else hidden.forEach(id => drop.add(id));
  if (sp.viewed === 'only') narrow(viewedSet); else if (sp.viewed === 'exclude') viewed.forEach(id => drop.add(id));
  if (sp.tracked === 'only') narrow(trackedSet); else if (sp.tracked === 'exclude') tracked.forEach(id => drop.add(id));
  const keepIds: string[] | null = keep ? [...(keep as Set<string>)].filter(id => !drop.has(id)) : null;

  const qp = {
    q: sp.q, platform: sp.platform,
    category: sp.subcategory || sp.category,
    // Every chip's URL (new names and the older ones saved searches carry): lib/market/shop-query.ts.
    ...parseShopQuery(sp),
    storeIds: keepIds?.map(storeIdOf), excludeStoreIds: keepIds ? undefined : [...drop].map(storeIdOf),
    sort: sp.sort, dir: sp.dir, view: sp.view, page, limit,
  };
  const none = keepIds && keepIds.length === 0;
  // The list defaults to Shopify; the headline counts every platform under the
  // same filters. A count-only query in parallel — no added wait.
  // A failure only drops the headline back to the list total.
  const [res, allPlatforms] = await Promise.all([
    none ? { items: [] as Shop[], total: 0 } : queryShops(qp, { crux: false }),
    none ? 0 : sp.platform ? null
      : countShops({ ...qp, platform: 'all' }, 300).catch(() => null),
  ]);
  mark('index');
  // The same lists re-applied to the rows, so a backend that has not learned
  // the store_id filters yet can never show a hidden shop or a wrong list.
  const rows = res.items.filter(s => !drop.has(s.id) && (!keepIds || keepIds.includes(s.id)));

  // Both are per-row lookups keyed off the page; neither needs the other.
  const [signals] = await Promise.all([shopRowSignals(rows.map(s => s.storeId)), applyCrux(rows)]);
  mark('signals');

  return {
    rows: rows.map(s => toRow(applyRowSignals(s, signals.get(s.storeId)), savedSet.has(s.id), viewedSet.has(s.id))),
    total: res.total,
    allPlatformsTotal: allPlatforms ?? null,
    page,
    limit,
    hasMore: res.items.length === limit,
    hiddenCount: hidden.length,
  };
}

/** Up to three pictured live ads per store domain, for the rows `loadShops` returned.
 *  Keyed by the domain as given; a store with none maps to []. Never throws. */
export async function loadShopAds(domains: string[]): Promise<Record<string, AdPreview[]>> {
  const previews = await storeAdPreviews(domains, 3);
  return Object.fromEntries(domains.map(d => [d, (previews.get(cleanDomain(d)) ?? [])
    .map(({ id, image, mediaType, headline, advertiser }) => ({ id, image, mediaType, headline, advertiser }))]));
}
