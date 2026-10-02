import Link from 'next/link';
import { requireCtx } from '@/lib/auth/guard';
import { one } from '@/lib/db';
import { SectionCard } from '@/components/ui/section-card';
import { DEFAULT_FREQUENCY, isFrequency } from '@/lib/alerts/digest';
import { NotificationsForm } from './NotificationsForm';
import { NewsletterForm } from '../newsletter/NewsletterForm';

export const metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const ctx = await requireCtx();
  const [row, weekly] = await Promise.all([
    one<{ frequency: string; trackers: boolean; searches: boolean; market: boolean }>(
      'SELECT frequency, trackers, searches, market FROM alert_prefs WHERE user_id = $1',
      [ctx.user.id],
    ),
    one<{ active: boolean }>('SELECT unsubscribed_at IS NULL AS active FROM newsletter_subscribers WHERE user_id = $1', [ctx.user.id]),
  ]);
  return (
    <div className="space-y-6">
    <SectionCard title="Weekly report" description="One email every Monday. Off until you turn it on." className="max-w-xl">
      <NewsletterForm subscribed={!!weekly?.active} />
    </SectionCard>
    <SectionCard title="Alert emails" description="Brandtracker changes, new saved-search results and the day's biggest ad movers, in one digest." className="max-w-xl" bodyClassName="space-y-5">
      <NotificationsForm
        frequency={row && isFrequency(row.frequency) ? row.frequency : DEFAULT_FREQUENCY}
        trackers={row?.trackers ?? true}
        searches={row?.searches ?? true}
        market={row?.market ?? true}
      />
      {!ctx.user.emailVerifiedAt && (
        <p role="status" className="alert-warning px-4 py-3 text-sm">
          Alerts are only sent to confirmed addresses. Confirm {ctx.user.email} from <Link href="/settings/account" className="underline underline-offset-2">Account Settings</Link>.
        </p>
      )}
      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        Sent to {ctx.user.email}. Manage what is watched in <Link href="/brandtracker" className="font-medium text-foreground underline underline-offset-2">Brandtracker</Link> and <Link href="/searches" className="font-medium text-foreground underline underline-offset-2">Saved searches</Link>.
      </p>
    </SectionCard>
    </div>
  );
}
