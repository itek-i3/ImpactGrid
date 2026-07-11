-- Treat users the superadmin granted access to (rows in agency_members) as real
-- members of that agency for RLS — not only users whose profiles.agency_id matches.
-- Fixes shared spaces (finance / acquisition / meetings) not being visible or
-- syncing for granted members.

-- Parameter is named `target` to match the pre-existing function signature
-- (CREATE OR REPLACE cannot rename an input parameter).
CREATE OR REPLACE FUNCTION is_agency_member(target UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target IS NOT NULL AND (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND agency_id = target)
    OR EXISTS (SELECT 1 FROM agency_members WHERE user_id = auth.uid() AND agency_id = target)
  );
$$;

-- ── daily_finance (fully collaborative) ──────────────────────────────────────
DROP POLICY IF EXISTS daily_finance_select ON daily_finance;
CREATE POLICY daily_finance_select ON daily_finance FOR SELECT USING (is_agency_member(agency_id));
DROP POLICY IF EXISTS daily_finance_insert ON daily_finance;
CREATE POLICY daily_finance_insert ON daily_finance FOR INSERT WITH CHECK (is_agency_member(agency_id));
DROP POLICY IF EXISTS daily_finance_update ON daily_finance;
CREATE POLICY daily_finance_update ON daily_finance FOR UPDATE USING (is_agency_member(agency_id));
DROP POLICY IF EXISTS daily_finance_delete ON daily_finance;
CREATE POLICY daily_finance_delete ON daily_finance FOR DELETE USING (is_agency_member(agency_id));

-- ── acquisition_evaluations (fully collaborative) ────────────────────────────
DROP POLICY IF EXISTS acq_evals_select ON acquisition_evaluations;
CREATE POLICY acq_evals_select ON acquisition_evaluations FOR SELECT USING (is_agency_member(agency_id));
DROP POLICY IF EXISTS acq_evals_insert ON acquisition_evaluations;
CREATE POLICY acq_evals_insert ON acquisition_evaluations FOR INSERT WITH CHECK (is_agency_member(agency_id));
DROP POLICY IF EXISTS acq_evals_update ON acquisition_evaluations;
CREATE POLICY acq_evals_update ON acquisition_evaluations FOR UPDATE USING (is_agency_member(agency_id));
DROP POLICY IF EXISTS acq_evals_delete ON acquisition_evaluations;
CREATE POLICY acq_evals_delete ON acquisition_evaluations FOR DELETE USING (is_agency_member(agency_id));

-- ── meetings (organizer + manager/superadmin for edit/delete) ────────────────
DROP POLICY IF EXISTS meetings_select ON meetings;
CREATE POLICY meetings_select ON meetings FOR SELECT USING (is_agency_member(agency_id));
DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings FOR INSERT WITH CHECK (created_by = auth.uid() AND is_agency_member(agency_id));
DROP POLICY IF EXISTS meetings_update ON meetings;
CREATE POLICY meetings_update ON meetings FOR UPDATE USING (
  get_my_role() = 'superadmin' OR created_by = auth.uid()
  OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS meetings_delete ON meetings;
CREATE POLICY meetings_delete ON meetings FOR DELETE USING (
  get_my_role() = 'superadmin' OR created_by = auth.uid()
  OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
