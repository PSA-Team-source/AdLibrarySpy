import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAd } from '@/lib/data';
import type { Ad } from '@/lib/types';
import { AdDetail } from '@/components/market/AdDetail';
import { JsonLd, SignupGate } from '@/components/public/PublicCards';
import { SITE_URL, adPath, signupFor, storePath } from '@/lib/public/site';

// Anonymous + identical for every visitor → ISR, served from the Cloudflare edge.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Params = Promise<{ id: string }>;

// Creative ids are index ids (digits / hex / _-); anything else never reaches the API.
const ID = /^[A-Za-z0-9_-]{1,128}$/;

async function load(id: string): Promise<Ad> {
  if (!ID.test(id)) notFound();
  const ad = await getAd(id).catch(() => null);
  if (!ad) notFound();
  return ad;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function heading(ad: Ad): string {
  return ad.headline ? `${ad.advertiser} ad: ${ad.headline}` : `${ad.advertiser} ${ad.mediaType === 'video' ? 'video' : 'image'} ad`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ad = await load((await params).id);
  const title = clip(heading(ad), 90);
  const copy = ad.adCopy.replace(/\s+/g, ' ').trim();
  const description = clip(copy
    ? `${copy} — ${ad.advertiser}'s Meta ad on AdLibrarySpy: creative, copy, run time and placements.`
    : `${ad.advertiser}'s Meta ad on AdLibrarySpy: creative, copy, run time and placements.`, 200);
  const url = `${SITE_URL}${adPath(ad.id)}`;
  return {
    title: { absolute: `${title} | AdLibrarySpy` },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', siteName: 'AdLibrarySpy', url, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PublicAdPage({ params }: { params: Params }) {
  const ad = await load((await params).id);
  const url = `${SITE_URL}${adPath(ad.id)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url, url, name: heading(ad),
        isPartOf: { '@type': 'WebSite', name: 'AdLibrarySpy', url: SITE_URL },
        ...(ad.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: ad.image } } : {}),
        ...(ad.domain ? { about: { '@type': 'Organization', name: ad.advertiser, url: `https://${ad.domain}` } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AdLibrarySpy', item: SITE_URL },
          ...(ad.domain ? [{ '@type': 'ListItem', position: 2, name: ad.advertiser, item: `${SITE_URL}${storePath(ad.domain)}` }] : []),
          { '@type': 'ListItem', position: ad.domain ? 3 : 2, name: 'Ad', item: url },
        ],
      },
    ],
  };

  return (
    <div className="space-y-5">
      <JsonLd data={jsonLd} />
      <div>
        {ad.domain && (
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href={storePath(ad.domain)} className="hover:text-foreground">{ad.advertiser}</Link>
            <span aria-hidden> / </span><span className="text-foreground">Ad</span>
          </nav>
        )}
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{heading(ad)}</h1>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <AdDetail ad={ad} drawer={false} publicView />
      </div>
      <SignupGate title="Find ads like this, every day"
        body="Search every indexed Meta ad by niche, format, country and run time, save creatives to boards and track the brands behind them — free, no card."
        href={signupFor(`/ads/${ad.id}`)} cta="Start free" />
    </div>
  );
}
