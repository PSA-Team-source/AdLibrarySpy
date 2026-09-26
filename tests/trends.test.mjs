// /trends rules: what counts as a breakout, how niches rank. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBreakout, rankNiches, nicheHref, growthLabel, parseBand } from '../lib/trends.ts';

test('isBreakout: measured growth from a real base, below the first-reading ceiling', () => {
  assert.equal(isBreakout({ visits: 384_605, prevVisits: 35_594, growthPct: 980.53 }, 100_000), true);
  // SimilarWeb's first reading of a host (42 → 62,501) is not a trend.
  assert.equal(isBreakout({ visits: 144_067, prevVisits: 97, growthPct: 148_422 }, 100_000), false);
  assert.equal(isBreakout({ visits: 150_000, prevVisits: 9_999, growthPct: 900 }, 100_000), false);
  assert.equal(isBreakout({ visits: 99_999, prevVisits: 50_000, growthPct: 100 }, 100_000), false);
  assert.equal(isBreakout({ visits: 500_000, prevVisits: 600_000, growthPct: -16.7 }, 100_000), false);
  assert.equal(isBreakout({ visits: 500_000, prevVisits: 400_000, growthPct: null }, 100_000), false);
  assert.equal(isBreakout(null, 100_000), false);
});

test('rankNiches: share of measured stores, thin niches dropped', () => {
  const row = (id, measured, breakout) => ({ id, name: id, parentId: 'p', parentName: 'P', measured, breakout });
  const out = rankNiches([row('big', 8057, 1953), row('hot', 4293, 1212), row('thin', 403, 126), row('flat', 900, 0), row('bad', 600, 700)]);
  assert.deepEqual(out.map(n => n.id), ['hot', 'big']);
  assert.ok(Math.abs(out[0].share - 1212 / 4293) < 1e-9);
  assert.equal(rankNiches([row('a', 1000, 100), row('b', 1000, 100), row('c', 1000, 90)], 2).length, 2);
});

test('nicheHref opens the same filter on /shops', () => {
  assert.equal(nicheHref({ id: '4175', parentId: '4076' }), '/shops?category=4076&subcategory=4175&traffic=10k&growth=50&sort=growth');
});

test('growthLabel / parseBand', () => {
  assert.equal(growthLabel(980.53), '+981%');
  assert.equal(growthLabel(1234.4), '+1,234%');
  assert.equal(growthLabel(64.24), '+64.2%');
  assert.equal(parseBand('1m'), '1m');
  assert.equal(parseBand('x'), '100k');
  assert.equal(parseBand(undefined), '100k');
});
