// Reads published weekly reports. Anonymous and identical for every visitor —
// no cookies, no session — so /weekly pages stay edge-cacheable.
import { query, one } from '@/lib/db';
import type { WeeklyReport, WeeklyReportData } from './types';

export const WEEK_RE = /^\d{4}-w\d{2}$/;

interface Row { iso_week: string; published_at: Date; data: WeeklyReportData }

const toReport = (r: Row): WeeklyReport => ({ week: r.iso_week, publishedAt: r.published_at.toISOString(), data: r.data });

export async function latestWeeklyReport(): Promise<WeeklyReport | null> {
  const r = await one<Row>(
    `SELECT iso_week, published_at, data FROM weekly_reports
      WHERE published_at IS NOT NULL ORDER BY iso_week DESC LIMIT 1`,
  );
  return r ? toReport(r) : null;
}

export async function weeklyReport(week: string): Promise<WeeklyReport | null> {
  if (!WEEK_RE.test(week)) return null;
  const r = await one<Row>(
    `SELECT iso_week, published_at, data FROM weekly_reports
      WHERE iso_week = $1 AND published_at IS NOT NULL`,
    [week],
  );
  return r ? toReport(r) : null;
}

/** Published weeks, newest first — the archive links. */
export async function publishedWeeks(limit = 12): Promise<{ week: string; label: string }[]> {
  const rows = await query<{ iso_week: string; label: string | null }>(
    `SELECT iso_week, data->>'weekLabel' AS label FROM weekly_reports
      WHERE published_at IS NOT NULL ORDER BY iso_week DESC LIMIT $1`,
    [limit],
  );
  return rows.map(r => ({ week: r.iso_week, label: r.label || r.iso_week }));
}
