// Cached loaders for /trends. Every section reads the market index through the
// app's own list/count calls (lib/data queryShops, lib/market/shops), and each
// result is cached server-side, so a page view costs no index fan-out: the
// numbers move once a month (SimilarWeb) and the cache refreshes in the
// background (stale-while-revalidate).
//
// An empty result is thrown, never cached — unstable_cache then keeps serving the
// last good copy, and a section with nothing to show on a cold failure simply
// does not render.
import { unstable_cache } from 'next/cache';
import type { Ad, Shop } from '@/lib/types';
import { queryShops } from '@/lib/data';
import { categories, categoryTree, countShops, getShops, listShops } from '@/lib/market/shops';
import { listAds, storeAdPreviews } from '@/lib/market/creatives';
import { listWinningProducts, type WinningProduct } from '@/lib/market/products';
import { chQuery } from '@/lib/clickhouse';
import { mapLimit } from '@/lib/seo/directory';
import {
  RISER_BANDS, MAX_GROWTH_PCT, NICHE_MIN_BRANDS, NICHE_MIN_GROWTH, NICHE_MIN_VISITS,
  isBreakout, rankNiches, adWeeks, adLift, type NicheCount, type RankedNiche, type RiserBand,
} from '@/lib/trends';

export interface TrendShop {
  id: string;
  name: string;
  domain: string;
  logo: string;
  country: string;
  niches: string[];
  visits: number;
  prevVisits: number;
  growthPct: number;
  /** Meta ads in the library for this store (0 = growing without Meta ads). */
  metaAds: number;
  /** SimilarWeb month the visits measure, "2026-08". */
  period: string;
  products: { title: string; image: string }[];
}

function toTrendShop(s: Shop): TrendShop {
  const sw = s.similarweb!;
  return {
    id: s.id, name: s.name, domain: s.domain, logo: s.logo, country: s.country, niches: s.niches,
    visits: sw.visits, prevVisits: sw.prevVisits, growthPct: sw.growthPct ?? 0, period: sw.period,
    metaAds: s.metaAds ?? 0,
    products: s.bestSellers
      .filter((p, i, all) => p.image && p.title.trim() && !NOT_A_PRODUCT.test(p.title)
        && all.findIndex(q => q.title.trim() === p.title.trim()) === i)
      .slice(0, 3)
      .map(p => ({ title: p.title.trim(), image: p.image! })),
  };
}

/** Checkout add-ons stores list as products ("Expedited Shipping", "Package Protection"). */
const NOT_A_PRODUCT = /\b(shipping|package protection|shipping protection|insurance|gift ?card|e-?gift|donation)\b/i;

const HOUR = 3600;

/** Fastest-growing Shopify stores at a visit floor, credible breakouts only (lib/trends isBreakout), up to 100; callers show the top 25. */
export const loadRisers = unstable_cache(async (band: RiserBand): Promise<TrendShop[]> => {
  const min = RISER_BANDS[band].min;
  const { items } = await queryShops({
    view: 'fastest-growing', trafficMin: min, growthMax: MAX_GROWTH_PCT, limit: 100,
  });
  const out = items.filter(s => isBreakout(s.similarweb, min)).map(toTrendShop);
  if (!out.length) throw new Error(`trends risers ${band}: no rows`);
  return out;
}, ['trends:risers:v3'], { revalidate: HOUR });

export interface NicheLeader {
  id: string; name: string; domain: string; logo: string; growthPct: number;
  /** The store's top product with a picture (same source as Shops' Top Products); absent = none. */
  product?: { image: string; title: string };
}
export interface TrendNiche extends RankedNiche { leaders: NicheLeader[] }
export interface NicheTrends { period: string; niches: TrendNiche[] }

/**
 * Subcategories ranked by the share of their measured stores (10K+ visits) that
 * grew 50%+ month over month — two list totals per subcategory, the whole index,
 * not a sample — each with its three fastest credible risers.
 */
export const loadNicheTrends = unstable_cache(async (): Promise<NicheTrends> => {
  const tree = await categoryTree();
  const subs = tree.flatMap(t => t.children
    .filter(c => c.brandCount >= NICHE_MIN_BRANDS)
    .map(c => ({ id: c.id, name: c.name, parentId: t.id, parentName: t.name })));

  const counts = await mapLimit(subs, 6, async (n): Promise<NicheCount | null> => {
    try {
      const [measured, breakout] = await Promise.all([
        countShops({ category: n.id, trafficMin: NICHE_MIN_VISITS }),
        countShops({ category: n.id, trafficMin: NICHE_MIN_VISITS, growthMin: NICHE_MIN_GROWTH }),
      ]);
      return measured == null || breakout == null ? null : { ...n, measured, breakout };
    } catch {
      return null;
    }
  });
  const ranked = rankNiches(counts.filter((c): c is NicheCount => !!c));
  if (!ranked.length) throw new Error('trends niches: no counts returned');

  // Each niche's fastest credible risers. A store filed under two niches (Dogs
  // and Pet Food) leads only the higher-ranked one, so no two cards repeat.
  const leaderFloor = 50_000;
  const candidates = await mapLimit(ranked, 4, n => listShops({
    category: n.id, trafficMin: leaderFloor, growthMax: MAX_GROWTH_PCT,
    sortBy: 'sw_growth_pct', sortOrder: 'desc', limit: 20,
  }).then(r => r.items.filter(s => isBreakout(s.similarweb, leaderFloor))).catch(() => [] as Shop[]));
  const used = new Set<string>();
  const niches = ranked.map((n, i): TrendNiche => {
    const picked = candidates[i].filter(s => !used.has(s.id)).slice(0, 3);
    picked.forEach(s => used.add(s.id));
    return {
      ...n,
      leaders: picked.map(s => ({
        id: s.id, name: s.name, domain: s.domain, logo: s.logo, growthPct: s.similarweb?.growthPct ?? 0,
        ...(() => { const p = s.bestSellers.find(b => b.image); return p ? { product: { image: p.image!, title: p.title } } : {}; })(),
      })),
    };
  });
  const period = candidates.flat().find(s => s.similarweb?.period)?.similarweb?.period ?? '';
  return { period, niches };
}, ['trends:niches:v2'], { revalidate: 6 * HOUR });

// ---------- Meta ads, this week vs last (ClickHouse market__creatives) ----------
// Daily signal: new Meta ads by their start date, the last 7 full UTC days vs the
// 7 before. CDC leaves repeat rows per ad, so every count is distinct ad ids.
// Read lib/trends.ts adLift for why niches/formats compare shares.

const LIVE = `_cdc_deleted = 0 AND deleted_at IS NULL`;
const WEEKS = `start_at >= toUnixTimestamp(toDate({prevFrom:String})) AND start_at < toUnixTimestamp(toDate({to:String}))`;
const CUR = `start_at >= toUnixTimestamp(toDate({from:String}))`;

export interface AdStore {
  id: string; name: string; domain: string; logo: string; country: string; niche: string;
  newAds: number; prevAds: number; pages: number; videoShare: number;
  /** First ad ever in the library (ISO date) — set on new brands only. */
  firstAd?: string;
  ads: Ad[];
}
export interface AdShare { id: string; name: string; cur: number; prev: number; share: number; lift: number }
export interface AdTrends {
  from: string; to: string; prevFrom: string;
  newAds: number; prevNewAds: number; advertisers: number; prevAdvertisers: number;
  scaling: AdStore[]; newBrands: AdStore[]; niches: AdShare[]; formats: AdShare[];
}

const FORMAT_NAMES: Record<string, string> = {
  video: 'Video', image: 'Single image', dco: 'Dynamic creative', carousel: 'Carousel',
  dpa: 'Catalogue (DPA)', event: 'Event', multi_images: 'Multiple images',
};

/**
 * Index rows for ClickHouse store ids, in the given order: real Shopify stores
 * only. Ads also link out to instagram.com, google.com, fb.me and drama apps,
 * which the index files as "shopify" with no products, so a store must list
 * products (measured: 120 of the week's top 300 link hosts pass, all storefronts).
 */
async function resolveStores(rows: Record<string, unknown>[], keep: number): Promise<AdStore[]> {
  const out: AdStore[] = [];
  for (let i = 0; i < rows.length && out.length < keep; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const shops = await getShops(chunk.map(r => String(r.store_id)))
      .catch(err => { console.error('[trends ads] getShops', err); return []; });
    const byId = new Map(shops.map(s => [s.storeId, s]));
    for (const r of chunk) {
      const s = byId.get(String(r.store_id));
      if (!s?.domain || s.platform !== 'shopify' || s.productCount <= 0) continue;
      const cur = Number(r.cur);
      out.push({
        id: s.id, name: s.name || s.domain, domain: s.domain, logo: s.logo, country: s.country, niche: s.niches[0] ?? '',
        newAds: cur, prevAds: Number(r.prev), pages: Number(r.pages), videoShare: cur ? Number(r.video) / cur : 0,
        ...(r.first ? { firstAd: new Date(Number(r.first) * 1000).toISOString().slice(0, 10) } : {}),
        ads: [],
      });
      if (out.length >= keep) break;
    }
  }
  const previews = await storeAdPreviews(out.map(s => s.domain), 4);
  for (const s of out) s.ads = previews.get(s.domain) ?? [];
  return out;
}

export const loadAdTrends = unstable_cache(async (today: string): Promise<AdTrends> => {
  const w = adWeeks(today);
  const p = { ...w };
  const [totals, stores, fresh, niches, formats, names] = await Promise.all([
    chQuery(`SELECT uniqExactIf(id, ${CUR}) AS cur, uniqExactIf(id, NOT ${CUR}) AS prev,
                    uniqExactIf(store_id, ${CUR} AND store_id != '') AS sc, uniqExactIf(store_id, NOT ${CUR} AND store_id != '') AS sp
               FROM market_research.market__creatives WHERE ${LIVE} AND ${WEEKS} FORMAT JSONEachRow`, p),
    chQuery(`SELECT store_id, uniqExactIf(id, ${CUR}) AS cur, uniqExactIf(id, NOT ${CUR}) AS prev,
                    uniqExactIf(page_id, ${CUR}) AS pages, uniqExactIf(id, ${CUR} AND display_format = 'video') AS video
               FROM market_research.market__creatives WHERE ${LIVE} AND ${WEEKS} AND store_id != ''
              GROUP BY store_id ORDER BY cur DESC LIMIT 400 FORMAT JSONEachRow`, p),
    // Brands whose first ad in the whole library started this week, launching 20+ ads.
    chQuery(`SELECT store_id, uniqExact(id) AS cur, 0 AS prev, uniqExact(page_id) AS pages, uniqExactIf(id, display_format = 'video') AS video, min(start_at) AS first
               FROM market_research.market__creatives
              WHERE ${LIVE} AND store_id IN (
                SELECT store_id FROM market_research.market__creatives
                 WHERE ${LIVE} AND ${CUR} AND start_at < toUnixTimestamp(toDate({to:String})) AND store_id != ''
                 GROUP BY store_id HAVING uniqExact(id) >= 20)
              GROUP BY store_id HAVING first >= toUnixTimestamp(toDate({from:String}))
              ORDER BY cur DESC LIMIT 300 FORMAT JSONEachRow`, p),
    chQuery(`SELECT toString(store_category_id) AS k, uniqExactIf(id, ${CUR}) AS cur, uniqExactIf(id, NOT ${CUR}) AS prev
               FROM market_research.market__creatives WHERE ${LIVE} AND ${WEEKS} AND store_category_id > 0
              GROUP BY k FORMAT JSONEachRow`, p),
    chQuery(`SELECT ifNull(display_format, '') AS k, uniqExactIf(id, ${CUR}) AS cur, uniqExactIf(id, NOT ${CUR}) AS prev
               FROM market_research.market__creatives WHERE ${LIVE} AND ${WEEKS}
              GROUP BY k FORMAT JSONEachRow`, p),
    categories(),
  ]);
  const t = totals[0] ?? {};
  const newAds = Number(t.cur) || 0, prevNewAds = Number(t.prev) || 0;
  if (!newAds || !prevNewAds) throw new Error('trends ads: no new ads counted');

  const shares = (rows: Record<string, unknown>[], name: (id: string) => string | undefined): AdShare[] => {
    const cT = rows.reduce((a, r) => a + Number(r.cur), 0), pT = rows.reduce((a, r) => a + Number(r.prev), 0);
    return rows.flatMap(r => {
      const id = String(r.k), n = name(id), cur = Number(r.cur), prev = Number(r.prev);
      const lift = adLift(cur, prev, cT, pT);
      return n && lift != null ? [{ id, name: n, cur, prev, share: cur / cT, lift }] : [];
    });
  };

  const [scaling, newBrands] = await Promise.all([resolveStores(stores, 15), resolveStores(fresh, 12)]);
  return {
    ...w, newAds, prevNewAds,
    advertisers: Number(t.sc) || 0, prevAdvertisers: Number(t.sp) || 0,
    scaling, newBrands,
    niches: shares(niches, id => names[id]).sort((a, b) => b.lift - a.lift),
    formats: shares(formats, id => FORMAT_NAMES[id]).sort((a, b) => b.share - a.share),
  };
}, ['trends:ads:v2'], { revalidate: HOUR });

// ---------- video styles (market__creatives.ai_style, Go services/creativestyles) ----------
// Every live video ad is watched (4 frames) by a vision model and filed under one
// style. Shares are of the video ads that carry a confident style, so how many
// we have watched does not move them.

/** Same names the API returns (Go domain.CreativeStyles). */
const STYLE_NAMES: Record<string, string> = {
  cartoon: 'Cartoon & animation', vsl: 'Video sales letter', ugc: 'UGC selfie', talking_head: 'Talking head',
  podcast: 'Podcast clip', street_interview: 'Street interview', skit: 'Skit & drama', demo: 'Product demo',
  before_after: 'Before & after', screen_recording: 'Screen recording', slideshow: 'Slideshow', lifestyle: 'Lifestyle film',
};
/** Same gate as the API's ai_labels (Go domain.DefaultCreativeLabelGate). */
const STYLE_MIN_CONF = 0.5;
/** Below this many styled video ads this week the mix is too thin to show. */
const STYLES_MIN_WEEK = 300;

export interface VideoStyle {
  id: string; name: string; cur: number; prev: number; share: number;
  /** Share change vs last week; absent while last week is too thin to compare. */
  lift?: number;
  ads: Ad[];
}
export interface VideoStyles { from: string; to: string; styled: number; styles: VideoStyle[] }

export const loadVideoStyles = unstable_cache(async (today: string): Promise<VideoStyles> => {
  const w = adWeeks(today);
  // CDC keeps several versions of a row; each ad counts once, by its newest style.
  const rows = await chQuery(`
    SELECT s AS k, uniqExactIf(id, cur) AS cur, uniqExactIf(id, NOT cur) AS prev FROM (
      SELECT id, argMax(ai_style, _cdc_version) AS s, argMax(ai_style_conf, _cdc_version) AS c,
             any(${CUR}) AS cur
        FROM market_research.market__creatives
       WHERE ${LIVE} AND ${WEEKS} AND display_format = 'video'
       GROUP BY id)
    WHERE s != '' AND c >= {minConf:Float32}
    GROUP BY k FORMAT JSONEachRow`, { ...w, minConf: STYLE_MIN_CONF });
  const known = rows.filter(r => STYLE_NAMES[String(r.k)]);
  const cT = known.reduce((a, r) => a + Number(r.cur), 0), pT = known.reduce((a, r) => a + Number(r.prev), 0);
  if (cT < STYLES_MIN_WEEK) throw new Error(`trends styles: only ${cT} styled video ads this week`);

  const styles = known.map((r): VideoStyle => {
    const id = String(r.k), cur = Number(r.cur), prev = Number(r.prev);
    const lift = adLift(cur, prev, cT, pT);
    return { id, name: STYLE_NAMES[id], cur, prev, share: cur / cT, ...(lift != null ? { lift } : {}), ads: [] };
  }).filter(s => s.cur > 0).sort((a, b) => b.share - a.share);

  // Example ads: this week's, renderable, from the API (cached media, not expired CDN links).
  await mapLimit(styles, 4, async s => {
    s.ads = await listAds({ style: [s.id], from: w.from, limit: 4 })
      .then(r => r.items).catch(() => [] as Ad[]);
  });
  return { from: w.from, to: w.to, styled: cT, styles };
}, ['trends:video-styles:v1'], { revalidate: HOUR });

/** Products the most new Meta ads point at (last 14 days), one per store. */
export const loadHotProducts = unstable_cache(async (): Promise<WinningProduct[]> => {
  const { items } = await listWinningProducts({ sort: 'new_ads', limit: 60 });
  const seen = new Set<string>();
  const out = items.filter(p => p.image && p.title && p.newAds14d > 0
    && !NOT_A_PRODUCT.test(p.title) && !seen.has(p.store.domain) && seen.add(p.store.domain)).slice(0, 12);
  if (!out.length) throw new Error('trends hot products: none');
  return out;
}, ['trends:hot-products:v1'], { revalidate: HOUR });
