-- Monthly goals: a shorter-cycle companion to the yearly Strategic Objectives,
-- shown on the homepage next to Vision & Mission. Same RLS as the rest of
-- agency_strategy (managers/superadmins write, agency members read).
ALTER TABLE agency_strategy
  ADD COLUMN IF NOT EXISTS monthly_goals JSONB NOT NULL DEFAULT '[]'::jsonb;
