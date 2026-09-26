// Per-user "recently viewed" log behind Home › Recents and /home/history.
//
// A row is written when a dossier (shop, ad, advertiser) is actually
// displayed — the <RecordView> beacon fires on mount, so link prefetches never
// count as views. label/image are what the dossier showed, so reads are pure
// Postgres and never fan out to the market index.
import { query } from './db';

export const VIEW_TYPES = ['shop', 'ad', 'advertiser'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export interface RecentView {
  type: ViewType;
  id: string;
  label: string;
  image: string;
  viewCount: number;
  viewedAt: Date;
}

/** Only https images are stored; anything else becomes '' (rendered as nothing). */
export function cleanImage(src: string): string {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' && src.length <= 1000 ? u.toString() : '';
  } catch {
    return '';
  }
}

export async function recordView(
  workspaceId: string, userId: string,
  v: { type: ViewType; id: string; label: string; image: string },
): Promise<void> {
  await query(
    `INSERT INTO recent_views (workspace_id, user_id, entity_type, entity_id, label, image)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (workspace_id, user_id, entity_type, entity_id) DO UPDATE SET
       viewed_at = now(), view_count = recent_views.view_count + 1,
       label = COALESCE(NULLIF(EXCLUDED.label, ''), recent_views.label),
       image = COALESCE(NULLIF(EXCLUDED.image, ''), recent_views.image)`,
    [workspaceId, userId, v.type, v.id, v.label.slice(0, 200), cleanImage(v.image)],
  );
}

export async function recentViews(
  workspaceId: string, userId: string, type: ViewType | null, limit = 8,
): Promise<RecentView[]> {
  const rows = await query<{
    entity_type: ViewType; entity_id: string; label: string; image: string;
    view_count: number; viewed_at: Date;
  }>(
    `SELECT entity_type, entity_id, label, image, view_count, viewed_at
       FROM recent_views
      WHERE workspace_id = $1 AND user_id = $2 AND ($3::text IS NULL OR entity_type = $3)
      ORDER BY viewed_at DESC
      LIMIT $4`,
    [workspaceId, userId, type, Math.min(200, Math.max(1, limit))],
  );
  return rows.map(r => ({
    type: r.entity_type, id: r.entity_id, label: r.label, image: r.image,
    viewCount: r.view_count, viewedAt: r.viewed_at,
  }));
}

/** Distinct items viewed, per type — the tab counts on Recents. */
export async function recentViewCounts(workspaceId: string, userId: string): Promise<Record<ViewType, number>> {
  const rows = await query<{ entity_type: ViewType; n: string }>(
    `SELECT entity_type, count(*) AS n FROM recent_views
      WHERE workspace_id = $1 AND user_id = $2 GROUP BY entity_type`,
    [workspaceId, userId],
  );
  const out: Record<ViewType, number> = { shop: 0, ad: 0, advertiser: 0 };
  // Legacy rows of retired types (email) stay in the table but are not counted.
  for (const r of rows) if (r.entity_type in out) out[r.entity_type] = Number(r.n);
  return out;
}

/** The dossier a recent row links back to. */
export function viewHref(v: Pick<RecentView, 'type' | 'id'>): string {
  const id = encodeURIComponent(v.id);
  switch (v.type) {
    case 'shop': return `/shops/${id}`;
    case 'ad': return `/ads/${id}`;
    case 'advertiser': return `/advertisers/${id}`;
  }
}
