-- Agencies get a proper `kind` column instead of ImpactFund being detected
-- by matching the agency's display name (fragile — renaming the agency
-- silently breaks its sidebar/role-gating, and an unrelated agency named
-- e.g. "Nairobi Impact Fund Network" would get wrongly treated as the
-- module). Existing ImpactFund-named agencies are backfilled once here;
-- isImpactFundAgency() in src/lib/fund/shared.js still falls back to the
-- old name match, but only when kind is unset, so an agency created
-- before this migration and never explicitly re-tagged keeps working.
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS kind TEXT;

UPDATE agencies SET kind = 'impactfund'
WHERE kind IS NULL AND lower(replace(name, ' ', '')) LIKE '%impactfund%';
