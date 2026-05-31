-- ImpactNotion — Supabase Database Schema Migration
-- Initializes workspaces, pages, blocks, databases, properties, rows, views, forms, and submissions with RLS and indexing.

-- ── 1. CORE SCHEMAS AND EXTENSIONS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. TABLES DEFINITIONS ─────────────────────────────────────────────────────

-- WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🚀',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WORKSPACE MEMBERS TABLE (Cross-reference relation)
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'viewer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- PAGES TABLE
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT DEFAULT '📄',
  cover_url TEXT,
  is_database BOOLEAN NOT NULL DEFAULT FALSE,
  database_type TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BLOCKS TABLE
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DATABASES TABLE
CREATE TABLE IF NOT EXISTS databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DATABASE PROPERTIES TABLE
CREATE TABLE IF NOT EXISTS database_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DATABASE ROWS TABLE
CREATE TABLE IF NOT EXISTS database_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  cells JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DATABASE VIEWS TABLE
CREATE TABLE IF NOT EXISTS database_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'table',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FORMS TABLE
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Form',
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FORM SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  database_row_id UUID REFERENCES database_rows(id) ON DELETE CASCADE,
  submitted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. INDEXES FOR PERFORMANCE ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_workspace ON pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_block_id);
CREATE INDEX IF NOT EXISTS idx_databases_page ON databases(page_id);
CREATE INDEX IF NOT EXISTS idx_databases_workspace ON databases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_db_properties_db ON database_properties(database_id);
CREATE INDEX IF NOT EXISTS idx_db_rows_db ON database_rows(database_id);
CREATE INDEX IF NOT EXISTS idx_db_views_db ON database_views(database_id);
CREATE INDEX IF NOT EXISTS idx_forms_db ON forms(database_id);
CREATE INDEX IF NOT EXISTS idx_submissions_form ON form_submissions(form_id);

-- ── 4. STORED PROCEDURES ──────────────────────────────────────────────────────

-- RPC function to atomically update single key in row cells JSONB object
CREATE OR REPLACE FUNCTION update_row_cell(row_id UUID, property_id TEXT, cell_value JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE database_rows
  SET cells = jsonb_set(COALESCE(cells, '{}'::jsonb), ARRAY[property_id], cell_value, true),
      updated_at = NOW()
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;

-- Security definer function to avoid RLS recursion when querying workspace_members
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID, u_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = ws_id AND user_id = u_id
  );
END;
$$ LANGUAGE plpgsql;

-- ── 5. AUTOMATIC MODIFICATION TIME TRIGGERS ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_modtime BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_pages_modtime BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_blocks_modtime BEFORE UPDATE ON blocks FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_databases_modtime BEFORE UPDATE ON databases FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_database_properties_modtime BEFORE UPDATE ON database_properties FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_database_rows_modtime BEFORE UPDATE ON database_rows FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_database_views_modtime BEFORE UPDATE ON database_views FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_forms_modtime BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ── 6. ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Workspaces Policies
CREATE POLICY select_workspaces ON workspaces
  FOR SELECT USING (
    is_workspace_member(id, auth.uid())
  );

CREATE POLICY insert_workspaces ON workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY update_workspaces ON workspaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY delete_workspaces ON workspaces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Workspace Members Policies
CREATE POLICY select_workspace_members ON workspace_members
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY modify_workspace_members ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspace_members.workspace_id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Pages Policies
CREATE POLICY select_pages ON pages
  FOR SELECT USING (
    is_public = true OR
    is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY modify_pages ON pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = pages.workspace_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- Blocks Policies
CREATE POLICY select_blocks ON blocks
  FOR SELECT USING (
    page_id IN (SELECT id FROM pages WHERE is_public = true) OR
    page_id IN (SELECT id FROM pages WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

CREATE POLICY modify_blocks ON blocks
  FOR ALL USING (
    page_id IN (SELECT id FROM pages WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')))
  );

-- Databases Policies
CREATE POLICY select_databases ON databases
  FOR SELECT USING (
    is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY modify_databases ON databases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = databases.workspace_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- Database Properties Policies
CREATE POLICY select_database_properties ON database_properties
  FOR SELECT USING (
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

CREATE POLICY modify_database_properties ON database_properties
  FOR ALL USING (
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')))
  );

-- Database Rows Policies
CREATE POLICY select_database_rows ON database_rows
  FOR SELECT USING (
    database_id IN (SELECT d.id FROM databases d JOIN pages p ON d.page_id = p.id WHERE p.is_public = true) OR
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

CREATE POLICY modify_database_rows ON database_rows
  FOR ALL USING (
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')))
  );

-- Database Views Policies
CREATE POLICY select_database_views ON database_views
  FOR SELECT USING (
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

CREATE POLICY modify_database_views ON database_views
  FOR ALL USING (
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')))
  );

-- Forms Policies
CREATE POLICY select_forms ON forms
  FOR SELECT USING (
    is_public = true OR
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

CREATE POLICY modify_forms ON forms
  FOR ALL USING (
    database_id IN (SELECT id FROM databases WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')))
  );

-- Form Submissions Policies
CREATE POLICY insert_form_submissions ON form_submissions
  FOR INSERT WITH CHECK (
    form_id IN (SELECT id FROM forms WHERE is_public = true)
  );

CREATE POLICY select_form_submissions ON form_submissions
  FOR SELECT USING (
    form_id IN (SELECT f.id FROM forms f JOIN databases d ON f.database_id = d.id WHERE d.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );
