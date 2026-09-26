import { NextResponse } from 'next/server';
import { issuer } from '@/lib/mcp/oauth';
import { ALL_SCOPES } from '@/lib/mcp/tools';

export const dynamic = 'force-dynamic';

// RFC 9728 — tells a client which authorization server protects this resource.
export async function GET() {
  const base = issuer();
  return NextResponse.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ['header'],
  });
}
