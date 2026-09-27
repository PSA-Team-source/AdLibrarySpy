// Emailed sign-in codes (lib/auth/code.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCode, normalizeCode, hashCode, CODE_LENGTH, CODE_TRIES } from '../lib/auth/code.ts';

const SECRET = 'x'.repeat(32);

test('codes are 6 digits, leading zeros kept, and vary', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = newCode();
    assert.match(c, /^\d{6}$/);
    seen.add(c);
  }
  assert.ok(seen.size > 1990, 'codes repeat far too often');
  assert.equal(CODE_LENGTH, 6);
  assert.ok(CODE_TRIES >= 1 && CODE_TRIES <= 10, 'a 6-digit code needs a strict attempt cap');
});

test('typed or pasted input normalises to the digits, anything else is refused', () => {
  assert.equal(normalizeCode('123456'), '123456');
  assert.equal(normalizeCode(' 123 456 '), '123456');
  assert.equal(normalizeCode('123-456'), '123456');
  assert.equal(normalizeCode('012345'), '012345');
  assert.equal(normalizeCode('12345'), null);
  assert.equal(normalizeCode('1234567'), null);
  assert.equal(normalizeCode(''), null);
  assert.equal(normalizeCode(null), null);
});

test('the stored hash is keyed and bound to the address', () => {
  const h = hashCode('ann@example.com', '123456', SECRET);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(hashCode('ANN@example.com', '123456', SECRET), h, 'address case must not matter');
  assert.notEqual(hashCode('bob@example.com', '123456', SECRET), h, 'a code is only good for its own address');
  assert.notEqual(hashCode('ann@example.com', '123457', SECRET), h);
  assert.notEqual(hashCode('ann@example.com', '123456', 'y'.repeat(32)), h, 'without the server secret the hash cannot be reproduced');
  assert.throws(() => hashCode('ann@example.com', '123456', ''), /SESSION_SECRET/);
});
