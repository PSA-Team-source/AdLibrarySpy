// Landing pages: the pages Meta ads send people to (advertorials, listicles,
// quizzes, collections, homepages), ranked by the ads behind them. Served by the
// Go API (GET /market/landing-pages). Store fields map exactly like Products.
import { marketGet, MarketError } from './client';
import { mapStore, type SampleAd, type WinningProductStore } from './products';

export const LANDING_PAGE_TYPES = ['advertorial', 'listicle', 'quiz', 'collection', 'homepage', 'other'] as const;
export type LandingPageType = (typeof LANDING_PAGE_TYPES)[number];

export interface LandingPage {
  key: string;
  url: string;
  title: string;
  type: LandingPageType;
  /** Our screenshot of the page; '' = none. */
  screenshot: string;
  /** The page's own share (og) image; '' = none. */
  image: string;
  ads: number;
  activeAds: number;
  newAds14d: number;
  /** Distinct advertiser pages running ads to it. */
  pages: number;
  firstAdAt: string | null;
  lastSeenAt: string | null;
  adCountries: string[];
  sampleAds: SampleAd[];
  store: WinningProductStore;
}

export interface LandingPagesPage {
  items: LandingPage[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  types: { type: LandingPageType; count: number }[];
  updatedAt: string | null;
  /** True while the API is still gathering the list (503). */
  building?: boolean;
}

export interface LandingPagesQuery {
  q?: string;
  category?: string;
  country?: string;
  type?: string;
  trafficMin?: string;
  launched?: string;
  store?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
}

export const LANDING_PAGE_SORTS = ['ads', 'new_ads', 'pages', 'traffic', 'growth', 'first_ad', 'last_seen'] as const;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const asType = (v: unknown): LandingPageType => (LANDING_PAGE_TYPES as readonly string[]).includes(str(v)) ? (v as LandingPageType) : 'other';

export function mapLandingPage(r: Record<string, unknown>): LandingPage {
  const samples = Array.isArray(r.sample_ads) ? (r.sample_ads as Record<string, unknown>[]) : [];
  return {
    key: str(r.key),
    url: str(r.url),
    title: str(r.title),
    type: asType(r.page_type),
    screenshot: str(r.screenshot_url),
    image: str(r.image_url),
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

export async function listLandingPages(q: LandingPagesQuery): Promise<LandingPagesPage> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && String(v) !== '') p.set(k, String(v));
  }
  let payload: { data?: Record<string, unknown> };
  try {
    // retries set = short retry budget: a 503 means "still gathering", not a restart to wait out.
    payload = await marketGet<{ data?: Record<string, unknown> }>(`/market/landing-pages?${p}`, { auth: true, revalidate: 60, retries: 1 });
  } catch (err) {
    if (err instanceof MarketError && err.status === 503) {
      return { items: [], total: 0, page: 1, limit: q.limit ?? 0, hasMore: false, types: [], updatedAt: null, building: true };
    }
    throw err;
  }
  const d = payload?.data ?? {};
  const pg = (d.pagination ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : []).map(mapLandingPage);
  return {
    items,
    total: num(pg.total),
    page: num(pg.page) || 1,
    limit: num(pg.limit) || items.length,
    hasMore: pg.hasNext === true,
    types: (Array.isArray(d.types) ? (d.types as Record<string, unknown>[]) : [])
      .filter(t => (LANDING_PAGE_TYPES as readonly string[]).includes(str(t.type)) && num(t.count) > 0)
      .map(t => ({ type: t.type as LandingPageType, count: num(t.count) })),
    updatedAt: str(d.updated_at) || null,
  };
}
