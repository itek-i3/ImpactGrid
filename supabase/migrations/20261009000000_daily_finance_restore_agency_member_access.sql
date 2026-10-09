-- 20260909020000_business_linked_agency.sql rewrote the daily_finance policies
-- to add linked-business access, but in doing so it replaced is_agency_member()
-- (agency_members grants — see 20260709000004_agency_member_access.sql) with a
-- plain agency_id = get_my_agency_id() check, and dropped the manager-role gate
-- from 20260709000005_daily_finance_manager_only.sql. Net effect: a manager who
-- can see another agency only because they were granted access via
-- agency_members (not via profiles.agency_id, and not superadmin) silently lost
-- read/write access to that agency's daily_finance rows — e.g. ACR managers no
-- longer saw other agencies' Finance Log entries when selecting their business.
-- This restores both the agency_members grant and the manager-only gate,
-- alongside the linked-business access added in September.
--
-- has_linked_finance_access() itself had a narrower version of the same gap:
-- it only recognised a link owned by MY OWN profiles.agency_id, so a manager
-- who reaches the linking agency (e.g. ACR) only through an agency_members
-- grant would still fail it even once the policies above are fixed. Widen it
-- to any agency I'm a member of (profile match, agency_members grant, or
-- superadmin), via the same is_agency_member() helper.
CREATE OR REPLACE FUNCTION has_linked_finance_access(target_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE linked_agency_id = target_agency_id AND is_agency_member(agency_id)
  );
$$;

DROP POLICY IF EXISTS daily_finance_select ON daily_finance;
CREATE POLICY daily_finance_select ON daily_finance
  FOR SELECT USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND (is_agency_member(agency_id) OR has_linked_finance_access(agency_id)))
  );

DROP POLICY IF EXISTS daily_finance_insert ON daily_finance;
CREATE POLICY daily_finance_insert ON daily_finance
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND (is_agency_member(agency_id) OR has_linked_finance_access(agency_id)))
  );

DROP POLICY IF EXISTS daily_finance_update ON daily_finance;
CREATE POLICY daily_finance_update ON daily_finance
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND (is_agency_member(agency_id) OR has_linked_finance_access(agency_id)))
  );

DROP POLICY IF EXISTS daily_finance_delete ON daily_finance;
CREATE POLICY daily_finance_delete ON daily_finance
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND (is_agency_member(agency_id) OR has_linked_finance_access(agency_id)))
  );
