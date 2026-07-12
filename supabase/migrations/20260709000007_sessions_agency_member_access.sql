-- Let admin-granted members see teammates' focus sessions too (not only users
-- whose profiles.agency_id matches the workspace's agency). Uses is_agency_member.
DROP POLICY IF EXISTS "sessions_read" ON sessions;
CREATE POLICY "sessions_read" ON sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = sessions.workspace_id
      AND is_agency_member(w.agency_id)
  )
);
