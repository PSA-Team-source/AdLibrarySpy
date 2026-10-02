import Link from 'next/link';
import { one } from '@/lib/db';
import { hashToken } from '@/lib/auth/tokens';
import { consumeMagicLinkAction } from '@/lib/auth/actions';
import { AuthFormShell } from '@/components/AuthForm';
import { AutoSubmit } from '@/components/AutoSubmit';

export const metadata = { title: 'Confirm sign-in' };
export const dynamic = 'force-dynamic';

// Landing page of every emailed link. It only READS the link: mail scanners and
// link previews fetch URLs, so the one-time link is consumed by the button
// (consumeMagicLinkAction), never by the server render. Sign-in links submit
// themselves in the browser (AutoSubmit); email-change links wait for a click.
export default async function MagicLinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = String((await searchParams).token ?? '');
  const row = token ? await one<{ purpose: 'login' | 'change_email' | 'confirm_new_email'; email: string; new_email: string | null; user_id: string | null }>(
    `SELECT purpose, email, new_email, user_id FROM magic_links
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  ) : null;

  if (!row) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-foreground">This link has expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign-in links work once and expire after a short time. Request a new one — it only takes a moment.</p>
        <Link href="/login" className="btn-primary mt-6 w-full justify-center">Get a new sign-in link</Link>
      </>
    );
  }

  const approve = row.purpose === 'change_email';
  const confirm = row.purpose === 'confirm_new_email';
  // Whether the account exists NOW (it may have been created since the link was sent).
  const isNew = !approve && !confirm && !(await one('SELECT 1 FROM users WHERE email_norm = $1', [row.email.toLowerCase()]));
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">
        {approve ? 'Approve the email change' : confirm ? 'Confirm your new email' : isNew ? 'Create your account' : 'Sign in to AdLibrarySpy'}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {approve
          ? <>Move this account&apos;s sign-in address from <b className="text-foreground">{row.email}</b> to <b className="text-foreground">{row.new_email}</b>. We will then ask the new address to confirm.</>
          : confirm
            ? <>Make <b className="text-foreground">{row.new_email}</b> this account&apos;s sign-in address.</>
            : <>Continue as <b className="text-foreground">{row.email}</b>.</>}
      </p>
      <AuthFormShell action={consumeMagicLinkAction}
        submitLabel={approve ? 'Approve the change' : confirm ? 'Confirm this address' : isNew ? 'Create my free account' : 'Sign in'} pendingLabel="One moment…">
        <input type="hidden" name="token" value={token} />
        {!approve && !confirm && <AutoSubmit />}
      </AuthFormShell>
    </>
  );
}
