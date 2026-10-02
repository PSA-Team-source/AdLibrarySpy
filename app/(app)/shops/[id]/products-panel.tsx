'use client';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import { ProductImage } from '@/components/ShopMedia';
import { ImageTrigger, ProductGallery, productPrice } from '@/components/market/DetailDialogs';

/** Rows per catalogue page (lib/market/storefront.ts CATALOG_PAGE; not imported: server module). */
const CATALOG_PAGE = 48;
const STEP = 24;

function created(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The store's products. "All products" is the whole published catalogue with
 * prices (paged from /products.json, "Show more" reveals and then fetches the
 * next page); "Best Seller" and "Last published" exist only when the storefront
 * rendered that sort, and a rank badge only where the order is a ranking.
 */
export default function ProductsPanel({ count, bestSelling, latest, fallback, catalog = [], domain = '' }: {
  count: number | null; bestSelling: Product[]; latest: Product[]; fallback: Product[];
  catalog?: Product[]; domain?: string;
}) {
  const [all, setAll] = useState(catalog);
  const views = [
    ...(bestSelling.length ? [{ key: 'best', label: 'Best Seller', items: bestSelling, ranked: true }] : []),
    ...(latest.length ? [{ key: 'latest', label: 'Last published', items: latest, ranked: false }] : []),
    ...(all.length ? [{ key: 'all', label: 'All products', items: all, ranked: false }] : []),
  ];
  // A best-seller strip of a handful beside a full catalogue undersells the
  // store: open on the catalogue unless the ranking fills a grid.
  const [view, setView] = useState((bestSelling.length >= 12 || !all.length ? views[0]?.key : 'all') ?? '');
  const [shown, setShown] = useState(STEP);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = views.find(v => v.key === view) ?? { key: '', label: '', items: fallback, ranked: false };
  const pictured = active.items.filter(p => p.image);
  const items = active.key === 'all' ? pictured.slice(0, shown) : pictured.slice(0, 12);
  if (!items.length) return null;

  // Another /products.json page exists while every page so far came back full.
  const morePages = active.key === 'all' && !failed && domain !== '' && all.length > 0 && all.length % CATALOG_PAGE === 0
    && (count == null || all.length < count);
  const canShowMore = active.key === 'all' && (shown < pictured.length || morePages);

  async function showMore() {
    if (shown < pictured.length) { setShown(s => s + STEP); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/shops/products?domain=${encodeURIComponent(domain)}&page=${all.length / CATALOG_PAGE + 1}`);
      const next = res.ok ? ((await res.json()).products as Product[]) : [];
      if (!next.length) setFailed(true);
      else { setAll(a => [...a, ...next]); setShown(s => s + STEP); }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    // #products: the Shops table's product thumbnails land here.
    <section id="products" className="scroll-mt-20 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Products</div>
          {count != null && count > 0 && <div className="mt-1 text-2xl font-semibold tabular-nums">{count.toLocaleString()}</div>}
        </div>
        {views.length > 1 && (
          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-medium" role="group" aria-label="Product order">
            {views.map(v => (
              <button key={v.key} type="button" onClick={() => { setView(v.key); setShown(STEP); }} aria-pressed={active.key === v.key}
                className={`rounded-md px-3 py-1.5 ${active.key === v.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{v.label}</button>
            ))}
          </div>
        )}
      </div>
      <ProductGallery products={items} title={active.label || 'Products'} ranked={active.ranked}>
      {open => (
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((p, i) => p.image && (
          // No picture, no tile: the tile shows only while its image exists.
          <div key={`${active.key}-${i}-${p.title}`} className="hidden min-w-0 has-[img]:block">
            <div className="relative overflow-hidden rounded-lg">
              <ImageTrigger onOpen={() => open(i)} label={p.title} className="block w-full">
                <ProductImage src={p.image!} alt={p.title} className="aspect-square w-full rounded-lg border border-border object-cover" />
              </ImageTrigger>
              {active.ranked && <span className="absolute right-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">#{p.rank}</span>}
            </div>
            {p.url
              ? <a href={p.url} target="_blank" rel="noopener" className="mt-2 block truncate text-xs font-medium text-foreground hover:underline" title={p.title}>{p.title}</a>
              : <div className="mt-2 truncate text-xs font-medium text-foreground" title={p.title}>{p.title}</div>}
            {p.price > 0 && <div className="text-sm font-semibold tabular-nums">{productPrice(p)}</div>}
            {p.createdAt && created(p.createdAt) && <div className="text-[11px] text-muted-foreground">Created: {created(p.createdAt)}</div>}
          </div>
        ))}
      </div>
      )}
      </ProductGallery>
      {canShowMore && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={showMore} disabled={loading}
            className="inline-flex h-9 items-center rounded-full bg-[var(--a-fill)] px-4 text-sm font-medium text-foreground transition-colors hover:bg-[var(--a-fill-hover)] disabled:opacity-60">
            {loading ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
    </section>
  );
}
