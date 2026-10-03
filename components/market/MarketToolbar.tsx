'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { createContext, useCallback, useContext, useTransition, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, X,
  LayoutGrid, Store, Eye, Crosshair, ShoppingBag, type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CategoryNode, ProfileKey, TechFacets } from '@/lib/market/shops';
import { MARKET_PLATFORM_FILTERS } from '@/lib/market-platforms';
import { ExportCsv } from './ExportCsv';
import { ShopFilterChips, SHOP_FILTER_KEYS } from './ShopFilterChips';

/** Debounce a value: returns the value only after `delay` ms of inactivity. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Screens that fetch their own rows from the URL (Shops, like PlatformDTC's
 * Top Brands) wrap the toolbar in this: a filter/sort/page change then only
 * rewrites the address bar — Next keeps useSearchParams in sync with
 * history.pushState — instead of re-rendering the whole route on the server.
 */
const ShallowUrl = createContext(false);
export function ShallowUrlProvider({ children }: { children: ReactNode }) {
  return <ShallowUrl.Provider value>{children}</ShallowUrl.Provider>;
}

export function useGo() {
  const router = useRouter();
  const shallow = useContext(ShallowUrl);
  return useCallback((url: string) => {
    if (shallow) window.history.pushState(null, '', url); else router.push(url);
  }, [router, shallow]);
}

function useSetParam() {
  const go = useGo();
  const router = useRouter();
  const shallow = useContext(ShallowUrl);
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const hrefFor = useCallback((entries: Record<string, string>) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    for (const [k, v] of Object.entries(entries)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    p.delete('page');
    return `${pathname}?${p.toString()}`;
  }, [params, pathname]);
  const set = useCallback((entries: Record<string, string>) => {
    start(() => go(hrefFor(entries)));
  }, [go, hrefFor]);
  // Renders a filter's result in the background (full RSC, kept per
  // next.config staleTimes) so picking it swaps instantly instead of waiting a
  // round trip to the US origin (~360ms from Asia before any work).
  const prefetch = useCallback((entries: Record<string, string>) => {
    if (!shallow) router.prefetch(hrefFor(entries), { kind: 'full' as PrefetchKind });
  }, [router, shallow, hrefFor]);
  return { set, prefetch, params, pending };
}

// Market filter recipes, in Apple's language: borderless capsules on the
// system grey fill (--a-fill, base.css), the picked one filled with the label
// colour, and a soft blue focus halo instead of a hard ring.
export const FOCUS = 'outline-none focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';

// Top Brands' platform and category rows: capsules, grey until picked.
export const TB_PILL = `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors ${FOCUS}`;

export const CHIP = `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors ${FOCUS}`;
export const CHIP_OFF = 'bg-[var(--a-fill)] text-foreground hover:bg-[var(--a-fill-hover)]';
export const CHIP_ON = 'bg-foreground text-background';

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

/** Filters that count toward the "N active" badge and the Clear button. */
const FILTER_KEYS = [...SHOP_FILTER_KEYS, 'category', 'subcategory', 'viewed', 'tracked', 'q'] as const;

interface Option { value: string; label: string }

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest',
  twitter: 'X (Twitter)', linkedin: 'LinkedIn', snapchat: 'Snapchat', whatsapp: 'WhatsApp',
};

/**
 * The chip's text once an option is picked. The option's shop count belongs in
 * the menu, not on the chip; an option that already names the chip ("Not
 * viewed", "In Brandtracker") stands alone instead of "Viewed: Not viewed".
 */
function chosen(label: string, option: string): string {
  const bare = option.replace(/ \([\d.,]+[KM]?\)$/, '');
  return bare.toLowerCase().includes(label.toLowerCase()) ? bare : `${label}: ${bare}`;
}

/**
 * The store platform chip every market list shows (Shops, Ads, Products,
 * Landing pages). No `platform` in the URL = Shopify, the loaders' default;
 * `platform=all` = every platform.
 */
export function PlatformChip({ params, set, prefetch }: {
  params: { get(key: string): string | null };
  set: (e: Record<string, string>) => void; prefetch?: (e: Record<string, string>) => void;
}) {
  const platform = params.get('platform') || 'shopify';
  const value = (v: string) => (v === 'shopify' ? '' : v || 'all');
  return (
    <FilterChip icon={Store} label="Platform" value={platform === 'all' ? '' : platform}
      anyLabel="All platforms" showAny={false}
      onChange={v => set({ platform: value(v) })} onPrefetch={prefetch && (v => prefetch({ platform: value(v) }))}
      options={MARKET_PLATFORM_FILTERS.filter(pl => pl.id !== 'all').map(pl => ({ value: pl.id, label: pl.name }))} />
  );
}

/**
 * A filter chip: icon + label + chevron; picking an option sets one URL param.
 * `searchable` adds a type-to-filter box for long option lists (technologies).
 */
export function FilterChip({ icon: Icon, label, value, options, onChange, badge, searchable, anyLabel = 'Any', showAny = anyLabel !== 'Any', title, onPrefetch }: {
  icon: LucideIcon; label: string; value: string; options: Option[];
  onChange: (v: string) => void; badge?: string; searchable?: boolean;
  /** Text of the "no choice" item (e.g. a sort's default order). */
  anyLabel?: string; title?: string;
  /** Print "Label: <anyLabel>" on the chip when nothing is picked (default: when anyLabel is custom). */
  showAny?: boolean;
  /** Called with an option's value when it is hovered or focused (prefetch its result).
   *  One at a time: warming every option on open queued ~16 full renders ahead of the click. */
  onPrefetch?: (value: string) => void;
}) {
  const active = options.find(o => o.value === value);
  const [needle, setNeedle] = useState('');
  const needleRef = useRef<HTMLInputElement>(null);
  const shown = needle
    ? options.filter(o => o.label.toLowerCase().includes(needle.trim().toLowerCase()))
    : options;
  return (
    <DropdownMenu onOpenChange={o => { if (!o) setNeedle(''); }}>
      <DropdownMenuTrigger className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)} aria-label={label} title={title}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{active ? chosen(label, active.label) : showAny ? `${label}: ${anyLabel}` : label}</span>
        {badge && !active && <span className="rounded-full bg-[var(--a-green)] px-1.5 py-px text-[10px] font-semibold text-white">{badge}</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto rounded-xl p-1.5"
        // Radix focuses the menu itself on open (after any focus call we make),
        // so typing jumped between items; pass that focus on to the search box.
        onFocus={searchable ? e => { if (e.target === e.currentTarget) needleRef.current?.focus(); } : undefined}>
        {searchable && (
          <div className="sticky -top-1 z-10 -mx-1 -mt-1 mb-1 bg-popover p-1">
          <input
            ref={needleRef}
            type="search"
            value={needle}
            onChange={e => setNeedle(e.target.value)}
            // Keep the menu's typeahead from swallowing the keystrokes.
            onKeyDown={e => e.stopPropagation()}
            placeholder={`Search ${label.toLowerCase()}…`}
            aria-label={`Search ${label.toLowerCase()}`}
            className="w-full rounded-lg bg-[var(--a-fill)] px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_4px_var(--a-focus)]"
          />
          </div>
        )}
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value="" onFocus={value && onPrefetch ? () => onPrefetch('') : undefined}>{anyLabel}</DropdownMenuRadioItem>
          {shown.map(o => (
            <DropdownMenuRadioItem key={o.value} value={o.value}
              onFocus={onPrefetch && o.value !== value ? () => onPrefetch(o.value) : undefined}>{o.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketToolbar({ categories, hiddenCount = 0, tech = null, views }: {
  /** Preset views (Segments), placed on the same row as the dropdowns. */
  views?: ReactNode;
  categories: CategoryNode[];
  /** Shops this workspace has hidden; > 0 shows the "Hidden" toggle. */
  hiddenCount?: number;
  /** Detected technologies with shop counts; each chip renders only when it has options. */
  tech?: TechFacets | null;
}) {
  const { set, params, pending } = useSetParam();
  const categoryId = params.get('category') ?? '';
  const subId = params.get('subcategory') ?? '';
  const p = (k: string) => params.get(k) ?? '';

  // Subcategories belong to the chosen parent; the second chip only appears
  // once a parent is picked, so the control count stays low by default. A
  // category no shop of the served month is filed under is not offered: it
  // could only return an empty table. (The selected one always stays listed.)
  const subcategories = useMemo(
    () => (categories.find(c => c.id === categoryId)?.children ?? []).filter(c => c.brandCount > 0 || c.id === subId),
    [categories, categoryId, subId],
  );
  // Top Brands' category row: top-level categories, most brands first.
  const categoryTabs = useMemo(
    () => categories.filter(c => c.brandCount > 0 || c.id === categoryId).sort((a, b) => b.brandCount - a.brandCount),
    [categories, categoryId],
  );
  const pixelOptions = useMemo(
    () => (tech?.pixels ?? []).map(t => ({ value: t.name, label: `${t.name} (${compact(t.count)})` })),
    [tech],
  );
  const techOptions = useMemo(
    () => (tech?.technologies ?? []).map(t => ({ value: t.name, label: `${t.name} (${compact(t.count)})` })),
    [tech],
  );

  // StoreLeads profile chips: plain names, never codes ("German", not "de").
  const profileOptions = useMemo(() => {
    const prof = tech?.profile;
    const out = {} as Record<ProfileKey, Option[]>;
    if (!prof) return null;
    const names = (type: 'language' | 'currency') => {
      try { return new Intl.DisplayNames(['en'], { type }); } catch { return null; }
    };
    const lang = names('language'), ccy = names('currency');
    const title = (v: string) => v.replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase());
    const label: Record<ProfileKey, (v: string) => string> = {
      language: v => lang?.of(v) || v.toUpperCase(),
      currency: v => (ccy?.of(v) && ccy.of(v) !== v ? `${ccy.of(v)} (${v})` : v),
      theme: title,
      social: v => SOCIAL_LABELS[v] ?? title(v),
      app: v => v,
    };
    for (const k of Object.keys(label) as ProfileKey[]) {
      out[k] = prof[k].map(t => ({ value: t.name, label: `${label[k](t.name)} (${compact(t.count)})` }));
    }
    return out;
  }, [tech]);

  const activeCount = FILTER_KEYS.filter(k => params.get(k)).length;
  const showingHidden = p('hidden') === 'show';

  // Row 1: preset views + Hidden/Export. Row 2: every filter side by side in
  // one row that scrolls sideways — no "Filters" button to open first. Search
  // sits beside the page title (SearchBox); sorting lives on the column headers.
  return (
    <div className={cn('flex shrink-0 flex-col gap-2 transition-opacity', pending && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{views}</div>
        {(hiddenCount > 0 || showingHidden) && (
          <button type="button" onClick={() => set({ hidden: showingHidden ? '' : 'show' })} aria-pressed={showingHidden}
            className={cn(CHIP, 'shrink-0', showingHidden ? CHIP_ON : CHIP_OFF)}>
            {showingHidden ? 'Back to Shops' : `Hidden (${hiddenCount.toLocaleString()})`}
          </button>
        )}
        <ExportCsv kind="shops" className={cn(CHIP, 'h-9 shrink-0 disabled:opacity-60', CHIP_OFF)} />
      </div>

      <div id="shop-filters" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [&>*]:shrink-0">
        <PlatformChip params={params} set={set} />
        {categoryTabs.length > 0 && (
          <FilterChip icon={LayoutGrid} label="Category" value={categoryId} anyLabel="All categories" showAny={false}
            onChange={v => set({ category: v, subcategory: '' })}
            options={categoryTabs.map(c => ({ value: c.id, label: c.name }))} />
        )}
        <ShopFilterChips params={params} set={set} tech={tech} profileOptions={profileOptions}
          techOptions={techOptions} pixelOptions={pixelOptions}
          before={<>
            {/* Without niche facets the category row's sub-categories stay the niche filter. */}
            {!tech?.niches?.some(n => n.count > 0) && subcategories.length > 0 && (
              <FilterChip icon={LayoutGrid} label="Subcategory" value={subId} onChange={v => set({ subcategory: v })}
                options={subcategories.map(c => ({ value: c.id, label: `${c.name} (${compact(c.brandCount)})` }))} />
            )}
            <FilterChip icon={Eye} label="Viewed" value={p('viewed')} onChange={v => set({ viewed: v })} anyLabel="All" showAny={false} options={[
              { value: 'only', label: 'Viewed' }, { value: 'exclude', label: 'New (not viewed)' },
            ]} />
            <FilterChip icon={Crosshair} label="Brandtracker" value={p('tracked')} onChange={v => set({ tracked: v })} anyLabel="All" showAny={false} options={[
              { value: 'only', label: 'In Brandtracker' }, { value: 'exclude', label: 'Not in Brandtracker' },
            ]} />
          </>}
          plan={
            <FilterChip icon={ShoppingBag} label="Shopify Plan" value={p('plan')} onChange={v => set({ plan: v })} anyLabel="All plans" showAny={false} options={[
              { value: 'plus', label: 'Only Shopify Plus' }, { value: 'non-plus', label: 'Not Shopify Plus' },
            ]} />
          } />

        {activeCount > 0 && (
          <button
            onClick={() => set(Object.fromEntries(FILTER_KEYS.map(k => [k, ''])))}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-[var(--a-blue)] transition-opacity hover:opacity-80', FOCUS)}
          >
            <X className="h-3 w-3" /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}


/** A list's search box (URL param `q`); sits on the title row so the list keeps the height. */
export function SearchBox({ placeholder = 'Search shops, keywords…', label = 'Search shops, keywords' }: { placeholder?: string; label?: string }) {
  const { set, params, pending } = useSetParam();
  const [term, setTerm] = useState(params.get('q') ?? '');
  // Sync input when URL changes externally (e.g. Clear button)
  useEffect(() => { setTerm(params.get('q') ?? ''); }, [params]);
  // /shops paints from the edge before it hydrates; hydration keeps what was
  // typed in the box in that window, so adopt it (declared after the URL sync
  // above, which would otherwise reset it to the URL's value on mount).
  const termRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const typed = termRef.current?.value ?? '';
    if (typed && typed !== (params.get('q') ?? '')) setTerm(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search: debounce the raw term and push to URL when it settles
  const debouncedTerm = useDebounce(term, 300);
  useEffect(() => {
    const currentQ = params.get('q') ?? '';
    if (debouncedTerm !== currentQ) {
      set({ q: debouncedTerm });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  return (
    <form
      className={cn('relative w-full sm:w-72 lg:w-96', pending && 'opacity-60')}
      onSubmit={e => { e.preventDefault(); set({ q: term.trim() }); }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
      <input
        ref={termRef}
        type="search"
        value={term}
        onChange={e => setTerm(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 w-full rounded-[10px] bg-[var(--a-fill)] pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none text-[15px] tracking-[-0.01em] text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_4px_var(--a-focus)]"
      />
      {term && (
        <button type="button" onClick={() => { setTerm(''); set({ q: '' }); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

export { useSetParam, useDebounce };

export function Segments({ items }: { items: { value: string; label: string }[] }) {
  const { set, params } = useSetParam();
  const cur = params.get('view') ?? '';
  const sorted = !!params.get('sort');
  return (
    <div className="shrink-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1.5">
      {items.map(it => {
        const active = cur === it.value && !sorted;
        return (
          <button
            key={it.value}
            // Clearing sort/dir mirrors SortableHeader clearing `view`:
            // whichever the reader touched last is the one that applies.
            onClick={() => set({ view: it.value, sort: '', dir: '' })}
            aria-pressed={active}
            className={cn(CHIP, "h-9", active ? CHIP_ON : CHIP_OFF)}
          >
            {it.label}
          </button>
        );
      })}
      </div>
    </div>
  );
}

/**
 * Pagination. `total` is null when the count describes more rows than we can
 * render, so we fall back to Prev/Next rather than compute a wrong page count.
 */
export function MarketPagination({ page, total, limit, hasMore }: {
  page: number; total: number | null; limit: number; hasMore?: boolean;
}) {
  const navigate = useGo();
  const params = useSearchParams();
  const pathname = usePathname();
  const go = (p: number) => {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.set('page', String(p));
    navigate(`${pathname}?${q.toString()}`);
  };

  const totalPages = total != null ? Math.max(1, Math.ceil(total / limit)) : null;
  const canNext = totalPages != null ? page < totalPages : !!hasMore;
  if (page <= 1 && !canNext) return null;

  const nums: number[] = [];
  if (totalPages != null) {
    const first = Math.max(1, Math.min(totalPages - 4, page - 2));
    for (let i = 0; i < Math.min(5, totalPages); i++) {
      const n = first + i;
      if (n >= 1 && n <= totalPages) nums.push(n);
    }
  }

  // Pagination buttons are the filter capsules: grey fill, the current page filled.
  const btn = `inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--a-fill)] px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--a-fill-hover)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--a-fill)] sm:px-4 ${FOCUS}`;

  return (
    <nav className="flex shrink-0 flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      {/* Arrow-only on a phone so the row fits one line. */}
      <button onClick={() => go(page - 1)} disabled={page <= 1} className={btn} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
      </button>
      {nums.length > 0 ? nums.map(n => (
        <button key={n} onClick={() => go(n)} aria-current={n === page ? 'page' : undefined}
          className={cn('inline-flex h-9 min-w-9 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium tabular-nums transition-colors', FOCUS,
            n === page ? 'bg-foreground text-background' : 'text-foreground hover:bg-[var(--a-fill)]')}>
          {n}
        </button>
      )) : (
        <span className="px-3 text-sm text-muted-foreground">Page {page}</span>
      )}
      <button onClick={() => go(page + 1)} disabled={!canNext} className={btn} aria-label="Next page">
        <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

/**
 * A loading skeleton that mirrors the shops table — rendered while a navigation
 * transition is pending so the user sees something is happening.
 */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  const bar = 'animate-pulse rounded bg-foreground/10';
  return (
    <Table containerClassName="table-sticky-id min-h-0 flex-1" className="min-w-[1230px] table-fixed">
      <colgroup>
        <col className="w-12" /><col className="w-56" /><col className="w-44" /><col className="w-32" />
        <col className="w-28" /><col className="w-24" /><col className="w-28" />
        <col className="w-44" /><col className="w-20" /><col className="w-12" />
      </colgroup>
      <TableHeader className="sticky top-0 z-10 [&_th]:bg-card">
        <TableRow>
          {['RANK','BRAND','POPULARITY','REVENUE','GROWTH','AOV','PEAK ADS','PRODUCTS','LAUNCHED',''].map((h, i) => (
            <TableHead key={`${h}-${i}`} scope="col"
              className={cn(['REVENUE','GROWTH','AOV','PEAK ADS'].includes(h) && 'text-right')}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, i) => (
          <TableRow key={i}>
            <TableCell><div className={cn(bar, 'h-5 w-8')} /></TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className={cn(bar, 'h-11 w-11 shrink-0 rounded-lg')} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className={cn(bar, 'h-3.5 w-36')} />
                  <div className={cn(bar, 'h-3 w-24')} />
                </div>
              </div>
            </TableCell>
            <TableCell><div className={cn(bar, 'h-4 w-16')} /></TableCell>
            <TableCell><div className={cn(bar, 'ml-auto h-4 w-14')} /></TableCell>
            <TableCell><div className={cn(bar, 'ml-auto h-4 w-12')} /></TableCell>
            <TableCell><div className={cn(bar, 'ml-auto h-4 w-10')} /></TableCell>
            <TableCell><div className={cn(bar, 'ml-auto h-4 w-10')} /></TableCell>
            <TableCell><div className={cn(bar, 'h-10 w-28')} /></TableCell>
            <TableCell><div className={cn(bar, 'h-4 w-8')} /></TableCell>
            <TableCell><div className={cn(bar, 'ml-auto h-5 w-5')} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
