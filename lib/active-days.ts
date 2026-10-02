// Retention: marks the UTC day a signed-in user opened the app (user_active_days,
// migration 021). Called from the app shell on every render, so it must be cheap
// and harmless: an in-process gate lets at most one INSERT per user per day per
// server process through, the INSERT is ON CONFLICT DO NOTHING, it is never
// awaited by the render, and it never throws.
import { query } from '@/lib/db';
import { activeDayGate, utcDay } from './active-days-gate';

const gate = activeDayGate();

export function markActiveDay(userId: string, workspaceId: string | null, path: string | null): void {
  const day = utcDay(new Date());
  if (!gate.take(userId, day)) return;
  query(
    `INSERT INTO user_active_days (user_id, workspace_id, day, first_path)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [userId, workspaceId, day, (path ?? '').split('?')[0].slice(0, 200)],
  ).catch(e => {
    gate.release(userId);
    console.error('[active-days]', e instanceof Error ? e.message : e);
  });
}
