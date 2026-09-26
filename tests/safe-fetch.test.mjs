// Outbound-fetch guard (lib/safe-fetch.ts) and the OAuth loopback check. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateAddress, isLoopbackHost, bareHost, safeFetch, BlockedUrlError } from '../lib/safe-fetch.ts';

test('private, loopback, link-local, CGNAT and metadata addresses are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.20.0.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '[::1]', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1',
    '::ffff:169.254.169.254', '64:ff9b::a9fe:a9fe', 'not-an-ip']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '23.227.38.65', '172.32.0.1', '100.128.0.1', '2606:4700::6810:1', '[2606:4700::6810:1]']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('IPv6 loopback redirect URIs are recognised in URL.hostname form', () => {
  assert.equal(new URL('http://[::1]:8080/cb').hostname, '[::1]');   // why bareHost exists
  assert.equal(bareHost('[::1]'), '::1');
  for (const u of ['http://[::1]:8080/cb', 'http://127.0.0.1/cb', 'http://localhost:3000/cb', 'http://127.9.9.9/cb']) {
    assert.equal(isLoopbackHost(new URL(u).hostname), true, u);
  }
  for (const u of ['http://example.com/cb', 'http://[::2]/cb', 'http://10.0.0.1/cb', 'http://localhost.evil.com/cb']) {
    assert.equal(isLoopbackHost(new URL(u).hostname), false, u);
  }
});

test('safeFetch refuses private hosts and non-http schemes before any request', async () => {
  for (const u of ['http://127.0.0.1/', 'https://[::1]/', 'http://169.254.169.254/latest/meta-data/', 'http://2130706433/',
    'http://localhost/', 'file:///etc/passwd', 'https://user:pw@example.com/']) {
    await assert.rejects(safeFetch(u), BlockedUrlError, u);
  }
});
