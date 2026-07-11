-- Restrict Daily Finance to managers and superadmins. Members of the agency can
-- no longer read or write finance rows (the UI also hides the tab for them).
DROP POLICY IF EXISTS daily_finance_select ON daily_finance;
CREATE POLICY daily_finance_select ON daily_finance FOR SELECT USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

DROP POLICY IF EXISTS daily_finance_insert ON daily_finance;
CREATE POLICY daily_finance_insert ON daily_finance FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

DROP POLICY IF EXISTS daily_finance_update ON daily_finance;
CREATE POLICY daily_finance_update ON daily_finance FOR UPDATE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

DROP POLICY IF EXISTS daily_finance_delete ON daily_finance;
CREATE POLICY daily_finance_delete ON daily_finance FOR DELETE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
