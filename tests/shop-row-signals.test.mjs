// Shops explorer row signals (lib/market/row-signals.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRowSignals, applyRowSignals } from '../lib/market/row-signals.ts';

test('shares become percentages; bad codes and empty shares are dropped', () => {
  const s = parseRowSignals({
    visitor_countries: [{ code: 'us', share: 0.5409 }, { code: 'XXX', share: 0.1 }, { code: 'GB', share: 0 }],
    active_creatives: 128, targeted_countries: [{ code: 'US', ads: 96 }, { code: 'CA', ads: 32 }],
  });
  assert.deepEqual(s.visitorCountries, [{ code: 'US', pct: 54.1 }]);
  assert.deepEqual(s.targetedCountries, [{ code: 'US', pct: 75 }, { code: 'CA', pct: 25 }]);
});

const SEP19 = Date.parse('2026-09-19T12:00:00Z');

test('crawl-gap zeros are dropped from a running-ads series; an all-zero series stays', () => {
  const gap = parseRowSignals({ live_ads_history: [{ date: '2026-09-14', ads: 344 }, { date: '2026-09-16', ads: 0 }, { date: '2026-09-18', ads: 490 }] }, SEP19);
  assert.deepEqual(gap.liveAds.map(p => p.v), [344, 490]);
  const flat = parseRowSignals({ live_ads_history: [{ date: '2026-09-14', ads: 0 }, { date: '2026-09-18', ads: 0 }] }, SEP19);
  assert.deepEqual(flat.liveAds.map(p => p.v), [0, 0]);
});

test('a running-ads series that stopped days ago is not drawn as current', () => {
  const series = { live_ads_history: [{ date: '2026-09-25', ads: 12 }, { date: '2026-09-26', ads: 14 }] };
  assert.equal(parseRowSignals(series, Date.parse('2026-09-29T23:00:00Z')).liveAds.length, 2);
  assert.equal(parseRowSignals(series, Date.parse('2026-10-03T12:00:00Z')).liveAds.length, 0);
});

test('traffic history replaces the series only for a SimilarWeb-measured store', () => {
  const sig = parseRowSignals({ traffic_history: [{ month: '2026-07', visits: 2 }, { month: '2026-06', visits: 1 }], screenshot_url: 'http://insecure' });
  assert.deepEqual(sig.trafficHistory.map(p => p.t), ['2026-06', '2026-07']);
  assert.equal(sig.screenshot, '');
  const base = { trafficSeries: [], visitorCountries: [], liveAdsSeries: [], targetedCountries: [], screenshot: '' };
  assert.equal(applyRowSignals({ ...base, trafficSource: 'similarweb' }, sig).trafficSeries.length, 2);
  assert.equal(applyRowSignals({ ...base, trafficSource: 'index' }, sig).trafficSeries.length, 0);
});
