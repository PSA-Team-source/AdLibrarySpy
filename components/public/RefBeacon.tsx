'use client';

import { useEffect } from 'react';
import { REF_COOKIE, REF_MAX_AGE, refFromUrl, fbcFromFbclid } from '@/lib/public/ref';

/**
 * The first-touch `als_ref` cookie on public pages. They are served from the
 * Cloudflare edge cache and must never Set-Cookie (that makes the response
 * uncacheable), so middleware.ts only sets it on non-public pages and this sets
 * it in the browser, same rules (only when absent). Renders nothing.
 *
 * A Meta ad click (`?fbclid=`) also gets Meta's `_fbc` click-id cookie here when
 * fbevents.js has not written one yet (blocked, or the visitor tapped on before it
 * loaded): signup sends it to the Conversions API (lib/analytics/meta-capi.ts), which
 * is how Meta ties the account to the ad.
 */
export function RefBeacon() {
  useEffect(() => {
    try {
      const has = (name: string) => document.cookie.split('; ').some(c => c.startsWith(`${name}=`));
      const params = new URLSearchParams(location.search);
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      const fbc = has('_fbc') ? null : fbcFromFbclid(params.get('fbclid'), Date.now());
      // 90 days: Meta's own lifetime for _fbc.
      if (fbc) document.cookie = `_fbc=${fbc}; Max-Age=${60 * 60 * 24 * 90}; Path=/; SameSite=Lax${secure}`;
      if (has(REF_COOKIE)) return;
      const value = refFromUrl(location.pathname, params);
      if (!value) return;
      document.cookie = `${REF_COOKIE}=${value}; Max-Age=${REF_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    } catch { /* cookies blocked: attribution is best-effort, never breaks the page */ }
  }, []);
  return null;
}
