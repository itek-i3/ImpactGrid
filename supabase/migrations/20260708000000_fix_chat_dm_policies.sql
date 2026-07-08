-- Tighten DM access so only the actual participants can read and send private chat messages.

DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
  FOR SELECT USING (
    (
      channel NOT LIKE 'dm:%'
      AND EXISTS (
        SELECT 1
        FROM workspaces w
        WHERE w.id = chat_messages.workspace_id
          AND (
            get_my_role() = 'superadmin'
            OR w.agency_id = get_my_agency_id()
          )
      )
    )
    OR (
      channel LIKE 'dm:%'
      AND channel LIKE '%' || auth.uid()::text || '%'
    )
  );

DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        channel NOT LIKE 'dm:%'
        AND EXISTS (
          SELECT 1
          FROM workspaces w
          WHERE w.id = chat_messages.workspace_id
            AND (
              get_my_role() = 'superadmin'
              OR w.agency_id = get_my_agency_id()
            )
        )
      )
      OR (
        channel LIKE 'dm:%'
        AND channel LIKE '%' || auth.uid()::text || '%'
      )
    )
  );

DROP POLICY IF EXISTS chat_messages_update ON chat_messages;
CREATE POLICY chat_messages_update ON chat_messages
  FOR UPDATE USING (
    (get_my_role() = 'superadmin' OR auth.uid() = user_id)
    AND (
      (
        channel NOT LIKE 'dm:%'
        AND EXISTS (
          SELECT 1
          FROM workspaces w
          WHERE w.id = chat_messages.workspace_id
            AND (
              get_my_role() = 'superadmin'
              OR w.agency_id = get_my_agency_id()
            )
        )
      )
      OR (
        channel LIKE 'dm:%'
        AND channel LIKE '%' || auth.uid()::text || '%'
      )
    )
  );

DROP POLICY IF EXISTS chat_messages_delete ON chat_messages;
CREATE POLICY chat_messages_delete ON chat_messages
  FOR DELETE USING (
    (get_my_role() IN ('manager', 'superadmin') OR auth.uid() = user_id)
    AND (
      (
        channel NOT LIKE 'dm:%'
        AND EXISTS (
          SELECT 1
          FROM workspaces w
          WHERE w.id = chat_messages.workspace_id
            AND (
              get_my_role() = 'superadmin'
              OR w.agency_id = get_my_agency_id()
            )
        )
      )
      OR (
        channel LIKE 'dm:%'
        AND channel LIKE '%' || auth.uid()::text || '%'
      )
    )
  );
