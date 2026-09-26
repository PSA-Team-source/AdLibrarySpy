// The consent screen. A signed-in user grants a specific MCP client access to
// their workspace; the code is only issued after they click Authorize.
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { requireCtx } from '@/lib/auth/guard';
import { getClient, redirectAllowed, normalizeScopes } from '@/lib/mcp/oauth';
import { authorizeAction, denyAction } from './actions';
import { BrandMark } from '@/components/brand/brand-mark';

export const metadata = { title: 'Authorize access' };
export const dynamic = 'force-dynamic';

const SCOPE_TEXT: Record<string, string> = {
  'identity.read': 'See which workspace and plan you are on',
  'discovery.read': 'Search shops, ads and categories in the index',
  'brandtrackers.read': 'Read the brands you track and their recorded changes',
  'brandtrackers.write': 'Add and remove tracked brands',
};

export default async function AuthorizePage({ searchParams }: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const ctx = await requireCtx();

  const clientId = sp.client_id ?? '';
  const redirectUri = sp.redirect_uri ?? '';
  const state = sp.state ?? '';
  const challenge = sp.code_challenge ?? '';
  const method = sp.code_challenge_method ?? '';

  const client = clientId ? await getClient(clientId) : null;

  // Anything wrong with the client or redirect_uri is shown here rather than
  // redirected, because an unvalidated redirect_uri is exactly the attack.
  const fault =
    !client ? 'That application is not registered.'
    : !redirectUri ? 'The request is missing a redirect_uri.'
    : !redirectAllowed(client, redirectUri) ? 'The redirect_uri is not registered for this application.'
    : method !== 'S256' ? 'This server requires PKCE with code_challenge_method=S256.'
    : !challenge ? 'The request is missing a code_challenge.'
    : null;

  if (fault) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2">
            <BrandMark size={32} />
            <span className="text-lg font-semibold text-foreground">AdLibrarySpy</span>
          </div>
          <div role="alert" className="card p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-foreground">Cannot authorize</h1>
          <p className="mt-2 text-sm text-muted-foreground">{fault}</p>
          </div>
        </div>
      </div>
    );
  }

  const scopes = normalizeScopes(sp.scope);
  if (!scopes.length) redirect('/connect?error=no_scopes');
  const redirectHost = new URL(redirectUri).host;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md">
      <div className="mb-6 flex items-center gap-2">
        <BrandMark size={32} />
        <span className="text-lg font-semibold text-foreground">AdLibrarySpy</span>
      </div>
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-foreground">Authorize {client!.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <b className="font-medium text-foreground">{client!.name}</b> is asking to connect to your <b className="font-medium text-foreground">{ctx.workspaceName}</b> workspace
          as {ctx.user.email}.
        </p>
        {/* The name is whatever the app registered itself as; the redirect host
            is where the access actually goes, so that is what the user judges. */}
        <div role="note" className="alert-warning mt-4 space-y-1 px-4 py-3 text-sm">
          <p><b className="font-medium">Unverified app.</b> AdLibrarySpy has not reviewed {client!.name}; its name is self-declared.</p>
          <p>Access will be sent to <b className="font-medium break-all">{redirectHost}</b>. Only continue if you trust that address.</p>
        </div>

        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">It will be able to</div>
          <ul className="space-y-2 text-sm text-foreground">
            {scopes.map(s => (
              <li key={s} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--alert-success-icon)]" aria-hidden />
                <span>{SCOPE_TEXT[s] ?? s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex gap-2">
          <form action={authorizeAction} className="flex-1">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="code_challenge" value={challenge} />
            <input type="hidden" name="scope" value={scopes.join(' ')} />
            <button type="submit" className="btn-primary w-full">Authorize</button>
          </form>
          <form action={denyAction}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            <button type="submit" className="btn-ghost">Cancel</button>
          </form>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          You can revoke this at any time from Connect to AI in AdLibrarySpy.
        </p>
      </div>
      </div>
    </div>
  );
}
