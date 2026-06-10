-- Daily tasks: per-user, per-agency
CREATE TABLE IF NOT EXISTS daily_tasks (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id   text        NOT NULL,
  task        text        NOT NULL,
  outcome     text        NOT NULL DEFAULT '',
  priority    text        NOT NULL DEFAULT 'Medium',
  done        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- Each user can fully manage their own tasks
CREATE POLICY "own_tasks" ON daily_tasks
  FOR ALL
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Agency head can read and write all tasks in their agency
CREATE POLICY "head_agency_tasks" ON daily_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.agency_id = daily_tasks.agency_id
        AND profiles.role = 'agency_head'
        AND profiles.approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.agency_id = daily_tasks.agency_id
        AND profiles.role = 'agency_head'
        AND profiles.approved = true
    )
  );

-- Admin can access all tasks across every agency
CREATE POLICY "admin_all_tasks" ON daily_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.approved = true
    )
  );
