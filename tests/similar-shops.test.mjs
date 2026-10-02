// Similar-shop ranking (lib/market/similar-rank.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSimilar } from '../lib/market/similar-rank.ts';

const s = (id, country, visits, source = 'similarweb', niches = ['Apparel']) =>
  ({ id, domain: `${id}.com`, country, monthlyVisits: visits, trafficSource: source, niches });

test('category, then home country, then closest traffic; self and unmeasured dropped', () => {
  const me = s('me', 'US', 2_100);
  const pool = [
    s('big-us', 'US', 3_700_000), s('near-in', 'IN', 2_000), s('near-us', 'US', 5_000),
    s('far-us', 'US', 40_000), s('est', 'US', 2_100, 'index'), s('none', 'US', 0),
    s('me', 'US', 2_100), s('other-cat', 'US', 2_100, 'similarweb', ['Toys']),
  ];
  assert.deepEqual(rankSimilar(me, pool, 10).map(x => x.id),
    ['near-us', 'far-us', 'big-us', 'near-in', 'other-cat']);
});

test('main visitor country counts as home', () => {
  const me = { ...s('me', '', 2_100), visitorCountries: [{ code: 'IN', pct: 60 }] };
  assert.equal(rankSimilar(me, [s('a', 'US', 2_000), s('b', 'IN', 9_000)], 1)[0].id, 'b');
});
