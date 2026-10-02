import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Calendar, Coins, Globe, Languages, LayoutGrid, Palette, Store, Users } from 'lucide-react';
import { getShop, similarShops, storeAdBundle, isTracked, favoriteIds } from '@/lib/data';
import { creativeCountFor } from '@/lib/market/creatives';
import { categoryTree } from '@/lib/market/shops';
import { storefrontFacts, storeAdHistory, storeProfile, type StorefrontFacts } from '@/lib/market/storefront';
import { compact, pct, ageOf, monthYear, flag, dateShort } from '@/lib/format';
import type { CountryShare, Shop } from '@/lib/types';
import TrackButton from '@/components/TrackButton';
import FavButton from '@/components/FavButton';
import { ShopLogo, ProductImage } from '@/components/ShopMedia';
import { PlatformIcon } from '@/components/market/PlatformIcon';
import { CreativeCard } from '@/components/market/CreativeCard';
import { requireCtx } from '@/lib/auth/guard';
import { growthTitle, trafficCaption, trafficTitle } from '@/lib/traffic/similarweb';
import { PageShell } from '@/components/layouts/page-shell';
import TrendChart from '@/components/market/TrendChart';
import ProductsPanel from './products-panel';
import { ShareButton } from '@/components/market/ShareButton';
import { storePath } from '@/lib/public/site';

export const dynamic = 'force-dynamic';

const CARD = 'rounded-xl border border-border bg-card p-5';
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
const languageName = (code: string) => { try { return languageNames.of(code) ?? ''; } catch { return ''; } };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const shop = await getShop((await params).id).catch(() => null);
  return { title: shop ? shop.name : 'Shop' };
}

/** Flag + share row, as the chart footers render visitor and targeted countries. */
function CountryFooter({ label, data }: { label: string; data: CountryShare[] }) {
  if (!data.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-3 tabular-nums text-foreground">
        {data.slice(0, 5).map(c => <span key={c.code} title={c.code}><span aria-hidden>{flag(c.code)}</span> {c.pct}%</span>)}
      </span>
    </div>
  );
}

function SimilarCard({ shop }: { shop: Shop }) {
  const screenshot = shop.screenshot;
  const thumbs = shop.bestSellers.filter(p => p.image).slice(0, 4);
  return (
    <Link href={`/shops/${shop.id}`} className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground" title={shop.fullTitle}>{shop.name}</span>
        {shop.country && <span aria-label={shop.country}>{flag(shop.country)}</span>}
        {shop.metaAds > 0 && <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />{compact(shop.metaAds)}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {shop.createdOn && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"><Calendar className="h-3 w-3" />{monthYear(shop.createdOn)}</span>}
        {shop.productCount > 0 && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"><LayoutGrid className="h-3 w-3" />{compact(shop.productCount)}</span>}
        {shop.monthlyVisits > 0 && <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5" title={trafficTitle(shop.monthlyVisits, shop.trafficSource, shop.similarweb?.period ?? '', shop.domain)}><Users className="h-3 w-3" />{compact(shop.monthlyVisits)}</span>}
      </div>
      {screenshot && <ProductImage src={screenshot} alt={`${shop.name} homepage`} className="mt-3 aspect-[4/3] w-full rounded-lg border border-border object-cover object-top" />}
      {thumbs.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 empty:hidden">
          {thumbs.map(p => <ProductImage key={`${p.rank}-${p.title}`} src={p.image!} alt={p.title} className="aspect-square w-full rounded-md border border-border object-cover" />)}
        </div>
      )}
    </Link>
  );
}

/** Storefront-only facts for the header strip; absent until the live read lands. */
async function StorefrontChips({ factsP }: { factsP: Promise<StorefrontFacts | null> }) {
  const facts = await factsP;
  if (!facts) return null;
  const language = facts.locale ? languageName(facts.locale) : '';
  return (
    <>
      {facts.myshopifyDomain && <span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5" />{facts.myshopifyDomain}</span>}
      {language && <span className="inline-flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" />{language}</span>}
      {facts.currency && <span className="inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" />{facts.currency}</span>}
      {facts.theme && <span className="inline-flex items-center gap-1.5" title="Shopify theme"><Palette className="h-3.5 w-3.5" />{facts.theme}</span>}
    </>
  );
}

/** Products panel on the storefront's own order; the index's best sellers until then. */
async function StorefrontProducts({ factsP, shop }: { factsP: Promise<StorefrontFacts | null>; shop: Shop }) {
  const facts = await factsP;
  const fallback = facts?.currency ? shop.bestSellers.map(p => ({ ...p, currency: facts.currency })) : shop.bestSellers;
  const count = facts?.productCount ?? (shop.productCount > 0 ? shop.productCount : null);
  return <ProductsPanel count={count} bestSelling={facts?.bestSelling ?? []} latest={facts?.latest ?? []} fallback={fallback}
    catalog={facts?.catalog ?? []} domain={shop.domain} />;
}

export default async function ShopDossier({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ track?: string }>;
}) {
  const { id } = await params;
  const trackHint = (await searchParams).track === '1';
  const ctx = await requireCtx();
  const shop = await getShop(id);
  if (!shop) notFound();

  const topCategoryId = (await categoryTree().catch(() => [])).find(n => n.name === shop.niches[0])?.id ?? '';

  // The live storefront read (meta.json, catalogue, collection pages) can take
  // seconds on a cold store and is capped at 6s a round; it streams into the
  // header strip and the Products panel instead of holding the whole page.
  const factsP: Promise<StorefrontFacts | null> = shop.platform === 'shopify'
    ? storefrontFacts(shop.domain).catch(() => null)
    : Promise.resolve(null);

  const [similar, adBundle, tracked, savedShops, savedAds, adHistory, profile, creativeTotal] = await Promise.all([
    similarShops(shop, 10).catch(() => []),
    storeAdBundle(shop.domain, 12).catch(() => ({ ads: [], countries: [] })),
    isTracked(ctx.workspaceId, shop.id),
    favoriteIds(ctx.workspaceId, ctx.user.id, 'shop'),
    favoriteIds(ctx.workspaceId, ctx.user.id, 'ad'),
    storeAdHistory(shop.storeId),
    storeProfile(shop.storeId),
    creativeCountFor(shop.domain),
  ]);
  const { ads, countries: adCountries } = adBundle;

  const measured = shop.trafficSource === 'similarweb';
  const growth = measured ? shop.similarweb?.growthPct ?? null : shop.visitsGrowth || null;
  const swHistory = shop.similarwebDetail?.history ?? [];
  const trafficHistory = swHistory.length >= 2 ? swHistory : (!measured && shop.trafficSeries.length >= 2 ? shop.trafficSeries : []);
  const trafficSource = trafficCaption(shop.trafficSource, shop.similarweb?.period ?? '');
  const categoryPath = profile?.categoryPath.length ? profile.categoryPath : shop.niches;
  const pixels = profile?.pixels ?? shop.pixels;
  const apps = profile?.apps ?? shop.apps;
  const liveAdsChart = adHistory.length >= 2;
  const liveAdsTile = !liveAdsChart && (shop.metaAds > 0 || adCountries.length > 0);
  const adCount = creativeTotal ?? ads.length;
  const age = ageOf(shop.createdOn);

  return (
    <PageShell
      variant="detail"
      backUrl="/shops"
      title={shop.name}
      titleAdornment={<span className="flex items-center gap-2"><ShopLogo src={shop.logo} name={shop.name} size={32} />{shop.platform === 'shopify' && <span title="Shopify store"><PlatformIcon platform="shopify" className="h-5 w-5" /></span>}</span>}
      actions={<>
        <FavButton type="shop" id={shop.id} initial={savedShops.includes(shop.id)} label />
        {/* Shares the public /store page (openable without an account), tagged ?ref=share. */}
        <ShareButton path={storePath(shop.domain)} title={`${shop.name} on AdLibrarySpy`} />
        <TrackButton shop={{ id: shop.id, domain: shop.domain, name: shop.name }} initial={tracked} highlight={trackHint} />
      </>}
    >
      <div className="-mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-muted/70 px-4 py-2.5 text-sm text-muted-foreground">
        <a href={`https://${shop.domain}`} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"><Globe className="h-3.5 w-3.5" />{shop.domain}<ArrowUpRight className="h-3.5 w-3.5" /></a>
        {shop.createdOn && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{monthYear(shop.createdOn)}{age && (age === 'new' ? ' (new)' : ` (${age} ago)`)}</span>}
        {shop.country && <span className="inline-flex items-center gap-1.5">{shop.country} <span aria-hidden>{flag(shop.country)}</span></span>}
        {categoryPath.length > 0 && <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />{categoryPath.join(' › ')}</span>}
        <Suspense fallback={null}><StorefrontChips factsP={factsP} /></Suspense>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Shop detail sections">
        <a href="#analytics" className="border-b-2 border-foreground px-4 py-3 text-sm font-semibold text-foreground">Shop Analytics</a>
        {similar.length > 0 && <a href="#similar" className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground">Similar Shops</a>}
        {ads.length > 0 && <a href="#meta-ads" className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground">Ads in our library <span className="ml-1 tabular-nums text-muted-foreground">{adCount.toLocaleString()}</span></a>}
      </nav>

      <section id="analytics" className="scroll-mt-4 space-y-4">
        {(shop.monthlyVisits > 0 || liveAdsTile) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {shop.monthlyVisits > 0 && (
              <div className={CARD} title={trafficTitle(shop.monthlyVisits, shop.trafficSource, shop.similarweb?.period ?? '', shop.domain)}>
                <div className="text-sm font-semibold text-foreground">Monthly Visits</div>
                <div className="mt-3 flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-semibold tabular-nums">{compact(shop.monthlyVisits)}</span>
                  {growth != null && Math.round(growth) !== 0 && <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${growth > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`} title={growthTitle(growth, shop.trafficSource, shop.similarweb?.period ?? '', shop.domain)}>{pct(Math.round(growth))}</span>}
                </div>
                {trafficSource && <div className="mt-1 text-[11px] text-muted-foreground">{trafficSource}</div>}
              </div>
            )}
            {liveAdsTile && (
              <div className={CARD}>
                <div className="text-sm font-semibold text-foreground">Live ads on Meta</div>
                {shop.metaAds > 0 && <div className="mt-3 text-2xl font-semibold tabular-nums">{shop.metaAds.toLocaleString()} <span className="text-base text-emerald-600">●</span></div>}
                <CountryFooter label="Targeted Countries" data={adCountries} />
              </div>
            )}
          </div>
        )}

        {(trafficHistory.length >= 2 || liveAdsChart) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {trafficHistory.length >= 2 && (
              <div className={`${CARD} ${liveAdsChart ? '' : 'lg:col-span-2'}`}>
                <div className="mb-4 text-sm font-semibold text-foreground">Traffic Over Time</div>
                <TrendChart data={trafficHistory} valueLabel="Visitors" />
                <CountryFooter label="Visitor Countries" data={shop.visitorCountries} />
              </div>
            )}
            {liveAdsChart && (
              <div className={`${CARD} ${trafficHistory.length >= 2 ? '' : 'lg:col-span-2'}`}>
                <div className="text-sm font-semibold text-foreground">Live Ads Over Time</div>
                {/* The headline IS the chart's latest point, dated, so the two can never disagree. */}
                <div className="mb-4 mt-2 text-2xl font-semibold tabular-nums">{adHistory[adHistory.length - 1].v.toLocaleString()} <span className="text-base text-emerald-600">●</span> <span className="text-xs font-normal text-muted-foreground">on {dateShort(adHistory[adHistory.length - 1].t)}</span></div>
                <TrendChart data={adHistory} valueLabel="Live ads" />
                <CountryFooter label="Targeted Countries" data={adCountries} />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={pixels.length || apps.length ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <Suspense fallback={<ProductsPanel count={shop.productCount > 0 ? shop.productCount : null} bestSelling={[]} latest={[]} fallback={shop.bestSellers} />}>
              <StorefrontProducts factsP={factsP} shop={shop} />
            </Suspense>
          </div>
          {(pixels.length > 0 || apps.length > 0) && (
            <div className={CARD}>
              {pixels.length > 0 && (
                <div>
                  <div className="mb-3 text-sm font-semibold text-foreground">Pixels <span className="ml-1 text-muted-foreground">{pixels.length}</span></div>
                  <div className="grid grid-cols-2 gap-2">{pixels.map(p => <span key={p} className="truncate rounded-lg border border-border px-3 py-2 text-xs text-foreground" title={p}>{p}</span>)}</div>
                </div>
              )}
              {apps.length > 0 && (
                <div className={pixels.length ? 'mt-5 border-t border-border pt-5' : ''}>
                  <div className="mb-3 text-sm font-semibold text-foreground">Apps &amp; Integrations <span className="ml-1 text-muted-foreground">{apps.length}</span></div>
                  <div className="flex flex-wrap gap-2">{apps.map(a => <span key={a} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">{a}</span>)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {similar.length > 0 && (
        <section id="similar" className="scroll-mt-4 rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Similar Shops</h2>
            {topCategoryId && <Link href={`/shops?category=${topCategoryId}${shop.country ? `&country=${shop.country}` : ''}`} className="btn-ghost h-8 px-3 text-sm">See More <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>}
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {similar.map(other => <SimilarCard key={other.id} shop={other} />)}
          </div>
        </section>
      )}

      {ads.length > 0 && (
        <section id="meta-ads" className="scroll-mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground" title="Meta ads from this store that AdLibrarySpy has saved, live or ended. Live ads on Meta are counted above.">Ads in our library <span className="ml-1 tabular-nums text-muted-foreground">{adCount.toLocaleString()}</span></h2>
            <Link href={`/ads?store=${encodeURIComponent(shop.domain)}`} className="btn-ghost h-8 px-3 text-sm">See All Ads <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ads.slice(0, 8).map(ad => <CreativeCard key={ad.id} ad={ad} saved={savedAds.includes(ad.id)} />)}
          </div>
        </section>
      )}
    </PageShell>
  );
}
