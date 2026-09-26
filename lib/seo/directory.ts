// The public store directory (/stores/*): which niche, technology and country
// pages exist, how many Shopify stores each one holds, and the ranked rows.
//
// One page per category, country and technology, each opening on a count
// sentence and a ranked table, cross-linked. Every row and every count is a
// live read of the market index through the same loaders the app uses.
//
// Counts are the SHOPIFY store count the list endpoint reports for that exact
// filter (the app's lists default to Shopify), never the taxonomy's all-platform
// brand_count, so the number in a page's intro is the number of rows behind it.
import { unstable_cache } from 'next/cache';
import type { Shop } from '@/lib/types';
import { queryShops, type SegmentKey } from '@/lib/data';
import { categoryTree, techFacets, cleanDomain } from '@/lib/market/shops';
import { marketGet, unwrapItems, unwrapTotal } from '@/lib/market/client';
import { publicDomain } from '@/lib/public/site';

/** Rows per directory page, and how deep a directory paginates (top 1,000). */
export const PAGE_SIZE = 50;
export const MAX_PAGES = 20;
/** A list with fewer Shopify stores than this is thin: not linked, not indexed. */
export const MIN_SHOPS = 10;
/** Growth lists only rank stores with at least this many measured visits;
 *  below it a jump from 20 to 2,000 visits reads as +9,900%. */
export const TRENDING_MIN_VISITS = 10_000;
const DAY = 86_400;

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Bounded-concurrency map: the index is shared with the app and the Go workers. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** Shopify stores matching one list filter, from the list endpoint's own total. null = the read failed. */
async function shopifyCount(params: Record<string, string>): Promise<number | null> {
  const p = new URLSearchParams({ limit: '1', page: '1', platform: 'shopify', sortBy: 'sw_visits', sortOrder: 'desc', ...params });
  try {
    return unwrapTotal(await marketGet(`/top-brands?${p}`, { revalidate: DAY, retries: 1 }));
  } catch {
    return null;
  }
}

// ---------- niches ----------

export interface NicheEntry {
  slug: string;
  id: string;
  name: string;
  /** Set on a subcategory. */
  parent: { slug: string; name: string } | null;
  /** Shopify stores filed under this category (the list total). */
  shops: number;
}

/** Top-level categories and their subcategories, slugged. A subcategory whose
 *  name collides with another page takes its parent's slug as a prefix. */
async function nicheSkeleton(): Promise<Omit<NicheEntry, 'shops'>[]> {
  const tree = await categoryTree();
  const out: Omit<NicheEntry, 'shops'>[] = [];
  const taken = new Set<string>();
  for (const t of tree) {
    const slug = slugify(t.name);
    if (!slug || taken.has(slug)) continue;
    taken.add(slug);
    out.push({ slug, id: t.id, name: t.name, parent: null });
  }
  for (const t of tree) {
    const parent = out.find(n => n.id === t.id);
    if (!parent) continue;
    for (const c of t.children) {
      let slug = slugify(c.name);
      if (!slug) continue;
      if (taken.has(slug)) slug = `${parent.slug}-${slug}`;
      if (taken.has(slug)) continue;
      taken.add(slug);
      out.push({ slug, id: c.id, name: c.name, parent: { slug: parent.slug, name: parent.name } });
    }
  }
  return out;
}

/** Every niche with at least MIN_SHOPS Shopify stores, largest first. Cached a day. */
export const nicheDirectory = unstable_cache(async (): Promise<NicheEntry[]> => {
  const skel = await nicheSkeleton();
  const counts = await mapLimit(skel, 6, n => shopifyCount({ selectedStoreCategoryId: n.id }));
  const out = skel
    .map((n, i) => ({ ...n, shops: counts[i] ?? 0 }))
    .filter(n => n.shops >= MIN_SHOPS)
    .sort((a, b) => b.shops - a.shops);
  // An empty directory is a failed read, never a fact: throw so the cache keeps the last good copy.
  if (!out.length) throw new Error('niche directory: no counts returned');
  return out;
}, ['seo:niches:v1'], { revalidate: DAY });

/** Niche id → its public directory path (/stores/niche/{slug}); links from /trending. */
export async function nichePathsById(): Promise<Map<string, string>> {
  return new Map((await nicheSkeleton()).map(n => [n.id, `/stores/niche/${n.slug}`]));
}

/** Resolve one niche slug without waiting on the counted directory. */
export async function findNiche(slug: string): Promise<Omit<NicheEntry, 'shops'> | null> {
  return (await nicheSkeleton()).find(n => n.slug === slug) ?? null;
}

// ---------- technologies ----------

export interface TechEntry {
  slug: string;
  name: string;
  /** Which filter the index applies: tracking pixels and other technologies are separate fields. */
  kind: 'pixel' | 'tech';
  shops: number;
}

/** How many of the most-detected technologies get a page. */
const TECH_LIMIT = 300;

async function techSkeleton(): Promise<Omit<TechEntry, 'shops'>[]> {
  const facets = await techFacets();
  if (!facets) return [];
  const all = [
    ...facets.pixels.map(f => ({ ...f, kind: 'pixel' as const })),
    ...facets.technologies.map(f => ({ ...f, kind: 'tech' as const })),
  ].sort((a, b) => b.count - a.count);
  const seen = new Set<string>();
  const out: Omit<TechEntry, 'shops'>[] = [];
  for (const f of all) {
    const slug = slugify(f.name);
    if (!slug || seen.has(slug)) continue;      // richest spelling wins a shared slug
    seen.add(slug);
    out.push({ slug, name: f.name, kind: f.kind });
    if (out.length >= TECH_LIMIT) break;
  }
  return out;
}

export const techDirectory = unstable_cache(async (): Promise<TechEntry[]> => {
  const skel = await techSkeleton();
  const counts = await mapLimit(skel, 6, t => shopifyCount({ [t.kind === 'pixel' ? 'pixels' : 'tech']: t.name }));
  const out = skel
    .map((t, i) => ({ ...t, shops: counts[i] ?? 0 }))
    .filter(t => t.shops >= MIN_SHOPS)
    .sort((a, b) => b.shops - a.shops);
  if (!out.length) throw new Error('tech directory: no counts returned');
  return out;
}, ['seo:tech:v1'], { revalidate: DAY });

export async function findTech(slug: string): Promise<Omit<TechEntry, 'shops'> | null> {
  return (await techSkeleton()).find(t => t.slug === slug) ?? null;
}

// ---------- countries ----------

const REGION = new Intl.DisplayNames(['en'], { type: 'region' });

/** English name of an ISO 3166-1 alpha-2 code, or '' when it is not a region. */
export function countryName(cc: string): string {
  const code = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    const name = REGION.of(code);
    return name && name !== code && !/unknown/i.test(name) ? name : '';
  } catch {
    return '';
  }
}

/** Country names that take "the" in running text: "stores in the United States". */
const WITH_ARTICLE = new Set(['US', 'GB', 'NL', 'AE', 'PH', 'CZ', 'DO', 'BS', 'GM', 'CD', 'CG', 'CF', 'MV', 'KY', 'VG', 'VI', 'SB', 'MH', 'FO', 'FK', 'VA']);
export function countryPhrase(cc: string): string {
  const name = countryName(cc);
  return name && WITH_ARTICLE.has(cc.toUpperCase()) ? `the ${name}` : name;
}

export interface CountryEntry { cc: string; name: string; shops: number }

/** Every alpha-2 code the runtime names — the full ISO list, no hand-kept copy. */
function allRegionCodes(): string[] {
  const out: string[] = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const cc = String.fromCharCode(a, b);
    // Exceptional reservations that are not countries of origin.
    if (['EU', 'EZ', 'UN', 'QO', 'XA', 'XB'].includes(cc)) continue;
    if (countryName(cc)) out.push(cc);
  }
  return out;
}

export const countryDirectory = unstable_cache(async (): Promise<CountryEntry[]> => {
  const codes = allRegionCodes();
  const counts = await mapLimit(codes, 6, cc => shopifyCount({ selectedCountry: cc }));
  const out = codes
    .map((cc, i) => ({ cc: cc.toLowerCase(), name: countryName(cc), shops: counts[i] ?? 0 }))
    .filter(c => c.shops >= MIN_SHOPS)
    .sort((a, b) => b.shops - a.shops);
  if (!out.length) throw new Error('country directory: no counts returned');
  return out;
}, ['seo:countries:v1'], { revalidate: DAY });

/** A directory read that fails renders as an absent section, never an error page. */
export async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try { return await p; } catch { return []; }
}

// ---------- ranked rows ----------

export interface DirectoryList { items: Shop[]; total: number; page: number; pages: number }

export type ListSpec =
  | { kind: 'niche'; id: string }
  | { kind: 'tech'; name: string; techKind: 'pixel' | 'tech' }
  | { kind: 'country'; cc: string }
  | { kind: 'trending'; view: Extract<SegmentKey, 'fastest-growing' | 'ad-peak'> }
  | { kind: 'all' };

/** One page of a directory, through the app's own queryShops (Shopify by default). */
export async function directoryList(spec: ListSpec, page: number): Promise<DirectoryList> {
  const base = { page, limit: PAGE_SIZE };
  const r = await queryShops(
    spec.kind === 'niche' ? { ...base, category: spec.id }
    : spec.kind === 'tech' ? { ...base, ...(spec.techKind === 'pixel' ? { pixels: [spec.name] } : { tech: [spec.name] }) }
    : spec.kind === 'country' ? { ...base, country: spec.cc.toUpperCase() }
    : spec.kind === 'trending'
      ? { ...base, view: spec.view, ...(spec.view === 'fastest-growing' ? { trafficMin: TRENDING_MIN_VISITS } : {}) }
    : base,
  );
  const total = r.total ?? r.items.length;
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  return { items: r.items, total, page, pages };
}

/** "2026-08" → "Aug 2026" — the month the visits column measures, read off the rows. */
export function measuredMonth(items: Shop[]): string {
  const p = items.find(s => s.similarweb?.period)?.similarweb?.period ?? '';
  if (!/^\d{4}-\d{2}$/.test(p)) return '';
  return new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "2" → 2; "" → 1; anything else (0, "01", "x", extra segments) → null = 404. */
export function parsePage(seg: string[] | undefined): number | null {
  if (!seg || !seg.length) return 1;
  if (seg.length !== 1 || !/^[1-9]\d*$/.test(seg[0])) return null;
  const n = Number(seg[0]);
  return n >= 2 && n <= MAX_PAGES ? n : null;   // page 1 lives at the bare URL only
}

// ---------- sitemap: top stores by measured traffic ----------

/** Store URLs per sitemap file (protocol cap is 50,000). */
export const STORES_PER_SITEMAP = 25_000;
export const STORE_SITEMAPS = 4;           // top 100,000 Shopify stores
const LIST_PAGE = 100;                     // the list endpoint's max page size

interface Chunk { domains: string[]; next: string | null }

/**
 * Domains ranked [chunk*25k, (chunk+1)*25k) by SimilarWeb visits.
 *
 * Walked with the list's search_after cursor, NOT ?page=: past offset 10,000
 * (Elasticsearch's result window) every ?page= answers with page 100 again —
 * a page walk to 25,000 returned 10,000 unique domains. A chunk starts at the
 * cursor the previous chunk ended on, so chunk 3 costs chunks 0-2 once, from
 * cache after that. One request in flight (~0.5s each in production).
 *
 * `no-store` keeps ~250 × 180KB list payloads out of Next's data cache; only the
 * resulting domain list is cached, for a day.
 */
const cachedChunk = unstable_cache(async (chunk: number): Promise<Chunk> => {
  const start = chunk === 0 ? null : (await sitemapChunk(chunk - 1)).next;
  if (chunk > 0 && !start) return { domains: [], next: null };      // the index ended earlier
  const base = process.env.MARKET_API_BASE || 'https://api.platformdtc.com/api/v1';
  const seen = new Set<string>();
  let cursor = start;
  for (let i = 0; i < STORES_PER_SITEMAP / LIST_PAGE; i++) {
    const p = new URLSearchParams({ limit: String(LIST_PAGE), platform: 'shopify', sortBy: 'sw_visits', sortOrder: 'desc' });
    if (cursor) p.set('cursor', cursor); else p.set('page', '1');
    let payload: unknown = null;
    for (let attempt = 0; attempt < 3 && payload == null; attempt++) {
      try {
        const res = await fetch(`${base}/top-brands?${p}`, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        if (res.ok) payload = await res.json();
      } catch { /* retry */ }
      if (payload == null) await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    }
    // A broken walk is a bad read: throw so the cache keeps yesterday's copy.
    if (payload == null) throw new Error(`sitemap chunk ${chunk}: list read failed at step ${i}`);
    const items = unwrapItems(payload);
    for (const b of items) {
      const d = publicDomain(cleanDomain(b.store_url));
      if (d) seen.add(d);
    }
    const pag = ((payload as { data?: { pagination?: { nextCursor?: unknown } } }).data?.pagination) ?? {};
    cursor = typeof pag.nextCursor === 'string' && pag.nextCursor ? pag.nextCursor : null;
    if (!cursor || items.length < LIST_PAGE) { cursor = null; break; }
  }
  return { domains: [...seen], next: cursor };
}, ['seo:sitemap-chunk:v2'], { revalidate: DAY });

/** One fill per chunk per process: concurrent cold requests share the walk instead of repeating it. */
const inflight = new Map<number, Promise<Chunk>>();
function sitemapChunk(chunk: number): Promise<Chunk> {
  let p = inflight.get(chunk);
  if (!p) {
    p = cachedChunk(chunk).finally(() => inflight.delete(chunk));
    inflight.set(chunk, p);
  }
  return p;
}

export async function sitemapDomains(chunk: number): Promise<string[]> {
  return (await sitemapChunk(chunk)).domains;
}
