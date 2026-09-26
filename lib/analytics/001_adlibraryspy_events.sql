-- ClickHouse DDL — AdLibrarySpy growth funnel (dashboard DB), 2026-09-25.
--
-- Written DIRECTLY and best-effort by lib/analytics/events.ts (one row per event,
-- async_insert so ClickHouse batches server-side). NOT a source of truth: users,
-- workspace_members, invitations and the users.signup_ref / first_*_at columns in
-- Postgres (lib/migrations/011) are. A dropped row here is a missing metric only.
--
-- Events: signup (ref), first_save, first_track, invite_sent, invite_accepted.
-- Report queries: research/launch-2026-09/FUNNEL.md.
--
-- Apply as a ClickHouse user with DDL rights (the app's read/insert account has none):
--   clickhouse-client --multiquery < 001_adlibraryspy_events.sql

CREATE TABLE IF NOT EXISTS dashboard.adlibraryspy_events
(
    `event_id`     UUID,
    `occurred_at`  DateTime64(3, 'UTC'),
    `event`        LowCardinality(String),          -- signup | first_save | first_track | invite_sent | invite_accepted
    `user_id`      String,
    `workspace_id` String DEFAULT '',
    `ref_source`   LowCardinality(String) DEFAULT '', -- als_ref before the first ':' (share | seo | weekly | ext | utm | invite)
    `ref`          String DEFAULT '',                 -- full als_ref value, max 120 chars
    `props`        String DEFAULT ''                  -- small JSON object, event-specific
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (event, occurred_at, event_id)
SETTINGS index_granularity = 8192;

GRANT INSERT, SELECT ON dashboard.adlibraryspy_events TO analyst;
