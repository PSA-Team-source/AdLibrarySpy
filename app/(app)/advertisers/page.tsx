import Link from 'next/link';
import { Eye } from 'lucide-react';
import { getShops, trackedShopIds } from '@/lib/data';
import { queryAdvertisers, EU_UK, type MetaPage } from '@/lib/market/advertisers';
import { ageOf, compact, flag } from '@/lib/format';
import { Sparkline } from '@/components/charts';
import { ChartDetail } from '@/components/market/DetailDialogs';
import { BrandLogo } from '@/components/market/BrandLogo';
import { MarketPagination, SearchBox } from '@/components/market/MarketToolbar';
import { ProductImage } from '@/components/ShopMedia';
import { requireCtx } from '@/lib/auth/guard';
import { PageShell } from '@/components/layouts/page-shell';
import TrackButton from '@/components/TrackButton';
import { AdvertisersToolbar, type ToolbarSelect } from './toolbar';

export const metadata = { title: 'Advertisers' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;
const num = (v: string | undefined) => (v && Number.isFinite(+v) && +v > 0 ? +v : undefined);

// Countries holding the most creatives in the index, largest first.
const COUNTRIES = ['US', 'GB', 'CA', 'AU', 'HK', 'CN', 'NL', 'NZ', 'FR', 'SE', 'SG', 'ES', 'DE', 'CH', 'IN', 'IT', 'IE', 'PL', 'DK', 'FI', 'MX', 'JP', 'BR'];
const regionName = new Intl.DisplayNames(['en'], { type: 'region' });

const SELECTS: ToolbarSelect[] = [
  { param: 'country', label: 'Countries', options: COUNTRIES.map(c => ({ value: c, label: `${flag(c)} ${regionName.of(c) ?? c}` })) },
  { param: 'live', label: 'Live Ads', options: [10, 50, 100, 500, 1000].map(v => ({ value: String(v), label: `${compact(v)}+ live ads` })) },
  { param: 'launched', label: 'Ads Launched', options: [1, 10, 50, 100].map(v => ({ value: String(v), label: `${v}+ in the last 14 days` })) },
  { param: 'followers', label: 'Followers', options: [1_000, 10_000, 100_000, 1_000_000].map(v => ({ value: String(v), label: `${compact(v)}+ Facebook followers` })) },
];

const SORTS = [
  { value: '', label: 'Most ads' },
  { value: 'followers', label: 'Most followers' },
  { value: 'launched', label: 'Most ads launched' },
];

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

function host(url: string): string {
  try { const u = new URL(url); return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, ''); } catch { return url; }
}

function EuUkRow({ page }: { page: MetaPage }) {
  const eu = page.countries.filter(c => EU_UK.has(c.code));
  const euAds = eu.reduce((a, c) => a + c.count, 0);
  const all = page.countries.reduce((a, c) => a + c.count, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border px-5 py-3 text-sm">
      <span className="text-xs font-medium text-muted-foreground">EU/UK</span>
      {euAds === 0 ? (
        <span className="font-medium text-foreground">No ADS EU or UK detected</span>
      ) : (
        <>
          <div className="text-center leading-tight">
            <div className="text-[11px] text-muted-foreground">Ads EU/UK</div>
            <div className="font-semibold tabular-nums text-foreground">
              {euAds.toLocaleString()} <span className="text-sky-600 dark:text-sky-400">({Math.max(1, Math.round((euAds / all) * 100))}%)</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] leading-tight text-muted-foreground">Targeted<br />countries:</span>
            {eu.slice(0, 5).map(c => (
              <span key={c.code} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs tabular-nums text-foreground">
                <span aria-hidden>{flag(c.code)}</span>{c.code} <span className="text-muted-foreground">{Math.round((c.count / euAds) * 100)}%</span>
              </span>
            ))}
            {eu.length > 5 && <span className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground">+{eu.length - 5}</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default async function AdvertisersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const page = num(sp.page) ?? 1;

  const res = await queryAdvertisers({
    q: sp.q, sort: sp.sort, country: sp.country, euUk: sp.scope === 'eu',
    minLive: num(sp.live), minLaunched: num(sp.launched), minFollowers: num(sp.followers),
    page, limit: PAGE_SIZE,
  });
  // "Shop Analytics" and tracking only exist for stores we actually index.
  const shopIds = [...new Set(res.items.map(p => p.storeId).filter(Boolean).map(id => `shp_${id}`))];
  const [shops, tracked] = await Promise.all([
    getShops(shopIds).catch(() => []),
    trackedShopIds(ctx.workspaceId, shopIds).catch(() => new Set<string>()),
  ]);
  const shopById = new Map(shops.map(s => [s.id, s]));

  return (
    <PageShell
      title="Advertisers"
      actions={<SearchBox placeholder="Search advertisers…" label="Search advertisers" />}
      titleAdornment={res.total != null ? <span className="pill tabular-nums">{res.total.toLocaleString()}</span> : undefined}
    >
      <AdvertisersToolbar selects={SELECTS} sorts={SORTS} />

      <div className="space-y-3">
        {res.items.map(p => {
          const shop = p.storeId ? shopById.get(`shp_${p.storeId}`) : undefined;
          const libraryUrl = `https://www.facebook.com/ads/library/?view_all_page_id=${encodeURIComponent(p.pageId)}&active_status=all&ad_type=all`;
          return (
            <article key={p.pageId} className="card overflow-hidden">
              <div className="grid gap-5 p-5 xl:grid-cols-[minmax(220px,1.2fr)_auto_auto_auto_minmax(300px,1.6fr)_auto] xl:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandLogo logo={p.picture} domain={p.storeUrl} name={p.name} size={44} />
                  <div className="min-w-0">
                    <a href={libraryUrl} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-foreground hover:underline" title={`${p.name} in the Meta Ad Library`}>{p.name}</a>
                    {p.firstAdAt && (
                      <div className="mt-0.5 text-xs text-muted-foreground" title="Earliest ad start we hold for this page">
                        First ad {dateFmt.format(new Date(p.firstAdAt))}
                        {ageOf(p.firstAdAt) && <span className="block opacity-80">({ageOf(p.firstAdAt) === 'new' ? 'this month' : ageOf(p.firstAdAt)})</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1.5">
                  {p.liveAds > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300" title="Live ads">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />{p.liveAds.toLocaleString()}
                    </span>
                  )}
                  {p.countries.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-base" aria-label="Targeted countries">
                      {p.countries.slice(0, 4).map(c => <span key={c.code} title={`${regionName.of(c.code) ?? c.code} · ${c.pct}% of ads`}>{flag(c.code)}</span>)}
                      {p.countries.length > 4 && <span className="ml-1 rounded bg-foreground px-1 text-[10px] font-semibold text-background">+{p.countries.length - 4}</span>}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 xl:border-r xl:border-border xl:pr-5">
                  {p.launchSeries.some(d => d.v > 0) && (
                    <ChartDetail title={p.name} subtitle="New ads launched per day" data={p.launchSeries} valueLabel="Ads launched"
                      headline={p.launched14d} caption="Last 14 days" countries={p.countries} countriesLabel="Targeted countries"
                      shop={shop ? { id: shop.id, domain: shop.domain } : undefined}>
                      <Sparkline data={p.launchSeries} w={96} h={34} />
                    </ChartDetail>
                  )}
                  <div className="text-center leading-tight">
                    <div className="text-xs text-muted-foreground">Last 14 days</div>
                    <div className="font-semibold tabular-nums text-foreground">{p.launched14d.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Ads launched</div>
                  </div>
                </div>

                <div className="text-center leading-tight">
                  {p.likes != null && (
                    <>
                      <div className="text-xs text-muted-foreground">Facebook</div>
                      <div className="font-semibold tabular-nums text-sky-600 dark:text-sky-400">{compact(p.likes)}</div>
                      <div className="text-xs text-muted-foreground">followers</div>
                    </>
                  )}
                </div>

                <div className="flex min-w-0 gap-5">
                  {p.lastAds.length > 0 && (
                    <div className="shrink-0">
                      <div className="mb-1.5 text-xs text-muted-foreground">Last Ads</div>
                      <div className="flex gap-2">
                        {p.lastAds.map(ad => (
                          <Link key={ad.id} href={`/ads/${ad.id}`} className="block h-12 w-12 overflow-hidden rounded-md border border-border">
                            <ProductImage src={ad.image} alt={ad.title || p.name} className="h-full w-full object-cover" />
                          </Link>
                        ))}
                      </div>
                      {p.storeUrl && (
                        <Link href={`/ads?store=${encodeURIComponent(p.storeUrl)}`} className="btn-ghost mt-1.5 h-7 px-2.5 text-xs">
                          <Eye className="h-3.5 w-3.5" aria-hidden /> See All Ads
                        </Link>
                      )}
                    </div>
                  )}
                  {p.landingPages.length > 0 && (
                    <div className="min-w-0">
                      <div className="mb-1.5 text-xs text-muted-foreground">Main Landing Pages</div>
                      <div className="space-y-1">
                        {p.landingPages.map(url => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={url} className="block max-w-60 truncate text-xs text-foreground hover:underline">{host(url)}</a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {shop && (
                  <div className="flex flex-col items-stretch gap-2">
                    <Link href={`/shops/${shop.id}`} className="btn-primary text-sm">Shop Analytics</Link>
                    <TrackButton shop={{ id: shop.id, domain: shop.domain, name: shop.name }} initial={tracked.has(shop.id)} />
                  </div>
                )}
              </div>
              <EuUkRow page={p} />
            </article>
          );
        })}

        {res.items.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted-foreground">No advertisers match these filters.</div>
        )}
      </div>

      <MarketPagination page={res.page} total={res.total} limit={res.limit} hasMore={res.items.length === res.limit} />
    </PageShell>
  );
}
