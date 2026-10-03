import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCtx } from '@/lib/auth/guard';
import { PageShell } from '@/components/layouts/page-shell';
import { SectionCard } from '@/components/ui/section-card';
import { getWinnerDay, nichesOn, winnerDays } from '@/lib/alerts/winners';
import { dayRange, winnersPath, winnersTitle } from '@/lib/alerts/digest';
import { WinnerImage } from './winner-image';

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayWords = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${M[m - 1]} ${dd}, ${y}`; };

/**
 * One day's "Today's 10 winners" (the list the daily email carried, from
 * winner_days) plus the archive of past days. day = null → the newest day.
 */
export async function WinnersDay({ day, niche }: { day: string | null; niche: string | null }) {
  await requireCtx();
  const days = await winnerDays(60);
  const current = day ?? days[0]?.day ?? null;
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const [items, niches] = current
    ? await Promise.all([getWinnerDay(current, niche), nichesOn(current)])
    : [null, [] as string[]];
  if (day && !items) notFound();
  const chip = 'rounded-full border px-3 py-1 text-xs whitespace-nowrap';

  return (
    <PageShell title="Daily winners" description="Every day, the 10 Shopify products that got the most new Meta ads in the last two days, one per store. The same list goes out in the daily email.">
      {!current || !items ? (
        <SectionCard title="No list yet" padded>
          <p className="text-sm text-muted-foreground">The first list is made with the next daily email.</p>
        </SectionCard>
      ) : (
        <SectionCard
          title={`${dayWords(current)}${niche ? ` · ${niche}` : ''}`}
          description={items[0] ? `${winnersTitle(items.length).replace("Today's", 'The')}, ranked by new Meta ads started ${dayRange(items[0].from, items[0].to)} (UTC).` : undefined}
          padded
        >
          {niches.length > 0 && (
            <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Niche">
              {[null, ...niches].map(n => (
                <Link key={n ?? ''} href={winnersPath(current, n)} aria-current={n === niche ? 'page' : undefined}
                  className={`${chip} ${n === niche ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {n ?? 'All niches'}
                </Link>
              ))}
            </nav>
          )}
          <ol className="divide-y divide-border">
            {items.map((p, i) => (
              <li key={`${p.shopId}-${i}`} className="flex items-center gap-3 py-3">
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                {p.image && <WinnerImage src={p.image} />}
                <span className="min-w-0 flex-1">
                  <Link href={`/shops/${encodeURIComponent(p.shopId)}`} className="line-clamp-2 text-sm font-medium text-foreground hover:underline">{p.title}</Link>
                  <span className="block truncate text-xs text-muted-foreground">{p.storeName} · {p.domain}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{p.newAds.toLocaleString('en-US')}</span>
                  <span className="block text-xs text-muted-foreground">new ads</span>
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}
      {days.length > 1 && (
        <SectionCard title="Past days" padded>
          <ul className="divide-y divide-border">
            {days.map(d => (
              <li key={d.day}>
                <Link href={winnersPath(d.day, null)} aria-current={d.day === current ? 'page' : undefined}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline">
                  <span className={d.day === current ? 'font-semibold text-foreground' : 'text-foreground'}>{dayWords(d.day)}</span>
                  {d.top && <span className="min-w-0 truncate text-xs text-muted-foreground">No. 1: {d.top.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </PageShell>
  );
}
