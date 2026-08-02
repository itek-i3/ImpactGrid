-- Weekly review ritual per agency. One review per (agency, week). Captures wins,
-- challenges, lessons and next-week focus so teams reflect and course-correct.
-- Managers/superadmins of the agency write; every agency member can read.
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,                        -- Monday of the review week
  headline    TEXT,                                 -- one-line summary of the week
  wins        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["Closed 3 clients", …]
  challenges  JSONB NOT NULL DEFAULT '[]'::jsonb,
  lessons     JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_focus  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- focus for next week
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_reviews_agency_week_idx ON weekly_reviews (agency_id, week_start DESC);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_reviews_select ON weekly_reviews;
CREATE POLICY weekly_reviews_select ON weekly_reviews
  FOR SELECT USING (is_agency_member(agency_id));

DROP POLICY IF EXISTS weekly_reviews_write ON weekly_reviews;
CREATE POLICY weekly_reviews_write ON weekly_reviews
  FOR ALL USING (
    get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  ) WITH CHECK (
    get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
  );
