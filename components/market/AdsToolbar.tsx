'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition, useState, useEffect } from 'react';
import { Search, X, ArrowDown, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabelFacets, LabelField, FacetEntry } from '@/lib/market/labels';
import { AD_SORTS, EU_UK_COUNTRIES } from '@/lib/market/ad-options';

/** Label filter selects, in reading order. The option text comes from the API. */
const LABEL_SELECTS: { field: LabelField; any: string }[] = [
  { field: 'hook', any: 'Hook' },
  { field: 'angle', any: 'Angle' },
  { field: 'funnelStage', any: 'Funnel Stage' },
  { field: 'offer', any: 'Offer' },
];

/**
 * Options for one label select: the facet entries with their counts, plus the
 * current URL value when the facets no longer list it (e.g. a comma list), so
 * the control always shows what is applied and can clear it.
 */
function labelOptions(entries: FacetEntry[], current: string) {
  const opts = entries.map(e => ({
    value: e.value,
    text: `${e.label} · ${e.count.toLocaleString()}`,
    hint: e.description,
  }));
  if (current && !opts.some(o => o.value === current)) {
    const named = current.split(',').map(v => entries.find(e => e.value === v)?.label ?? v.replace(/_/g, ' '));
    opts.unshift({ value: current, text: named.join(' or '), hint: '' });
  }
  return opts;
}

const FORMATS = [
  { value: 'dco', label: 'Dynamic (DCO)' },
  { value: 'dpa', label: 'Catalogue (DPA)' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
];

const PLACEMENTS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'threads', label: 'Threads' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'audience_network', label: 'Audience Network' },
];

const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'BR', 'MX', 'IN', 'JP'];

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const nameOf = (c: string) => { try { return regionNames.of(c) ?? c; } catch { return c; } };

/** Every URL key a filter writes — drives the active count and Clear. */
const FILTER_KEYS = ['q', 'from', 'to', 'media', 'format', 'placement', 'country', 'euUk', 'niche', 'store',
  'hook', 'angle', 'funnelStage', 'offer', 'urgency'] as const;

type FilterTab = 'ads' | 'eu' | 'shop';

// Same chip recipe as the Shops filter panel (MarketToolbar).
const CHIP =
  'h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm ' +
  'outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring';
const CHIP_ON = 'border-foreground/40 bg-foreground/[0.06] font-medium';

export function AdsToolbar({ storeFilter, labelFacets, niches }: {
  storeFilter?: { id: string; label: string };
  /** null = no label data for this search, so no label filters are rendered. */
  labelFacets?: LabelFacets | null;
  niches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const set = useCallback((entries: Record<string, string>) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    for (const [k, v] of Object.entries(entries)) { if (v) p.set(k, v); else p.delete(k); }
    p.delete('page');
    start(() => router.push(`${pathname}?${p.toString()}`));
  }, [params, pathname, router]);

  const get = (k: string) => params.get(k) ?? '';
  const [term, setTerm] = useState(get('q'));
  useEffect(() => { setTerm(params.get('q') ?? ''); }, [params]);

  const [tab, setTab] = useState<FilterTab>(() =>
    get('euUk') === '1' ? 'eu' : get('store') ? 'shop' : 'ads');
  const [collapsed, setCollapsed] = useState(false);

  const [from, setFrom] = useState(get('from'));
  const [to, setTo] = useState(get('to'));
  useEffect(() => { setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); }, [params]);

  const activeCount = FILTER_KEYS.filter(k => k !== 'q' && get(k)).length;
  const on = (k: string) => (get(k) ? CHIP_ON : '');
  const today = new Date().toISOString().slice(0, 10);

  const tabBtn = (key: FilterTab, label: string) => (
    <button type="button" onClick={() => { setTab(key); setCollapsed(false); }} aria-pressed={tab === key}
      className={cn('-mb-px border-b-2 pb-2.5 text-sm transition-colors',
        tab === key ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground')}>
      {label}
    </button>
  );

  return (
    <div className={cn('flex flex-col gap-3 transition-opacity', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background">
          📺 All Ads
        </span>
        <form className="relative min-w-[240px] flex-1" onSubmit={e => { e.preventDefault(); set({ q: term.trim() }); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={term} onChange={e => setTerm(e.target.value)}
            placeholder="Search ads…" aria-label="Search ads by copy, headline or advertiser"
            className="w-full rounded-md border border-[hsl(var(--input-border))] bg-input py-2.5 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          {term && (
            <button type="button" onClick={() => { setTerm(''); set({ q: '' }); }} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      {storeFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground">
            Ads from <b>{storeFilter.label}</b>
            <button onClick={() => set({ store: '' })} aria-label="Clear shop filter"
              className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-foreground/[0.025] p-3 sm:p-4">
        <div className={cn('flex items-center gap-5 border-b border-border', !collapsed && 'mb-3')}>
          <span className="pb-2.5 text-sm font-semibold text-foreground">Filter By :</span>
          {tabBtn('ads', 'Ads')}
          {tabBtn('eu', 'EU/UK')}
          {tabBtn('shop', 'Shop')}
          <button type="button" onClick={() => setCollapsed(c => !c)} aria-expanded={!collapsed}
            className="ml-auto pb-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            {collapsed ? 'Show filters' : 'Hide filters'}
          </button>
        </div>

        {!collapsed && (
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'ads' && (
              <>
                <details className="relative">
                  <summary className={cn(CHIP, 'flex cursor-pointer list-none items-center gap-1.5', (get('from') || get('to')) && CHIP_ON)}>
                    <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                    {get('from') || get('to') ? `${get('from') || '…'} → ${get('to') || 'today'}` : 'Ad Creation Date'}
                  </summary>
                  <form className="absolute left-0 top-11 z-20 flex w-72 flex-col gap-2 rounded-xl border border-border bg-popover p-3 shadow-lg"
                    onSubmit={e => { e.preventDefault(); set({ from, to }); (e.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
                    <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      Started from
                      <input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} className={CHIP} />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      Started until
                      <input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} className={CHIP} />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      {(get('from') || get('to')) && (
                        <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => set({ from: '', to: '' })}>Reset</button>
                      )}
                      <button type="submit" className="btn-primary h-8 px-3 text-xs">Apply</button>
                    </div>
                  </form>
                </details>

                <select aria-label="Media type" className={cn(CHIP, on('media'))}
                  value={get('media')} onChange={e => set({ media: e.target.value })}>
                  <option value="">Media Type</option>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                </select>
                <select aria-label="Creative format" className={cn(CHIP, on('format'))}
                  value={get('format')} onChange={e => set({ format: e.target.value })}>
                  <option value="">Format</option>
                  {FORMATS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select aria-label="Placement" className={cn(CHIP, on('placement'))}
                  value={get('placement')} onChange={e => set({ placement: e.target.value })}>
                  <option value="">Placement</option>
                  {PLACEMENTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select aria-label="Country" className={cn(CHIP, on('country'))}
                  value={get('euUk') === '1' ? '' : get('country')} onChange={e => set({ country: e.target.value, euUk: '' })}>
                  <option value="">Country</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{nameOf(c)}</option>)}
                </select>
                {niches.length > 0 && (
                  <select aria-label="Niche" className={cn(CHIP, on('niche'))}
                    value={get('niche')} onChange={e => set({ niche: e.target.value })}>
                    <option value="">Niche</option>
                    {niches.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                )}

                {labelFacets && LABEL_SELECTS.map(({ field, any }) => {
                  const current = get(field);
                  const opts = labelOptions(labelFacets.facets[field], current);
                  if (!opts.length) return null;
                  return (
                    <select key={field} aria-label={`${any} (AI label)`} className={cn(CHIP, on(field))}
                      title="AI label: a model judgment of the ad text, not a measurement"
                      value={current} onChange={e => set({ [field]: e.target.value })}>
                      <option value="">{any}</option>
                      {opts.map(o => <option key={o.value} value={o.value} title={o.hint}>{o.text}</option>)}
                    </select>
                  );
                })}
                {labelFacets && (labelFacets.facets.urgency[0] || get('urgency') === '1') && (
                  <label title={labelFacets.facets.urgency[0]?.description}
                    className={cn(CHIP, 'inline-flex cursor-pointer items-center gap-2', on('urgency'))}>
                    <input type="checkbox" checked={get('urgency') === '1'}
                      onChange={e => set({ urgency: e.target.checked ? '1' : '' })} className="h-3.5 w-3.5 accent-current" />
                    {labelFacets.facets.urgency[0]
                      ? `${labelFacets.facets.urgency[0].label} · ${labelFacets.facets.urgency[0].count.toLocaleString()}`
                      : 'Urgency'}
                  </label>
                )}
              </>
            )}

            {tab === 'eu' && (
              <>
                <label className={cn(CHIP, 'inline-flex cursor-pointer items-center gap-2', on('euUk'))}>
                  <input type="checkbox" checked={get('euUk') === '1'}
                    onChange={e => set({ euUk: e.target.checked ? '1' : '', country: '' })} className="h-3.5 w-3.5 accent-current" />
                  EU/UK ads only
                </label>
                <select aria-label="EU or UK country" className={cn(CHIP, get('euUk') === '1' && get('country') ? CHIP_ON : '')}
                  value={get('euUk') === '1' ? get('country') : ''}
                  onChange={e => set({ euUk: '1', country: e.target.value })}>
                  <option value="">All EU/UK countries</option>
                  {[...EU_UK_COUNTRIES].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map(c =>
                    <option key={c} value={c}>{nameOf(c)}</option>)}
                </select>
              </>
            )}

            {tab === 'shop' && (
              <>
                <form className="flex items-center gap-2"
                  onSubmit={e => { e.preventDefault(); set({ store: String(new FormData(e.currentTarget).get('store') ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') }); }}>
                  <input name="store" key={get('store')} defaultValue={get('store')} placeholder="Shop domain, e.g. cheezit.com"
                    aria-label="Shop domain" className={cn(CHIP, 'w-60', on('store'))} />
                  <button type="submit" className="btn-ghost h-9 px-3 text-xs">Apply</button>
                </form>
              </>
            )}

            {activeCount > 0 && (
              <>
                <span className="text-xs text-muted-foreground">{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
                <button type="button"
                  onClick={() => set(Object.fromEntries(FILTER_KEYS.filter(k => k !== 'q').map(k => [k, ''])))}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
                  <X className="h-3 w-3" /> Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center">
        <label className="relative inline-flex items-center">
          <ArrowDown className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
          <select aria-label="Sort ads" className={cn(CHIP, 'pl-8')}
            value={get('sort') || 'relevance'} onChange={e => set({ sort: e.target.value === 'relevance' ? '' : e.target.value })}>
            {Object.entries(AD_SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
