-- Favorites folders ("All my X" / "Default Folder" / user folders). Additive and idempotent.
--
-- Folders are personal, like the favorites they hold, and typed: an ads folder
-- never holds shops. A favorite with folder_id NULL is in the Default Folder,
-- so every existing row lands there without a backfill, and deleting a folder
-- returns its items to the Default Folder instead of unsaving them.
CREATE TABLE IF NOT EXISTS favorite_folders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('shop','ad','email')),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS favorite_folders_uk
  ON favorite_folders (workspace_id, user_id, entity_type, lower(name));

ALTER TABLE favorites ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES favorite_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS favorites_folder_ix ON favorites (folder_id) WHERE folder_id IS NOT NULL;
