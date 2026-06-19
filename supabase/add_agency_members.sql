-- Run this in your Supabase SQL editor to enable multi-agency support

-- 1. Create the agency_members join table
CREATE TABLE IF NOT EXISTS agency_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id  UUID NOT NULL REFERENCES agencies(id)   ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, agency_id)
);

-- 2. Migrate existing profile.agency_id data into agency_members
INSERT INTO agency_members (user_id, agency_id, role)
SELECT id, agency_id, COALESCE(role, 'member')
FROM profiles
WHERE agency_id IS NOT NULL
ON CONFLICT (user_id, agency_id) DO NOTHING;

-- 3. Enable Row Level Security
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS: users can read their own memberships
CREATE POLICY "Users can view own agency memberships"
  ON agency_members FOR SELECT
  USING (auth.uid() = user_id);

-- 5. RLS: superadmins can manage all memberships
CREATE POLICY "Superadmins can manage agency memberships"
  ON agency_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
