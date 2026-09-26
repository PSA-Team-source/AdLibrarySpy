CREATE TABLE IF NOT EXISTS rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits         bigint NOT NULL DEFAULT 0
);
-- Old windows are dead weight; a periodic sweep keeps the table small.
CREATE INDEX IF NOT EXISTS rate_limits_window_ix ON rate_limits (window_start);
