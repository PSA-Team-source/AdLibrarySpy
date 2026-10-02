// Pure part of lib/active-days.ts, shared with tests/active-days.test.mjs.

/** YYYY-MM-DD in UTC. */
export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * true the first time a user is seen on a given day, false after. Memory is one
 * entry per user active today: the set is dropped when the day changes.
 * ponytail: per process, so N server processes write up to N times a day per user;
 * ON CONFLICT DO NOTHING makes the extras no-ops.
 */
export function activeDayGate() {
  let current = '';
  let seen = new Set<string>();
  return {
    take(userId: string, day: string): boolean {
      if (day !== current) { current = day; seen = new Set(); }
      if (seen.has(userId)) return false;
      seen.add(userId);
      return true;
    },
    /** A failed write gives the user back, so the next render retries it. */
    release(userId: string): void { seen.delete(userId); },
  };
}
