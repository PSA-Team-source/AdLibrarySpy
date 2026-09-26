import Link from 'next/link';
import { verifyEmailToken } from '@/lib/auth/actions';

export const metadata = { title: 'Confirm your email' };
export const dynamic = 'force-dynamic';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmailToken(token) : false;
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">{ok ? 'Email confirmed' : 'Link not valid'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {ok
          ? 'Thanks — your address is confirmed.'
          : 'This confirmation link has expired or has already been used. You can request a new one from your account.'}
      </p>
      <p className="mt-6 text-sm">
        <Link href="/shops" className="text-foreground font-medium hover:underline">Go to the app</Link>
      </p>
    </>
  );
}
