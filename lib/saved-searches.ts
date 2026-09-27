// Saved /shops and /ads searches. Personal, like favorites: every read and
// write is keyed by (workspace, user), so a teammate's searches are never
// listed, renamed or deleted from another account.
import { query, one } from './db';
import { MAX_SAVED_SEARCHES, normalizeQuery, type SearchKind } from './alerts/digest';

export interface SavedSearch {
  id: string;
  kind: SearchKind;
  name: string;
  query: string;
  alert: boolean;
  seededAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
}

type Row = { id: string; kind: SearchKind; name: string; query: string; alert: boolean; seeded_at: Date | null; last_run_at: Date | null; created_at: Date };
const map = (r: Row): SavedSearch => ({
  id: r.id, kind: r.kind, name: r.name, query: r.query, alert: r.alert,
  seededAt: r.seeded_at, lastRunAt: r.last_run_at, createdAt: r.created_at,
});

export async function listSavedSearches(workspaceId: string, userId: string): Promise<SavedSearch[]> {
  const rows = await query<Row>(
    `SELECT id, kind, name, query, alert, seeded_at, last_run_at, created_at FROM saved_searches
      WHERE workspace_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
    [workspaceId, userId],
  );
  return rows.map(map);
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: 'limit' | 'exists'; existingName?: string };

export async function createSavedSearch(
  workspaceId: string, userId: string, kind: SearchKind, name: string, rawQuery: string, alert: boolean,
): Promise<SaveResult> {
  const q = normalizeQuery(rawQuery);
  const dup = await one<{ name: string }>(
    'SELECT name FROM saved_searches WHERE workspace_id=$1 AND user_id=$2 AND kind=$3 AND query=$4',
    [workspaceId, userId, kind, q],
  );
  if (dup) return { ok: false, error: 'exists', existingName: dup.name };
  // The cap check and insert are one statement, so two tabs cannot both slip under it.
  const row = await one<{ id: string }>(
    `INSERT INTO saved_searches (workspace_id, user_id, kind, name, query, alert)
     SELECT $1, $2, $3, $4, $5, $6
      WHERE (SELECT count(*) FROM saved_searches WHERE workspace_id=$1 AND user_id=$2) < $7
     ON CONFLICT (workspace_id, user_id, kind, query) DO NOTHING
     RETURNING id`,
    [workspaceId, userId, kind, name, q, alert, MAX_SAVED_SEARCHES],
  );
  return row ? { ok: true, id: row.id } : { ok: false, error: 'limit' };
}

export async function renameSavedSearch(workspaceId: string, userId: string, id: string, name: string): Promise<boolean> {
  const r = await one<{ id: string }>(
    'UPDATE saved_searches SET name=$4, updated_at=now() WHERE id=$3 AND workspace_id=$1 AND user_id=$2 RETURNING id',
    [workspaceId, userId, id, name],
  );
  return !!r;
}

/** Turning an alert on re-seeds it: results that exist now are not "new" later. */
export async function setSavedSearchAlert(workspaceId: string, userId: string, id: string, alert: boolean): Promise<boolean> {
  const r = await one<{ id: string }>(
    `UPDATE saved_searches SET alert=$4, updated_at=now(),
            seen_ids = CASE WHEN $4 AND NOT alert THEN NULL ELSE seen_ids END,
            seeded_at = CASE WHEN $4 AND NOT alert THEN NULL ELSE seeded_at END
      WHERE id=$3 AND workspace_id=$1 AND user_id=$2 RETURNING id`,
    [workspaceId, userId, id, alert],
  );
  return !!r;
}

export async function deleteSavedSearch(workspaceId: string, userId: string, id: string): Promise<string | null> {
  const r = await one<{ name: string }>(
    'DELETE FROM saved_searches WHERE id=$3 AND workspace_id=$1 AND user_id=$2 RETURNING name',
    [workspaceId, userId, id],
  );
  return r?.name ?? null;
}
