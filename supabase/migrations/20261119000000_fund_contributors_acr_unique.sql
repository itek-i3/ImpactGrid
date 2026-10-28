-- The investor list is now sourced straight from ACR's potential_investors
-- pipeline instead of being added by hand and optionally linked after —
-- FundContributorsPanel provisions one fund_contributors row per ACR
-- investor automatically, with zero contribution, the first time anyone
-- opens the page after a new one shows up there. This unique pair keeps
-- two concurrent page loads from ever provisioning the same ACR investor
-- twice; donors and any manually-added investor (an account that can't
-- see ACR at all) always carry a NULL potential_investor_id, and Postgres
-- never treats two NULLs as a conflict, so neither is constrained by this.
ALTER TABLE fund_contributors
  ADD CONSTRAINT fund_contributors_acr_link_unique UNIQUE (agency_id, potential_investor_id);
