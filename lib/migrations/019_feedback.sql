-- In-app feedback (header "Feedback" button). The row is the record; the email
-- to the team is a copy. emailed_at stays NULL until a send succeeds, and every
-- later submission retries the unsent rows (lib/feedback.ts), so a mail outage
-- never loses a message.
CREATE TABLE IF NOT EXISTS feedback (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  email        text NOT NULL,
  page         text,
  message      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  emailed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS feedback_unsent ON feedback (created_at) WHERE emailed_at IS NULL;
