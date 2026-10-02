'use server';
// "Email me a sign-in link" for a user signed in inside a social app's browser:
// the session lives only in that webview, so the link (opened from their mail app,
// i.e. their real browser) signs them in there too. Same flow as /login.
import { headers } from 'next/headers';
import { requireCtx } from '@/lib/auth/guard';
import { sendLoginCode } from '@/lib/auth/signin-core';
import { mailConfigured } from '@/lib/mail';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function emailBrowserLinkAction(): Promise<{ ok?: string; error?: string }> {
  const ctx = await requireCtx();
  const ip = clientIp(await headers());
  const r = await rateLimit(`browser-link:${ctx.user.id}`, 3, 900);
  if (!r.allowed) return { error: 'We already sent a few. Check your inbox, or try again in 15 minutes.' };
  if (!mailConfigured()) return { error: 'Email is unavailable right now. Try again shortly.' };
  const sent = await sendLoginCode(ctx.user.email, { next: '/home', ip }).catch(() => false);
  return sent
    ? { ok: `Sent to ${ctx.user.email}. Open the email in your phone's mail app and tap Sign in.` }
    : { error: 'We could not send the email. Try again in a minute.' };
}
