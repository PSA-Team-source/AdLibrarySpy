// Pure mapping for the Shops explorer's row signals (see shop-signals.ts for
// the fetch). No runtime imports, so tests/ can load it directly.
import type { CountryShare, Point, Shop } from '@/lib/types';

export interface RowSignals {
  screenshot: string;
  /** SimilarWeb monthly visits, ascending. */
  trafficHistory: Point[];
  /** Top visitor countries, share 0–100. */
  visitorCountries: CountryShare[];
  /** Daily running-ads count, ascending. */
  liveAds: Point[];
  /** Top countries of the store's active creatives, share 0–100 of them. */
  targetedCountries: CountryShare[];
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Parse one store's payload. Exported for the self-check in tests/. */
export function parseRowSignals(raw: Record<string, unknown>): RowSignals {
  const arr = (v: unknown) => (Array.isArray(v) ? v as Record<string, unknown>[] : []);

  const trafficHistory = arr(raw.traffic_history)
    .map(p => ({ t: String(p.month ?? ''), v: num(p.visits) ?? 0 }))
    .filter(p => /^\d{4}-\d{2}$/.test(p.t) && p.v > 0)
    .sort((a, b) => a.t.localeCompare(b.t));

  const visitorCountries = arr(raw.visitor_countries)
    .map(c => ({ code: String(c.code ?? '').toUpperCase(), pct: round1((num(c.share) ?? 0) * 100) }))
    .filter(c => /^[A-Z]{2}$/.test(c.code) && c.pct > 0);

  let liveAds = arr(raw.live_ads_history)
    .map(p => ({ t: String(p.date ?? ''), v: num(p.ads) ?? -1 }))
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.t) && p.v >= 0);
  // ponytail: a 0 between non-zero days is the crawl missing that page, not the
  // brand pausing every ad for a day (e.g. 344, 0, 490, 0, 350). Zeros are
  // dropped when the series has any running ads; an all-zero series stays as
  // measured. Upgrade path: have the crawler record a failed day as absent.
  if (liveAds.some(p => p.v > 0)) liveAds = liveAds.filter(p => p.v > 0);

  const active = num(raw.active_creatives) ?? 0;
  const targetedCountries = active > 0
    ? arr(raw.targeted_countries)
      .map(c => ({ code: String(c.code ?? '').toUpperCase(), pct: round1(((num(c.ads) ?? 0) * 100) / active) }))
      .filter(c => /^[A-Z]{2}$/.test(c.code) && c.pct > 0)
    : [];

  return {
    screenshot: /^https:\/\//.test(String(raw.screenshot_url ?? '')) ? String(raw.screenshot_url) : '',
    trafficHistory, visitorCountries, liveAds, targetedCountries,
  };
}

/** Fold a row's signals into the shop, replacing nothing with an absent value. */
export function applyRowSignals(shop: Shop, s: RowSignals | undefined): Shop {
  if (!s) return shop;
  const next = { ...shop };
  if (s.screenshot) next.screenshot = s.screenshot;
  // The history is the same SimilarWeb measurement the visit figure shows, so it
  // may only replace the series when that figure IS SimilarWeb's.
  if (shop.trafficSource === 'similarweb' && s.trafficHistory.length >= 2) next.trafficSeries = s.trafficHistory;
  if (s.visitorCountries.length) next.visitorCountries = s.visitorCountries;
  if (s.liveAds.length) next.liveAdsSeries = s.liveAds;
  if (s.targetedCountries.length) next.targetedCountries = s.targetedCountries;
  return next;
}
