'use server';
// Auth server actions. Each returns a { error } object the form renders inline;
// none of them throw to the client, and none reveal whether an email exists.
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { z } from 'zod';
import { query, one, tx } from '@/lib/db';
import { randomToken, hashToken } from './tokens';
import { createSession, destroySession, revokeAllSessions, currentUser } from './session';
import { sendVerificationEmail, sendMagicLinkEmail, sendNewEmailConfirmLink, mailConfigured } from '@/lib/mail';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { safeNext, inviteTokenFromNext } from './safe-next';
import { emit } from '@/lib/analytics/events';

export interface FormState { error?: string; ok?: string }

const emailSchema = z.string().trim().toLowerCase().email().max(254);

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return base || 'workspace';
}

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

// ---------- passwordless sign-in (magic links) ----------
// Sign-in and signup are one flow: enter an email, get a
// one-time link. The link opens /login/magic, a confirm page — mail scanners
// prefetch links, so nothing is consumed on GET — whose button consumes it:
// an existing account is signed in, a new address gets its account created.
// The response never says whether the address has an account.

const LINK_MINUTES = 20;
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
  const ref = clean((await cookies()).get('als_ref')?.value, 120);
  const landing = clean(String(form.get('landing') ?? ''), 300);

  const existing = await one<{ id: string }>('SELECT id FROM users WHERE email_norm = $1', [email]);
  const token = randomToken();
  await query(
    `INSERT INTO magic_links (token_hash, purpose, email, user_id, name, workspace_name, next, ref, landing, ip, expires_at)
     VALUES ($1,'login',$2,$3,$4,$5,$6,$7,$8,$9, now() + ($10 || ' minutes')::interval)`,
    [hashToken(token), email, existing?.id ?? null, name, workspace, next, ref, landing, ip, String(LINK_MINUTES)],
  );
  try {
    await sendMagicLinkEmail(email, token, { newAccount: !existing, minutes: LINK_MINUTES });
  } catch (err) {
    console.error('[magic] mail failed', err);
    return { error: 'We could not send the email. Try again in a minute.' };
  }
  return { ok: `Check ${email} — we sent a sign-in link. It works once and expires in ${LINK_MINUTES} minutes.` };
}

interface LinkRow {
  id: string; purpose: 'login' | 'change_email' | 'confirm_new_email'; email: string; user_id: string | null; new_email: string | null;
  name: string | null; workspace_name: string | null; next: string | null; ref: string | null; landing: string | null;
}

/** Consume a link once (atomic). null = expired, already used or unknown. */
async function takeLink(token: string): Promise<LinkRow | null> {
  if (!token) return null;
  return one<LinkRow>(
    `UPDATE magic_links SET consumed_at = now()
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING id, purpose, email, user_id, new_email, name, workspace_name, next, ref, landing`,
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

  const user = await one<{ id: string }>('SELECT id FROM users WHERE email_norm = $1', [row.email]);
  let userId = user?.id;
  if (userId) {
    // Clicking a link delivered to the address proves it.
    await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [userId]);
  } else {
    userId = await createAccount({
      email: row.email, name: row.name, workspaceName: row.workspace_name,
      next: row.next, ref: row.ref, landing: row.landing,
    });
  }
  await createSession(userId);
  redirect(row.next ?? '/shops');
}

/**
 * Create the user (email already proven by the link) and their workspace — or,
 * when they came from an invitation for this address, join that workspace
 * instead (the app opens the oldest membership, so a personal workspace would
 * hide the team).
 */
async function createAccount(a: {
  email: string; name: string | null; workspaceName: string | null;
  next: string | null; ref: string | null; landing: string | null;
}): Promise<string> {
  const name = a.name || a.email.split('@')[0].slice(0, 120);
  const workspaceName = a.workspaceName || `${name}'s workspace`;
  const inviteToken = inviteTokenFromNext(a.next);
  const invite = inviteToken ? await one<{ id: string; workspace_id: string; role: string }>(
    `SELECT id, workspace_id, role FROM invitations
      WHERE token_hash = $1 AND lower(email) = $2
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
    [hashToken(inviteToken), a.email],
  ) : null;
  const ref = invite ? `invite:${invite.workspace_id}` : a.ref;

  const { userId, workspaceId } = await tx(async (c) => {
    const u = await c.query<{ id: string }>(
      `INSERT INTO users (email, name, signup_ref, signup_landing, email_verified_at)
       VALUES ($1,$2,$3,$4, now()) RETURNING id`,
      [a.email, name, ref, a.landing],
    );
    const uid = u.rows[0].id;

    if (invite) {
      await c.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,$3)
         ON CONFLICT (workspace_id, user_id) DO NOTHING`,
        [invite.workspace_id, uid, invite.role],
      );
      await c.query('UPDATE invitations SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL', [invite.id]);
      return { userId: uid, workspaceId: invite.workspace_id };
    }

    // Unique slug: append a short suffix on collision rather than failing signup.
    let slug = slugify(workspaceName);
    for (let i = 0; i < 5; i++) {
      const clash = await c.query('SELECT 1 FROM workspaces WHERE slug = $1', [slug]);
      if (!clash.rowCount) break;
      slug = `${slugify(workspaceName)}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)}`;
    }
    const w = await c.query<{ id: string }>(
      'INSERT INTO workspaces (name, slug, owner_user_id) VALUES ($1,$2,$3) RETURNING id',
      [workspaceName, slug, uid],
    );
    await c.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,'owner')`, [w.rows[0].id, uid]);
    return { userId: uid, workspaceId: w.rows[0].id };
  });

  emit('signup', userId, { workspaceId, ref, props: { landing: a.landing, invited: !!invite, first_touch: a.ref, method: 'magic_link' } });
  if (invite) emit('invite_accepted', userId, { workspaceId, ref, props: { new_user: true, invitation_id: invite.id } });
  return userId;
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
