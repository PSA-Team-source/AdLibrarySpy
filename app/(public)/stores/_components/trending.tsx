import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SEGMENTS } from '@/lib/data';
import { nicheDirectory, measuredMonth, parsePage, safe, TRENDING_MIN_VISITS } from '@/lib/seo/directory';
import { directoryMetadata, loadList, pageSuffix, rangeLabel } from '@/lib/seo/meta';
import { DirectoryPage, fmt, pagePath, type Crumb } from './DirectoryView';

// The two trending lists are the app's own segments (lib/data.ts SEGMENTS), public.
const VIEWS = {
  'fastest-growing': {
    base: '/stores/trending',
    h1: 'Fastest-growing Shopify stores',
    title: 'Fastest-growing Shopify stores this month',
    ref: 'seo:stores/trending',
    describe: (total: number, month: string) =>
      `${fmt(total)} Shopify stores with at least ${fmt(TRENDING_MIN_VISITS)} monthly visits, ranked by month-over-month traffic growth${month ? ` (SimilarWeb, ${month})` : ' (SimilarWeb)'}.`,
    meta: (total: number) => `The fastest-growing Shopify stores by SimilarWeb traffic growth, out of ${fmt(total)} stores with ${fmt(TRENDING_MIN_VISITS)}+ monthly visits. With visits, live Meta ads and product counts. Free.`,
  },
  'ad-peak': {
    base: '/stores/trending/ads',
    h1: 'Shopify stores running the most Meta ads',
    title: 'Shopify stores running the most Meta ads right now',
    ref: 'seo:stores/trending/ads',
    describe: (total: number) =>
      `Shopify stores ranked by the number of Meta ads they are running now, out of ${fmt(total)} stores in the AdLibrarySpy index.`,
    meta: (total: number) => `Which Shopify stores are spending on Meta ads right now: ranked by live ad count out of ${fmt(total)} stores, with SimilarWeb visits and growth. Free.`,
  },
} as const;
export type TrendingView = keyof typeof VIEWS;

export type TrendingProps = { params: Promise<{ page?: string[] }> };

async function resolve(view: TrendingView, props: TrendingProps) {
  const page = parsePage((await props.params).page);
  if (!page) return null;
  const list = await loadList(JSON.stringify({ kind: 'trending', view }), page);
  if (!list.items.length || page > list.pages) return null;
  return { page, list, v: VIEWS[view] };
}

export async function trendingMetadata(view: TrendingView, props: TrendingProps): Promise<Metadata> {
  const r = await resolve(view, props);
  if (!r) return {};
  return directoryMetadata({
    title: `${r.v.title}${pageSuffix(r.page)}`,
    description: r.v.meta(r.list.total),
    path: pagePath(r.v.base, r.page),
    total: r.list.total,
  });
}

export async function TrendingPage({ view, props }: { view: TrendingView; props: TrendingProps }) {
  const r = await resolve(view, props);
  if (!r) notFound();
  const { page, list, v } = r;
  const niches = await safe(nicheDirectory());
  const crumbs: Crumb[] = [
    { name: 'Shopify stores', href: '/stores' },
    { name: SEGMENTS[view].label, href: v.base },
  ];
  const other = view === 'fastest-growing' ? VIEWS['ad-peak'] : VIEWS['fastest-growing'];
  return (
    <DirectoryPage
      crumbs={crumbs}
      h1={`${v.h1}${pageSuffix(page)}`}
      intro={`${v.describe(list.total, measuredMonth(list.items))} Showing ${rangeLabel(page, list.items.length)}.`}
      list={list}
      base={v.base}
      refTag={v.ref}
      jsonLdName={v.h1}
      related={[
        { title: 'More trending lists', links: [{ href: other.base, label: other.h1 }] },
        { title: 'Top niches', links: niches.filter(n => !n.parent).slice(0, 16)
            .map(n => ({ href: `/stores/niche/${n.slug}`, label: n.name, count: n.shops })) },
      ]}
    />
  );
}
