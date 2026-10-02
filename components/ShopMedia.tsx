'use client';
import { useState } from 'react';
import { catchEarlyImgError } from '@/lib/utils';

/**
 * A shop logo. If there is no URL, or the URL fails to load, this renders
 * NOTHING — no grey square, no letter tile, no broken-image icon. An empty
 * bordered box reads as a failed image; absence reads as intentional.
 */
export function ShopLogo({ src, name, size = 32, className = '' }: {
  src: string; name: string; size?: number; className?: string;
}) {
  const [broken, setBroken] = useState(false);
  // Invisible until painted: a lazy or slow logo never shows as an empty bordered box.
  const [loaded, setLoaded] = useState(false);
  if (!src || broken) return null;
  return (
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      ref={el => { catchEarlyImgError(() => setBroken(true))(el); if (el?.complete && el.naturalWidth > 1) setLoaded(true); }}
      onLoad={e => (e.currentTarget.naturalWidth > 1 ? setLoaded(true) : setBroken(true))}
      style={{ width: size, height: size }}
      className={`rounded-lg object-contain bg-card border border-border shrink-0 ${loaded ? '' : 'opacity-0'} ${className}`}
    />
  );
}

/**
 * Product image that takes no space until it has actually painted, and
 * disappears on failure. Until load it is a 1px invisible probe (so lazy
 * loading still fires), never a bordered empty frame. A 1x1 tracking/spacer
 * pixel counts as no image. Wrappers collapse with `empty:hidden` (failed) or
 * `hidden has-[img]:block` (tile that exists only for its picture).
 */
export function ProductImage({ src, alt, className = '', style }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  if (!src || state === 'broken') return null;
  const settle = (el: HTMLImageElement | null) => {
    if (!el) return;
    // An image can finish before hydration attaches onLoad; listen natively too.
    if (!el.complete) { el.addEventListener('load', () => settle(el), { once: true }); return; }
    setState(el.naturalWidth > 1 ? 'ok' : 'broken');
  };
  return (
    <img src={src} alt={alt} loading="lazy"
      onError={() => setState('broken')} onLoad={e => settle(e.currentTarget)} ref={settle}
      className={state === 'ok' ? className : 'pointer-events-none absolute h-px w-px opacity-0'}
      style={state === 'ok' ? style : undefined} />
  );
}
