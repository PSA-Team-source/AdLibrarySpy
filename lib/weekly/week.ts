// ISO-8601 weeks for the weekly report (Monday start; the week containing the
// year's first Thursday is week 1). Pure — scripts/weekly-report.mjs imports
// this file directly through Node's type stripping.

export interface IsoWeek { year: number; week: number; key: string }

export function isoWeekOf(date: Date): IsoWeek {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);            // Thursday decides the year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week, key: `${year}-w${String(week).padStart(2, '0')}` };
}

/** Monday and Sunday (YYYY-MM-DD, UTC) of an ISO week. */
export function weekBounds(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}
