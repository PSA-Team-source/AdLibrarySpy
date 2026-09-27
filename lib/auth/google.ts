// Sign in with Google: verify the ID token Google Identity Services hands the
// browser (button or One Tap). Same checks as google-auth-library's
// verifyIdToken — RS256 signature against Google's published keys, issuer,
// audience = our client id, expiry — with node:crypto instead of a dependency.
// https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
import crypto from 'node:crypto';

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SKEW_SEC = 300;

export interface GoogleIdentity { sub: string; email: string; name: string | null }

type Jwk = crypto.JsonWebKey & { kid: string };
let keyCache: { keys: Map<string, crypto.KeyObject>; until: number } | null = null;

/** Google's signing keys, cached for the Cache-Control max-age Google sends (keys rotate ~weekly). */
async function googleKeys(forceRefresh = false): Promise<Map<string, crypto.KeyObject>> {
  if (keyCache && !forceRefresh && keyCache.until > Date.now()) return keyCache.keys;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`google certs ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const map = new Map(keys.map(k => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })]));
  keyCache = { keys: map, until: Date.now() + maxAge * 1000 };
  return map;
}

/**
 * The verified identity in `credential`, or null when the token is not a valid,
 * unexpired Google ID token for `clientId` with a Google-verified email.
 * `keys` is injectable for the self-check (tests/google-id-token.test.mjs).
 */
export async function verifyGoogleIdToken(
  credential: string, clientId: string,
  keys: (refresh: boolean) => Promise<Map<string, crypto.KeyObject>> = googleKeys,
  now = Date.now(),
): Promise<GoogleIdentity | null> {
  const parts = typeof credential === 'string' ? credential.split('.') : [];
  if (parts.length !== 3 || !clientId) return null;
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;

  // An unknown kid right after Google rotates: refetch once.
  const key = (await keys(false)).get(header.kid) ?? (await keys(true)).get(header.kid);
  if (!key) return null;
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
    key, Buffer.from(parts[2], 'base64url'));
  if (!ok) return null;

  const sec = now / 1000;
  if (!ISSUERS.has(String(claims.iss))) return null;
  if (claims.aud !== clientId) return null;
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SEC < sec) return null;
  if (typeof claims.iat === 'number' && claims.iat - SKEW_SEC > sec) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  // Only an address Google has verified may sign into (or create) an account for it.
  if (claims.email_verified !== true || typeof claims.email !== 'string') return null;

  const name = typeof claims.name === 'string' ? claims.name.trim().slice(0, 120) : '';
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: name || null };
}
