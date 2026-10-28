-- ImpactFund loans — eligibility and limits are computed in the app from
-- fund_contributions (nothing new to track for that); this adds the rate/
-- term knobs to fund_settings and the loan + repayment ledger itself.
--
-- A loan's balance is never a stored column — same philosophy as every
-- other fund total — it's always (principal + flat interest) minus
-- SUM(fund_loan_repayments.amount) for that loan.

ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_multiplier NUMERIC NOT NULL DEFAULT 3;      -- loan limit = savings (membership + monthly) × this
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_interest_rate NUMERIC NOT NULL DEFAULT 10;   -- flat %, charged once over the whole term, not compounded
ALTER TABLE fund_settings ADD COLUMN IF NOT EXISTS loan_term_months INTEGER NOT NULL DEFAULT 6;

DROP TABLE IF EXISTS fund_loan_repayments CASCADE;
DROP TABLE IF EXISTS fund_loans CASCADE;

-- ── 1. fund_loans — one row per loan issued; terms are locked in at issue
--      time so editing the chama's default rate later never reprices a
--      loan that's already out ──────────────────────────────────────────
CREATE TABLE fund_loans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES fund_members(id) ON DELETE CASCADE,
  principal     NUMERIC NOT NULL CHECK (principal > 0),
  interest_rate NUMERIC NOT NULL DEFAULT 10,
  term_months   INTEGER NOT NULL DEFAULT 6,
  note          TEXT,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fund_loans_agency ON fund_loans(agency_id, created_at DESC);
CREATE INDEX idx_fund_loans_member ON fund_loans(member_id);

ALTER TABLE fund_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_loans_select ON fund_loans FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_loans_write ON fund_loans FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

CREATE TRIGGER update_fund_loans_modtime BEFORE UPDATE ON fund_loans
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE fund_loans REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_loans; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. fund_loan_repayments — append-only paydown ledger, same shape as
--      fund_contributions: a loan's balance is always derived, never stored ──
CREATE TABLE fund_loan_repayments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  loan_id    UUID NOT NULL REFERENCES fund_loans(id) ON DELETE CASCADE,
  amount     NUMERIC NOT NULL CHECK (amount > 0),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fund_loan_repayments_loan ON fund_loan_repayments(loan_id, created_at DESC);
CREATE INDEX idx_fund_loan_repayments_agency ON fund_loan_repayments(agency_id);

ALTER TABLE fund_loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_loan_repayments_select ON fund_loan_repayments FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_loan_repayments_write ON fund_loan_repayments FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

ALTER TABLE fund_loan_repayments REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_loan_repayments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
