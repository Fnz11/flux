-- ============================================================================
-- 070_notifications.sql
-- Notifications table for the Search and Notification plan (search-notif.md).
-- Owner: notification storage layer.
--
-- Purpose
--   Store per-user notifications (e.g. trade events, vault updates) for the
--   /api/v1/notifications endpoint and /ws/notifications WebSocket push.
--
-- Ordering (see README.md): runs AFTER AutoMigrate has created the base
-- `users` table (guarded via to_regclass). Direct 5432 connection only,
-- never through PgBouncer. All statements are guarded / idempotent, safe to
-- re-run.
-- ============================================================================

-- Fail fast instead of blocking production traffic (README conventions).
SET lock_timeout = '10s';

-- ============================================================================
-- notifications table
--
-- Columns:
--   id         uuid PK (gen_random_uuid)
--   user_id    owning user (FK -> users ON DELETE CASCADE, only if users exists)
--   type       short discriminator, e.g. TRADE / VAULT (varchar(32))
--   title      short human-readable heading (varchar(255))
--   message    full body text (default '')
--   read_at    set when the user has read the notification (NULL = unread)
--   created_at / updated_at
--
-- Indexes: per-user newest-first lookup, plus a partial index supporting the
-- unread count (WHERE read_at IS NULL).
-- ============================================================================

DO $do$
BEGIN
    IF to_regclass('public.notifications') IS NULL THEN
        CREATE TABLE notifications (
            id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id    uuid        NOT NULL,
            type       varchar(32) NOT NULL,
            title      varchar(255) NOT NULL,
            message    text        NOT NULL DEFAULT '',
            read_at    timestamptz NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        IF to_regclass('public.users') IS NOT NULL THEN
            ALTER TABLE notifications
                ADD CONSTRAINT notifications_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
        END IF;
    END IF;
END $do$;

-- ============================================================================
-- Indexes (guarded with IF NOT EXISTS so re-runs are no-ops)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id)
    WHERE read_at IS NULL;