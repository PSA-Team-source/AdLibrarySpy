-- "Pick 3 shops to watch" first-session step, run as a 50/50 test (2026-10-03).
-- Evidence: users who track a shop come back 32.8% vs 10.4%, and only 115/897
-- ever tracked one. Additive only.
--
-- experiments: one row per test; starts_at = only users created at/after it are
-- enrolled (set when this migration runs, i.e. just before the deploy).
-- experiment_arms: the persisted assignment (lib/pick-three.ts decides it from a
-- hash of the user id, so it is also reproducible), written the first time an
-- eligible user opens /shops. outcome = completed | skipped once the step ends.
-- Readout: research/launch-2026-09/RETENTION.md "Pick 3 test".
CREATE TABLE IF NOT EXISTS experiments (
  name      text PRIMARY KEY,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at   timestamptz
);
INSERT INTO experiments (name) VALUES ('pick3') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS experiment_arms (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experiment  text NOT NULL REFERENCES experiments(name),
  arm         text NOT NULL CHECK (arm IN ('treatment', 'control')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  outcome     text CHECK (outcome IN ('completed', 'skipped')),
  finished_at timestamptz,
  PRIMARY KEY (user_id, experiment)
);
CREATE INDEX IF NOT EXISTS experiment_arms_exp_ix ON experiment_arms (experiment, arm);
