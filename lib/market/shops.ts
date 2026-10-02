// Shops, mapped from the PlatformDTC market index (top_brands).
//
// Every field here is a value the index actually stores. Where the index has no
// measurement, the field is empty/null and the UI omits the element entirely —
// nothing is interpolated, modelled or filled with noise.
import type { Shop, Product, Point, SimilarWebFacts } from '@/lib/types';
import { marketGet, marketPost, unwrapItems, unwrapTotal } from './client';
import { monthlyTraffic, monthlyTrafficMany, trafficConfigured } from '@/lib/traffic/provider';
import { cruxRanks, cruxRank } from '@/lib/traffic/crux';
import { safeGet } from '@/lib/safe-fetch';
import { mapFacts, mapDetail, previousMonth } from '@/lib/traffic/similarweb';
import { measured, rankSimilar } from './similar-rank';

const CCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', DE: 'EUR', FR: 'EUR', ES: 'EUR',
  IT: 'EUR', NL: 'EUR', SE: 'SEK', BR: 'BRL', MX: 'MXN', JP: 'JPY', IN: 'INR',
};
const LANG: Record<string, string> = {
  US: 'English', GB: 'English', CA: 'English', AU: 'English',
  FR: 'French', DE: 'German', ES: 'Spanish', IT: 'Italian', NL: 'Dutch', BR: 'Portuguese', MX: 'Spanish',
};

export const cleanDomain = (u: unknown): string =>
  // Lowercase first: an uppercase scheme (HTTP://) would otherwise survive the
  // protocol strip and then be truncated to "http:" by the path strip.
  String(u || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');

const shopId = (b: Record<string, unknown>): string =>
  'shp_' + String(b.store_id || b.id || cleanDomain(b.store_url)).replace(/[^a-z0-9]/gi, '');

export interface CategoryNode {
  id: string;
  name: string;
  brandCount: number;
  children: { id: string; name: string; brandCount: number }[];
}

// Short-lived memos of the taxonomy (it is read on every Shops request). Only a
// NON-EMPTY read is kept — memoising a failed or empty read blanked the Niche
// filter and every Category cell until the next pm2 restart — and only for
// MEMO_MS: the brand counts inside move as the index enricher files stores
// under subcategories, and a process-lifetime copy froze them.
const MEMO_MS = 10 * 60_000;
let CATS: { v: Record<string, string>; at: number } | null = null;
let CAT_TREE: { v: CategoryNode[]; at: number } | null = null;
const fresh = (m: { at: number } | null) => !!m && Date.now() - m.at < MEMO_MS;

interface RawCategory {
  id: number; name: string; level: number; parent_id: number | null;
  brand_count: number; creative_count: number;
}

async function loadCategories(): Promise<RawCategory[]> {
  const path = '/market/store-categories?all=true';
  // 10 min: Go caches this itself (1h) and answers in ~1ms.
  let items = unwrapItems(await marketGet(path, { revalidate: 600 }));
  // An empty taxonomy is never real — it is a cached bad read. Bypass the
  // fetch cache once rather than serve it for the rest of the hour.
  if (!items.length) items = unwrapItems(await marketGet(path, { revalidate: 0 }));
  return items
    .filter(c => c?.id != null && c?.name)
    .map(c => ({
      id: Number(c.id),
      name: String(c.name).trim(),
      level: Number(c.level ?? 0),
      parent_id: c.parent_id == null ? null : Number(c.parent_id),
      brand_count: Number(c.brand_count ?? 0),
      creative_count: Number(c.creative_count ?? 0),
    }));
}

/** Flat id → name map, used to label a store's category. */
export async function categories(): Promise<Record<string, string>> {
  if (CATS && fresh(CATS)) return CATS.v;
  try {
    const rows = await loadCategories();
    const map: Record<string, string> = {};
    for (const c of rows) map[String(c.id)] = c.name;
    if (Object.keys(map).length) CATS = { v: map, at: Date.now() };
    return map;
  } catch {
    return {};
  }
}

/**
 * Niches the creative index can filter by: top-level categories (creatives
 * carry the store's top-level id as store_category_id) that hold creatives,
 * richest first. Empty on failure, so the Niche filter is simply absent.
 */
export async function creativeNiches(): Promise<{ id: string; name: string; creativeCount: number }[]> {
  try {
    return (await loadCategories())
      .filter(c => c.level === 0 && c.creative_count > 0)
      .sort((a, b) => b.creative_count - a.creative_count)
      .map(c => ({ id: String(c.id), name: c.name, creativeCount: c.creative_count }));
  } catch {
    return [];
  }
}

/**
 * The category picker's data.
 *
 * The endpoint returns 904 rows across three levels, and 395 names appear more
 * than once: ids 1-9 are a legacy taxonomy shadowing the current 4xxx one with
 * far smaller brand counts ("Computers" is id 1 with 729,825 brands and id 4074
 * with 1,373,079). Rendering all of them produced a scrolling wall of pills
 * with visible duplicates, so we keep the richest row per name and expose the
 * real hierarchy instead.
 */
export async function categoryTree(): Promise<CategoryNode[]> {
  if (CAT_TREE && fresh(CAT_TREE)) return CAT_TREE.v;
  try {
    const rows = await loadCategories();

    // Keep the highest-brand_count row for any repeated name, per level.
    const bestByName = (list: RawCategory[]) => {
      const best = new Map<string, RawCategory>();
      for (const c of list) {
        const prev = best.get(c.name);
        if (!prev || c.brand_count > prev.brand_count) best.set(c.name, c);
      }
      return [...best.values()];
    };

    const tops = bestByName(rows.filter(c => c.level === 0))
      .sort((a, b) => b.brand_count - a.brand_count);
    const topIds = new Set(tops.map(t => t.id));

    const tree = tops.map(t => ({
      id: String(t.id),
      name: t.name,
      brandCount: t.brand_count,
      children: bestByName(rows.filter(c => c.parent_id === t.id && !topIds.has(c.id)))
        .sort((a, b) => b.brand_count - a.brand_count)
        .map(c => ({ id: String(c.id), name: c.name, brandCount: c.brand_count })),
    }));
    if (tree.length) CAT_TREE = { v: tree, at: Date.now() };
    return tree;
  } catch {
    return [];
  }
}

export interface CategoryRankRow { category: string; shops: number; creativeCount: number }

/**
 * Store categories ranked by their store count and creative count, from the
 * full index snapshot (the `/market/store-categories` aggregates — brand_count
 * and creative_count, both computed server-side across all stores, not a 100-row
 * sample). Categories are deduplicated by name keeping the richest row, for the
 * same reason as `categoryTree`: duplicate names shadow one another in the
 * legacy taxonomy.
 */
export async function categoryRanking(): Promise<CategoryRankRow[]> {
  const rows = await loadCategories();
  const best = new Map<string, RawCategory>();
  for (const c of rows) {
    if (c.level !== 0) continue;
    const prev = best.get(c.name);
    if (!prev || c.brand_count > prev.brand_count) best.set(c.name, c);
  }
  return [...best.values()]
    .map(c => ({ category: c.name, shops: c.brand_count, creativeCount: c.creative_count }))
    .sort((a, b) => b.creativeCount - a.creativeCount);
}

/** Real monthly points the index stores. No smoothing, no synthetic months. */
function indexTrafficPoints(b: Record<string, unknown>): Point[] {
  const raw = b.last_3m_traffic;
  if (!Array.isArray(raw)) return [];
  const pts: Point[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      const key = String(k);
      if (!/^\d{6}$/.test(key)) continue;
      pts.push({ t: `${key.slice(0, 4)}-${key.slice(4, 6)}`, v: n });
    }
  }
  // ascending by month; keep duplicate values — they are the stored measurement
  return pts.sort((a, b2) => a.t.localeCompare(b2.t));
}

/**
 * The two measured months a LIST row carries (sw_visits + sw_prev_visits), for
 * the row sparkline. sw_period names the measured month and SimilarWeb's
 * history is consecutive months ending there, so the earlier point is the month
 * before it and is labelled as such. Without a period neither month has a name,
 * and the earlier label stays empty rather than being guessed.
 *
 * The index's own last_3m_traffic is NOT mixed in here — for a measured store it
 * is a different site's series (the parent domain's), and two scales in one
 * sparkline is exactly the unlabelled mixing this swap exists to end.
 */
function swPair(sw: SimilarWebFacts): Point[] {
  if (sw.prevVisits <= 0) return [];        // one point draws no line
  return [{ t: previousMonth(sw.period), v: sw.prevVisits }, { t: sw.period, v: sw.visits }];
}

function mapProducts(b: Record<string, unknown>): Product[] {
  const raw = b.news_products;
  if (!Array.isArray(raw)) return [];
  const out: Product[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    let img = String(o.image_url ?? '');
    if (!img) continue;                       // no image → not rendered at all
    if (!/^https?:\/\//.test(img)) img = `https://cdn.shopify.com/s/files/${img.replace(/^\/+/, '')}`;
    const price = Number(o.price);
    out.push({
      rank: out.length + 1,
      title: String(o.title ?? '').slice(0, 120),
      price: Number.isFinite(price) && price > 0 ? price / 100 : 0,
      currency: String(b.country && CCY[String(b.country)] ? CCY[String(b.country)] : 'USD'),
      createdAt: '',
      image: img,
    });
  }
  return out;
}

/**
 * Some index rows carry the crawler's error page as `store_title` — literally
 * "301 Moved Permanently", "Just a moment...", "Attention Required! | Cloudflare".
 * Those are artifacts of the fetch, not brand names, so we fall back to the
 * domain rather than print them as if they were the store's name. A bare status
 * code is not enough to reject on -- "404 Ink" and "500 Startups" are real
 * brands -- so a leading code must be followed by an actual reason phrase.
 */
const CRAWL_ARTIFACT = /^\s*\d{3}\s+(moved|found|not found|forbidden|bad gateway|service unavailable|internal server error|unauthorized|gone)\b|moved permanently|moved temporarily|^not found$|^forbidden$|bad gateway|service unavailable|access denied|just a moment|attention required|are you a robot|checking your browser|enable javascript|^error$/i;

/**
 * Store titles are page titles, so they carry chrome: "Home | Cheez-It®",
 * "Veinci | Affordable Dainty Elegant Jewelry", "RYZE Mushroom Coffee |
 * Official Site". Rendered raw they truncate to the useless half.
 *
 * The brand is the segment that matches the domain, not the longest one --
 * picking by length returns the tagline ("Affordable Dainty Elegant Jewelry"
 * instead of "Veinci"). Where nothing matches the domain, brands lead, so the
 * first non-generic segment is the better guess.
 */
const GENERIC_SEGMENT = /^(home|shop|store|official(\s+(site|store|website))?|welcome|index|buy online|online (shop|store))$/i;

/** The registrable label of a domain: store.nytimes.com -> nytimes. */
function domainRoot(domain: string): string {
  const labels = domain.split('.').filter(Boolean);
  if (labels.length < 2) return labels[0] ?? '';
  let idx = labels.length - 2;
  // Step past a public-suffix second level such as .co.uk / .com.br.
  if (labels[idx].length <= 3 && idx > 0) idx -= 1;
  return labels[idx];
}

export function displayBrand(title: unknown, domain: string): string {
  const full = brandName(title, domain);
  if (full === domain) return domain;

  const parts = full.split(/\s*[|–—·•]\s*|\s+-\s+/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return full;

  const meaningful = parts.filter(p => !GENERIC_SEGMENT.test(p));
  if (!meaningful.length) return full;

  const root = domainRoot(domain).toLowerCase();
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (root) {
    const matched = meaningful.find(p => {
      const n = norm(p);
      return n.length >= 3 && (root.includes(n) || n.includes(root));
    });
    if (matched) return matched;
  }
  return meaningful[0];
}

export function brandName(title: unknown, domain: string): string {
  const t = String(title ?? '').trim();
  if (!t || CRAWL_ARTIFACT.test(t)) return domain;
  return t;
}

export function mapBrand(b: Record<string, unknown>, cats: Record<string, string>): Shop {
  const domain = cleanDomain(b.store_url);
  // '' when the index has no origin (1.03M Shopify rows) — never defaulted to
  // US, which printed an invented flag on a third of the catalogue.
  const country = String(b.country || '').toUpperCase();
  const createdMs = Number(b.store_created_at);
  // Top-level category first, then the subcategories the markettech enricher
  // copied from market.stores (store_category_ids, all levels). Ids with no
  // live category name are dropped; the same name twice (legacy + current
  // taxonomy) shows once.
  const catIds = [b.store_category_id, ...(Array.isArray(b.store_category_ids) ? b.store_category_ids : [])];
  const niches = [...new Set(catIds.map(x => cats[String(x)]).filter(Boolean) as string[])].slice(0, 3);
  const indexPoints = indexTrafficPoints(b);
  const monthly = Number(b.monthly_traffic) || 0;
  // SimilarWeb for THIS exact host. Present = the crawl has reached this store
  // and its figures replace the index's; absent = the index figure stands, and
  // every surface labels it as the index's own estimate (trafficSource).
  const sw = mapFacts(b);

  return {
    id: shopId(b),
    name: displayBrand(b.store_title, domain),
    fullTitle: brandName(b.store_title, domain),
    similarWebRank: sw?.globalRank ?? (Number(b.similar_web) || 0),
    domain,
    logo: String(b.store_logo || ''),
    // Storefront screenshot where the platform has captured one (the public list
    // attaches it; the filter path gets it from row-signals). '' = none.
    screenshot: /^https:\/\//.test(String(b.screenshot_url ?? '')) ? String(b.screenshot_url) : '',
    myshopifyDomain: '',
    platform: (String(b.platform || 'shopify') as Shop['platform']),
    niches,
    country,
    language: LANG[country] || '',
    currency: CCY[country] || 'USD',
    theme: '',
    createdOn: Number.isFinite(createdMs) && createdMs > 0 ? new Date(createdMs).toISOString().slice(0, 10) : '',
    // SimilarWeb's measurement where it exists, the index's estimate otherwise.
    monthlyVisits: sw ? sw.visits : monthly,
    // sw_growth_pct is month-over-month on the measured figures. null there means
    // there was no earlier month to compare, which callers read off
    // `similarweb.growthPct` and render as nothing rather than as 0%.
    visitsGrowth: sw ? sw.growthPct ?? 0 : Number(b.growth_rate) || 0,
    // db_num_ads is the populated ad count: measured over 400 rows across four
    // slices of the index it is 45% filled, against 19% for library_num_ads and
    // 16% for num_ads_running. Reading library_num_ads first left ~4 rows in 5
    // showing no ads at all.
    metaAds: Number(b.db_num_ads) || Number(b.library_num_ads) || Number(b.num_ads_running) || 0,
    tiktokAds: 0,
    googleAds: 0,
    emails: 0,
    trustScore: 0,
    trustReviews: 0,
    productCount: Number(b.total_product) || 0,
    avgPrice: (Number(b.avg_product_price) || 0) / 100,
    numAdsIncreasePct: Number(b.percentage_num_ads_increase) || 0,
    pixels: [],
    apps: [],
    trafficSeries: sw ? swPair(sw) : indexPoints,
    liveAdsSeries: [],           // no per-day ad history in the index — see tracker_snapshots
    visitorCountries: [],
    targetedCountries: [],
    bestSellers: mapProducts(b),
    similarShopIds: [],
    description: String(b.store_description || ''),
    estimatedSalesCents: Number(b.estimated_sales) || 0,
    maxAds7d: b.max_ads_7d == null ? null : Number(b.max_ads_7d),
    cruxBucket: null,      // filled per visible page by listShops
    storeId: String(b.store_id || ''),
    trafficSource: sw ? 'similarweb' : monthly > 0 ? 'index' : null,
    similarweb: sw,
    similarwebDetail: null,   // only /top-brands/{id} carries the dossier
  } as Shop;
}

export interface ShopFilter {
  q?: string; category?: string; country?: string; platform?: string;
  /** Traffic ranges use exact-host SimilarWeb measurements. Missing
   *  measurements do not match; no traffic values are inferred. */
  productsMin?: number; productsMax?: number;
  avgPriceMin?: number; avgPriceMax?: number;
  trafficMin?: number; trafficMax?: number;
  growthMin?: number; growthMax?: number;
  visitorCountry?: string; createdAfter?: string;
  /** Workspace lists: drop these store_ids (hidden / not viewed) or keep only these (tracked / viewed). */
  excludeStoreIds?: string[]; storeIds?: string[];
  /** Detected storefront technology names (TechFacets): a shop matches a list
   *  when it carries ANY of its names; both lists must match when both are set. */
  pixels?: string[]; tech?: string[];
  /** StoreLeads storefront profile (Language/Currency/Theme/Socials/Apps chips): any value per key. */
  profile?: Partial<Record<ProfileKey, string[]>>;
  sortBy?: string; sortOrder?: 'asc' | 'desc';
  page?: number; limit?: number;
}

/**
 * Query parameters GET /top-brands actually reads. Verified against the live
 * API: the names matter, and a wrong one is silently ignored rather than
 * rejected, so `country=GB` returned the unfiltered 1,339,926-row baseline
 * while `selectedCountry=GB` correctly returned 114,128 GB stores.
 *
 * This endpoint supports NO numeric range filters — those live on the POST
 * /top-brands/filter endpoint (see rangeBody below).
 */
function toParams(f: ShopFilter): URLSearchParams {
  const p = new URLSearchParams();
  // limit=0 asks for the total alone (countShops): no sorted page is built.
  p.set('limit', String(Math.min(100, Math.max(0, f.limit ?? 25))));
  p.set('page', String(Math.max(1, f.page ?? 1)));
  // Default to Shopify: unfiltered, the API also returns `custom`-platform rows
  // (amazon.com, apple.com, walmart.com) that swamp every traffic-sorted view.
  // An explicit 'all' really does mean all, so the "All Platforms" pill is honest.
  if (f.platform !== 'all') p.set('platform', f.platform || 'shopify');
  if (f.country) p.set('selectedCountry', f.country);
  if (f.category) p.set('selectedStoreCategoryId', f.category);
  if (f.q) p.set('searchQuery', f.q);
  // sw_visits = SimilarWeb's measured visits for the exact host. The API sorts
  // stores the crawl has not reached last and keeps their monthly_traffic order
  // underneath, so a list stays full while coverage fills.
  p.set('sortBy', f.sortBy || 'sw_visits');
  p.set('sortOrder', f.sortOrder || 'desc');
  return p;
}

/** True when the caller asked for something only the POST endpoint can do. */
function needsRangeQuery(f: ShopFilter): boolean {
  return f.productsMin != null || f.productsMax != null
      || f.avgPriceMin != null || f.avgPriceMax != null
      || f.trafficMin != null || f.trafficMax != null
      || f.growthMin != null || f.growthMax != null
      || !!f.visitorCountry || !!f.createdAfter
      || !!f.excludeStoreIds?.length || !!f.storeIds?.length
      || !!f.pixels?.length || !!f.tech?.length
      || PROFILE_KEYS.some(k => !!f.profile?.[k]?.length);
}

/**
 * Body for POST /top-brands/filter. Range keys are fixed by the backend:
 * totalProducts → total_product, avgPrice → avg_product_price. Prices are held
 * in cents, so the UI's dollars are converted here.
 */
function rangeBody(f: ShopFilter): Record<string, unknown> {
  const body: Record<string, unknown> = {
    page: Math.max(1, f.page ?? 1),
    limit: Math.min(100, Math.max(0, f.limit ?? 25)),
    sort: { field: f.sortBy || 'sw_visits', order: f.sortOrder || 'desc' },
  };
  if (f.platform !== 'all') body.platforms = [f.platform || 'shopify'];
  if (f.country) body.selectedCountry = f.country;
  if (f.category) body.selectedStoreCategoryId = Number(f.category);
  if (f.q) body.query = f.q;
  if (f.visitorCountry) body.visitorCountry = f.visitorCountry;
  if (f.createdAfter) body.createdAfter = f.createdAfter;
  if (f.excludeStoreIds?.length) body.excludeStoreIds = f.excludeStoreIds;
  if (f.storeIds?.length) body.storeIds = f.storeIds;
  if (f.pixels?.length) body.pixels = f.pixels;
  if (f.tech?.length) body.tech = f.tech;
  for (const k of PROFILE_KEYS) if (f.profile?.[k]?.length) body[k] = f.profile[k];

  if (f.productsMin != null || f.productsMax != null) {
    body.totalProducts = {
      ...(f.productsMin != null ? { min: f.productsMin } : {}),
      ...(f.productsMax != null ? { max: f.productsMax } : {}),
    };
  }
  if (f.avgPriceMin != null || f.avgPriceMax != null) {
    body.avgPrice = {
      ...(f.avgPriceMin != null ? { min: Math.round(f.avgPriceMin * 100) } : {}),
      ...(f.avgPriceMax != null ? { max: Math.round(f.avgPriceMax * 100) } : {}),
    };
  }
  if (f.trafficMin != null || f.trafficMax != null) {
    body.similarwebVisits = {
      ...(f.trafficMin != null ? { min: f.trafficMin } : {}),
      ...(f.trafficMax != null ? { max: f.trafficMax } : {}),
    };
  }
  if (f.growthMin != null || f.growthMax != null) {
    body.similarwebGrowth = {
      ...(f.growthMin != null ? { min: f.growthMin } : {}),
      ...(f.growthMax != null ? { max: f.growthMax } : {}),
    };
  }
  return body;
}

export interface TechFacet { name: string; count: number }
/** The profile filters, by the backend's query/body key. */
export const PROFILE_KEYS = ['language', 'currency', 'theme', 'social', 'app'] as const;
export type ProfileKey = typeof PROFILE_KEYS[number];

export interface TechFacets {
  monthYear: string; pixels: TechFacet[]; technologies: TechFacet[];
  /** Options per profile filter; null until the profile enricher covers the month (same gate as technology). */
  profile: Record<ProfileKey, TechFacet[]> | null;
}

/**
 * Share of the served month's shops the technology enricher must have processed
 * before the chips are offered. Below it, counts and filter results are still
 * filling, and a filter that silently misses shops is worse than no filter.
 */
const TECH_MIN_COVERAGE = 0.95;

/**
 * Technologies detected on the served month's shops, split into the "Pixels"
 * and "Technology" chips, with shop counts — GET /top-brands/tech-facets.
 * null when the call fails or coverage is incomplete: the UI then renders no
 * technology chips rather than partial or invented options.
 */
export async function techFacets(): Promise<TechFacets | null> {
  try {
    const payload = await marketGet<{ data?: Record<string, unknown> }>('/top-brands/tech-facets', { auth: true, revalidate: 600 });
    const d = payload?.data;
    if (!d || Number(d.coverage) < TECH_MIN_COVERAGE) return null;
    const list = (v: unknown): TechFacet[] => (Array.isArray(v) ? v : [])
      .map(x => ({ name: String((x as TechFacet)?.name ?? ''), count: Number((x as TechFacet)?.count) || 0 }))
      .filter(x => x.name && x.count > 0);
    const total = Number(d.total) || 0;
    const raw = (d.profile ?? {}) as Record<string, unknown>;
    // Same honesty gate as the technology chips: offered once the enricher has covered the month.
    const profile = total > 0 && Number(d.profileSynced) / total >= TECH_MIN_COVERAGE
      ? Object.fromEntries(PROFILE_KEYS.map(k => [k, list(raw[k])])) as Record<ProfileKey, TechFacet[]>
      : null;
    return { monthYear: String(d.monthYear ?? ''), pixels: list(d.pixels), technologies: list(d.technologies), profile };
  } catch {
    return null;
  }
}

export interface ShopPage { items: Shop[]; total: number | null; page: number; limit: number }

/** `crux: false` skips the CRUX lookup so a caller can run it beside its own reads (see applyCrux). */
export async function listShops(f: ShopFilter = {}, { crux = true } = {}): Promise<ShopPage> {
  const cats = await categories();
  const payload = needsRangeQuery(f)
    // /top-brands/filter is JWT-gated (the plain list is public).
    ? await marketPost('/top-brands/filter', rangeBody(f), { auth: true, revalidate: 300 })
    : await marketGet(`/top-brands?${toParams(f)}`, { revalidate: 300 });

  const seen = new Set<string>();
  const items: Shop[] = [];
  for (const b of unwrapItems(payload)) {
    const d = cleanDomain(b.store_url);
    if (!d || !d.includes('.') || seen.has(d)) continue;
    seen.add(d);
    items.push(mapBrand(b, cats));
  }

  // Chrome UX Report popularity for the visible page. This is the reliable
  // signal: real Chrome telemetry, versus the index's own traffic figure which
  // disagrees with observed reality. One indexed lookup for the whole page.
  if (crux) await applyCrux(items);

  // Overlay licensed traffic where we have it. Without a provider key (the case
  // in production) this is a no-op. A store the platform's own SimilarWeb crawl
  // has already measured is left alone: it is the same measurement, and mixing
  // the two would leave `similarweb` describing a figure it did not produce.
  if (trafficConfigured() && items.length) {
    const pending = items.filter(s => !s.similarweb);
    const series = await monthlyTrafficMany(pending.map(s => s.domain));
    for (const s of pending) {
      const t = series.get(s.domain);
      if (!t) continue;
      s.monthlyVisits = t.latest;
      s.trafficSeries = t.points.map(p => ({ t: p.month, v: p.visits }));
      if (t.changePct != null) s.visitsGrowth = t.changePct;
      (s as Shop).trafficSource = t.source;
    }
  }

  return {
    items,
    total: unwrapTotal(payload),
    page: Math.max(1, f.page ?? 1),
    limit: Math.min(100, Math.max(1, f.limit ?? 25)),
  };
}

/** Sets cruxBucket on each shop CrUX ranks. */
export async function applyCrux(items: Shop[]): Promise<void> {
  if (!items.length) return;
  const ranks = await cruxRanks(items.map(s => s.domain));
  for (const s of items) {
    const r = ranks.get(s.domain);
    if (r) s.cruxBucket = r.bucket;
  }
}

/**
 * How many shops match a filter — the list endpoint's total with limit=0, so
 * the API runs a (cached) count and never sorts a page. A one-row page used to
 * make ES sort every matching store (0.5-1.7s across all platforms) for a row
 * nobody read. null = no total reported.
 */
export async function countShops(f: ShopFilter, revalidate = 3600): Promise<number | null> {
  const q: ShopFilter = { ...f, page: 1, limit: 0 };
  const payload = needsRangeQuery(q)
    ? await marketPost('/top-brands/filter', rangeBody(q), { auth: true, revalidate })
    : await marketGet(`/top-brands?${toParams(q)}`, { revalidate });
  return unwrapTotal(payload);
}

export async function getShop(id: string): Promise<Shop | null> {
  const cats = await categories();
  // The index keys brands by store_id; our ids are 'shp_<store_id>'.
  const storeId = id.startsWith('shp_') ? id.slice(4) : id;
  let brand: Record<string, unknown> | null = null;

  try {
    // The by-id detail route is JWT-gated too; without auth this 401s and we
    // silently fell through to the much slower list scan on every dossier load.
    const d = await marketGet(`/top-brands/${encodeURIComponent(storeId)}`, { auth: true, revalidate: 300 });
    const inner = (d as { data?: unknown })?.data ?? d;
    if (inner && typeof inner === 'object' && (inner as Record<string, unknown>).store_url) {
      brand = inner as Record<string, unknown>;
    }
  } catch { /* fall through to the search path */ }

  if (!brand) {
    // Fall back to a filtered list lookup so a shop opened by domain still resolves.
    const payload = await marketGet(`/top-brands?limit=100&sortBy=sw_visits&sortOrder=desc`, { revalidate: 300 });
    brand = unwrapItems(payload).find(b =>
      shopId(b) === id || cleanDomain(b.store_url) === cleanDomain(id)) ?? null;
  }
  if (!brand) return null;

  const shop = mapBrand(brand, cats);

  // The full SimilarWeb dossier, which only the by-id route carries. It is the
  // real measured history (up to 3 months), so it replaces the two-point pair a
  // list row carries — and, where the brand row's sw_* fields have not caught up
  // with the dossier table yet, it is also the measurement itself.
  const detail = mapDetail(brand.similarweb_detail, shop.domain);
  if (detail) {
    shop.similarwebDetail = detail;
    shop.similarweb = detail;
    shop.monthlyVisits = detail.visits;
    shop.visitsGrowth = detail.growthPct ?? 0;
    shop.trafficSource = 'similarweb';
    if (detail.globalRank != null) shop.similarWebRank = detail.globalRank;
    if (detail.history.length >= 2) shop.trafficSeries = detail.history;
    shop.visitorCountries = detail.geo;
  }

  const [products, traffic, crux] = await Promise.all([
    shop.bestSellers.length ? Promise.resolve(shop.bestSellers) : shopifyProducts(shop.domain),
    monthlyTraffic(shop.domain),
    cruxRank(shop.domain),
  ]);
  if (crux) shop.cruxBucket = crux.bucket;
  shop.bestSellers = products;
  if (traffic && !shop.similarweb) {     // see listShops: the crawl wins over the dormant provider
    shop.monthlyVisits = traffic.latest;
    shop.trafficSeries = traffic.points.map(p => ({ t: p.month, v: p.visits }));
    if (traffic.changePct != null) shop.visitsGrowth = traffic.changePct;
    shop.trafficSource = traffic.source;
  }
  return shop;
}

/** Resolve saved/list-card shops in one bounded market request. */
export async function getShops(ids: string[]): Promise<Shop[]> {
  const unique = [...new Set(ids.map(id => id.trim()).filter(Boolean))].slice(0, 100);
  if (!unique.length) return [];
  const [cats, payload] = await Promise.all([
    categories(),
    marketGet(`/top-brands/by-ids?ids=${encodeURIComponent(unique.join(','))}`, { auth: true, revalidate: 300 }),
  ]);
  const shops = unwrapItems(payload).map(row => mapBrand(row, cats));
  const match = (requested: string): Shop | undefined => {
    const raw = requested.startsWith('shp_') ? requested.slice(4) : requested;
    const domain = cleanDomain(raw);
    return shops.find(shop => shop.id === requested || shop.storeId === raw
      || (raw.length >= 16 && shop.storeId.startsWith(raw))
      || (domain.includes('.') && shop.domain === domain));
  };
  return unique.map(match).filter((shop): shop is Shop => !!shop);
}

/**
 * A store's own public product feed. Shopify serves /products.json publicly by
 * design; we request it politely and treat any failure as "no products".
 */
export async function shopifyProducts(domain: string, limit = 8): Promise<Product[]> {
  if (!domain) return [];
  try {
    // node:https, not fetch(): Shopify challenges fetch() from the production host (lib/safe-fetch.ts).
    const res = await safeGet(`https://${domain}/products.json?limit=${limit}`, {
      headers: { 'User-Agent': 'AdLibrarySpy/1.0 (+https://adlibraryspy.com/bot)', Accept: 'application/json' },
      timeoutMs: 6000,
    });
    if (res.status !== 200) return [];
    const data = JSON.parse(res.text) as { products?: Record<string, unknown>[] };
    const out: Product[] = [];
    for (const p of data.products ?? []) {
      const images = p.images as { src?: string }[] | undefined;
      const img = images?.[0]?.src;
      if (!img) continue;                          // no image → omit the row
      const variants = p.variants as { price?: string }[] | undefined;
      const price = Number(variants?.[0]?.price);
      out.push({
        rank: out.length + 1,
        title: String(p.title ?? '').slice(0, 120),
        price: Number.isFinite(price) ? price : 0,
        currency: 'USD',
        createdAt: String(p.created_at ?? '').slice(0, 10),
        image: img,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Similar shops: same category, nearest traffic.
 *
 * Ranked by rankSimilar (similar-rank.ts): category, then origin / main
 * visitor country, then closest measured traffic. Stores without their own
 * measured visits are left out, so no card prints an estimate.
 */
export async function similarShops(shop: Shop, limit = 6): Promise<Shop[]> {
  if (!shop.niches.length) return [];
  // A name maps to several ids ("Health" is both 2 and 4078); the picker's tree
  // keeps the populated one, and so must this, or the neighbour set is empty.
  const [cats, tree] = await Promise.all([categories(), categoryTree()]);
  const catId = tree.find(n => n.name === shop.niches[0])?.id
    ?? Object.entries(cats).find(([, name]) => name === shop.niches[0])?.[0];
  if (!catId) return [];
  // The pool must sit in the shop's own traffic band. It used to be the
  // category's 50 BIGGEST stores, so a 2K-visit shop got the smallest of those
  // (all ~3.7M) as its "closest" neighbours. Band = one decade either side.
  const band = measured(shop)
    ? { trafficMin: Math.floor(shop.monthlyVisits / 10), trafficMax: Math.ceil(shop.monthlyVisits * 10) }
    : {};
  const base: ShopFilter = { category: catId, platform: shop.platform || 'shopify', limit: 100, ...band };
  const home = [...new Set([shop.country, shop.visitorCountries?.[0]?.code].filter(Boolean) as string[])];
  const pages = await Promise.all([
    listShops(base, { crux: false }),
    ...home.map(country => listShops({ ...base, country }, { crux: false })),
  ].map(p => p.catch(() => null)));
  return rankSimilar(shop, pages.flatMap(p => p?.items ?? []), limit);
}
