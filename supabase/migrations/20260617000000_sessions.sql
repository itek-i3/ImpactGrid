-- Focus sessions: tracks per-user timed work sessions scoped to a workspace

CREATE TABLE IF NOT EXISTS sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_description TEXT        NOT NULL DEFAULT '',
  duration_seconds INTEGER     NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time         TIMESTAMPTZ NOT NULL,
  paused_at        TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'expired', 'logging', 'completed')),
  snooze_count     INTEGER     NOT NULL DEFAULT 0,
  completion_note  TEXT        NOT NULL DEFAULT '',
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_workspace_id_idx ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx      ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_status_idx       ON sessions(status);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_updated_at ON sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_sessions_updated_at();

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_read"   ON sessions;
DROP POLICY IF EXISTS "sessions_insert" ON sessions;
DROP POLICY IF EXISTS "sessions_update" ON sessions;
DROP POLICY IF EXISTS "sessions_delete" ON sessions;

-- Everyone in the same agency can read all sessions for their workspace
CREATE POLICY "sessions_read" ON sessions FOR SELECT USING (
  get_my_role() = 'superadmin'
  OR EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = sessions.workspace_id
      AND w.agency_id = get_my_agency_id()
  )
);

-- Users can only insert their own sessions
CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Users can only update their own sessions
CREATE POLICY "sessions_update" ON sessions FOR UPDATE USING (
  get_my_role() = 'superadmin' OR user_id = auth.uid()
);

-- Users can only delete their own sessions
CREATE POLICY "sessions_delete" ON sessions FOR DELETE USING (
  get_my_role() = 'superadmin' OR user_id = auth.uid()
);
