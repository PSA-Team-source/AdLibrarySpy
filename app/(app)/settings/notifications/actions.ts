'use server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireCtx, audit } from '@/lib/auth/guard';
import { isFrequency } from '@/lib/alerts/digest';

export interface NotificationsState { error?: string; ok?: string }

/** Alert email preferences. Per user: one digest covers every workspace they are in. */
export async function saveNotificationsAction(_prev: NotificationsState, form: FormData): Promise<NotificationsState> {
  const ctx = await requireCtx();
  const frequency = form.get('frequency');
  if (!isFrequency(frequency)) return { error: 'Choose how often to get alerts.' };
  const trackers = form.get('trackers') === 'on';
  const searches = form.get('searches') === 'on';
  const market = form.get('market') === 'on';
  await query(
    `INSERT INTO alert_prefs (user_id, frequency, trackers, searches, market) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE SET frequency=$2, trackers=$3, searches=$4, market=$5, updated_at=now()`,
    [ctx.user.id, frequency, trackers, searches, market],
  );
  await audit(ctx, 'alerts.preferences', frequency, { trackers, searches, market });
  revalidatePath('/settings/notifications');
  revalidatePath('/searches');
  if (frequency === 'off' || (!trackers && !searches && !market)) return { ok: 'Saved. You will not get alert emails.' };
  return { ok: frequency === 'daily' ? 'Saved. Alerts arrive daily around 13:00 UTC when something changed.' : 'Saved. Alerts arrive on Mondays around 13:00 UTC when something changed.' };
}
