import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findNiche, nicheDirectory, techDirectory, measuredMonth, parsePage, safe } from '@/lib/seo/directory';
import { directoryMetadata, loadList, pageSuffix, rangeLabel } from '@/lib/seo/meta';
import { DirectoryPage, fmt, pagePath, type Crumb } from '../../../_components/DirectoryView';

// Anonymous and identical for every visitor: ISR, edge-cacheable. Pages render on
// first request (no build-time fan-out) and refresh hourly.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ slug: string; page?: string[] }> };

async function resolve(props: Props) {
  const { slug, page: seg } = await props.params;
  const page = parsePage(seg);
  const niche = page ? await findNiche(slug) : null;
  if (!page || !niche) return null;
  const list = await loadList(JSON.stringify({ kind: 'niche', id: niche.id }), page);
  if (!list.items.length || page > list.pages) return null;
  return { niche, page, list, base: `/stores/niche/${niche.slug}` };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const r = await resolve(props);
  if (!r) return {};
  const { niche, page, list, base } = r;
  return directoryMetadata({
    title: `Top ${niche.name} Shopify stores by traffic${pageSuffix(page)}`,
    description: `${fmt(list.total)} Shopify stores in ${niche.name}. See the top ${niche.name} stores ranked by SimilarWeb monthly visits, with growth, live Meta ads, product counts and country. Free.`,
    path: pagePath(base, page),
    total: list.total,
  });
}

export default async function NichePage(props: Props) {
  const r = await resolve(props);
  if (!r) notFound();
  const { niche, page, list, base } = r;
  const [niches, techs] = await Promise.all([safe(nicheDirectory()), safe(techDirectory())]);

  const crumbs: Crumb[] = [
    { name: 'Shopify stores', href: '/stores' },
    ...(niche.parent ? [{ name: niche.parent.name, href: `/stores/niche/${niche.parent.slug}` }] : []),
    { name: niche.name, href: base },
  ];
  const month = measuredMonth(list.items);
  const intro = `${fmt(list.total)} Shopify stores are filed under ${niche.parent ? `${niche.parent.name} › ` : ''}${niche.name} in the AdLibrarySpy index. `
    + `Ranked by monthly visits${month ? ` (SimilarWeb, ${month})` : ' (SimilarWeb)'}; showing ${rangeLabel(page, list.items.length)}.`;

  const link = (n: { slug: string; name: string; shops: number }) => ({ href: `/stores/niche/${n.slug}`, label: n.name, count: n.shops });
  const children = niches.filter(n => n.parent?.slug === niche.slug);
  const siblings = niches.filter(n => n.slug !== niche.slug && (niche.parent ? n.parent?.slug === niche.parent.slug : !n.parent));

  return (
    <DirectoryPage
      crumbs={crumbs}
      h1={`Top ${niche.name} Shopify stores${pageSuffix(page)}`}
      intro={intro}
      list={list}
      base={base}
      refTag={`seo:stores/niche/${niche.slug}`}
      jsonLdName={`Top ${niche.name} Shopify stores by monthly visits`}
      related={[
        { title: `${niche.name} subcategories`, links: children.slice(0, 24).map(link) },
        { title: niche.parent ? `More in ${niche.parent.name}` : 'Other niches', links: siblings.slice(0, 24).map(link) },
        { title: 'Popular Shopify technologies', links: techs.slice(0, 12).map(t => ({ href: `/stores/tech/${t.slug}`, label: t.name, count: t.shops })) },
        { title: 'Trending', links: [
          { href: '/stores/trending', label: 'Fastest-growing stores' },
          { href: '/stores/trending/ads', label: 'Most live Meta ads' },
        ] },
      ]}
    />
  );
}
