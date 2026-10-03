import { queryAds, favoriteIds, labelFacets } from '@/lib/data';
import { requireCtx } from '@/lib/auth/guard';
import { CreativeCard } from '@/components/market/CreativeCard';
import { AdsToolbar } from '@/components/market/AdsToolbar';
import { SaveSearchButton } from '@/components/market/SaveSearchButton';
import { AdsNavRegister } from '@/components/market/AdClient';
import { PageShell } from '@/components/layouts/page-shell';
import { MarketPagination, SearchBox } from '@/components/market/MarketToolbar';
import { creativeNiches } from '@/lib/market/shops';
import { hasLabelFilter } from '@/lib/market/labels';
import { ADS_PAGE_SIZE, adFilterFromParams, adLabelsFromParams } from '@/lib/market/ads-params';

export const metadata = { title: 'Ads' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = ADS_PAGE_SIZE;

export default async function AdsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();

  const filter = adFilterFromParams(sp);
  const page = filter.page!;
  const labels = adLabelsFromParams(sp);

  const [res, savedIds, facets, niches] = await Promise.all([
    queryAds(filter),
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
      actions={<><SearchBox placeholder="Search ads, advertisers…" label="Search ads by copy, headline or advertiser" /><SaveSearchButton kind="ads" /></>}
      titleAdornment={
        <span className="flex items-center gap-2">
          {/* The index holds Meta ads only, so Meta is the one network tab. */}
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-foreground/5 p-1">
            <span className="rounded-lg bg-background px-2.5 py-1 text-sm font-medium text-foreground shadow-sm">Meta</span>
          </span>
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
