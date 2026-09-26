// Request guards. Every feature is free for every workspace (2026-09-19):
// there are no plans, limits or credits to check here.
//
// Request guards. Every page and route handler that touches tenant data goes
// through one of these, so a workspace_id is never taken from user input.
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, query } from '@/lib/db';
import { currentUser, SESSION_COOKIE, type SessionUser } from './session';
import { hashToken } from './tokens';
import { PATH_HEADER, loginUrl } from './safe-next';

export type Role = 'owner' | 'admin' | 'member';

/**
 * The workspace the user last switched to. Only a PREFERENCE: resolveCtx still
 * joins through the caller's own memberships, so an id they don't belong to
 * (forged, stale, another user's on a shared browser) is simply not matched and
 * the oldest membership wins, as before.
 */
export const WORKSPACE_COOKIE = 'als_ws';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export interface Ctx {
  user: SessionUser;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: Role;
}

/** /login?next=<the page being guarded>, from the path middleware.ts forwarded. */
async function backToLogin(): Promise<string> {
  return loginUrl((await headers()).get(PATH_HEADER));
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(await backToLogin());
  return u;
}

/**
 * Resolve the caller's active workspace. A user always has exactly one
 * membership row per workspace; we pick their oldest membership, which is the
 * workspace created at signup unless they were invited first.
 */
// React cache is request-scoped for Server Components. The app layout and the
// leaf page both need this context, so sharing one promise avoids repeating the
// session + workspace lookup on every navigation without keeping auth state
// across requests.
const resolveCtx = cache(async (): Promise<Ctx | false | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const wanted = jar.get(WORKSPACE_COOKIE)?.value ?? '';
  const row = await one<{
    user_id: string; email: string; user_name: string; email_verified_at: Date | null;
    workspace_id: string | null; workspace_name: string | null; slug: string | null; role: Role | null;
  }>(
    `SELECT u.id AS user_id, u.email, u.name AS user_name, u.email_verified_at,
            w.id AS workspace_id, w.name AS workspace_name, w.slug, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN workspace_members m ON m.user_id = u.id
       LEFT JOIN workspaces w ON w.id = m.workspace_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      ORDER BY (m.workspace_id = $2::uuid) IS TRUE DESC, m.joined_at ASC
      LIMIT 1`,
    [hashToken(token), UUID.test(wanted) ? wanted : null],
  );
  if (!row) return null;
  if (!row.workspace_id || !row.workspace_name || !row.slug || !row.role) return false;
  return {
    user: {
      id: row.user_id,
      email: row.email,
      name: row.user_name,
      emailVerifiedAt: row.email_verified_at,
    },
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceSlug: row.slug,
    role: row.role,
  };
});

export async function requireCtx(): Promise<Ctx> {
  const ctx = await resolveCtx();
  if (ctx === false) redirect('/signup/workspace');
  if (!ctx) redirect(await backToLogin());
  return ctx;
}

export async function requireRole(min: Role): Promise<Ctx> {
  const ctx = await requireCtx();
  if (RANK[ctx.role] < RANK[min]) redirect('/settings/members?error=forbidden');
  return ctx;
}

export function hasRole(ctx: Ctx, min: Role): boolean {
  return RANK[ctx.role] >= RANK[min];
}

/** JSON-API variant: returns null instead of redirecting. */
export async function ctxOrNull(): Promise<Ctx | null> {
  const ctx = await resolveCtx();
  return ctx || null;
}

export async function audit(
  ctx: { workspaceId?: string | null; user?: { id: string } | null },
  action: string,
  target?: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await query(
    'INSERT INTO audit_log (workspace_id, user_id, action, target, meta) VALUES ($1,$2,$3,$4,$5)',
    [ctx.workspaceId ?? null, ctx.user?.id ?? null, action, target ?? null, JSON.stringify(meta)],
  ).catch((e) => console.error('[audit] failed', action, e.message));
}

/** Every workspace the user belongs to, oldest first — the switcher's list. */
export async function userWorkspaces(userId: string): Promise<{ id: string; name: string }[]> {
  return query<{ id: string; name: string }>(
    `SELECT w.id, w.name FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = $1 ORDER BY m.joined_at ASC`,
    [userId],
  );
}

/** True when the user is a member of that workspace (switch route's check). */
export async function isMember(userId: string, workspaceId: string): Promise<boolean> {
  if (!UUID.test(workspaceId)) return false;
  return !!(await one('SELECT 1 FROM workspace_members WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]));
}
