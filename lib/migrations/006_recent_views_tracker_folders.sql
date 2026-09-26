-- Home "Recents" + Brandtracker folders. Additive and idempotent.

-- One row per (user, entity) in a workspace; re-opening a dossier bumps
-- viewed_at. label/image are what the dossier showed at view time, so the
-- Home card renders from Postgres alone without re-querying the market index.
CREATE TABLE IF NOT EXISTS recent_views (
  id           bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('shop','ad','advertiser','email')),
  entity_id    text NOT NULL,
  label        text NOT NULL DEFAULT '',
  image        text NOT NULL DEFAULT '',
  view_count   integer NOT NULL DEFAULT 1,
  viewed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS recent_views_uk ON recent_views (workspace_id, user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS recent_views_user_ix ON recent_views (workspace_id, user_id, entity_type, viewed_at DESC);

-- Brandtracker folders (workspace-shared, like the trackers themselves).
CREATE TABLE IF NOT EXISTS tracker_folders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tracker_folders_uk ON tracker_folders (workspace_id, lower(name));

ALTER TABLE trackers ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES tracker_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trackers_folder_ix ON trackers (folder_id) WHERE folder_id IS NOT NULL;
