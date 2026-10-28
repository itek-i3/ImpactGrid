-- Lets a project be deleted, restricted to superadmin only — unlike every
-- other write on this table, which a manager can also do. The single
-- fund_projects_write FOR ALL policy applied the same manager-or-superadmin
-- check to every command, so it's split into per-command policies here:
-- managers keep insert/update, only superadmin gets delete.
--
-- Deleting cascades/nulls exactly like deleting a member does: fund_contributions.project_id
-- is ON DELETE SET NULL (a backer's contribution stays in the fund's history,
-- it just loses its project tag) and fund_project_pledges.project_id is
-- ON DELETE CASCADE (goals set for a project it go with it).

DROP POLICY IF EXISTS fund_projects_write ON fund_projects;

CREATE POLICY fund_projects_insert ON fund_projects FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
CREATE POLICY fund_projects_update ON fund_projects FOR UPDATE USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);
CREATE POLICY fund_projects_delete ON fund_projects FOR DELETE USING (
  get_my_role() = 'superadmin'
);
