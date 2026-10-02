// Email click tracking (lib/email/click.ts) and the digest's winning-products /
// activation-nudge sections (lib/alerts/digest.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.SESSION_SECRET ||= 'test-secret-0123456789abcdef';
const { clickUrl, verifiedClicker, safePath, trackLinks } = await import('../lib/email/click.ts');
const { buildDigest, pickSuggestions, dayRange } = await import('../lib/alerts/digest.ts');

const APP = 'https://adlibraryspy.com';
const U = '2c565e61-9411-4e53-80fc-ccbe0b05ff9f';

test('click links stay on the site and are signed for one user', () => {
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '/a\nb', null]) assert.equal(safePath(bad), null);
  const href = clickUrl(APP, `${APP}/shops/shp_1?ref=alerts:daily`, 'alerts:daily', U);
  const u = new URL(href);
  assert.equal(u.origin + u.pathname, `${APP}/r`);
  const to = u.searchParams.get('to');
  assert.equal(to, '/shops/shp_1?ref=alerts:daily');
  assert.equal(verifiedClicker(U, 'alerts:daily', to, u.searchParams.get('s')), U);
  assert.equal(verifiedClicker(U, 'alerts:weekly', to, u.searchParams.get('s')), null);      // campaign swapped
  assert.equal(verifiedClicker(U, 'alerts:daily', '/home', u.searchParams.get('s')), null);  // destination swapped
  assert.equal(clickUrl(APP, 'https://evil.com/x', 'alerts:daily', U), 'https://evil.com/x'); // foreign links untouched
});

test('trackLinks rewrites page links, never unsubscribe or foreign ones', () => {
  const html = `<a href="${APP}/shops?a=1&amp;ref=x">s</a><a href="${APP}/api/newsletter/unsubscribe?u=1">u</a><a href="https://x.com/">x</a>`;
  const out = trackLinks(html, APP, 'weekly:2026-w40', U);
  assert.match(out, /href="https:\/\/adlibraryspy\.com\/r\?to=%2Fshops%3Fa%3D1%26ref%3Dx&amp;c=weekly%3A2026-w40/);
  assert.ok(out.includes(`href="${APP}/api/newsletter/unsubscribe?u=1"`));
  assert.ok(out.includes('href="https://x.com/"'));
});

const prod = (i, image = '') => ({ title: `Product ${i}`, image, shopId: `shp_${i}`, storeName: `Store ${i}`, domain: `s${i}.com`, newAds: 40 - i, from: '2026-09-29', to: '2026-09-30' });

test('winning products fill a quiet day; never pad, never beat personal news', () => {
  const three = [prod(1, 'https://cdn.x/p.jpg'), prod(2), prod(3)];
  const d = buildDigest({ app: APP, frequency: 'daily', brands: [], searches: [], products: three });
  assert.ok(d);
  assert.match(d.body, /Winning products today/);
  assert.match(d.body, /Sep 29–30/);
  assert.equal((d.body.match(/<img /g) || []).length, 1);                 // only the real image
  assert.match(d.subject, /Product 1 got 39 new Meta ads in 2 days/);
  assert.equal(buildDigest({ app: APP, frequency: 'daily', brands: [], searches: [], products: three.slice(0, 2) }), null);
  // A nudge alone is never a reason to send.
  assert.equal(buildDigest({ app: APP, frequency: 'daily', brands: [], searches: [], nudge: { suggestions: [{ shopId: 'shp_9', name: 'Nine' }] } }), null);
  const personal = buildDigest({ app: APP, frequency: 'daily', brands: [{ shopId: 'shp_1', name: 'A', domain: 'a.com', lines: ['3 new ads launched'] }], searches: [], products: three });
  assert.doesNotMatch(personal.body, /Winning products/);
});

test('nudge suggests up to 3 viewed, untracked stores; none viewed = a plain link', () => {
  const v = ['a', 'b', 'a', 'c', 'd', 'e'].map(x => ({ shopId: `shp_${x}`, name: x.toUpperCase() }));
  assert.deepEqual(pickSuggestions(v, ['shp_b']).map(s => s.shopId), ['shp_a', 'shp_c', 'shp_d']);
  const three = [prod(1), prod(2), prod(3)];
  const withViews = buildDigest({ app: APP, frequency: 'daily', brands: [], searches: [], products: three, nudge: { suggestions: pickSuggestions(v) } });
  assert.match(withViews.body, /Track a competitor to get alerts when they launch products or ads/);
  assert.match(withViews.body, /shops\/shp_a\?track=1&ref=alerts:daily/);
  const noViews = buildDigest({ app: APP, frequency: 'daily', brands: [], searches: [], products: three, nudge: { suggestions: [] } });
  assert.doesNotMatch(noViews.body, /Stores you looked at/);
  assert.equal(dayRange('2026-09-30', '2026-10-01'), 'Sep 30 – Oct 1');
});
