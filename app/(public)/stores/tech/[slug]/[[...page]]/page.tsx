import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findTech, nicheDirectory, techDirectory, measuredMonth, parsePage, safe } from '@/lib/seo/directory';
import { directoryMetadata, loadList, pageSuffix, rangeLabel } from '@/lib/seo/meta';
import { DirectoryPage, fmt, pagePath, type Crumb } from '../../../_components/DirectoryView';

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ slug: string; page?: string[] }> };

async function resolve(props: Props) {
  const { slug, page: seg } = await props.params;
  const page = parsePage(seg);
  const tech = page ? await findTech(slug) : null;
  if (!page || !tech) return null;
  const list = await loadList(JSON.stringify({ kind: 'tech', name: tech.name, techKind: tech.kind }), page);
  if (!list.items.length || page > list.pages) return null;
  return { tech, page, list, base: `/stores/tech/${tech.slug}` };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const r = await resolve(props);
  if (!r) return {};
  const { tech, page, list, base } = r;
  return directoryMetadata({
    title: `Top Shopify stores using ${tech.name}${pageSuffix(page)}`,
    description: `${fmt(list.total)} Shopify stores use ${tech.name}. See the biggest ones by SimilarWeb monthly visits, with growth, live Meta ads, product counts and country. Free.`,
    path: pagePath(base, page),
    total: list.total,
  });
}

export default async function TechPage(props: Props) {
  const r = await resolve(props);
  if (!r) notFound();
  const { tech, page, list, base } = r;
  const [techs, niches] = await Promise.all([safe(techDirectory()), safe(nicheDirectory())]);

  const crumbs: Crumb[] = [
    { name: 'Shopify stores', href: '/stores' },
    { name: 'Technologies', href: '/stores#technologies' },
    { name: tech.name, href: base },
  ];
  const month = measuredMonth(list.items);
  const what = tech.kind === 'pixel' ? 'tracking pixel' : 'technology';
  const intro = `${fmt(list.total)} Shopify stores in the AdLibrarySpy index have the ${tech.name} ${what} detected on their storefront. `
    + `Ranked by monthly visits${month ? ` (SimilarWeb, ${month})` : ' (SimilarWeb)'}; showing ${rangeLabel(page, list.items.length)}.`;

  return (
    <DirectoryPage
      crumbs={crumbs}
      h1={`Top Shopify stores using ${tech.name}${pageSuffix(page)}`}
      intro={intro}
      list={list}
      base={base}
      refTag={`seo:stores/tech/${tech.slug}`}
      jsonLdName={`Top Shopify stores using ${tech.name}`}
      related={[
        { title: tech.kind === 'pixel' ? 'Other tracking pixels' : 'Other technologies',
          links: techs.filter(t => t.kind === tech.kind && t.slug !== tech.slug).slice(0, 24)
            .map(t => ({ href: `/stores/tech/${t.slug}`, label: t.name, count: t.shops })) },
        { title: 'Top niches', links: niches.filter(n => !n.parent).slice(0, 16)
            .map(n => ({ href: `/stores/niche/${n.slug}`, label: n.name, count: n.shops })) },
      ]}
    />
  );
}
