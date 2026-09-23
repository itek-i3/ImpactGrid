-- Personal pages — lets any workspace member (including role 'member', who is
-- otherwise read-only on the shared Pages tree) create pages that only they
-- can see, open, or edit. Reuses the existing pages/blocks tables so personal
-- pages get the full page editor for free; a page is just tagged
-- `is_personal` and locked to its creator instead of the usual
-- role/agency-based sharing.
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_pages_personal_owner ON pages(created_by) WHERE is_personal = true;

-- ── pages ──────────────────────────────────────────────────────────────────
-- A personal page is visible only to the user who created it — not even other
-- managers/superadmins in the same agency — while non-personal pages keep the
-- existing agency-wide read / manager-or-superadmin-write behaviour.
DROP POLICY IF EXISTS pages_select ON pages;
CREATE POLICY pages_select ON pages
  FOR SELECT USING (
    (is_personal AND created_by = auth.uid())
    OR (NOT is_personal AND (
      is_public = true
      OR EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id)
    ))
  );

DROP POLICY IF EXISTS pages_insert ON pages;
CREATE POLICY pages_insert ON pages
  FOR INSERT WITH CHECK (
    (is_personal AND created_by = auth.uid())
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND is_agency_member(agency_id)))
  );

DROP POLICY IF EXISTS pages_update ON pages;
CREATE POLICY pages_update ON pages
  FOR UPDATE USING (
    (is_personal AND created_by = auth.uid())
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND is_agency_member(agency_id)))
  );

DROP POLICY IF EXISTS pages_delete ON pages;
CREATE POLICY pages_delete ON pages
  FOR DELETE USING (
    (is_personal AND created_by = auth.uid())
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND is_agency_member(agency_id)))
  );

-- ── blocks ─────────────────────────────────────────────────────────────────
-- blocks_select already keys off "does pages RLS let me see the owning page",
-- so it inherits the personal-page restriction above with no change. Writes
-- need the same owner carve-out the pages policies just got.
DROP POLICY IF EXISTS blocks_insert ON blocks;
CREATE POLICY blocks_insert ON blocks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM pages WHERE id = blocks.page_id AND is_personal AND created_by = auth.uid())
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND is_agency_member(w.agency_id)))
  );

DROP POLICY IF EXISTS blocks_update ON blocks;
CREATE POLICY blocks_update ON blocks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM pages WHERE id = blocks.page_id AND is_personal AND created_by = auth.uid())
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND is_agency_member(w.agency_id)))
  );

DROP POLICY IF EXISTS blocks_delete ON blocks;
CREATE POLICY blocks_delete ON blocks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM pages WHERE id = blocks.page_id AND is_personal AND created_by = auth.uid())
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND is_agency_member(w.agency_id)))
  );
