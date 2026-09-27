import Link from 'next/link';
import { redirect } from 'next/navigation';
import { googleClientId } from '@/lib/auth/actions';
import { currentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/safe-next';
import { Field } from '@/components/AuthForm';
import { EmailSignIn } from '@/components/EmailSignIn';
import { GoogleSignIn } from '@/components/GoogleSignIn';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

// Passwordless: enter your email, then the 6-digit code we send (or open its link). A new address
// gets its account on the same path, so there is no "wrong page" to be on.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next ?? '/shops');
  const google = await googleClientId();
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Sign in to AdLibrarySpy</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {google ? 'Continue with Google, or get a one-time code by email.' : 'We\u2019ll email you a one-time code.'} No password needed.
      </p>
      {google && <GoogleSignIn clientId={google} next={next} context="signin" />}
      <EmailSignIn submitLabel="Email me a sign-in code" pendingLabel="Sending…">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email" name="email" type="email" autoComplete="email" />
      </EmailSignIn>
      <p className="mt-6 text-sm text-muted-foreground">
        New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-medium text-foreground hover:underline">Create a free account</Link>
      </p>
    </>
  );
}
