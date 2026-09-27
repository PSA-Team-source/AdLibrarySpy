-- Sign-in code (2026-09-27, lib/auth/code.ts): the same email that carries a
-- 'login' magic link also carries a 6-digit code, typed on the page that asked for
-- it. Both live on ONE row, so consuming either (consumed_at) kills the other.
--   code_hash      HMAC-SHA256 of the code (keyed by SESSION_SECRET, bound to the
--                  email). NULL = no usable code: a newer code was sent to the
--                  address, or code_attempts reached the cap. The link still works.
--   code_attempts  wrong guesses against this code.
ALTER TABLE magic_links
  ADD COLUMN IF NOT EXISTS code_hash     text,
  ADD COLUMN IF NOT EXISTS code_attempts int NOT NULL DEFAULT 0;
