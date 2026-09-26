// Service credential for the PlatformDTC market API.
//
// This replaces the old /api/token bridge, which held a mutable global JWT
// posted in from a logged-in browser tab and shared one operator's identity
// across every visitor. The token is minted here, server-side, and never
// leaves the process.
import crypto from 'node:crypto';

const TTL_SECONDS = 55 * 60;          // access tokens live 60m; refresh at 55m
const SKEW_SECONDS = 60;

const g = globalThis as unknown as { __ML_MKT?: { token: string; expiresAt: number } };

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function secret(): string {
  const s = process.env.PLATFORM_JWT_SECRET;
  if (!s) throw new Error('PLATFORM_JWT_SECRET is not set — cannot reach the market API');
  if (s.length < 32) throw new Error('PLATFORM_JWT_SECRET must be at least 32 bytes');
  return s;
}

/** HS256, matching the Go backend's AccessClaims: { id, email, name, app, googleId, exp }. */
function signHs256(payload: Record<string, unknown>, key: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', key).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(signature)}`;
}

export async function marketToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = g.__ML_MKT;
  if (cached && cached.expiresAt - SKEW_SECONDS > now) return cached.token;

  const accountId = process.env.MARKET_SERVICE_ACCOUNT_ID;
  if (!accountId) throw new Error('MARKET_SERVICE_ACCOUNT_ID is not set');

  const exp = now + TTL_SECONDS;
  const token = signHs256({
    id: accountId,
    email: process.env.MARKET_SERVICE_EMAIL || 'service@marketlens.internal',
    name: 'AdLibrarySpy Service',
    app: 'marketlens',
    googleId: '',
    iat: now,
    exp,
  }, secret());

  g.__ML_MKT = { token, expiresAt: exp };
  return token;
}

export function marketTokenConfigured(): boolean {
  return !!process.env.PLATFORM_JWT_SECRET && !!process.env.MARKET_SERVICE_ACCOUNT_ID;
}
