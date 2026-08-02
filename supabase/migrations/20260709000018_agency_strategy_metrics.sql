-- Agency Scoreboard: a flexible set of manager-entered key metrics, since each
-- agency tracks different things (e.g. "Events delivered" for I3X, "Products
-- built" for Itek). Stored as a simple label/value list, edited from the same
-- "Edit strategy" modal as Objectives/Monthly Goals.
ALTER TABLE agency_strategy
  ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '[]'::jsonb;
