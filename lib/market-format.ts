// Number formatting matching PlatformDTC's market pages exactly, so the same
// figure reads identically on both surfaces.

/** Metrics: an unmeasured value is 'N/A', never 0. */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || n === 0) return 'N/A';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Counts (creatives, ads): zero is a real answer, so show 0. */
export function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toLocaleString()}`;
}

export type Trend = 'up' | 'down' | 'stable';

export function trendOf(growthRate: number | null | undefined): Trend {
  if (growthRate == null || growthRate === 0) return 'stable';
  return growthRate > 0 ? 'up' : 'down';
}

export function trendColor(trend: Trend): string {
  return trend === 'up' ? 'text-green-500 dark:text-green-400'
       : trend === 'down' ? 'text-red-500 dark:text-red-400'
       : 'text-yellow-500 dark:text-yellow-400';
}

export function launchYear(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : String(d.getFullYear());
}

/** Facebook Ad Library deep link for a store domain. */
export function adLibraryHref(domain: string): string {
  const q = encodeURIComponent(`"${domain}"`);
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US`
       + `&is_targeted_country=false&media_type=all&q=${q}`
       + `&search_type=keyword_exact_phrase&sort_data[mode]=total_impressions&sort_data[direction]=desc`;
}
