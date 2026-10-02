'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { query, one } from '@/lib/db';
import { requireCtx, audit } from '@/lib/auth/guard';
import { revokeAllSessions, createSession } from '@/lib/auth/session';
import { resendVerification } from '@/lib/auth/actions';
import { randomToken, hashToken } from '@/lib/auth/tokens';
import { sendEmailChangeLink, mailConfigured } from '@/lib/mail';
import { rateLimit } from '@/lib/ratelimit';

export interface AccountState { error?: string; ok?: string }

export async function updateProfileAction(_prev: AccountState, form: FormData): Promise<AccountState> {
  const ctx = await requireCtx();
  const name = String(form.get('name') ?? '').trim().slice(0, 120);
  if (!name) return { error: 'Enter your name.' };
  await query('UPDATE users SET name = $2, updated_at = now() WHERE id = $1', [ctx.user.id, name]);
  await audit(ctx, 'account.profile_updated');
  revalidatePath('/settings/account');
  return { ok: 'Profile updated.' };
}

/** Revoke every session of this user, then re-establish this one. */
export async function signOutOtherDevicesAction(_prev: AccountState, _form: FormData): Promise<AccountState> {
  const ctx = await requireCtx();
  await revokeAllSessions(ctx.user.id);
  await createSession(ctx.user.id);
  await audit(ctx, 'account.sessions_revoked');
  return { ok: 'Every other device has been signed out.' };
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const CHANGE_MINUTES = 30;

/**
 * Change the sign-in address. With passwordless sign-in the account IS the
 * inbox, so the move takes two proofs (consumeMagicLinkAction): the CURRENT
 * address approves first — a stolen session cannot point sign-in at an inbox
 * the attacker owns — and then the NEW address confirms, so nobody can claim
 * an address they do not control. Taken addresses get the same generic
 * refusal signup gives.
 */
export async function changeEmailAction(_prev: AccountState, form: FormData): Promise<AccountState> {
  const ctx = await requireCtx();
  const limit = await rateLimit(`email-change:${ctx.user.id}`, 5, 3600);
  if (!limit.allowed) return { error: 'Too many attempts. Try again later.' };
  if (!mailConfigured()) return { error: 'Email delivery is unavailable right now, so the change cannot be confirmed.' };

  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  const email = parsed.data;
  if (email === ctx.user.email.toLowerCase()) return { error: 'That is already your email address.' };
  if (await one('SELECT 1 FROM users WHERE email_norm = $1', [email])) {
    return { error: 'That email address cannot be used.' };
  }

  const token = randomToken();
  await query(
    `INSERT INTO magic_links (token_hash, purpose, email, user_id, new_email, expires_at)
     VALUES ($1,'change_email',$2,$3,$4, now() + ($5 || ' minutes')::interval)`,
    [hashToken(token), ctx.user.email, ctx.user.id, email, String(CHANGE_MINUTES)],
  );
  await audit(ctx, 'account.email_change_requested', email, { from: ctx.user.email });
  try {
    await sendEmailChangeLink(ctx.user.email, email, token, CHANGE_MINUTES);
  } catch {
    return { error: 'We could not send the confirmation email. Try again in a minute.' };
  }
  return { ok: `Open the link we sent to ${ctx.user.email} to approve, then confirm from ${email}. Your address changes only after both.` };
}

export { resendVerification };

/** Hide the agent banner for this user on every device (dismiss or Copy). */
export async function dismissSkillBannerAction(): Promise<void> {
  const ctx = await requireCtx();
  await query('UPDATE users SET skill_banner_dismissed_at = COALESCE(skill_banner_dismissed_at, now()) WHERE id = $1', [ctx.user.id])
    .catch(() => { /* column not migrated yet: the cookie still hides it on this browser */ });
}
