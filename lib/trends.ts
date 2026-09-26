// The Trends screen's rules: which stores count as breaking out, and how niches
// are ranked. Pure (no I/O) so tests/trends.test.mjs can hold them in place; the
// cached loaders live in app/(app)/trends/load.ts.
//
// Every figure is SimilarWeb's measured month-over-month change for the exact
// host (sw_visits / sw_prev_visits / sw_growth_pct on the top-brands index).
// Ad-count growth is deliberately NOT a trend signal here: percentage_num_ads_increase
// and num_ads_increase disagree with the store's own ad counts month to month
// (a store whose ads fell 784 → 434 reads "+288%"), so a "scaling ads" list
// would rank noise.

/** Visit floors the fastest-growing list can be viewed at. */
export const RISER_BANDS = {
  '100k': { min: 100_000, label: '100K+ visits' },
  '1m':   { min: 1_000_000, label: '1M+ visits' },
} as const;
export type RiserBand = keyof typeof RISER_BANDS;

export function parseBand(v: string | undefined): RiserBand {
  return v === '1m' ? '1m' : '100k';
}

/** A store must have had real traffic the month before to "grow" from it. */
export const MIN_PREV_VISITS = 10_000;
/**
 * ponytail: a hard ceiling, not a model. Above 10x month over month the index is
 * almost always showing SimilarWeb's first real reading of a host (42 → 62,501
 * visits = "+148,712%"), not demand. Upgrade path: a 3-month SimilarWeb history
 * on list rows, then require two consecutive rising months instead.
 */
export const MAX_GROWTH_PCT = 1000;

export interface MeasuredTraffic { visits: number; prevVisits: number; growthPct: number | null }

/** True when a store's measured traffic is a credible breakout at this visit floor. */
export function isBreakout(sw: MeasuredTraffic | null | undefined, minVisits: number): boolean {
  if (!sw || sw.growthPct == null) return false;
  return sw.visits >= minVisits
    && sw.prevVisits >= MIN_PREV_VISITS
    && sw.growthPct > 0
    && sw.growthPct <= MAX_GROWTH_PCT;
}

// ---------- niches ----------

/** A niche's store counts: "measured" = 10K+ SimilarWeb visits; "breakout" = those that grew 50%+. */
export const NICHE_MIN_VISITS = 10_000;
export const NICHE_MIN_GROWTH = 50;
/** Below this many measured stores a share is a handful of shops, not a trend. */
export const NICHE_MIN_MEASURED = 500;
/** Subcategories smaller than this in the taxonomy are not counted at all. */
export const NICHE_MIN_BRANDS = 20_000;

export interface NicheCount {
  id: string;
  name: string;
  parentId: string;
  parentName: string;
  measured: number;
  breakout: number;
}

export interface RankedNiche extends NicheCount { share: number }

/** Niches by the share of their measured stores that broke out, largest first. */
export function rankNiches(rows: NicheCount[], limit = 12): RankedNiche[] {
  return rows
    .filter(r => r.measured >= NICHE_MIN_MEASURED && r.breakout > 0 && r.breakout <= r.measured)
    .map(r => ({ ...r, share: r.breakout / r.measured }))
    .sort((a, b) => b.share - a.share || b.breakout - a.breakout)
    .slice(0, limit);
}

/** The /shops view behind a niche card: the same filters, sorted by growth. */
export function nicheHref(n: Pick<NicheCount, 'id' | 'parentId'>): string {
  const p = new URLSearchParams({
    category: n.parentId, subcategory: n.id,
    traffic: '10k', growth: String(NICHE_MIN_GROWTH), sort: 'growth',
  });
  return `/shops?${p}`;
}

/** "+981%" / "+64.2%" — whole numbers once the change is three digits. */
export function growthLabel(pct: number): string {
  const v = Math.abs(pct) >= 100 ? Math.round(pct).toLocaleString('en-US') : pct.toFixed(1);
  return `${pct > 0 ? '+' : ''}${v}%`;
}
