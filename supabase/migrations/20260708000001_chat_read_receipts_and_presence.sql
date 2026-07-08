-- Read receipts (WhatsApp-style ticks) and online presence for chat.

-- ── PRESENCE ─────────────────────────────────────────────────────────────────
-- Each client bumps its own last_seen_at on a heartbeat; a user is considered
-- "online" if their last_seen_at is within the app's online window (~60s).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ── READ RECEIPTS ────────────────────────────────────────────────────────────
-- One row per (channel, user). The recipient advances last_delivered_at when
-- their client receives messages and last_read_at when they actually view the
-- conversation. The sender derives each message's tick state by comparing the
-- other participant's timestamps against the message's created_at:
--   read (blue ✓✓)      → partner.last_read_at      >= message.created_at
--   delivered (grey ✓✓) → partner.last_delivered_at >= message.created_at
--   sent (single ✓)     → otherwise
-- Defaults are the epoch so a delivered-only upsert never implies "read".
CREATE TABLE IF NOT EXISTS chat_reads (
  channel           TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at      TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  last_delivered_at TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_reads_channel ON chat_reads(channel);

ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;

-- SELECT: you can read your own row, or the other participant's row in a DM you
-- belong to (the channel name encodes both participant ids — same pattern the
-- chat_messages DM policies use).
DROP POLICY IF EXISTS chat_reads_select ON chat_reads;
CREATE POLICY chat_reads_select ON chat_reads
  FOR SELECT USING (
    user_id = auth.uid()
    OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
  );

-- INSERT / UPDATE: you may only write your own receipt row.
DROP POLICY IF EXISTS chat_reads_insert ON chat_reads;
CREATE POLICY chat_reads_insert ON chat_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_reads_update ON chat_reads;
CREATE POLICY chat_reads_update ON chat_reads
  FOR UPDATE USING (user_id = auth.uid());

-- Broadcast receipt changes over Realtime (poll fallback also covers this).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_reads;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
