// Alerts digest logic (lib/alerts/digest.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuery, newResultIds, mergeSeen, periodFor, trackerLines, buildDigest, marketPicks, topNiches, productPicks, effectiveFrequency, QUIET_AFTER } from '../lib/alerts/digest.ts';
import { marketingEnvelopes } from '../lib/mail.ts';
import { unsubscribeToken, verifyUnsubscribe } from '../lib/weekly/unsubscribe.ts';

const delta = (o) => ({ visits: null, visitsPct: null, liveAds: 0, liveAdsPct: null, newAds: 0, products: 0, ...o });

test('the same filters normalize to one saved search', () => {
  assert.equal(normalizeQuery('?page=3&q=shoes&country=US&ref=x&utm_source=a&tech='), 'country=US&q=shoes');
  assert.equal(normalizeQuery('q=shoes&country=US'), normalizeQuery('country=US&q=shoes&page=1'));
  assert.equal(normalizeQuery('page=2'), '');
});

test('unseeded searches report nothing; seeded ones only unseen ids', () => {
  assert.deepEqual(newResultIds(['a', 'b'], null), []);
  assert.deepEqual(newResultIds(['a', 'b', 'c'], ['b']), ['a', 'c']);
  assert.deepEqual(mergeSeen(['x', 'y'], ['a', 'x'], 3), ['a', 'x', 'y']);
});

test('weekly digests are due on Mondays only; off never', () => {
  assert.equal(periodFor('daily', '2026-09-27', '2026-w39', false), 'd:2026-09-27');
  assert.equal(periodFor('weekly', '2026-09-27', '2026-w39', false), null);
  assert.equal(periodFor('weekly', '2026-09-28', '2026-w40', true), 'w:2026-w40');
  assert.equal(periodFor('off', '2026-09-28', '2026-w40', true), null);
});

test('only material tracker moves become lines', () => {
  assert.deepEqual(trackerLines(delta({})), []);
  assert.deepEqual(trackerLines(delta({ visits: 50, visitsPct: 5 })), []);          // under the threshold
  assert.deepEqual(trackerLines(delta({ visits: null, visitsPct: null, liveAds: null, liveAdsPct: null, newAds: null, products: null })), []);
  assert.deepEqual(trackerLines(delta({ newAds: 3, liveAds: -2, liveAdsPct: -66.7, visits: 1200, visitsPct: 12.5, products: 4 })),
    ['3 new ads launched', 'Live ads −2 (−66.7%)', 'Monthly visits +1,200 (+12.5%)', '4 new products']);
  // Live ads: a 50%+ jump is news, a small swing is not, starting from zero is.
  assert.deepEqual(trackerLines(delta({ liveAds: 10, liveAdsPct: 50 })), ['Live ads +10 (+50%)']);
  assert.deepEqual(trackerLines(delta({ liveAds: 4, liveAdsPct: 20 })), []);
  assert.deepEqual(trackerLines(delta({ liveAds: 6, liveAdsPct: null })), ['Live ads +6 (went live)']);
});

test('no change means no email', () => {
  assert.equal(buildDigest({ app: 'https://x.test', frequency: 'weekly', brands: [{ shopId: 's', name: 'S', domain: 's.com', lines: [] }], searches: [] }), null);
});

test('a digest escapes merchant text and links into the app', () => {
  const d = buildDigest({
    app: 'https://x.test/', frequency: 'daily',
    brands: [{ shopId: 'shp_1', name: '<b>Evil</b>', domain: 'evil.com', lines: ['1 new ad launched'] }],
    searches: [{ id: '1', name: 'Pets', kind: 'shops', query: 'q=pet', total: 1, items: [{ title: 'Pet Co', subtitle: 'pet.co', href: '/shops/shp_2' }] }],
  });
  assert.ok(d);
  assert.equal(d.subject, '1 tracked brand moved, 1 new result in your saved searches');
  assert.ok(d.body.includes('&lt;b&gt;Evil&lt;/b&gt;') && !d.body.includes('<b>Evil'));
  assert.ok(d.body.includes('https://x.test/shops/shp_1?ref=alerts:daily'));
  assert.ok(d.body.includes('https://x.test/shops/shp_2?ref=alerts:daily'));
});

test('an alerts unsubscribe link cannot unsubscribe the newsletter, or the reverse', () => {
  process.env.SESSION_SECRET ||= 'test'.repeat(8);
  const id = '00000000-0000-4000-8000-000000000001';
  assert.ok(verifyUnsubscribe(id, unsubscribeToken(id, 'alerts'), 'alerts'));
  assert.ok(!verifyUnsubscribe(id, unsubscribeToken(id, 'alerts'), 'newsletter'));
  assert.ok(!verifyUnsubscribe(id, unsubscribeToken(id), 'alerts'));
});

const mover = (name, jump, o = {}) => ({ shopId: `shp_${name}`, name, domain: `${name}.com`, logo: '', niches: ['Beauty'], before: 1000, after: 1000 + jump, jump, ...o });

test('market: niche first when it has enough movers, else overall; weak days are skipped', () => {
  const movers = [mover('a', 300, { niches: ['Pets'] }), mover('b', 250), mover('c', 200), mover('d', 150), mover('e', 90)];
  assert.equal(marketPicks(movers, ['Beauty']).niche, 'Beauty');
  assert.deepEqual(marketPicks(movers, ['Beauty']).items.map(m => m.name), ['b', 'c', 'd']);   // e is under the floor
  assert.equal(marketPicks(movers, ['Pets']).niche, null);                                   // 1 pet mover: overall instead
  assert.equal(marketPicks([mover('a', 300), mover('b', 99)], []), null);
  assert.deepEqual(topNiches([['Pets', 'Pets'], ['Beauty'], ['Pets']]), ['Pets', 'Beauty']);
});

test('a market-only digest names its top mover and never draws a missing logo', () => {
  const d = buildDigest({ app: 'https://x.test', frequency: 'daily', brands: [], searches: [],
    market: { niche: null, items: [mover('ryze', 298, { logo: 'https://cdn.x/l.png' }), mover('nologo', 200)] } });
  assert.equal(d.subject, 'Ryze added 298 live Meta ads yesterday');
  assert.equal((d.body.match(/<img /g) || []).length, 1);
});

test('marketing envelope: news subdomain, root alias, then the mailbox; refusals skipped 10 min', () => {
  assert.deepEqual(marketingEnvelopes('no-reply@adlibraryspy.com', 0, new Map()),
    ['mkt-bounce.no-reply@news.adlibraryspy.com', 'mkt-bounce.no-reply@adlibraryspy.com', 'no-reply@adlibraryspy.com']);
  const refused = new Map([['mkt-bounce.no-reply@news.adlibraryspy.com', 1_000]]);
  assert.deepEqual(marketingEnvelopes('no-reply@adlibraryspy.com', 1_000 + 60_000, refused),
    ['mkt-bounce.no-reply@adlibraryspy.com', 'no-reply@adlibraryspy.com']);
  assert.equal(marketingEnvelopes('no-reply@adlibraryspy.com', 1_000 + 600_000, refused)[0], 'mkt-bounce.no-reply@news.adlibraryspy.com');
});

test('products follow the user\'s niche history; quiet default-daily users go weekly', () => {
  const p = (t, niches) => ({ title: t, image: '', shopId: t, storeName: t, domain: `${t}.com`, newAds: 20, from: '2026-10-01', to: '2026-10-02', niches });
  const pool = [p('a', ['Beauty']), p('b', ['Pets']), p('c', ['Pets']), p('d', ['Pets']), p('e', ['Beauty'])];
  assert.deepEqual(productPicks(pool, ['Pets']).items.map(x => x.title), ['b', 'c', 'd']);
  assert.equal(productPicks(pool, ['Pets']).niche, 'Pets');
  const fallback = productPicks(pool, ['Beauty', 'Toys']);   // 2 Beauty < min rows → overall top
  assert.equal(fallback.niche, null);
  assert.equal(fallback.items[0].title, 'a');
  assert.equal(effectiveFrequency('daily', false, QUIET_AFTER), 'weekly');
  assert.equal(effectiveFrequency('daily', false, QUIET_AFTER - 1), 'daily');
  assert.equal(effectiveFrequency('daily', true, 99), 'daily');   // an explicit choice is kept
  const d = buildDigest({ app: 'https://x', frequency: 'daily', brands: [], searches: [], products: pool.slice(1, 4), productsNiche: 'Pets' });
  assert.match(d.subject, /^Pets: b got/);
  assert.match(d.body, /track=1/);
});
