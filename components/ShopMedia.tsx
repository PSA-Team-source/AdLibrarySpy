'use client';
import { useState } from 'react';
import { catchEarlyImgError } from '@/lib/utils';
import type { Product } from '@/lib/types';

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

/** Row of catalogue thumbnails; products without an image are skipped. */
export function ProductThumbs({ products, max = 3, size = 36 }: {
  products: Product[]; max?: number; size?: number;
}) {
  const withImages = products.filter(p => p.image);
  if (!withImages.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {withImages.slice(0, max).map(p => (
        <ProductImage
          key={`${p.rank}-${p.title}`}
          src={p.image!}
          alt={p.title}
          className="rounded-md object-cover border border-border"
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}
