'use client';
import Link from 'next/link';
import { useState } from 'react';
import { catchEarlyImgError } from '@/lib/utils';
import { growthLabel } from '@/lib/trends';

/**
 * A product from a fast-growing store. The picture IS the card: if it fails to
 * load, the whole card goes away rather than leaving an empty frame.
 */
export function TrendProductCard({ href, title, image, shopName, domain, growthPct }: {
  href: string; title: string; image: string; shopName: string; domain: string; growthPct: number;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <li>
      <Link href={href} className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent">
        <span className="block aspect-square overflow-hidden bg-white">
          <img src={image} alt={title} loading="lazy"
            onError={() => setBroken(true)} ref={catchEarlyImgError(() => setBroken(true))}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        </span>
        <span className="block space-y-1 p-3">
          <span className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground">{title}</span>
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate" title={domain}>{shopName}</span>
            <span className="shrink-0 font-medium tabular-nums text-emerald-600 dark:text-emerald-400"
              title="The store's SimilarWeb visits, month over month">
              {growthLabel(growthPct)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}
