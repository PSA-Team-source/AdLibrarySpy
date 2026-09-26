import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requestMagicLinkAction } from '@/lib/auth/actions';
import { currentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/safe-next';
import { AuthFormShell, Field } from '@/components/AuthForm';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

// Passwordless: enter your email, open the one-time link we send. A new address
// gets its account on the same path, so there is no "wrong page" to be on.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? '/shops');
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Sign in to AdLibrarySpy</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">We&apos;ll email you a one-time sign-in link. No password needed.</p>
      <AuthFormShell action={requestMagicLinkAction} submitLabel="Email me a sign-in link" pendingLabel="Sending…">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email" name="email" type="email" autoComplete="email" />
      </AuthFormShell>
      <p className="mt-6 text-sm text-muted-foreground">
        New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-medium text-foreground hover:underline">Create a free account</Link>
      </p>
    </>
  );
}
