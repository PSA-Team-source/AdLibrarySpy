-- AdLibrarySpy core schema. Multi-tenant: every business row carries workspace_id.
-- Applied by `npm run migrate` (lib/db.ts:migrate). Idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- identity ----------
CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  email_norm      text GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash   text,
  name            text NOT NULL DEFAULT '',
  email_verified_at timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_norm_uk ON users (email_norm);

CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_uk ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_ix ON sessions (user_id) WHERE revoked_at IS NULL;

-- single-use tokens: email verification + password reset
CREATE TABLE IF NOT EXISTS user_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_tokens_hash_uk ON user_tokens (token_hash);

-- ---------- tenancy ----------
CREATE TABLE IF NOT EXISTS plans (
  id              text PRIMARY KEY,              -- 'starter' | 'pro' | 'business'
  name            text NOT NULL,
  blurb           text NOT NULL DEFAULT '',
  sort_order      int  NOT NULL DEFAULT 0,
  price_cents     int  NOT NULL,                 -- monthly list price
  currency        text NOT NULL DEFAULT 'usd',
  seats_included  int  NOT NULL DEFAULT 1,
  extra_seat_cents int NOT NULL DEFAULT 0,
  -- Stripe price ids per billing interval; NULL until provisioned.
  stripe_price_monthly   text,
  stripe_price_quarterly text,
  stripe_price_yearly    text,
  -- limits: NULL value = unlimited, 0 = feature off
  limits          jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  slug               text NOT NULL,
  owner_user_id      uuid NOT NULL REFERENCES users(id),
  plan_id            text NOT NULL REFERENCES plans(id) DEFAULT 'free',
  stripe_customer_id text,
  trial_ends_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_uk ON workspaces (slug);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_stripe_cust_uk ON workspaces (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('owner','admin','member')),
  invited_by   uuid REFERENCES users(id),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_ix ON workspace_members (user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        text NOT NULL,
  role         text NOT NULL CHECK (role IN ('admin','member')),
  token_hash   text NOT NULL,
  invited_by   uuid NOT NULL REFERENCES users(id),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_uk ON invitations (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_uk
  ON invitations (workspace_id, lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ---------- billing ----------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  plan_id                text NOT NULL REFERENCES plans(id),
  status                 text NOT NULL,          -- Stripe status verbatim
  interval               text NOT NULL DEFAULT 'month',
  quantity               int  NOT NULL DEFAULT 1,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  canceled_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_uk ON subscriptions (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_ws_ix ON subscriptions (workspace_id);

CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  number            text,
  description       text NOT NULL DEFAULT '',
  amount_due_cents  int  NOT NULL DEFAULT 0,
  amount_paid_cents int  NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'usd',
  status            text NOT NULL,
  hosted_invoice_url text,
  invoice_pdf       text,
  period_start      timestamptz,
  period_end        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_stripe_uk ON invoices (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS invoices_ws_ix ON invoices (workspace_id, created_at DESC);

-- Every Stripe event we processed, so replays are no-ops.
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- credits ----------
-- Recurring allowance per billing period + non-expiring recharge balance.
CREATE TABLE IF NOT EXISTS credit_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,
  granted       bigint NOT NULL DEFAULT 0,
  used          bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS credit_periods_ws_start_uk ON credit_periods (workspace_id, period_start);
CREATE INDEX IF NOT EXISTS credit_periods_ws_ix ON credit_periods (workspace_id, period_end DESC);

-- Append-only. Positive delta = grant/top-up, negative = spend.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            bigserial PRIMARY KEY,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id),
  bucket        text NOT NULL CHECK (bucket IN ('recurring','recharge')),
  delta         bigint NOT NULL,
  reason        text NOT NULL,          -- 'filter' | 'page' | 'api' | 'grant' | 'topup' | ...
  ref           text,                   -- idempotency / correlation key
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_ws_ix ON credit_ledger (workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_ref_uk ON credit_ledger (workspace_id, ref) WHERE ref IS NOT NULL;

-- Non-expiring purchased balance, one row per workspace.
CREATE TABLE IF NOT EXISTS credit_balance (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  recharge     bigint NOT NULL DEFAULT 0 CHECK (recharge >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- API keys ----------
CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_prefix   text NOT NULL,              -- shown in UI, e.g. ml_live_a1b2c3
  key_hash     text NOT NULL,
  scopes       text[] NOT NULL DEFAULT '{}',
  created_by   uuid NOT NULL REFERENCES users(id),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uk ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_ws_ix ON api_keys (workspace_id) WHERE revoked_at IS NULL;

-- ---------- product data (per workspace) ----------
CREATE TABLE IF NOT EXISTS favorites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('shop','ad','email')),
  entity_id    text NOT NULL,
  shared       boolean NOT NULL DEFAULT false,   -- visible to the whole workspace
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS favorites_uk ON favorites (workspace_id, user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS favorites_ws_ix ON favorites (workspace_id, entity_type);

CREATE TABLE IF NOT EXISTS trackers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shop_id      text NOT NULL,
  domain       text NOT NULL,
  name         text NOT NULL DEFAULT '',
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trackers_uk ON trackers (workspace_id, shop_id);
CREATE INDEX IF NOT EXISTS trackers_ws_ix ON trackers (workspace_id);

-- Real observed metrics per tracked brand. The change feed is computed by
-- diffing consecutive rows -- nothing here is synthesised.
CREATE TABLE IF NOT EXISTS tracker_snapshots (
  id           bigserial PRIMARY KEY,
  tracker_id   uuid NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  metrics      jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS tracker_snapshots_ix ON tracker_snapshots (tracker_id, captured_at DESC);

-- ---------- audit ----------
CREATE TABLE IF NOT EXISTS audit_log (
  id           bigserial PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  target       text,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_ws_ix ON audit_log (workspace_id, created_at DESC);
