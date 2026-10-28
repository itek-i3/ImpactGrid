-- Deleting a member, contributor, or project used to keep their logged
-- money in the fund's history, just anonymised (member_id/contributor_id/
-- project_id set to NULL) — the right call for a real person or project
-- leaving the fund, since that cash is still real and still sat in an
-- account. The call now is the opposite: once something is deleted,
-- everything about it goes with it, no leftover anonymous rows. Switches
-- all three fund_contributions foreign keys from SET NULL to CASCADE.
ALTER TABLE fund_contributions DROP CONSTRAINT fund_contributions_member_id_fkey;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES fund_members(id) ON DELETE CASCADE;

ALTER TABLE fund_contributions DROP CONSTRAINT fund_contributions_contributor_id_fkey;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_contributor_id_fkey
  FOREIGN KEY (contributor_id) REFERENCES fund_contributors(id) ON DELETE CASCADE;

ALTER TABLE fund_contributions DROP CONSTRAINT fund_contributions_project_id_fkey;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES fund_projects(id) ON DELETE CASCADE;

-- fund_loans.member_id and fund_project_pledges.* already cascade (set up
-- when those tables were created) — only fund_contributions needed to change.
