// Share attribution (lib/public/ref.ts) and public /store URL parsing (lib/public/site.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refFromUrl } from '../lib/public/ref.ts';
import { publicDomain, measuredVisits } from '../lib/public/site.ts';

const q = (s) => new URLSearchParams(s);

test('ref=share is qualified with the page it was shared from', () => {
  assert.equal(refFromUrl('/store/fashionnova.com', q('ref=share')), 'share:store/fashionnova.com');
  assert.equal(refFromUrl('/ad/ce4960cf51af44d90ea409c42187d0f2', q('ref=share')), 'share:ad/ce4960cf51af44d90ea409c42187d0f2');
  assert.equal(refFromUrl('/', q('ref=share')), 'share:home');
});

test('a ref that already names source:detail is kept; utm_source becomes utm:<source>', () => {
  assert.equal(refFromUrl('/store/x.com', q('ref=ext:chrome')), 'ext:chrome');
  assert.equal(refFromUrl('/weekly', q('ref=weekly:2026-w39')), 'weekly:2026-w39');
  assert.equal(refFromUrl('/', q('utm_source=producthunt&utm_medium=launch')), 'utm:producthunt');
  assert.equal(refFromUrl('/', q('ref=share&utm_source=x')), 'share:home', 'ref wins over utm');
});

test('no attribution param -> no cookie; hostile values cannot break Set-Cookie; 120 char cap', () => {
  assert.equal(refFromUrl('/store/x.com', q('')), null);
  assert.equal(refFromUrl('/', q('ref=%3B%20%22')), null);
  assert.equal(refFromUrl('/', q('ref=a;b=c d')), 'abcd:home');
  assert.equal(refFromUrl('/' + 'p'.repeat(300), q('ref=share')).length, 120);
});

test('publicDomain accepts hosts only and normalises aliases', () => {
  assert.equal(publicDomain('fashionnova.com'), 'fashionnova.com');
  assert.equal(publicDomain('WWW.Gymshark.com'), 'gymshark.com');
  assert.equal(publicDomain('dmfit.com.br'), 'dmfit.com.br');
  assert.equal(publicDomain('https%3A%2F%2Fshop.example.co.uk%2Fpath'), 'shop.example.co.uk');
  for (const bad of ['', 'localhost', 'foo', '-a.com', 'a..com', '<script>.com', '%E0%A4%A', '1.2.3.4']) {
    assert.equal(publicDomain(bad), '', bad);
  }
});

test('public pages show only SimilarWeb-measured visits', () => {
  assert.equal(measuredVisits({ trafficSource: 'similarweb', monthlyVisits: 1200 }), 1200);
  assert.equal(measuredVisits({ trafficSource: 'index', monthlyVisits: 178_000_000 }), 0);
  assert.equal(measuredVisits({ trafficSource: null, monthlyVisits: 0 }), 0);
});
