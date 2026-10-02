// Mint an API key. Not a server-action module: the browser reaches it only
// through createApiKeyAction (admin session) or the agent code sign-in
// (app/api/agent/verify, email ownership proven by a 6-digit code).
import crypto from 'node:crypto';
import { query } from '@/lib/db';
import { hashToken } from '@/lib/auth/tokens';

export const KEY_PREFIX = 'ml_live_';
export const DEFAULT_SCOPES = ['discovery.read', 'brandtrackers.read', 'favorites.read'];

/** Returns the plaintext key; only its hash is stored. */
export async function mintApiKey(workspaceId: string, userId: string, name: string): Promise<string> {
  const secret = crypto.randomBytes(24).toString('base64url');
  const key = `${KEY_PREFIX}${secret}`;
  await query(
    `INSERT INTO api_keys (workspace_id, name, key_prefix, key_hash, scopes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [workspaceId, name, `${KEY_PREFIX}${secret.slice(0, 6)}`, hashToken(key), DEFAULT_SCOPES, userId],
  );
  return key;
}
