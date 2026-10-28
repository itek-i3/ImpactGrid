-- Links an ImpactFund investor to the matching prospect in ACR's own
-- investor pipeline (potential_investors). The same real investor is
-- often tracked in both: ACR courting them for a portfolio business,
-- ImpactFund recording what they've actually put into the fund — this
-- lets a manager mark "this is the same person/org" instead of the two
-- staying unconnected. Optional, and only ever set for type='investor'
-- contributors — donors have no ACR counterpart to link to.
--
-- Visibility follows potential_investors' own RLS: an ImpactFund manager
-- who isn't also a member of the ACR agency simply won't see ACR's
-- investors to link against (an empty list, not an error) — the same
-- policy already governs that table, nothing new to grant here.
ALTER TABLE fund_contributors
  ADD COLUMN IF NOT EXISTS potential_investor_id UUID REFERENCES potential_investors(id) ON DELETE SET NULL;
