import Link from 'next/link';
import { requireCtx } from '@/lib/auth/guard';
import { one } from '@/lib/db';
import { SectionCard } from '@/components/ui/section-card';
import { NewsletterForm } from './NewsletterForm';

export const metadata = { title: 'Newsletter' };
export const dynamic = 'force-dynamic';

export default async function NewsletterPage() {
  const ctx = await requireCtx();
  const row = await one<{ active: boolean }>(
    'SELECT unsubscribed_at IS NULL AS active FROM newsletter_subscribers WHERE user_id = $1',
    [ctx.user.id],
  );
  const subscribed = !!row?.active;
  return (
    <SectionCard title="Newsletter" description="The Monday report, by email." className="max-w-xl" bodyClassName="space-y-5">
      <NewsletterForm subscribed={subscribed} />
      {subscribed && !ctx.user.emailVerifiedAt && (
        <p role="status" className="alert-warning px-4 py-3 text-sm">
          The report is only sent to confirmed addresses. Confirm {ctx.user.email} from <Link href="/settings/account" className="underline underline-offset-2">Account Settings</Link>.
        </p>
      )}
      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        Sent to {ctx.user.email}. Read the latest issue any time at <Link href="/weekly" className="font-medium text-foreground underline underline-offset-2">/weekly</Link>.
      </p>
    </SectionCard>
  );
}
