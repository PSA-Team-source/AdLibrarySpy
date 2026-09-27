import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseDomain, parseTheme, parseLocale, parseHandles, detectTech, isShopifyHtml, priceStats, productFromJs, inspectStore } from './index.js';
import { CSV_COLUMNS, csvRow } from './csv.js';

test('domains are normalised and non-public names refused', () => {
  assert.equal(normaliseDomain('https://www.Allbirds.com/products/x?y=1'), 'allbirds.com');
  assert.equal(normaliseDomain('shop.example.co.uk.'), 'shop.example.co.uk');
  for (const bad of ['localhost', '127.0.0.1', 'foo.local', 'nodot', '', 'a..b.com', 'x.internal']) {
    assert.equal(normaliseDomain(bad), null, bad);
  }
});

test('theme is the schema name, not the merchant copy name', () => {
  assert.equal(parseTheme('Shopify.theme = {"name":"resilia-old\\/main","id":1,"schema_name":"Impulse","role":"main"};'), 'Impulse');
  assert.equal(parseTheme('Shopify.theme = {"name":"custom","schema_name":null};'), '');
  assert.equal(parseTheme('<html>'), '');
});

test('locale from Shopify.locale, else <html lang>', () => {
  assert.equal(parseLocale('Shopify.locale = "en";'), 'en');
  assert.equal(parseLocale('<html class="x" lang="de-DE">'), 'de-DE');
  assert.equal(parseLocale('<html>'), '');
});

test('handles follow collection order from <main>, deduped, menu links skipped', () => {
  const html = '<nav><a href="/products/menu-item">m</a></nav><main><a href="/collections/all/products/b-one?v=1">'
    + '<a href="/products/b-one"><a href="/products/two%C3%A9"><a href="/products/three#x"><a href="/products/%E0%A4%A"></main>';
  assert.deepEqual(parseHandles(html), ['b-one', 'twoé', 'three']);
  assert.deepEqual(parseHandles(html, 2), ['b-one', 'twoé']);
});

test('apps and pixels come from vendor hosts in the HTML', () => {
  const html = '<script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>'
    + '<script src="https://connect.facebook.net/en_US/fbevents.js"></script><script src="//cdn.judge.me/x.js">';
  assert.deepEqual(detectTech(html), { pixels: ['Meta Pixel'], apps: ['Klaviyo', 'Judge.me'] });
  assert.deepEqual(detectTech('<html></html>'), { pixels: [], apps: [] });
  assert.ok(isShopifyHtml('Shopify.shop = "x.myshopify.com";'));
  assert.ok(!isShopifyHtml('<html>wordpress</html>'));
});

test('price stats ignore unpriced rows; .js prices are minor units', () => {
  assert.deepEqual(priceStats([{ price: 10 }, { price: 30 }, { price: null }, { price: 20 }, { price: 40 }]),
    { sampled: 4, min: 10, median: 25, max: 40 });
  assert.equal(priceStats([{ price: null }]), null);
  assert.equal(productFromJs({ title: 'T', price: 1999 }, 'USD').price, 19.99);
});

test('inspectStore assembles a store from its own endpoints', async () => {
  const pages = {
    '/meta.json': { name: 'Demo', myshopify_domain: 'demo.myshopify.com', currency: 'EUR', published_products_count: 3 },
    '/': 'Shopify.theme = {"schema_name":"Dawn"}; Shopify.locale = "fr"; <script src="https://static.klaviyo.com/a.js">',
    '/collections/all?sort_by=best-selling': '<main><a href="/products/b"><a href="/products/far">',
    '/collections/all?sort_by=created-descending': '<main><a href="/products/a">',
    '/products.json?limit=250&currency=EUR': { products: [
      { handle: 'a', title: 'A', variants: [{ price: '10.00' }], created_at: '2026-09-01T00:00:00Z' },
      { handle: 'b', title: 'B', variants: [{ price: '30.00' }] },
    ] },
    '/products/far.js?currency=EUR': { handle: 'far', title: 'Far', price: 5000 },
  };
  const fetch = async url => {
    const u = new URL(url);
    const body = pages[u.pathname + u.search];
    return body === undefined
      ? { ok: false, status: 404 }
      : { ok: true, status: 200, json: async () => body, text: async () => body };
  };
  const s = await inspectStore('https://www.demo.shop', { fetch });
  assert.equal(s.shopify, true);
  assert.equal(s.theme, 'Dawn');
  assert.equal(s.locale, 'fr');
  assert.equal(s.productCount, 3);
  assert.deepEqual(s.bestSelling.map(p => [p.rank, p.title, p.price]), [[1, 'B', 30], [2, 'Far', 50]]);
  assert.deepEqual(s.newest.map(p => p.title), ['A']);
  assert.deepEqual(s.apps, ['Klaviyo']);
  assert.deepEqual(s.prices, { sampled: 2, min: 10, median: 20, max: 30 });
});

test('CSV rows escape RFC 4180 characters and join lists with semicolons', () => {
  const store = {
    domain: 'example.com',
    name: 'Demo, "Store"',
    shopify: true,
    theme: 'Dawn',
    currency: 'USD',
    locale: 'en-US',
    productCount: 10,
    prices: { min: 5, max: 100 },
    index: {
      traffic: { visits: 1234, sourceLabel: 'CrUX, monthly' },
      metaAds: { live: 7 },
      niche: ['Fashion', 'Beauty'],
    },
    pixels: ['Meta Pixel', 'Google'],
    apps: ['Klaviyo', 'Judge.me'],
  };

  assert.equal(
    CSV_COLUMNS.join(','),
    'domain,name,shopify,theme,currency,locale,productCount,priceMin,priceMax,visits,visitsSource,liveMetaAds,niche,pixels,apps',
  );

  assert.equal(
    csvRow(store),
    '"example.com","Demo, ""Store""","true","Dawn","USD","en-US","10","5","100","1234","CrUX, monthly","7","Fashion;Beauty","Meta Pixel;Google","Klaviyo;Judge.me"',
  );
});