-- Shared acquisition evaluations for the ACR-style deal pipeline.
-- One row per saved evaluation, scoped to an agency so every member of the
-- agency sees and can edit the same pipeline (no per-browser localStorage).

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Multi-agency membership table (idempotent; also created by add_agency_members.sql)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id  UUID NOT NULL REFERENCES agencies(id)   ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, agency_id)
);

-- Membership helper: is the caller in this agency (via agency_members or their
-- primary profile agency)? SECURITY DEFINER avoids RLS recursion.
CREATE OR REPLACE FUNCTION is_agency_member(target UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM agency_members WHERE user_id = auth.uid() AND agency_id = target)
      OR EXISTS (SELECT 1 FROM profiles       WHERE id = auth.uid()      AND agency_id = target);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Evaluations table
--    Structured columns for querying + a JSONB payload holding the full
--    client-side evaluation object (scores, notes, valuation, inputs, evaluator).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acquisition_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name    TEXT    NOT NULL DEFAULT '',
  total            INTEGER NOT NULL DEFAULT 0,
  evaluated_count  INTEGER NOT NULL DEFAULT 0,
  payload          JSONB   NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS acq_evals_agency_idx     ON acquisition_evaluations(agency_id);
CREATE INDEX IF NOT EXISTS acq_evals_created_by_idx ON acquisition_evaluations(created_by);
CREATE INDEX IF NOT EXISTS acq_evals_created_at_idx ON acquisition_evaluations(created_at);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_acq_evals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS acq_evals_updated_at ON acquisition_evaluations;
CREATE TRIGGER acq_evals_updated_at
  BEFORE UPDATE ON acquisition_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_acq_evals_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security
--    Any member of the agency (member / manager) and superadmin can read AND
--    write the agency's evaluations — a shared pipeline everyone maintains.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE acquisition_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acq_evals_select ON acquisition_evaluations;
CREATE POLICY acq_evals_select ON acquisition_evaluations FOR SELECT USING (
  get_my_role() = 'superadmin' OR is_agency_member(agency_id)
);

DROP POLICY IF EXISTS acq_evals_insert ON acquisition_evaluations;
CREATE POLICY acq_evals_insert ON acquisition_evaluations FOR INSERT WITH CHECK (
  get_my_role() = 'superadmin' OR is_agency_member(agency_id)
);

DROP POLICY IF EXISTS acq_evals_update ON acquisition_evaluations;
CREATE POLICY acq_evals_update ON acquisition_evaluations FOR UPDATE USING (
  get_my_role() = 'superadmin' OR is_agency_member(agency_id)
);

DROP POLICY IF EXISTS acq_evals_delete ON acquisition_evaluations;
CREATE POLICY acq_evals_delete ON acquisition_evaluations FOR DELETE USING (
  get_my_role() = 'superadmin' OR is_agency_member(agency_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Realtime
--    Broadcast inserts/updates/deletes so a teammate's changes appear live.
--    REPLICA IDENTITY FULL so DELETE events still carry agency_id for filtering.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE acquisition_evaluations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'acquisition_evaluations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE acquisition_evaluations;
  END IF;
END;
$$;
