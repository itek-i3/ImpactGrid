-- Personal Finance: "Goals & Savings" — financial goals (e.g. a farm
-- project with a target investment) and savings pockets (e.g. a SACCO or a
-- mobile-money savings app) share the same shape: a named "pocket" with an
-- optional target/maturity, and a running ledger of deposits/withdrawals.
-- Balances/progress are always derived from the transaction log rather than
-- stored as a running total, so they can never drift out of sync.

CREATE TABLE IF NOT EXISTS personal_savings_pockets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('goal','savings')),
  term          TEXT CHECK (term IN ('longterm','shortterm')),
  institution   TEXT,
  target_amount NUMERIC,
  maturity_date DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_savings_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pocket_id   UUID NOT NULL REFERENCES personal_savings_pockets(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount      NUMERIC NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_savings_pockets_user ON personal_savings_pockets(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_savings_transactions_user ON personal_savings_transactions(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_savings_transactions_pocket ON personal_savings_transactions(pocket_id);

ALTER TABLE personal_savings_pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_savings_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_savings_pockets_select ON personal_savings_pockets;
CREATE POLICY personal_savings_pockets_select ON personal_savings_pockets FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_savings_pockets_insert ON personal_savings_pockets;
CREATE POLICY personal_savings_pockets_insert ON personal_savings_pockets FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS personal_savings_pockets_update ON personal_savings_pockets;
CREATE POLICY personal_savings_pockets_update ON personal_savings_pockets FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_savings_pockets_delete ON personal_savings_pockets;
CREATE POLICY personal_savings_pockets_delete ON personal_savings_pockets FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_savings_transactions_select ON personal_savings_transactions;
CREATE POLICY personal_savings_transactions_select ON personal_savings_transactions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_savings_transactions_insert ON personal_savings_transactions;
CREATE POLICY personal_savings_transactions_insert ON personal_savings_transactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS personal_savings_transactions_update ON personal_savings_transactions;
CREATE POLICY personal_savings_transactions_update ON personal_savings_transactions FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS personal_savings_transactions_delete ON personal_savings_transactions;
CREATE POLICY personal_savings_transactions_delete ON personal_savings_transactions FOR DELETE USING (user_id = auth.uid());

ALTER TABLE personal_savings_pockets REPLICA IDENTITY FULL;
ALTER TABLE personal_savings_transactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_savings_pockets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE personal_savings_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
