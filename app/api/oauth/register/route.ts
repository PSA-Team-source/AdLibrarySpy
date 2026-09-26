import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerClient } from '@/lib/mcp/oauth';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { isLoopbackHost } from '@/lib/safe-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  client_name: z.string().min(1).max(120).default('MCP client'),
  redirect_uris: z.array(z.string().url()).min(1).max(8),
});

// RFC 7591 dynamic client registration. Public clients only (PKCE, no secret).
export async function POST(req: NextRequest) {
  const limited = await rateLimit(`oauth_register:${clientIp(req.headers)}`, 10, 3600);
  if (!limited.allowed) {
    return NextResponse.json({ error: 'temporarily_unavailable', error_description: 'Too many registrations.' }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'client_name and redirect_uris are required.' }, { status: 400 });
  }

  // Only https redirects, plus loopback for local development.
  const bad = parsed.data.redirect_uris.find(u => {
    const url = new URL(u);
    return url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHost(url.hostname));
  });
  if (bad) {
    return NextResponse.json({ error: 'invalid_redirect_uri', error_description: `redirect_uri must use https: ${bad}` }, { status: 400 });
  }

  const { clientId } = await registerClient({
    name: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
  });

  return NextResponse.json({
    client_id: clientId,
    client_name: parsed.data.client_name,
    redirect_uris: parsed.data.redirect_uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }, { status: 201 });
}
