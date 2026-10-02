'use server';
// API keys. The plaintext key is shown exactly once, at creation; only its
// SHA-256 hash is stored, so a database leak cannot be replayed as a key.
import { revalidatePath } from 'next/cache';
import { mintApiKey, KEY_PREFIX as PREFIX } from '@/lib/apikey-mint';
import { query, one } from '@/lib/db';
import { requireRole, audit } from '@/lib/auth/guard';
import { hashToken } from '@/lib/auth/tokens';

export interface ApiKeyRow {
  id: string; name: string; keyPrefix: string; scopes: string[];
  lastUsedAt: Date | null; createdAt: Date;
}
export interface KeyState { error?: string; created?: string }


export async function listApiKeys(workspaceId: string): Promise<ApiKeyRow[]> {
  const rows = await query<{
    id: string; name: string; key_prefix: string; scopes: string[];
    last_used_at: Date | null; created_at: Date;
  }>(
    `SELECT id, name, key_prefix, scopes, last_used_at, created_at
       FROM api_keys WHERE workspace_id = $1 AND revoked_at IS NULL
      ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(r => ({
    id: r.id, name: r.name, keyPrefix: r.key_prefix, scopes: r.scopes,
    lastUsedAt: r.last_used_at, createdAt: r.created_at,
  }));
}

export async function createApiKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ctx = await requireRole('admin');
  const name = String(form.get('name') ?? '').trim().slice(0, 60) || 'Default key';

  const key = await mintApiKey(ctx.workspaceId, ctx.user.id, name);
  await audit(ctx, 'apikey.created', name);
  revalidatePath('/settings/api');
  return { created: key };
}

export async function revokeApiKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const ctx = await requireRole('admin');
  const id = String(form.get('id') ?? '');
  await query('UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND workspace_id = $2', [id, ctx.workspaceId]);
  await audit(ctx, 'apikey.revoked', id);
  revalidatePath('/settings/api');
  return {};
}

/** Resolve a presented key to its workspace. Returns null when invalid. */
export async function resolveApiKey(presented: string): Promise<{ workspaceId: string; keyId: string; userId: string; scopes: string[] } | null> {
  if (!presented.startsWith(PREFIX)) return null;
  const row = await one<{ id: string; workspace_id: string; created_by: string; scopes: string[] }>(
    // A key acts as its creator: it stops working once they leave the workspace.
    `SELECT k.id, k.workspace_id, k.created_by, k.scopes FROM api_keys k
       JOIN workspace_members m ON m.workspace_id = k.workspace_id AND m.user_id = k.created_by
      WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
    [hashToken(presented)],
  );
  if (!row) return null;
  // Fire-and-forget: last_used_at must never fail the request it describes.
  query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.id]).catch(() => {});
  return { workspaceId: row.workspace_id, keyId: row.id, userId: row.created_by, scopes: row.scopes };
}
