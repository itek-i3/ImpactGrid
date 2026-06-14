-- Add channel column to existing chat_messages table
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'random';

-- Index for fast per-channel queries within a workspace
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel
  ON chat_messages(workspace_id, channel);
