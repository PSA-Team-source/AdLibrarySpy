// Growth-funnel events → ClickHouse dashboard.adlibraryspy_events
// (DDL lib/analytics/001_adlibraryspy_events.sql, queries research/launch-2026-09/FUNNEL.md).
//
// Analytics only: emit() never throws, never blocks the caller (fire-and-forget,
// 2s timeout) and is a no-op when CLICKHOUSE_URL is unset. Postgres stays the
// source of truth (users.signup_ref, users.first_*_at, invitations).
// Server-only: reads the ClickHouse credential from the environment.
import { randomUUID } from 'node:crypto';

export type FunnelEvent = 'signup' | 'first_save' | 'first_track' | 'invite_sent' | 'invite_accepted'
  // Email engagement: one `email_sent` per delivered digest/report (ref = campaign,
  // e.g. alerts:daily, weekly:2026-w40), one `email_click` per tracked link hop (app/r).
  | 'email_sent' | 'email_click'
  // "Pick 3 shops to watch" 50/50 test (lib/pick-three.ts): assigned (props.arm, both arms),
  // shown / tracked (props.n = shops tracked) / skipped (props.n) / completed — treatment only.
  | 'pick3_assigned' | 'pick3_shown' | 'pick3_tracked' | 'pick3_skipped' | 'pick3_completed';

const TIMEOUT_MS = 2000;

export interface EventRow {
  event_id: string; occurred_at: string; event: FunnelEvent; user_id: string;
  workspace_id: string; ref_source: string; ref: string; props: string;
}

/** Pure: the JSONEachRow line for one event. Exported for the self-check. */
export function eventRow(event: FunnelEvent, userId: string, opts: {
  workspaceId?: string | null; ref?: string | null; props?: Record<string, unknown>; now?: Date;
} = {}): EventRow {
  const ref = (opts.ref ?? '').slice(0, 120);
  return {
    event_id: randomUUID(),
    // DateTime64(3,'UTC') accepts 'YYYY-MM-DD hh:mm:ss.sss'.
    occurred_at: (opts.now ?? new Date()).toISOString().replace('T', ' ').replace('Z', ''),
    event,
    user_id: userId,
    workspace_id: opts.workspaceId ?? '',
    ref_source: ref ? ref.split(':', 1)[0] : '',
    ref,
    props: opts.props ? JSON.stringify(opts.props) : '',
  };
}

/**
 * Fire-and-forget: safe to call anywhere on the server and never rejects. The
 * returned promise settles when the insert is done — request handlers ignore
 * it; a cron script that exits right after sending awaits it.
 */
export function emit(event: FunnelEvent, userId: string, opts: Parameters<typeof eventRow>[2] = {}): Promise<void> {
  const base = process.env.CLICKHOUSE_URL;
  if (!base) return Promise.resolve();
  let row: EventRow;
  try { row = eventRow(event, userId, opts); } catch { return Promise.resolve(); }
  const url = new URL(base);
  url.searchParams.set('query', 'INSERT INTO dashboard.adlibraryspy_events FORMAT JSONEachRow');
  // Server-side batching: one row per request is fine for ClickHouse this way.
  url.searchParams.set('async_insert', '1');
  url.searchParams.set('wait_for_async_insert', '0');
  return fetch(url, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': process.env.CLICKHOUSE_USER || 'default',
      'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD || '',
      'Content-Type': 'application/x-ndjson',
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
    .then(async (r) => { if (!r.ok) console.error('[analytics]', event, r.status, (await r.text()).slice(0, 200)); })
    .catch((e: Error) => console.error('[analytics]', event, e.name === 'TimeoutError' ? 'timeout' : e.message));
}

/**
 * Stamp users.first_save_at / first_track_at once and emit the matching event
 * only from the request that flipped it (exactly-once, race-safe). Never throws.
 */
export async function markFirst(kind: 'save' | 'track', userId: string, workspaceId: string): Promise<void> {
  const col = kind === 'save' ? 'first_save_at' : 'first_track_at';
  try {
    const { one } = await import('@/lib/db'); // lazy: keeps this module importable by `npm test`
    const hit = await one<{ signup_ref: string | null }>(
      `UPDATE users SET ${col} = now() WHERE id = $1 AND ${col} IS NULL RETURNING signup_ref`,
      [userId],
    );
    if (hit) emit(kind === 'save' ? 'first_save' : 'first_track', userId, { workspaceId, ref: hit.signup_ref });
  } catch (e) {
    console.error('[analytics] markFirst', kind, (e as Error).message);
  }
}
