'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Meta (Facebook) pixel for the paid-social launch. Mounted once per surface
 * (homepage, (public), (auth) and (app) layouts), so a page has exactly one.
 * Loads fbevents.js from the browser and sets its cookies from JS, never a
 * Set-Cookie header, so edge-cached public pages stay cacheable.
 *
 * PageView fires per App Router pathname (Meta's own pushState tracking is off:
 * it would double-count every client navigation). `registeredUserId` is set by
 * the (app) layout for an account under an hour old: CompleteRegistration then
 * fires once, with eventID `reg-<id>` so Meta de-duplicates it across browsers
 * (the magic link is often opened on another device) and reloads.
 *
 * Id is NEXT_PUBLIC_META_PIXEL_ID, inlined at build. Unset = nothing loads.
 */
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; push: unknown; loaded: boolean; version: string; disablePushState?: boolean };
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

let lastPath: string | null = null;

function fbq(...args: unknown[]) {
  if (!window.fbq) {
    // Meta's base snippet, unrolled: a queueing stub until fbevents.js loads.
    const n = function (...a: unknown[]) { if (n.callMethod) n.callMethod.apply(n, a); else n.queue.push(a); } as Fbq;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    n.disablePushState = true; // fbevents.js reads this: no automatic SPA PageViews
    window.fbq = n; window._fbq ??= n;
    const s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    n('set', 'autoConfig', false, PIXEL_ID);
    n('init', PIXEL_ID);
  }
  window.fbq(...args);
}

export function MetaPixel({ registeredUserId }: { registeredUserId?: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!PIXEL_ID || !/^\d{10,20}$/.test(PIXEL_ID) || pathname === lastPath) return;
    lastPath = pathname;
    try { fbq('track', 'PageView'); } catch { /* blocked by an extension: never break the page */ }
  }, [pathname]);

  useEffect(() => {
    if (!PIXEL_ID || !registeredUserId) return;
    const key = `als_reg_sent:${registeredUserId}`;
    try {
      if (localStorage.getItem(key)) return;
      fbq('track', 'CompleteRegistration', { content_name: 'AdLibrarySpy free account', status: true }, { eventID: `reg-${registeredUserId}` });
      localStorage.setItem(key, '1');
    } catch { /* storage or pixel blocked: attribution is best-effort */ }
  }, [registeredUserId]);

  return null;
}
