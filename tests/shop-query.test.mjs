// /shops URL ⇄ filter (lib/market/shop-query.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrowthRules, formatGrowthRules, parseShopQuery, range } from '../lib/market/shop-query.ts';

test('growth rules round-trip and drop malformed parts', () => {
  const s = '1m:gt:20,and:6m:lt:-10,or:3m:gt:5.5';
  const rules = parseGrowthRules(s);
  assert.deepEqual(rules, [
    { period: '1m', direction: 'greater', value: 20, operator: 'AND' },
    { period: '6m', direction: 'lower', value: -10, operator: 'AND' },
    { period: '3m', direction: 'greater', value: 5.5, operator: 'OR' },
  ]);
  assert.equal(formatGrowthRules(rules), s);
  assert.deepEqual(parseGrowthRules('2m:gt:5,and:1m:xx:3,or:1m:lt:'), []);
  assert.deepEqual(parseGrowthRules('25'), []);
});

test('new range names, with the older names still read', () => {
  const now = Date.parse('2026-10-02T00:00:00Z');
  const f = parseShopQuery({ minTraffic: '10000', maxTraffic: '1000000', minProducts: '5', maxPrice: '80', minRating: '4.2',
    growth: '1m:gt:20', minDate: '2024-01-01', maxDate: '2024-12-31', plan: 'plus' }, now);
  assert.equal(f.trafficMin, 10_000); assert.equal(f.trafficMax, 1_000_000);
  assert.equal(f.productsMin, 5); assert.equal(f.avgPriceMax, 80); assert.equal(f.trustpilotScoreMin, 4.2);
  assert.equal(f.growthRules.length, 1); assert.equal(f.growthMin, undefined);
  assert.equal(f.createdAfter, '2024-01-01T00:00:00Z'); assert.equal(f.createdBefore, '2024-12-31T23:59:59Z');
  assert.equal(f.shopifyPlus, 'plus');

  const old = parseShopQuery({ traffic: '100k', growth: '25', productsMin: '50', avgPriceMin: '10', created: '30d', pixel: 'Meta Pixel', language: 'de' }, now);
  assert.equal(old.trafficMin, 100_000); assert.equal(old.growthMin, 25); assert.equal(old.growthRules, undefined);
  assert.equal(old.productsMin, 50); assert.equal(old.avgPriceMin, 10);
  assert.equal(old.createdAfter, '2026-09-02T00:00:00.000Z');
  assert.deepEqual(old.pixels, ['Meta Pixel']); assert.deepEqual(old.profile, { language: ['de'] });
  assert.equal(parseShopQuery({ growth: 'declining' }).growthMax, -0.01);
});

test('countries: one origin stays the plain filter, several or exclusions become lists', () => {
  assert.equal(parseShopQuery({ country: 'us' }).country, 'US');
  const many = parseShopQuery({ creationCountry: 'US,CA', excludeCreationCountry: 'CN,US', visitorCountry: 'GB,DE' });
  assert.deepEqual(many.creationCountries, ['US', 'CA']);
  assert.deepEqual(many.excludeCreationCountries, ['CN']);
  assert.deepEqual(many.visitorCountries, ['GB', 'DE']);
  assert.equal(parseShopQuery({ visitorCountry: 'GB' }).visitorCountry, 'GB');
  assert.deepEqual(parseShopQuery({ app: 'Klaviyo: Email Marketing & SMS|Judge.me', excludeApp: 'Shopify Inbox' }).profile.app,
    ['Klaviyo: Email Marketing & SMS', 'Judge.me']);
});

test('range bodies send only the ends that are set; prices in cents', () => {
  assert.equal(range(undefined, undefined), undefined);
  assert.deepEqual(range(10, undefined), { min: 10 });
  assert.deepEqual(range(19.99, 80, 100), { min: 1999, max: 8000 });
});
