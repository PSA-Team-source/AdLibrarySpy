'use server';
import { redirect } from 'next/navigation';
import { requireCtx, audit } from '@/lib/auth/guard';
import { getClient, redirectAllowed, issueCode, normalizeScopes } from '@/lib/mcp/oauth';

export async function authorizeAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const clientId = String(form.get('client_id') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  const state = String(form.get('state') ?? '');
  const challenge = String(form.get('code_challenge') ?? '');
  const scopes = normalizeScopes(String(form.get('scope') ?? ''));

  // Re-validate on submit: the hidden fields are attacker-controllable.
  const client = await getClient(clientId);
  if (!client || !redirectAllowed(client, redirectUri) || !challenge || !scopes.length) {
    redirect('/connect?error=invalid_request');
  }

  const code = await issueCode({
    clientId, userId: ctx.user.id, workspaceId: ctx.workspaceId,
    redirectUri, scopes, codeChallenge: challenge,
  });
  await audit(ctx, 'oauth.authorized', clientId, { scopes });

  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  redirect(url.toString());
}

export async function denyAction(form: FormData): Promise<void> {
  await requireCtx();
  const clientId = String(form.get('client_id') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  const state = String(form.get('state') ?? '');
  // Same check as authorize: without it Cancel is an open redirect to any URL.
  const client = clientId ? await getClient(clientId) : null;
  if (!client || !redirectAllowed(client, redirectUri)) redirect('/connect');
  const url = new URL(redirectUri);
  url.searchParams.set('error', 'access_denied');
  if (state) url.searchParams.set('state', state);
  redirect(url.toString());
}
