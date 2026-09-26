// Drives the stdio server as a client would. No network: only protocol paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

function session(env = {}) {
  const env2 = { ...process.env, ...env };
  delete env2.ADLIBRARYSPY_API_KEY;
  const p = spawn(process.execPath, [new URL('./server.js', import.meta.url).pathname], { env: { ...env2, ...env } });
  const lines = createInterface({ input: p.stdout });
  const queue = [];
  lines.on('line', l => queue.shift()?.(JSON.parse(l)));
  return {
    send: msg => new Promise(r => { queue.push(r); p.stdin.write(`${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`); }),
    notify: msg => p.stdin.write(`${JSON.stringify(msg)}\n`),
    close: () => p.kill(),
  };
}

test('keyless handshake, tool list and errors', async () => {
  const s = session();
  try {
    const init = await s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {} } });
    assert.equal(init.result.protocolVersion, '2025-03-26');
    assert.equal(init.result.serverInfo.name, 'adlibraryspy');
    s.notify({ jsonrpc: '2.0', method: 'notifications/initialized' }); // must produce no reply

    const list = await s.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.deepEqual(list.result.tools.map(t => t.name), ['inspect_store', 'lookup_store', 'weekly_report']);
    for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object');

    const unknown = await s.send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_ads', arguments: {} } });
    assert.match(unknown.error.message, /ADLIBRARYSPY_API_KEY/);

    const bad = await s.send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'lookup_store', arguments: { domain: 'localhost' } } });
    assert.equal(bad.result.isError, true);

    assert.equal((await s.send('{not json')).error.code, -32700);
    assert.equal((await s.send({ jsonrpc: '2.0', id: 5, method: 'nope' })).error.code, -32601);
    const batch = await s.send([{ jsonrpc: '2.0', id: 6, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }]);
    assert.deepEqual(batch, [{ jsonrpc: '2.0', id: 6, result: {} }]);
  } finally {
    s.close();
  }
});
