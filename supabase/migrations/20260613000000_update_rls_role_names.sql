-- ── 0. FIX SCHEMA: ADD MISSING COLUMN TO DAILY_TASKS ──────────────────────────
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE;

-- ── 1. UPDATE AGENCIES POLICIES ──────────────────────────────────────────────
DROP POLICY IF EXISTS agencies_modify ON agencies;
CREATE POLICY agencies_modify ON agencies
  FOR ALL USING (get_my_role() = 'superadmin');

-- ── 2. UPDATE PROFILES POLICIES ──────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING (get_my_role() = 'superadmin');

-- ── 3. UPDATE MEMBER_INVITATIONS POLICIES ─────────────────────────────────────
DROP POLICY IF EXISTS invitations_select ON member_invitations;
CREATE POLICY invitations_select ON member_invitations
  FOR SELECT USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS invitations_insert ON member_invitations;
CREATE POLICY invitations_insert ON member_invitations
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS invitations_update ON member_invitations;
CREATE POLICY invitations_update ON member_invitations
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS invitations_delete ON member_invitations;
CREATE POLICY invitations_delete ON member_invitations
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

-- ── 4. UPDATE DAILY_TASKS POLICIES ────────────────────────────────────────────
DROP POLICY IF EXISTS daily_tasks_select ON daily_tasks;
CREATE POLICY daily_tasks_select ON daily_tasks
  FOR SELECT USING (
    get_my_role() = 'superadmin'
    OR agency_id = get_my_agency_id()
  );

DROP POLICY IF EXISTS daily_tasks_insert ON daily_tasks;
CREATE POLICY daily_tasks_insert ON daily_tasks
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
    OR (get_my_role() = 'member' AND is_approved()
        AND user_id = auth.uid()
        AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS daily_tasks_update ON daily_tasks;
CREATE POLICY daily_tasks_update ON daily_tasks
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
    OR (get_my_role() = 'member' AND is_approved()
        AND user_id = auth.uid()
        AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS daily_tasks_delete ON daily_tasks;
CREATE POLICY daily_tasks_delete ON daily_tasks
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
    OR (get_my_role() = 'member' AND user_id = auth.uid())
  );

-- Daily Tasks policies from daily_tasks.sql
DROP POLICY IF EXISTS head_agency_tasks ON daily_tasks;
CREATE POLICY head_agency_tasks ON daily_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.agency_id = daily_tasks.agency_id
        AND profiles.role = 'manager'
        AND profiles.approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.agency_id = daily_tasks.agency_id
        AND profiles.role = 'manager'
        AND profiles.approved = true
    )
  );

DROP POLICY IF EXISTS admin_all_tasks ON daily_tasks;
CREATE POLICY admin_all_tasks ON daily_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'superadmin'
        AND profiles.approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'superadmin'
        AND profiles.approved = true
    )
  );

-- ── 5. UPDATE THE 10 OPERATION TABLES POLICIES ─────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'monthly_targets','projects','losses','expenses','revenue_models',
    'rate_card','receivables','growth_projections','growth_levers','innovation_items'
  ] LOOP
    -- SELECT
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_select ON %I;
      CREATE POLICY %I_select ON %I
        FOR SELECT USING (
          get_my_role() = 'superadmin'
          OR (is_approved() AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);

    -- INSERT
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_insert ON %I;
      CREATE POLICY %I_insert ON %I
        FOR INSERT WITH CHECK (
          get_my_role() = 'superadmin'
          OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);

    -- UPDATE
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_update ON %I;
      CREATE POLICY %I_update ON %I
        FOR UPDATE USING (
          get_my_role() = 'superadmin'
          OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);

    -- DELETE
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_delete ON %I;
      CREATE POLICY %I_delete ON %I
        FOR DELETE USING (
          get_my_role() = 'superadmin'
          OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;
