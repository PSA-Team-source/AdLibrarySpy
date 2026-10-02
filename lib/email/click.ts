// Email click tracking: every link in the alerts digest and the weekly report
// goes through GET /r (app/r/route.ts), which records an `email_click` event and
// 302s to the page. Pure node:crypto with no path aliases, so the cron scripts,
// the route and `npm test` all load it as-is.
//
// Not an open redirect: `to` must be a same-site path (the safeNext rules in
// lib/auth/safe-next.ts, repeated here because plain-node imports cannot use
// '@/'). The HMAC only vouches for WHO clicked: a link without a valid
// signature still redirects, but records no user.
import crypto from 'node:crypto';

const PURPOSE = 'email-click:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPAIGN = /^[a-z0-9][a-z0-9:_.-]{0,59}$/i;

/** A same-site absolute path, or null (//evil.com, /\evil.com, https://…, control chars). */
export function safePath(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 1024) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v;
}

export const safeCampaign = (v: unknown): string => (typeof v === 'string' && CAMPAIGN.test(v) ? v : '');

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set — cannot sign email links');
  return s;
}

function sign(userId: string, campaign: string, to: string): string {
  return crypto.createHmac('sha256', secret()).update(`${PURPOSE}${userId.toLowerCase()}|${campaign}|${to}`).digest('base64url').slice(0, 22);
}

/**
 * The tracked absolute URL for an app link. `href` is an absolute app URL or a
 * path; anything that is not this app's own page is returned untouched.
 */
export function clickUrl(app: string, href: string, campaign: string, userId: string): string {
  const base = app.replace(/\/$/, '');
  const to = safePath(href.startsWith(base + '/') ? href.slice(base.length) : href);
  if (!to || !UUID.test(userId) || !safeCampaign(campaign)) return href;
  const u = new URL('/r', base);
  u.searchParams.set('to', to);
  u.searchParams.set('c', campaign);
  u.searchParams.set('u', userId);
  u.searchParams.set('s', sign(userId, campaign, to));
  return u.toString();
}

/** The user a click is attributed to, or null when the link was not signed for them. */
export function verifiedClicker(userId: unknown, campaign: string, to: string, sig: unknown): string | null {
  if (typeof userId !== 'string' || !UUID.test(userId) || typeof sig !== 'string' || sig.length !== 22) return null;
  const want = Buffer.from(sign(userId, campaign, to));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? userId : null;
}

/** Rewrite every href="<app>/…" page link in an HTML fragment through clickUrl (API links such as one-click unsubscribe stay direct). */
export function trackLinks(html: string, app: string, campaign: string, userId: string): string {
  const base = app.replace(/\/$/, '');
  return html.replace(/href="([^"]+)"/g, (m, raw: string) => {
    const href = raw.replace(/&amp;/g, '&');
    if (!href.startsWith(base + '/') || href.startsWith(base + '/api/')) return m;
    return `href="${clickUrl(base, href, campaign, userId).replace(/&/g, '&amp;')}"`;
  });
}
