'use client';
// Click-to-detail, the way PlatformDTC's /dashboard opens a tile: a small chart
// or thumbnail in a list is a button, and clicking it opens a dialog with the
// SAME data drawn large. Nothing is fetched on open, so the dialog can never
// disagree with the row that opened it.
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import type { CountryShare, Point, Product } from '@/lib/types';
import { compact, flag } from '@/lib/format';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ProductImage } from '@/components/ShopMedia';
import TrendChart from './TrendChart';
import { trafficChartColor } from './TrafficChart';
import { cn } from '@/lib/utils';

export function productPrice(p: Product): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(p.price);
  } catch {
    return p.price.toFixed(2);
  }
}

const TRIGGER = 'cursor-zoom-in rounded-[10px] outline-none transition-opacity hover:opacity-80 focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';

/** Shop header shared by both dialogs: name, domain, and the way to the full dossier. */
function ShopHeader({ shop }: { shop?: { id: string; domain: string } }) {
  if (!shop) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <a href={`https://${shop.domain}`} target="_blank" rel="noopener noreferrer nofollow"
        className="btn-ghost h-9 px-3 text-sm"><Globe className="h-4 w-4" /> Visit store</a>
      <Link href={`/shops/${shop.id}`} className="btn-primary h-9 px-3 text-sm"><BarChart3 className="h-4 w-4" /> Shop analytics</Link>
    </div>
  );
}

/**
 * A sparkline that opens its series as a full chart. With fewer than two
 * points there is no trend to show, so the sparkline stays a plain picture.
 */
export function ChartDetail({ children, title, subtitle, data, valueLabel, headline, growth, caption, countries, countriesLabel, shop }: {
  /** The small chart shown in the row. */
  children: ReactNode;
  title: string;
  subtitle?: string;
  data: Point[];
  valueLabel: string;
  /** The row's own headline figure for this series. */
  headline?: number;
  /** Period-over-period change in percent; colours the chart like the sparkline. */
  growth?: number | null;
  /** Where the figure comes from ("SimilarWeb · Aug 2026"). */
  caption?: string;
  countries?: CountryShare[];
  countriesLabel?: string;
  shop?: { id: string; domain: string };
}) {
  const [open, setOpen] = useState(false);
  if (data.length < 2) return <>{children}</>;
  const g = growth ?? null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={TRIGGER} aria-label={`${title}: ${valueLabel} chart`} title="Open chart">
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <div className="pr-8">
            <DialogTitle className="truncate text-[17px]">{title}</DialogTitle>
            <DialogDescription className="mt-1">{subtitle ?? `${valueLabel} over time`}</DialogDescription>
          </div>
          {headline != null && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-light tracking-tight tabular-nums text-foreground">{compact(headline)}</span>
              {g != null && g !== 0 && (
                <span className={cn('inline-flex items-center gap-0.5 text-sm font-medium', g > 0 ? 'text-[var(--a-green)]' : 'text-[var(--a-red)]')}>
                  {g > 0 ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
                  {g > 0 ? '+' : ''}{g.toFixed(1)}%
                </span>
              )}
              {caption && <span className="text-[13px] text-muted-foreground">{caption}</span>}
            </div>
          )}
          <TrendChart data={data} valueLabel={valueLabel} color={g == null ? '#16a34a' : trafficChartColor(g)} />
          {countries && countries.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">{countriesLabel ?? 'Countries'}</span>
              <span className="flex flex-wrap items-center gap-3 tabular-nums text-foreground">
                {countries.slice(0, 6).map(c => <span key={c.code} title={c.code}><span aria-hidden>{flag(c.code)}</span> {c.pct}%</span>)}
              </span>
            </div>
          )}
          <ShopHeader shop={shop} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Product pictures that open large. `children(open)` renders the thumbnails;
 * each calls `open(i)` with its index in `products` (only those with an image).
 */
export function ProductGallery({ products, title, ranked = false, shop, children }: {
  products: Product[];
  title: string;
  /** The order is a best-seller ranking: show "#rank". */
  ranked?: boolean;
  shop?: { id: string; domain: string };
  children: (open: (i: number) => void) => ReactNode;
}) {
  const items = products.filter(p => p.image);
  const [index, setIndex] = useState<number | null>(null);
  const cur = index == null ? null : items[index];

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex(i => (i == null ? i : (i - 1 + items.length) % items.length));
      if (e.key === 'ArrowRight') setIndex(i => (i == null ? i : (i + 1) % items.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length]);

  if (!items.length) return null;
  const nav = 'grid h-9 w-9 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-colors hover:bg-accent';
  return (
    <>
      {children(setIndex)}
      <Dialog open={cur != null} onOpenChange={o => { if (!o) setIndex(null); }}>
        <DialogContent className="max-w-3xl">
          {cur && (
            <>
              <div className="pr-8">
                <DialogTitle className="truncate text-[17px]">{title}</DialogTitle>
                <DialogDescription className="mt-1 tabular-nums">{index! + 1} of {items.length} products</DialogDescription>
              </div>
              <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-white">
                <ProductImage key={cur.image} src={cur.image!} alt={cur.title} className="max-h-[60dvh] w-auto max-w-full object-contain" />
                {ranked && <span className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">#{cur.rank}</span>}
                {items.length > 1 && (
                  <>
                    <button type="button" aria-label="Previous product" className={cn(nav, 'absolute left-3 top-1/2 -translate-y-1/2')}
                      onClick={() => setIndex((index! - 1 + items.length) % items.length)}><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" aria-label="Next product" className={cn(nav, 'absolute right-3 top-1/2 -translate-y-1/2')}
                      onClick={() => setIndex((index! + 1) % items.length)}><ChevronRight className="h-4 w-4" /></button>
                  </>
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <p className="min-w-0 text-sm font-medium text-foreground">{cur.title}</p>
                {cur.price > 0 && <span className="shrink-0 text-base font-semibold tabular-nums">{productPrice(cur)}</span>}
              </div>
              {items.length > 1 && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {items.map((p, i) => (
                    <button key={`${p.rank}-${p.title}-${i}`} type="button" onClick={() => setIndex(i)} aria-label={p.title} aria-current={i === index}
                      className={cn('shrink-0 overflow-hidden rounded-lg border-2 transition-opacity', i === index ? 'border-foreground' : 'border-transparent opacity-70 hover:opacity-100')}>
                      <ProductImage src={p.image!} alt="" className="h-14 w-14 object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <ShopHeader shop={shop} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Opens `open(i)` from a thumbnail; a picture-sized button. */
export function ImageTrigger({ onOpen, label, className, children }: {
  onOpen: () => void; label: string; className?: string; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onOpen} aria-label={`View ${label}`} title={label} className={cn(TRIGGER, className)}>
      {children}
    </button>
  );
}

/**
 * A row's product thumbnails, each opening the gallery at that product. Props
 * only (no render function), so server-rendered tables can use it too.
 */
export function ProductThumbsDetail({ products, max = 3, size = 40, title, shop }: {
  products: Product[]; max?: number; size?: number; title: string; shop?: { id: string; domain: string };
}) {
  return (
    <ProductGallery products={products} title={title} ranked shop={shop}>
      {open => (
        <span className="inline-flex items-center gap-1">
          {products.filter(p => p.image).slice(0, max).map((p, i) => (
            <ImageTrigger key={`${p.rank}-${p.title}`} onOpen={() => open(i)} label={p.title}>
              <ProductImage src={p.image!} alt={p.title} className="rounded-[10px] border border-[var(--a-sep)] object-cover" style={{ width: size, height: size }} />
            </ImageTrigger>
          ))}
        </span>
      )}
    </ProductGallery>
  );
}
