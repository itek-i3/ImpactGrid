-- Personal Finance: a budget category can now be marked "recurring" so its
-- amount carries forward into future months automatically until either an
-- explicit row exists for that later month, or the user turns recurrence
-- off (which itself writes an explicit non-recurring row, see
-- resolveMonthBudgets in PersonalFinancePanel.js for the resolution logic).

ALTER TABLE personal_budgets ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;
