import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, refresh } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

function fail(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail('invalid_request', 'Expected application/x-www-form-urlencoded body.');

  const grantType = String(form.get('grant_type') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return fail('invalid_client', 'client_id is required.');

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    const verifier = String(form.get('code_verifier') ?? '');
    if (!code || !redirectUri || !verifier) {
      return fail('invalid_request', 'code, redirect_uri and code_verifier are required.');
    }
    const result = await exchangeCode({ code, clientId, redirectUri, codeVerifier: verifier });
    if (!result.ok) return fail(result.error, result.description);
    return NextResponse.json({
      access_token: result.tokens.accessToken,
      refresh_token: result.tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: result.tokens.expiresIn,
      scope: result.tokens.scopes.join(' '),
    }, { headers: NO_STORE });
  }

  if (grantType === 'refresh_token') {
    const token = String(form.get('refresh_token') ?? '');
    if (!token) return fail('invalid_request', 'refresh_token is required.');
    const result = await refresh({ refreshToken: token, clientId });
    if (!result.ok) return fail(result.error, result.description);
    return NextResponse.json({
      access_token: result.tokens.accessToken,
      refresh_token: result.tokens.refreshToken,
      token_type: 'Bearer',
      expires_in: result.tokens.expiresIn,
      scope: result.tokens.scopes.join(' '),
    }, { headers: NO_STORE });
  }

  return fail('unsupported_grant_type', `grant_type "${grantType}" is not supported.`);
}
