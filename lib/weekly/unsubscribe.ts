// Signed one-click unsubscribe links for the weekly newsletter.
//
// Stateless: the token is an HMAC of the user id under SESSION_SECRET, so a
// link works for as long as the secret does and nothing has to be stored per
// mail. Pure node:crypto with no path aliases, because scripts/weekly-report.mjs
// imports this file directly (Node type stripping) to build the same links.
import crypto from 'node:crypto';

const PURPOSE = 'newsletter-unsubscribe:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set — cannot sign unsubscribe links');
  return s;
}

export function unsubscribeToken(userId: string): string {
  return crypto.createHmac('sha256', secret()).update(PURPOSE + userId.toLowerCase()).digest('base64url');
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  if (!UUID.test(userId) || typeof token !== 'string' || token.length > 64) return false;
  const want = Buffer.from(unsubscribeToken(userId));
  const got = Buffer.from(token);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Absolute unsubscribe URL; `base` is APP_BASE_URL. */
export function unsubscribeUrl(base: string, userId: string): string {
  const u = new URL('/api/newsletter/unsubscribe', base);
  u.searchParams.set('u', userId);
  u.searchParams.set('t', unsubscribeToken(userId));
  return u.toString();
}
