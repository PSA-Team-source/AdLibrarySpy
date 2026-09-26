import type { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp, Megaphone } from 'lucide-react';
import { compact, flag } from '@/lib/format';
import { loadList } from '@/lib/seo/meta';
import { countryDirectory, nicheDirectory, techDirectory, safe, measuredMonth, type NicheEntry } from '@/lib/seo/directory';
import { SITE_URL } from '@/lib/public/site';
import { Breadcrumbs, DirectoryJsonLd, SignupCta, StoreTable, fmt } from './_components/DirectoryView';

export const revalidate = 3600;

const TITLE = 'Shopify store directory: top stores by niche, country and tech';

export async function generateMetadata(): Promise<Metadata> {
  const top = await loadList('{"kind":"all"}', 1).catch(() => null);
  const description = top
    ? `Browse ${fmt(top.total)} Shopify stores by niche, country and the apps they run, ranked by SimilarWeb monthly visits, traffic growth and live Meta ads. Free.`
    : 'Browse Shopify stores by niche, country and the apps they run, ranked by SimilarWeb monthly visits, traffic growth and live Meta ads. Free.';
  return {
    title: TITLE,
    description,
    alternates: { canonical: `${SITE_URL}/stores` },
    openGraph: { type: 'website', url: `${SITE_URL}/stores`, title: TITLE, description, siteName: 'AdLibrarySpy' },
    twitter: { card: 'summary', title: TITLE, description },
  };
}

function Chips({ links }: { links: { href: string; label: string; count: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map(l => (
        <li key={l.href}>
          <Link href={l.href} className="chip">{l.label}<span className="ml-1.5 tabular-nums text-muted-foreground">{compact(l.count)}</span></Link>
        </li>
      ))}
    </ul>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{lead}</p>
      {children}
    </section>
  );
}

export default async function StoresHub() {
  const [top, niches, techs, countries] = await Promise.all([
    loadList('{"kind":"all"}', 1).catch(() => null),
    safe(nicheDirectory()),
    safe(techDirectory()),
    safe(countryDirectory()),
  ]);
  const tops = niches.filter(n => !n.parent);
  const childrenOf = (n: NicheEntry) => niches.filter(c => c.parent?.slug === n.slug);
  const month = top ? measuredMonth(top.items) : '';
  const preview = top ? { ...top, items: top.items.slice(0, 10) } : null;

  return (
    <>
      <DirectoryJsonLd crumbs={[{ name: 'Shopify stores', href: '/stores' }]} list={preview} name="Top Shopify stores by monthly visits" />
      <Breadcrumbs crumbs={[{ name: 'Shopify stores', href: '/stores' }]} />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Shopify store directory</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {top ? `${fmt(top.total)} Shopify stores in the AdLibrarySpy index, browsable by niche, country and the technology they run. ` : 'Shopify stores in the AdLibrarySpy index, browsable by niche, country and the technology they run. '}
        Every list is ranked by monthly visits measured by SimilarWeb{month ? ` (${month})` : ''}.
      </p>

      <nav aria-label="Directory sections" className="mt-5 flex flex-wrap gap-2">
        {tops.length > 0 && <a href="#niches" className="chip">Niches</a>}
        {techs.length > 0 && <a href="#technologies" className="chip">Technologies</a>}
        {countries.length > 0 && <a href="#countries" className="chip">Countries</a>}
        <Link href="/stores/trending" className="chip"><TrendingUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />Fastest growing</Link>
        <Link href="/stores/trending/ads" className="chip"><Megaphone className="mr-1.5 h-3.5 w-3.5" aria-hidden />Most live ads</Link>
      </nav>

      {preview && preview.items.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Biggest Shopify stores by traffic</h2>
          <StoreTable list={preview} caption="Biggest Shopify stores by monthly visits" />
        </section>
      )}

      {tops.length > 0 && (
        <Section id="niches" title="Browse by niche" lead={`${tops.length} niches and their subcategories, with the number of Shopify stores in each.`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tops.map(n => (
              <div key={n.slug} className="rounded-xl border border-border bg-card p-4">
                <Link href={`/stores/niche/${n.slug}`} className="flex items-baseline justify-between gap-3 font-medium text-foreground hover:underline">
                  <span>{n.name}</span><span className="text-xs tabular-nums text-muted-foreground">{fmt(n.shops)}</span>
                </Link>
                {childrenOf(n).length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {childrenOf(n).slice(0, 8).map(c => (
                      <li key={c.slug}><Link href={`/stores/niche/${c.slug}`} className="hover:text-foreground hover:underline">{c.name}</Link></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {techs.length > 0 && (
        <Section id="technologies" title="Browse by technology" lead="Apps, payment methods and tracking pixels detected on Shopify storefronts, by number of stores.">
          <Chips links={techs.slice(0, 120).map(t => ({ href: `/stores/tech/${t.slug}`, label: t.name, count: t.shops }))} />
        </Section>
      )}

      {countries.length > 0 && (
        <Section id="countries" title="Browse by country" lead="Shopify stores by the country the store lists as its origin.">
          <Chips links={countries.map(c => ({ href: `/stores/country/${c.cc}`, label: `${flag(c.cc)} ${c.name}`, count: c.shops }))} />
        </Section>
      )}

      <SignupCta refTag="seo:stores" />
    </>
  );
}
