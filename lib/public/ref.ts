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
