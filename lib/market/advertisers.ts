// Advertisers = Meta Pages. The Go endpoint aggregates the creatives index by
// page_id, so every number here is a count over creatives we actually hold.
import { marketGet } from './client';
import type { CountryShare, Point } from '../types';

export const EU_UK = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB',
]);

export interface AdvertiserAd { id: string; image: string; video: string; title: string }

export interface MetaPage {
  pageId: string;
  name: string;
  picture: string;
  deleted: boolean;
  /** The store most of its recent creatives point at; '' when none resolved. */
  storeId: string;
  storeUrl: string;
  storeTitle: string;
  liveAds: number;
  totalAds: number;
  launched14d: number;
  /** Ads launched per UTC day over the last 30 days. */
  launchSeries: Point[];
  /** ISO date of the earliest creative start we hold; '' when unknown. */
  firstAdAt: string;
  /** Facebook page likes as crawled; null when never measured. */
  likes: number | null;
  /** Share of this page's creatives per country, largest first. */
  countries: (CountryShare & { count: number })[];
  landingPages: string[];
  lastAds: AdvertiserAd[];
}

export interface AdvertiserQuery {
  q?: string;
  sort?: string;
  country?: string;
  euUk?: boolean;
  minLive?: number;
  minLaunched?: number;
  minFollowers?: number;
  page?: number;
  limit?: number;
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function mapPage(r: Record<string, unknown>): MetaPage {
  const rawCountries = Array.isArray(r.countries) ? r.countries as { code?: unknown; count?: unknown }[] : [];
  const sum = rawCountries.reduce((a, c) => a + n(c.count), 0);
  const countries = rawCountries
    .filter(c => s(c.code).length === 2 && n(c.count) > 0)
    .map(c => ({ code: s(c.code), count: n(c.count), pct: sum ? Math.round((n(c.count) / sum) * 100) : 0 }));
  const first = n(r.first_ad_at);
  return {
    pageId: s(r.page_id),
    name: s(r.page_name),
    picture: s(r.page_picture),
    deleted: r.page_is_deleted === true,
    storeId: s(r.store_id),
    storeUrl: s(r.store_url),
    storeTitle: s(r.store_title),
    liveAds: n(r.live_ads),
    totalAds: n(r.total_ads),
    launched14d: n(r.launched_14d),
    launchSeries: (Array.isArray(r.launch_series) ? r.launch_series as { d?: unknown; v?: unknown }[] : [])
      .map(p => ({ t: s(p.d), v: n(p.v) })),
    firstAdAt: first > 0 ? new Date(first * 1000).toISOString() : '',
    likes: typeof r.likes === 'number' && r.likes > 0 ? r.likes : null,
    countries,
    landingPages: (Array.isArray(r.landing_pages) ? r.landing_pages : []).map(s).filter(Boolean),
    lastAds: (Array.isArray(r.last_ads) ? r.last_ads as Record<string, unknown>[] : [])
      .map(a => ({ id: s(a.id), image: s(a.image_url), video: s(a.video_url), title: s(a.title) }))
      .filter(a => a.id && a.image),
  };
}

export async function queryAdvertisers(qp: AdvertiserQuery) {
  const limit = Math.min(24, Math.max(1, qp.limit ?? 12));
  const page = Math.max(1, qp.page ?? 1);
  const p = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (qp.q) p.set('search', qp.q);
  if (qp.sort === 'followers' || qp.sort === 'launched') p.set('sort', qp.sort);
  if (qp.country) p.set('country', qp.country);
  if (qp.euUk) p.set('euUk', 'true');
  if (qp.minLive) p.set('minLive', String(qp.minLive));
  if (qp.minLaunched) p.set('minLaunched', String(qp.minLaunched));
  if (qp.minFollowers) p.set('minFollowers', String(qp.minFollowers));
  const payload = await marketGet(`/adlibs/findproduct/creatives-es/advertisers?${p}`, { auth: true, revalidate: 300 });
  const d = ((payload as { data?: unknown })?.data ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? d.items as Record<string, unknown>[] : []).map(mapPage).filter(x => x.pageId && x.name);
  const total = typeof d.total === 'number' ? d.total : null;
  return { items, total, page, limit };
}
