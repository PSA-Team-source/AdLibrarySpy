'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// List screens whose filters live in the URL. Coming back to one with a bare
// URL (sidebar link, back from an ad) restores this tab's last filters; a
// clear-all on the same screen is remembered as cleared.
const LISTS = new Set(['/shops', '/ads', '/products', '/landing-pages', '/advertisers', '/trends']);
const key = (p: string) => `filters:${p}`;

export function FilterMemory() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const last = useRef<string | null>(null);
  const qs = params.toString();

  useEffect(() => {
    const arrived = last.current !== pathname;
    last.current = pathname;
    if (!LISTS.has(pathname)) return;
    try {
      const saved = sessionStorage.getItem(key(pathname));
      if (arrived && !qs && saved) { router.replace(`${pathname}?${saved}`, { scroll: false }); return; }
      sessionStorage.setItem(key(pathname), qs);
    } catch { /* storage blocked: filters just don't persist */ }
  }, [pathname, qs, router]);

  return null;
}
