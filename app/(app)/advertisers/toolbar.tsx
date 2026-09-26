'use client';
import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetParam, useDebounce } from '@/components/market/MarketToolbar';

// Same recipe as the Shops toolbar (components/market/MarketToolbar.tsx).
const SELECT =
  'h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm ' +
  'outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring';

export interface ToolbarSelect { param: string; label: string; options: { value: string; label: string }[] }

const FILTER_KEYS = ['country', 'live', 'launched', 'followers', 'q'];

export function AdvertisersToolbar({ selects, sorts }: { selects: ToolbarSelect[]; sorts: { value: string; label: string }[] }) {
  const { set, params, pending } = useSetParam();
  const [term, setTerm] = useState(params.get('q') ?? '');
  useEffect(() => { setTerm(params.get('q') ?? ''); }, [params]);
  const debounced = useDebounce(term, 300);
  useEffect(() => {
    if (debounced !== (params.get('q') ?? '')) set({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const scope = params.get('scope') ?? '';
  const active = FILTER_KEYS.filter(k => params.get(k)).length;
  const tab = (value: string, label: string) => (
    <button
      type="button"
      onClick={() => set({ scope: value })}
      aria-pressed={scope === value}
      className={cn('border-b-2 pb-2.5 text-sm transition-colors',
        scope === value ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground')}
    >
      {label}
    </button>
  );

  return (
    <div className={cn('flex shrink-0 flex-col gap-3 transition-opacity', pending && 'opacity-60')}>
      <form className="relative" onSubmit={e => { e.preventDefault(); set({ q: term.trim() }); }}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="Search advertisers…"
          aria-label="Search advertisers"
          className="w-full rounded-md border border-[hsl(var(--input-border))] bg-input py-2.5 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        {term && (
          <button type="button" onClick={() => { setTerm(''); set({ q: '' }); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="rounded-xl border border-border bg-foreground/[0.025] p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-5 border-b border-border">
          <span className="pb-2.5 text-sm font-semibold text-foreground">Filter By:</span>
          {tab('', 'Advertisers')}
          {tab('eu', 'EU/UK')}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selects.map(s => (
            <select key={s.param} aria-label={s.label} className={SELECT}
              value={params.get(s.param) ?? ''} onChange={e => set({ [s.param]: e.target.value })}>
              <option value="">{s.label}</option>
              {s.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          {active > 0 && (
            <button type="button" onClick={() => set(Object.fromEntries(FILTER_KEYS.map(k => [k, ''])))}
              className="ml-1 text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground">
              Clear {active} filter{active > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      <div>
        <select aria-label="Sort advertisers" className={SELECT}
          value={params.get('sort') ?? ''} onChange={e => set({ sort: e.target.value })}>
          {sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}
