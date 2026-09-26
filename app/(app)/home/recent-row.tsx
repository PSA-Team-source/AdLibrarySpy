import Link from 'next/link';
import { ShopLogo } from '@/components/ShopMedia';
import { viewHref, type RecentView, type ViewType } from '@/lib/recents';

export const VIEW_TABS: { type: ViewType; label: string }[] = [
  { type: 'shop', label: 'Shops' },
  { type: 'advertiser', label: 'Advertisers' },
  { type: 'ad', label: 'Ads' },
];

export function parseViewType(v: string | undefined): ViewType {
  return VIEW_TABS.find(t => t.type === v)?.type ?? 'shop';
}

/** "just now", "42m", "18h", "7d", then a date. */
export function shortAgo(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}d` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentRow({ v, showCount = false }: { v: RecentView; showCount?: boolean }) {
  return (
    <li>
      <Link href={viewHref(v)} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent">
        <ShopLogo src={v.image} name={v.label} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{v.label || v.id}</span>
          <span className="block text-xs text-muted-foreground">{shortAgo(v.viewedAt)}</span>
        </span>
        {showCount && v.viewCount > 1 && <span className="text-xs tabular-nums text-muted-foreground">{v.viewCount} views</span>}
      </Link>
    </li>
  );
}
