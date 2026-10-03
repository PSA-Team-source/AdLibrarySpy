'use client';
import { useState, useEffect } from 'react';
import {
  X, ArrowDownUp, CalendarRange, ChevronDown, Film, Shapes, LayoutTemplate, Globe, Landmark,
  Store, Anchor, Compass, Filter, Tag, Timer, Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LabelFacets, LabelField, FacetEntry } from '@/lib/market/labels';
import { AD_SORTS, EU_UK_COUNTRIES } from '@/lib/market/ad-options';
import { ExportCsv } from './ExportCsv';
import { CHIP, CHIP_OFF, CHIP_ON, FOCUS, FilterChip, useSetParam } from './MarketToolbar';
import { flag } from '@/lib/format';

/** Label filter selects, in reading order. The option text comes from the API. */
const LABEL_SELECTS: { field: LabelField; any: string }[] = [
  { field: 'style', any: 'Video style' },
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
const countryOptions = COUNTRIES.map(c => ({ value: c, label: `${flag(c)} ${nameOf(c)}` }));
const euUkOptions = [
  { value: 'all', label: 'All EU/UK countries' },
  ...[...EU_UK_COUNTRIES].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map(c => ({ value: c, label: `${flag(c)} ${nameOf(c)}` })),
];
const sortOptions = Object.entries(AD_SORTS).filter(([k]) => k !== 'relevance').map(([value, v]) => ({ value, label: v.label }));
const LABEL_ICONS = { hook: Anchor, angle: Compass, funnelStage: Filter, offer: Tag, style: Clapperboard } as const;

/** Every URL key a filter writes — drives the active count and Clear. */
const FILTER_KEYS = ['from', 'to', 'media', 'format', 'placement', 'country', 'euUk', 'store', 'allAdvertisers',
  'hook', 'angle', 'funnelStage', 'offer', 'style', 'urgency'] as const;

// With no search and no sort the index returns its own order, top spending
// first; with a search it ranks by relevance (creatives.ts).
// Same layout and recipes as the Shops toolbar (MarketToolbar): niche dropdown,
// Filters toggle, sort + export on one row (search sits on the title row).
export function AdsToolbar({ storeFilter, labelFacets, niches }: {
  storeFilter?: { id: string; label: string };
  /** null = no label data for this search, so no label filters are rendered. */
  labelFacets?: LabelFacets | null;
  niches: { id: string; name: string }[];
}) {
  const { set, prefetch, params, pending } = useSetParam();
  const get = (k: string) => params.get(k) ?? '';

  // Ads are in every script; a result needing an Inter subset not yet loaded
  // (Cyrillic, Greek, Latin-ext) held the swap ~1s on the font download.
  // Fetch every subset once idle. Results are NOT pre-rendered here: warming
  // every style + niche fired ~25 full renders per view (and again per click),
  // which queued the user's own click behind them for 5-10s. The menus
  // prefetch their options when opened (onPrefetch).
  useEffect(() => {
    const run = () => document.fonts.forEach(f => { if (f.status === 'unloaded') f.load().catch(() => {}); });
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 300);
    return () => clearTimeout(id);
  }, []);

  const [from, setFrom] = useState(get('from'));
  const [to, setTo] = useState(get('to'));
  useEffect(() => { setFrom(params.get('from') ?? ''); setTo(params.get('to') ?? ''); }, [params]);

  // One chip each: a date range, and EU/UK with its country, count once.
  const activeCount = FILTER_KEYS.filter(k => get(k)).length
    - (get('from') && get('to') ? 1 : 0) - (get('euUk') === '1' && get('country') ? 1 : 0);
  const today = new Date().toISOString().slice(0, 10);
  const niche = get('niche');
  const euUk = get('euUk') === '1';
  const allAdvertisers = get('allAdvertisers') === '1';
  const dated = get('from') || get('to');
  // One-tap ranges: most people want "recent", not two calendar pickers.
  const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const presets = [
    { label: 'Last 7 days', from: daysAgo(7) }, { label: 'Last 30 days', from: daysAgo(30) },
    { label: 'Last 90 days', from: daysAgo(90) }, { label: 'This year', from: `${today.slice(0, 4)}-01-01` },
  ];
  const activePreset = !get('to') ? presets.find(p => p.from === get('from')) : undefined;

  return (
    <div className={cn('flex shrink-0 flex-col gap-2 transition-opacity', pending && 'opacity-60')}>
      <div id="ad-filters" className="flex flex-wrap items-center gap-2">
        {niches.length > 0 && (
          <FilterChip icon={Shapes} label="Niche" value={niche} anyLabel="All niches" showAny={false}
            onChange={v => set({ niche: v })} onPrefetch={v => prefetch({ niche: v })}
            options={niches.map(n => ({ value: n.id, label: n.name }))} />
        )}
        <FilterChip icon={ArrowDownUp} label="Sort" value={get('sort')} anyLabel={get('q') ? 'Relevance' : 'Top spending'}
          onChange={v => set({ sort: v })} onPrefetch={v => prefetch({ sort: v })} options={sortOptions} />
        <ExportCsv kind="ads" className={cn(CHIP, 'h-9 shrink-0 disabled:opacity-60', CHIP_OFF)} />
        {storeFilter && (
          <button type="button" onClick={() => set({ store: '' })} aria-label="Clear shop filter" className={cn(CHIP, CHIP_ON)}>
            <Store className="h-3.5 w-3.5" /> Ads from {storeFilter.label} <X className="h-3.5 w-3.5 opacity-70" />
          </button>
        )}
        {!get('store') && (
          <button type="button" role="switch" aria-checked={!allAdvertisers}
            onClick={() => set({ allAdvertisers: allAdvertisers ? '' : '1' })}
            title="Hide ads from big brands and publishers that don't sell through an online store"
            className={cn(CHIP, !allAdvertisers ? CHIP_ON : CHIP_OFF)}>
            <Store className="h-3.5 w-3.5 shrink-0" /> Only online stores
          </button>
        )}
        <details className="relative">
          <summary className={cn(CHIP, 'cursor-pointer list-none', dated ? CHIP_ON : CHIP_OFF)}>
            <CalendarRange className="h-3.5 w-3.5 shrink-0" />
            {activePreset ? activePreset.label : dated ? `${get('from') || '…'} → ${get('to') || 'today'}` : 'Ad Creation Date'}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </summary>
          <form className="absolute left-0 top-10 z-20 flex w-72 flex-col gap-2 rounded-xl border border-border bg-popover p-3 shadow-lg"
            onSubmit={e => { e.preventDefault(); set({ from, to }); (e.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map(p => (
                <button key={p.label} type="button" aria-pressed={activePreset === p}
                  className={cn(CHIP, 'justify-center', activePreset === p ? CHIP_ON : CHIP_OFF)}
                  onClick={e => { set({ from: p.from, to: '' }); (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; }}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="pt-1 text-[11px] uppercase tracking-wide text-muted-foreground">Custom range</p>
            <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              Started from
              <input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} className={cn(CHIP, CHIP_OFF)} />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              Started until
              <input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} className={cn(CHIP, CHIP_OFF)} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              {dated && <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => set({ from: '', to: '' })}>Reset</button>}
              <button type="submit" className="btn-primary h-8 px-3 text-xs">Apply</button>
            </div>
          </form>
        </details>

        <FilterChip icon={Film} label="Media Type" value={get('media')} onChange={v => set({ media: v })} onPrefetch={v => prefetch({ media: v })}
          options={[{ value: 'video', label: 'Video' }, { value: 'vsl', label: 'VSL (2+ min video)' }, { value: 'image', label: 'Image' }]} />
        <FilterChip icon={Shapes} label="Format" value={get('format')} onChange={v => set({ format: v })} onPrefetch={v => prefetch({ format: v })} options={FORMATS} />
        <FilterChip icon={LayoutTemplate} label="Placement" value={get('placement')} onChange={v => set({ placement: v })} onPrefetch={v => prefetch({ placement: v })} options={PLACEMENTS} />
        <FilterChip icon={Globe} label="Country" value={euUk ? '' : get('country')}
          onChange={v => set({ country: v, euUk: '' })} options={countryOptions} />
        <FilterChip icon={Landmark} label="EU/UK" value={euUk ? get('country') || 'all' : ''} searchable
          onChange={v => set({ euUk: v ? '1' : '', country: v === 'all' ? '' : v })} options={euUkOptions} />

        {labelFacets && LABEL_SELECTS.map(({ field, any }) => {
          const opts = labelOptions(labelFacets.facets[field], get(field));
          if (!opts.length) return null;
          return (
            <FilterChip key={field} icon={LABEL_ICONS[field]} label={any} value={get(field)}
              title="AI label: a model judgment of the ad text, not a measurement"
              onChange={v => set({ [field]: v })} onPrefetch={v => prefetch({ [field]: v })} options={opts.map(o => ({ value: o.value, label: o.text }))} />
          );
        })}
        {labelFacets && (labelFacets.facets.urgency[0] || get('urgency') === '1') && (
          <FilterChip icon={Timer} label="Urgency" value={get('urgency')} title={labelFacets.facets.urgency[0]?.description}
            onChange={v => set({ urgency: v })} onPrefetch={v => prefetch({ urgency: v })} options={[{ value: '1', label: labelFacets.facets.urgency[0]
              ? `${labelFacets.facets.urgency[0].label} · ${labelFacets.facets.urgency[0].count.toLocaleString()}`
              : 'Urgency' }]} />
        )}

        <form className="flex items-center"
          onSubmit={e => { e.preventDefault(); set({ store: String(new FormData(e.currentTarget).get('store') ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') }); }}>
          <label className={cn(CHIP, get('store') ? CHIP_ON : CHIP_OFF, 'pr-1.5')}>
            <Store className="h-3.5 w-3.5 shrink-0" />
            <input name="store" key={get('store')} defaultValue={get('store')} placeholder="Shop domain"
              aria-label="Shop domain, e.g. cheezit.com" className={cn('w-32 bg-transparent outline-none', get('store') ? 'text-background placeholder:text-background/60' : 'text-foreground placeholder:text-muted-foreground')} />
          </label>
        </form>

        {activeCount > 0 && (
          <button type="button" onClick={() => set(Object.fromEntries(FILTER_KEYS.map(k => [k, ''])))}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-[var(--a-blue)] transition-opacity hover:opacity-80', FOCUS)}>
            <X className="h-3 w-3" /> Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
