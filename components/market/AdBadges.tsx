import { cn } from '@/lib/utils';

/**
 * Meta's own creative taxonomy. DCO and DPA are the interesting ones: they mean
 * the advertiser is running dynamic creative or a product feed, i.e. testing at
 * scale rather than shipping one static asset.
 */
const FORMAT_LABEL: Record<string, { label: string; hint: string; tone: string }> = {
  dco:      { label: 'DCO',      hint: 'Dynamic Creative Optimisation — Meta is auto-assembling variants', tone: 'bg-purple-500/15 text-purple-600 dark:text-purple-300' },
  dpa:      { label: 'DPA',      hint: 'Dynamic Product Ad — generated from the catalogue feed',           tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
  carousel: { label: 'Carousel', hint: 'Multi-card carousel creative',                                     tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  video:    { label: 'Video',    hint: 'Single video creative',                                            tone: 'bg-muted text-muted-foreground' },
  image:    { label: 'Image',    hint: 'Single image creative',                                            tone: 'bg-muted text-muted-foreground' },
};

export function FormatBadge({ format }: { format: string }) {
  const f = FORMAT_LABEL[format];
  if (!f) return null;
  return (
    <span title={f.hint} className={cn('inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-[10px] font-semibold', f.tone)}>
      {f.label}
    </span>
  );
}

const PLACEMENT_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
  threads: 'Threads',
  audience_network: 'Audience Network',
};

export function placementLabel(p: string): string {
  return PLACEMENT_LABEL[p] ?? p.replace(/_/g, ' ');
}

/** Where the ad is eligible to be shown. 100% filled in the index. */
export function PlacementChips({ placements, max = 3 }: { placements: string[]; max?: number }) {
  if (!placements.length) return null;
  const shown = placements.slice(0, max);
  const rest = placements.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map(p => (
        <span key={p} className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {placementLabel(p)}
        </span>
      ))}
      {rest > 0 && (
        <span title={placements.slice(max).map(placementLabel).join(', ')}
          className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">+{rest}</span>
      )}
    </span>
  );
}

export function ActiveDot({ isActive }: { isActive: boolean }) {
  return (
    <span
      title={isActive ? 'Still running when last crawled' : 'No longer running'}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', isActive ? 'bg-[var(--trend-growth)]' : 'bg-muted-foreground/40')}
    />
  );
}
