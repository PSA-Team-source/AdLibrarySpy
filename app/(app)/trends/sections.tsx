import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BrandLogo } from '@/components/market/BrandLogo';
import { ProductImage } from '@/components/ShopMedia';
import { compact, flag } from '@/lib/format';
import { monthLabel, previousMonth } from '@/lib/traffic/similarweb';
import {
  RISER_BANDS, MIN_PREV_VISITS, NICHE_MIN_GROWTH, NICHE_MIN_VISITS,
  growthLabel, type RiserBand,
} from '@/lib/trends';
import { loadNicheTrends, loadRisers, type TrendShop, type TrendNiche } from './load';
import { TrendProductCard } from './product-card';

// The three Trends sections, shared by the signed-in /trends and the public
// /trending page. Only where rows link differs; `links` carries that.
export interface TrendLinks {
  shop: (s: { id: string; domain: string }) => string;
  /** null = the niche card is not a link on this surface. */
  niche: (n: TrendNiche) => string | null;
  /** null = no size/ads switch (public page: one band, every store). */
  band: ((b: RiserBand, noAds?: boolean) => string) | null;
  seeAll: (b: RiserBand) => string;
  /** A store's ads in the library. */
  ads: (domain: string) => string;
}

/** "2026-08" → "Jul → Aug 2026" (both years when they differ). '' when unknown. */
function span(period: string): string {
  const prev = previousMonth(period);
  if (!prev) return '';
  const [a, b] = [monthLabel(prev), monthLabel(period)];
  return prev.slice(0, 4) === period.slice(0, 4) ? `${a.split(' ')[0]} → ${b}` : `${a} → ${b}`;
}

/** Rows the fastest-growing list shows. */
const RISERS_SHOWN = 25;

const growthTone = 'font-semibold tabular-nums text-emerald-600 dark:text-emerald-400';
const seeAll = 'inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground';

export function Skeleton({ h }: { h: string }) {
  return <div className={`${h} animate-pulse rounded-xl bg-muted`} aria-busy="true" aria-label="Loading" />;
}

// ---------- trending niches ----------

export async function NichesSection({ links }: { links: TrendLinks }) {
  const data = await loadNicheTrends().catch(() => null);
  if (!data?.niches.length) return null;
  const when = span(data.period);
  return (
    <SectionCard
      title="Trending niches"
      description={`Share of each niche's stores with ${compact(NICHE_MIN_VISITS)}+ monthly visits that grew ${NICHE_MIN_GROWTH}%+${when ? `, ${when}` : ''}.`}
    >
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {data.niches.map((n, i) => {
          const pct = Math.round(n.share * 100);
          return (
            <li key={n.id} className="flex flex-col rounded-xl border border-border p-4">
              <NicheLink href={links.niche(n)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{n.parentName}</p>
                    <h3 className="truncate text-sm font-semibold text-foreground group-hover:underline">{n.name}</h3>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">#{i + 1}</span>
                </div>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-foreground">{n.breakout.toLocaleString('en-US')}</span>
                  <span className="text-xs text-muted-foreground">stores grew {NICHE_MIN_GROWTH}%+</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <span className="font-medium tabular-nums text-foreground">{pct}%</span> of {n.measured.toLocaleString('en-US')} measured stores
                </p>
              </NicheLink>
              {n.leaders.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3">
                  {n.leaders.map(l => (
                    <li key={l.id}>
                      <Link href={links.shop(l)} className="-mx-1 flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent">
                        <BrandLogo logo={l.logo} domain={l.domain} name={l.name} size={22} />
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={l.domain}>{l.name}</span>
                        {l.product && (
                          <ProductImage src={l.product.image} alt={l.product.title}
                            className="h-7 w-7 shrink-0 rounded-md border border-border object-cover" />
                        )}
                        <span className={`shrink-0 text-xs ${growthTone}`}>{growthLabel(l.growthPct)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

// ---------- fastest-growing stores ----------

export async function RisersSection({ band, noAds = false, links }: { band: RiserBand; noAds?: boolean; links: TrendLinks }) {
  const pool = await loadRisers(band).catch(() => [] as TrendShop[]);
  // "Growing with no ads" = breakouts with no Meta ads in the library, from the same ranked pool.
  const organic = pool.filter(s => s.metaAds === 0);
  const rows = (noAds && organic.length ? organic : pool).slice(0, RISERS_SHOWN);
  if (!rows.length) return null;
  const onlyOrganic = noAds && organic.length > 0;
  const when = span(rows[0].period);
  const prevLabel = monthLabel(previousMonth(rows[0].period)).split(' ')[0];
  return (
    <SectionCard
      padded={false}
      title="Fastest-growing stores"
      description={`Month-over-month SimilarWeb visits${when ? `, ${when}` : ''}. Stores with at least ${compact(MIN_PREV_VISITS)} visits the month before.`}
      actions={<Link href={links.seeAll(band)} className={seeAll}>See all <ArrowRight className="h-4 w-4" /></Link>}
    >
      {links.band && <nav className="flex gap-2 px-6 pt-4" aria-label="Store size">
        {(Object.keys(RISER_BANDS) as RiserBand[]).map(b => (
          <Link key={b} href={links.band!(b, onlyOrganic)} scroll={false}
            aria-current={b === band ? 'page' : undefined}
            className={`chip ${b === band ? 'chip-active' : ''}`}>
            {RISER_BANDS[b].label}
          </Link>
        ))}
        {organic.length > 0 && (
          <Link href={links.band(band, !onlyOrganic)} scroll={false}
            aria-pressed={onlyOrganic}
            title="Stores growing fast without any Meta ads"
            className={`chip ${onlyOrganic ? 'chip-active' : ''}`}>
            Growing with no ads
          </Link>
        )}
      </nav>}
      <Table className="max-sm:table-fixed sm:min-w-[820px] max-sm:[&_tr>*:nth-child(1):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(3):not([colspan])]:hidden max-sm:[&_tr>*:nth-child(5):not([colspan])]:hidden" containerClassName="pt-2">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 pl-6">#</TableHead>
            <TableHead className="max-sm:w-1/2">Shop</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right"><span className="sm:hidden">Visits</span><span className="max-sm:hidden">Monthly visits</span></TableHead>
            <TableHead className="text-right">Meta ads</TableHead>
            <TableHead className="pr-6 text-right">Growth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell className="pl-6 tabular-nums text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <Link href={links.shop(s)} className="flex min-w-0 items-center gap-3">
                  <BrandLogo logo={s.logo} domain={s.domain} name={s.name} size={32} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-foreground hover:underline">{s.name}</span>
                      {flag(s.country) && <span className="text-[13px] leading-none" title={`Shop origin: ${s.country}`}>{flag(s.country)}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{s.domain}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                {s.niches[0] && (
                  <span className="rounded-md border border-border bg-foreground/5 px-2 py-1 text-xs text-foreground/80">{s.niches[0]}</span>
                )}
              </TableCell>
              <TableCell className="text-right" title={`${s.prevVisits.toLocaleString('en-US')} → ${s.visits.toLocaleString('en-US')} visits, measured by SimilarWeb`}>
                <span className="block font-semibold tabular-nums text-foreground">{compact(s.visits)}</span>
                {prevLabel && <span className="block text-xs tabular-nums text-muted-foreground">from {compact(s.prevVisits)} in {prevLabel}</span>}
              </TableCell>
              <TableCell className="text-right">
                {s.metaAds > 0
                  ? <Link href={links.ads(s.domain)} className="font-medium tabular-nums text-foreground hover:underline" title="See the ads this store runs">
                      {compact(s.metaAds)} <span className="text-xs font-normal text-muted-foreground">see ads</span>
                    </Link>
                  : <span className="text-xs text-muted-foreground" title="No Meta ads found: this growth is not from Meta ads">No ads</span>}
              </TableCell>
              <TableCell className={`pr-6 text-right ${growthTone}`}>{growthLabel(s.growthPct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

// ---------- products from those stores ----------

export async function ProductsSection({ links }: { links: TrendLinks }) {
  // The 1M+ risers first (the bigger brands), then the 100K+ list; each store once.
  const [big, all] = await Promise.all([
    loadRisers('1m').then(r => r.slice(0, RISERS_SHOWN)).catch(() => [] as TrendShop[]),
    loadRisers('100k').then(r => r.slice(0, RISERS_SHOWN)).catch(() => [] as TrendShop[]),
  ]);
  const seen = new Set<string>();
  const products = [...big, ...all]
    .filter(s => !seen.has(s.id) && seen.add(s.id))
    // One product per store: a store's top two are often variants of one item.
    .flatMap(s => s.products.slice(0, 1).map(p => ({ ...p, shop: s })))
    .slice(0, 24);
  if (products.length < 6) return null;
  return (
    <SectionCard
      title="Products from fast-growing stores"
      description="From the catalogues of this month's fastest-growing stores. Growth is the store's SimilarWeb visits, month over month."
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map(p => (
          <TrendProductCard key={`${p.shop.id}:${p.image}`} href={links.shop(p.shop)} title={p.title}
            image={p.image} shopName={p.shop.name} domain={p.shop.domain}
            badge={growthLabel(p.shop.growthPct)} badgeTitle="The store's SimilarWeb visits, month over month" />
        ))}
      </ul>
    </SectionCard>
  );
}

function NicheLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? <Link href={href} className="group block">{children}</Link> : <div>{children}</div>;
}
