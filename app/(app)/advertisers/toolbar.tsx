'use client';
import { ArrowDownUp, Globe, Landmark, Megaphone, Rocket, Users, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS, FilterChip, PlatformChip, useSetParam } from '@/components/market/MarketToolbar';

// Same recipe as the Shops toolbar (components/market/MarketToolbar.tsx): one
// row of dropdown chips; search sits on the title row (SearchBox).
export interface ToolbarSelect { param: string; label: string; options: { value: string; label: string }[] }

const FILTER_KEYS = ['country', 'live', 'launched', 'followers', 'q'];
const ICONS: Record<string, LucideIcon> = { country: Globe, live: Megaphone, launched: Rocket, followers: Users };

export function AdvertisersToolbar({ selects, sorts }: { selects: ToolbarSelect[]; sorts: { value: string; label: string }[] }) {
  const { set, params, pending, prefetch } = useSetParam();
  const p = (k: string) => params.get(k) ?? '';
  const active = FILTER_KEYS.filter(k => params.get(k)).length;
  const defaultSort = sorts.find(s => !s.value);

  return (
    <div className={cn('flex shrink-0 flex-wrap items-center gap-2 transition-opacity', pending && 'opacity-60')}>
      <PlatformChip params={params} set={set} prefetch={prefetch} />
      <FilterChip icon={Landmark} label="Region" value={p('scope')} anyLabel="All advertisers" showAny={false}
        onChange={v => set({ scope: v })} options={[{ value: 'eu', label: 'EU/UK' }]} />
      {selects.map(s => (
        <FilterChip key={s.param} icon={ICONS[s.param] ?? Globe} label={s.label} value={p(s.param)}
          onChange={v => set({ [s.param]: v })} options={s.options} />
      ))}
      <FilterChip icon={ArrowDownUp} label="Sort" value={p('sort')} anyLabel={defaultSort?.label ?? 'Default'}
        onChange={v => set({ sort: v })} options={sorts.filter(s => s.value)} />
      {active > 0 && (
        <button type="button" onClick={() => set(Object.fromEntries(FILTER_KEYS.map(k => [k, ''])))}
          className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-[var(--a-blue)] transition-opacity hover:opacity-80', FOCUS)}>
          <X className="h-3 w-3" /> Clear {active} filter{active > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
