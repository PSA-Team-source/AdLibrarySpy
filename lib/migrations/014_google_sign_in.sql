-- Sign in with Google (lib/auth/google.ts, googleSignInAction).
--   google_sub  Google's stable account id (the ID token's `sub`). An account is
--               matched on it first, then on its verified email, which then
--               records it here. Email alone is not identity: an address can
--               move between Google accounts, `sub` never does.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uk ON users (google_sub) WHERE google_sub IS NOT NULL;
