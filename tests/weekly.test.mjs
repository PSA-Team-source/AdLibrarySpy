// Weekly report: ISO week keys and signed unsubscribe links.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekOf, weekBounds } from '../lib/weekly/week.ts';

process.env.SESSION_SECRET ||= 'test-secret-test-secret-test-secret';
const { unsubscribeToken, verifyUnsubscribe, unsubscribeUrl } = await import('../lib/weekly/unsubscribe.ts');

test('ISO week keys, including year boundaries', () => {
  assert.equal(isoWeekOf(new Date('2026-09-25T12:00:00Z')).key, '2026-w39');
  assert.equal(isoWeekOf(new Date('2026-09-28T06:00:00Z')).key, '2026-w40');   // Monday cron
  assert.equal(isoWeekOf(new Date('2027-01-01T00:00:00Z')).key, '2026-w53');   // 2026 has 53 weeks
  assert.equal(isoWeekOf(new Date('2024-12-30T00:00:00Z')).key, '2025-w01');
  assert.deepEqual(weekBounds(2026, 39), { start: '2026-09-21', end: '2026-09-27' });
  assert.deepEqual(weekBounds(2025, 1), { start: '2024-12-30', end: '2025-01-05' });
});

test('unsubscribe tokens verify only for their own user', () => {
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  const t = unsubscribeToken(a);
  assert.ok(verifyUnsubscribe(a, t));
  assert.ok(verifyUnsubscribe(a.toUpperCase().toLowerCase(), t));
  assert.equal(verifyUnsubscribe(b, t), false);
  assert.equal(verifyUnsubscribe(a, t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A')), false);
  assert.equal(verifyUnsubscribe('not-a-uuid', t), false);
  const u = new URL(unsubscribeUrl('https://adlibraryspy.com', a));
  assert.equal(u.pathname, '/api/newsletter/unsubscribe');
  assert.ok(verifyUnsubscribe(u.searchParams.get('u'), u.searchParams.get('t')));
});
