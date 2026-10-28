-- "Hope" — a personal, once-a-year ritual on the Home dashboard: one or
-- more objectives for the year, plus one or more plan items per quarter for
-- what moves closer to them. Entirely personal (no agency_id), like
-- Personal Finance — it belongs to the person, not whichever agency
-- they're currently in.
CREATE TABLE IF NOT EXISTS yearly_hopes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  objectives  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["…", "…"]
  quarters    JSONB NOT NULL DEFAULT '{
    "Q1": {"plans": [], "done": false},
    "Q2": {"plans": [], "done": false},
    "Q3": {"plans": [], "done": false},
    "Q4": {"plans": [], "done": false}
  }'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_yearly_hopes_user ON yearly_hopes(user_id, year DESC);

ALTER TABLE yearly_hopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS yearly_hopes_select ON yearly_hopes;
CREATE POLICY yearly_hopes_select ON yearly_hopes FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS yearly_hopes_insert ON yearly_hopes;
CREATE POLICY yearly_hopes_insert ON yearly_hopes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS yearly_hopes_update ON yearly_hopes;
CREATE POLICY yearly_hopes_update ON yearly_hopes FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS yearly_hopes_delete ON yearly_hopes;
CREATE POLICY yearly_hopes_delete ON yearly_hopes FOR DELETE USING (user_id = auth.uid());
