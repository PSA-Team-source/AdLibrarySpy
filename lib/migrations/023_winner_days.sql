-- "Today's 10 winners": one ranked list per UTC day (the day the email goes out)
-- and niche ('' = overall), written once by scripts/alerts-digest.mjs and never
-- rewritten, so the /winners archive and every email of that day show the same
-- list. items = WinningToday[] (lib/alerts/digest.ts), rank = array order.
CREATE TABLE IF NOT EXISTS winner_days (
  day        date NOT NULL,
  niche      text NOT NULL DEFAULT '',
  items      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, niche)
);
