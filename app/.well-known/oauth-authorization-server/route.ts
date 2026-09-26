import { NextResponse } from 'next/server';
import { issuer } from '@/lib/mcp/oauth';
import { ALL_SCOPES } from '@/lib/mcp/tools';

export const dynamic = 'force-dynamic';

// RFC 8414 — lets an MCP client discover the OAuth endpoints automatically.
export async function GET() {
  const base = issuer();
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  });
}
