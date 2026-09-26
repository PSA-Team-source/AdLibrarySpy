-- Growth funnel facts on the user row (2026-09-25).
--   signup_ref      first-touch attribution from the als_ref cookie at signup,
--                   '<source>:<detail>' (e.g. 'share:store/fashionnova.com', 'utm:twitter').
--                   NULL = direct / unknown.
--   signup_landing  the page the visitor opened /signup from (same-site path, or the
--                   external host). NULL when the browser sent no Referer.
--   first_save_at   first time this user saved anything; set once, never moved.
--   first_track_at  first time this user tracked a shop; set once, never moved.
--   invite_nudge_dismissed_at  the "invite your team" prompt was dismissed.
-- The first_* stamps make the ClickHouse first_save / first_track events exactly-once:
-- an event is emitted only by the UPDATE that flips the column from NULL.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_ref                text,
  ADD COLUMN IF NOT EXISTS signup_landing            text,
  ADD COLUMN IF NOT EXISTS first_save_at             timestamptz,
  ADD COLUMN IF NOT EXISTS first_track_at            timestamptz,
  ADD COLUMN IF NOT EXISTS invite_nudge_dismissed_at timestamptz;
