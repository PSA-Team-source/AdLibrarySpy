'use client';
import { useEffect, useState } from 'react';

/**
 * Brand logo, following PlatformDTC's market pages: the store's own logo, then
 * Google's favicon service for the domain. Both are real images of the brand.
 * If neither loads (or the service only has its default globe), this renders
 * nothing rather than an empty white tile or a stand-in icon.
 */
export function BrandLogo({ logo, domain, name, size = 64, onMissing }: {
  logo: string; domain: string; name: string; size?: number;
  /** Called once when there turns out to be no logo to show. */
  onMissing?: () => void;
}) {
  const favicon = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : '';
  // A merchant .ico can return 200 and still fail to paint in Chromium, which
  // leaves a broken-image glyph and never fires onError. The favicon service
  // always answers with a real PNG, so .ico goes straight there.
  const preferred = logo && !/\.ico(\?|$)/i.test(logo) ? logo : favicon;
  const [src, setSrc] = useState(preferred);
  const [dead, setDead] = useState(!preferred);
  // Invisible until painted: a lazy or slow logo never shows as an empty tile.
  const [shown, setShown] = useState(false);
  useEffect(() => { if (!preferred) onMissing?.(); }, [preferred, onMissing]);
  if (dead || !src) return null;
  const fail = () => {
    if (src !== favicon && favicon) setSrc(favicon);
    else { setDead(true); onMissing?.(); }
  };
  // For a domain it does not know, the favicon service answers 404 with its
  // 16px default globe — Chromium paints it and fires no error. That globe is
  // not the brand, so treat it as no logo (a real sz=64 favicon is larger).
  const check = (el: HTMLImageElement | null) => {
    if (!el || !el.complete) return;
    if (el.naturalWidth === 0 || (src === favicon && el.naturalWidth <= 16)) fail();
    else setShown(true);
  };

  const inner = Math.round(size * 0.625);
  return (
    // An app-icon tile: white, ~22% corner radius, hairline edge so a white
    // logo still reads as a tile on the white card.
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-black/[0.08] ${shown ? '' : 'opacity-0'}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.225) }}
    >
      <img
        src={src}
        alt={`${name} logo`}
        loading="lazy"
        style={{ width: inner, height: inner }}
        className="rounded object-contain"
        onError={fail}
        onLoad={e => check(e.currentTarget)}
        ref={check}
      />
    </div>
  );
}
