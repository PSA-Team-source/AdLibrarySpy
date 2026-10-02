-- Retention measurement: one row per user per UTC day they opened the signed-in app.
-- recent_views overwrites viewed_at and sessions are long-lived, so neither can say
-- whether a user came BACK; this table can (D1/D3/D7 queries in
-- research/launch-2026-09/RETENTION.md). Written by lib/active-days.ts from the
-- app shell, at most once per user per day (INSERT ... ON CONFLICT DO NOTHING).
CREATE TABLE IF NOT EXISTS user_active_days (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid,
  day          date NOT NULL,
  first_path   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS user_active_days_day_ix ON user_active_days (day);

-- Backfill from the activity that was already recorded, so the launch cohorts
-- (2026-09-27 onwards) are not all blank. Each is a real day the user was in the
-- app; first_path names where the day came from. It UNDER-counts (recent_views
-- keeps only the latest view per item), never over-counts.
INSERT INTO user_active_days (user_id, day, first_path)
SELECT id, (created_at AT TIME ZONE 'UTC')::date, '(backfill:signup)' FROM users
ON CONFLICT DO NOTHING;
INSERT INTO user_active_days (user_id, day, first_path)
SELECT DISTINCT user_id, (created_at AT TIME ZONE 'UTC')::date, '(backfill:sign-in)' FROM sessions
ON CONFLICT DO NOTHING;
INSERT INTO user_active_days (user_id, workspace_id, day, first_path)
SELECT DISTINCT ON (user_id, (viewed_at AT TIME ZONE 'UTC')::date)
       user_id, workspace_id, (viewed_at AT TIME ZONE 'UTC')::date, '(backfill:view)'
  FROM recent_views
ON CONFLICT DO NOTHING;
