-- Run this in your Supabase SQL editor to enable Direct Messaging and Member visibility
--
-- 1. Update profiles select policy to allow approved members to view other profiles in the same agency
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR get_my_role() = 'superadmin'
    OR (is_approved() AND agency_id = get_my_agency_id())
  );

-- 2. Update chat messages select policy to support private DMs (channel starts with 'dm:')
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    (
      NOT (channel LIKE 'dm:%')
      AND EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = chat_messages.workspace_id
          AND (
            get_my_role() = 'superadmin'
            OR w.agency_id = get_my_agency_id()
          )
      )
    )
    OR (
      channel LIKE 'dm:%'
      AND (
        channel LIKE '%' || auth.uid()::text || '%'
        OR get_my_role() = 'superadmin'
      )
    )
  );

-- 3. Update chat messages insert policy to support private DMs
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        NOT (channel LIKE 'dm:%')
        AND EXISTS (
          SELECT 1 FROM workspaces w
          WHERE w.id = chat_messages.workspace_id
            AND (
              get_my_role() = 'superadmin'
              OR w.agency_id = get_my_agency_id()
            )
        )
      )
      OR (
        channel LIKE 'dm:%'
        AND (
          channel LIKE '%' || auth.uid()::text || '%'
          OR get_my_role() = 'superadmin'
        )
      )
    )
  );
