// Pick 3 test assignment (lib/pick-three.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { armFor, eligible } from '../lib/pick-three.ts';

test('assignment is deterministic and close to 50/50', () => {
  const id = randomUUID();
  assert.equal(armFor(id), armFor(id));
  let t = 0; const n = 20000;
  for (let i = 0; i < n; i++) if (armFor(randomUUID()) === 'treatment') t++;
  assert.ok(Math.abs(t / n - 0.5) < 0.02, `treatment share ${t / n}`);
});

test('only new users who track nothing are enrolled', () => {
  const startsAt = new Date('2026-10-03T00:00:00Z');
  const after = new Date('2026-10-04T00:00:00Z'), before = new Date('2026-10-02T00:00:00Z');
  assert.equal(eligible({ userCreatedAt: after, startsAt, endsAt: null, trackers: 0 }), true);
  assert.equal(eligible({ userCreatedAt: before, startsAt, endsAt: null, trackers: 0 }), false);
  assert.equal(eligible({ userCreatedAt: after, startsAt, endsAt: null, trackers: 1 }), false);
  assert.equal(eligible({ userCreatedAt: after, startsAt, endsAt: new Date('2026-10-05T00:00:00Z'), trackers: 0 }), new Date() < new Date('2026-10-05T00:00:00Z'));
});
