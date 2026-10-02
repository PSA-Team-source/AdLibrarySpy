// Retention day gate (lib/active-days-gate.ts) and Start here rules (lib/start-here.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeDayGate, utcDay } from '../lib/active-days-gate.ts';
import { needsStartHere, pickStarters } from '../lib/start-here.ts';

test('one write per user per UTC day; a failed write is retried', () => {
  const g = activeDayGate();
  assert.equal(g.take('u1', '2026-10-01'), true);
  assert.equal(g.take('u1', '2026-10-01'), false);
  assert.equal(g.take('u2', '2026-10-01'), true);
  g.release('u2');
  assert.equal(g.take('u2', '2026-10-01'), true);
  assert.equal(g.take('u1', '2026-10-02'), true);
  assert.equal(utcDay(new Date('2026-10-01T23:59:59-05:00')), '2026-10-02');
});

test('Start here shows until 3 things opened or one store tracked', () => {
  assert.equal(needsStartHere({ shop: 0, ad: 0, advertiser: 0 }, 0), true);
  assert.equal(needsStartHere({ shop: 1, ad: 1, advertiser: 0 }, 0), true);
  assert.equal(needsStartHere({ shop: 1, ad: 1, advertiser: 1 }, 0), false);
  assert.equal(needsStartHere({ shop: 0, ad: 0, advertiser: 0 }, 1), false);
});

test('starters keep order, skip stores without ads or id, never pad', () => {
  const s = (id, metaAds) => ({ id, name: id, domain: `${id}.com`, logo: '', metaAds, monthlyVisits: 0, trafficSource: null });
  assert.deepEqual(pickStarters([s('a', 5), s('', 9), s('b', 0), s('c', 2), s('d', 1), s('e', 7)]).map(x => x.id), ['a', 'c', 'd']);
  assert.deepEqual(pickStarters([s('a', 0)]), []);
});

import { favouriteNiche } from '../lib/start-here.ts';
{
  const a = (await import('node:assert/strict')).default;
  a.equal(favouriteNiche([]), null);
  a.equal(favouriteNiche([{ niches: [] }]), null);
  a.equal(favouriteNiche([{ niches: ['Health'] }, { niches: ['Beauty'] }, { niches: ['Health', 'Beauty'] }]), 'Health');
  a.equal(favouriteNiche([{ niches: ['Beauty'] }, { niches: ['Health'] }]), 'Beauty'); // tie → most recent
}
