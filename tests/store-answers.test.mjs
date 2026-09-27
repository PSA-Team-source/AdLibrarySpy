// Public store page Q&A (lib/public/store-answers.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeAnswers } from '../lib/public/store-answers.ts';

const base = { name: 'Acme', domain: 'acme.com', visits: 0, visitsMonth: '', growthPct: null, liveAds: 0, platform: '', createdOn: '', country: '', niche: '', apps: [], pixels: [], similar: [] };

test('no measured value = no question', () => {
  assert.deepEqual(storeAnswers(base), []);
});

test('each answer carries its number and source', () => {
  const qa = Object.fromEntries(storeAnswers({ ...base, visits: 1234567, visitsMonth: 'Aug 2026', growthPct: -12.4, liveAds: 42, platform: 'shopify', createdOn: '2019-03-01', country: 'Canada', apps: ['Klaviyo', 'Yotpo', 'Gorgias'] }));
  assert.equal(qa['How much traffic does acme.com get?'], 'acme.com had 1,234,567 visits in Aug 2026, as measured by SimilarWeb for this exact host. That is down 12% on the month before.');
  assert.match(qa['Is Acme running Facebook and Instagram ads?'], /42 live Meta ads/);
  assert.equal(qa['What platform is acme.com built on?'], 'acme.com runs on Shopify. Apps detected on its homepage include Klaviyo, Yotpo and Gorgias.');
  assert.equal(qa['When was Acme founded and where is it based?'], 'Acme was created in 2019 and is based in Canada.');
});
