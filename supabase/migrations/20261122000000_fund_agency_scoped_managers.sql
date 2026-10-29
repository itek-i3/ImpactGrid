-- Lets a manager hand full ImpactFund access (view + edit) to specific
-- people without touching their global profiles.role — so promoting them
-- here can never make them a manager of some other, unrelated agency they
-- might also belong to. The grant lives on their agency_members row for
-- this one agency (role = 'manager'), set via the existing
-- /api/agencies/[id]/members endpoint (admin client, so no new RLS write
-- path is needed for agency_members itself).
--
-- is_agency_manager() is the one place that now answers "can this caller
-- manage this agency's fund" — every fund_* write policy below swaps its
-- old `get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND
-- is_agency_member(agency_id))` check for this, so a global manager keeps
-- working exactly as before and a per-agency manager gets the same rights,
-- scoped to just this agency_id.

CREATE OR REPLACE FUNCTION is_agency_manager(target UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target IS NOT NULL AND (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
    OR ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager' AND is_agency_member(target))
    OR EXISTS (SELECT 1 FROM agency_members WHERE user_id = auth.uid() AND agency_id = target AND role = 'manager')
  );
$$;

-- fund_members
DROP POLICY IF EXISTS fund_members_write ON fund_members;
CREATE POLICY fund_members_write ON fund_members FOR ALL USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_contributors
DROP POLICY IF EXISTS fund_contributors_write ON fund_contributors;
CREATE POLICY fund_contributors_write ON fund_contributors FOR ALL USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_projects (delete stays superadmin-only — unaffected, not reissued here)
DROP POLICY IF EXISTS fund_projects_insert ON fund_projects;
CREATE POLICY fund_projects_insert ON fund_projects FOR INSERT WITH CHECK (
  is_agency_manager(agency_id)
);
DROP POLICY IF EXISTS fund_projects_update ON fund_projects;
CREATE POLICY fund_projects_update ON fund_projects FOR UPDATE USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_settings
DROP POLICY IF EXISTS fund_settings_write ON fund_settings;
CREATE POLICY fund_settings_write ON fund_settings FOR ALL USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_contributions
DROP POLICY IF EXISTS fund_contributions_write ON fund_contributions;
CREATE POLICY fund_contributions_write ON fund_contributions FOR ALL USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_loans
DROP POLICY IF EXISTS fund_loans_write ON fund_loans;
CREATE POLICY fund_loans_write ON fund_loans FOR ALL USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_loan_repayments
DROP POLICY IF EXISTS fund_loan_repayments_write ON fund_loan_repayments;
CREATE POLICY fund_loan_repayments_write ON fund_loan_repayments FOR ALL USING (
  is_agency_manager(agency_id)
) WITH CHECK (
  is_agency_manager(agency_id)
);

-- fund_project_pledges (self-service branch for a member's own pledge is preserved)
DROP POLICY IF EXISTS fund_project_pledges_insert ON fund_project_pledges;
CREATE POLICY fund_project_pledges_insert ON fund_project_pledges FOR INSERT WITH CHECK (
  is_agency_manager(agency_id)
  OR (is_my_fund_member(member_id) AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS fund_project_pledges_update ON fund_project_pledges;
CREATE POLICY fund_project_pledges_update ON fund_project_pledges FOR UPDATE USING (
  is_agency_manager(agency_id)
  OR (is_my_fund_member(member_id) AND is_agency_member(agency_id))
) WITH CHECK (
  is_agency_manager(agency_id)
  OR (is_my_fund_member(member_id) AND is_agency_member(agency_id))
);
DROP POLICY IF EXISTS fund_project_pledges_delete ON fund_project_pledges;
CREATE POLICY fund_project_pledges_delete ON fund_project_pledges FOR DELETE USING (
  is_agency_manager(agency_id)
);
