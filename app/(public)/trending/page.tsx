import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';
import { ShareButton } from '@/components/market/ShareButton';
import { nichePathsById } from '@/lib/seo/directory';
import { signupFor, storePath } from '@/lib/public/site';
import { NichesSection, ProductsSection, RisersSection, Skeleton, type TrendLinks } from '@/app/(app)/trends/sections';

// Public, shareable twin of the signed-in /trends screen: the same measured
// sections (SimilarWeb month over month), linked to public pages — stores to
// /store/{domain}, niches to /stores/niche/{slug} — and the filters behind a free
// signup. Anonymous and identical per visitor, so the Cloudflare rule caches it.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Trending Shopify niches, stores and products this month',
  description: 'The Shopify niches and stores whose traffic is breaking out this month, measured by SimilarWeb — plus the products those stores sell. Free, updated monthly.',
  alternates: { canonical: '/trending' },
};

export default async function TrendingPage() {
  const niches = await nichePathsById().catch(() => new Map<string, string>());
  const links: TrendLinks = {
    shop: s => storePath(s.domain),
    niche: n => niches.get(n.id) ?? null,
    band: null,
    seeAll: b => signupFor(`/shops?traffic=${b}&sort=growth`),
  };
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Trending on Shopify</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Where traffic is breaking out this month</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Niches, stores and products ranked by measured month-over-month visits (SimilarWeb). Every store opens without an account.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareButton path="/trending" title="Trending Shopify niches and stores this month" label
            text="The Shopify niches and stores breaking out this month — measured by SimilarWeb, via AdLibrarySpy" />
          <Link href="/signup?ref=trending" className="btn-primary inline-flex h-9 items-center gap-1.5">Explore every store free<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
      </header>
      <Suspense fallback={<Skeleton h="h-[420px]" />}><NichesSection links={links} /></Suspense>
      <Suspense fallback={<Skeleton h="h-[560px]" />}><RisersSection band="100k" links={links} /></Suspense>
      <Suspense fallback={<Skeleton h="h-[520px]" />}><ProductsSection links={links} /></Suspense>
    </div>
  );
}
