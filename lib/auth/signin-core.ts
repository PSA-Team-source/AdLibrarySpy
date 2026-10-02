// Sign-in core shared by the browser forms (actions.ts, 'use server') and the
// agent endpoints (app/api/agent/*). Not a server-action module on purpose:
// nothing here may be callable from the browser on its own.
import { query, one, tx } from '@/lib/db';
import { defaultWorkspaceName } from '@/lib/utils';
import { randomToken, hashToken } from './tokens';
import { newCode, hashCode, CODE_TRIES } from './code';
import { inviteTokenFromNext } from './safe-next';
import { sendMagicLinkEmail } from '@/lib/mail';
import { emit } from '@/lib/analytics/events';
import { sendRegistration, type SignupContext } from '@/lib/analytics/meta-capi';
import { SITE_URL } from '@/lib/public/site';

/** Link and code share one expiry; short, because a 6-digit code is guessable. */
export const LINK_MINUTES = 15;

export interface LinkRow {
  id: string; purpose: 'login' | 'change_email' | 'confirm_new_email'; email: string; user_id: string | null; new_email: string | null;
  name: string | null; workspace_name: string | null; next: string | null; ref: string | null; landing: string | null;
  ip: string | null; fbc: string | null; fbp: string | null; ua: string | null;
}

/** Issue a login link + 6-digit code for `email` and mail it. false = the mail failed. */
export async function sendLoginCode(email: string, o: {
  name?: string | null; workspace?: string | null; next?: string | null; ref?: string | null;
  landing?: string | null; ip: string; ad?: SignupContext;
}): Promise<boolean> {
  const { name = null, workspace = null, next = null, ref = null, landing = null, ip } = o;
  const ad: SignupContext = o.ad ?? { fbc: null, fbp: null, ip, ua: null };
  const existing = await one<{ id: string }>('SELECT id FROM users WHERE email_norm = $1', [email]);
  const token = randomToken();
  const code = newCode();
  await tx(async (c) => {
    // Only the newest code counts ("use the code in the latest email"), so a resend
    // never multiplies the guesses an attacker gets. Older links keep working.
    await c.query(
      `UPDATE magic_links SET code_hash = NULL
        WHERE purpose = 'login' AND lower(email) = $1 AND code_hash IS NOT NULL AND consumed_at IS NULL`,
      [email],
    );
    await c.query(
      `INSERT INTO magic_links (token_hash, code_hash, purpose, email, user_id, name, workspace_name, next, ref, landing, ip, fbc, fbp, ua, expires_at)
       VALUES ($1,$2,'login',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now() + ($14 || ' minutes')::interval)`,
      [hashToken(token), hashCode(email, code), email, existing?.id ?? null, name, workspace, next, ref, landing, ip,
       existing ? null : ad.fbc, existing ? null : ad.fbp, existing ? null : ad.ua, String(LINK_MINUTES)],
    );
  });
  try {
    await sendMagicLinkEmail(email, token, { newAccount: !existing, minutes: LINK_MINUTES, code });
  } catch (err) {
    console.error('[magic] mail failed', err);
    return false;
  }
  return true;
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return base || 'workspace';
}

type CodeResult = { kind: 'ok'; row: LinkRow } | { kind: 'wrong'; left: number } | { kind: 'none' };

/**
 * One atomic statement against the address's newest live code: a match consumes
 * the row (the link dies with it); a miss counts, and the CODE_TRIES-th miss voids it.
 */
export async function takeCode(email: string, code: string): Promise<CodeResult> {
  const r = await one<LinkRow & { ok: boolean; code_attempts: number }>(
    `WITH cur AS (
       SELECT id FROM magic_links
        WHERE purpose = 'login' AND lower(email) = $1 AND code_hash IS NOT NULL
          AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1
        FOR UPDATE)
     UPDATE magic_links m SET
       consumed_at   = CASE WHEN m.code_hash = $2 THEN now() END,
       code_attempts = m.code_attempts + CASE WHEN m.code_hash = $2 THEN 0 ELSE 1 END,
       code_hash     = CASE WHEN m.code_hash <> $2 AND m.code_attempts + 1 >= $3 THEN NULL ELSE m.code_hash END
       FROM cur WHERE m.id = cur.id
     RETURNING (m.consumed_at IS NOT NULL) AS ok, m.code_attempts,
               m.id, m.purpose, m.email, m.user_id, m.new_email, m.name, m.workspace_name, m.next, m.ref, m.landing, m.ip, m.fbc, m.fbp, m.ua`,
    [email, hashCode(email, code), CODE_TRIES],
  );
  if (!r) return { kind: 'none' };
  if (!r.ok) return { kind: 'wrong', left: Math.max(0, CODE_TRIES - r.code_attempts) };
  return { kind: 'ok', row: r };
}

/**
 * Create the user (email already proven by the link) and their workspace — or,
 * when they came from an invitation for this address, join that workspace
 * instead (the app opens the oldest membership, so a personal workspace would
 * hide the team).
 */
export async function createAccount(a: {
  email: string; name: string | null; workspaceName: string | null;
  next: string | null; ref: string | null; landing: string | null;
  googleSub?: string; method?: 'magic_link' | 'email_code' | 'google'; ad?: SignupContext;
}): Promise<string> {
  const name = a.name || a.email.split('@')[0].slice(0, 120);
  const workspaceName = a.workspaceName || defaultWorkspaceName(a.name, a.email);
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
      `INSERT INTO users (email, name, signup_ref, signup_landing, google_sub, signup_fbc, signup_fbp, email_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id`,
      [a.email, name, ref, a.landing, a.googleSub ?? null, a.ad?.fbc ?? null, a.ad?.fbp ?? null],
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

  emit('signup', userId, { workspaceId, ref, props: { landing: a.landing, invited: !!invite, first_touch: a.ref, method: a.method ?? 'magic_link', ad_click: !!a.ad?.fbc } });
  if (invite) emit('invite_accepted', userId, { workspaceId, ref, props: { new_user: true, invitation_id: invite.id } });
  // Same event_id as the pixel's CompleteRegistration (MetaPixel.tsx): Meta keeps one.
  if (a.ad) {
    sendRegistration({ userId, email: a.email, sourceUrl: `${SITE_URL}${a.landing?.startsWith('/') ? a.landing : '/signup'}`, ...a.ad });
  }
  return userId;
}

