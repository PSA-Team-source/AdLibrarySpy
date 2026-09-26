-- Passwordless sign-in (2026-09-25): one-time links emailed to the address.
--   purpose 'login'        sign in, or create the account when no user has this email
--                          (name / workspace_name / next / ref / landing carry the signup
--                          form and first-touch attribution across devices)
--   purpose 'change_email' confirm moving user_id's sign-in address to new_email;
--                          sent to the CURRENT address so a stolen session cannot
--                          redirect sign-in to an inbox the attacker owns
-- Only the SHA-256 of the token is stored. A link is consumed by one atomic
-- UPDATE ... WHERE consumed_at IS NULL AND expires_at > now().
CREATE TABLE IF NOT EXISTS magic_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     text NOT NULL UNIQUE,
  purpose        text NOT NULL CHECK (purpose IN ('login', 'change_email')),
  email          text NOT NULL,
  user_id        uuid REFERENCES users(id) ON DELETE CASCADE,
  new_email      text,
  name           text,
  workspace_name text,
  next           text,
  ref            text,
  landing        text,
  ip             text,
  expires_at     timestamptz NOT NULL,
  consumed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links (lower(email), created_at DESC);
