import Link from 'next/link';
import { acceptInvite } from '@/lib/workspace';

export const metadata = { title: 'Join a workspace' };
export const dynamic = 'force-dynamic';

const MESSAGE: Record<string, string> = {
  sign_in: 'Sign in (or create an account with the invited address) to accept this invitation.',
  invalid: 'This invitation has expired, been revoked, or was already used.',
  wrong_account: 'This invitation was sent to a different email address. Sign out and sign in with the invited address.',
};

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result: Awaited<ReturnType<typeof acceptInvite>> = token ? await acceptInvite(token) : { ok: false, reason: 'invalid' };

  if (result.ok) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-foreground">You&apos;re in</h1>
        <p className="mt-2 text-sm text-muted-foreground">You now have access to {result.workspace}.</p>
        {/* Switches the active workspace to the team's, then opens Shops. */}
        <form method="post" action="/api/workspace/switch" className="mt-6">
          <input type="hidden" name="to" value={result.workspaceId ?? ''} />
          <input type="hidden" name="next" value="/shops" />
          <button type="submit" className="btn-primary">Open {result.workspace}</button>
        </form>
      </>
    );
  }

  // Both paths come back here (login) or accept during signup, keeping the token.
  const back = encodeURIComponent(`/invite?token=${encodeURIComponent(token ?? '')}`);
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">{MESSAGE[result.reason ?? 'invalid']}</p>
      <div className="mt-6 flex gap-2">
        <Link href={`/login?next=${back}`} className="btn-primary">Sign in</Link>
        <Link href={`/signup?next=${back}`} className="btn-ghost">Create an account</Link>
      </div>
    </>
  );
}
