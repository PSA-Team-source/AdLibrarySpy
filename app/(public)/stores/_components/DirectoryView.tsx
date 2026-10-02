import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Shop } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BrandLogo } from '@/components/market/BrandLogo';
import { compact, flag } from '@/lib/format';
import { SITE_URL, storePath } from '@/lib/public/site';
import { countryName, PAGE_SIZE, type DirectoryList } from '@/lib/seo/directory';

export interface Crumb { name: string; href: string }
export interface RelatedGroup { title: string; links: { href: string; label: string; count?: number }[] }

const nf = new Intl.NumberFormat('en-US');
export const fmt = (n: number) => nf.format(n);

/** Canonical path of page n of a directory: page 1 is the bare URL. */
export const pagePath = (base: string, n: number) => (n <= 1 ? base : `${base}/${n}`);

/** BreadcrumbList + ItemList, the two structured-data blocks every directory page carries. */
export function DirectoryJsonLd({ crumbs, list, name }: { crumbs: Crumb[]; list: DirectoryList | null; name: string }) {
  const data: Record<string, unknown>[] = [{
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE_URL}${c.href}` })),
  }];
  if (list?.items.length) {
    const offset = (list.page - 1) * PAGE_SIZE;
    data.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name,
      numberOfItems: list.items.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: list.items.map((s, i) => ({
        '@type': 'ListItem', position: offset + i + 1, name: s.name, url: `${SITE_URL}${storePath(s.domain)}`,
      })),
    });
  }
  // `<` escaped so a store title can never close the script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {i < crumbs.length - 1
              ? <Link href={c.href} className="hover:text-foreground">{c.name}</Link>
              : <span aria-current="page" className="text-foreground">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** "Explore all filters free" — carries the page as first-touch attribution (als_ref). */
export function SignupCta({ refTag, children }: { refTag: string; children?: React.ReactNode }) {
  return (
    <section className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">Filter all of it, free</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {children ?? 'Combine niche, country, traffic, growth, ad activity and tech stack, open any store’s dossier, and track competitors. No card, no limits.'}
        </p>
      </div>
      <Link href={`/signup?ref=${encodeURIComponent(refTag)}`} className="btn-primary inline-flex shrink-0 items-center gap-1.5">
        Explore all filters free<ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

function Growth({ shop }: { shop: Shop }) {
  const g = shop.similarweb?.growthPct;
  if (g == null) return null;
  // One decimal is noise past 100%, and it keeps the cell narrow on a phone.
  const r = Math.abs(g) >= 100 ? Math.round(g) : Math.round(g * 10) / 10;
  return <span className={r > 0 ? 'text-emerald-600 dark:text-emerald-400' : r < 0 ? 'text-red-600 dark:text-red-400' : ''}>{r > 0 ? '+' : ''}{fmt(r)}%</span>;
}

/** The ranked table. Only measured values print; an absent value is an empty cell. */
export function StoreTable({ list, caption }: { list: DirectoryList; caption: string }) {
  const offset = (list.page - 1) * PAGE_SIZE;
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table aria-label={caption} className="max-sm:table-fixed max-sm:[&_tr>*:nth-child(1)]:hidden max-sm:[&_tr>*:nth-child(5)]:hidden max-sm:[&_tr>*:nth-child(6)]:hidden max-sm:[&_tr>*:nth-child(7)]:hidden">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead className="max-sm:w-[44%]">Store</TableHead>
            <TableHead className="text-right"><span className="sm:hidden">Visits</span><span className="max-sm:hidden">Monthly visits</span></TableHead>
            <TableHead className="text-right">Growth</TableHead>
            <TableHead className="text-right">Live Meta ads</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead>Country</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.items.map((s, i) => (
            <TableRow key={s.domain}>
              <TableCell className="text-right tabular-nums text-muted-foreground">{offset + i + 1}</TableCell>
              <TableCell>
                <Link href={storePath(s.domain)} className="flex min-w-0 items-center gap-2.5">
                  <BrandLogo logo={s.logo} domain={s.domain} name={s.name} size={24} />
                  <span className="min-w-0">
                    <span className="block max-w-[260px] truncate font-medium text-foreground hover:underline">{s.name}</span>
                    {s.name !== s.domain && <span className="block truncate text-xs text-muted-foreground">{s.domain}</span>}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{s.similarweb ? compact(s.similarweb.visits) : ''}</TableCell>
              <TableCell className="text-right tabular-nums"><Growth shop={s} /></TableCell>
              <TableCell className="text-right tabular-nums">{s.metaAds > 0 ? fmt(s.metaAds) : ''}</TableCell>
              <TableCell className="text-right tabular-nums">{s.productCount > 0 ? fmt(s.productCount) : ''}</TableCell>
              <TableCell className="whitespace-nowrap">
                {s.country && countryName(s.country)
                  ? <Link href={`/stores/country/${s.country.toLowerCase()}`} className="hover:underline">{flag(s.country)} {countryName(s.country)}</Link>
                  : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function Pagination({ base, list }: { base: string; list: DirectoryList }) {
  if (list.pages <= 1) return null;
  const nums = Array.from({ length: list.pages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === list.pages || Math.abs(n - list.page) <= 2);
  const cls = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-sm tabular-nums';
  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-1.5">
      {list.page > 1 && <Link rel="prev" href={pagePath(base, list.page - 1)} className={`${cls} hover:bg-muted`} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-muted-foreground">…</span>}
          {n === list.page
            ? <span aria-current="page" className={`${cls} bg-foreground text-background`}>{n}</span>
            : <Link href={pagePath(base, n)} className={`${cls} hover:bg-muted`}>{n}</Link>}
        </span>
      ))}
      {list.page < list.pages && <Link rel="next" href={pagePath(base, list.page + 1)} className={`${cls} hover:bg-muted`} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link>}
    </nav>
  );
}

export function Related({ groups }: { groups: RelatedGroup[] }) {
  const shown = groups.filter(g => g.links.length);
  if (!shown.length) return null;
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      {shown.map(g => (
        <section key={g.title}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{g.title}</h2>
          <ul className="flex flex-wrap gap-2">
            {g.links.map(l => (
              <li key={l.href}>
                <Link href={l.href} className="chip">
                  {l.label}{l.count != null && <span className="ml-1.5 tabular-nums text-muted-foreground">{compact(l.count)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The whole list page: crumbs, H1, the count sentence, the table, pages, related, CTA. */
export function DirectoryPage({ crumbs, h1, intro, list, base, related, refTag, jsonLdName }: {
  crumbs: Crumb[]; h1: string; intro: string; list: DirectoryList; base: string;
  related: RelatedGroup[]; refTag: string; jsonLdName: string;
}) {
  return (
    <>
      <DirectoryJsonLd crumbs={crumbs} list={list} name={jsonLdName} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{h1}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-6"><StoreTable list={list} caption={h1} /></div>
      <Pagination base={base} list={list} />
      <SignupCta refTag={refTag} />
      <Related groups={related} />
    </>
  );
}
