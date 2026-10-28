-- Lets a member set their own goal for a project. Pledges used to be
-- manager/superadmin-only (set in bulk for everyone via "Set goals"); a
-- member can now insert/update just their own row — matched the same way
-- My Profile and Projects resolve "which fund_members row is me": their
-- account's email against fund_members.login_email, never contact.
--
-- Deleting a pledge stays manager/superadmin-only. A member can set or
-- raise/lower their own goal but can't blank it out via this path — same
-- as the amount > 0 check already on the table.

CREATE OR REPLACE FUNCTION is_my_fund_member(target UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target IS NOT NULL AND EXISTS (
    SELECT 1 FROM fund_members fm JOIN profiles p ON p.id = auth.uid()
    WHERE fm.id = target AND p.email IS NOT NULL AND lower(trim(fm.login_email)) = lower(trim(p.email))
  );
$$;

DROP POLICY IF EXISTS fund_project_pledges_write ON fund_project_pledges;

CREATE POLICY fund_project_pledges_insert ON fund_project_pledges FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin'
  OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  OR (is_my_fund_member(member_id) AND is_agency_member(agency_id))
);
CREATE POLICY fund_project_pledges_update ON fund_project_pledges FOR UPDATE USING (
  get_my_role() = 'superadmin'
  OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  OR (is_my_fund_member(member_id) AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin'
  OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  OR (is_my_fund_member(member_id) AND is_agency_member(agency_id))
);
CREATE POLICY fund_project_pledges_delete ON fund_project_pledges FOR DELETE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
