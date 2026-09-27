-- Paid-social signup measurement (2026-09-27, lib/analytics/meta-capi.ts).
--   fbc  Meta's click id cookie `_fbc` (fb.1.<ms>.<fbclid>) where the visitor asked to
--        sign up; the fbclid ties the account to the exact ad click.
--   fbp  Meta's browser id cookie `_fbp`.
--   ua   the User-Agent that asked for the link (the Conversions API wants the browser
--        the ad was clicked in, not the one the email link is later opened in; `ip`
--        already holds its address).
-- magic_links carries them from the request to the account; users keeps them.
ALTER TABLE magic_links
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS ua  text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_fbc text,
  ADD COLUMN IF NOT EXISTS signup_fbp text;
