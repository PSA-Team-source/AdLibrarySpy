import { Suspense } from 'react';
import { PageShell } from '@/components/layouts/page-shell';
import { nicheHref, parseBand } from '@/lib/trends';
import { NichesSection, ProductsSection, RisersSection, Skeleton, type TrendLinks } from './sections';

export const metadata = { title: 'Trends' };
export const dynamic = 'force-dynamic';

// Three sections, broadest first: niches heating up, a growth leaderboard with
// a size filter, then the products those stores sell. Every
// figure is SimilarWeb's measured month over month; see lib/trends.ts for what
// counts as a breakout and why ad-count growth is not used. The public
// /trending page renders the same sections with public links.
const links: TrendLinks = {
  shop: s => `/shops/${s.id}`,
  niche: n => nicheHref(n),
  band: b => (b === '100k' ? '/trends' : `/trends?band=${b}`),
  seeAll: b => `/shops?traffic=${b}&sort=growth`,
};

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ band?: string }> }) {
  const band = parseBand((await searchParams).band);
  return (
    <PageShell title="Trends" description="Where Shopify traffic is breaking out this month, measured by SimilarWeb.">
      <Suspense fallback={<Skeleton h="h-[420px]" />}>
        <NichesSection links={links} />
      </Suspense>
      <Suspense key={band} fallback={<Skeleton h="h-[560px]" />}>
        <RisersSection band={band} links={links} />
      </Suspense>
      <Suspense fallback={<Skeleton h="h-[520px]" />}>
        <ProductsSection links={links} />
      </Suspense>
    </PageShell>
  );
}
