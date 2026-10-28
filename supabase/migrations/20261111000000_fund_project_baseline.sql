-- Splits ImpactFund's money flows more precisely:
--   • membership fee            → Reserve only, confirmed never earmarked to
--                                 a project (it already wasn't — this just
--                                 adds the category below so that stays true
--                                 going forward too)
--   • monthly chama contribution → Loans & Operations in full now; the
--                                 Fund Account no longer gets an automatic
--                                 share of it (see loans_ops_reserve_pct —
--                                 that's an internal split of this pool, not
--                                 a diversion to Fund Account)
--   • project baseline (NEW)    → a project's own required monthly due,
--                                 owed by every member once a project has
--                                 one set — same model as the chama's own
--                                 monthly instalment, just scoped to one
--                                 project
--   • project (existing)        → stays exactly what it was: whatever extra
--                                 a member chooses to put toward a project,
--                                 on top of any baseline

-- How much of the Loans & Operations pool a manager holds back for running
-- costs instead of lending out — advisory only (nothing enforces it
-- elsewhere), defaults to 0 so nothing changes until a manager sets it.
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loans_ops_reserve_pct NUMERIC NOT NULL DEFAULT 0;

-- Null/0 means this project has no baseline — members only put in whatever
-- extra they choose, same as before.
ALTER TABLE fund_projects ADD COLUMN IF NOT EXISTS baseline_monthly_amount NUMERIC;

ALTER TABLE fund_contributions DROP CONSTRAINT IF EXISTS fund_contributions_category_check;
ALTER TABLE fund_contributions ADD CONSTRAINT fund_contributions_category_check
  CHECK (category IN ('membership', 'monthly', 'project', 'project_baseline', 'investment', 'donation', 'general'));
