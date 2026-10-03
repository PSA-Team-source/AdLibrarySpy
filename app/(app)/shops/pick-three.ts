'use server';
// "Pick 3 shops to watch" step: the client's actions (assignment lives in pick-three-load.ts).
import { requireCtx, type Ctx } from '@/lib/auth/guard';
import { one } from '@/lib/db';
import { trackerCount } from '@/lib/data';
import { emit } from '@/lib/analytics/events';
import { PICK3, PICK3_GOAL } from '@/lib/pick-three';

/** Ends the step once; returns false when it was already over or never open. */
async function finish(ctx: Ctx, outcome: 'completed' | 'skipped'): Promise<boolean> {
  const r = await one<{ arm: string }>(
    `UPDATE experiment_arms SET outcome = $3, finished_at = now()
      WHERE user_id = $1 AND experiment = $2 AND arm = 'treatment' AND outcome IS NULL RETURNING arm`,
    [ctx.user.id, PICK3, outcome]);
  return !!r;
}

/** After a Track / Untrack in the step: the workspace's real tracker count; at 3 the step completes. */
export async function pickThreeTracked(): Promise<{ n: number; done: boolean }> {
  const ctx = await requireCtx();
  const n = await trackerCount(ctx.workspaceId);
  emit('pick3_tracked', ctx.user.id, { workspaceId: ctx.workspaceId, props: { n } });
  if (n < PICK3_GOAL) return { n, done: false };
  if (await finish(ctx, 'completed')) emit('pick3_completed', ctx.user.id, { workspaceId: ctx.workspaceId, props: { n } });
  return { n, done: true };
}

export async function pickThreeSkip(): Promise<void> {
  const ctx = await requireCtx();
  if (await finish(ctx, 'skipped')) {
    emit('pick3_skipped', ctx.user.id, { workspaceId: ctx.workspaceId, props: { n: await trackerCount(ctx.workspaceId) } });
  }
}
