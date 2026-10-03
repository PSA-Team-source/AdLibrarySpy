// "Pick 3 shops to watch" 50/50 test: pure rules, shared with tests/pick-three.test.mjs.
import { createHash } from 'node:crypto';

export const PICK3 = 'pick3';
export const PICK3_GOAL = 3;
export type Arm = 'treatment' | 'control';

/** Deterministic 50/50 split: the same user id always lands in the same arm. */
export function armFor(userId: string): Arm {
  return createHash('sha256').update(`${PICK3}:${userId}`).digest()[0] % 2 === 0 ? 'treatment' : 'control';
}

/** Enrolled = signed up after the test started (and before it ended) and tracks nothing yet. */
export function eligible(a: { userCreatedAt: Date; startsAt: Date; endsAt: Date | null; trackers: number }): boolean {
  return a.trackers === 0 && a.userCreatedAt >= a.startsAt && (a.endsAt == null || new Date() < a.endsAt);
}
