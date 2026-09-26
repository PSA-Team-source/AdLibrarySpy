import { bandLabel, bandTone } from '@/lib/traffic/crux-bands';
import { cn } from '@/lib/utils';

/**
 * Chrome UX Report popularity band.
 *
 * CrUX publishes a magnitude band, not a position — "Top 100K" means the domain
 * sits somewhere in the 50,001–100,000 range. We show the band verbatim rather
 * than interpolate a rank Google does not publish.
 *
 * A domain with no band is one Chrome never saw enough real traffic for, which
 * is a meaningful negative signal, so it is stated rather than left blank.
 */
export function CruxBadge({ bucket, month, showUnranked = false, className }: {
  bucket: number | null; month?: string | null; showUnranked?: boolean; className?: string;
}) {
  if (bucket == null) {
    if (!showUnranked) return null;
    return (
      <span title="Chrome recorded too little real-user traffic to rank this domain"
        className={cn('inline-flex items-center rounded-full border border-border bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground', className)}>
        Unranked
      </span>
    );
  }
  const pretty = month ? `${month.slice(0, 4)}-${month.slice(4)}` : null;
  return (
    <span
      title={`Chrome UX Report: this domain is in the ${bandLabel(bucket).toLowerCase()} most-visited origins${pretty ? ` (${pretty})` : ''}`}
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', bandTone(bucket), className)}
    >
      {bandLabel(bucket)}
    </span>
  );
}
