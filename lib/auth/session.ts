// Session cookie. The cookie holds an opaque random token; the DB holds its
// hash. Revocation is therefore immediate and server-side (a stateless JWT
// could not be revoked before expiry).
import { cookies, headers } from 'next/headers';
import { query, one } from '@/lib/db';
import { randomToken, hashToken } from './tokens';

export const SESSION_COOKIE = 'ml_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  const h = await headers();
  const ipRaw = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  const ip = /^[0-9a-f.:]+$/i.test(ipRaw) && ipRaw ? ipRaw : null;
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [userId, hashToken(token), String(SESSION_DAYS), ip, (h.get('user-agent') || '').slice(0, 400)],
  );
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<{ id: string; email: string; name: string; email_verified_at: Date | null }>(
    `SELECT u.id, u.email, u.name, u.email_verified_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, emailVerifiedAt: row.email_verified_at };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [hashToken(token)]);
  }
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user — used after a password reset. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}
