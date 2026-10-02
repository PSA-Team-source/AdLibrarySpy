'use server';
// Auth server actions. Each returns a { error } object the form renders inline;
// none of them throw to the client, and none reveal whether an email exists.
import { defaultWorkspaceName } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { z } from 'zod';
import { query, one, tx } from '@/lib/db';
import { randomToken, hashToken } from './tokens';
import { newCode, hashCode, normalizeCode, CODE_TRIES } from './code';
import { createSession, destroySession, revokeAllSessions, currentUser } from './session';
import { sendVerificationEmail, sendMagicLinkEmail, sendNewEmailConfirmLink, mailConfigured } from '@/lib/mail';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { safeNext, inviteTokenFromNext } from './safe-next';
import { emit } from '@/lib/analytics/events';
import { verifyGoogleIdToken } from './google';
import { takeCode, createAccount, sendLoginCode, LINK_MINUTES, type LinkRow } from './signin-core';
import { sendRegistration, type SignupContext } from '@/lib/analytics/meta-capi';
import { SITE_URL } from '@/lib/public/site';
import { firstTouchRef } from '@/lib/public/ref';

/** `sentTo`: a sign-in email (link + code) went to this address; the form shows the code step. */
export interface FormState { error?: string; ok?: string; sentTo?: string }

const emailSchema = z.string().trim().toLowerCase().email().max(254);

async function limitOr(state: string, key: string, limit: number, windowSec: number): Promise<FormState | null> {
  const r = await rateLimit(key, limit, windowSec);
  if (r.allowed) return null;
  const mins = Math.max(1, Math.ceil((r.resetAt.getTime() - Date.now()) / 60000));
  return { error: `Too many ${state} attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` };
}

/** Printable ASCII only, clamped — for attribution values that come from the browser. */
function clean(v: string | undefined | null, max: number): string | null {
  if (!v) return null;
  let s = v;
  try { s = decodeURIComponent(v); } catch { /* keep raw */ }
  s = s.replace(/[^\x20-\x7e]/g, '').trim().slice(0, max);
  return s || null;
}

/** Meta click/browser ids + the browser that asked to sign up (lib/analytics/meta-capi.ts). */
async function signupContext(): Promise<SignupContext> {
  const c = await cookies(), h = await headers();
  return {
    fbc: clean(c.get('_fbc')?.value, 600), fbp: clean(c.get('_fbp')?.value, 100),
    ip: clientIp(h), ua: clean(h.get('user-agent'), 500),
  };
}

// ---------- passwordless sign-in (magic links) ----------
// Sign-in and signup are one flow: enter an email, get a
// one-time link AND a 6-digit code in the same email. The link opens /login/magic,
// a confirm page — mail scanners prefetch links, so nothing is consumed on GET —
// whose button consumes it; the code is typed on the page that asked for it
// (verifyEmailCodeAction), which keeps an in-app-browser visitor where they are.
// Both sit on one magic_links row, so either one used kills the other, and both
// end in signInFromLink: an existing account is signed in, a new address gets
// its account created. The response never says whether the address has an account.

const CHANGE_CONFIRM_MINUTES = 30;

export async function requestMagicLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const h = await headers();
  const ip = clientIp(h);
  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  const email = parsed.data;

  const limited = (await limitOr('sign-in', `magic:${ip}`, 10, 900))
              ?? (await limitOr('sign-in', `magic:${email}`, 5, 900));
  if (limited) return limited;
  if (!mailConfigured()) return { error: 'Email sign-in is temporarily unavailable. Try again shortly.' };

  const name = String(form.get('name') ?? '').trim().slice(0, 120) || null;
  const workspace = String(form.get('workspace') ?? '').trim().slice(0, 80) || null;
  const next = safeNext(form.get('next'));
  // First-touch attribution travels with the link, so it survives the email
  // being opened on another device.
  // No cookie yet (the form was sent before RefBeacon ran): the tagged landing page
  // is still in the same-site Referer; else the form's own placement (`home:hero`).
  const ref = clean((await cookies()).get('als_ref')?.value, 120)
    ?? firstTouchRef('/', new URLSearchParams(), h.get('referer'), h.get('x-forwarded-host') ?? h.get('host'))
    ?? clean(String(form.get('ref') ?? ''), 120);
  const landing = clean(String(form.get('landing') ?? ''), 300);
  // Only a new account needs the ad-click context; it is replayed when the link is used.
  const ad = await signupContext();

  const sent = await sendLoginCode(email, { name, workspace, next, ref, landing, ip, ad });
  if (!sent) return { error: 'We could not send the email. Try again in a minute.' };
  return { ok: `We sent a 6-digit code to ${email}. Enter it here, or open the link in the email. Both expire in ${LINK_MINUTES} minutes.`, sentTo: email };
}

/**
 * The code typed on the "check your email" screen. Guessing is capped three ways:
 * CODE_TRIES wrong tries void the code, 10 tries per address and 30 per IP per
 * 15 minutes (so at most 10 guesses in 10^6 per address per window, across resends).
 */
export async function verifyEmailCodeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(form.get('email'));
  const code = normalizeCode(form.get('code'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  const email = parsed.data;
  const again = { sentTo: email };
  if (!code) return { ...again, error: 'Enter the 6-digit code from the email.' };
  const ip = clientIp(await headers());
  const limited = (await limitOr('code', `code:${ip}`, 30, 900))
              ?? (await limitOr('code', `code:${email}`, 10, 900));
  if (limited) return { ...again, ...limited };

  const r = await takeCode(email, code);
  if (r.kind === 'none') return { ...again, error: 'This code no longer works: it expired, was already used, or a newer one was sent. Send a new code.' };
  if (r.kind === 'wrong') {
    return { ...again, error: r.left > 0
      ? `That code is not right. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`
      : 'That code is not right, and it is now void. Send a new code.' };
  }
  return signInFromLink(r.row, 'email_code');
}

/** Consume a link once (atomic). null = expired, already used or unknown. */
async function takeLink(token: string): Promise<LinkRow | null> {
  if (!token) return null;
  return one<LinkRow>(
    `UPDATE magic_links SET consumed_at = now()
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING id, purpose, email, user_id, new_email, name, workspace_name, next, ref, landing, ip, fbc, fbp, ua`,
    [hashToken(token)],
  );
}

export async function consumeMagicLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const row = await takeLink(String(form.get('token') ?? ''));
  if (!row) return { error: 'This link has expired or was already used. Request a new one.' };

  // Email change, step 1 of 2: the CURRENT inbox approved (so a stolen session
  // cannot move sign-in on its own). Nothing changes yet — the new address must
  // prove itself too, or an account could claim an inbox its owner never had.
  if (row.purpose === 'change_email') {
    if (!row.user_id || !row.new_email) return { error: 'This link is not valid.' };
    const still = await one('SELECT 1 FROM users WHERE id = $1 AND email_norm = lower($2)', [row.user_id, row.email]);
    if (!still) return { error: 'This link is no longer valid — the account address has changed since it was sent.' };
    if (await one('SELECT 1 FROM users WHERE email_norm = $1', [row.new_email])) return { error: 'That email address cannot be used.' };
    if (!mailConfigured()) return { error: 'Email delivery is unavailable right now. Try again shortly.' };
    const token = randomToken();
    await query(
      `INSERT INTO magic_links (token_hash, purpose, email, user_id, new_email, expires_at)
       VALUES ($1,'confirm_new_email',$2,$3,$2, now() + ($4 || ' minutes')::interval)`,
      [hashToken(token), row.new_email, row.user_id, String(CHANGE_CONFIRM_MINUTES)],
    );
    try {
      await sendNewEmailConfirmLink(row.new_email, token, CHANGE_CONFIRM_MINUTES);
    } catch (err) {
      console.error('[email-change] mail failed', err);
      return { error: 'We could not email the new address. Start the change again from Settings.' };
    }
    return { ok: `Approved. To finish, open the link we just sent to ${row.new_email}.` };
  }

  // Step 2 of 2: the NEW inbox confirmed. Uniqueness is re-checked here because
  // someone may have signed up with the address since step 1.
  if (row.purpose === 'confirm_new_email') {
    if (!row.user_id || !row.new_email) return { error: 'This link is not valid.' };
    if (await one('SELECT 1 FROM users WHERE email_norm = $1 AND id <> $2', [row.new_email, row.user_id])) {
      return { error: 'That email address cannot be used.' };
    }
    try {
      await query(
        // Clicking a link delivered to the new address proves it.
        'UPDATE users SET email = $2, email_verified_at = now(), updated_at = now() WHERE id = $1',
        [row.user_id, row.new_email],
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return { error: 'That email address cannot be used.' };
      throw e;
    }
    // Moving the sign-in address signs every device out; this one comes back in.
    await revokeAllSessions(row.user_id);
    await createSession(row.user_id);
    redirect('/settings/security?changed=1');
  }

  if (row.purpose !== 'login') return { error: 'This link is not valid.' };
  return signInFromLink(row, 'magic_link');
}

/** A consumed 'login' row (link or code): sign in, or create the account it asked for. */
async function signInFromLink(row: LinkRow, method: 'magic_link' | 'email_code'): Promise<FormState> {
  const user = await one<{ id: string }>('SELECT id FROM users WHERE email_norm = $1', [row.email]);
  let userId = user?.id;
  if (userId) {
    // A link or code delivered to the address proves it.
    await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [userId]);
  } else {
    userId = await createAccount({
      email: row.email, name: row.name, workspaceName: row.workspace_name,
      next: row.next, ref: row.ref, landing: row.landing, method,
      // The browser that asked for the link/code — for a link, not this one: that is where the ad was clicked.
      ad: { fbc: row.fbc, fbp: row.fbp, ip: row.ip, ua: row.ua },
    });
  }
  await createSession(userId);
  redirect(row.next ?? '/shops');
}

// ---------- Sign in with Google ----------
// The browser gets an ID token from Google Identity Services (button or One
// Tap, components/GoogleSignIn.tsx) and posts it here. Same account rules as a
// magic link: an existing account is signed in, a new address gets its account
// (and workspace, or its pending invitation) on the same path.

/** The OAuth client id; unset = Google sign-in is not offered at all. */
export async function googleClientId(): Promise<string | null> {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

export async function googleSignInAction(
  credential: string, nextRaw: string | null, landingRaw: string | null,
): Promise<FormState> {
  const clientId = await googleClientId();
  if (!clientId) return { error: 'Google sign-in is not available.' };
  const ip = clientIp(await headers());
  const limited = await limitOr('sign-in', `google:${ip}`, 20, 900);
  if (limited) return limited;

  let who;
  try {
    who = await verifyGoogleIdToken(String(credential ?? ''), clientId);
  } catch (err) {
    console.error('[google] verify failed', err);
    return { error: 'Google sign-in is unavailable right now. Use the email link instead.' };
  }
  if (!who) return { error: 'Google could not confirm this account. Try again, or use the email link.' };

  const next = safeNext(nextRaw);
  // Google account id first; else the verified address, which records the id.
  const user = await one<{ id: string; google_sub: string | null }>(
    `SELECT id, google_sub FROM users WHERE google_sub = $1 OR email_norm = $2
      ORDER BY (google_sub = $1) DESC NULLS LAST LIMIT 1`,
    [who.sub, who.email],
  );
  let userId = user?.id;
  if (userId) {
    await query(
      `UPDATE users SET google_sub = COALESCE(google_sub, $2),
              email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1`,
      [userId, who.sub],
    );
  } else {
    userId = await createAccount({
      email: who.email, name: who.name, workspaceName: null, next,
      ref: clean((await cookies()).get('als_ref')?.value, 120),
      landing: clean(landingRaw ?? '', 300), googleSub: who.sub, method: 'google',
      ad: await signupContext(),
    });
  }
  await createSession(userId);
  redirect(next ?? '/shops');
}

// ---------- logout ----------
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}

// ---------- email verification ----------
export async function verifyEmailToken(token: string): Promise<boolean> {
  const row = await one<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM user_tokens
      WHERE token_hash=$1 AND purpose='verify_email' AND consumed_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return false;
  await tx(async (c) => {
    await c.query('UPDATE user_tokens SET consumed_at = now() WHERE id = $1', [row.id]);
    await c.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [row.user_id]);
  });
  return true;
}

export async function resendVerification(): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in first.' };
  if (user.emailVerifiedAt) return { ok: 'Your address is already confirmed.' };
  const limited = await limitOr('verification', `verify:${user.id}`, 3, 3600);
  if (limited) return limited;
  if (!mailConfigured()) return { error: 'Email delivery is not configured.' };

  const token = randomToken();
  await query(
    `INSERT INTO user_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1,'verify_email',$2, now() + interval '24 hours')`,
    [user.id, hashToken(token)],
  );
  try {
    await sendVerificationEmail(user.email, token);
    return { ok: 'Confirmation email sent.' };
  } catch {
    return { error: 'Could not send the email. Try again shortly.' };
  }
}
