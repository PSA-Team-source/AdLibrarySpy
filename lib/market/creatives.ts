// Ad creatives, mapped from the market index (Elastic-backed creatives store).
// Requires the service token (see lib/market/token.ts).
import type { Ad, CountryShare } from '@/lib/types';
import { marketGet, unwrapItems, unwrapTotal } from './client';
import { cleanDomain, displayBrand } from './shops';
import { EU_UK_COUNTRIES, AD_SORTS, type AdSort } from './ad-options';
import { mapAiLabels, mapLabelFacets, setLabelParams, type LabelFilter, type LabelFacets } from './labels';

const EU_UK = new Set<string>(EU_UK_COUNTRIES);

/**
 * Media host allowlist. The index stores both our cached copy and the original
 * Facebook CDN URL. Measured against live rows: fbcdn images return 403 and
 * fbcdn videos fail outright on hotlink, so only the cached copy is usable.
 * Anything else is treated as "no media" rather than rendered as a broken box.
 */
const MEDIA_HOST = 'cdn.shopquantum.ai';

function playableUrl(raw: unknown): string {
  const url = String(raw ?? '');
  if (!url) return '';
  try {
    return new URL(url).host === MEDIA_HOST ? url : '';
  } catch {
    return '';
  }
}

/** Decode utm_* pairs from the ad's destination. */
function utmOf(linkUrl: string): Record<string, string> {
  if (!linkUrl) return {};
  try {
    const out: Record<string, string> = {};
    for (const [k, v] of new URL(linkUrl).searchParams) {
      if (k.toLowerCase().startsWith('utm_') && v) out[k.toLowerCase()] = v.slice(0, 200);
    }
    return out;
  } catch {
    return {};
  }
}

export type CreativeMode = 'all' | 'popular' | 'trending';

function mapCreative(c: Record<string, unknown>): Ad {
  const domain = cleanDomain(c.store_url ?? c.domain);
  const start = Number(c.start_at) || 0;
  const end = Number(c.end_at) || 0;
  const country = String(c.country ?? '').toUpperCase();
  const description = String(c.description ?? '').trim();
  const title = String(c.title ?? '').trim();
  // Some rows carry an unrendered Liquid/handlebars template as their
  // description ("{{product.brand}}"). That is not ad copy, so it is dropped.
  const copy = /^\s*(\{\{|\{%)/.test(description) ? '' : description;

  const linkUrl = String(c.link_url ?? '');
  const video = playableUrl(c.video_url);
  const image = playableUrl(c.image_url);

  const related = (Array.isArray(c.related_creatives) ? c.related_creatives : [])
    .map(r => {
      const o = (r ?? {}) as Record<string, unknown>;
      return { id: String(o.id ?? ''), image: playableUrl(o.image_url), isVideo: !!o.video_url };
    })
    .filter(r => r.id && r.image)
    .slice(0, 6);

  const lastSeen = Number(c.last_seen_at) || 0;
  const createdMs = Number(c.created_at) || 0;
  const storeCreatedMs = Number(c.store_created_at) || 0;
  const storeCategoryIds = (Array.isArray(c.store_categories) ? c.store_categories : [c.store_category_id])
    .map(v => String(v ?? '')).filter(v => v && v !== '0');

  return {
    id: String(c.id ?? ''),
    network: c.platform === 'tiktok' ? 'tiktok' : c.platform === 'google' ? 'google' : 'meta',
    advertiser: displayBrand(c.store_title, domain),
    shopId: c.store_id ? `shp_${String(c.store_id).replace(/[^a-z0-9]/gi, '')}` : '',
    domain,
    adCopy: copy,
    headline: title.slice(0, 200),
    cta: '',                       // the index stores no CTA label
    mediaType: video ? 'video' : 'image',
    image,
    reach: 0,                      // view_num is 0 across the whole index
    spendTotal: 0,                 // not licensed
    spendPerDay: 0,
    // The observed window (start → last sighting) is the evidence; run_duration
    // is frequently shorter than that window, so it is only the fallback.
    daysRunning: end && start ? Math.max(0, Math.round((end - start) / 86400)) : Number(c.run_duration) || 0,
    startDate: start ? new Date(start * 1000).toISOString().slice(0, 10) : '',
    variations: Number(c.store_creative_count) || 0,
    targeting: country,
    isEuUk: EU_UK.has(country),
    niche: '',
    growthPct: 0,                  // sales_score_growth is 0 across the index
    country,
    storeId: String(c.store_id ?? ''),

    videoUrl: video,
    linkUrl,
    utm: utmOf(linkUrl),
    placements: (Array.isArray(c.publisher_platform) ? c.publisher_platform : []).map(String).filter(Boolean),
    format: String(c.display_format ?? '').toLowerCase(),
    isActive: c.is_active !== false,
    lastSeenAt: lastSeen ? new Date(lastSeen * 1000).toISOString() : '',
    adsRunning: Number(c.ads_running_num) || 0,
    maxAds7d: Number(c.max_ads_7d) || 0,
    storeLogo: String(c.store_logo ?? ''),
    pageId: String(c.page_id ?? ''),
    postId: String(c.post_id ?? ''),
    related,
    labels: mapAiLabels(c.ai_labels),
    firstSeenAt: createdMs ? new Date(createdMs).toISOString() : '',
    storeDescription: String(c.store_description ?? '').trim().slice(0, 600),
    storeCreatedAt: storeCreatedMs ? new Date(storeCreatedMs).toISOString() : '',
    storeCategoryIds,
  };
}

export interface AdFilter extends LabelFilter {
  mode?: CreativeMode;
  q?: string;
  network?: string;
  media?: 'image' | 'video';
  format?: string;
  placement?: string;
  country?: string;
  euUk?: boolean;
  /** Ad creation date window, YYYY-MM-DD, inclusive; either end may be open. */
  from?: string;
  to?: string;
  /** Niche = the store's top-level category id (store_category_id). */
  category?: string;
  sort?: AdSort;
  /**
   * Restrict to one store: sent as `storeDomain`, an exact match on the
   * index's store_url. (The endpoint never read `storeIds`, and passing one
   * returned the whole index; free-text `search` matched fuzzily across ad
   * copy, so a brand's panel could show other brands' ads.)
   */
  storeDomain?: string;
  page?: number;
  limit?: number;
}

export interface AdPage { items: Ad[]; total: number | null; page: number; limit: number; hasMore: boolean }

/**
 * The index stores both a cached copy of each creative and the original Facebook
 * CDN URL, and only the cached copy is servable -- the fbcdn URLs are expired
 * signed links that return 403.
 *
 * Cache coverage is both low and very unevenly distributed for the ranked
 * modes. Measured, renderable rows per API page of 96:
 *
 *   all       ~84% on every page
 *   popular   p1:0  p2:1  p3:0  p4:4  p5:41 p6:33 p7:23 p8:55
 *   trending  p1:0  p2:1  p3:0  p4:19 p5:27 p6:34 p7:20 p8:71
 *
 * So a 1:1 logical-page-to-API-page mapping renders an empty first page for
 * popular and trending. Instead we walk API pages until enough renderable rows
 * are collected, then slice the requested window out of that. Next caches each
 * underlying request, so paging within a mode reuses the earlier fetches.
 */
// hasMedia=true makes the API return only renderable creatives, so one API page
// normally fills a grid page. The walk below remains for the filters applied
// here (format, placement) and for an API that predates hasMedia.
const API_PAGE_SIZE = 48;
const MAX_API_PAGES = 12;

async function fetchCreativePage(
  mode: CreativeMode,
  base: URLSearchParams,
  apiPage: number,
): Promise<{ items: Ad[]; total: number | null; raw: number }> {
  const p = new URLSearchParams(base);
  p.set('limit', String(API_PAGE_SIZE));
  p.set('page', String(apiPage));
  const payload = await marketGet(`/adlibs/findproduct/creatives-es/${mode}?${p}`, {
    auth: true,
    revalidate: 300,
  });
  const raw = unwrapItems(payload);
  return {
    items: raw.map(mapCreative).filter(a => a.id && a.image),
    total: unwrapTotal(payload),
    raw: raw.length,
  };
}

export async function listAds(f: AdFilter = {}): Promise<AdPage> {
  const limit = Math.min(60, Math.max(1, f.limit ?? 24));
  const page = Math.max(1, f.page ?? 1);

  const base = new URLSearchParams({ hasMedia: 'true' });
  // Verified against the live API: `search` and `selectedCountry` filter;
  // `country` is silently ignored and returns the whole index. A store is
  // scoped by `storeDomain`, an exact match on store_url -- `search` is fuzzy
  // across copy and domains and let other brands' ads into a brand's list.
  if (f.storeDomain) base.set('storeDomain', f.storeDomain);
  if (f.q) base.set('search', f.q);
  // EU/UK is a server-side country list; a single EU country narrows it.
  const country = f.country?.toUpperCase();
  if (f.euUk) base.set('selectedCountry', country && EU_UK.has(country) ? country : EU_UK_COUNTRIES.join(','));
  else if (country) base.set('selectedCountry', country);
  if (f.media) base.set('adType', f.media);
  // The API applies a start_at window only when both ends are given.
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  if (day(f.from) || day(f.to)) {
    base.set('startDate', day(f.from) || '2000-01-01');
    base.set('endDate', day(f.to) || new Date().toISOString().slice(0, 10));
  }
  if (f.category && /^\d+$/.test(f.category)) base.set('categories', f.category);
  const sort = AD_SORTS[f.sort ?? 'relevance'] as { sortBy?: string; sortOrder?: string };
  if (sort.sortBy && sort.sortOrder) {
    base.set('sortBy', sort.sortBy);
    base.set('sortOrder', sort.sortOrder);
  } else if (f.q) {
    base.set('sortBy', 'relevance');
  }
  // AI label filters are applied by the index, so paging stays exact.
  setLabelParams(base, f);

  const mode = (f.mode ?? 'all') as CreativeMode;

  // Filters the index does not accept as query params are applied here, so they
  // have to be applied before we decide we have collected enough.
  const localOnly = !!(f.format || f.placement);
  const localFilters = (items: Ad[]): Ad[] => {
    let out = items;
    if (f.media) out = out.filter(a => a.mediaType === f.media);
    if (f.format) out = out.filter(a => a.format === f.format);
    if (f.placement) out = out.filter(a => a.placements.includes(f.placement!));
    if (f.euUk) out = out.filter(a => a.isEuUk);
    return out;
  };

  const need = page * limit;
  const collected: Ad[] = [];
  let total: number | null = null;
  let exhausted = false;

  for (let apiPage = 1; apiPage <= MAX_API_PAGES && collected.length < need + 1; apiPage++) {
    const res = await fetchCreativePage(mode, base, apiPage);
    if (total === null) total = res.total;
    if (res.raw === 0) { exhausted = true; break; }
    collected.push(...localFilters(res.items));
    if (res.raw < API_PAGE_SIZE) { exhausted = true; break; }
  }

  const skip = (page - 1) * limit;
  const items = collected.slice(skip, skip + limit);
  // More pages exist if we collected past this window, or if we stopped on the
  // scan budget rather than on an empty response.
  const hasMore = collected.length > skip + limit || (!exhausted && items.length === limit);

  // A filter applied here makes the API's total count rows we then drop, so no
  // number is shown rather than one the grid cannot match.
  return { items, total: localOnly ? null : total, page, limit, hasMore };
}

export async function getAd(id: string): Promise<Ad | null> {
  try {
    const d = await marketGet(`/adlibs/findproduct/creatives-es/${encodeURIComponent(id)}`, {
      auth: true, revalidate: 300,
    });
    const c = ((d as { data?: unknown })?.data ?? d) as Record<string, unknown>;
    if (!c?.id) return null;
    const ad = mapCreative(c);
    return ad.image || ad.videoUrl ? ad : null;
  } catch {
    return null;
  }
}

/** Resolve saved/list-card creatives in one bounded market request. */
export async function getAds(ids: string[]): Promise<Ad[]> {
  const unique = [...new Set(ids.map(id => id.trim()).filter(Boolean))].slice(0, 100);
  if (!unique.length) return [];
  try {
    const payload = await marketGet(`/adlibs/findproduct/creatives-es/by-ids?ids=${encodeURIComponent(unique.join(','))}`, {
      auth: true, revalidate: 300,
    });
    const rows = unwrapItems(payload).map(mapCreative).filter(ad => ad.id && (ad.image || ad.videoUrl));
    const byID = new Map(rows.map(ad => [ad.id, ad]));
    return unique.map(id => byID.get(id)).filter((ad): ad is Ad => !!ad);
  } catch {
    return [];
  }
}

export interface FacetFilter extends LabelFilter {
  q?: string;
  /** Exact brand scope (store_url), as in listAds. */
  storeDomain?: string;
  country?: string;
  /** Only creatives that started within the last N days. */
  days?: number;
}

/**
 * Counts of each AI label over the creatives matching a filter, plus how many
 * of them carry any confident label at all. null on failure or a malformed
 * payload -- the caller renders no label UI rather than invented counts.
 */
export async function labelFacets(f: FacetFilter = {}): Promise<LabelFacets | null> {
  const p = new URLSearchParams();
  if (f.storeDomain) p.set('storeDomain', f.storeDomain);
  if (f.q) p.set('search', f.q);
  if (f.country) p.set('selectedCountry', f.country);
  if (f.days && Number.isInteger(f.days) && f.days > 0) p.set('dateRange', String(f.days));
  setLabelParams(p, f);
  try {
    const payload = await marketGet(`/adlibs/findproduct/creatives-es/label-facets?${p}`, {
      auth: true,
      revalidate: 300,
    });
    return mapLabelFacets(payload);
  } catch {
    return null;
  }
}

function countryShares(items: Ad[]): CountryShare[] {
  const counts = new Map<string, number>();
  for (const ad of items) if (ad.country) counts.set(ad.country, (counts.get(ad.country) ?? 0) + 1);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (!total) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, count]) => ({ code, pct: Math.round((count * 100) / total) }));
}

/**
 * Creatives for one store. `search` is free text, so results are re-checked
 * against the domain — a loose match must never present another brand's ad as
 * this brand's.
 */
async function storeAdsRaw(domain: string, limit: number): Promise<{ items: Ad[] }> {
  const { items } = await listAds({ storeDomain: domain, limit });
  return { items: items.filter(a => a.domain === domain) };
}

export async function storeAds(domain: string, limit = 24): Promise<Ad[]> {
  if (!domain) return [];
  try {
    return (await storeAdsRaw(domain, limit)).items;
  } catch {
    return [];
  }
}

/**
 * Everything the shop dossier needs from the creative index, fetched once.
 * Country distribution intentionally uses the same 60-row sample as the old
 * storeAdCountries implementation while the visible gallery remains capped.
 */
export async function storeAdBundle(
  domain: string,
  adLimit = 12,
): Promise<{ ads: Ad[]; countries: CountryShare[] }> {
  if (!domain) return { ads: [], countries: [] };
  try {
    const { items } = await storeAdsRaw(domain, 60);
    return { ads: items.slice(0, Math.max(0, adLimit)), countries: countryShares(items) };
  } catch {
    return { ads: [], countries: [] };
  }
}

/** Real country distribution of a store's creatives. Empty when it has none. */
export async function storeAdCountries(domain: string): Promise<CountryShare[]> {
  return (await storeAdBundle(domain, 0)).countries;
}

/**
 * Renderable previews for a whole shops page in one request. The API filters
 * to media cached on our CDN before returning rows, so this never downloads
 * 96-row pages repeatedly just to find three usable thumbnails per shop.
 */
export async function storeAdPreviews(domains: string[], limit = 3): Promise<Map<string, Ad[]>> {
  const unique = [...new Set(domains.map(cleanDomain).filter(Boolean))].slice(0, 50);
  const out = new Map<string, Ad[]>(unique.map(d => [d, []]));
  if (!unique.length) return out;
  try {
    const p = new URLSearchParams({ domains: unique.join(','), limit: String(Math.min(6, Math.max(1, limit))) });
    const payload = await marketGet(`/adlibs/findproduct/creatives-es/previews?${p}`, {
      auth: true,
      revalidate: 300,
    });
    const data = ((payload as { data?: unknown })?.data ?? {}) as Record<string, unknown>;
    for (const domain of unique) {
      const rows = Array.isArray(data[domain]) ? data[domain] as Record<string, unknown>[] : [];
      out.set(domain, rows.map(mapCreative).filter(a => a.id && a.image).slice(0, limit));
    }
  } catch {
    // Preview media is optional; the shop rows still render without it.
  }
  return out;
}

/** Meta Ad Library permalink for a creative, so a claim can be checked at source. */
export function metaAdLibraryUrl(ad: Ad): string {
  if (ad.pageId) return `https://www.facebook.com/ads/library/?view_all_page_id=${encodeURIComponent(ad.pageId)}&active_status=all&ad_type=all`;
  return `https://www.facebook.com/ads/library/?q=${encodeURIComponent(ad.domain)}&active_status=all&ad_type=all`;
}

/**
 * How many creatives the library actually holds for a domain.
 *
 * The top-brands index carries `db_num_ads` / `max_ads_7d`, but those
 * contradict the creative library in both directions — measured live,
 * veinci.com claims 9,276 ads with 0 creatives indexed, while cheezit.com
 * claims 0 with 2,984. This asks the library itself, so the number on the row
 * is the number you get when you click through.
 *
 * Returns null on failure so the caller can render "not measured" rather than
 * a zero it cannot stand behind.
 */
export async function creativeCountFor(domain: string): Promise<number | null> {
  if (!domain) return null;
  try {
    const payload = await marketGet(
      `/adlibs/findproduct/creatives-es/all?limit=1&storeDomain=${encodeURIComponent(domain)}`,
      { auth: true, revalidate: 900 },
    );
    return unwrapTotal(payload);
  } catch {
    return null;
  }
}

/** Bounded-concurrency batch for a page of rows. Never throws. */
export async function creativeCounts(domains: string[], concurrency = 8): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const queue = [...new Set(domains.filter(Boolean))];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const d = queue.shift();
      if (!d) return;
      const n = await creativeCountFor(d);
      if (n != null) out.set(d, n);
    }
  });
  await Promise.all(workers);
  return out;
}
