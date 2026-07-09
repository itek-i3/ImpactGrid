-- Shared acquisition evaluations: one agency-wide space (like chat) where every
-- member sees, creates, edits and deletes the same evaluations in real time.
-- The full client-side evaluation object is stored as JSONB in `data`.

CREATE TABLE IF NOT EXISTS acquisition_evaluations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acq_evals_agency ON acquisition_evaluations(agency_id, created_at);

ALTER TABLE acquisition_evaluations ENABLE ROW LEVEL SECURITY;

-- SELECT: superadmin sees all; everyone else sees their agency's evaluations.
DROP POLICY IF EXISTS acq_evals_select ON acquisition_evaluations;
CREATE POLICY acq_evals_select ON acquisition_evaluations
  FOR SELECT USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id()
  );

-- Collaborative model: any member of the agency may create / edit / delete any
-- evaluation in their agency (superadmin anywhere). `created_by` is attribution
-- only, so undo can restore a teammate's record with its original author intact.
DROP POLICY IF EXISTS acq_evals_insert ON acquisition_evaluations;
CREATE POLICY acq_evals_insert ON acquisition_evaluations
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id()
  );

DROP POLICY IF EXISTS acq_evals_update ON acquisition_evaluations;
CREATE POLICY acq_evals_update ON acquisition_evaluations
  FOR UPDATE USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id()
  );

DROP POLICY IF EXISTS acq_evals_delete ON acquisition_evaluations;
CREATE POLICY acq_evals_delete ON acquisition_evaluations
  FOR DELETE USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id()
  );

-- Realtime so a save/edit/delete by one member appears for everyone immediately.
ALTER TABLE acquisition_evaluations REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE acquisition_evaluations;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
