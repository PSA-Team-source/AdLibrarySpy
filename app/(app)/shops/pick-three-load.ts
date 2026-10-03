// "Pick 3 shops to watch": the first-session step on /shops, run as a 50/50 test.
// Server-only (NOT a server action: it takes the ctx). Assignment is persisted in
// experiment_arms (migration 022) the first time an eligible user opens /shops,
// in BOTH arms, so the control arm is measured from the same moment. Events go to
// ClickHouse (lib/analytics/events.ts); readout in research/launch-2026-09/RETENTION.md.
import type { Ctx } from '@/lib/auth/guard';
import { one } from '@/lib/db';
import { trackerCount } from '@/lib/data';
import { emit } from '@/lib/analytics/events';
import { PICK3, armFor, eligible } from '@/lib/pick-three';

/** Assigns on first eligible visit; true = show the step now. Never throws. */
export async function pickThreeShouldShow(ctx: Ctx): Promise<boolean> {
  try {
    const row = await one<{ arm: string; outcome: string | null }>(
      'SELECT arm, outcome FROM experiment_arms WHERE user_id = $1 AND experiment = $2', [ctx.user.id, PICK3]);
    if (row) return row.arm === 'treatment' && row.outcome == null;

    const [exp, user, trackers] = await Promise.all([
      one<{ starts_at: Date; ends_at: Date | null }>('SELECT starts_at, ends_at FROM experiments WHERE name = $1', [PICK3]),
      one<{ created_at: Date }>('SELECT created_at FROM users WHERE id = $1', [ctx.user.id]),
      trackerCount(ctx.workspaceId),
    ]);
    if (!exp || !user || !eligible({ userCreatedAt: user.created_at, startsAt: exp.starts_at, endsAt: exp.ends_at, trackers })) return false;

    const arm = armFor(ctx.user.id);
    const inserted = await one<{ arm: string }>(
      `INSERT INTO experiment_arms (user_id, experiment, arm) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING arm`, [ctx.user.id, PICK3, arm]);
    if (inserted) emit('pick3_assigned', ctx.user.id, { workspaceId: ctx.workspaceId, props: { arm } });
    return arm === 'treatment';
  } catch (e) {
    console.error('[pick3]', (e as Error).message);
    return false;
  }
}


