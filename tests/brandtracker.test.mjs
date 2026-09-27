// Brandtracker window deltas (lib/tracker-window.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowDelta } from '../lib/tracker-window.ts';

const snap = (o) => ({ monthlyVisits: 1000, liveAds: 10, productCount: 5, avgPrice: 20, monthlyVisitsSource: 'similarweb', creatives: 100, ...o });

test('no baseline in the window -> no delta at all', () => {
  assert.deepEqual(windowDelta(snap({}), null), { visits: null, visitsPct: null, liveAds: null, newAds: null, products: null });
});

test('visits, live ads and new creatives are diffed against the baseline', () => {
  const d = windowDelta(snap({ monthlyVisits: 1500, liveAds: 7, creatives: 130, productCount: 8 }), snap({}));
  assert.deepEqual(d, { visits: 500, visitsPct: 50, liveAds: -3, newAds: 30, products: 3 });
});

test('a change of traffic source is not reported as growth', () => {
  const d = windowDelta(snap({ monthlyVisits: 9000 }), snap({ monthlyVisitsSource: 'index' }));
  assert.equal(d.visits, null);
  assert.equal(d.visitsPct, null);
});

test('snapshots without a creative count give no New Ads figure', () => {
  assert.equal(windowDelta(snap({}), snap({ creatives: undefined })).newAds, null);
  assert.equal(windowDelta(snap({ creatives: 90 }), snap({})).newAds, 0);
});
