// MCP endpoint (Streamable HTTP transport, JSON-RPC 2.0).
//
// Auth is an OAuth 2.1 bearer token; an unauthenticated call returns 401 with
// the WWW-Authenticate hint that points a client at the discovery document.
import { NextRequest, NextResponse } from 'next/server';
import { verifyBearer, issuer } from '@/lib/mcp/oauth';
import { resolveApiKey } from '@/lib/apikeys';
import { TOOLS, toolByName, type ToolContext } from '@/lib/mcp/tools';
import { FAIR_USE, clientIp, quotaHeaders, quotaWait, spendQuotas } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROTOCOL_VERSION = '2025-06-18';
const MAX_BATCH = 10;

type Id = string | number | null;
interface RpcRequest { jsonrpc: '2.0'; id?: Id; method: string; params?: Record<string, unknown> }

const ERR = {
  PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602, INTERNAL: -32603,
} as const;

function result(id: Id, value: unknown) {
  return { jsonrpc: '2.0' as const, id, result: value };
}
function error(id: Id, code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0' as const, id, error: { code, message, ...(data ? { data } : {}) } };
}

function unauthorized() {
  return NextResponse.json(
    { error: 'invalid_token', error_description: 'A valid OAuth bearer token is required.' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource"`,
      },
    },
  );
}

async function dispatch(rpc: RpcRequest, ctx: ToolContext & { tokenId: string }): Promise<unknown | null> {
  const id = rpc.id ?? null;

  switch (rpc.method) {
    case 'initialize':
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'adlibraryspy', title: 'AdLibrarySpy', version: '1.0.0' },
        instructions:
          'AdLibrarySpy indexes Shopify stores and their ad creatives. Search with search_shops / search_ads, find the products ads point at with search_products, '
          + 'open one with get_shop / get_ad, see how a store\'s creatives split by hook, angle and offer with creative_breakdown, '
          + 'and manage the workspace brandtracker with track_brand and brand_changes. '
          + 'AI creative labels are model classifications of ad text with a confidence; an absent label means the model was unsure, not that the trait is missing. '
          + 'Values are omitted (null) when the index has no measurement — treat null as "not measured", never as zero.',
      });

    // Notifications carry no id and expect no response body.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return result(id, {});

    case 'tools/list':
      return result(id, {
        tools: TOOLS
          .filter(t => ctx.scopes.includes(t.scope))
          .map(t => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
      });

    case 'tools/call': {
      const name = String(rpc.params?.name ?? '');
      const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = toolByName(name);
      if (!tool) return error(id, ERR.INVALID_PARAMS, `Unknown tool: ${name}`);
      if (!ctx.scopes.includes(tool.scope)) {
        return error(id, ERR.INVALID_PARAMS, `This connection was not granted the "${tool.scope}" scope.`);
      }

      try {
        const value = await tool.handler(args, ctx);
        return result(id, {
          content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          structuredContent: value,
        });
      } catch (err) {
        // The detail stays in the server log: messages from the data layer can
        // name config and internals ("PLATFORM_JWT_SECRET is not set").
        console.error('[mcp] tool failed', name, err);
        return result(id, {
          isError: true,
          content: [{ type: 'text', text: `The ${name} tool failed. Try again shortly.` }],
        });
      }
    }

    default:
      return error(id, ERR.METHOD_NOT_FOUND, `Method not supported: ${rpc.method}`);
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return unauthorized();

  // Workspace API keys (Settings → API) are accepted alongside OAuth tokens.
  const key = token.startsWith('ml_live_') ? await resolveApiKey(token) : null;
  const bearer = key ? { ...key, tokenId: key.keyId } : await verifyBearer(token);
  if (!bearer) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(error(null, ERR.PARSE, 'Request body is not valid JSON.'), { status: 400 });
  }

  const items = Array.isArray(body) ? body.length : 1;
  if (items > MAX_BATCH) {
    return NextResponse.json(error(null, ERR.INVALID_REQUEST, `Batches are limited to ${MAX_BATCH} requests.`), { status: 400 });
  }
  // Free API: a burst limit plus daily fair-use caps per workspace, user and IP.
  // Each tool call in a batch spends one hit, so a batch cannot multiply the
  // limit; a request with no tool call (handshake, ping) spends only one burst
  // hit and nothing from the daily caps.
  const calls = (Array.isArray(body) ? body : [body])
    .filter(i => (i as RpcRequest)?.method === 'tools/call').length;
  const quotas = FAIR_USE.mcp(bearer.workspaceId, bearer.userId, clientIp(req.headers));
  const limit = await spendQuotas(calls ? quotas : quotas.slice(0, 1), Math.max(1, calls));
  if (!limit.allowed) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: ERR.INTERNAL, message: `Rate limit exceeded. ${quotaWait(limit)}` } },
      { status: 429, headers: quotaHeaders(limit) },
    );
  }

  const ctx = {
    workspaceId: bearer.workspaceId,
    userId: bearer.userId,
    scopes: bearer.scopes,
    tokenId: bearer.tokenId,
  };

  // A batch is an array of requests; responses omit notifications.
  const batch = Array.isArray(body) ? body : [body];
  if (!batch.length) return NextResponse.json(error(null, ERR.INVALID_REQUEST, 'Empty batch.'), { status: 400 });

  const responses = [];
  for (const item of batch) {
    const rpc = item as RpcRequest;
    if (!rpc || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
      responses.push(error((rpc as RpcRequest)?.id ?? null, ERR.INVALID_REQUEST, 'Not a valid JSON-RPC 2.0 request.'));
      continue;
    }
    try {
      const res = await dispatch(rpc, ctx);
      if (res) responses.push(res);
    } catch (err) {
      console.error('[mcp] dispatch failed', rpc.method, err);
      responses.push(error(rpc.id ?? null, ERR.INTERNAL, 'Internal error.'));
    }
  }

  // Notification-only payloads get 202 with no body, per the transport spec.
  if (!responses.length) return new NextResponse(null, { status: 202 });

  return NextResponse.json(Array.isArray(body) ? responses : responses[0], {
    headers: { 'Cache-Control': 'no-store', ...quotaHeaders(limit) },
  });
}

// Clients probe with GET to see whether a server-initiated SSE stream exists.
// This server does not push, so it declines rather than holding a dead stream.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
