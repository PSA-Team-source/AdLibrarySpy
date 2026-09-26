import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { countryDirectory, countryName, countryPhrase, nicheDirectory, measuredMonth, parsePage, safe } from '@/lib/seo/directory';
import { directoryMetadata, loadList, pageSuffix, rangeLabel } from '@/lib/seo/meta';
import { DirectoryPage, fmt, pagePath, type Crumb } from '../../../_components/DirectoryView';

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ cc: string; page?: string[] }> };

async function resolve(props: Props) {
  const { cc, page: seg } = await props.params;
  const page = parsePage(seg);
  const name = countryName(cc);
  if (!page || !name) return null;
  const list = await loadList(JSON.stringify({ kind: 'country', cc: cc.toLowerCase() }), page);
  if (!list.items.length || page > list.pages) return null;
  return { cc: cc.toLowerCase(), name, phrase: countryPhrase(cc), page, list, base: `/stores/country/${cc.toLowerCase()}` };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const r = await resolve(props);
  if (!r) return {};
  const { phrase, page, list, base } = r;
  return directoryMetadata({
    title: `Top Shopify stores in ${phrase} by traffic${pageSuffix(page)}`,
    description: `${fmt(list.total)} Shopify stores based in ${phrase}. See the biggest ones by SimilarWeb monthly visits, with growth, live Meta ads and product counts. Free.`,
    path: pagePath(base, page),
    total: list.total,
  });
}

export default async function CountryPage(props: Props) {
  const { cc } = await props.params;
  // One URL per country: /stores/country/US → /stores/country/us.
  if (cc !== cc.toLowerCase() && countryName(cc)) {
    const { page } = await props.params;
    permanentRedirect(pagePath(`/stores/country/${cc.toLowerCase()}`, parsePage(page) ?? 1));
  }
  const r = await resolve(props);
  if (!r) notFound();
  const { name, phrase, page, list, base } = r;
  const [countries, niches] = await Promise.all([safe(countryDirectory()), safe(nicheDirectory())]);

  const crumbs: Crumb[] = [
    { name: 'Shopify stores', href: '/stores' },
    { name: 'Countries', href: '/stores#countries' },
    { name, href: base },
  ];
  const month = measuredMonth(list.items);
  const intro = `${fmt(list.total)} Shopify stores in the AdLibrarySpy index list ${phrase} as their country. `
    + `Ranked by monthly visits${month ? ` (SimilarWeb, ${month})` : ' (SimilarWeb)'}; showing ${rangeLabel(page, list.items.length)}.`;

  return (
    <DirectoryPage
      crumbs={crumbs}
      h1={`Top Shopify stores in ${phrase}${pageSuffix(page)}`}
      intro={intro}
      list={list}
      base={base}
      refTag={`seo:stores/country/${r.cc}`}
      jsonLdName={`Top Shopify stores in ${phrase} by monthly visits`}
      related={[
        { title: 'Other countries', links: countries.filter(c => c.cc !== r.cc).slice(0, 24)
            .map(c => ({ href: `/stores/country/${c.cc}`, label: c.name, count: c.shops })) },
        { title: 'Top niches', links: niches.filter(n => !n.parent).slice(0, 16)
            .map(n => ({ href: `/stores/niche/${n.slug}`, label: n.name, count: n.shops })) },
      ]}
    />
  );
}
