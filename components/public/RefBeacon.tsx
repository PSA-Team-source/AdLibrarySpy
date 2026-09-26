'use client';

import { useEffect } from 'react';
import { REF_COOKIE, REF_MAX_AGE, refFromUrl } from '@/lib/public/ref';

/**
 * Client twin of middleware.ts's first-touch cookie. Public pages are served from
 * the Cloudflare edge cache, so a shared link's first hit often never reaches the
 * origin middleware — this sets the same `als_ref` cookie in the browser, same rules
 * (only when absent). Renders nothing.
 */
export function RefBeacon() {
  useEffect(() => {
    try {
      if (document.cookie.split('; ').some(c => c.startsWith(`${REF_COOKIE}=`))) return;
      const value = refFromUrl(location.pathname, new URLSearchParams(location.search));
      if (!value) return;
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${REF_COOKIE}=${value}; Max-Age=${REF_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    } catch { /* cookies blocked: attribution is best-effort, never breaks the page */ }
  }, []);
  return null;
}
