// Growth funnel: redirect safety, invite-token extraction, ClickHouse row shape. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, inviteTokenFromNext } from '../lib/auth/safe-next.ts';
import { eventRow } from '../lib/analytics/events.ts';

test('safeNext only lets same-origin paths through', () => {
  assert.equal(safeNext('/invite?token=abc'), '/invite?token=abc');
  assert.equal(safeNext('/shops'), '/shops');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '', null, undefined, 42, '/a\nb', '/' + 'x'.repeat(600)]) {
    assert.equal(safeNext(bad), null, String(bad));
  }
});

test('inviteTokenFromNext reads the token of an /invite next only', () => {
  assert.equal(inviteTokenFromNext('/invite?token=a%2Bb'), 'a+b');
  assert.equal(inviteTokenFromNext('/invite?token='), null);
  assert.equal(inviteTokenFromNext('/shops?token=x'), null);
  assert.equal(inviteTokenFromNext(null), null);
});

test('eventRow: ClickHouse JSONEachRow shape, ref split and clamp', () => {
  const r = eventRow('signup', 'u1', { workspaceId: 'w1', ref: 'share:store/fashionnova.com', props: { a: 1 }, now: new Date('2026-09-25T01:02:03.456Z') });
  assert.equal(r.occurred_at, '2026-09-25 01:02:03.456');
  assert.equal(r.ref_source, 'share');
  assert.equal(r.ref, 'share:store/fashionnova.com');
  assert.equal(r.props, '{"a":1}');
  assert.match(r.event_id, /^[0-9a-f-]{36}$/);
  const bare = eventRow('first_save', 'u2', { ref: null });
  assert.deepEqual([bare.ref, bare.ref_source, bare.workspace_id, bare.props], ['', '', '', '']);
  assert.equal(eventRow('signup', 'u', { ref: 'x'.repeat(300) }).ref.length, 120);
});
