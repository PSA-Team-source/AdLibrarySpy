// Page-level loaders for /weekly. A missing weekly_reports table (the deploy
// built before `npm run migrate`) reads as "no report yet" instead of failing
// the build; every other database error propagates so ISR keeps the last good
// page rather than caching an empty one.
import { latestWeeklyReport, publishedWeeks, weeklyReport } from '@/lib/weekly/data';

const UNDEFINED_TABLE = '42P01';

async function orNull<T>(p: Promise<T>, empty: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if ((e as { code?: string }).code === UNDEFINED_TABLE) {
      console.error('[weekly] weekly_reports table missing — run npm run migrate');
      return empty;
    }
    throw e;
  }
}

export const loadLatest = () => orNull(latestWeeklyReport(), null);
export const loadWeek = (week: string) => orNull(weeklyReport(week), null);
export const loadArchive = () => orNull(publishedWeeks(12), []);
