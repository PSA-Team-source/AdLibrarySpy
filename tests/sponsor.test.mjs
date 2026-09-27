// Donate links render only for a live GitHub Sponsors listing. `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { sponsorUrl } = await import('../lib/public/sponsor.ts');
const REPO = 'https://github.com/PSA-Team-source/AdLibrarySpy';
const withFetch = async (impl, fn) => { const f = globalThis.fetch; globalThis.fetch = impl; try { await fn(); } finally { globalThis.fetch = f; } };

test('live listing (200) -> the sponsors URL', () => withFetch(async () => ({ status: 200 }), async () => {
  assert.equal(await sponsorUrl(REPO), 'https://github.com/sponsors/PSA-Team-source');
}));

test('no listing (302 to the profile), 404 or network error -> null, so no Donate link', async () => {
  for (const impl of [async () => ({ status: 302 }), async () => ({ status: 404 }), async () => { throw new Error('offline'); }]) {
    await withFetch(impl, async () => assert.equal(await sponsorUrl(REPO), null));
  }
});
