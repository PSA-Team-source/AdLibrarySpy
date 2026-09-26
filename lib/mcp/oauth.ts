// OAuth 2.1 for MCP connectors: PKCE (S256) mandatory, dynamic client
// registration, rotating refresh tokens. Only token hashes are stored.
import crypto from 'node:crypto';
import { query, one } from '@/lib/db';
import { randomToken, hashToken } from '@/lib/auth/tokens';
import { isMember } from '@/lib/auth/guard';
import { ALL_SCOPES } from './tools';

export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const CODE_TTL_SECONDS = 300;

export function issuer(): string {
  return (process.env.APP_BASE_URL || 'http://localhost:4311').replace(/\/$/, '');
}

/** RFC 7636: BASE64URL(SHA256(verifier)) must equal the stored challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function normalizeScopes(requested: string | null | undefined): string[] {
  if (!requested) return ALL_SCOPES.filter(s => !s.endsWith('.write'));
  const asked = requested.split(/[\s+]+/).filter(Boolean);
  return asked.filter(s => ALL_SCOPES.includes(s));
}

export interface ClientRow {
  id: string; name: string; redirect_uris: string[]; is_public: boolean;
  secret_hash: string | null; scopes: string[]; disabled_at: Date | null;
}

export async function getClient(clientId: string): Promise<ClientRow | null> {
  return one<ClientRow>('SELECT * FROM oauth_clients WHERE id = $1 AND disabled_at IS NULL', [clientId]);
}

/**
 * A redirect_uri must match one registered for the client exactly. Prefix or
 * substring matching would let an attacker redirect the code elsewhere.
 */
export function redirectAllowed(client: ClientRow, uri: string): boolean {
  return client.redirect_uris.includes(uri);
}

export async function registerClient(input: {
  name: string; redirectUris: string[]; scopes?: string[];
}): Promise<{ clientId: string }> {
  const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
  await query(
    `INSERT INTO oauth_clients (id, name, redirect_uris, is_public, scopes)
     VALUES ($1,$2,$3,true,$4)`,
    [clientId, input.name.slice(0, 120), input.redirectUris, input.scopes ?? ALL_SCOPES],
  );
  return { clientId };
}

export async function issueCode(input: {
  clientId: string; userId: string; workspaceId: string; redirectUri: string;
  scopes: string[]; codeChallenge: string;
}): Promise<string> {
  const code = randomToken(32);
  await query(
    `INSERT INTO oauth_codes (code_hash, client_id, user_id, workspace_id, redirect_uri,
                              scopes, code_challenge, code_challenge_method, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'S256', now() + ($8 || ' seconds')::interval)`,
    [hashToken(code), input.clientId, input.userId, input.workspaceId, input.redirectUri,
     input.scopes, input.codeChallenge, String(CODE_TTL_SECONDS)],
  );
  return code;
}

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; scopes: string[] }

async function mintPair(input: {
  clientId: string; userId: string; workspaceId: string; scopes: string[];
}): Promise<TokenPair> {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  await query(
    `INSERT INTO oauth_tokens (client_id, user_id, workspace_id, access_token_hash,
                               refresh_token_hash, scopes, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + ($7 || ' seconds')::interval)`,
    [input.clientId, input.userId, input.workspaceId, hashToken(accessToken),
     hashToken(refreshToken), input.scopes, String(ACCESS_TTL_SECONDS)],
  );
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, scopes: input.scopes };
}

/** Exchange an authorization code. The code is single-use. */
export async function exchangeCode(input: {
  code: string; clientId: string; redirectUri: string; codeVerifier: string;
}): Promise<{ ok: true; tokens: TokenPair } | { ok: false; error: string; description: string }> {
  type CodeRow = { client_id: string; user_id: string; workspace_id: string; redirect_uri: string; scopes: string[]; code_challenge: string };
  const hash = hashToken(input.code);
  // Consume first, in one statement: two concurrent exchanges of the same code
  // cannot both see it unused. A failed check below still burns the code,
  // which is what RFC 6749 §4.1.2 asks for anyway.
  const row = await one<CodeRow>(
    `UPDATE oauth_codes SET consumed_at = now()
      WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING client_id, user_id, workspace_id, redirect_uri, scopes, code_challenge`,
    [hash],
  );
  if (!row) {
    const used = await one<{ client_id: string; user_id: string }>(
      'SELECT client_id, user_id FROM oauth_codes WHERE code_hash = $1 AND consumed_at IS NOT NULL', [hash]);
    // Replay: burn every token already minted from this code.
    if (used) {
      await query('UPDATE oauth_tokens SET revoked_at = now() WHERE client_id = $1 AND user_id = $2 AND revoked_at IS NULL',
        [used.client_id, used.user_id]);
      return { ok: false, error: 'invalid_grant', description: 'Authorization code has already been used.' };
    }
    return { ok: false, error: 'invalid_grant', description: 'Authorization code is invalid or expired.' };
  }
  if (row.client_id !== input.clientId) return { ok: false, error: 'invalid_grant', description: 'Code was issued to a different client.' };
  if (row.redirect_uri !== input.redirectUri) return { ok: false, error: 'invalid_grant', description: 'redirect_uri does not match the authorization request.' };
  if (!verifyPkce(input.codeVerifier, row.code_challenge)) return { ok: false, error: 'invalid_grant', description: 'PKCE verification failed.' };
  if (!(await isMember(row.user_id, row.workspace_id))) return { ok: false, error: 'invalid_grant', description: 'You no longer have access to that workspace.' };

  const tokens = await mintPair({
    clientId: row.client_id, userId: row.user_id, workspaceId: row.workspace_id, scopes: row.scopes,
  });
  return { ok: true, tokens };
}

/**
 * Rotate a refresh token: the presented one is revoked as the new pair is
 * issued, in one statement so a token cannot be redeemed twice concurrently.
 * A refresh token lives REFRESH_TTL_SECONDS from its own issue; each rotation
 * issues a fresh one, so an actively used connection stays signed in.
 */
export async function refresh(input: { refreshToken: string; clientId: string }):
  Promise<{ ok: true; tokens: TokenPair } | { ok: false; error: string; description: string }> {
  const hash = hashToken(input.refreshToken);
  const row = await one<{ client_id: string; user_id: string; workspace_id: string; scopes: string[] }>(
    `UPDATE oauth_tokens SET revoked_at = now()
      WHERE refresh_token_hash = $1 AND client_id = $2 AND revoked_at IS NULL
        AND created_at > now() - ($3 || ' seconds')::interval
      RETURNING client_id, user_id, workspace_id, scopes`,
    [hash, input.clientId, String(REFRESH_TTL_SECONDS)],
  );

  if (!row) {
    const known = await one<{ client_id: string; user_id: string; revoked_at: Date | null }>(
      'SELECT client_id, user_id, revoked_at FROM oauth_tokens WHERE refresh_token_hash = $1', [hash]);
    if (!known) return { ok: false, error: 'invalid_grant', description: 'Refresh token is not recognised.' };
    if (known.client_id !== input.clientId) return { ok: false, error: 'invalid_grant', description: 'Refresh token belongs to another client.' };
    if (known.revoked_at) {
      // Reuse of a rotated token means it leaked; revoke the whole family.
      await query('UPDATE oauth_tokens SET revoked_at = now() WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL',
        [known.user_id, known.client_id]);
      return { ok: false, error: 'invalid_grant', description: 'Refresh token has already been used.' };
    }
    return { ok: false, error: 'invalid_grant', description: 'Refresh token has expired. Connect again.' };
  }
  if (!(await isMember(row.user_id, row.workspace_id))) return { ok: false, error: 'invalid_grant', description: 'You no longer have access to that workspace.' };

  const tokens = await mintPair({
    clientId: row.client_id, userId: row.user_id, workspaceId: row.workspace_id, scopes: row.scopes,
  });
  return { ok: true, tokens };
}

export interface BearerContext {
  workspaceId: string; userId: string; scopes: string[]; tokenId: string;
}

export async function verifyBearer(token: string): Promise<BearerContext | null> {
  const row = await one<{ id: string; workspace_id: string; user_id: string; scopes: string[] }>(
    // A token acts as its user, so it stops working the moment they leave the
    // workspace, whatever else failed to revoke it.
    `SELECT t.id, t.workspace_id, t.user_id, t.scopes FROM oauth_tokens t
       JOIN workspace_members m ON m.workspace_id = t.workspace_id AND m.user_id = t.user_id
      WHERE t.access_token_hash = $1 AND t.revoked_at IS NULL AND t.expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return null;
  query('UPDATE oauth_tokens SET last_used_at = now() WHERE id = $1', [row.id]).catch(() => {});
  return { workspaceId: row.workspace_id, userId: row.user_id, scopes: row.scopes, tokenId: row.id };
}

export async function listAuthorizedClients(workspaceId: string) {
  return query<{ client_id: string; name: string; scopes: string[]; created_at: Date; last_used_at: Date | null }>(
    `SELECT DISTINCT ON (t.client_id) t.client_id, c.name, t.scopes, t.created_at, t.last_used_at
       FROM oauth_tokens t JOIN oauth_clients c ON c.id = t.client_id
      WHERE t.workspace_id = $1 AND t.revoked_at IS NULL
      ORDER BY t.client_id, t.created_at DESC`,
    [workspaceId],
  );
}

export async function revokeClient(workspaceId: string, clientId: string) {
  await query(
    'UPDATE oauth_tokens SET revoked_at = now() WHERE workspace_id = $1 AND client_id = $2 AND revoked_at IS NULL',
    [workspaceId, clientId],
  );
}
