// Favorites folders. Personal and typed (an ads folder never holds shops);
// a favorite with folder_id NULL sits in the Default Folder. Every query is
// scoped by (workspace, user) from the request guard, never from input.
import { query, one } from './db';
import type { FavType } from './data';

export interface FavoriteFolder { id: string; name: string; count: number }

/** `all` = every saved item, `default` = folder_id NULL, otherwise a folder id. */
export type FolderScope = 'all' | 'default' | string;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isFolderId = (v: string | undefined | null): v is string => !!v && UUID.test(v);

export async function listFolders(workspaceId: string, userId: string, type: FavType) {
  const [folders, totals] = await Promise.all([
    query<{ id: string; name: string; n: string }>(
      `SELECT f.id, f.name, count(fv.id) AS n
         FROM favorite_folders f
         LEFT JOIN favorites fv ON fv.folder_id = f.id
        WHERE f.workspace_id=$1 AND f.user_id=$2 AND f.entity_type=$3
        GROUP BY f.id ORDER BY f.created_at`,
      [workspaceId, userId, type],
    ),
    one<{ all: string; unfiled: string }>(
      `SELECT count(*) AS all, count(*) FILTER (WHERE folder_id IS NULL) AS unfiled
         FROM favorites WHERE workspace_id=$1 AND user_id=$2 AND entity_type=$3`,
      [workspaceId, userId, type],
    ),
  ]);
  return {
    folders: folders.map(f => ({ id: f.id, name: f.name, count: Number(f.n) })) as FavoriteFolder[],
    all: Number(totals?.all ?? 0),
    unfiled: Number(totals?.unfiled ?? 0),
  };
}

/** Saved entity ids in a scope, newest first, with the folder each one is in. */
export async function favoritesIn(workspaceId: string, userId: string, type: FavType, scope: FolderScope) {
  const where = scope === 'all' ? '' : scope === 'default' ? 'AND folder_id IS NULL' : 'AND folder_id = $4';
  const rows = await query<{ entity_id: string; folder_id: string | null }>(
    `SELECT entity_id, folder_id FROM favorites
      WHERE workspace_id=$1 AND user_id=$2 AND entity_type=$3 ${where}
      ORDER BY created_at DESC`,
    scope === 'all' || scope === 'default' ? [workspaceId, userId, type] : [workspaceId, userId, type, scope],
  );
  return rows.map(r => ({ id: r.entity_id, folderId: r.folder_id }));
}

// Names the folder bar already uses for its two built-in entries.
const RESERVED = /^(default folder|all my (ads|shops))$/i;

export function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name || name.length > 60 || RESERVED.test(name)) return null;
  return name;
}

/** Returns null when the user already has a folder of that name for this type. */
export async function createFolder(workspaceId: string, userId: string, type: FavType, name: string) {
  return one<{ id: string; name: string }>(
    `INSERT INTO favorite_folders (workspace_id, user_id, entity_type, name) VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING RETURNING id, name`,
    [workspaceId, userId, type, name],
  );
}

export async function renameFolder(workspaceId: string, userId: string, id: string, name: string) {
  try {
    return await one<{ id: string }>(
      `UPDATE favorite_folders SET name=$4, updated_at=now()
        WHERE id=$3 AND workspace_id=$1 AND user_id=$2 RETURNING id`,
      [workspaceId, userId, id, name],
    );
  } catch (e) {
    // Unique (workspace, user, type, lower(name)) — a clash is a user error, not a 500.
    if ((e as { code?: string }).code === '23505') return null;
    throw e;
  }
}

/** Items in the folder fall back to the Default Folder (ON DELETE SET NULL). */
export async function deleteFolder(workspaceId: string, userId: string, id: string) {
  return one<{ id: string }>(
    `DELETE FROM favorite_folders WHERE id=$3 AND workspace_id=$1 AND user_id=$2 RETURNING id`,
    [workspaceId, userId, id],
  );
}

/**
 * Move one saved item. folderId null = Default Folder. The folder must belong
 * to the same user and entity type; returns false when nothing matched.
 */
export async function moveFavorite(workspaceId: string, userId: string, type: FavType, entityId: string, folderId: string | null) {
  const rows = await query(
    `UPDATE favorites fv SET folder_id = $5
      WHERE fv.workspace_id=$1 AND fv.user_id=$2 AND fv.entity_type=$3 AND fv.entity_id=$4
        AND ($5::uuid IS NULL OR EXISTS (
          SELECT 1 FROM favorite_folders f
           WHERE f.id=$5 AND f.workspace_id=$1 AND f.user_id=$2 AND f.entity_type=$3))
      RETURNING fv.id`,
    [workspaceId, userId, type, entityId, folderId],
  );
  return rows.length > 0;
}
