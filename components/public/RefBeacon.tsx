'use client';

import { useEffect } from 'react';
import { REF_COOKIE, REF_MAX_AGE, refFromUrl } from '@/lib/public/ref';

/**
 * The first-touch `als_ref` cookie on public pages. They are served from the
 * Cloudflare edge cache and must never Set-Cookie (that makes the response
 * uncacheable), so middleware.ts only sets it on non-public pages and this sets
 * it in the browser, same rules (only when absent). Renders nothing.
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
