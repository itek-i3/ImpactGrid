-- ── 1. CLEAN UP PREVIOUS NOTION TABLES IF ANY ─────────────────────────────
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- ── 2. CREATE CORE NOTION TABLES WITH AGENCY RELATION ─────────────────────

-- WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT DEFAULT '🚀',
  agency_id   UUID REFERENCES agencies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAGES
CREATE TABLE IF NOT EXISTS pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES pages(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled',
  icon          TEXT DEFAULT '📄',
  cover_url     TEXT,
  is_database   BOOLEAN NOT NULL DEFAULT FALSE,
  database_type TEXT,
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite   BOOLEAN NOT NULL DEFAULT FALSE,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCKS
CREATE TABLE IF NOT EXISTS blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  properties      JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. UPDATE PROFILES ROLE CHECK AND TRIGGERS ────────────────────────────

-- Drop old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;

-- Drop old check constraint on profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new check constraint for three roles: superadmin, manager, member
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('superadmin', 'manager', 'member'));

-- Update default role
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'member';

-- Re-create handle_new_user trigger with the new roles and automatic approval
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, agency_id, role, approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    (SELECT id FROM agencies WHERE slug = NEW.raw_user_meta_data->>'agency'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    TRUE
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 4. ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- WORKSPACES POLICIES
-- Superadmin can read/write everything.
-- Manager/Member can read workspaces for their agency.
-- Manager can write workspaces for their agency.
DROP POLICY IF EXISTS workspaces_select ON workspaces;
CREATE POLICY workspaces_select ON workspaces
  FOR SELECT USING (
    get_my_role() = 'superadmin'
    OR agency_id = get_my_agency_id()
  );

DROP POLICY IF EXISTS workspaces_insert ON workspaces;
CREATE POLICY workspaces_insert ON workspaces
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS workspaces_update ON workspaces;
CREATE POLICY workspaces_update ON workspaces
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS workspaces_delete ON workspaces;
CREATE POLICY workspaces_delete ON workspaces
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND agency_id = get_my_agency_id())
  );

-- PAGES POLICIES
-- Anyone can see public pages.
-- Superadmin/Manager/Member can see pages in workspaces they can access.
-- Superadmin/Manager can write pages.
DROP POLICY IF EXISTS pages_select ON pages;
CREATE POLICY pages_select ON pages
  FOR SELECT USING (
    is_public = true
    OR EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id)
  );

DROP POLICY IF EXISTS pages_insert ON pages;
CREATE POLICY pages_insert ON pages
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND agency_id = get_my_agency_id()))
  );

DROP POLICY IF EXISTS pages_update ON pages;
CREATE POLICY pages_update ON pages
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND agency_id = get_my_agency_id()))
  );

DROP POLICY IF EXISTS pages_delete ON pages;
CREATE POLICY pages_delete ON pages
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM workspaces WHERE id = pages.workspace_id AND agency_id = get_my_agency_id()))
  );

-- BLOCKS POLICIES
-- Anyone can see blocks on pages they can access.
-- Superadmin/Manager can write blocks.
DROP POLICY IF EXISTS blocks_select ON blocks;
CREATE POLICY blocks_select ON blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pages WHERE id = blocks.page_id)
  );

DROP POLICY IF EXISTS blocks_insert ON blocks;
CREATE POLICY blocks_insert ON blocks
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND w.agency_id = get_my_agency_id()))
  );

DROP POLICY IF EXISTS blocks_update ON blocks;
CREATE POLICY blocks_update ON blocks
  FOR UPDATE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND w.agency_id = get_my_agency_id()))
  );

DROP POLICY IF EXISTS blocks_delete ON blocks;
CREATE POLICY blocks_delete ON blocks
  FOR DELETE USING (
    get_my_role() = 'superadmin'
    OR (get_my_role() = 'manager' AND EXISTS (SELECT 1 FROM pages p JOIN workspaces w ON p.workspace_id = w.id WHERE p.id = blocks.page_id AND w.agency_id = get_my_agency_id()))
  );
