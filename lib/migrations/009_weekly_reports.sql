-- Weekly report ("The Monday report"): one snapshot per ISO week, built by
-- scripts/weekly-report.mjs from the market index. The snapshot is frozen once
-- written, so /weekly/{week} keeps showing exactly what was published and
-- mailed that week even after the index moves on.
CREATE TABLE IF NOT EXISTS weekly_reports (
  id           bigserial PRIMARY KEY,
  iso_week     text NOT NULL UNIQUE CHECK (iso_week ~ '^[0-9]{4}-w[0-9]{2}$'),
  generated_at timestamptz NOT NULL DEFAULT now(),
  data         jsonb NOT NULL,
  published_at timestamptz,
  -- Set when every subscriber claimed for this week has been attempted.
  emailed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS weekly_reports_published_idx
  ON weekly_reports (published_at DESC) WHERE published_at IS NOT NULL;

-- Newsletter consent. A row exists only after the user opted in themselves
-- (Settings > Newsletter); signup never creates one. Unsubscribing keeps the
-- row with unsubscribed_at set, so the consent history is auditable.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  source          text NOT NULL DEFAULT 'settings'
);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_active_idx
  ON newsletter_subscribers (user_id) WHERE unsubscribed_at IS NULL;

-- One row per (week, recipient): the claim that makes a re-run never mail the
-- same week twice. A failed send deletes its claim so the next run retries it.
CREATE TABLE IF NOT EXISTS newsletter_sends (
  iso_week text NOT NULL REFERENCES weekly_reports(iso_week) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (iso_week, user_id)
);
