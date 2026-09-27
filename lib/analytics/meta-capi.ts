// Meta Conversions API: the server-side CompleteRegistration for a new account.
//
// The browser pixel (components/public/MetaPixel.tsx) alone cannot credit an ad:
// a magic link is usually opened in another browser than the Facebook/Instagram
// webview the ad opened (no fbclid there), and ad blockers drop the pixel. This
// sends the same event from the server with the click id (`_fbc`) and browser id
// (`_fbp`) captured where the visitor asked to sign up, plus the hashed email.
// event_id `reg-<userId>` equals the pixel's eventID, so Meta counts one signup.
//
// Analytics only, like lib/analytics/events.ts: never throws, never blocks the
// caller (fire-and-forget, 4s timeout), no-op unless META_CAPI_ACCESS_TOKEN
// (server-only, box .env.local) and NEXT_PUBLIC_META_PIXEL_ID are set.
import { createHash } from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v24.0';
const TIMEOUT_MS = 4000;

export interface SignupContext {
  fbc: string | null; fbp: string | null; ip: string | null; ua: string | null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
// Meta-issued ids only (fb.<subdomain>.<ms>.<id>); anything else is dropped, not sent.
const fbId = (v: string | null | undefined) => (v && /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_\-.]{1,500}$/.test(v) ? v : null);

/** Pure: the `data[]` entry Meta expects. Exported for the self-check. */
export function registrationEvent(a: { userId: string; email: string; sourceUrl: string; nowSec: number } & SignupContext) {
  const user_data: Record<string, string | string[]> = {
    em: [sha256(a.email.trim().toLowerCase())],
    external_id: [sha256(a.userId)],
  };
  if (a.ip && a.ip !== 'unknown') user_data.client_ip_address = a.ip;
  if (a.ua) user_data.client_user_agent = a.ua.slice(0, 500);
  const fbc = fbId(a.fbc), fbp = fbId(a.fbp);
  if (fbc) user_data.fbc = fbc;
  if (fbp) user_data.fbp = fbp;
  return {
    event_name: 'CompleteRegistration',
    event_time: a.nowSec,
    event_id: `reg-${a.userId}`,
    action_source: 'website',
    event_source_url: a.sourceUrl,
    user_data,
    custom_data: { content_name: 'AdLibrarySpy free account', status: 'true' },
  };
}

/** Fire-and-forget. Safe anywhere on the server. */
export function sendRegistration(a: { userId: string; email: string; sourceUrl: string } & SignupContext): void {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  if (!token || !pixel || !/^\d{10,20}$/.test(pixel)) return;
  let body: URLSearchParams;
  try {
    body = new URLSearchParams({
      data: JSON.stringify([registrationEvent({ ...a, nowSec: Math.floor(Date.now() / 1000) })]),
      access_token: token,
    });
  } catch { return; }
  fetch(`${GRAPH}/${pixel}/events`, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    .then(async (r) => { if (!r.ok) console.error('[meta-capi]', r.status, (await r.text()).slice(0, 300)); })
    .catch((e: Error) => console.error('[meta-capi]', e.name === 'TimeoutError' ? 'timeout' : e.message));
}
