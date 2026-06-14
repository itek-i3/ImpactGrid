-- ── CHAT MESSAGES SCHEMA ──

-- Create the chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for workspace-scoped message fetching
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace ON chat_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES ──

-- Select policy: Anyone who can access the workspace can see the chat messages
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = chat_messages.workspace_id
        AND (
          get_my_role() = 'superadmin'
          OR w.agency_id = get_my_agency_id()
        )
    )
  );

-- Insert policy: Authenticated users can post messages if they belong to the workspace's agency (or superadmin)
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = chat_messages.workspace_id
        AND (
          get_my_role() = 'superadmin'
          OR w.agency_id = get_my_agency_id()
        )
    )
  );

-- Enable Realtime for the chat_messages table to broadcast inserts in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
