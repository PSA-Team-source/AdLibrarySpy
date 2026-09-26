'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterDef {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}

function useSetParam() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const set = useCallback((entries: Record<string, string>) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    for (const [k, v] of Object.entries(entries)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    p.delete('page');
    start(() => router.push(`${pathname}?${p.toString()}`));
  }, [params, pathname, router]);
  return { set, params, pending };
}

export function FilterBar({ filters, sorts }: { filters: FilterDef[]; sorts?: { value: string; label: string }[] }) {
  const { set, params, pending } = useSetParam();
  const active = filters.filter(f => params.get(f.param));

  return (
    <div className={cn('card p-4 transition-opacity', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-foreground">Filter</span>
        {filters.map(f => {
          const cur = params.get(f.param) ?? '';
          return (
            <div key={f.param} className="relative">
              <select
                value={cur}
                aria-label={f.label}
                onChange={e => set({ [f.param]: e.target.value })}
                className={cn('chip min-w-[130px] appearance-none pr-8', cur && 'chip-active')}
              >
                <option value="">{f.label}</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            </div>
          );
        })}
        {active.length > 0 && (
          <button
            onClick={() => set(Object.fromEntries(filters.map(f => [f.param, ''])))}
            className="ml-1 text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Clear {active.length} filter{active.length > 1 ? 's' : ''}
          </button>
        )}
      </div>
      {sorts && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <label htmlFor="sortby" className="text-sm text-muted-foreground">Sort by</label>
          <select
            id="sortby"
            value={params.get('sort') ?? ''}
            onChange={e => set({ sort: e.target.value })}
            className="chip appearance-none pr-8"
          >
            {sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export function SearchBox({
  placeholder = 'Search…',
  destination,
}: {
  placeholder?: string;
  /** Optional route that receives the query. Useful for global search surfaces. */
  destination?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  return (
    <form
      className="flex-1 max-w-2xl"
      onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const p = new URLSearchParams(Array.from(params.entries()));
        const q = String(fd.get('q') || '').trim();
        if (q) p.set('q', q); else p.delete('q');
        p.delete('page');
        router.push(`${destination ?? pathname}?${p.toString()}`);
      }}
    >
      <div className="flex h-11 items-center gap-2 rounded-md border border-[hsl(var(--input-border))] bg-input pl-3 pr-1 transition-colors focus-within:border-transparent focus-within:ring-2 focus-within:ring-ring sm:h-10">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          name="q"
          defaultValue={params.get('q') ?? ''}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <button type="submit" className="btn-ghost h-8 px-3 text-xs">Search</button>
      </div>
    </form>
  );
}

export function Segments({ items }: { items: { value: string; label: string; icon: string }[] }) {
  const { set, params } = useSetParam();
  const cur = params.get('view') ?? '';
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it => (
        <button
          key={it.value}
          onClick={() => set({ view: it.value })}
          aria-pressed={cur === it.value}
          className={cn('chip', cur === it.value && 'chip-active')}
        >
          <span aria-hidden>{it.icon}</span>{it.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Pagination. `total` is null when the index does not report a count — we then
 * offer Prev/Next based on whether the current page came back full, rather than
 * inventing a page count.
 */
export function Pagination({ page, total, limit, hasMore }: {
  page: number; total: number | null; limit: number; hasMore?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const go = (p: number) => {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.set('page', String(p));
    router.push(`${pathname}?${q.toString()}`);
  };

  if (total != null) {
    const pages = Math.ceil(total / limit);
    if (pages <= 1) return null;
    const first = Math.max(1, Math.min(pages - 6, page - 3));
    const nums = Array.from({ length: Math.min(7, pages) }, (_, i) => first + i).filter(n => n >= 1 && n <= pages);
    return (
      <nav className="flex items-center justify-center gap-1 py-6" aria-label="Pagination">
        <button disabled={page <= 1} onClick={() => go(page - 1)} className="btn-ghost h-9 px-3 disabled:opacity-40">Previous</button>
        {nums.map(n => (
          <button key={n} onClick={() => go(n)} aria-current={n === page ? 'page' : undefined}
            className={cn('inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm tabular-nums transition-colors', n === page ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>{n}</button>
        ))}
        <button disabled={page >= pages} onClick={() => go(page + 1)} className="btn-ghost h-9 px-3 disabled:opacity-40">Next</button>
      </nav>
    );
  }

  if (page <= 1 && !hasMore) return null;
  return (
    <nav className="flex items-center justify-center gap-3 py-6" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => go(page - 1)} className="btn-ghost h-9 px-3 disabled:opacity-40">Previous</button>
      <span className="text-sm text-muted-foreground">Page {page}</span>
      <button disabled={!hasMore} onClick={() => go(page + 1)} className="btn-ghost h-9 px-3 disabled:opacity-40">Next</button>
    </nav>
  );
}
