import { queryAds, favoriteIds, labelFacets } from '@/lib/data';
import { requireCtx } from '@/lib/auth/guard';
import { CreativeCard } from '@/components/market/CreativeCard';
import { AdsToolbar } from '@/components/market/AdsToolbar';
import { AdsNavRegister } from '@/components/market/AdClient';
import { PageShell } from '@/components/layouts/page-shell';
import { MarketPagination } from '@/components/market/MarketToolbar';
import { creativeNiches } from '@/lib/market/shops';
import { isAdSort } from '@/lib/market/ad-options';
import { cleanLabelValues, hasLabelFilter, type LabelFilter } from '@/lib/market/labels';

export const metadata = { title: 'Ads' };
export const dynamic = 'force-dynamic';

const num = (v: string | undefined) => (v && Number.isFinite(+v) ? +v : undefined);
const PAGE_SIZE = 25; // 5 columns × 5 rows

export default async function AdsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filtered = Object.entries(sp).some(([k, v]) => v && !['page', 'sort', 'dir'].includes(k));
  const ctx = await requireCtx();

  const page = Math.max(1, num(sp.page) ?? 1);

  const labels: LabelFilter = {
    hook: cleanLabelValues('hook', sp.hook),
    angle: cleanLabelValues('angle', sp.angle),
    funnelStage: cleanLabelValues('funnelStage', sp.funnelStage),
    offer: cleanLabelValues('offer', sp.offer),
    urgency: sp.urgency === '1',
  };

  const [res, savedIds, facets, niches] = await Promise.all([
    queryAds({
      mode: 'all',
      q: sp.q,
      media: sp.media === 'image' || sp.media === 'video' ? sp.media : undefined,
      format: sp.format,
      placement: sp.placement,
      country: sp.country,
      euUk: sp.euUk === '1',
      from: sp.from,
      to: sp.to,
      category: sp.niche,
      sort: isAdSort(sp.sort) ? sp.sort : undefined,
      storeDomain: sp.store,
      ...labels,
      page,
      limit: PAGE_SIZE,
    }),
    // Saved state is secondary: if the app DB is slow the grid still renders.
    favoriteIds(ctx.workspaceId, ctx.user.id, 'ad').catch(() => [] as string[]),
    labelFacets({ q: sp.q, storeDomain: sp.store, country: sp.country, ...labels }),
    creativeNiches(),
  ]);
  // Label filters are offered only when the index has labels for this search.
  // An active label filter keeps them visible so it can always be cleared.
  const labelFacetsShown = facets && (facets.labeled > 0 || hasLabelFilter(labels)) ? facets : null;
  const saved = new Set(savedIds);
  // The index files each ad under its store's category ids; name the first
  // top-level niche we know. Unknown = no niche tag on the card.
  const nicheName = new Map(niches.map(n => [n.id, n.name]));
  const withNiche = (ad: (typeof res.items)[number]) =>
    ad.niche ? ad : { ...ad, niche: ad.storeCategoryIds.map(id => nicheName.get(id)).find(Boolean) ?? '' };

  const storeFilter = sp.store
    ? { id: sp.store, label: res.items[0]?.advertiser ?? sp.store }
    : undefined;

  return (
    <PageShell
      title="Ads"
      fullHeight
      titleAdornment={
        <span className="flex items-center gap-2">
          {/* The index holds Meta ads only, so Meta is the one network tab. */}
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-foreground/5 p-1">
            <span className="rounded-lg bg-background px-2.5 py-1 text-sm font-medium text-foreground shadow-sm">Meta</span>
          </span>
          {/* A result count for a search/filter; the bare library total is not headlined. */}
          {filtered && res.total != null && <span className="pill tabular-nums">{res.total.toLocaleString()}</span>}
        </span>
      }
    >
      <div className="shrink-0">
        <AdsToolbar storeFilter={storeFilter} labelFacets={labelFacetsShown} niches={niches} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto scroll-thin">
        {res.items.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
            <h2 className="text-lg font-medium text-foreground">No ads match these filters</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Try a broader search, or clear a filter.
            </p>
          </div>
        ) : (
          <>
            <AdsNavRegister ids={res.items.map(a => a.id)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1440px]:grid-cols-5">
              {res.items.map(ad => (
                <CreativeCard key={ad.id} ad={withNiche(ad)} saved={saved.has(ad.id)} />
              ))}
            </div>
          </>
        )}
      </div>

      <MarketPagination page={page} total={null} limit={PAGE_SIZE} hasMore={res.hasMore} />
    </PageShell>
  );
}
