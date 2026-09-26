import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarChart2, ExternalLink, Eye, TrendingDown, TrendingUp } from 'lucide-react';
import type { ShopRow } from '@/lib/types';
import { compact } from '@/lib/format';
import { monthLabel, trafficTitle } from '@/lib/traffic/similarweb';
import { trafficIsCredible } from '@/lib/traffic/crux-bands';
import { PlatformIcon, RankBadge } from './PlatformIcon';
import { BrandLogo } from './BrandLogo';
import { ShopNameMenu } from './ShopRowClient';
import { TrafficSparkline } from './TrafficChart';
import { ProductThumbs } from '@/components/ShopMedia';
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

const adLibraryUrl = (domain: string) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&is_targeted_country=false&media_type=all&q=${encodeURIComponent(`"${domain}"`)}&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc`;

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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[var(--card-shadow)]">
      <Table containerClassName="table-sticky-id min-h-0 flex-1" className="min-w-[1400px] table-fixed">
        <colgroup>
          <col className="w-16" /><col className="w-56" /><col className="w-48" /><col className="w-32" />
          <col className="w-28" /><col className="w-24" /><col className="w-32" /><col className="w-40" />
          <col className="w-24" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 [&_th]:bg-card">
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
            const measured = s.trafficSource === 'similarweb' && s.monthlyVisits > 0;
            const showVisits = measured || trafficIsCredible(s.monthlyVisits, s.cruxBucket, s.similarWebRank);
            const period = s.similarweb?.period ?? '';
            // Top Brands' sub-label: the measured month, else which estimate it is.
            const caption = measured ? (period ? monthLabel(period) : 'SimilarWeb')
              : s.trafficSource === 'semrush' ? 'Semrush' : 'Index estimate';
            // Growth from the same measurement as the visits; the index's 0 is "not computed".
            const growth = !showVisits ? null : measured ? (s.similarweb?.growthPct ?? null) : (s.visitsGrowth || null);
            const year = s.createdOn ? new Date(s.createdOn).getUTCFullYear() : NaN;
            return (
              <TableRow key={s.id}>
                <TableCell><RankBadge rank={rankOffset + i + 1} /></TableCell>

                <TableCell>
                  <div className="flex items-center gap-4 overflow-hidden">
                    <Link href={`/shops/${s.id}`} className="shrink-0" aria-label={`${s.domain} analytics`}>
                      <BrandLogo logo={s.logo} domain={s.domain} name={s.name} size={64} />
                    </Link>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 items-center gap-1">
                        <ShopNameMenu shop={s} label={s.domain} hidden={hiddenView} />
                        <FavButton type="shop" id={s.id} initial={saved.has(s.id)} />
                        {viewed.has(s.id) && <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Viewed" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <PlatformIcon platform={s.platform} />
                        {s.niches[0] && (
                          <p className="truncate text-xs text-muted-foreground" title={s.niches.join(', ')}>{s.niches[0]}</p>
                        )}
                      </div>
                      {infoSlot && <div className="max-w-[220px] pt-1">{infoSlot(s)}</div>}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {showVisits && (
                    <div className="inline-grid grid-cols-[5.5rem_4rem] items-center gap-2">
                      <div className="min-w-0">
                        <div className="text-left text-sm font-medium leading-none tabular-nums text-foreground"
                          title={trafficTitle(s.monthlyVisits, s.trafficSource, period, s.domain)}>
                          {compact(s.monthlyVisits)}
                        </div>
                        {caption && <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground">{caption}</div>}
                      </div>
                      <TrafficSparkline data={s.trafficSeries} growthRate={growth} />
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {growth != null && (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center justify-end gap-2">
                        {growth > 0 ? <TrendingUp className="h-4 w-4 text-green-400" />
                          : growth < 0 ? <TrendingDown className="h-4 w-4 text-red-400" />
                          : <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400" aria-hidden />}
                        <span className={`text-sm font-medium ${growth > 0 ? 'text-green-400' : growth < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                          {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                        </span>
                      </div>
                      {caption && <div className="mt-1 max-w-full truncate text-[11px] leading-none text-muted-foreground">{caption}</div>}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {s.avgPrice > 0 && <span className="text-sm text-foreground">{usd(s.avgPrice)}</span>}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  <div className="flex items-center justify-end gap-2">
                    {s.metaAds > 0 && (
                      <Link href={`/ads?store=${encodeURIComponent(s.domain)}`} title="View this shop's ads"
                        className="flex items-center gap-1.5 text-blue-400 transition-colors hover:text-blue-300">
                        <span className="font-medium">{compact(s.metaAds)}</span>
                        <BarChart2 className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <a href={adLibraryUrl(s.domain)} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 transition-colors hover:text-blue-300" title="View on Facebook Ad Library (US)">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {s.maxAds7d != null && <span className="text-sm font-medium text-purple-400">{compact(s.maxAds7d)}</span>}
                </TableCell>

                <TableCell>
                  <ProductThumbs products={s.bestSellers} max={3} size={48} />
                </TableCell>

                <TableCell>
                  {Number.isFinite(year) && <span className="text-sm text-muted-foreground">{year}</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
