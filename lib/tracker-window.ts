// Pure windowed-delta logic for the Brandtracker (no DB, no network), so the
// check in tests/brandtracker.test.mjs can import it directly.
import type { TrackedMetrics } from './trackers';

export const TRACKER_WINDOWS = { '1d': 1, '7d': 7, '14d': 14, '30d': 30 } as const;
export type TrackerWindow = keyof typeof TRACKER_WINDOWS;

export interface WindowDelta {
  /** Change in monthly visits; null when the window has no comparable baseline. */
  visits: number | null;
  visitsPct: number | null;
  liveAds: number | null;
  /** Creatives newly indexed for the store in the window; null = not measurable. */
  newAds: number | null;
  /** Change in the storefront's product count; null when the window has no baseline. */
  products: number | null;
}

/**
 * Pure: the change between the window's baseline and the latest snapshot.
 * Snapshots are only written when a metric moved, so the last row at or
 * before the window start IS the state at that moment. Visits across a change
 * of measurement source are not compared (see changeFeed).
 */
export function windowDelta(latest: TrackedMetrics | null, baseline: TrackedMetrics | null): WindowDelta {
  const none: WindowDelta = { visits: null, visitsPct: null, liveAds: null, newAds: null, products: null };
  if (!latest || !baseline) return none;
  const sameSource = (latest.monthlyVisitsSource ?? null) === (baseline.monthlyVisitsSource ?? null);
  const visits = sameSource && latest.monthlyVisits > 0 && baseline.monthlyVisits > 0
    ? latest.monthlyVisits - baseline.monthlyVisits : null;
  const newAds = typeof latest.creatives === 'number' && typeof baseline.creatives === 'number'
    ? Math.max(0, latest.creatives - baseline.creatives) : null;
  return {
    visits,
    visitsPct: visits !== null ? Math.round((visits / baseline.monthlyVisits) * 1000) / 10 : null,
    liveAds: latest.liveAds - baseline.liveAds,
    newAds,
    products: (Number(latest.productCount) || 0) - (Number(baseline.productCount) || 0),
  };
}

