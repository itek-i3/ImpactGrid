-- Let admin-granted members (rows in agency_members) use group chat + see the
-- workspace, not only users whose profiles.agency_id matches. Uses is_agency_member.

DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT USING (
  (channel NOT LIKE 'dm:%' AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id)))
  OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
);

DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    (channel NOT LIKE 'dm:%' AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id)))
    OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
  )
);

DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE USING (
  (get_my_role() = 'superadmin' OR auth.uid() = user_id) AND (
    (channel NOT LIKE 'dm:%' AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id)))
    OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
  )
);

DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE USING (
  (get_my_role() IN ('manager', 'superadmin') OR auth.uid() = user_id) AND (
    (channel NOT LIKE 'dm:%' AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id)))
    OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
  )
);

-- Granted members can see the agency's workspace (needed for chat to load).
DROP POLICY IF EXISTS workspaces_select ON workspaces;
CREATE POLICY workspaces_select ON workspaces FOR SELECT USING (is_agency_member(agency_id));
