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
  if (!src || broken) return null;
  return (
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)} ref={catchEarlyImgError(() => setBroken(true))}
      style={{ width: size, height: size }}
      className={`rounded-lg object-contain bg-card border border-border shrink-0 ${className}`}
    />
  );
}

/** Product image that disappears on failure instead of leaving an empty frame. */
export function ProductImage({ src, alt, className = '', style }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} ref={catchEarlyImgError(() => setBroken(true))} className={className} style={style} />;
}
