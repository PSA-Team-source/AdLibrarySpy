// Pure CrUX band + traffic-credibility helpers, split from crux.ts so client
// components (the Shops table renders in the browser) can use them without
// pulling the database client into the bundle. crux.ts re-exports all of it.
import type { ShopRow } from '@/lib/types';
import { monthLabel } from './similarweb';

export interface CruxRank {
  domain: string;
  bucket: number;
  month: string;
}

const BAND_LABEL: [number, string][] = [
  [1_000, 'Top 1K'],
  [5_000, 'Top 5K'],
  [10_000, 'Top 10K'],
  [50_000, 'Top 50K'],
  [100_000, 'Top 100K'],
  [500_000, 'Top 500K'],
  [1_000_000, 'Top 1M'],
  [5_000_000, 'Top 5M'],
  [10_000_000, 'Top 10M'],
  [50_000_000, 'Top 50M'],
];

export function bandLabel(bucket: number): string {
  return BAND_LABEL.find(([b]) => b === bucket)?.[1] ?? `Top ${bucket.toLocaleString()}`;
}

/**
 * How prominent the band is, 0–1, for bar/among-visual weighting. Log-scaled
 * because the bands are decades apart.
 */
export function bandStrength(bucket: number): number {
  const lo = Math.log10(1_000), hi = Math.log10(50_000_000);
  const v = (Math.log10(bucket) - lo) / (hi - lo);
  return Math.max(0, Math.min(1, 1 - v));
}

/** Colour ramp for the band chip — brighter for more popular. */
export function bandTone(bucket: number): string {
  if (bucket <= 10_000) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (bucket <= 100_000) return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
  if (bucket <= 1_000_000) return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300';
  return 'bg-foreground/10 text-muted-foreground';
}


/**
 * Is the store index's own visit figure credible for a domain Chrome ranks?
 *
 * The index is directionally right in aggregate — median visits per CrUX band,
 * measured over 397 live rows, fall monotonically (Top 5K 23.1M, Top 50K 6.1M,
 * Top 500K 445K, Top 1M 75K). But the tails are not: 26 of those 397 domains sit
 * in Chrome's top 1M while reporting under 5,000 visits a month, which cannot
 * both be true. tryorgatics.com is Top 500K and claims 483 visits.
 *
 * Floors are set well below each band's measured median so only clear
 * contradictions trip, never a merely small store. A figure that trips is not
 * shown at all: printing a number we can demonstrate is wrong is worse than
 * printing nothing.
 */
const CREDIBLE_FLOOR: [number, number][] = [
  [1_000, 100_000],
  [5_000, 100_000],
  [10_000, 100_000],
  [50_000, 50_000],
  [100_000, 25_000],
  [500_000, 5_000],
  [1_000_000, 2_000],
];

/**
 * SimilarWeb could not rank this exact host.
 *
 * Rows it failed to rank carry a sentinel in a tight band around 12.1M rather
 * than a real position. Measured on a live top-traffic page, all 15 such rows
 * were subdomain storefronts — and each had inherited its PARENT domain's
 * traffic: store.nytimes.com reports 178,145,790 visits, which is nytimes.com's
 * whole-site figure, not the merch store's. shop.hulu.com and uk.gymshark.com
 * behave the same way.
 *
 * So a sentinel rank marks a visit count that belongs to a different site.
 */
const SENTINEL_RANK_LO = 12_000_000;
const SENTINEL_RANK_HI = 12_300_000;

export function rankIsSentinel(similarWebRank: number): boolean {
  return similarWebRank >= SENTINEL_RANK_LO && similarWebRank <= SENTINEL_RANK_HI;
}

export function trafficIsCredible(
  visits: number,
  bucket: number | null,
  similarWebRank = 0,
): boolean {
  if (!visits || visits <= 0) return false;
  // The figure is the parent domain's, not this storefront's.
  if (rankIsSentinel(similarWebRank)) return false;
  if (bucket == null) return true;         // nothing to contradict
  const floor = CREDIBLE_FLOOR.find(([b]) => b === bucket)?.[1];
  return floor == null ? true : visits >= floor;
}

/**
 * The traffic a Shops row prints — one rule for the table and its CSV export.
 * Visits only when measured or credible; growth from the same measurement as
 * the visits (the index's 0 means "not computed"); `caption` names the source.
 */
export function shopTraffic(s: Pick<ShopRow, 'trafficSource' | 'monthlyVisits' | 'cruxBucket' | 'similarWebRank' | 'similarweb' | 'visitsGrowth'>) {
  const measured = s.trafficSource === 'similarweb' && s.monthlyVisits > 0;
  const shown = measured || trafficIsCredible(s.monthlyVisits, s.cruxBucket, s.similarWebRank);
  const period = s.similarweb?.period ?? '';
  const caption = measured ? (period ? monthLabel(period) : 'SimilarWeb')
    : s.trafficSource === 'semrush' ? 'Semrush' : 'Index estimate';
  const growth = !shown ? null : measured ? (s.similarweb?.growthPct ?? null) : (s.visitsGrowth || null);
  const source = measured ? 'SimilarWeb' : caption;
  return { visits: shown ? s.monthlyVisits : null, growth, caption, source, period };
}
