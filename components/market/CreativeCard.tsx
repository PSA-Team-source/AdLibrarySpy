import Link from 'next/link';
import { Globe, Search } from 'lucide-react';
import type { Ad } from '@/lib/types';
import { CreativeMedia } from './CreativeMedia';
import { ActiveDot } from './AdBadges';
import { BrandLogo } from './BrandLogo';
import { AdMenu, ExpandableCopy } from './AdClient';
import FavButton from '@/components/FavButton';
import { metaAdLibraryUrl } from '@/lib/market/creatives';
import { flag } from '@/lib/format';
import { formatCount } from '@/lib/market-format';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function countryName(code: string): string {
  try { return code ? regionNames.of(code) ?? code : ''; } catch { return code; }
}

/** "Apr 1" (current year) or "Apr 1, 2025". */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  if (d.getUTCFullYear() !== new Date().getUTCFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

/**
 * The window the ad was observed running: start → last crawl sighting. "now"
 * only when that sighting is recent — an active flag from a crawl months ago
 * is not evidence the ad is running today.
 */
export function activePeriod(ad: Ad): { from: string; to: string } | null {
  if (!ad.startDate) return null;
  const seen = ad.lastSeenAt ? new Date(ad.lastSeenAt).getTime() : 0;
  const recent = ad.isActive && seen && Date.now() - seen < 3 * 86_400_000;
  return { from: shortDate(ad.startDate), to: recent ? 'now' : seen ? shortDate(ad.lastSeenAt) : '' };
}

export function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; }
}

/** Targeting strip: the country the index recorded, or an explicit "no data". */
function TargetingStrip({ country }: { country: string }) {
  if (!country) {
    return (
      <div className="flex h-8 items-center justify-center border-b border-border bg-foreground/[0.03] px-3 text-[11px] text-muted-foreground">
        No Targeting Data
      </div>
    );
  }
  return (
    <div className="flex h-8 items-center justify-between gap-2 border-b border-border bg-foreground/[0.03] px-3 text-[11px] font-medium text-foreground">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{countryName(country)}</span>
      </span>
      <span className="text-sm leading-none" title={countryName(country)}>{flag(country)}</span>
    </div>
  );
}

export function CreativeCard({ ad, saved }: { ad: Ad; saved: boolean }) {
  const period = activePeriod(ad);
  const destination = hostOf(ad.linkUrl) || ad.domain;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-foreground/20">
      <TargetingStrip country={ad.country} />

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {(ad.daysRunning > 0 || period) && (
          <div className="flex items-center gap-1.5 text-[11px] leading-tight">
            <ActiveDot isActive={ad.isActive} />
            <div className="min-w-0">
              {ad.daysRunning > 0 && <div className="font-semibold tabular-nums text-foreground">{ad.daysRunning}d</div>}
              {period && <div className="truncate text-muted-foreground">{period.from}{period.to && ` → ${period.to}`}</div>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <BrandLogo logo={ad.storeLogo} domain={ad.domain} name={ad.advertiser} size={32} />
          <div className="min-w-0 flex-1">
            {ad.shopId
              ? <Link href={`/shops/${ad.shopId}`} className="block truncate text-sm font-semibold text-foreground hover:underline">{ad.advertiser}</Link>
              : <span className="block truncate text-sm font-semibold text-foreground">{ad.advertiser}</span>}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {ad.adsRunning > 0 && (
                <span className="inline-flex items-center gap-1" title="Ads this advertiser was running when last crawled">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--trend-growth)]" />{formatCount(ad.adsRunning)} ads
                </span>
              )}
              {ad.country && <span title={countryName(ad.country)}>{flag(ad.country)}</span>}
              {ad.niche && <span className="truncate rounded border border-border px-1 py-px" title="Store niche">{ad.niche}</span>}
            </div>
          </div>
          <AdMenu adId={ad.id} shopId={ad.shopId} domain={ad.domain} libraryUrl={metaAdLibraryUrl(ad)} />
        </div>

        <ExpandableCopy text={ad.adCopy} className="min-h-[2.5rem]" />

        <Link href={`/ads/${ad.id}`} scroll={false} className="block overflow-hidden rounded-lg" aria-label={`Details of this ad by ${ad.advertiser}`}>
          <CreativeMedia image={ad.image} videoUrl={ad.videoUrl} watchUrl={ad.adLibraryVideoUrl}
            alt={ad.headline || `Ad by ${ad.advertiser}`} className="w-full" />
        </Link>

        {(destination || ad.headline) && (
          <div className="min-w-0 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
            {destination && <div className="truncate text-[11px] text-muted-foreground">{destination}</div>}
            {ad.headline && <div className="line-clamp-1 text-xs font-semibold text-foreground">{ad.headline}</div>}
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <FavButton type="ad" id={ad.id} initial={saved} label />
          <Link href={`/ads/${ad.id}`} scroll={false} className="btn-primary gap-1.5">
            See Details <Search className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
