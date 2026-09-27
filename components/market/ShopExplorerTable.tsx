import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart2, ExternalLink, Eye } from 'lucide-react';
import type { ShopRow } from '@/lib/types';
import { compact } from '@/lib/format';
import { trafficTitle } from '@/lib/traffic/similarweb';
import { shopTraffic } from '@/lib/traffic/crux-bands';
import { PlatformIcon, RankBadge } from './PlatformIcon';
import { BrandLogo } from './BrandLogo';
import { ShopRowMenu } from './ShopRowClient';
import { TrafficSparkline } from './TrafficChart';
import { ChartDetail, ProductThumbsDetail } from './DetailDialogs';
import FavButton from '@/components/FavButton';
import { SortableHeader } from './SortableHeader';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * PlatformDTC's /market/top-brands table columns, in its order. `sort` is the
 * SHOP_SORTS key; rank, brand and products are not sortable there either.
 */
const COLUMNS: { label: string; sort?: string; right?: boolean; hint?: string; isDefault?: boolean }[] = [
  { label: 'Rank' },
  { label: 'Brand Info' },
  { label: 'Monthly Traffic', sort: 'traffic', hint: 'Measured monthly visits' },
  { label: 'Growth Rate', sort: 'growth', right: true, hint: 'Month-over-month visits' },
  { label: 'AOV', sort: 'aov', right: true, hint: 'Average product price' },
  { label: 'Ads', sort: 'ads', right: true, hint: 'Active Meta ads' },
  { label: 'Max Ads (7D)', sort: 'maxads', isDefault: true, right: true, hint: 'Peak concurrent ads, last 7 days' },
  { label: 'Top Products' },
  { label: 'Launch Year', sort: 'launched', hint: 'Shop creation date' },
];

/** top-brands' formatCurrency: dollars, compacted from $1K. */
function usd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** Meta Ad Library searched for the store's domain (owner's choice, 09-27). */
const adLibraryUrl = (domain: string) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&media_type=all&q=${encodeURIComponent(domain)}&search_type=keyword_unordered`;

/**
 * The Shops table, laid out exactly as PlatformDTC's Top Brands: Rank | Brand
 * Info | Monthly Traffic | Growth Rate | AOV | Ads | Max Ads (7D) | Top Products
 * | Launch Year. Every cell renders only measured data; a store without a value
 * for a column shows nothing there.
 *
 * `infoSlot` adds a line under Brand Info (e.g. the folder picker on Favorites).
 * `rankOffset` is the number of rows on earlier pages.
 *
 * No 'use client' and no server-only imports: server pages (Favorites, Team)
 * render it on the server, the Shops explorer renders it in the browser.
 */
export function ShopExplorerTable({
  shops, saved, viewed = new Set(), hiddenView = false,
  empty = 'No shops match these filters.', infoSlot, sortable = false, rankOffset = 0,
}: {
  shops: ShopRow[];
  saved: ReadonlySet<string>;
  viewed?: ReadonlySet<string>;
  /** Rows are the workspace's hidden shops: the menu offers "Show in Shops again". */
  hiddenView?: boolean;
  empty?: string;
  infoSlot?: (shop: ShopRow) => ReactNode;
  /** Column headers sort the list (SHOP_SORTS keys) — only where the loader reads `sort`. */
  sortable?: boolean;
  rankOffset?: number;
}) {
  return (
    // Apple list card: hairline-bordered 22px card, a frosted sticky header with
    // sentence-case labels, hairline row separators and a faint hover wash.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[var(--a-sep)] bg-[var(--a-card)] shadow-[var(--card-shadow)]">
      <Table containerClassName="table-sticky-id min-h-0 flex-1"
        className="min-w-[1400px] table-fixed tracking-[-0.01em] [&_tbody_td]:py-2.5 [&_tbody_tr]:border-[var(--a-sep)] [&_tbody_tr:hover]:bg-[var(--a-row-hover)]">
        <colgroup>
          <col className="w-16" /><col className="w-60" /><col className="w-48" /><col className="w-28" />
          <col className="w-28" /><col className="w-36" /><col className="w-32" /><col className="w-40" />
          <col className="w-24" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 [&_th]:bg-[var(--a-glass)] [&_th]:shadow-[inset_0_-1px_0_var(--a-sep)] [&_th]:backdrop-blur-xl [&_th]:text-[12px] [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-normal [&_th_button]:text-[12px] [&_th_button]:font-semibold [&_th_button]:normal-case [&_th_button]:tracking-normal [&_tr]:border-[var(--a-sep)]">
          <TableRow>
            {COLUMNS.map(c => sortable && c.sort ? (
              <SortableHeader key={c.label} label={c.label} sortKey={c.sort} isDefault={c.isDefault} hint={c.hint}
                align={c.right ? 'right' : 'left'} />
            ) : (
              <TableHead key={c.label} className={c.right ? 'text-right' : undefined}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shops.length === 0 ? (
            <TableEmpty colSpan={COLUMNS.length}>{empty}</TableEmpty>
          ) : shops.map((s, i) => {
            // Top Brands' sub-label: the measured month, else which estimate it is.
            const { visits, growth, caption, period } = shopTraffic(s);
            const showVisits = visits != null;
            const year = s.createdOn ? new Date(s.createdOn).getUTCFullYear() : NaN;
            return (
              <TableRow key={s.id} className="group">
                <TableCell><RankBadge rank={rankOffset + i + 1} /></TableCell>

                <TableCell>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Link href={`/shops/${s.id}`} className="shrink-0" aria-label={`${s.domain} analytics`}>
                      <BrandLogo logo={s.logo} domain={s.domain} name={s.name} size={44} />
                    </Link>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 items-center gap-1">
                        {/* A real link: click opens the dossier, cmd/middle-click a new tab. */}
                        <Link href={`/shops/${s.id}`} title={s.fullTitle || s.name}
                          className="min-w-0 truncate rounded text-[15px] font-semibold tracking-[-0.015em] text-foreground outline-none hover:underline focus-visible:shadow-[0_0_0_4px_var(--a-focus)]">
                          {s.domain}
                        </Link>
                        <FavButton type="shop" id={s.id} initial={saved.has(s.id)} />
                        {viewed.has(s.id) && <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Viewed" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <PlatformIcon platform={s.platform} className="h-3.5 w-3.5" />
                        {s.niches[0] && (
                          <p className="truncate text-[12px] text-muted-foreground" title={s.niches.join(', ')}>{s.niches[0]}</p>
                        )}
                        {/* On the sub-line, where it never takes width from the domain. */}
                        <span className="ml-auto flex shrink-0"><ShopRowMenu shop={s} hidden={hiddenView} /></span>
                      </div>
                      {infoSlot && <div className="max-w-[220px] pt-1">{infoSlot(s)}</div>}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {showVisits && (
                    <div className="inline-grid grid-cols-[5.5rem_4rem] items-center gap-2">
                      <div className="min-w-0">
                        <div className="text-left text-[15px] font-semibold leading-none tabular-nums text-foreground"
                          title={trafficTitle(s.monthlyVisits, s.trafficSource, period, s.domain)}>
                          {compact(s.monthlyVisits)}
                        </div>
                        {caption && <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground">{caption}</div>}
                      </div>
                      <ChartDetail title={s.domain} subtitle="Monthly traffic" data={s.trafficSeries.filter(p => p.v > 0)}
                        valueLabel="Visits" headline={s.monthlyVisits} growth={growth} caption={caption}
                        countries={s.visitorCountries} countriesLabel="Visitor countries" shop={{ id: s.id, domain: s.domain }}>
                        <TrafficSparkline data={s.trafficSeries} growthRate={growth} />
                      </ChartDetail>
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {growth != null && (
                    <div className="flex flex-col items-end">
                      <span className={`inline-flex items-center gap-0.5 rounded-full py-0.5 pl-1.5 pr-2 text-[13px] font-semibold ${
                        growth > 0 ? 'bg-[var(--a-green-tint)] text-[var(--a-green)]'
                          : growth < 0 ? 'bg-[var(--a-red-tint)] text-[var(--a-red)]'
                          : 'bg-[var(--a-fill)] text-foreground'}`}>
                        {growth > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          : growth < 0 ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : null}
                        {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                      </span>
                      {caption && <div className="mt-1 max-w-full truncate text-[11px] leading-none text-muted-foreground">{caption}</div>}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {s.avgPrice > 0 && <span className="text-[15px] text-foreground">{usd(s.avgPrice)}</span>}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  <div className="flex items-center justify-end gap-2">
                    {s.metaAds > 0 && (
                      // App Store "Get" button: blue label on the grey capsule.
                      <Link href={`/ads?store=${encodeURIComponent(s.domain)}`} title="View this shop's ads"
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--a-fill)] px-2.5 text-[13px] font-semibold text-[var(--a-blue)] transition-colors hover:bg-[var(--a-fill-hover)]">
                        {compact(s.metaAds)}
                        <BarChart2 className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <a href={adLibraryUrl(s.domain)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--a-fill)] text-[var(--a-blue)] transition-colors hover:bg-[var(--a-fill-hover)]"
                      title={`Search ${s.domain} on Meta Ad Library`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {s.maxAds7d != null && <span className="text-[15px] font-semibold text-[var(--a-purple)]">{compact(s.maxAds7d)}</span>}
                </TableCell>

                <TableCell>
                  <ProductThumbsDetail products={s.bestSellers} max={3} size={40} title={`${s.domain} · best sellers`}
                    shop={{ id: s.id, domain: s.domain }} />
                </TableCell>

                <TableCell>
                  {Number.isFinite(year) && <span className="text-[15px] tabular-nums text-muted-foreground">{year}</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
