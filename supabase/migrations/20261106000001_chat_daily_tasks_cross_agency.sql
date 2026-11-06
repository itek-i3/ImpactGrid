-- Daily Tasks becomes one company-wide feed: every approved user, in any of
-- the 9 agencies, can read and post regardless of which workspace they're
-- currently viewing. weekly_tasks, random, and DMs are untouched.
--
-- UPDATE/DELETE are reproduced byte-identical to the previously-active policy
-- (20260709000006_chat_agency_member_access.sql) — moderation stays
-- agency-scoped even though visibility doesn't: a manager in one agency still
-- can't delete another agency's person's post. An author editing/deleting
-- their own daily_tasks post still passes trivially either way.
--
-- `get_my_role() = 'superadmin' OR is_approved()` rather than bare
-- is_approved() — so a superadmin can never be accidentally locked out of the
-- one global channel if their `approved` flag isn't set, matching how every
-- other policy in this codebase treats superadmins as an unconditional
-- bypass (see is_agency_member()).

DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    (channel = 'daily_tasks' AND (get_my_role() = 'superadmin' OR is_approved()))
    OR (
      channel NOT LIKE 'dm:%' AND channel <> 'daily_tasks'
      AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id))
    )
    OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
  );

DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      (channel = 'daily_tasks' AND (get_my_role() = 'superadmin' OR is_approved()))
      OR (
        channel NOT LIKE 'dm:%' AND channel <> 'daily_tasks'
        AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id))
      )
      OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
    )
  );

DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (
    (get_my_role() = 'superadmin' OR auth.uid() = user_id) AND (
      (channel NOT LIKE 'dm:%' AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id)))
      OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
    )
  );

DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (
    (get_my_role() IN ('manager', 'superadmin') OR auth.uid() = user_id) AND (
      (channel NOT LIKE 'dm:%' AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = chat_messages.workspace_id AND is_agency_member(w.agency_id)))
      OR (channel LIKE 'dm:%' AND channel LIKE '%' || auth.uid()::text || '%')
    )
  );
