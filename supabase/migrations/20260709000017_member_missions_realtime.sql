-- Enable realtime for member_missions so the homepage "My Tasks This Week"
-- card updates live (e.g. when a message posted in the Daily Tasks chat
-- channel is bridged into a task) without requiring a page reload.
ALTER TABLE member_missions REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE member_missions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
