-- Weekly-recurring meetings: a meeting either happens once ('none') or repeats
-- every week on the same weekday + time ('weekly').
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none';

DO $$
BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_recurrence_chk
    CHECK (recurrence IN ('none', 'weekly'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
