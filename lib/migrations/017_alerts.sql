-- Alerts: the email digest of Brandtracker changes and new saved-search results,
-- built nightly by scripts/alerts-digest.mjs.

-- Per-user delivery preference. No row = the defaults (weekly, both types on).
-- 'off' is also what the one-click unsubscribe link writes.
CREATE TABLE IF NOT EXISTS alert_prefs (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frequency  text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'off')),
  trackers   boolean NOT NULL DEFAULT true,
  searches   boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A named /shops or /ads filter set. Personal (like favorites): scoped to the
-- workspace it was saved in and to the member who saved it.
CREATE TABLE IF NOT EXISTS saved_searches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('shops', 'ads')),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  -- Normalized query string (sorted keys, no page, no empty values).
  query        text NOT NULL CHECK (length(query) <= 2000),
  alert        boolean NOT NULL DEFAULT true,
  -- Result ids already reported (or present when alerts started). NULL = not
  -- seeded yet: the first run records the current results and mails nothing.
  seen_ids     text[],
  seeded_at    timestamptz,
  last_run_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, kind, query)
);
CREATE INDEX IF NOT EXISTS saved_searches_owner_idx ON saved_searches (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_searches_alert_idx ON saved_searches (user_id) WHERE alert;

-- One row per (recipient, period): the claim that makes a cron retry never mail
-- the same digest twice. period = 'd:2026-09-27' or 'w:2026-w39'. A failed
-- send deletes its claim so the next run retries it.
CREATE TABLE IF NOT EXISTS alert_sends (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period   text NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  summary  jsonb,
  PRIMARY KEY (user_id, period)
);
