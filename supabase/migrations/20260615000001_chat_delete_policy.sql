-- Allow managers and superadmins to delete chat messages in their workspace
DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (
    get_my_role() IN ('manager', 'superadmin')
    AND EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = chat_messages.workspace_id
        AND (
          get_my_role() = 'superadmin'
          OR w.agency_id = get_my_agency_id()
        )
    )
  );
