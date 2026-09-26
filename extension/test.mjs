// Extension + public store API helpers: pure logic, no network. `node --test extension/test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// extension/lib.js is an ES module for Chrome; load it as one without a package.json type.
const src = readFileSync(new URL('./lib.js', import.meta.url), 'utf8');
const ext = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
// The CLI's normaliser is the same contract as the server's.
const { normaliseDomain } = await import('../packages/shopify-inspect/parse.js');

test('server normaliser: accepts pasted URLs and bare hosts', () => {
  assert.equal(normaliseDomain('fashionnova.com'), 'fashionnova.com');
  assert.equal(normaliseDomain('  HTTPS://WWW.FashionNova.com/products/x?y=1#z '), 'fashionnova.com');
  assert.equal(normaliseDomain('shop.example-brand.co.uk:443/path'), 'shop.example-brand.co.uk');
  assert.equal(normaliseDomain('fashionnova.com.'), 'fashionnova.com');
  assert.equal(normaliseDomain('bücher.de'), 'xn--bcher-kva.de');
  assert.equal(normaliseDomain('user:pw@brand.com'), 'brand.com');
});

test('server normaliser: rejects anything that is not a public DNS name', () => {
  for (const bad of [null, undefined, 42, '', ' ', 'localhost', 'foo', '127.0.0.1', '[::1]', '10.0.0.1:5900',
    'a..com', '-bad.com', 'bad-.com', 'x.local', 'svc.internal', 'a.b.123', 'javascript:alert(1)',
    'a'.repeat(64) + '.com', ('a'.repeat(60) + '.').repeat(5) + 'com', 'file:///etc/passwd', 'brand.com%00.evil']) {
    assert.equal(normaliseDomain(bad), null, `should reject ${String(bad)}`);
  }
});

test('extension storeHost mirrors the server on page hostnames', () => {
  for (const h of ['www.fashionnova.com', 'gymshark.com', 'shop.brand.co.uk', 'xn--bcher-kva.de']) {
    assert.equal(ext.storeHost(h), normaliseDomain(h), h);
  }
  for (const h of ['localhost', '192.168.1.1', 'intranet', '', null]) assert.equal(ext.storeHost(h), null);
});

test('lookupHosts: page host first, then the myshopify name, no duplicates', () => {
  assert.deepEqual(ext.lookupHosts({ host: 'www.brand.com', myshopify: 'brand-2.myshopify.com' }), ['brand.com', 'brand-2.myshopify.com']);
  assert.deepEqual(ext.lookupHosts({ host: 'brand-2.myshopify.com', myshopify: 'brand-2.myshopify.com' }), ['brand-2.myshopify.com']);
  assert.deepEqual(ext.lookupHosts({ host: 'localhost', myshopify: null }), []);
});

function fakePage({ shopify, meta = {}, selectors = [] }) {
  globalThis.location = { hostname: 'www.brand.com' };
  globalThis.window = { Shopify: shopify };
  globalThis.document = {
    querySelector(sel) {
      if (sel.startsWith('meta[name="generator"')) return meta.generator ? { getAttribute: () => meta.generator } : null;
      if (sel.startsWith('meta[name^="shopify-"]')) return meta.shopifyMeta ? {} : null;
      return selectors.some(s => sel.includes(s)) ? {} : null;
    },
  };
}

test('detectShopify: window.Shopify runtime', () => {
  fakePage({ shopify: { shop: 'Brand.myshopify.com', theme: { name: 'Dawn' } } });
  assert.deepEqual(ext.detectShopify(), { host: 'www.brand.com', shopify: true, myshopify: 'brand.myshopify.com' });
});

test('detectShopify: DOM fallbacks, and a clean negative', () => {
  fakePage({ shopify: undefined, selectors: ['cdn.shopify.com'] });
  assert.equal(ext.detectShopify().shopify, true);
  fakePage({ shopify: undefined, meta: { generator: 'Shopify' } });
  assert.equal(ext.detectShopify().shopify, true);
  fakePage({ shopify: undefined, meta: { generator: 'WordPress 6.6' } });
  assert.deepEqual(ext.detectShopify(), { host: 'www.brand.com', shopify: false, myshopify: null });
});

test('detectShopify is self-contained (it is serialised into the tab)', () => {
  const body = ext.detectShopify.toString();
  for (const name of ['storeHost', 'SITE', 'REF', 'safeHttps']) assert.ok(!body.includes(name), name);
});

test('links carry the ext:chrome ref and only https survives', () => {
  assert.equal(ext.withRef('https://adlibraryspy.com/store/brand.com'), 'https://adlibraryspy.com/store/brand.com?ref=ext%3Achrome');
  assert.equal(ext.signupUrl('https://adlibraryspy.com/shops/shp_abc'), 'https://adlibraryspy.com/signup?next=%2Fshops%2Fshp_abc&ref=ext%3Achrome');
  assert.equal(ext.safeHttps('javascript:alert(1)'), null);
  assert.equal(ext.safeHttps('http://x.com/a.png'), null);
  assert.equal(ext.safeHttps('https://cdn.shopify.com/a.png'), 'https://cdn.shopify.com/a.png');
});

test('formatters never invent a value', () => {
  assert.equal(ext.growthLabel(null), null);
  assert.equal(ext.growthLabel(0.01), null);
  assert.equal(ext.growthLabel(-1.67), '-1.7%');
  assert.equal(ext.growthLabel(7), '+7.0%');
  assert.equal(ext.monthYear('2017-01-27'), 'Jan 2017');
  assert.equal(ext.monthYear(null), '');
  assert.equal(ext.flag('US'), '🇺🇸');
  assert.equal(ext.flag(''), '');
  assert.equal(ext.compact(39110028), '39.1M');
});
