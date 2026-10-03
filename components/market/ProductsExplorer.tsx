'use client';
// The Products explorer: winning products (the products Meta ads point at),
// built like the Shops explorer — the route renders once, then every filter,
// sort and page change is a small JSON fetch (GET /api/products) keyed by the
// query string, with the previous rows kept on screen until the next land.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, CalendarDays, ExternalLink, Globe, LayoutGrid, Users, Wallet, X } from 'lucide-react';
import { PageShell } from '@/components/layouts/page-shell';
import { FilterChip, MarketPagination, SearchBox, ShallowUrlProvider, useSetParam } from '@/components/market/MarketToolbar';
import { SortableHeader } from '@/components/market/SortableHeader';
import { BrandLogo } from '@/components/market/BrandLogo';
import { RankBadge } from '@/components/market/PlatformIcon';
import { ProductImage } from '@/components/ShopMedia';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { compact, flag } from '@/lib/format';
import type { CategoryNode } from '@/lib/market/shops';
import type { WinningProduct } from '@/lib/market/products';
import type { ProductsPayload } from '@/app/(app)/products/load';
import { cn } from '@/lib/utils';

const PRODUCTS_KEY = 'products';

function canonical(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchProducts(qs: string, signal: AbortSignal): Promise<ProductsPayload> {
  const res = await fetch(`/api/products${qs ? `?${qs}` : ''}`, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 401) { window.location.assign('/login'); throw new Error('Signed out'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Products could not be loaded');
  return res.json();
}

const FOCUS = 'outline-none focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'NZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'BR', 'MX', 'JP', 'IN', 'HK'];
const regionName = (() => {
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (c: string) => dn.of(c) ?? c; }
  catch { return (c: string) => c; }
})();

const FILTER_KEYS = ['q', 'category', 'subcategory', 'country', 'currency', 'priceMin', 'priceMax', 'traffic', 'launched'] as const;

function money(n: number, ccy: string): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy }).format(n); }
  catch { return `${n.toFixed(2)} ${ccy}`; }
}

const day = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/** Shopify's CDN resizes on request; ask for a thumbnail instead of the original. */
function thumb(src: string, width: number): string {
  if (!/(^https:\/\/cdn\.shopify\.com\/|\/cdn\/shop\/)/.test(src)) return src;
  try { const u = new URL(src); u.searchParams.set('width', String(width)); return u.toString(); } catch { return src; }
}

/** Price from–to inputs; they only mean something with a currency, so they appear once one is picked. */
function PriceRange() {
  const { set, params } = useSetParam();
  const [min, setMin] = useState(params.get('priceMin') ?? '');
  const [max, setMax] = useState(params.get('priceMax') ?? '');
  useEffect(() => { setMin(params.get('priceMin') ?? ''); setMax(params.get('priceMax') ?? ''); }, [params]);
  const commit = () => {
    const clean = (v: string) => (v.trim() && Number(v) > 0 ? String(Number(v)) : '');
    if (clean(min) !== (params.get('priceMin') ?? '') || clean(max) !== (params.get('priceMax') ?? '')) {
      set({ priceMin: clean(min), priceMax: clean(max) });
    }
  };
  const box = 'h-8 w-24 rounded-full bg-[var(--a-fill)] px-3 text-[13px] tabular-nums text-foreground outline-none placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';
  return (
    <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); commit(); }}>
      <input type="number" inputMode="decimal" min={0} step="any" value={min} onChange={e => setMin(e.target.value)} onBlur={commit}
        placeholder="Min price" aria-label="Minimum price" className={box} />
      <span className="text-muted-foreground" aria-hidden>–</span>
      <input type="number" inputMode="decimal" min={0} step="any" value={max} onChange={e => setMax(e.target.value)} onBlur={commit}
        placeholder="Max price" aria-label="Maximum price" className={box} />
    </form>
  );
}

function Toolbar({ categories, currencies }: { categories: CategoryNode[]; currencies: { code: string; count: number }[] }) {
  const { set, params, pending } = useSetParam();
  const p = (k: string) => params.get(k) ?? '';


  const categoryId = p('category');
  const tabs = useMemo(() => categories.filter(c => c.brandCount > 0 || c.id === categoryId).sort((a, b) => b.brandCount - a.brandCount), [categories, categoryId]);
  const subs = useMemo(() => (categories.find(c => c.id === categoryId)?.children ?? []).filter(c => c.brandCount > 0 || c.id === p('subcategory')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, categoryId, params]);
  const active = FILTER_KEYS.filter(k => k !== 'q' && k !== 'category' && params.get(k)).length;

  return (
    <div className={cn('flex shrink-0 flex-col gap-2 transition-opacity', pending && 'opacity-60')}>
      <div id="product-filters" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&>*]:shrink-0">
        {tabs.length > 0 && (
          <FilterChip icon={LayoutGrid} label="Category" value={categoryId} anyLabel="All categories" showAny={false}
            onChange={v => set({ category: v, subcategory: '' })} options={tabs.map(c => ({ value: c.id, label: c.name }))} />
        )}
          {subs.length > 0 && (
            <FilterChip icon={LayoutGrid} label="Subcategory" value={p('subcategory')} onChange={v => set({ subcategory: v })}
              options={subs.map(c => ({ value: c.id, label: c.name }))} />
          )}
          <FilterChip icon={Globe} label="Ad Country" value={p('country')} onChange={v => set({ country: v })}
            options={COUNTRIES.map(c => ({ value: c, label: `${flag(c)} ${regionName(c)}` }))} />
          <FilterChip icon={Users} label="Store Traffic" value={p('traffic')} onChange={v => set({ traffic: v })} options={[
            { value: '10k', label: '10K+ visits' }, { value: '100k', label: '100K+ visits' },
            { value: '1m', label: '1M+ visits' }, { value: '10m', label: '10M+ visits' },
          ]} />
          <FilterChip icon={CalendarDays} label="First Ad" value={p('launched')} onChange={v => set({ launched: v })} options={[
            { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' }, { value: '180', label: 'Last 6 months' },
          ]} />
          {currencies.length > 0 && (
            <FilterChip icon={Wallet} label="Currency" value={p('currency')}
              onChange={v => set(v ? { currency: v } : { currency: '', priceMin: '', priceMax: '', sort: p('sort') === 'price' ? '' : p('sort') })}
              options={currencies.map(c => ({ value: c.code, label: c.code }))} />
          )}
          {p('currency') && <PriceRange />}
          {active > 0 && (
            <button type="button" onClick={() => set(Object.fromEntries(FILTER_KEYS.filter(k => k !== 'q' && k !== 'category').map(k => [k, ''])))}
              className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-[var(--a-blue)] transition-opacity hover:opacity-80', FOCUS)}>
              <X className="h-3 w-3" /> Clear {active} filter{active > 1 ? 's' : ''}
            </button>
          )}
      </div>
    </div>
  );
}

function Growth({ pct }: { pct: number }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full py-0.5 pl-1.5 pr-2 text-[12px] font-semibold tabular-nums ${
      pct > 0 ? 'bg-[var(--a-green-tint)] text-[var(--a-green)]' : pct < 0 ? 'bg-[var(--a-red-tint)] text-[var(--a-red)]' : 'bg-[var(--a-fill)] text-foreground'}`}>
      {pct > 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : pct < 0 ? <ArrowDownRight className="h-3 w-3" aria-hidden /> : null}
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function ProductRow({ p, rank }: { p: WinningProduct; rank: number }) {
  const s = p.store;
  const shopHref = s.id ? `/shops/shp_${s.id.replace(/[^a-z0-9]/gi, '')}` : null;
  return (
    <TableRow className="group">
      <TableCell><RankBadge rank={rank} /></TableCell>
      <TableCell>
        <div className="flex items-center gap-3 overflow-hidden">
          {p.image && (
            <a href={p.url} target="_blank" rel="noopener" className="shrink-0 empty:hidden" tabIndex={-1} aria-hidden>
              <ProductImage src={thumb(p.image, 112)} alt="" className="h-14 w-14 rounded-[10px] border border-[var(--a-sep)] bg-white object-cover" />
            </a>
          )}
          <div className="min-w-0 flex-1">
            <a href={p.url} target="_blank" rel="noopener" title={`${p.title} — open on ${s.domain}`}
              className="group/t inline-flex max-w-full items-center gap-1 rounded text-[15px] font-semibold tracking-[-0.015em] text-foreground outline-none hover:underline focus-visible:shadow-[0_0_0_4px_var(--a-focus)]">
              <span className="truncate">{p.title}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/t:opacity-60" aria-hidden />
            </a>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
              {(p.productType || p.vendor) && <span className="truncate">{p.productType || p.vendor}</span>}
              {p.publishedAt && <span className="shrink-0">Published {day(p.publishedAt)}</span>}
            </div>
            {/* Phones show only this column, so its two key numbers ride along. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] tabular-nums sm:hidden">
              {p.price != null && p.currency && <span className="font-semibold text-foreground">{money(p.price, p.currency)}</span>}
              {p.activeAds > 0 && <span className="text-foreground"><span className="font-semibold">{compact(p.activeAds)}</span> <span className="text-muted-foreground">active ads</span></span>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {p.price != null && p.currency && (
          <div className="flex flex-col items-end">
            <span className="text-[15px] font-semibold text-foreground">{money(p.price, p.currency)}</span>
            {p.compareAtPrice != null && <span className="text-[12px] text-muted-foreground line-through">{money(p.compareAtPrice, p.currency)}</span>}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo logo={s.logo} domain={s.domain} name={s.title || s.domain} size={28} />
          <div className="min-w-0">
            {shopHref
              ? <Link href={shopHref} className="block truncate text-[14px] font-medium text-foreground hover:underline" title={s.title || s.domain}>{s.domain}</Link>
              : <span className="block truncate text-[14px] font-medium text-foreground">{s.domain}</span>}
            {s.country && <span className="text-[12px] text-muted-foreground">{flag(s.country)} {s.country}</span>}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="text-[15px] font-semibold text-foreground" title={`${p.activeAds.toLocaleString()} active of ${p.ads.toLocaleString()} ads land on this product`}>{compact(p.activeAds)}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {p.newAds14d > 0 && <span className="text-[15px] font-semibold text-[var(--a-purple)]">+{compact(p.newAds14d)}</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {p.pages > 0 && <span className="text-[15px] text-foreground">{p.pages.toLocaleString()}</span>}
      </TableCell>
      <TableCell className="tabular-nums">
        {p.firstAdAt && <span className="text-[14px] text-muted-foreground">{day(p.firstAdAt)}</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {s.visits > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-[15px] font-semibold text-foreground" title={s.trafficSource === 'similarweb' ? 'Monthly visits (SimilarWeb)' : 'Monthly visits (index estimate)'}>{compact(s.visits)}</span>
            {/* Growth only beside a measured figure; the index estimate is captioned as one (docs/architecture.md#traffic). */}
            {s.trafficSource === 'similarweb' && s.visitsGrowthPct != null && <div className="mt-1"><Growth pct={s.visitsGrowthPct} /></div>}
            {s.trafficSource === 'index' && <div className="mt-1 text-[11px] leading-none text-muted-foreground">Index estimate</div>}
          </div>
        )}
      </TableCell>
      <TableCell>
        {p.sampleAds.length > 0 && (
          <div className="flex items-center gap-1.5">
            {p.sampleAds.slice(0, 3).map(a => (
              <Link key={a.id} href={`/ads/${a.id}`} className="shrink-0 overflow-hidden rounded-md empty:hidden" aria-label={`Ad for ${p.title}`}>
                <ProductImage src={a.image} alt="" className="h-10 w-10 border border-[var(--a-sep)] object-cover" />
              </Link>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

const COLUMNS: { label: string; sort?: string; right?: boolean; hint?: string; isDefault?: boolean; width: string }[] = [
  { label: 'Rank', width: 'w-14' },
  { label: 'Product', width: 'w-[18rem]' },
  { label: 'Price', sort: 'price', right: true, hint: 'Storefront price in the store\'s currency', width: 'w-24' },
  { label: 'Store', width: 'w-48' },
  { label: 'Active Ads', sort: 'ads', right: true, isDefault: true, hint: 'Running Meta ads that land on this product', width: 'w-24' },
  { label: 'New Ads (14D)', sort: 'new_ads', right: true, hint: 'Ads started in the last 14 days', width: 'w-28' },
  { label: 'Advertisers', sort: 'pages', right: true, hint: 'Facebook pages running these ads', width: 'w-24' },
  { label: 'First Ad', sort: 'first_ad', hint: 'When the first ad for it started', width: 'w-28' },
  { label: 'Store Traffic', sort: 'traffic', right: true, hint: 'Store monthly visits', width: 'w-28' },
  { label: 'Ads', width: 'w-36' },
];

function ProductsTable({ rows, rankOffset, priceSortable }: { rows: WinningProduct[]; rankOffset: number; priceSortable: boolean }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[var(--a-sep)] bg-[var(--a-card)] shadow-[var(--card-shadow)]">
      <Table containerClassName="table-sticky-id min-h-0 flex-1"
        className="max-sm:[&_tr>*:not(:nth-child(2)):not([colspan])]:hidden sm:min-w-[1300px] table-fixed tracking-[-0.01em] [&_tbody_td]:py-2.5 [&_tbody_tr]:border-[var(--a-sep)] [&_tbody_tr:hover]:bg-[var(--a-row-hover)]">
        <colgroup className="max-sm:hidden">{COLUMNS.map(c => <col key={c.label} className={c.width} />)}</colgroup>
        <TableHeader className="sticky top-0 z-10 [&_th]:bg-[var(--a-glass)] [&_th]:shadow-[inset_0_-1px_0_var(--a-sep)] [&_th]:backdrop-blur-xl [&_th]:text-[12px] [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-normal [&_th_button]:text-[12px] [&_th_button]:font-semibold [&_th_button]:normal-case [&_th_button]:tracking-normal [&_tr]:border-[var(--a-sep)]">
          <TableRow>
            {COLUMNS.map(c => c.sort && (c.sort !== 'price' || priceSortable) ? (
              <SortableHeader key={c.label} label={c.label} sortKey={c.sort} isDefault={c.isDefault} hint={c.hint} align={c.right ? 'right' : 'left'} />
            ) : (
              <TableHead key={c.label} className={c.right ? 'text-right' : undefined} title={c.hint}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0
            ? <TableEmpty colSpan={COLUMNS.length}>No products match these filters.</TableEmpty>
            : rows.map((p, i) => <ProductRow key={p.key} p={p} rank={rankOffset + i + 1} />)}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProductsExplorer({ categories, initial, initialParams, renderedAt }: {
  categories: CategoryNode[];
  /** The page the server rendered for `initialParams`; null when it could not be loaded. */
  initial: ProductsPayload | null;
  initialParams: Record<string, string>;
  renderedAt: number;
}) {
  const params = useSearchParams();
  const qs = canonical(params);
  const initialQs = useMemo(() => canonical(new URLSearchParams(initialParams)), [initialParams]);

  const q = useQuery({
    queryKey: [PRODUCTS_KEY, qs],
    queryFn: ({ signal }) => fetchProducts(qs, signal),
    initialData: qs === initialQs && initial ? initial : undefined,
    initialDataUpdatedAt: renderedAt,
    placeholderData: keepPreviousData,
    // While the list is still being gathered, look again every 30s.
    refetchInterval: query => (query.state.data?.building ? 30_000 : false),
  });
  const shownKey = useRef(qs);
  if (!q.isPlaceholderData && q.data) shownKey.current = qs;

  const data = q.data;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const qc = useQueryClient();
  useEffect(() => {
    if (!data || q.isPlaceholderData || !data.hasMore) return;
    const next = new URLSearchParams(params);
    next.set('page', String(page + 1));
    const nextQs = canonical(next);
    void qc.prefetchQuery({ queryKey: [PRODUCTS_KEY, nextQs], queryFn: ({ signal }) => fetchProducts(nextQs, signal) });
  }, [data, q.isPlaceholderData, page, params, qc]);

  // Currencies are a property of the whole list; keep the last known set while a page loads.
  const currencies = useRef<{ code: string; count: number }[]>(initial?.currencies ?? []);
  if (data?.currencies.length) currencies.current = data.currencies;

  return (
    <ShallowUrlProvider>
      <PageShell fullHeight className="apple-ui gap-3 bg-[var(--a-canvas)]" title={<span title="Winning products: the storefront products Meta ads send traffic to, ranked by the ads behind them.">Products</span>}
        actions={<SearchBox placeholder="Search products, brands, stores…" label="Search products, brands, stores" />}>
        <Toolbar categories={categories} currencies={currencies.current} />

        {q.isError && (
          <div role="alert" className="alert-error flex shrink-0 items-center justify-between gap-3 rounded-2xl text-sm">
            <span>{q.error instanceof Error ? q.error.message : 'Products could not be loaded'}.</span>
            <button type="button" onClick={() => q.refetch()} className="font-medium underline">Try again</button>
          </div>
        )}

        {data?.building ? (
          <div role="status" className="rounded-[22px] border border-[var(--a-sep)] bg-[var(--a-card)] p-8 text-center text-[15px] text-muted-foreground">
            Products are being gathered, check back in a minute.
          </div>
        ) : data && (
          <div aria-busy={q.isPlaceholderData}
            className={cn('flex min-h-0 flex-1 flex-col transition-opacity', q.isPlaceholderData && 'pointer-events-none opacity-60')}>
            <ProductsTable key={shownKey.current} rows={data.items} rankOffset={(page - 1) * data.limit} priceSortable={!!params.get('currency')} />
          </div>
        )}

        {data && !data.building && <MarketPagination page={page} total={data.total} limit={data.limit} hasMore={data.hasMore} />}
      </PageShell>
    </ShallowUrlProvider>
  );
}
