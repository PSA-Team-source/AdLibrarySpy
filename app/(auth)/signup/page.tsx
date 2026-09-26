import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requestMagicLinkAction } from '@/lib/auth/actions';
import { currentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/safe-next';
import { AuthFormShell, Field } from '@/components/AuthForm';

export const metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

/** The page the visitor came to /signup from: a same-site path, or the external host. */
function landingFrom(referer: string | null, host: string | null): string {
  if (!referer) return '';
  try {
    const u = new URL(referer);
    if (host && u.host === host) return u.pathname === '/signup' ? '' : u.pathname;
    return u.hostname;
  } catch { return ''; }
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? '/shops');
  const h = await headers();
  const landing = landingFrom(h.get('referer'), h.get('x-forwarded-host') ?? h.get('host'));
  const invited = next?.startsWith('/invite?');
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {invited
          ? 'Use the email address the invitation was sent to and you will join the workspace right away.'
          : 'Free for everyone — no card, no trial, no limits. Join teams finding winning ads and fast-growing shops.'}
      </p>
      <AuthFormShell action={requestMagicLinkAction} submitLabel="Create my free account" pendingLabel="Sending…">
        {next && <input type="hidden" name="next" value={next} />}
        {landing && <input type="hidden" name="landing" value={landing} />}
        <Field label="Your name" name="name" autoComplete="name" required={false} />
        <Field label="Work email" name="email" type="email" autoComplete="email" />
        {!invited && <Field label="Workspace name" name="workspace" required={false} hint="You can rename this later." />}
        <p className="text-xs text-muted-foreground">No password: we email you a link to confirm your address and sign in.</p>
      </AuthFormShell>
      <p className="mt-6 text-sm text-muted-foreground">
        Already registered? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-foreground font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
