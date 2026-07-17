-- Pages & blocks: honour admin-granted agency access.
--
-- Every other collaborative feature (chat, finance, meetings, acquisition,
-- sessions) was repointed to is_agency_member(agency_id) so that members granted
-- access to an agency via the agency_members table can collaborate. Pages and
-- blocks were missed — their write policies still keyed off get_my_agency_id()
-- (the user's SINGLE primary agency), so an admin-granted manager could VIEW a
-- workspace's pages but never create/edit/delete them.
--
-- This repoints the six page/block WRITE policies to is_agency_member(). Editing
-- stays limited to superadmins and managers (members remain read-only); the only
-- change is that a manager's agency check now includes admin-granted agencies.
-- Read policies already allow anyone who can see the workspace, so they're left
-- as-is.
--
-- It also clears the legacy init-era policies (select_pages/modify_pages/
-- select_blocks/modify_blocks), which the agency refactor renamed but never
-- dropped. They key off the now-unused workspace_members table (so they grant
-- nothing today), but removing them makes the policies below the sole authority.

-- ── clear legacy (workspace_members-based) policies ──────────────────────────
DROP POLICY IF EXISTS select_pages ON pages;
DROP POLICY IF EXISTS modify_pages ON pages;
DROP POLICY IF EXISTS select_blocks ON blocks;
DROP POLICY IF EXISTS modify_blocks ON blocks;

-- ── pages (write) ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS pages_insert ON pages;
CREATE POLICY pages_insert ON pages
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND is_agency_member(agency_id)))
  );

DROP POLICY IF EXISTS pages_update ON pages;
CREATE POLICY pages_update ON pages
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND is_agency_member(agency_id)))
  );

DROP POLICY IF EXISTS pages_delete ON pages;
CREATE POLICY pages_delete ON pages
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND is_agency_member(agency_id)))
  );

-- ── blocks (write) ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS blocks_insert ON blocks;
CREATE POLICY blocks_insert ON blocks
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND is_agency_member(w.agency_id)))
  );

DROP POLICY IF EXISTS blocks_update ON blocks;
CREATE POLICY blocks_update ON blocks
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND is_agency_member(w.agency_id)))
  );

DROP POLICY IF EXISTS blocks_delete ON blocks;
CREATE POLICY blocks_delete ON blocks
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND is_agency_member(w.agency_id)))
  );
