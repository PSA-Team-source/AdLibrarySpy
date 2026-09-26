#!/usr/bin/env node
// AdLibrarySpy MCP server (stdio). Newline-delimited JSON-RPC 2.0 on stdin/stdout;
// logs go to stderr so they never corrupt the protocol stream.
//
// Without a key: three tools that need no account (inspect a live storefront,
// the public index card, the weekly report). With ADLIBRARYSPY_API_KEY: those
// plus every tool the hosted server grants the key, proxied to
// https://adlibraryspy.com/api/mcp.
import { createInterface } from 'node:readline';
import { LOCAL_TOOLS } from './tools.js';
import { HostedClient } from './hosted.js';

const VERSION = '1.0.0';
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

const hosted = process.env.ADLIBRARYSPY_API_KEY
  ? new HostedClient(process.env.ADLIBRARYSPY_API_KEY, process.env.ADLIBRARYSPY_URL)
  : null;

const INSTRUCTIONS = [
  'AdLibrarySpy: intelligence on Shopify stores and their ads.',
  'inspect_store reads a store\'s own live storefront (theme, best sellers, newest products, prices, apps, pixels).',
  'lookup_store returns the AdLibrarySpy index card (SimilarWeb-measured traffic with its month, live Meta ad count, niche).',
  'weekly_report returns this week\'s fastest-growing stores, ad peaks and products.',
  hosted
    ? 'The remaining tools query the full index: search_shops, get_shop, search_ads, creative_breakdown and the workspace brandtracker.'
    : 'Set ADLIBRARYSPY_API_KEY (free at https://adlibraryspy.com/settings/api) to also search 1M+ stores and their ad creatives.',
  'Values are null when nothing measured them: treat null as "not measured", never as zero.',
].join(' ');

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const toolResult = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value });

async function listTools() {
  const local = LOCAL_TOOLS.map(({ handler, ...t }) => t);
  if (!hosted) return local;
  try {
    return [...local, ...(await hosted.tools())];
  } catch (err) {
    console.error(`[adlibraryspy-mcp] hosted tools unavailable: ${err.message}`);
    return local;
  }
}

async function dispatch(msg) {
  const id = msg.id ?? null;
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params?.protocolVersion;
      return ok(id, {
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'adlibraryspy', title: 'AdLibrarySpy', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: await listTools() });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = msg.params?.arguments ?? {};
      const local = LOCAL_TOOLS.find(t => t.name === name);
      try {
        if (local) return ok(id, toolResult(await local.handler(args)));
        if (hosted) return ok(id, await hosted.call(name, args));
        return fail(id, -32602, `Unknown tool: ${name}. Set ADLIBRARYSPY_API_KEY to use the hosted index tools.`);
      } catch (err) {
        return ok(id, { isError: true, content: [{ type: 'text', text: `${name} failed: ${err.message}` }] });
      }
    }
    default:
      if (msg.id === undefined) return null; // notifications expect no reply
      return fail(id, -32601, `Method not supported: ${msg.method}`);
  }
}

const send = obj => process.stdout.write(`${JSON.stringify(obj)}\n`);

createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', async line => {
  if (!line.trim()) return;
  let body;
  try {
    body = JSON.parse(line);
  } catch {
    return send(fail(null, -32700, 'Parse error'));
  }
  const batch = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const msg of batch) {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      // A response to a server-initiated request carries no method; this server sends none.
      if (msg && (msg.result !== undefined || msg.error !== undefined)) continue;
      replies.push(fail(msg?.id ?? null, -32600, 'Invalid Request'));
      continue;
    }
    const r = await dispatch(msg).catch(err => fail(msg.id ?? null, -32603, err.message));
    if (r) replies.push(r);
  }
  if (replies.length) send(Array.isArray(body) ? replies : replies[0]);
});

console.error(`[adlibraryspy-mcp] ${VERSION} ready (${hosted ? 'with hosted index' : 'keyless: 3 tools'})`);
