-- Let authors edit and delete their own chat messages.
-- Keeps the existing manager/superadmin "delete any / clear channel" ability.

-- Track whether a message has been edited (shows an "edited" hint in the UI).
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT false;

-- UPDATE: the author can edit their own message (superadmin may edit any),
-- as long as the message belongs to a workspace in their agency.
DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (
    (get_my_role() = 'superadmin' OR auth.uid() = user_id)
    AND EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = chat_messages.workspace_id
        AND (get_my_role() = 'superadmin' OR w.agency_id = get_my_agency_id())
    )
  );

-- DELETE: the author can delete their own message; managers and superadmins can
-- delete any message — all scoped to the message's agency workspace.
DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (
    (get_my_role() IN ('manager', 'superadmin') OR auth.uid() = user_id)
    AND EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = chat_messages.workspace_id
        AND (get_my_role() = 'superadmin' OR w.agency_id = get_my_agency_id())
    )
  );

-- Realtime edits/deletes: the "old" row must carry the filter columns
-- (workspace_id / channel) so subscribers receive UPDATE and DELETE events.
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
