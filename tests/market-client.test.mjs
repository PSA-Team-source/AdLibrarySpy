// lib/market/client.ts must ride out a Go API restart. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketRequest, MarketError } from '../lib/market/client.ts';

const clock = () => { let t = 0; return { now: () => t, sleep: async ms => { t += ms; } }; };
const refused = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
const ok = body => new Response(JSON.stringify(body), { status: 200 });

test('retries through a restart window until the API is back', async () => {
  const c = clock(); let calls = 0;
  const fetchImpl = async () => { calls++; if (c.now() < 12_000) throw refused(); return ok({ data: 1 }); };
  assert.deepEqual(await marketRequest('GET', '/t1', {}, { fetchImpl, ...c }), { data: 1 });
  assert.ok(calls > 3);
});

test('serves the last good copy when the API stays down', async () => {
  const c = clock();
  await marketRequest('GET', '/t2', {}, { fetchImpl: async () => ok({ v: 'good' }), ...c });
  const down = async () => { throw refused(); };
  assert.deepEqual(await marketRequest('GET', '/t2', {}, { fetchImpl: down, ...c }), { v: 'good' });
  assert.ok(c.now() <= 2_500, 'stale copy is served after the short budget');
});

test('4xx is a real answer: thrown at once, no retry, no stale', async () => {
  const c = clock(); let calls = 0;
  await marketRequest('GET', '/t3', {}, { fetchImpl: async () => ok({}), ...c });
  const nf = async () => { calls++; return new Response('', { status: 404 }); };
  await assert.rejects(marketRequest('GET', '/t3', {}, { fetchImpl: nf, ...c }), e => e instanceof MarketError && e.status === 404);
  assert.equal(calls, 1);
});

test('no copy + down past the budget throws (page shows its error state)', async () => {
  const c = clock();
  await assert.rejects(marketRequest('GET', '/t4', {}, { fetchImpl: async () => { throw refused(); }, ...c }));
  assert.ok(c.now() >= 20_000);
});
