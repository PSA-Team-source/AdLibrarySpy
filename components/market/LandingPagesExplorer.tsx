'use client';
// The Landing pages explorer: the pages Meta ads send people to, built exactly
// like the Products explorer — one server render, then every filter, sort and
// page change is a small JSON fetch (GET /api/landing-pages) keyed by the query.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ExternalLink, Globe, LayoutGrid, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { PageShell } from '@/components/layouts/page-shell';
import { FilterChip, MarketPagination, ShallowUrlProvider, useDebounce, useSetParam } from '@/components/market/MarketToolbar';
import { SortableHeader } from '@/components/market/SortableHeader';
import { BrandLogo } from '@/components/market/BrandLogo';
import { RankBadge } from '@/components/market/PlatformIcon';
import { ProductImage } from '@/components/ShopMedia';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { compact, flag } from '@/lib/format';
import type { CategoryNode } from '@/lib/market/shops';
import type { LandingPage, LandingPageType } from '@/lib/market/landing-pages';
import type { LandingPagesPayload } from '@/app/(app)/landing-pages/load';
import { cn } from '@/lib/utils';

const LP_KEY = 'landing-pages';

const TYPE_LABEL: Record<LandingPageType, string> = {
  product: 'Product page', advertorial: 'Advertorial', listicle: 'Listicle', quiz: 'Quiz',
  collection: 'Collection', homepage: 'Homepage', other: 'Other page', unread: 'Not read yet',
};

function canonical(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchLandingPages(qs: string, signal: AbortSignal): Promise<LandingPagesPayload> {
  const res = await fetch(`/api/landing-pages${qs ? `?${qs}` : ''}`, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 401) { window.location.assign('/login'); throw new Error('Signed out'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Landing pages could not be loaded');
  return res.json();
}

const FOCUS = 'outline-none focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';
const PILL = `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors ${FOCUS}`;
const ON = 'bg-foreground text-background';
const OFF = 'bg-[var(--a-fill)] text-foreground hover:bg-[var(--a-fill-hover)]';

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'NZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'BR', 'MX', 'JP', 'IN', 'HK'];
const regionName = (() => {
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (c: string) => dn.of(c) ?? c; }
  catch { return (c: string) => c; }
})();

const FILTER_KEYS = ['q', 'category', 'subcategory', 'country', 'traffic', 'launched'] as const;

const day = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

function TypeChips({ types }: { types: { type: LandingPageType; count: number }[] }) {
  const { set, params } = useSetParam();
  const cur = params.get('type') ?? '';
  if (types.length === 0 && !cur) return null;
  const total = types.reduce((n, t) => n + t.count, 0);
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1.5">
        {[{ type: '' as const, label: 'All pages', count: total }, ...types.map(t => ({ type: t.type, label: TYPE_LABEL[t.type], count: t.count }))].map(t => (
          <button key={t.type || 'all'} type="button" onClick={() => set({ type: t.type })} aria-pressed={cur === t.type}
            className={cn(PILL, cur === t.type ? ON : OFF)}>
            {t.label}{t.count > 0 && <span className="tabular-nums opacity-60">{compact(t.count)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toolbar({ categories, types }: { categories: CategoryNode[]; types: { type: LandingPageType; count: number }[] }) {
  const { set, params, pending } = useSetParam();
  const p = (k: string) => params.get(k) ?? '';
  const [term, setTerm] = useState(p('q'));
  useEffect(() => { setTerm(params.get('q') ?? ''); }, [params]);
  const debounced = useDebounce(term, 300);
  useEffect(() => {
    if (debounced !== (params.get('q') ?? '')) set({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem('landingPages.filtersOpen') === '1'); } catch { /* storage blocked */ } }, []);
  const toggle = () => setOpen(o => { try { localStorage.setItem('landingPages.filtersOpen', o ? '0' : '1'); } catch { /* storage blocked */ } return !o; });

  const categoryId = p('category');
  const tabs = useMemo(() => categories.filter(c => c.brandCount > 0 || c.id === categoryId).sort((a, b) => b.brandCount - a.brandCount), [categories, categoryId]);
  const subs = useMemo(() => (categories.find(c => c.id === categoryId)?.children ?? []).filter(c => c.brandCount > 0 || c.id === p('subcategory')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, categoryId, params]);
  const active = FILTER_KEYS.filter(k => k !== 'q' && k !== 'category' && params.get(k)).length;

  return (
    <div className={cn('flex shrink-0 flex-col gap-2 transition-opacity', pending && 'opacity-60')}>
      {tabs.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1.5">
            {[{ id: '', name: 'All Categories' }, ...tabs].map(c => (
              <button key={c.id || 'all'} type="button" onClick={() => set({ category: c.id, subcategory: '' })}
                aria-pressed={categoryId === c.id} className={cn(PILL, categoryId === c.id ? ON : OFF)}>{c.name}</button>
            ))}
          </div>
        </div>
      )}
      <TypeChips types={types} />
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <form className="relative min-w-0 flex-1 basis-full sm:basis-0" onSubmit={e => { e.preventDefault(); set({ q: term.trim() }); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
          <input type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search pages, brands, stores…"
            aria-label="Search pages, brands, stores"
            className="h-9 w-full rounded-[10px] bg-[var(--a-fill)] pl-9 pr-10 text-[15px] tracking-[-0.01em] text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_4px_var(--a-focus)]" />
          {term && (
            <button type="button" onClick={() => { setTerm(''); set({ q: '' }); }} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="lp-filters"
          className={cn(PILL, 'h-9 shrink-0', active > 0 ? ON : OFF)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters{active > 0 && <span className="tabular-nums">({active})</span>}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {open && (
        <div id="lp-filters" className="flex flex-wrap items-center gap-2">
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
          {active > 0 && (
            <button type="button" onClick={() => set(Object.fromEntries(FILTER_KEYS.filter(k => k !== 'q' && k !== 'category').map(k => [k, ''])))}
              className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-[var(--a-blue)] transition-opacity hover:opacity-80', FOCUS)}>
              <X className="h-3 w-3" /> Clear {active} filter{active > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
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

function Shot({ lp }: { lp: LandingPage }) {
  // Our screenshot, else the page's share image, else nothing at all.
  const src = lp.screenshot || lp.image;
  if (!src) return null;
  return (
    <a href={lp.url} target="_blank" rel="noopener" className="shrink-0 empty:hidden" tabIndex={-1} aria-hidden>
      <ProductImage src={src} alt="" className="h-16 w-12 rounded-[8px] border border-[var(--a-sep)] bg-white object-cover object-top" />
    </a>
  );
}

function LandingPageRow({ lp, rank }: { lp: LandingPage; rank: number }) {
  const s = lp.store;
  const shopHref = s.id ? `/shops/shp_${s.id.replace(/[^a-z0-9]/gi, '')}` : null;
  let path = lp.url;
  try { const u = new URL(lp.url); path = u.host + (u.pathname === '/' ? '' : u.pathname); } catch { /* keep raw */ }
  return (
    <TableRow className="group">
      <TableCell><RankBadge rank={rank} /></TableCell>
      <TableCell>
        <div className="flex items-center gap-3 overflow-hidden">
          <Shot lp={lp} />
          <div className="min-w-0 flex-1">
            <a href={lp.url} target="_blank" rel="noopener" title={`${lp.title || path} — open the page`}
              className="group/t inline-flex max-w-full items-center gap-1 rounded text-[15px] font-semibold tracking-[-0.015em] text-foreground outline-none hover:underline focus-visible:shadow-[0_0_0_4px_var(--a-focus)]">
              <span className="truncate">{lp.title || path}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/t:opacity-60" aria-hidden />
            </a>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
              <span className="shrink-0 rounded-full bg-[var(--a-fill)] px-2 py-px font-medium text-foreground">{TYPE_LABEL[lp.type]}</span>
              {lp.title && <span className="truncate">{path}</span>}
            </div>
            {/* Phones show only this column, so the store and key numbers ride along. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] tabular-nums sm:hidden">
              {s.domain && <span className="truncate text-muted-foreground">{s.domain}</span>}
              {lp.activeAds > 0 && <span className="text-foreground"><span className="font-semibold">{compact(lp.activeAds)}</span> <span className="text-muted-foreground">active ads</span></span>}
              {lp.newAds14d > 0 && <span className="font-semibold text-[var(--a-purple)]">+{compact(lp.newAds14d)} new</span>}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {s.domain && (
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo logo={s.logo} domain={s.domain} name={s.title || s.domain} size={28} />
            <div className="min-w-0">
              {shopHref
                ? <Link href={shopHref} className="block truncate text-[14px] font-medium text-foreground hover:underline" title={s.title || s.domain}>{s.domain}</Link>
                : <span className="block truncate text-[14px] font-medium text-foreground">{s.domain}</span>}
              {s.country && <span className="text-[12px] text-muted-foreground">{flag(s.country)} {s.country}</span>}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="text-[15px] font-semibold text-foreground" title={`${lp.activeAds.toLocaleString()} running of ${lp.ads.toLocaleString()} ads send people here`}>{compact(lp.activeAds)}</span>
        {lp.ads > lp.activeAds && <div className="text-[12px] text-muted-foreground">of {compact(lp.ads)}</div>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {lp.newAds14d > 0 && <span className="text-[15px] font-semibold text-[var(--a-purple)]">+{compact(lp.newAds14d)}</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {lp.pages > 0 && <span className="text-[15px] text-foreground">{lp.pages.toLocaleString()}</span>}
      </TableCell>
      <TableCell className="tabular-nums">
        {lp.firstAdAt && <span className="text-[14px] text-muted-foreground">{day(lp.firstAdAt)}</span>}
      </TableCell>
      <TableCell className="tabular-nums">
        {lp.lastSeenAt && <span className="text-[14px] text-muted-foreground">{day(lp.lastSeenAt)}</span>}
      </TableCell>
      <TableCell>
        {lp.adCountries.length > 0 && (
          <span className="text-[14px]" title={lp.adCountries.map(regionName).join(', ')}>
            {lp.adCountries.slice(0, 4).map(flag).join(' ')}
            {lp.adCountries.length > 4 && <span className="ml-1 text-[12px] text-muted-foreground">+{lp.adCountries.length - 4}</span>}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {s.visits > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-[15px] font-semibold text-foreground" title={s.trafficSource === 'similarweb' ? 'Monthly visits (SimilarWeb)' : 'Monthly visits (index estimate)'}>{compact(s.visits)}</span>
            {s.trafficSource === 'similarweb' && s.visitsGrowthPct != null && <div className="mt-1"><Growth pct={s.visitsGrowthPct} /></div>}
            {s.trafficSource === 'index' && <div className="mt-1 text-[11px] leading-none text-muted-foreground">Index estimate</div>}
          </div>
        )}
      </TableCell>
      <TableCell>
        {lp.sampleAds.length > 0 && (
          <div className="flex items-center gap-1.5">
            {lp.sampleAds.slice(0, 3).map(a => (
              <Link key={a.id} href={`/ads/${a.id}`} className="shrink-0 overflow-hidden rounded-md empty:hidden" aria-label={`Ad for ${lp.title || path}`}>
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
  { label: 'Page', width: 'w-[20rem]' },
  { label: 'Store', width: 'w-48' },
  { label: 'Active Ads', sort: 'ads', right: true, isDefault: true, hint: 'Running Meta ads that send people to this page', width: 'w-24' },
  { label: 'New Ads (14D)', sort: 'new_ads', right: true, hint: 'Ads started in the last 14 days', width: 'w-28' },
  { label: 'Advertisers', sort: 'pages', right: true, hint: 'Facebook pages running these ads', width: 'w-24' },
  { label: 'First Ad', sort: 'first_ad', hint: 'When the first ad to it started', width: 'w-28' },
  { label: 'Last Seen', sort: 'last_seen', hint: 'When an ad to it was last seen running', width: 'w-28' },
  { label: 'Countries', hint: 'Where the ads run', width: 'w-32' },
  { label: 'Store Traffic', sort: 'traffic', right: true, hint: 'Store monthly visits', width: 'w-28' },
  { label: 'Ads', width: 'w-36' },
];

function LandingPagesTable({ rows, rankOffset }: { rows: LandingPage[]; rankOffset: number }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[var(--a-sep)] bg-[var(--a-card)] shadow-[var(--card-shadow)]">
      <Table containerClassName="table-sticky-id min-h-0 flex-1"
        className="max-sm:[&_tr>*:not(:nth-child(2)):not([colspan])]:hidden sm:min-w-[1400px] table-fixed tracking-[-0.01em] [&_tbody_td]:py-2.5 [&_tbody_tr]:border-[var(--a-sep)] [&_tbody_tr:hover]:bg-[var(--a-row-hover)]">
        <colgroup className="max-sm:hidden">{COLUMNS.map(c => <col key={c.label} className={c.width} />)}</colgroup>
        <TableHeader className="sticky top-0 z-10 [&_th]:bg-[var(--a-glass)] [&_th]:shadow-[inset_0_-1px_0_var(--a-sep)] [&_th]:backdrop-blur-xl [&_th]:text-[12px] [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-normal [&_th_button]:text-[12px] [&_th_button]:font-semibold [&_th_button]:normal-case [&_th_button]:tracking-normal [&_tr]:border-[var(--a-sep)]">
          <TableRow>
            {COLUMNS.map(c => c.sort ? (
              <SortableHeader key={c.label} label={c.label} sortKey={c.sort} isDefault={c.isDefault} hint={c.hint} align={c.right ? 'right' : 'left'} />
            ) : (
              <TableHead key={c.label} className={c.right ? 'text-right' : undefined} title={c.hint}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0
            ? <TableEmpty colSpan={COLUMNS.length}>No landing pages match these filters.</TableEmpty>
            : rows.map((lp, i) => <LandingPageRow key={lp.key} lp={lp} rank={rankOffset + i + 1} />)}
        </TableBody>
      </Table>
    </div>
  );
}

export function LandingPagesExplorer({ categories, initial, initialParams, renderedAt }: {
  categories: CategoryNode[];
  initial: LandingPagesPayload | null;
  initialParams: Record<string, string>;
  renderedAt: number;
}) {
  const params = useSearchParams();
  const qs = canonical(params);
  const initialQs = useMemo(() => canonical(new URLSearchParams(initialParams)), [initialParams]);

  const q = useQuery({
    queryKey: [LP_KEY, qs],
    queryFn: ({ signal }) => fetchLandingPages(qs, signal),
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
    void qc.prefetchQuery({ queryKey: [LP_KEY, nextQs], queryFn: ({ signal }) => fetchLandingPages(nextQs, signal) });
  }, [data, q.isPlaceholderData, page, params, qc]);

  // Type counts describe the whole list; keep the last known set while a page loads.
  const types = useRef<{ type: LandingPageType; count: number }[]>(initial?.types ?? []);
  if (data?.types.length) types.current = data.types;

  return (
    <ShallowUrlProvider>
      <PageShell fullHeight className="apple-ui gap-5 bg-[var(--a-canvas)]" title="Landing pages"
        description="The pages Meta ads send people to: product pages, advertorials, listicles, quizzes and more, ranked by the ads behind them.">
        <Toolbar categories={categories} types={types.current} />

        {q.isError && (
          <div role="alert" className="alert-error flex shrink-0 items-center justify-between gap-3 rounded-2xl text-sm">
            <span>{q.error instanceof Error ? q.error.message : 'Landing pages could not be loaded'}.</span>
            <button type="button" onClick={() => q.refetch()} className="font-medium underline">Try again</button>
          </div>
        )}

        {data?.building ? (
          <div role="status" className="rounded-[22px] border border-[var(--a-sep)] bg-[var(--a-card)] p-8 text-center text-[15px] text-muted-foreground">
            Landing pages are being gathered, check back in a minute.
          </div>
        ) : data && (
          <div aria-busy={q.isPlaceholderData}
            className={cn('flex min-h-0 flex-1 flex-col transition-opacity', q.isPlaceholderData && 'pointer-events-none opacity-60')}>
            <LandingPagesTable key={shownKey.current} rows={data.items} rankOffset={(page - 1) * data.limit} />
          </div>
        )}

        {data && !data.building && <MarketPagination page={page} total={data.total} limit={data.limit} hasMore={data.hasMore} />}
      </PageShell>
    </ShallowUrlProvider>
  );
}
