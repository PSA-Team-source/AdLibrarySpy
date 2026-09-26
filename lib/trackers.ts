// Brandtracker snapshots and change feed.
//
// The feed is computed by diffing consecutive recorded snapshots. Nothing is
// simulated: before a brand has two snapshots it simply has no changes yet, and
// the UI says so.
import { query, one } from './db';
import { getShop } from './market/shops';
import { creativeCountFor } from './market/creatives';
import { TRACKER_WINDOWS, windowDelta, type TrackerWindow, type WindowDelta } from './tracker-window';

export interface TrackedMetrics {
  monthlyVisits: number;
  liveAds: number;
  productCount: number;
  avgPrice: number;
  /**
   * Which measurement `monthlyVisits` came from: 'similarweb' once the crawl has
   * reached the store, 'index' while it is still the index's own estimate.
   * Absent on snapshots recorded before the swap, and on a store with no figure.
   */
  monthlyVisitsSource?: 'index' | 'similarweb' | 'semrush' | null;
  /**
   * Creatives our ad library holds for the store's domain. Its growth over a
   * window is the Brandtracker's "New Ads". Absent on snapshots recorded before
   * it was captured, or when the library could not be asked.
   */
  creatives?: number | null;
}

/** The numeric metrics the change feed diffs. */
export type TrackedMetric = 'monthlyVisits' | 'liveAds' | 'productCount' | 'avgPrice';

export interface TrackerWithState {
  id: string;
  shopId: string;
  domain: string;
  name: string;
  createdAt: Date;
  latest: TrackedMetrics | null;
  latestAt: Date | null;
  previous: TrackedMetrics | null;
  previousAt: Date | null;
}

export interface Change {
  trackerId: string;
  shopId: string;
  name: string;
  domain: string;
  metric: TrackedMetric;
  label: string;
  from: number;
  to: number;
  deltaPct: number | null;
  at: Date;
}

const METRIC_LABEL: Record<TrackedMetric, string> = {
  monthlyVisits: 'Monthly visits',
  liveAds: 'Live ads',
  productCount: 'Products',
  avgPrice: 'Average price',
};

/** Record one snapshot per tracked brand. Called by the snapshot cron. */
export async function captureSnapshot(trackerId: string, shopId: string): Promise<boolean> {
  const shop = await getShop(shopId).catch(() => null);
  if (!shop) return false;
  const creatives = await creativeCountFor(shop.domain);
  const metrics: TrackedMetrics = {
    monthlyVisits: shop.monthlyVisits,
    liveAds: shop.metaAds,
    productCount: shop.productCount,
    avgPrice: shop.avgPrice,
    // Recorded with the figure: a store crossing from the index's estimate to a
    // SimilarWeb measurement changes the number without its traffic moving.
    monthlyVisitsSource: shop.trafficSource,
    creatives,
  };
  await query(
    'INSERT INTO tracker_snapshots (tracker_id, metrics) VALUES ($1, $2)',
    [trackerId, JSON.stringify(metrics)],
  );
  return true;
}

/** Trackers with their two most recent snapshots attached. */
export async function trackersWithState(workspaceId: string): Promise<TrackerWithState[]> {
  const rows = await query<{
    id: string; shop_id: string; domain: string; name: string; created_at: Date;
    latest: TrackedMetrics | null; latest_at: Date | null;
    previous: TrackedMetrics | null; previous_at: Date | null;
  }>(
    `SELECT t.id, t.shop_id, t.domain, t.name, t.created_at,
            s1.metrics AS latest,   s1.captured_at AS latest_at,
            s2.metrics AS previous, s2.captured_at AS previous_at
       FROM trackers t
       LEFT JOIN LATERAL (
         SELECT metrics, captured_at FROM tracker_snapshots
          WHERE tracker_id = t.id ORDER BY captured_at DESC LIMIT 1
       ) s1 ON true
       LEFT JOIN LATERAL (
         SELECT metrics, captured_at FROM tracker_snapshots
          WHERE tracker_id = t.id ORDER BY captured_at DESC OFFSET 1 LIMIT 1
       ) s2 ON true
      WHERE t.workspace_id = $1
      ORDER BY t.created_at DESC`,
    [workspaceId],
  );
  return rows.map(r => ({
    id: r.id, shopId: r.shop_id, domain: r.domain, name: r.name, createdAt: r.created_at,
    latest: r.latest, latestAt: r.latest_at, previous: r.previous, previousAt: r.previous_at,
  }));
}

/** Every metric that moved between the last two snapshots, newest first. */
export function changeFeed(trackers: TrackerWithState[]): Change[] {
  const out: Change[] = [];
  for (const t of trackers) {
    if (!t.latest || !t.previous || !t.latestAt) continue;
    for (const key of Object.keys(METRIC_LABEL) as TrackedMetric[]) {
      // A store the SimilarWeb crawl reached between two snapshots swaps a
      // parent-domain estimate for a measurement of the host itself. The number
      // jumps; the traffic did not. Reporting that as growth would be inventing
      // a change, so the metric is skipped until both snapshots share a source.
      if (key === 'monthlyVisits'
        && (t.latest.monthlyVisitsSource ?? null) !== (t.previous.monthlyVisitsSource ?? null)) continue;
      const to = Number(t.latest[key] ?? 0);
      const from = Number(t.previous[key] ?? 0);
      if (to === from) continue;
      out.push({
        trackerId: t.id, shopId: t.shopId, name: t.name, domain: t.domain,
        metric: key, label: METRIC_LABEL[key], from, to,
        deltaPct: from > 0 ? Math.round(((to - from) / from) * 100) : null,
        at: t.latestAt,
      });
    }
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime()
    || Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
}

/** Snapshot history for one tracker, oldest first — used for the sparkline. */
export async function trackerHistory(trackerId: string, workspaceId: string, limit = 60) {
  return query<{ captured_at: Date; metrics: TrackedMetrics }>(
    `SELECT s.captured_at, s.metrics
       FROM tracker_snapshots s JOIN trackers t ON t.id = s.tracker_id
      WHERE s.tracker_id = $1 AND t.workspace_id = $2
      ORDER BY s.captured_at ASC LIMIT $3`,
    [trackerId, workspaceId, limit],
  );
}

/** All trackers across all workspaces — the cron's work list. */
export async function allTrackers() {
  return query<{ id: string; shop_id: string }>('SELECT id, shop_id FROM trackers');
}

// ---------- Brandtracker board: windowed deltas + folders ----------

export { TRACKER_WINDOWS, windowDelta, type TrackerWindow, type WindowDelta };

export interface BoardTracker {
  id: string;
  shopId: string;
  domain: string;
  name: string;
  folderId: string | null;
  createdAt: Date;
  latest: TrackedMetrics | null;
  latestAt: Date | null;
  /** The state as of the start of the window (last snapshot at or before it). */
  baseline: TrackedMetrics | null;
  baselineAt: Date | null;
  delta: WindowDelta;
}

export async function trackerBoard(workspaceId: string, window: TrackerWindow): Promise<BoardTracker[]> {
  const rows = await query<{
    id: string; shop_id: string; domain: string; name: string; folder_id: string | null; created_at: Date;
    latest: TrackedMetrics | null; latest_at: Date | null;
    baseline: TrackedMetrics | null; baseline_at: Date | null;
  }>(
    `SELECT t.id, t.shop_id, t.domain, t.name, t.folder_id, t.created_at,
            s1.metrics AS latest, s1.captured_at AS latest_at,
            s0.metrics AS baseline, s0.captured_at AS baseline_at
       FROM trackers t
       LEFT JOIN LATERAL (
         SELECT metrics, captured_at FROM tracker_snapshots
          WHERE tracker_id = t.id ORDER BY captured_at DESC LIMIT 1
       ) s1 ON true
       LEFT JOIN LATERAL (
         SELECT metrics, captured_at FROM tracker_snapshots
          WHERE tracker_id = t.id AND captured_at <= now() - make_interval(days => $2)
          ORDER BY captured_at DESC LIMIT 1
       ) s0 ON true
      WHERE t.workspace_id = $1
      ORDER BY t.created_at DESC`,
    [workspaceId, TRACKER_WINDOWS[window]],
  );
  return rows.map(r => ({
    id: r.id, shopId: r.shop_id, domain: r.domain, name: r.name, folderId: r.folder_id,
    createdAt: r.created_at, latest: r.latest, latestAt: r.latest_at,
    baseline: r.baseline, baselineAt: r.baseline_at,
    delta: windowDelta(r.latest, r.baseline),
  }));
}

export interface TrackerFolder { id: string; name: string; trackers: number; updatedAt: Date }

/** Folders, most recently updated first. */
export async function trackerFolders(workspaceId: string, limit = 100): Promise<TrackerFolder[]> {
  const rows = await query<{ id: string; name: string; n: string; updated_at: Date }>(
    `SELECT f.id, f.name, f.updated_at, count(t.id) AS n
       FROM tracker_folders f LEFT JOIN trackers t ON t.folder_id = f.id
      WHERE f.workspace_id = $1
      GROUP BY f.id ORDER BY f.updated_at DESC LIMIT $2`,
    [workspaceId, limit],
  );
  return rows.map(r => ({ id: r.id, name: r.name, trackers: Number(r.n), updatedAt: r.updated_at }));
}

export async function createTrackerFolder(workspaceId: string, userId: string, name: string): Promise<string | null> {
  const row = await one<{ id: string }>(
    `INSERT INTO tracker_folders (workspace_id, name, created_by) VALUES ($1,$2,$3)
     ON CONFLICT (workspace_id, lower(name)) DO NOTHING RETURNING id`,
    [workspaceId, name, userId],
  );
  return row?.id ?? null;
}

export async function deleteTrackerFolder(workspaceId: string, folderId: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    'DELETE FROM tracker_folders WHERE id = $1 AND workspace_id = $2 RETURNING id',
    [folderId, workspaceId],
  );
  return !!row;
}

/** Move a tracker into a folder (null = No folder). Both must be this workspace's. */
export async function moveTracker(workspaceId: string, trackerId: string, folderId: string | null): Promise<boolean> {
  const row = await one<{ id: string }>(
    `UPDATE trackers t SET folder_id = $3
      WHERE t.id = $1 AND t.workspace_id = $2
        AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM tracker_folders f WHERE f.id = $3 AND f.workspace_id = $2))
      RETURNING t.id`,
    [trackerId, workspaceId, folderId],
  );
  if (row && folderId) {
    await query('UPDATE tracker_folders SET updated_at = now() WHERE id = $1', [folderId]);
  }
  return !!row;
}
