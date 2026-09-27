'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useTransition, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, X, Users, TrendingUp, Package, Store, Globe, SlidersHorizontal,
  LayoutGrid, CalendarDays, Eye, EyeOff, Crosshair, Radar, Blocks, type LucideIcon,
} from 'lucide-react';
import { flag } from '@/lib/format';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CategoryNode, TechFacets } from '@/lib/market/shops';
import { MARKET_PLATFORM_FILTERS } from '@/lib/market-platforms';
import { PlatformIcon } from './PlatformIcon';
import { ExportCsv } from './ExportCsv';

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
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const set = useCallback((entries: Record<string, string>) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    for (const [k, v] of Object.entries(entries)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    p.delete('page');
    start(() => go(`${pathname}?${p.toString()}`));
  }, [params, pathname, go]);
  return { set, params, pending };
}

// Market filter recipes, in Apple's language: borderless capsules on the
// system grey fill (--a-fill, base.css), the picked one filled with the label
// colour, and a soft blue focus halo instead of a hard ring.
const FOCUS = 'outline-none focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';
const PILL = `inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${FOCUS}`;
const PILL_ON = 'bg-foreground text-background';
const PILL_OFF = 'bg-[var(--a-fill)] text-foreground hover:bg-[var(--a-fill-hover)]';

// Top Brands' platform and category rows: capsules, grey until picked.
const TB_PILL = `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors ${FOCUS}`;
const TB_ON = 'bg-foreground text-background';
const TB_OFF = 'bg-[var(--a-fill)] text-foreground hover:bg-[var(--a-fill-hover)]';

const CHIP = `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors ${FOCUS}`;
const CHIP_OFF = 'bg-[var(--a-fill)] text-foreground hover:bg-[var(--a-fill-hover)]';
const CHIP_ON = 'bg-foreground text-background';

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'BR', 'MX', 'JP', 'IN'];
const regionName = (() => {
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return (c: string) => dn.of(c) ?? c;
  } catch {
    return (c: string) => c;
  }
})();
const countryOptions = COUNTRIES.map(c => ({ value: c, label: `${flag(c)} ${regionName(c)}` }));

/** Filters that count toward the "N active" badge and the Clear button. */
const FILTER_KEYS = ['traffic', 'growth', 'productsMin', 'country', 'visitorCountry', 'category', 'subcategory', 'created', 'viewed', 'tracked', 'pixel', 'tech', 'q'] as const;

interface Option { value: string; label: string }

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
 * A filter chip: icon + label + chevron; picking an option sets one URL param.
 * `searchable` adds a type-to-filter box for long option lists (technologies).
 */
export function FilterChip({ icon: Icon, label, value, options, onChange, badge, searchable }: {
  icon: LucideIcon; label: string; value: string; options: Option[];
  onChange: (v: string) => void; badge?: string; searchable?: boolean;
}) {
  const active = options.find(o => o.value === value);
  const [needle, setNeedle] = useState('');
  const needleRef = useRef<HTMLInputElement>(null);
  const shown = needle
    ? options.filter(o => o.label.toLowerCase().includes(needle.trim().toLowerCase()))
    : options;
  return (
    // Radix focuses the menu on open, so typed letters jumped between items
    // instead of reaching the search box; focus it once the menu has mounted.
    <DropdownMenu onOpenChange={o => {
      if (!o) setNeedle('');
      else if (searchable) requestAnimationFrame(() => needleRef.current?.focus());
    }}>
      <DropdownMenuTrigger className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)} aria-label={label}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{active ? chosen(label, active.label) : label}</span>
        {badge && !active && <span className="rounded-full bg-[var(--a-green)] px-1.5 py-px text-[10px] font-semibold text-white">{badge}</span>}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto rounded-xl p-1.5">
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
          <DropdownMenuRadioItem value="">Any</DropdownMenuRadioItem>
          {shown.map(o => <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketToolbar({ categories, hiddenCount = 0, tech = null }: {
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
  // No platform in the URL = Shopify (the loader's default), as the list shows.
  const platform = params.get('platform') || 'shopify';
  const pixelOptions = useMemo(
    () => (tech?.pixels ?? []).map(t => ({ value: t.name, label: `${t.name} (${compact(t.count)})` })),
    [tech],
  );
  const techOptions = useMemo(
    () => (tech?.technologies ?? []).map(t => ({ value: t.name, label: `${t.name} (${compact(t.count)})` })),
    [tech],
  );

  const activeCount = FILTER_KEYS.filter(k => params.get(k)).length;
  // The filter chips fold away behind one button so the table gets the height
  // (feedback: only 3 stores fit). Remembered per browser; a per-viewer
  // convenience, so a blocked storage just means it opens closed.
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    try { setFiltersOpen(localStorage.getItem('shops.filtersOpen') === '1'); } catch { /* storage blocked */ }
  }, []);
  const toggleFilters = () => setFiltersOpen(open => {
    try { localStorage.setItem('shops.filtersOpen', open ? '0' : '1'); } catch { /* storage blocked */ }
    return !open;
  });
  const hideViewed = p('viewed') === 'exclude';
  const showingHidden = p('hidden') === 'show';

  // Top Brands' platform row and category row, then search + view toggles,
  // then the filter chips. Sorting lives on the table's column headers.
  return (
    <div className={cn('flex shrink-0 flex-col gap-2 transition-opacity', pending && 'opacity-60')}>
      <div className="flex flex-wrap gap-1.5">
        {MARKET_PLATFORM_FILTERS.map(pl => (
          <button key={pl.id} type="button" onClick={() => set({ platform: pl.id === 'shopify' ? '' : pl.id })}
            aria-pressed={platform === pl.id} className={cn(TB_PILL, platform === pl.id ? TB_ON : TB_OFF)}>
            <PlatformIcon platform={pl.id} className="h-4 w-4 shrink-0" />
            {(pl.id === 'all' || pl.id === 'other') && <span className={cn('h-3 w-3 shrink-0 rounded-full', pl.color)} aria-hidden />}
            {pl.name}
          </button>
        ))}
      </div>

      {categoryTabs.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1.5">
            {[{ id: '', name: 'All Categories' }, ...categoryTabs].map(c => (
              <button key={c.id || 'all'} type="button" onClick={() => set({ category: c.id, subcategory: '' })}
                aria-pressed={categoryId === c.id} className={cn(TB_PILL, categoryId === c.id ? TB_ON : TB_OFF)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={e => { e.preventDefault(); set({ q: term.trim() }); }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <input
            ref={termRef}
            type="search"
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Search shops, keywords…"
            aria-label="Search shops, keywords"
            className="h-9 w-full rounded-[10px] bg-[var(--a-fill)] pl-9 pr-10 text-[15px] tracking-[-0.01em] text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_4px_var(--a-focus)]"
          />
          {term && (
            <button type="button" onClick={() => { setTerm(''); set({ q: '' }); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <button type="button" onClick={toggleFilters} aria-expanded={filtersOpen} aria-controls="shop-filters"
          className={cn(CHIP, 'h-9 shrink-0', activeCount > 0 ? CHIP_ON : CHIP_OFF)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters{activeCount > 0 && <span className="tabular-nums">({activeCount})</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filtersOpen && 'rotate-180')} aria-hidden />
        </button>
        <button type="button" onClick={() => set({ viewed: hideViewed ? '' : 'exclude' })}
          aria-pressed={hideViewed} title={hideViewed ? 'Show shops you have viewed' : 'Hide shops you have viewed'}
          aria-label={hideViewed ? 'Show shops you have viewed' : 'Hide shops you have viewed'}
          className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors', FOCUS,
            hideViewed ? CHIP_ON : CHIP_OFF)}>
          <EyeOff className="h-4 w-4" />
        </button>
        {(hiddenCount > 0 || showingHidden) && (
          <button type="button" onClick={() => set({ hidden: showingHidden ? '' : 'show' })} aria-pressed={showingHidden}
            className={cn(CHIP, 'shrink-0', showingHidden ? CHIP_ON : CHIP_OFF)}>
            {showingHidden ? 'Back to Shops' : `Hidden (${hiddenCount.toLocaleString()})`}
          </button>
        )}
        <ExportCsv kind="shops" className={cn(CHIP, 'h-9 shrink-0 disabled:opacity-60', CHIP_OFF)} />
      </div>

      {filtersOpen && <div id="shop-filters" className="flex flex-wrap items-center gap-2">
        <FilterChip icon={Users} label="Traffic" value={p('traffic')} onChange={v => set({ traffic: v })} options={[
          { value: '10k', label: '10K+ visits' }, { value: '100k', label: '100K+ visits' },
          { value: '1m', label: '1M+ visits' }, { value: '10m', label: '10M+ visits' },
        ]} />
        <FilterChip icon={TrendingUp} label="Traffic Growth" value={p('growth')} onChange={v => set({ growth: v })} options={[
          { value: 'declining', label: 'Declining' }, { value: 'positive', label: 'Positive' },
          { value: '10', label: '10%+ growth' }, { value: '25', label: '25%+ growth' }, { value: '50', label: '50%+ growth' },
        ]} />
        <FilterChip icon={Package} label="Products" value={p('productsMin')} onChange={v => set({ productsMin: v })}
          options={[['10', '10+'], ['25', '25+'], ['50', '50+'], ['100', '100+'], ['500', '500+'], ['1000', '1,000+']]
            .map(([value, l]) => ({ value, label: `${l} products` }))} />
        <FilterChip icon={Store} label="Shop Origin" value={p('country')} onChange={v => set({ country: v })} options={countryOptions} />
        <FilterChip icon={Globe} label="Visitor Country" value={p('visitorCountry')} onChange={v => set({ visitorCountry: v })} options={countryOptions} />
        {subcategories.length > 0 && (
          <FilterChip icon={LayoutGrid} label="Subcategory" value={subId} onChange={v => set({ subcategory: v })}
            options={subcategories.map(c => ({ value: c.id, label: `${c.name} (${compact(c.brandCount)})` }))} />
        )}
        <FilterChip icon={CalendarDays} label="Creation Date" value={p('created')} onChange={v => set({ created: v })} options={[
          { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' },
          { value: '1y', label: 'Last year' }, { value: '2y', label: 'Last 2 years' },
        ]} />
        {techOptions.length > 0 && (
          <FilterChip icon={Blocks} label="Technology" value={p('tech')} onChange={v => set({ tech: v })} options={techOptions} searchable />
        )}
        {pixelOptions.length > 0 && (
          <FilterChip icon={Radar} label="Pixels" value={p('pixel')} onChange={v => set({ pixel: v })} options={pixelOptions} />
        )}
        <FilterChip icon={Eye} label="Viewed" value={p('viewed')} onChange={v => set({ viewed: v })} options={[
          { value: 'only', label: 'Viewed' }, { value: 'exclude', label: 'Not viewed' },
        ]} />
        <FilterChip icon={Crosshair} label="Brandtracker" value={p('tracked')} onChange={v => set({ tracked: v })} options={[
          { value: 'only', label: 'In Brandtracker' }, { value: 'exclude', label: 'Not in Brandtracker' },
        ]} />

        {activeCount > 0 && (
          <button
            onClick={() => set(Object.fromEntries(FILTER_KEYS.map(k => [k, ''])))}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-[var(--a-blue)] transition-opacity hover:opacity-80', FOCUS)}
          >
            <X className="h-3 w-3" /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </button>
        )}
      </div>}
    </div>
  );
}

export { useSetParam, useDebounce };

export function Segments({ items }: { items: { value: string; label: string }[] }) {
  const { set, params } = useSetParam();
  const cur = params.get('view') ?? '';
  const sorted = !!params.get('sort');
  return (
    <div className="shrink-0 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2">
      {items.map(it => {
        const active = cur === it.value && !sorted;
        return (
          <button
            key={it.value}
            // Clearing sort/dir mirrors SortableHeader clearing `view`:
            // whichever the reader touched last is the one that applies.
            onClick={() => set({ view: it.value, sort: '', dir: '' })}
            aria-pressed={active}
            className={cn(PILL, active ? PILL_ON : PILL_OFF)}
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
      <button onClick={() => go(page - 1)} disabled={page <= 1} className={btn}>
        <ChevronLeft className="h-4 w-4" /> Previous
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
      <button onClick={() => go(page + 1)} disabled={!canNext} className={btn}>
        Next <ChevronRight className="h-4 w-4" />
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
