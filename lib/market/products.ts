// Winning products: storefront products that Meta ads point at, ranked by the
// ads behind them. Served by the Go API (GET /market/winning-products), which
// groups every creative's landing URL (<host>/products/<handle>) in ClickHouse,
// joins the store from the Shops index and reads title, image and price from
// the storefront itself. A product the storefront never described is not in
// the list, so every row here has a real title.
import { MarketError, marketGet } from './client';

export interface WinningProductStore {
  /** top-brands store_id; '' = the store is not in the Shops index (no dossier link). */
  id: string;
  domain: string;
  title: string;
  logo: string;
  country: string;
  /** Monthly visits: SimilarWeb's measurement when present, else the index estimate. 0 = none. */
  visits: number;
  visitsGrowthPct: number | null;
  trafficSource: 'similarweb' | 'index' | null;
  categoryIds: number[];
}

export interface SampleAd { id: string; image: string; video: string }

export interface WinningProduct {
  key: string;
  url: string;
  title: string;
  image: string;
  vendor: string;
  productType: string;
  /** Major units in `currency`; null when the store did not state its currency. */
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  available: boolean;
  variants: number;
  publishedAt: string | null;
  ads: number;
  activeAds: number;
  newAds14d: number;
  /** Distinct advertiser pages running ads for it. */
  pages: number;
  firstAdAt: string | null;
  lastSeenAt: string | null;
  adCountries: string[];
  /** Up to six recent ads whose media we host (the only media that still loads). */
  sampleAds: SampleAd[];
  store: WinningProductStore;
}

export interface WinningProductsPage {
  items: WinningProduct[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** Currencies present across the whole list, most products first. */
  currencies: { code: string; count: number }[];
  updatedAt: string | null;
  /** True while the API is still gathering the list (503). */
  building?: boolean;
}

export interface WinningProductsQuery {
  q?: string;
  category?: string;
  country?: string;
  currency?: string;
  priceMin?: string;
  priceMax?: string;
  trafficMin?: string;
  launched?: string;
  store?: string;
  /** Store platform; undefined = every platform. */
  platform?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
}

export const PRODUCT_SORTS = ['ads', 'new_ads', 'pages', 'traffic', 'growth', 'first_ad', 'published', 'price'] as const;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function mapStore(s: Record<string, unknown> | undefined): WinningProductStore {
  const src = str(s?.traffic_source);
  return {
    id: str(s?.id),
    domain: str(s?.domain),
    title: str(s?.title),
    logo: str(s?.logo),
    country: str(s?.country),
    visits: num(s?.visits),
    visitsGrowthPct: numOrNull(s?.visits_growth_pct),
    trafficSource: src === 'similarweb' || src === 'index' ? src : null,
    categoryIds: Array.isArray(s?.category_ids) ? (s!.category_ids as unknown[]).map(Number).filter(Number.isFinite) : [],
  };
}

export function mapWinningProduct(r: Record<string, unknown>): WinningProduct {
  const samples = Array.isArray(r.sample_ads) ? (r.sample_ads as Record<string, unknown>[]) : [];
  return {
    key: str(r.key),
    url: str(r.url),
    title: str(r.title),
    image: str(r.image_url),
    vendor: str(r.vendor),
    productType: str(r.product_type),
    price: numOrNull(r.price),
    compareAtPrice: numOrNull(r.compare_at_price),
    currency: str(r.currency),
    available: r.available === true,
    variants: num(r.variants),
    publishedAt: str(r.published_at) || null,
    ads: num(r.ads),
    activeAds: num(r.active_ads),
    newAds14d: num(r.new_ads_14d),
    pages: num(r.pages),
    firstAdAt: str(r.first_ad_at) || null,
    lastSeenAt: str(r.last_seen_at) || null,
    adCountries: Array.isArray(r.ad_countries) ? (r.ad_countries as unknown[]).map(String).filter(Boolean) : [],
    sampleAds: samples
      .map(s => ({ id: str(s.id), image: str(s.image_url), video: str(s.video_url) }))
      .filter(s => s.id && s.image),
    store: mapStore(r.store as Record<string, unknown> | undefined),
  };
}

export async function listWinningProducts(q: WinningProductsQuery): Promise<WinningProductsPage> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  // The list is rebuilt in the background every 30 min; 60s keeps a page fresh
  // enough while repeated browsing is served from Next's data cache.
  let payload: { data?: Record<string, unknown> };
  try {
    // retries set = short retry budget: a 503 means "still gathering", not a restart to wait out.
    payload = await marketGet<{ data?: Record<string, unknown> }>(`/market/winning-products?${p}`, { auth: true, revalidate: 60, retries: 1 });
  } catch (err) {
    if (err instanceof MarketError && err.status === 503) {
      return { items: [], total: 0, page: 1, limit: q.limit ?? 0, hasMore: false, currencies: [], updatedAt: null, building: true };
    }
    throw err;
  }
  const d = payload?.data ?? {};
  const pg = (d.pagination ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : []).map(mapWinningProduct);
  return {
    items,
    total: num(pg.total),
    page: num(pg.page) || 1,
    limit: num(pg.limit) || items.length,
    hasMore: pg.hasNext === true,
    currencies: (Array.isArray(d.currencies) ? (d.currencies as Record<string, unknown>[]) : [])
      .map(c => ({ code: str(c.code), count: num(c.count) }))
      .filter(c => /^[A-Z]{3}$/.test(c.code)),
    updatedAt: str(d.updated_at) || null,
  };
}
