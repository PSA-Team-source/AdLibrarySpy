// /SKILL.md must only name MCP tools that exist, or agents call tools that 404. `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../app/SKILL.md/route.ts', import.meta.url), 'utf8');
const tools = new Set([...readFileSync(new URL('../lib/mcp/tools.ts', import.meta.url), 'utf8')
  .matchAll(/^\s{4}name: '([a-z_]+)'/gm)].map(m => m[1]));

test('every tool in the SKILL.md table is a hosted MCP tool, and every tool is listed', () => {
  const named = new Set([...skill.matchAll(/^\| (.+?) \|/gm)].flatMap(m => [...m[1].matchAll(/\\`([a-z_]+)\\`/g)].map(x => x[1])));
  assert.ok(tools.size >= 10, 'parsed the tool list');
  for (const n of named) assert.ok(tools.has(n), `SKILL.md names unknown tool ${n}`);
  for (const t of tools) assert.ok(named.has(t), `SKILL.md is missing tool ${t}`);
});

test('the app announcement points agents at /SKILL.md', () => {
  const site = readFileSync(new URL('../lib/public/site.ts', import.meta.url), 'utf8');
  assert.match(site, /AGENT_MESSAGE = "Read https:\/\/adlibraryspy\.com\/SKILL\.md and follow it/);
});
