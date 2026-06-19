-- Run in Supabase SQL Editor to enable chat emoji reactions

CREATE TABLE IF NOT EXISTS chat_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reactions
CREATE POLICY "Authenticated users can view chat reactions"
  ON chat_reactions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only add/remove their own reactions
CREATE POLICY "Users can manage own reactions"
  ON chat_reactions FOR ALL
  USING (auth.uid() = user_id);
