'use client';
// The Shops explorer, built the way PlatformDTC's /market/top-brands is: the
// route renders once, then every filter, sort and page change is a small JSON
// fetch (GET /api/shops) keyed by the query string. The previous rows stay on
// screen, dimmed, until the next page lands, and every page already seen comes
// back instantly from the cache while it revalidates in the background.
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/layouts/page-shell';
import { MarketPagination, MarketToolbar, ShallowUrlProvider } from '@/components/market/MarketToolbar';
import { SaveSearchButton } from '@/components/market/SaveSearchButton';
import { ShopExplorerTable } from '@/components/market/ShopExplorerTable';
import { SHOPS_KEY } from '@/components/market/shops-cache';
import type { CategoryNode, TechFacets } from '@/lib/market/shops';
import type { ShopsPayload } from '@/app/(app)/shops/load';
import { cn } from '@/lib/utils';

/** Order-independent query string, so `?a=1&b=2` and `?b=2&a=1` share one cache entry. */
function canonical(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([, v]) => v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchShops(qs: string, signal: AbortSignal): Promise<ShopsPayload> {
  const res = await fetch(`/api/shops${qs ? `?${qs}` : ''}`, { signal, headers: { Accept: 'application/json' } });
  // The session ended in another tab: the app's own guard takes it from here.
  if (res.status === 401) { window.location.assign('/login'); throw new Error('Signed out'); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Shops could not be loaded');
  return res.json();
}

export function ShopsExplorer({ categories, tech, initial, initialParams, renderedAt }: {
  categories: CategoryNode[];
  tech: TechFacets | null;
  /** The page the server rendered for `initialParams` — first paint needs no fetch. */
  initial: ShopsPayload;
  initialParams: Record<string, string>;
  renderedAt: number;
}) {
  const params = useSearchParams();
  const qs = canonical(params);
  const initialQs = useMemo(() => canonical(new URLSearchParams(initialParams)), [initialParams]);

  const q = useQuery({
    queryKey: [SHOPS_KEY, qs],
    queryFn: ({ signal }) => fetchShops(qs, signal),
    initialData: qs === initialQs ? initial : undefined,
    initialDataUpdatedAt: renderedAt,
    placeholderData: keepPreviousData,
  });

  // Rows remount (scroll back to the top) when a new result replaces them, not
  // when the same result revalidates in the background.
  const shownKey = useRef(qs);
  if (!q.isPlaceholderData && q.data) shownKey.current = qs;

  const data = q.data;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const saved = useMemo(() => new Set(rows.filter(r => r.saved).map(r => r.id)), [rows]);
  const viewed = useMemo(() => new Set(rows.filter(r => r.viewed).map(r => r.id)), [rows]);

  const showHidden = params.get('hidden') === 'show';
  const page = Math.max(1, Number(params.get('page')) || 1);

  // "Next" is the most common click: fetch it while the reader scans this page.
  const qc = useQueryClient();
  useEffect(() => {
    if (!data || q.isPlaceholderData) return;
    const more = data.total != null ? page * data.limit < data.total : data.hasMore;
    if (!more) return;
    const next = new URLSearchParams(params);
    next.set('page', String(page + 1));
    const nextQs = canonical(next);
    void qc.prefetchQuery({ queryKey: [SHOPS_KEY, nextQs], queryFn: ({ signal }) => fetchShops(nextQs, signal) });
  }, [data, q.isPlaceholderData, page, params, qc]);

  return (
    <ShallowUrlProvider>
      <PageShell
        fullHeight
        className="apple-ui gap-5 bg-[var(--a-canvas)]"
        title={showHidden ? 'Hidden shops' : 'Shops'}
        actions={showHidden ? undefined : <SaveSearchButton kind="shops" />}
        titleAdornment={(data?.allPlatformsTotal ?? data?.total) != null
          ? <span className="inline-flex items-center rounded-full bg-[var(--a-fill)] px-3 py-1 text-[13px] font-semibold tabular-nums text-foreground" title="Shops across all platforms">{(data!.allPlatformsTotal ?? data!.total)!.toLocaleString()}</span>
          : undefined}
      >
        <MarketToolbar categories={categories} hiddenCount={data?.hiddenCount ?? 0} tech={tech} />

        {q.isError && (
          <div role="alert" className="alert-error flex shrink-0 items-center justify-between gap-3 rounded-2xl text-sm">
            <span>{q.error instanceof Error ? q.error.message : 'Shops could not be loaded'}.</span>
            <button type="button" onClick={() => q.refetch()} className="font-medium underline">Try again</button>
          </div>
        )}

        {data && (
          <div
            aria-busy={q.isPlaceholderData}
            className={cn('flex min-h-0 flex-1 flex-col transition-opacity', q.isPlaceholderData && 'pointer-events-none opacity-60')}
          >
            <ShopExplorerTable
              key={shownKey.current}
              shops={rows}
              saved={saved}
              rankOffset={(page - 1) * (data.limit)}
              viewed={viewed}
              hiddenView={showHidden}
              sortable
              empty={showHidden ? 'No hidden shops match these filters.' : 'No shops match these filters.'}
            />
          </div>
        )}

        {data && <MarketPagination page={page} total={data.total} limit={data.limit} hasMore={data.hasMore} />}
      </PageShell>
    </ShallowUrlProvider>
  );
}
