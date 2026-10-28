-- Lets a member be deleted outright. Their loans and project pledges
-- cascade-delete with them (fund_loans.member_id and
-- fund_project_pledges.member_id are already ON DELETE CASCADE), but their
-- contributions stay — the money already moved and stays in the fund's
-- history, it just loses its name tag (fund_contributions.member_id is
-- already ON DELETE SET NULL).
--
-- That SET NULL used to be impossible, though: fund_contributions_one_source
-- required member_id and contributor_id to be "exactly one set, not both
-- null, not both set" — so the moment a member with any contribution was
-- deleted, the FK's SET NULL action would leave a row with both columns
-- null and the delete would fail outright on the check constraint. The
-- constraint only ever needed to rule out a row claiming BOTH a member and
-- a contributor; "neither, because the member behind it was deleted" is a
-- real, valid state now.
ALTER TABLE fund_contributions DROP CONSTRAINT IF EXISTS fund_contributions_one_source;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_one_source
  CHECK (NOT (member_id IS NOT NULL AND contributor_id IS NOT NULL));
