-- Shops › "Hide from Shops". Workspace-wide, like trackers: a shop one member
-- hides is gone from the explorer for the whole workspace until un-hidden.
CREATE TABLE IF NOT EXISTS hidden_shops (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shop_id      text NOT NULL,
  domain       text NOT NULL DEFAULT '',
  name         text NOT NULL DEFAULT '',
  hidden_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, shop_id)
);
