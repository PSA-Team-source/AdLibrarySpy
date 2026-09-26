// One Shops explorer page for the signed-in workspace: the index query, the
// workspace's hidden/viewed/tracked lists and row signals. Shared
// by the server render of /shops (first paint) and GET /api/shops (every
// filter, sort and page change after it), so both always return the same rows.
import type { Ctx } from '@/lib/auth/guard';
import type { MetaPage, Shop, ShopRow } from '@/lib/types';
import { queryShops, favoriteIds, storeMetaPages } from '@/lib/data';
import { applyCrux, countShops } from '@/lib/market/shops';
import { shopRowSignals, applyRowSignals } from '@/lib/market/shop-signals';
import { hiddenShopIds, storeIdOf, trackedShopIdList, viewedShopIds } from './data';

export const PAGE_SIZE = 25;

export interface ShopsRow extends ShopRow {
  saved: boolean;
  viewed: boolean;
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

function trafficRange(value: string | undefined) {
  const min: Record<string, number> = { '10k': 10_000, '100k': 100_000, '1m': 1_000_000, '10m': 10_000_000 };
  return { trafficMin: value ? min[value] : undefined };
}

function growthRange(value: string | undefined) {
  if (value === 'declining') return { growthMax: -0.01 };
  if (value === 'positive') return { growthMin: 0 };
  const min: Record<string, number> = { '10': 10, '25': 25, '50': 50 };
  return { growthMin: value ? min[value] : undefined };
}

function createdAfter(value: string | undefined) {
  const days: Record<string, number> = { '30d': 30, '90d': 90, '1y': 365, '2y': 730 };
  if (!value || !days[value]) return undefined;
  return new Date(Date.now() - days[value] * 86_400_000).toISOString();
}

function toRow(s: Shop, saved: boolean, viewed: boolean, metaPage: MetaPage | null): ShopsRow {
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
    metaPage, saved, viewed,
  };
}

export async function loadShops(ctx: Ctx, sp: Record<string, string | undefined>): Promise<ShopsPayload> {
  const page = Math.max(1, num(sp.page) ?? 1);
  const showHidden = sp.hidden === 'show';

  const [savedIds, hidden, viewed, tracked] = await Promise.all([
    favoriteIds(ctx.workspaceId, ctx.user.id, 'shop'),
    hiddenShopIds(ctx.workspaceId),
    viewedShopIds(ctx.workspaceId, ctx.user.id),
    sp.tracked ? trackedShopIdList(ctx.workspaceId) : Promise.resolve([] as string[]),
  ]);
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
    q: sp.q, country: sp.country, platform: sp.platform,
    category: sp.subcategory || sp.category,
    productsMin: num(sp.productsMin), productsMax: num(sp.productsMax),
    avgPriceMin: num(sp.avgPriceMin), avgPriceMax: num(sp.avgPriceMax),
    ...trafficRange(sp.traffic), ...growthRange(sp.growth),
    visitorCountry: sp.visitorCountry, createdAfter: createdAfter(sp.created),
    pixels: sp.pixel ? [sp.pixel] : undefined, tech: sp.tech ? [sp.tech] : undefined,
    storeIds: keepIds?.map(storeIdOf), excludeStoreIds: keepIds ? undefined : [...drop].map(storeIdOf),
    sort: sp.sort, dir: sp.dir, view: sp.view, page, limit: PAGE_SIZE,
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
  // The same lists re-applied to the rows, so a backend that has not learned
  // the store_id filters yet can never show a hidden shop or a wrong list.
  const rows = res.items.filter(s => !drop.has(s.id) && (!keepIds || keepIds.includes(s.id)));

  // Both are per-row lookups keyed off the page; neither needs the other.
  const [signals, pages] = await Promise.all([
    shopRowSignals(rows.map(s => s.storeId)), storeMetaPages(rows.map(s => s.domain)), applyCrux(rows),
  ]);

  return {
    rows: rows.map(s => toRow(applyRowSignals(s, signals.get(s.storeId)), savedSet.has(s.id), viewedSet.has(s.id), pages.get(s.domain) ?? null)),
    total: res.total,
    allPlatformsTotal: allPlatforms ?? null,
    page,
    limit: PAGE_SIZE,
    hasMore: res.items.length === PAGE_SIZE,
    hiddenCount: hidden.length,
  };
}
