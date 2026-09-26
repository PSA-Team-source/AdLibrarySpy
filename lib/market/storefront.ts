// Facts a Shopify store publishes about itself, read from its own public
// storefront: /meta.json (myshopify domain, currency, published product count),
// the homepage's Shopify.theme / Shopify.locale globals, and the storefront's
// own collection sort (best-selling, newest). Nothing here is inferred: a value
// the store does not publish comes back empty and the dossier omits it.
//
// Also: the store's daily live-ads history from the market index
// (GET /daily-summary/stores/{store_id}).
import type { Point, Product } from '@/lib/types';
import { marketGet, unwrapItems } from './client';
import { parseHandles, parseLocale, parseTheme } from './storefront-parse';
import { safeFetch } from '@/lib/safe-fetch';

const UA = 'AdLibrarySpy/1.0 (+https://adlibraryspy.com/bot)';
const TIMEOUT_MS = 6000;
const REVALIDATE = 3600;
const GRID = 12;

export interface StorefrontFacts {
  myshopifyDomain: string;
  currency: string;
  /** BCP-47 locale the storefront renders in, e.g. "en". */
  locale: string;
  /** The theme's schema name ("Impulse", "Dawn"); '' when the store does not expose it. */
  theme: string;
  /** Published products per /meta.json; null = not published. */
  productCount: number | null;
  /** Storefront order for sort_by=best-selling. Empty = the storefront did not render one. */
  bestSelling: Product[];
  /** Storefront order for sort_by=created-descending. */
  latest: Product[];
}

const EMPTY: StorefrontFacts = {
  myshopifyDomain: '', currency: '', locale: '', theme: '', productCount: null, bestSelling: [], latest: [],
};

async function get(url: string, as: 'json' | 'text'): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await safeFetch(url, {
      headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : 'text/html' },
      signal: ac.signal,
      next: { revalidate: REVALIDATE },
    } as RequestInit);
    if (!res.ok) return null;
    return as === 'json' ? await res.json() : await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const img = (src: unknown): string => {
  const s = str(src);
  if (!s) return '';
  return s.startsWith('//') ? `https:${s}` : s;
};

/** /products.json row (price is a decimal string). */
function fromJson(p: Record<string, unknown>, currency: string): Product | null {
  const image = img((p.images as { src?: string }[] | undefined)?.[0]?.src);
  if (!image) return null;
  const price = Number((p.variants as { price?: string }[] | undefined)?.[0]?.price);
  return {
    rank: 0, title: str(p.title).slice(0, 120), price: Number.isFinite(price) ? price : 0,
    currency, createdAt: str(p.created_at).slice(0, 10), image,
  };
}

/** /products/{handle}.js row (price is in cents). */
function fromJs(p: Record<string, unknown>, currency: string): Product | null {
  const image = img(p.featured_image);
  if (!image) return null;
  const cents = Number(p.price);
  return {
    rank: 0, title: str(p.title).slice(0, 120), price: Number.isFinite(cents) ? cents / 100 : 0,
    currency, createdAt: str(p.created_at).slice(0, 10), image,
  };
}

function ccyParam(meta: unknown): string {
  const c = str((meta as Record<string, unknown> | null)?.currency);
  return /^[A-Z]{3}$/.test(c) ? `&currency=${c}` : '';
}

export async function storefrontFacts(domain: string): Promise<StorefrontFacts> {
  if (!domain) return EMPTY;
  const base = `https://${domain}`;
  // Shopify Markets prices the catalogue in the VISITOR's currency by IP, so
  // product prices are requested in the store's own currency (meta.json) —
  // otherwise a server abroad reads VND 1,055,000 and labels it USD.
  const metaP = get(`${base}/meta.json`, 'json');
  const [meta, home, best, latest, catalog] = await Promise.all([
    metaP,
    get(`${base}/`, 'text'),
    get(`${base}/collections/all?sort_by=best-selling`, 'text'),
    get(`${base}/collections/all?sort_by=created-descending`, 'text'),
    metaP.then(m => get(`${base}/products.json?limit=250${ccyParam(m)}`, 'json')),
  ]);
  const m = (meta && typeof meta === 'object' ? meta : {}) as Record<string, unknown>;
  const html = typeof home === 'string' ? home : '';
  const currency = str(m.currency);
  const count = Number(m.published_products_count);

  const byHandle = new Map<string, Record<string, unknown>>();
  for (const p of ((catalog as { products?: Record<string, unknown>[] } | null)?.products ?? [])) {
    if (p?.handle) byHandle.set(String(p.handle).toLowerCase(), p);
  }
  const bestHandles = typeof best === 'string' ? parseHandles(best) : [];
  const latestHandles = typeof latest === 'string' ? parseHandles(latest) : [];

  // Handles beyond the first 250 catalogue rows: one bounded .js lookup each.
  const missing = [...new Set([...bestHandles, ...latestHandles])].filter(h => !byHandle.has(h)).slice(0, GRID);
  const extra = new Map<string, Product>();
  await Promise.all(missing.map(async h => {
    const p = await get(`${base}/products/${encodeURIComponent(h)}.js?${ccyParam(meta).slice(1)}`, 'json');
    const row = p && typeof p === 'object' ? fromJs(p as Record<string, unknown>, currency || 'USD') : null;
    if (row) extra.set(h, row);
  }));

  const resolve = (handles: string[]): Product[] => {
    const out: Product[] = [];
    for (const h of handles) {
      const raw = byHandle.get(h);
      const row = raw ? fromJson(raw, currency || 'USD') : extra.get(h) ?? null;
      if (row) out.push({ ...row, rank: out.length + 1 });
    }
    return out;
  };

  return {
    myshopifyDomain: str(m.myshopify_domain),
    currency,
    locale: parseLocale(html),
    theme: parseTheme(html),
    productCount: Number.isFinite(count) && count > 0 ? count : null,
    bestSelling: resolve(bestHandles),
    latest: resolve(latestHandles),
  };
}

/**
 * Daily live-ad counts for a store, oldest first. A day recorded as 0 right
 * beside days of thousands is a crawl that did not reach the page, not a store
 * that switched every ad off overnight, so zero days are dropped rather than
 * drawn as a collapse.
 */
export async function storeAdHistory(storeId: string): Promise<Point[]> {
  if (!storeId) return [];
  try {
    const d = await marketGet<{ data?: Record<string, unknown>[] }>(
      `/daily-summary/stores/${encodeURIComponent(storeId)}?days=365`, { revalidate: 900 });
    const byDay = new Map<string, number>();
    for (const r of d?.data ?? []) {
      const day = str(r.summary_date).slice(0, 10);
      const v = Number(r.total_num_ads_running);
      if (day && Number.isFinite(v) && v > 0) byDay.set(day, v);
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, v]) => ({ t, v }));
  } catch {
    return [];
  }
}

export interface StoreProfile {
  /** Category names broadest first ("Health › Nutrition › Vitamins & Supplements"). */
  categoryPath: string[];
  /** Detected storefront technologies, split for the Pixels | Apps panel. */
  pixels: string[];
  apps: string[];
}

/**
 * Tracking and ad-platform tags. Everything else the crawler detected (reviews,
 * email, payments, CDN...) is an app or integration.
 */
const PIXEL = /pixel|analytics|tag manager|insight tag|bing ads|microsoft (ads|advertising)|clarity|hotjar|adsense|triple whale|elevar|northbeam|wetracked|blotout|segment|mixpanel|amplitude|heap|fullstory|taboola|outbrain|criteo|trade desk|axon/i;

/**
 * The crawler's store record, attached by the Go detail route as
 * `store_profile` (market.stores: category assignment + detected tech). Same
 * request and cache entry as getShop's, so this costs no extra round trip.
 */
export async function storeProfile(storeId: string): Promise<StoreProfile | null> {
  if (!storeId) return null;
  try {
    const [d, cats] = await Promise.all([
      marketGet(`/top-brands/${encodeURIComponent(storeId)}`, { auth: true, revalidate: 300 }),
      marketGet('/market/store-categories?all=true', { revalidate: 3600 }),
    ]);
    const brand = ((d as { data?: unknown })?.data ?? d) as Record<string, unknown>;
    const p = brand?.store_profile as Record<string, unknown> | undefined;
    if (!p) return null;
    const rows = new Map<number, { name: string; level: number }>();
    for (const c of unwrapItems(cats)) {
      if (c?.id != null && c?.name) rows.set(Number(c.id), { name: String(c.name).trim(), level: Number(c.level ?? 0) });
    }
    const categoryPath = (Array.isArray(p.categories) ? p.categories : [])
      .map(id => rows.get(Number(id)))
      .filter((c): c is { name: string; level: number } => !!c)
      .sort((a, b) => a.level - b.level)
      .map(c => c.name)
      .filter((n, i, all) => all.indexOf(n) === i);
    const tech = (Array.isArray(p.tech_platforms) ? p.tech_platforms : []).map(String).filter(Boolean);
    return {
      categoryPath,
      pixels: tech.filter(t => PIXEL.test(t)),
      apps: tech.filter(t => !PIXEL.test(t)),
    };
  } catch {
    return null;
  }
}
