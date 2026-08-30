-- Rename the "revenue target" concept to "income target" — the panel tracks
-- income, not revenue. Data-preserving: ALTER TABLE ... RENAME TO keeps all
-- rows, RLS policies, indexes, and supabase_realtime publication membership
-- intact (tracked by relation OID, not name). Policies/index renamed too,
-- purely so their names stay consistent — optional but cheap.

ALTER TABLE personal_revenue_targets RENAME TO personal_income_targets;
ALTER INDEX idx_personal_revenue_targets_user_month RENAME TO idx_personal_income_targets_user_month;
ALTER POLICY personal_revenue_targets_select ON personal_income_targets RENAME TO personal_income_targets_select;
ALTER POLICY personal_revenue_targets_insert ON personal_income_targets RENAME TO personal_income_targets_insert;
ALTER POLICY personal_revenue_targets_update ON personal_income_targets RENAME TO personal_income_targets_update;
ALTER POLICY personal_revenue_targets_delete ON personal_income_targets RENAME TO personal_income_targets_delete;
