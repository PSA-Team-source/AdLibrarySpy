import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The AdLibrarySpy mark — the same lockup the public homepage uses: a lime
 * rounded square carrying the
 * target glyph, on ink. One component so the app chrome, sign-in, OAuth and
 * error pages cannot drift from the front door.
 */
export const BRAND_LIME = '#a7f45a';
export const BRAND_INK = '#050807';

export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center', className)}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3),
        background: BRAND_LIME, color: '#071004',
      }}
    >
      <Target size={Math.round(size * 0.63)} strokeWidth={2.25} />
    </span>
  );
}

export function BrandLockup({ className, size = 28, wordmarkClassName }: {
  className?: string; size?: number; wordmarkClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      <span className={cn('text-[17px] font-semibold tracking-[-0.02em] text-foreground', wordmarkClassName)}>
        AdLibrarySpy
      </span>
    </span>
  );
}
