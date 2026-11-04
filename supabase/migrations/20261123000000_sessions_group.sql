-- Group focus sessions: a session can now be shared by several people. Each
-- participant still gets their own row (their own pause/resume/snooze/
-- completion note, exactly like a solo session) — rows that were started
-- together as one group simply share a group_id.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS group_id UUID;
CREATE INDEX IF NOT EXISTS sessions_group_id_idx ON sessions(group_id);
