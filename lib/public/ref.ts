/**
 * First-touch attribution cookie `als_ref` (growth brief contract):
 *   value `<source>:<detail>`, max 120 chars, 30 days, set only when absent.
 *   ?ref=share on /store/fashionnova.com  -> share:store/fashionnova.com
 *   ?ref=ext:chrome                        -> ext:chrome   (already source:detail)
 *   ?utm_source=producthunt                -> utm:producthunt
 * Pure (no Next/DOM imports) so middleware (edge) and the client beacon share it.
 * Signup (lib/auth/actions.ts, owner F) reads the cookie.
 */
export const REF_COOKIE = 'als_ref';
export const REF_MAX_AGE = 60 * 60 * 24 * 30;
const MAX = 120;

// Cookie-safe and log-safe: no ; , spaces, quotes or control chars can reach Set-Cookie.
const clean = (s: string) => s.replace(/[^A-Za-z0-9._\-/:@+]/g, '').slice(0, MAX);

export function refFromUrl(pathname: string, params: URLSearchParams): string | null {
  const ref = clean(params.get('ref') ?? '');
  if (ref) {
    if (ref.includes(':')) return ref;
    const path = clean(pathname.replace(/^\/+|\/+$/g, ''));
    return (path ? `${ref}:${path}` : `${ref}:home`).slice(0, MAX);
  }
  const utm = clean(params.get('utm_source') ?? '');
  return utm ? `utm:${utm}`.slice(0, MAX) : null;
}

/**
 * The first touch for a request that has no als_ref yet. A click on a tagged
 * internal link (`/signup?ref=home:hero`) made before the landing page hydrated
 * reaches middleware before RefBeacon ever ran, so the landing page's own tag
 * (`/?ref=fb:launch`) only survives in the same-site Referer: that wins.
 */
export function firstTouchRef(pathname: string, params: URLSearchParams, referer: string | null, host: string | null): string | null {
  if (referer && host) {
    try {
      const r = new URL(referer);
      if (r.host === host) {
        const landed = refFromUrl(r.pathname, r.searchParams);
        if (landed) return landed;
      }
    } catch { /* malformed Referer: fall through */ }
  }
  return refFromUrl(pathname, params);
}

/**
 * Meta's click-id cookie `_fbc` = `fb.1.<creation ms>.<fbclid>` (Conversions API
 * "fbc" parameter spec). fbevents.js writes it too, but only once it has loaded and
 * only when not blocked; the server reads it at signup for the Conversions API.
 */
export function fbcFromFbclid(fbclid: string | null, nowMs: number): string | null {
  const id = (fbclid ?? '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 500);
  return id ? `fb.1.${nowMs}.${id}` : null;
}
