-- Agency meetings: schedule calendar meetings (with a Google Meet link) that
-- every member of the agency can see and join.

CREATE TABLE IF NOT EXISTS meetings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  meet_link    TEXT,                              -- Google Meet URL (optional)
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  attendee_ids UUID[] NOT NULL DEFAULT '{}',       -- profile ids invited
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_agency ON meetings(agency_id, starts_at);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- SELECT: superadmin sees all; everyone else sees their own agency's meetings.
DROP POLICY IF EXISTS meetings_select ON meetings;
CREATE POLICY meetings_select ON meetings
  FOR SELECT USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id()
  );

-- INSERT: you create meetings you own, within your agency (superadmin anywhere).
DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (get_my_role() = 'superadmin' OR agency_id = get_my_agency_id())
  );

-- UPDATE / DELETE: the organizer, or a manager/superadmin in the agency.
DROP POLICY IF EXISTS meetings_update ON meetings;
CREATE POLICY meetings_update ON meetings
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR created_by = auth.uid()
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS meetings_delete ON meetings;
CREATE POLICY meetings_delete ON meetings
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR created_by = auth.uid()
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

-- Realtime so a scheduled/edited meeting shows up for everyone immediately.
ALTER TABLE meetings REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
