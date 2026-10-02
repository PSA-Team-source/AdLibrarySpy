import { Suspense } from 'react';
import { PageShell } from '@/components/layouts/page-shell';
import { nicheHref, parseBand } from '@/lib/trends';
import { NichesSection, RisersSection, Skeleton, type TrendLinks } from './sections';
import { AdNichesSection, AdPulse, HotProductsSection, NewBrandsSection, ScalingSection, VideoStylesSection, loadAds } from './ad-sections';

export const metadata = { title: 'Trends' };
export const dynamic = 'force-dynamic';

// Two halves. First the daily signal — what advertisers launched on Meta this
// week vs last (ad-sections.tsx: the week, video styles, hot products, stores scaling, brand
// new advertisers, niches moving). Then the monthly one — SimilarWeb traffic
// breakouts (sections.tsx, shared with the public /trending page).
const links: TrendLinks = {
  shop: s => `/shops/${s.id}`,
  niche: n => nicheHref(n),
  band: (b, noAds) => {
    const p = new URLSearchParams();
    if (b !== '100k') p.set('band', b);
    if (noAds) p.set('ads', 'none');
    return p.size ? `/trends?${p}` : '/trends';
  },
  seeAll: b => `/shops?traffic=${b}&sort=growth`,
  ads: d => `/ads?store=${encodeURIComponent(d)}`,
};

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ band?: string; ads?: string }> }) {
  const sp = await searchParams;
  const band = parseBand(sp.band);
  const noAds = sp.ads === 'none';
  return (
    <PageShell title="Trends" description="What advertisers launched on Meta this week, the video styles they are using, which products and stores they are pushing, and where traffic is breaking out this month.">
      <Suspense fallback={<Skeleton h="h-[360px]" />}>
        <AdWeek />
      </Suspense>
      <Suspense fallback={<Skeleton h="h-[420px]" />}>
        <VideoStylesSection />
      </Suspense>
      <Suspense fallback={<Skeleton h="h-[520px]" />}>
        <HotProductsSection />
      </Suspense>
      <Suspense fallback={<Skeleton h="h-[560px]" />}>
        <AdStores />
      </Suspense>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Traffic this month</h2>
      <Suspense fallback={<Skeleton h="h-[420px]" />}>
        <NichesSection links={links} />
      </Suspense>
      <Suspense key={`${band}:${noAds}`} fallback={<Skeleton h="h-[560px]" />}>
        <RisersSection band={band} noAds={noAds} links={links} />
      </Suspense>
    </PageShell>
  );
}

async function AdWeek() {
  const d = await loadAds();
  return d && <><AdPulse d={d} /><AdNichesSection d={d} /></>;
}

async function AdStores() {
  const d = await loadAds();
  return d && <><ScalingSection d={d} /><NewBrandsSection d={d} /></>;
}
