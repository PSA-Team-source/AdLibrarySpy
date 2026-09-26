'use server';
// Workspace membership: invitations, role changes, removals, renaming.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { query, one, tx } from '@/lib/db';
import { requireRole, requireCtx, audit, type Role } from '@/lib/auth/guard';
import { randomToken, hashToken } from '@/lib/auth/tokens';
import { sendInviteEmail, mailConfigured } from '@/lib/mail';
import { currentUser } from '@/lib/auth/session';
import { emit } from '@/lib/analytics/events';
import { rateLimit } from '@/lib/ratelimit';

export interface ActionState { error?: string; ok?: string }

export interface Member {
  userId: string; name: string; email: string; role: Role; joinedAt: Date;
}
export interface Invite {
  id: string; email: string; role: string; createdAt: Date; expiresAt: Date;
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const rows = await query<{ user_id: string; name: string; email: string; role: Role; joined_at: Date }>(
    `SELECT m.user_id, u.name, u.email, m.role, m.joined_at
       FROM workspace_members m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at ASC`,
    [workspaceId],
  );
  return rows.map(r => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, joinedAt: r.joined_at }));
}

export async function listInvites(workspaceId: string): Promise<Invite[]> {
  const rows = await query<{ id: string; email: string; role: string; created_at: Date; expires_at: Date }>(
    `SELECT id, email, role, created_at, expires_at FROM invitations
      WHERE workspace_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(r => ({ id: r.id, email: r.email, role: r.role, createdAt: r.created_at, expiresAt: r.expires_at }));
}

export async function inviteMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireRole('admin');
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(['admin', 'member']),
  }).safeParse({ email: form.get('email'), role: form.get('role') });
  if (!parsed.success) return { error: 'Enter a valid email address and role.' };
  const { email, role } = parsed.data;

  // Every invite mails an address the inviter chose, from our domain: cap it per
  // workspace and per person so a workspace cannot be used as a spam relay.
  const limited = !(await rateLimit(`invite:${ctx.workspaceId}`, 20, 3600)).allowed
               || !(await rateLimit(`invite-user:${ctx.user.id}`, 50, 86400)).allowed;
  if (limited) return { error: 'Too many invitations sent recently. Try again later.' };

  const already = await one(
    `SELECT 1 FROM workspace_members m JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1 AND u.email_norm = $2`,
    [ctx.workspaceId, email],
  );
  if (already) return { error: 'That person is already in this workspace.' };

  if (!mailConfigured()) return { error: 'Email delivery is not configured, so invitations cannot be sent.' };

  const token = randomToken();
  await query(
    `INSERT INTO invitations (workspace_id, email, role, token_hash, invited_by, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + interval '7 days')
     ON CONFLICT (workspace_id, lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL
     DO UPDATE SET token_hash = EXCLUDED.token_hash, role = EXCLUDED.role,
                   expires_at = EXCLUDED.expires_at, created_at = now()`,
    [ctx.workspaceId, email, role, hashToken(token), ctx.user.id],
  );

  try {
    await sendInviteEmail(email, ctx.workspaceName, ctx.user.name || ctx.user.email, token);
  } catch (err) {
    console.error('[invite] mail failed', err);
    return { error: 'The invitation could not be emailed. Check the mail configuration and try again.' };
  }

  await audit(ctx, 'member.invited', email, { role });
  emit('invite_sent', ctx.user.id, { workspaceId: ctx.workspaceId, props: { role } });
  revalidatePath('/settings/members');
  return { ok: `Invitation sent to ${email}.` };
}

export async function revokeInviteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireRole('admin');
  const id = String(form.get('id') ?? '');
  await query('UPDATE invitations SET revoked_at = now() WHERE id = $1 AND workspace_id = $2', [id, ctx.workspaceId]);
  await audit(ctx, 'member.invite_revoked', id);
  revalidatePath('/settings/members');
  return { ok: 'Invitation revoked.' };
}

export async function changeRoleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireRole('admin');
  const userId = String(form.get('userId') ?? '');
  const role = String(form.get('role') ?? '');
  if (!['admin', 'member'].includes(role)) return { error: 'Invalid role.' };

  // The owner role is not transferable through this control.
  const target = await one<{ role: Role }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [ctx.workspaceId, userId],
  );
  if (!target) return { error: 'That person is not in this workspace.' };
  if (target.role === 'owner') return { error: 'The workspace owner’s role cannot be changed here.' };

  await query('UPDATE workspace_members SET role = $3 WHERE workspace_id = $1 AND user_id = $2',
    [ctx.workspaceId, userId, role]);
  await audit(ctx, 'member.role_changed', userId, { role });
  revalidatePath('/settings/members');
  return { ok: 'Role updated.' };
}

export async function removeMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireRole('admin');
  const userId = String(form.get('userId') ?? '');
  const target = await one<{ role: Role }>(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [ctx.workspaceId, userId],
  );
  if (!target) return { error: 'That person is not in this workspace.' };
  if (target.role === 'owner') return { error: 'The workspace owner cannot be removed.' };

  // Membership is what API keys and connected AI clients act on behalf of, so
  // their access to this workspace ends with it.
  await tx(async (c) => {
    await c.query('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [ctx.workspaceId, userId]);
    await c.query('UPDATE oauth_tokens SET revoked_at = now() WHERE workspace_id = $1 AND user_id = $2 AND revoked_at IS NULL', [ctx.workspaceId, userId]);
    await c.query('UPDATE api_keys SET revoked_at = now() WHERE workspace_id = $1 AND created_by = $2 AND revoked_at IS NULL', [ctx.workspaceId, userId]);
  });
  await audit(ctx, 'member.removed', userId);
  revalidatePath('/settings/members');
  return { ok: 'Member removed.' };
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Title + slug in one save. The slug is globally unique (workspaces_slug_uk). */
export async function renameWorkspaceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireRole('admin');
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const slug = String(form.get('slug') ?? ctx.workspaceSlug).trim().toLowerCase();
  if (!name) return { error: 'Enter a workspace title.' };
  if (!SLUG.test(slug)) return { error: 'The slug must be 3–40 characters: lowercase letters, numbers and hyphens, not starting or ending with a hyphen.' };
  if (name === ctx.workspaceName && slug === ctx.workspaceSlug) return { ok: 'Nothing to update.' };
  if (slug !== ctx.workspaceSlug && await one('SELECT 1 FROM workspaces WHERE slug = $1 AND id <> $2', [slug, ctx.workspaceId])) {
    return { error: 'That slug is already taken.' };
  }
  try {
    await query('UPDATE workspaces SET name = $2, slug = $3, updated_at = now() WHERE id = $1', [ctx.workspaceId, name, slug]);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { error: 'That slug is already taken.' };
    throw e;
  }
  if (name !== ctx.workspaceName) await audit(ctx, 'workspace.renamed', ctx.workspaceId, { name });
  if (slug !== ctx.workspaceSlug) await audit(ctx, 'workspace.slug_changed', ctx.workspaceId, { from: ctx.workspaceSlug, to: slug });
  revalidatePath('/', 'layout');
  return { ok: 'Workspace updated.' };
}

/**
 * Why the active workspace cannot be removed, or null when it can. Only the
 * owner may remove it, never their last workspace (the app needs one to open
 * into), and never while a Stripe subscription is still billing it.
 */
export async function workspaceRemovalBlocker(workspaceId: string, userId: string, role: Role): Promise<string | null> {
  if (role !== 'owner') return 'Only the workspace owner can remove this workspace.';
  const [others, billing] = await Promise.all([
    one<{ n: number }>('SELECT count(*)::int AS n FROM workspace_members WHERE user_id = $1 AND workspace_id <> $2', [userId, workspaceId]),
    one(`SELECT 1 FROM subscriptions WHERE workspace_id = $1 AND status IN ('active','trialing','past_due','unpaid') LIMIT 1`, [workspaceId]),
  ]);
  if (!others?.n) return 'You need access to another workspace before you can remove this one.';
  if (billing) return 'This workspace still has an active subscription. Cancel it before removing the workspace.';
  return null;
}

export async function removeWorkspaceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireRole('owner');
  if (String(form.get('confirm') ?? '').trim() !== ctx.workspaceSlug) return { error: `Type ${ctx.workspaceSlug} to confirm.` };
  const blocked = await workspaceRemovalBlocker(ctx.workspaceId, ctx.user.id, ctx.role);
  if (blocked) return { error: blocked };
  // Every tenant table cascades on workspaces(id); audit_log is SET NULL so the trail survives.
  const gone = await query('DELETE FROM workspaces WHERE id = $1 AND owner_user_id = $2 RETURNING id', [ctx.workspaceId, ctx.user.id]);
  if (!gone.length) return { error: 'Only the workspace owner can remove this workspace.' };
  await audit({ workspaceId: null, user: ctx.user }, 'workspace.deleted', ctx.workspaceName, { slug: ctx.workspaceSlug, id: ctx.workspaceId });
  revalidatePath('/', 'layout');
  redirect('/settings/workspace');
}

/** Accept an invitation. The signed-in user's email must match the invite. */
export async function acceptInvite(token: string): Promise<{ ok: boolean; reason?: string; workspace?: string; workspaceId?: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: 'sign_in' };

  const inv = await one<{ id: string; workspace_id: string; email: string; role: string; name: string }>(
    `SELECT i.id, i.workspace_id, i.email, i.role, w.name
       FROM invitations i JOIN workspaces w ON w.id = i.workspace_id
      WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()`,
    [hashToken(token)],
  );
  if (!inv) return { ok: false, reason: 'invalid' };
  if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, reason: 'wrong_account' };
  }

  const accepted = await tx(async (c) => {
    await c.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,$3)
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [inv.workspace_id, user.id, inv.role],
    );
    const r = await c.query('UPDATE invitations SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL', [inv.id]);
    return !!r.rowCount;
  });
  if (accepted) emit('invite_accepted', user.id, { workspaceId: inv.workspace_id, props: { new_user: false, invitation_id: inv.id } });
  return { ok: true, workspace: inv.name, workspaceId: inv.workspace_id };
}
