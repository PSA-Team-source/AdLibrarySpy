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

// Paid-social attribution: first touch across a pre-hydration click, the _fbc
// click id, the in-app-browser sign-up path and the Conversions API payload.
import { firstTouchRef, fbcFromFbclid } from '../lib/public/ref.ts';
import { inAppBrowser, openInBrowserHref, handoffUrl } from '../lib/public/in-app-browser.ts';
import { registrationEvent } from '../lib/analytics/meta-capi.ts';

test('firstTouchRef: the landing page tag in a same-site Referer beats the internal link', () => {
  const p = new URLSearchParams('ref=home:hero');
  assert.equal(firstTouchRef('/signup', p, 'https://adlibraryspy.com/?utm_source=facebook&ref=fb%3Alaunch&fbclid=x', 'adlibraryspy.com'), 'fb:launch');
  assert.equal(firstTouchRef('/signup', p, 'https://adlibraryspy.com/?utm_source=facebook', 'adlibraryspy.com'), 'utm:facebook');
  assert.equal(firstTouchRef('/signup', p, 'https://adlibraryspy.com/', 'adlibraryspy.com'), 'home:hero');
  assert.equal(firstTouchRef('/signup', p, 'https://evil.com/?ref=x:y', 'adlibraryspy.com'), 'home:hero');
  assert.equal(firstTouchRef('/signup', p, 'not a url', 'adlibraryspy.com'), 'home:hero');
  assert.equal(firstTouchRef('/signup', new URLSearchParams(''), null, 'adlibraryspy.com'), null);
});

test('fbcFromFbclid: Meta format, cookie-safe, absent without a click id', () => {
  assert.equal(fbcFromFbclid('IwZXh0_aem-1', 1790000000000), 'fb.1.1790000000000.IwZXh0_aem-1');
  assert.equal(fbcFromFbclid('a;b c', 1), 'fb.1.1.abc');
  assert.equal(fbcFromFbclid(null, 1), null);
  assert.equal(fbcFromFbclid('', 1), null);
});

test('inAppBrowser: Meta webviews from the launch logs, not real browsers', () => {
  const fb = 'Mozilla/5.0 (Linux; Android 14; SM-M135FU Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/580.0.0.51.74;IABMV/1;]';
  const ig = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G90 Instagram 447.0.0.34.80 (iPhone18,3; iOS 26_6_2; en_GB; en-GB; scale=3.00; 1206x2622; IABMV/1; 1065993616) Safari/604.1';
  const fbios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22H20 [FBAN/FBIOS;FBAV/530.0.0.40.109;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.7;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]';
  assert.equal(inAppBrowser(fb), 'Facebook');
  assert.equal(inAppBrowser(ig), 'Instagram');
  assert.equal(inAppBrowser(fbios), 'Facebook');
  for (const real of ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7.5 Mobile/15E148 Safari/604.1', '', null]) {
    assert.equal(inAppBrowser(real), null, String(real));
  }
  assert.equal(openInBrowserHref(fb, 'https://adlibraryspy.com/signup?ref=fb%3Alaunch'), 'intent://adlibraryspy.com/signup?ref=fb%3Alaunch#Intent;scheme=https;end');
  assert.equal(openInBrowserHref(ig, 'https://adlibraryspy.com/signup'), null);
});

test('handoffUrl: first touch and the ad click id travel to the other browser', () => {
  const u = new URL(handoffUrl('https://adlibraryspy.com/signup?ref=home:hero', 'a=1; als_ref=fb:launch; _fbc=fb.1.1790000000000.IwAbc_aem_x.y'));
  assert.equal(u.pathname, '/signup');
  assert.equal(u.searchParams.get('ref'), 'fb:launch');
  assert.equal(u.searchParams.get('fbclid'), 'IwAbc_aem_x.y');
  assert.equal(handoffUrl('https://adlibraryspy.com/signup', ''), 'https://adlibraryspy.com/signup');
});

test('registrationEvent: dedups with the pixel, hashes identity, drops non-Meta ids', () => {
  const e = registrationEvent({ userId: 'u1', email: ' A@B.com ', sourceUrl: 'https://adlibraryspy.com/', nowSec: 1790000000,
    fbc: 'fb.1.1790000000000.IwAbc', fbp: 'fb.1.1790000000000.947444996961714678', ip: '1.2.3.4', ua: 'UA' });
  assert.equal(e.event_id, 'reg-u1');
  assert.equal(e.event_name, 'CompleteRegistration');
  assert.equal(e.action_source, 'website');
  assert.deepEqual(e.user_data.em, ['fb98d44ad7501a959f3f4f4a3f004fe2d9e581ea6207e218c4b02c08a4d75adf']); // sha256('a@b.com')
  assert.equal(e.user_data.fbc, 'fb.1.1790000000000.IwAbc');
  assert.equal(e.user_data.client_ip_address, '1.2.3.4');
  const bare = registrationEvent({ userId: 'u', email: 'x@y.z', sourceUrl: 's', nowSec: 1, fbc: 'junk', fbp: null, ip: 'unknown', ua: null });
  assert.deepEqual(Object.keys(bare.user_data).sort(), ['em', 'external_id']);
});
