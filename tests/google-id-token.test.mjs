// Google ID token verification (lib/auth/google.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyGoogleIdToken } from '../lib/auth/google.ts';

const CLIENT = 'client-123.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const keys = async () => new Map([['k1', publicKey]]);
const now = Date.UTC(2026, 8, 26);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(claims, { kid = 'k1', alg = 'RS256', key = privateKey } = {}) {
  const head = `${b64({ alg, kid, typ: 'JWT' })}.${b64(claims)}`;
  return `${head}.${crypto.sign('RSA-SHA256', Buffer.from(head), key).toString('base64url')}`;
}
const good = {
  iss: 'https://accounts.google.com', aud: CLIENT, sub: '1107', email: 'Ann@Example.com',
  email_verified: true, name: ' Ann ', iat: now / 1000 - 10, exp: now / 1000 + 3600,
};
const v = (tok) => verifyGoogleIdToken(tok, CLIENT, keys, now);

test('a valid token yields the identity, email lower-cased', async () => {
  assert.deepEqual(await v(sign(good)), { sub: '1107', email: 'ann@example.com', name: 'Ann' });
});

test('wrong audience, issuer, expired or unverified email are refused', async () => {
  assert.equal(await v(sign({ ...good, aud: 'someone-else' })), null);
  assert.equal(await v(sign({ ...good, iss: 'https://evil.example' })), null);
  assert.equal(await v(sign({ ...good, exp: now / 1000 - 3600 })), null);
  assert.equal(await v(sign({ ...good, email_verified: false })), null);
  assert.equal(await v(sign({ ...good, sub: '' })), null);
});

test('forged signature, unknown kid, alg none and garbage are refused', async () => {
  assert.equal(await v(sign(good, { key: other.privateKey })), null);
  assert.equal(await v(sign(good, { kid: 'nope' })), null);
  assert.equal(await v(`${b64({ alg: 'none', kid: 'k1' })}.${b64(good)}.`), null);
  const [h, , s] = sign(good).split('.');
  assert.equal(await v(`${h}.${b64({ ...good, sub: 'attacker' })}.${s}`), null);
  assert.equal(await v('not-a-jwt'), null);
  assert.equal(await verifyGoogleIdToken(sign(good), '', keys, now), null);
});
