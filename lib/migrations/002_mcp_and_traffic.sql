-- OAuth 2.1 + PKCE for the MCP server, and the licensed-traffic cache.

-- ---------- OAuth 2.1 (MCP connectors) ----------
CREATE TABLE IF NOT EXISTS oauth_clients (
  id            text PRIMARY KEY,                 -- client_id
  name          text NOT NULL,
  redirect_uris text[] NOT NULL,
  -- Public clients (Claude, ChatGPT) use PKCE and hold no secret.
  is_public     boolean NOT NULL DEFAULT true,
  secret_hash   text,
  scopes        text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz
);

-- Short-lived authorization codes. PKCE challenge is mandatory.
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash             text PRIMARY KEY,
  client_id             text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  redirect_uri          text NOT NULL,
  scopes                text[] NOT NULL,
  code_challenge        text NOT NULL,
  code_challenge_method text NOT NULL CHECK (code_challenge_method = 'S256'),
  expires_at            timestamptz NOT NULL,
  consumed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          text NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  access_token_hash  text NOT NULL,
  refresh_token_hash text,
  scopes             text[] NOT NULL,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_tokens_access_uk  ON oauth_tokens (access_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_tokens_refresh_uk ON oauth_tokens (refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS oauth_tokens_ws_ix ON oauth_tokens (workspace_id) WHERE revoked_at IS NULL;

-- ---------- licensed traffic ----------
-- Cache of the licensed provider's response. `source` records WHICH provider
-- measured it; rows are only ever written from a real provider response, so a
-- missing row means "not measured" and the UI renders nothing.
CREATE TABLE IF NOT EXISTS traffic_monthly (
  domain     text NOT NULL,
  month      date NOT NULL,               -- first day of the month
  visits     bigint NOT NULL,
  source     text NOT NULL,               -- 'similarweb' | 'semrush'
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, month, source)
);
CREATE INDEX IF NOT EXISTS traffic_monthly_domain_ix ON traffic_monthly (domain, month DESC);

-- Per-domain fetch bookkeeping so we respect provider quotas and don't refetch
-- a domain the provider has no coverage for.
CREATE TABLE IF NOT EXISTS traffic_fetch_log (
  domain       text NOT NULL,
  source       text NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  outcome      text NOT NULL CHECK (outcome IN ('ok','no_coverage','error','quota')),
  detail       text,
  PRIMARY KEY (domain, source)
);
