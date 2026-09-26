'use server';
// Growth hooks that run after in-app actions. Each is cheap, never throws to the
// client, and derives everything from the caller's own session + Postgres.
import { ctxOrNull, hasRole } from '@/lib/auth/guard';
import { one, query } from '@/lib/db';

/** The workspace total at which the invite prompt appears ("after the 3rd save"). */
const NUDGE_AT_SAVES = 3;

/**
 * Called by FavButton after a successful save: whether to show the team-invite prompt,
 * only to people who can invite, in a workspace that is still just them, with no
 * pending invitation, at 3+ saved items, and never again once dismissed.
 */
export async function afterSaveAction(): Promise<{ nudge: boolean }> {
  try {
    const ctx = await ctxOrNull();
    if (!ctx) return { nudge: false };
    const s = await one<{ saves: number; members: number; pending: boolean; dismissed: boolean }>(
      `SELECT (SELECT count(*)::int FROM favorites WHERE workspace_id = $1) AS saves,
              (SELECT count(*)::int FROM workspace_members WHERE workspace_id = $1) AS members,
              EXISTS (SELECT 1 FROM invitations WHERE workspace_id = $1 AND accepted_at IS NULL
                         AND revoked_at IS NULL AND expires_at > now()) AS pending,
              (SELECT invite_nudge_dismissed_at IS NOT NULL FROM users WHERE id = $2) AS dismissed`,
      [ctx.workspaceId, ctx.user.id],
    );
    if (!s) return { nudge: false };
    return { nudge: hasRole(ctx, 'admin') && s.saves >= NUDGE_AT_SAVES && s.members === 1 && !s.pending && !s.dismissed };
  } catch (e) {
    console.error('[growth] afterSave', (e as Error).message);
    return { nudge: false };
  }
}

/** "Not now" on the invite prompt — remembered per user, on every device. */
export async function dismissInviteNudgeAction(): Promise<void> {
  const ctx = await ctxOrNull();
  if (!ctx) return;
  await query('UPDATE users SET invite_nudge_dismissed_at = now() WHERE id = $1 AND invite_nudge_dismissed_at IS NULL', [ctx.user.id])
    .catch((e: Error) => console.error('[growth] dismiss nudge', e.message));
}
