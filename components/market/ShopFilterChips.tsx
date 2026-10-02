'use client';
// The /shops filter chips, TrendTrack's set and order: ranges, the growth rule
// builder, multi-selects with include/exclude and the two-level niche picker.
// Each opens a small panel from the chip; the URL is the only state
// (lib/market/shop-query.ts reads it back, old link names included).
import { useMemo, useState, type ReactNode } from 'react';
import {
  ChevronDown, ChevronRight, Users, TrendingUp, Package, Store, Globe, LayoutGrid, CalendarDays, Languages,
  Coins, Palette, Puzzle, Radar, AtSign, Megaphone, Star, Blocks, Plus, X, Check, type LucideIcon,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { flag } from '@/lib/format';
import type { ProfileKey, TechFacets } from '@/lib/market/shops';
import {
  describeGrowthRules, formatGrowthRules, names, parseGrowthRules, parseShopQuery,
  type GrowthPeriod, type GrowthRule,
} from '@/lib/market/shop-query';
import { CHIP, CHIP_OFF, CHIP_ON, FOCUS } from './MarketToolbar';

type Set = (entries: Record<string, string>) => void;
interface Option { value: string; label: string }

const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K` : String(n);

/** "10K–1M", "10K+", "up to 1M"; '' when neither end is set. */
function span(min: number | undefined, max: number | undefined, f: (n: number) => string = compact): string {
  if (min != null && max != null) return `${f(min)}–${f(max)}`;
  if (min != null) return `${f(min)}+`;
  if (max != null) return `up to ${f(max)}`;
  return '';
}

// Every ISO 3166 country; the four markets most stores sell to come first.
const PINNED = ['US', 'CA', 'AU', 'GB'];
const ALL_COUNTRIES = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');
const regionName = (() => {
  try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); return (c: string) => dn.of(c) ?? c; } catch { return (c: string) => c; }
})();
const COUNTRY_OPTIONS: Option[] = [
  ...PINNED,
  ...ALL_COUNTRIES.filter(c => !PINNED.includes(c)).sort((a, b) => regionName(a).localeCompare(regionName(b))),
].map(c => ({ value: c, label: `${flag(c)} ${regionName(c)}` }));

const SOCIALS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  twitter: 'Twitter', pinterest: 'Pinterest', linkedin: 'LinkedIn',
};

const INPUT = 'h-8 w-full min-w-0 rounded-lg bg-[var(--a-fill)] px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';
// Module-level strings must not read MarketToolbar's exports (the two import each other).
const SMALL_BTN = 'inline-flex h-8 items-center justify-center gap-1 rounded-full px-3.5 text-[13px] font-medium transition-colors outline-none focus-visible:shadow-[0_0_0_4px_var(--a-focus)]';

/** A chip that opens a panel. `summary` set = the chip shows it, filled. */
function PanelChip({ icon: Icon, label, summary, children, wide }: {
  icon: LucideIcon; label: string; summary: string;
  children: (close: () => void) => ReactNode; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={cn(CHIP, summary ? CHIP_ON : CHIP_OFF)} aria-label={label}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[16rem] truncate">{summary ? `${label}: ${summary}` : label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={16}
        className={cn('max-h-[min(28rem,70vh)] overflow-y-auto rounded-xl p-3', wide ? 'w-[min(26rem,calc(100vw-2rem))]' : 'w-[min(20rem,calc(100vw-2rem))]')}>
        {/* The menu's typeahead and arrow keys must not eat what is typed in the fields. */}
        <div onKeyDown={e => {
          if (e.key === 'Escape') return;
          e.stopPropagation();
          // Radix eats the browser's implicit submit; Enter in a field applies the panel.
          const t = e.target as HTMLElement;
          if (e.key === 'Enter' && t.tagName === 'INPUT') { e.preventDefault(); t.closest('form')?.requestSubmit(); }
        }} className="flex flex-col gap-3 text-sm">
          {open && children(() => setOpen(false))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Footer({ onApply, onClear, canClear }: { onApply: () => void; onClear: () => void; canClear: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      {canClear && <button type="button" onClick={onClear} className={cn(SMALL_BTN, 'text-[var(--a-blue)]')}>Clear</button>}
      <button type="button" onClick={onApply} className={cn(SMALL_BTN, CHIP_ON)}>Apply</button>
    </div>
  );
}

interface RangeField { label: string; min: string; max: string; current: [number | undefined, number | undefined]; step?: number; lo?: number; hi?: number; unit?: string }

/** Min/max number pairs plus optional one-tap presets. Apply writes every key; `clears` drops the older names. */
function RangePanel({ fields, presets, clears = [], set, close }: {
  fields: RangeField[]; presets?: { label: string; entries: Record<string, string> }[];
  clears?: string[]; set: Set; close: () => void;
}) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.flatMap(f => [
    [f.min, f.current[0] != null ? String(f.current[0]) : ''], [f.max, f.current[1] != null ? String(f.current[1]) : ''],
  ])) as Record<string, string>);
  const empty = Object.fromEntries([...clears, ...fields.flatMap(f => [f.min, f.max])].map(k => [k, '']));
  const clean = (k: string, f: RangeField) => {
    const n = Number(draft[k]);
    if (draft[k].trim() === '' || !Number.isFinite(n)) return '';
    return String(Math.min(f.hi ?? Infinity, Math.max(f.lo ?? -Infinity, n)));
  };
  const apply = () => {
    const out: Record<string, string> = { ...empty };
    for (const f of fields) {
      let a = clean(f.min, f), b = clean(f.max, f);
      if (a && b && +a > +b) [a, b] = [b, a];          // typed the wrong way round
      out[f.min] = a; out[f.max] = b;
    }
    set(out); close();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="flex flex-col gap-3">
      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p.label} type="button" onClick={() => { set({ ...empty, ...p.entries }); close(); }}
              className={cn(SMALL_BTN, 'h-7 px-3', CHIP_OFF)}>{p.label}</button>
          ))}
        </div>
      )}
      {fields.map(f => (
        <fieldset key={f.min} className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-muted-foreground">{f.label}</legend>
          <div className="flex items-center gap-2">
            {([['min', 'Min'], ['max', 'Max']] as const).map(([end, word]) => (
              <label key={end} className="relative flex-1">
                <span className="sr-only">{`${f.label} ${word.toLowerCase()}`}</span>
                {f.unit && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{f.unit}</span>}
                <input type="number" inputMode="decimal" step={f.step ?? 1} min={f.lo} max={f.hi} placeholder={word}
                  value={draft[f[end]]} onChange={e => setDraft(d => ({ ...d, [f[end]]: e.target.value }))}
                  className={cn(INPUT, f.unit && 'pl-6')} />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Footer onApply={apply} onClear={() => { set(empty); close(); }}
        canClear={fields.some(f => f.current[0] != null || f.current[1] != null)} />
    </form>
  );
}

/**
 * Pick several. With `exclude`, each row can also be excluded (TrendTrack's
 * include/exclude): tap the name to include, "Exclude" to leave it out.
 */
function MultiPanel({ options, include, exclude, onChange, searchable, label }: {
  options: Option[]; include: string[]; exclude?: string[];
  onChange: (include: string[], exclude: string[]) => void; searchable?: boolean; label: string;
}) {
  const [needle, setNeedle] = useState('');
  const n = needle.trim().toLowerCase();
  const shown = (n ? options.filter(o => o.label.toLowerCase().includes(n)) : options).slice(0, 200);
  const ex = exclude ?? [];
  const toggle = (v: string, into: 'in' | 'ex') => {
    const inc = include.filter(x => x !== v), exc = ex.filter(x => x !== v);
    if (into === 'in' && !include.includes(v)) inc.push(v);
    if (into === 'ex' && !ex.includes(v)) exc.push(v);
    onChange(inc, exc);
  };
  return (
    <>
      {searchable && (
        <input type="search" value={needle} onChange={e => setNeedle(e.target.value)} autoFocus
          placeholder={`Search ${label.toLowerCase()}…`} aria-label={`Search ${label.toLowerCase()}`} className={INPUT} />
      )}
      {(include.length > 0 || ex.length > 0) && (
        <button type="button" onClick={() => onChange([], [])} className="self-start text-[13px] font-medium text-[var(--a-blue)]">
          Clear {include.length + ex.length} selected
        </button>
      )}
      <ul className="-mx-1 flex flex-col">
        {shown.map(o => {
          const on = include.includes(o.value), off = ex.includes(o.value);
          return (
            <li key={o.value} className="flex items-center gap-1">
              <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(o.value, 'in')}
                className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--a-fill)]', FOCUS, off && 'text-muted-foreground line-through')}>
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30')}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
              {exclude && (
                <button type="button" aria-pressed={off} onClick={() => toggle(o.value, 'ex')}
                  className={cn('shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium', FOCUS, off ? 'bg-[var(--a-red,#d70015)] text-white' : 'text-muted-foreground hover:bg-[var(--a-fill)]')}>
                  {off ? 'Excluded' : 'Exclude'}
                </button>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="px-2 py-1.5 text-muted-foreground">No matches</li>}
      </ul>
    </>
  );
}

function multiSummary(include: string[], exclude: string[], label: (v: string) => string): string {
  const first = include[0] ?? exclude[0];
  if (!first) return '';
  const head = include.length ? label(first) : `not ${label(first)}`;
  const more = include.length + exclude.length - 1;
  return more > 0 ? `${head} +${more}` : head;
}

const GROWTH_PRESETS: { label: string; value: string }[] = [
  { label: 'Growing', value: 'positive' }, { label: 'Declining', value: 'declining' },
  { label: '10%+', value: '10' }, { label: '25%+', value: '25' }, { label: '50%+', value: '50' },
];
const PERIOD_LABEL: Record<GrowthPeriod, string> = { '1m': '1 month', '3m': '3 months', '6m': '6 months' };

function GrowthPanel({ current, set, close }: { current: string; set: Set; close: () => void }) {
  const [rules, setRules] = useState<(Omit<GrowthRule, 'value'> & { value: string })[]>(() => {
    const r = parseGrowthRules(current);
    return (r.length ? r : [{ period: '1m', direction: 'greater', value: 0, operator: 'AND' } as GrowthRule])
      .map(x => ({ ...x, value: r.length ? String(x.value) : '' }));
  });
  const patch = (i: number, p: Partial<(typeof rules)[number]>) => setRules(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const apply = () => {
    const ok = rules.filter(r => r.value.trim() !== '' && Number.isFinite(Number(r.value)))
      .map(r => ({ ...r, value: Number(r.value) }));
    set({ growth: formatGrowthRules(ok) }); close();
  };
  const SELECT = cn(INPUT, 'w-auto pr-1');
  return (
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {GROWTH_PRESETS.map(p => (
          <button key={p.value} type="button" onClick={() => { set({ growth: p.value }); close(); }}
            className={cn(SMALL_BTN, 'h-7 px-3', current === p.value ? CHIP_ON : CHIP_OFF)}>{p.label}</button>
        ))}
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">Visits changed over</p>
      {rules.map((r, i) => (
        <div key={i} className="flex flex-col gap-2">
          {i > 0 && (
            <select aria-label="Join with" value={r.operator} onChange={e => patch(i, { operator: e.target.value as 'AND' | 'OR' })} className={cn(SELECT, 'self-start')}>
              <option value="AND">and</option><option value="OR">or</option>
            </select>
          )}
          <div className="flex items-center gap-1.5">
            <select aria-label="Period" value={r.period} onChange={e => patch(i, { period: e.target.value as GrowthPeriod })} className={SELECT}>
              {(Object.keys(PERIOD_LABEL) as GrowthPeriod[]).map(p => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
            </select>
            <select aria-label="Direction" value={r.direction} onChange={e => patch(i, { direction: e.target.value as 'greater' | 'lower' })} className={SELECT}>
              <option value="greater">greater than</option><option value="lower">lower than</option>
            </select>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Percent</span>
              <input type="number" inputMode="decimal" step="any" value={r.value} placeholder="0"
                onChange={e => patch(i, { value: e.target.value })} className={cn(INPUT, 'pr-6')} />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </label>
            {rules.length > 1 && (
              <button type="button" aria-label="Remove rule" onClick={() => setRules(rs => rs.filter((_, j) => j !== i))}
                className={cn('shrink-0 rounded-full p-1 text-muted-foreground hover:bg-[var(--a-fill)]', FOCUS)}><X className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      ))}
      {rules.length < 6 && (
        <button type="button" onClick={() => setRules(rs => [...rs, { period: '3m', direction: 'greater', value: '', operator: 'AND' }])}
          className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-[var(--a-blue)]"><Plus className="h-3.5 w-3.5" /> Add rule</button>
      )}
      <Footer onApply={apply} onClear={() => { set({ growth: '' }); close(); }} canClear={!!current} />
    </form>
  );
}

function NichePanel({ niches, picked, pickedSubs, set }: {
  niches: NonNullable<TechFacets['niches']>; picked: string[]; pickedSubs: string[]; set: Set;
}) {
  const [openRows, setOpenRows] = useState<string[]>(() => niches.filter(n => n.subs.some(s => pickedSubs.includes(s.name))).map(n => n.name));
  const write = (top: string[], subs: string[]) => set({ niche: top.join('|'), nicheSub: subs.join('|') });
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const box = (on: boolean) => (
    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30')}>
      {on && <Check className="h-3 w-3" />}
    </span>
  );
  return (
    <ul className="-mx-1 flex flex-col">
      {(picked.length > 0 || pickedSubs.length > 0) && (
        <li><button type="button" onClick={() => write([], [])} className="px-2 pb-1 text-[13px] font-medium text-[var(--a-blue)]">Clear niches</button></li>
      )}
      {niches.map(n => {
        const subs = n.subs.filter(s => s.count > 0);
        const expanded = openRows.includes(n.name);
        return (
          <li key={n.name}>
            <div className="flex items-center gap-1">
              <button type="button" role="checkbox" aria-checked={picked.includes(n.name)} onClick={() => write(flip(picked, n.name), pickedSubs)}
                className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--a-fill)]', FOCUS)}>
                {box(picked.includes(n.name))}
                <span className="truncate">{n.name}</span>
                <span className="ml-auto shrink-0 text-[12px] tabular-nums text-muted-foreground">{compact(n.count)}</span>
              </button>
              {subs.length > 0 && (
                <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} ${n.name} sub-niches`}
                  onClick={() => setOpenRows(r => flip(r, n.name))} className={cn('shrink-0 rounded-full p-1 text-muted-foreground hover:bg-[var(--a-fill)]', FOCUS)}>
                  <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
                </button>
              )}
            </div>
            {expanded && (
              <ul className="ml-6 flex flex-col">
                {subs.map(s => (
                  <li key={s.name}>
                    <button type="button" role="checkbox" aria-checked={pickedSubs.includes(s.name)} onClick={() => write(picked, flip(pickedSubs, s.name))}
                      className={cn('flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--a-fill)]', FOCUS)}>
                      {box(pickedSubs.includes(s.name))}
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto shrink-0 text-[12px] tabular-nums text-muted-foreground">{compact(s.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const CREATED_PRESETS = [
  { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' }, { value: '2y', label: 'Last 2 years' },
];

function DatePanel({ params, set, close }: { params: URLSearchParams; set: Set; close: () => void }) {
  const [from, setFrom] = useState(params.get('minDate') ?? '');
  const [to, setTo] = useState(params.get('maxDate') ?? '');
  const created = params.get('created') ?? '';
  const apply = () => {
    const [a, b] = from && to && from > to ? [to, from] : [from, to];
    set({ created: '', minDate: a, maxDate: b }); close();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {CREATED_PRESETS.map(p => (
          <button key={p.value} type="button" onClick={() => { set({ created: p.value, minDate: '', maxDate: '' }); close(); }}
            className={cn(SMALL_BTN, 'h-7 px-3', created === p.value ? CHIP_ON : CHIP_OFF)}>{p.label}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[13px] text-muted-foreground">From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={INPUT} /></label>
        <label className="flex flex-1 flex-col gap-1 text-[13px] text-muted-foreground">To
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={INPUT} /></label>
      </div>
      <Footer onApply={apply} onClear={() => { set({ created: '', minDate: '', maxDate: '' }); close(); }}
        canClear={!!(created || params.get('minDate') || params.get('maxDate'))} />
    </form>
  );
}

/** URL keys these chips own, for the "N active" badge and Clear. */
export const SHOP_FILTER_KEYS = [
  'minTraffic', 'maxTraffic', 'traffic', 'growth', 'minProducts', 'maxProducts', 'productsMin', 'productsMax',
  'minPrice', 'maxPrice', 'avgPriceMin', 'avgPriceMax', 'minAds', 'maxAds', 'creationCountry', 'excludeCreationCountry', 'country',
  'visitorCountry', 'niche', 'nicheSub', 'created', 'minDate', 'maxDate', 'language', 'currency', 'theme', 'app', 'excludeApp',
  'pixel', 'excludePixel', 'tech', 'social', 'plan', 'minRating', 'maxRating', 'minReviews', 'maxReviews',
] as const;

/** Chips 1–7 and 10–17 (Viewed / Brandtracker / Subcategory stay in MarketToolbar). */
export function ShopFilterChips({ params, set, tech, profileOptions, techOptions, pixelOptions, before, plan }: {
  params: URLSearchParams; set: Set; tech: TechFacets | null;
  profileOptions: Record<ProfileKey, Option[]> | null; techOptions: Option[]; pixelOptions: Option[];
  /** Rendered between Creation Date and the storefront chips (Viewed, Brandtracker). */
  before?: ReactNode;
  /** The Shopify Plan chip, before Trustpilot. */
  plan?: ReactNode;
}) {
  const sp = useMemo(() => Object.fromEntries(params) as Record<string, string>, [params]);
  const f = useMemo(() => parseShopQuery(sp), [sp]);
  const list = (k: string) => names(sp[k]);
  const codes = (k: string) => (sp[k] ?? '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const origin = [...new Set([...codes('creationCountry'), ...codes('country')])];
  const originEx = codes('excludeCreationCountry');
  const niches = (tech?.niches ?? []).filter(n => n.count > 0);
  const country = (c: string) => `${flag(c)} ${c}`;
  const labelOf = (opts: Option[]) => (v: string) => (opts.find(o => o.value === v)?.label ?? v).replace(/ \([\d.,]+[KM]?\)$/, '');
  const createdSummary = sp.minDate || sp.maxDate
    ? sp.minDate && sp.maxDate ? `${sp.minDate} – ${sp.maxDate}` : sp.minDate ? `since ${sp.minDate}` : `before ${sp.maxDate}`
    : CREATED_PRESETS.find(p => p.value === sp.created)?.label ?? '';
  const growthSummary = f.growthRules?.length
    ? describeGrowthRules(f.growthRules.slice(0, 1)) + (f.growthRules.length > 1 ? ` +${f.growthRules.length - 1}` : '')
    : GROWTH_PRESETS.find(p => p.value === sp.growth)?.label ?? '';
  const products = [span(f.productsMin, f.productsMax), span(f.avgPriceMin, f.avgPriceMax, n => `$${compact(n)}`)].filter(Boolean).join(', ');
  const rating = [span(f.trustpilotScoreMin, f.trustpilotScoreMax, n => `${n}★`), span(f.trustpilotReviewsMin, f.trustpilotReviewsMax, n => `${compact(n)} reviews`)].filter(Boolean).join(', ');
  const socialOptions = (tech?.profile?.social ?? []).filter(s => SOCIALS[s.name]).map(s => ({ value: s.name, label: SOCIALS[s.name] }));

  const multi = (key: ProfileKey | 'pixel' | 'tech', label: string, icon: LucideIcon, options: Option[], opts: { exKey?: string; searchable?: boolean } = {}) =>
    options.length > 0 && (
      <PanelChip key={key} icon={icon} label={label} summary={multiSummary(list(key), opts.exKey ? list(opts.exKey) : [], labelOf(options))}>
        {() => (
          <MultiPanel label={label} options={options} include={list(key)} exclude={opts.exKey ? list(opts.exKey) : undefined}
            searchable={opts.searchable ?? options.length > 12}
            onChange={(inc, exc) => set({ [key]: inc.join('|'), ...(opts.exKey ? { [opts.exKey]: exc.join('|') } : {}) })} />
        )}
      </PanelChip>
    );

  return (
    <>
      <PanelChip icon={Users} label="Traffic" summary={span(f.trafficMin, f.trafficMax)}>
        {close => (
          <RangePanel set={set} close={close} clears={['traffic']}
            fields={[{ label: 'Monthly visitors', min: 'minTraffic', max: 'maxTraffic', current: [f.trafficMin, f.trafficMax], lo: 0 }]}
            presets={[['10K+', 10_000], ['100K+', 100_000], ['1M+', 1_000_000], ['10M+', 10_000_000]].map(([label, v]) => ({ label: String(label), entries: { minTraffic: String(v) } }))} />
        )}
      </PanelChip>
      <PanelChip icon={TrendingUp} label="Traffic Growth" summary={growthSummary} wide>
        {close => <GrowthPanel current={sp.growth ?? ''} set={set} close={close} />}
      </PanelChip>
      <PanelChip icon={Package} label="Products" summary={products}>
        {close => (
          <RangePanel set={set} close={close} clears={['productsMin', 'productsMax', 'avgPriceMin', 'avgPriceMax']} fields={[
            { label: 'Number of products', min: 'minProducts', max: 'maxProducts', current: [f.productsMin, f.productsMax], lo: 0 },
            { label: 'Product price', min: 'minPrice', max: 'maxPrice', current: [f.avgPriceMin, f.avgPriceMax], lo: 0, step: 0.01, unit: '$' },
          ]} />
        )}
      </PanelChip>
      <PanelChip icon={Megaphone} label="Ads" summary={span(f.adsMin, f.adsMax)}>
        {close => (
          <RangePanel set={set} close={close}
            fields={[{ label: 'Ads in the Ad Library', min: 'minAds', max: 'maxAds', current: [f.adsMin, f.adsMax], lo: 0 }]} />
        )}
      </PanelChip>
      <PanelChip icon={Store} label="Shop Origin" summary={multiSummary(origin, originEx, country)}>
        {() => (
          <MultiPanel label="countries" options={COUNTRY_OPTIONS} include={origin} exclude={originEx} searchable
            onChange={(inc, exc) => set({ country: '', creationCountry: inc.join(','), excludeCreationCountry: exc.join(',') })} />
        )}
      </PanelChip>
      <PanelChip icon={Globe} label="Visitor Country" summary={multiSummary(codes('visitorCountry'), [], country)}>
        {() => (
          <MultiPanel label="countries" options={COUNTRY_OPTIONS} include={codes('visitorCountry')} searchable
            onChange={inc => set({ visitorCountry: inc.join(',') })} />
        )}
      </PanelChip>
      {niches.length > 0 && (
        <PanelChip icon={LayoutGrid} label="Niche" summary={multiSummary([...list('niche'), ...list('nicheSub')], [], v => v)}>
          {() => <NichePanel niches={niches} picked={list('niche')} pickedSubs={list('nicheSub')} set={set} />}
        </PanelChip>
      )}
      <PanelChip icon={CalendarDays} label="Creation Date" summary={createdSummary}>
        {close => <DatePanel params={params} set={set} close={close} />}
      </PanelChip>
      {before}
      {profileOptions && (
        <>
          {multi('language', 'Language', Languages, profileOptions.language, { searchable: true })}
          {multi('currency', 'Currency', Coins, profileOptions.currency, { searchable: true })}
          {multi('theme', 'Shopify Theme', Palette, profileOptions.theme, { searchable: true })}
          {multi('app', 'Shopify App', Puzzle, profileOptions.app, { exKey: 'excludeApp', searchable: true })}
        </>
      )}
      {multi('pixel', 'Pixels', Radar, pixelOptions, { exKey: 'excludePixel' })}
      {multi('social', 'Socials', AtSign, socialOptions)}
      {plan}
      <PanelChip icon={Star} label="Trustpilot" summary={rating}>
        {close => (
          <RangePanel set={set} close={close} fields={[
            { label: 'Score (1–5)', min: 'minRating', max: 'maxRating', current: [f.trustpilotScoreMin, f.trustpilotScoreMax], lo: 1, hi: 5, step: 0.1 },
            { label: 'Number of reviews', min: 'minReviews', max: 'maxReviews', current: [f.trustpilotReviewsMin, f.trustpilotReviewsMax], lo: 0 },
          ]} />
        )}
      </PanelChip>
      {multi('tech', 'Technology', Blocks, techOptions, { searchable: true })}
    </>
  );
}
