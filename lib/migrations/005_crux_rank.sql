-- Chrome UX Report popularity ranks.
--
-- Google's CrUX dataset is real-user Chrome telemetry. The research the dumps
-- repository cites (zakird.com/papers/toplists.pdf) finds it materially more
-- accurate than Alexa or Tranco at capturing the set of popular sites, which is
-- why it is preferred here over the store index's own traffic figure.
--
-- `rank_bucket` is a magnitude, not a position: 1000 means "in the top 1,000
-- origins", 5000 means "in the next band up to 5,000", and so on. CrUX does not
-- publish an exact ordinal, so neither do we.
CREATE TABLE IF NOT EXISTS crux_rank (
  domain      text PRIMARY KEY,
  rank_bucket int  NOT NULL,
  month       text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crux_rank_bucket_ix ON crux_rank (rank_bucket);

-- Which CrUX month is currently loaded, so the UI can date the figure.
CREATE TABLE IF NOT EXISTS crux_import (
  month       text PRIMARY KEY,
  origins     bigint NOT NULL DEFAULT 0,
  domains     bigint NOT NULL DEFAULT 0,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
