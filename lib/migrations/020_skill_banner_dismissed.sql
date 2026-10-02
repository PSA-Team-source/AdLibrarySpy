-- The "use AdLibrarySpy from your AI agent" banner (components/AgentSkillAnnouncement.tsx)
-- is hidden for good once the user dismisses it or copies the message, on every device.
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_banner_dismissed_at timestamptz;
