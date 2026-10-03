import Link from 'next/link';
import { Suspense } from 'react';
import { PageShell } from '@/components/layouts/page-shell';
import { nicheHref, parseBand } from '@/lib/trends';
import { NichesSection, RisersSection, Skeleton, type TrendLinks } from './sections';
import { AdNichesSection, AdPulse, HotProductsSection, NewBrandsSection, ScalingSection, VideoStylesSection, WEEKS_BACK, loadAds, parseWeeksBack, weekEnd } from './ad-sections';
import { adWeeks, weekLabel } from '@/lib/trends';

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
    // ponytail: the traffic band switch resets the ad week (links has no week); fine, both are one click.
    if (b !== '100k') p.set('band', b);
    if (noAds) p.set('ads', 'none');
    return p.size ? `/trends?${p}` : '/trends';
  },
  seeAll: b => `/shops?traffic=${b}&sort=growth`,
  ads: d => `/ads?store=${encodeURIComponent(d)}`,
};

const jump = [
  ['week', 'The week'], ['styles', 'Video styles'], ['products', 'Products'],
  ['stores', 'Stores'], ['traffic', 'Traffic'],
] as const;

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ band?: string; ads?: string; week?: string }> }) {
  const sp = await searchParams;
  const band = parseBand(sp.band);
  const noAds = sp.ads === 'none';
  const back = parseWeeksBack(sp.week);
  const chip = 'rounded-full border px-3 py-1 text-xs whitespace-nowrap';
  return (
    <PageShell title="Trends" description="What advertisers launched on Meta this week, the video styles they are using, which products and stores they are pushing, and where traffic is breaking out this month.">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label="Trends">
        <span className="flex flex-wrap gap-1.5" role="group" aria-label="Week">
          {Array.from({ length: WEEKS_BACK }, (_, i) => {
            const w = adWeeks(weekEnd(i));
            return (
              <Link key={i} href={i ? `/trends?week=${i}` : '/trends'} aria-current={i === back ? 'page' : undefined}
                className={`${chip} ${i === back ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {i ? weekLabel(w.from, w.to) : 'Latest week'}
              </Link>
            );
          })}
        </span>
        <span className="flex flex-wrap gap-3 text-muted-foreground max-sm:hidden">
          {jump.map(([id, label]) => <a key={id} href={`#${id}`} className="hover:text-foreground">{label}</a>)}
        </span>
      </nav>
      <div id="week" className="scroll-mt-20" />
      <Suspense key={`w${back}`} fallback={<Skeleton h="h-[360px]" />}>
        <AdWeek back={back} />
      </Suspense>
      <div id="styles" className="scroll-mt-20" />
      <Suspense key={`s${back}`} fallback={<Skeleton h="h-[420px]" />}>
        <VideoStylesSection back={back} />
      </Suspense>
      <div id="products" className="scroll-mt-20" />
      {/* Products count the last 14 days (the products index), so only next to the latest week. */}
      {!back && (
        <Suspense fallback={<Skeleton h="h-[520px]" />}>
          <HotProductsSection />
        </Suspense>
      )}
      <div id="stores" className="scroll-mt-20" />
      <Suspense key={`t${back}`} fallback={<Skeleton h="h-[560px]" />}>
        <AdStores back={back} />
      </Suspense>
      <h2 id="traffic" className="mt-4 scroll-mt-20 text-lg font-semibold text-foreground">Traffic this month</h2>
      <Suspense fallback={<Skeleton h="h-[420px]" />}>
        <NichesSection links={links} />
      </Suspense>
      <Suspense key={`${band}:${noAds}`} fallback={<Skeleton h="h-[560px]" />}>
        <RisersSection band={band} noAds={noAds} links={links} />
      </Suspense>
    </PageShell>
  );
}

async function AdWeek({ back }: { back: number }) {
  const d = await loadAds(back);
  return d && <><AdPulse d={d} back={back} /><AdNichesSection d={d} /></>;
}

async function AdStores({ back }: { back: number }) {
  const d = await loadAds(back);
  return d && <><ScalingSection d={d} /><NewBrandsSection d={d} /></>;
}
