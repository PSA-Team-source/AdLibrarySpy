-- Email change becomes a two-inbox proof (2026-09-26). The old flow moved
-- users.email as soon as the CURRENT inbox approved, so an account could be
-- pointed at an address its owner never controlled (squatting it before the
-- real owner signed up). Now:
--   change_email       sent to the current address; approving it issues...
--   confirm_new_email  sent to the NEW address; only using it moves users.email.
ALTER TABLE magic_links DROP CONSTRAINT IF EXISTS magic_links_purpose_check;
ALTER TABLE magic_links ADD CONSTRAINT magic_links_purpose_check
  CHECK (purpose IN ('login', 'change_email', 'confirm_new_email'));
