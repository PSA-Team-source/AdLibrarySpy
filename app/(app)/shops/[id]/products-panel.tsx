'use client';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import { ProductImage } from '@/components/ShopMedia';

function price(p: Product): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(p.price);
  } catch {
    return p.price.toFixed(2);
  }
}

function created(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Products in the storefront's own order. Each toggle exists only when the
 * store rendered that sort; a rank badge only where the order is a ranking.
 */
export default function ProductsPanel({ count, bestSelling, latest, fallback }: {
  count: number | null; bestSelling: Product[]; latest: Product[]; fallback: Product[];
}) {
  const views = [
    ...(bestSelling.length ? [{ key: 'best', label: 'Best Seller', items: bestSelling, ranked: true }] : []),
    ...(latest.length ? [{ key: 'latest', label: 'Last published', items: latest, ranked: false }] : []),
  ];
  const [view, setView] = useState(views[0]?.key ?? '');
  const active = views.find(v => v.key === view) ?? { key: '', label: '', items: fallback, ranked: false };
  const items = active.items.filter(p => p.image).slice(0, 12);
  if (!items.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Products</div>
          {count != null && count > 0 && <div className="mt-1 text-2xl font-semibold tabular-nums">{count.toLocaleString()}</div>}
        </div>
        {views.length > 0 && (
          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium" role="group" aria-label="Product order">
            {views.map(v => (
              <button key={v.key} type="button" onClick={() => setView(v.key)} aria-pressed={active.key === v.key}
                className={`rounded-md px-3 py-1.5 ${active.key === v.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{v.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map(p => (
          <div key={`${active.key}-${p.rank}-${p.title}`} className="min-w-0">
            <div className="relative overflow-hidden rounded-lg">
              <ProductImage src={p.image!} alt={p.title} className="aspect-square w-full rounded-lg border border-border object-cover" />
              {active.ranked && <span className="absolute right-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">#{p.rank}</span>}
            </div>
            <div className="mt-2 truncate text-xs font-medium text-foreground" title={p.title}>{p.title}</div>
            {p.price > 0 && <div className="text-sm font-semibold tabular-nums">{price(p)}</div>}
            {p.createdAt && created(p.createdAt) && <div className="text-[11px] text-muted-foreground">Created: {created(p.createdAt)}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
