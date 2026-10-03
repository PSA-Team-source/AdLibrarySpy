// "Today's 10 winners" persistence (table winner_days, migration 022). The
// alerts job writes each day's list once (first writer wins, retries reuse it),
// the /winners archive reads it back — so an email and the page it links to
// always show the same ranked list.
import { query, one } from '../db';
import type { WinningToday } from './digest';

/** Store the day's list unless one is already stored; returns the stored list. */
export async function keepWinnerDay(day: string, niche: string | null, items: WinningToday[]): Promise<WinningToday[]> {
  await query('INSERT INTO winner_days (day, niche, items) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [day, niche ?? '', JSON.stringify(items)]);
  return (await getWinnerDay(day, niche)) ?? items;
}

export async function getWinnerDay(day: string, niche: string | null): Promise<WinningToday[] | null> {
  const r = await one<{ items: WinningToday[] }>('SELECT items FROM winner_days WHERE day = $1 AND niche = $2', [day, niche ?? '']);
  return r?.items ?? null;
}

export interface WinnerDaySummary { day: string; count: number; top: WinningToday | null; niches: string[] }

/** Past days with a list, newest first: the overall list's leader and the niche lists kept that day. */
export async function winnerDays(limit = 60): Promise<WinnerDaySummary[]> {
  const rows = await query<{ day: string; items: WinningToday[] | null; niches: string[] }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day,
            (array_agg(items) FILTER (WHERE niche = ''))[1] AS items,
            coalesce(array_agg(niche ORDER BY niche) FILTER (WHERE niche <> ''), '{}') AS niches
       FROM winner_days GROUP BY day ORDER BY day DESC LIMIT $1`, [limit]);
  return rows.map(r => ({ day: r.day, count: r.items?.length ?? 0, top: r.items?.[0] ?? null, niches: r.niches }));
}

/** Niche lists stored for a day (for the archive's niche switch). */
export async function nichesOn(day: string): Promise<string[]> {
  return (await query<{ niche: string }>("SELECT niche FROM winner_days WHERE day = $1 AND niche <> '' ORDER BY niche", [day])).map(r => r.niche);
}
