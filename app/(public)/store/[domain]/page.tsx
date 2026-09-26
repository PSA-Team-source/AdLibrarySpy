import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Calendar, Coins, Globe, Languages, LayoutGrid, Palette, Store, Users } from 'lucide-react';
import { getShop, similarShops, storeAdBundle } from '@/lib/data';
import { creativeCountFor } from '@/lib/market/creatives';
import { storefrontFacts, storeAdHistory, storeProfile, type StorefrontFacts } from '@/lib/market/storefront';
import { ageOf, compact, flag, monthYear, pct } from '@/lib/format';
import type { Shop } from '@/lib/types';
import { growthTitle, trafficCaption, trafficTitle } from '@/lib/traffic/similarweb';
import { ShopLogo } from '@/components/ShopMedia';
import { PlatformIcon } from '@/components/market/PlatformIcon';
import { ShareButton } from '@/components/market/ShareButton';
import { countryName } from '@/components/market/CreativeCard';
import { CountryShares, JsonLd, PublicCreativeTile, PublicShopCard, SignupGate } from '@/components/public/PublicCards';
import { SITE_URL, measuredVisits, publicDomain, signupFor, storePath } from '@/lib/public/site';
import TrendChart from '@/app/(app)/shops/[id]/trend-chart';
import ProductsPanel from '@/app/(app)/shops/[id]/products-panel';

// Anonymous + identical for every visitor → ISR, served from the Cloudflare edge.
// Never read cookies()/headers()/searchParams here: that would make it per-request.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }   // render on first request, then cache

const CARD = 'rounded-xl border border-border bg-card p-5';
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
const languageName = (code: string) => { try { return languageNames.of(code) ?? ''; } catch { return ''; } };

type Params = Promise<{ domain: string }>;

/** Resolve the URL segment to a shop, sending every alias to the one canonical URL. */
async function load(raw: string): Promise<Shop> {
  const domain = publicDomain(raw);
  if (!domain) notFound();
  if (domain !== raw) permanentRedirect(storePath(domain));
  const shop = await getShop(domain).catch(() => null);
  if (!shop || !shop.domain) notFound();
  if (shop.domain !== domain) permanentRedirect(storePath(shop.domain));
  return shop;
}

/** One sentence of real figures; each clause exists only when its number does. */
function summary(shop: Shop, categoryPath: string[]): string {
  const visits = measuredVisits(shop);
  const facts = [
    visits > 0 && `${compact(visits)} monthly visits (SimilarWeb)`,
    shop.metaAds > 0 && `${shop.metaAds.toLocaleString('en-US')} live Meta ads`,
    categoryPath.length > 0 && `niche: ${categoryPath[categoryPath.length - 1]}`,
    shop.country && `based in ${countryName(shop.country)}`,
  ].filter(Boolean);
  const lead = facts.length ? `${shop.domain}: ${facts.join(', ')}.` : `${shop.domain} store profile.`;
  return `${lead} See its ads, top products, apps and similar stores — free on AdLibrarySpy.`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const shop = await load((await params).domain);
  const profile = await storeProfile(shop.storeId);
  const categoryPath = profile?.categoryPath.length ? profile.categoryPath : shop.niches;
  const title = `${shop.name} (${shop.domain}) — traffic, Meta ads & top products`;
  const description = summary(shop, categoryPath);
  const url = `${SITE_URL}${storePath(shop.domain)}`;
  return {
    title: { absolute: `${title} | AdLibrarySpy` },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'AdLibrarySpy', url, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

async function StorefrontChips({ factsP }: { factsP: Promise<StorefrontFacts | null> }) {
  const facts = await factsP;
  if (!facts) return null;
  const language = facts.locale ? languageName(facts.locale) : '';
  return (
    <>
      {facts.myshopifyDomain && <span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5" aria-hidden />{facts.myshopifyDomain}</span>}
      {language && <span className="inline-flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" aria-hidden />{language}</span>}
      {facts.currency && <span className="inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" aria-hidden />{facts.currency}</span>}
      {facts.theme && <span className="inline-flex items-center gap-1.5" title="Shopify theme"><Palette className="h-3.5 w-3.5" aria-hidden />{facts.theme}</span>}
    </>
  );
}

async function StorefrontProducts({ factsP, shop }: { factsP: Promise<StorefrontFacts | null>; shop: Shop }) {
  const facts = await factsP;
  const fallback = facts?.currency ? shop.bestSellers.map(p => ({ ...p, currency: facts.currency })) : shop.bestSellers;
  const count = facts?.productCount ?? (shop.productCount > 0 ? shop.productCount : null);
  return <ProductsPanel count={count} bestSelling={facts?.bestSelling ?? []} latest={facts?.latest ?? []} fallback={fallback} />;
}

export default async function PublicStorePage({ params }: { params: Params }) {
  const shop = await load((await params).domain);
  const factsP: Promise<StorefrontFacts | null> = shop.platform === 'shopify'
    ? storefrontFacts(shop.domain).catch(() => null)
    : Promise.resolve(null);

  const [similar, adBundle, adHistory, profile, creativeTotal] = await Promise.all([
    similarShops(shop, 6).catch(() => []),
    storeAdBundle(shop.domain, 8).catch(() => ({ ads: [], countries: [] })),
    storeAdHistory(shop.storeId),
    storeProfile(shop.storeId),
    creativeCountFor(shop.domain),
  ]);
  const { ads, countries: adCountries } = adBundle;

  // Public surfaces show SimilarWeb's measurement of this exact host or nothing:
  // the index estimate is often the parent domain's traffic, wrong on a shared card.
  const visits = measuredVisits(shop);
  const period = shop.similarweb?.period ?? '';
  const growth = visits ? shop.similarweb?.growthPct ?? null : null;
  const swHistory = visits ? shop.similarwebDetail?.history ?? [] : [];
  const categoryPath = profile?.categoryPath.length ? profile.categoryPath : shop.niches;
  const pixels = profile?.pixels ?? shop.pixels;
  const apps = profile?.apps ?? shop.apps;
  const adCount = creativeTotal ?? ads.length;
  const age = ageOf(shop.createdOn);
  const dossier = `/shops/${shop.id}`;
  const url = `${SITE_URL}${storePath(shop.domain)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url, url, name: `${shop.name} (${shop.domain})`, description: summary(shop, categoryPath),
        isPartOf: { '@type': 'WebSite', name: 'AdLibrarySpy', url: SITE_URL },
        about: {
          '@type': 'Organization', name: shop.name, url: `https://${shop.domain}`,
          ...(shop.logo ? { logo: shop.logo } : {}),
          ...(shop.createdOn ? { foundingDate: shop.createdOn.slice(0, 10) } : {}),
          ...(shop.country ? { address: { '@type': 'PostalAddress', addressCountry: shop.country } } : {}),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AdLibrarySpy', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shops directory', item: `${SITE_URL}/stores` },
          { '@type': 'ListItem', position: 3, name: shop.name, item: url },
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/stores" className="hover:text-foreground">Shops directory</Link>
        <span aria-hidden> / </span><span className="text-foreground">{shop.domain}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <ShopLogo src={shop.logo} name={shop.name} size={48} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <span className="truncate">{shop.name}</span>
              {shop.platform === 'shopify' && <span title="Shopify store"><PlatformIcon platform="shopify" className="h-5 w-5" /></span>}
            </h1>
            <a href={`https://${shop.domain}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
              <Globe className="h-3.5 w-3.5" aria-hidden />{shop.domain}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareButton path={storePath(shop.domain)} title={`${shop.name} on AdLibrarySpy`} label
            text={[
              `${shop.name} (${shop.domain})`,
              [visits > 0 && `${compact(visits)} visits/mo`, shop.metaAds > 0 && `${shop.metaAds.toLocaleString('en-US')} live Meta ads`].filter(Boolean).join(', '),
            ].filter(Boolean).join(': ') + ' — via AdLibrarySpy'} />
          <Link href={signupFor(dossier)} className="btn-primary inline-flex h-9 items-center gap-1.5">Track this shop free<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-muted/70 px-4 py-2.5 text-sm text-muted-foreground">
        {shop.createdOn && <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden />Created {monthYear(shop.createdOn)}{age && (age === 'new' ? ' (new)' : ` (${age} ago)`)}</span>}
        {shop.country && <span className="inline-flex items-center gap-1.5">{countryName(shop.country)} <span aria-hidden>{flag(shop.country)}</span></span>}
        {categoryPath.length > 0 && <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" aria-hidden />{categoryPath.join(' › ')}</span>}
        <Suspense fallback={null}><StorefrontChips factsP={factsP} /></Suspense>
      </div>

      {(visits > 0 || shop.metaAds > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {visits > 0 && (
            <div className={CARD} title={trafficTitle(visits, shop.trafficSource, period, shop.domain)}>
              <h2 className="text-sm font-semibold text-foreground">Monthly visits</h2>
              <div className="mt-3 flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
                <span className="text-2xl font-semibold tabular-nums">{compact(visits)}</span>
                {growth != null && Math.round(growth) !== 0 && <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${growth > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`} title={growthTitle(growth, shop.trafficSource, period, shop.domain)}>{pct(Math.round(growth))}</span>}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{trafficCaption(shop.trafficSource, period)}</div>
            </div>
          )}
          {shop.metaAds > 0 && (
            <div className={CARD}>
              <h2 className="text-sm font-semibold text-foreground">Live Meta ads</h2>
              <div className="mt-3 text-2xl font-semibold tabular-nums">{shop.metaAds.toLocaleString('en-US')} <span className="text-base text-emerald-600" aria-hidden>●</span></div>
              <CountryShares label="Targeted countries" data={adCountries} />
            </div>
          )}
        </div>
      )}

      {(swHistory.length >= 2 || adHistory.length >= 2) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {swHistory.length >= 2 && (
            <section className={`${CARD} ${adHistory.length >= 2 ? '' : 'lg:col-span-2'}`}>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Traffic over time</h2>
              <TrendChart data={swHistory} valueLabel="Visitors" />
              <p className="mt-2 text-[11px] text-muted-foreground">Measured by SimilarWeb for {shop.domain}.</p>
              <CountryShares label="Visitor countries" data={shop.visitorCountries} />
            </section>
          )}
          {adHistory.length >= 2 && (
            <section className={`${CARD} ${swHistory.length >= 2 ? '' : 'lg:col-span-2'}`}>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Live ads over time</h2>
              <TrendChart data={adHistory} valueLabel="Live ads" />
            </section>
          )}
        </div>
      )}

      {ads.length > 0 && (
        <section className="space-y-4" aria-labelledby="ads-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ads-heading" className="text-base font-semibold text-foreground">Recent Meta ads{adCount > 0 && <span className="ml-2 tabular-nums text-muted-foreground">{adCount.toLocaleString('en-US')} indexed</span>}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ads.slice(0, 8).map(ad => <PublicCreativeTile key={ad.id} ad={ad} />)}
          </div>
          {adCount > ads.length && (
            <SignupGate title={`See all ${adCount.toLocaleString('en-US')} ads from ${shop.name}`}
              body="Filter by format, country and run time, save creatives to boards, and get the full ad history — free."
              href={signupFor(`/ads?store=${encodeURIComponent(shop.domain)}`)} />
          )}
        </section>
      )}

      {/* Products resolve after the live storefront read and may be absent, so they own
          a full-width row; the tech stack never shares a row with a gap it cannot fill. */}
      <Suspense fallback={<ProductsPanel count={shop.productCount > 0 ? shop.productCount : null} bestSelling={[]} latest={[]} fallback={shop.bestSellers} />}>
        <StorefrontProducts factsP={factsP} shop={shop} />
      </Suspense>

      {(pixels.length > 0 || apps.length > 0) && (
        <section className={`${CARD} grid gap-6 ${pixels.length && apps.length ? 'md:grid-cols-2' : ''}`} aria-label="Tech stack">
          {pixels.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Pixels <span className="ml-1 text-muted-foreground">{pixels.length}</span></h2>
              <div className="flex flex-wrap gap-2">{pixels.map(p => <span key={p} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">{p}</span>)}</div>
            </div>
          )}
          {apps.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Apps &amp; integrations <span className="ml-1 text-muted-foreground">{apps.length}</span></h2>
              <div className="flex flex-wrap gap-2">{apps.map(a => <span key={a} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">{a}</span>)}</div>
            </div>
          )}
        </section>
      )}

      <SignupGate title={`Track ${shop.domain}`}
        body="Get a snapshot feed of its new ads, catalogue changes and traffic, save it to your workspace, and compare it with competitors — free, no card."
        href={signupFor(dossier)} cta="Start tracking free" />

      {similar.length > 0 && (
        <section className="space-y-4" aria-labelledby="similar-heading">
          <div className="flex items-center justify-between">
            <h2 id="similar-heading" className="text-base font-semibold text-foreground">Similar shops</h2>
            <Link href="/stores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">Shops directory<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map(other => <PublicShopCard key={other.id} shop={other} />)}
          </div>
        </section>
      )}
    </div>
  );
}
