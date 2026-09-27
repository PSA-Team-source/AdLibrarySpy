-- Owner decision 2026-09-27: the alerts digest is daily by default for every
-- user, and carries a "Today in the market" section (stores whose running Meta
-- ads jumped day over day) that can be switched off on its own. Additive: only
-- users without an alert_prefs row (never chose) move to daily.
ALTER TABLE alert_prefs ALTER COLUMN frequency SET DEFAULT 'daily';
ALTER TABLE alert_prefs ADD COLUMN IF NOT EXISTS market boolean NOT NULL DEFAULT true;
