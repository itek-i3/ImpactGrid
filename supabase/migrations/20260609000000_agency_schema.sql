-- ImpactGrid — Agency-Centric Schema
-- Replaces the old workspace/Notion schema with the three-tier role model:
--   admin       → reads and writes everything across all agencies
--   agency_head → reads and writes everything for their own agency only
--   member      → reads their agency's dashboard, writes only their own daily tasks
-- Agency heads are the gatekeepers: they approve member invitations.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TEAR DOWN OLD WORKSPACE SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS form_submissions        CASCADE;
DROP TABLE IF EXISTS forms                   CASCADE;
DROP TABLE IF EXISTS database_views          CASCADE;
DROP TABLE IF EXISTS database_rows           CASCADE;
DROP TABLE IF EXISTS database_properties     CASCADE;
DROP TABLE IF EXISTS databases               CASCADE;
DROP TABLE IF EXISTS blocks                  CASCADE;
DROP TABLE IF EXISTS pages                   CASCADE;
DROP TABLE IF EXISTS workspace_members       CASCADE;
DROP TABLE IF EXISTS workspaces              CASCADE;

DROP FUNCTION IF EXISTS is_workspace_member(UUID, UUID);
DROP FUNCTION IF EXISTS is_workspace_owner(UUID, UUID);
DROP FUNCTION IF EXISTS update_row_cell(UUID, TEXT, JSONB);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AGENCIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  logo_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO agencies (slug, name, logo_url) VALUES
  ('itek',      'iTek',                  '/ITEK.png'),
  ('i3x',       'i3x Africa',            '/I3xAfrica.png'),
  ('i3studios',  'i3 Studios',            '/I3Studios.png'),
  ('assets',    'Assets',                '/PRODUCTIONSASSESTS.png'),
  ('i3kingdom', 'i3 Launchpad',          '/I3LAUNCHPAD LOGO.png'),
  ('i3plus',    'i3+',                   '/i3plus.png')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES  (one row per auth user)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  agency_id   UUID REFERENCES agencies(id) ON DELETE SET NULL,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'agency_head', 'member')),
  approved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatically create a profile row when a new user signs up.
-- The agency slug comes from user_metadata set during signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, agency_id, approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    (SELECT id FROM agencies WHERE slug = NEW.raw_user_meta_data->>'agency'),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'agency_head') THEN TRUE
      ELSE FALSE
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Keep updated_at current on profiles
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_modtime ON profiles;
CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. HELPER FUNCTIONS  (SECURITY DEFINER to avoid RLS recursion)
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the calling user's agency_id (NULL for admins, they bypass anyway)
CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid();
$$;

-- Returns the calling user's role string
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Returns TRUE if the calling user is an approved member of any agency
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(approved, FALSE) FROM profiles WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MEMBER INVITATIONS
--    Agency heads create invitations; members redeem them to get approved.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  accepted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DAILY TASKS  (members can write only their own rows)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_daily_tasks_modtime ON daily_tasks;
CREATE TRIGGER update_daily_tasks_modtime
  BEFORE UPDATE ON daily_tasks
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. AGENCY DATA TABLES
--    Each table carries agency_id so RLS can scope reads/writes by agency.
-- ─────────────────────────────────────────────────────────────────────────────

-- Monthly revenue targets vs actuals
CREATE TABLE IF NOT EXISTS monthly_targets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,          -- 'Jan', 'Feb', …
  year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  goal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual      NUMERIC(15,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, year, month)
);
DROP TRIGGER IF EXISTS update_monthly_targets_modtime ON monthly_targets;
CREATE TRIGGER update_monthly_targets_modtime
  BEFORE UPDATE ON monthly_targets FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Projects / deliverables
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  owner       TEXT,
  goal        TEXT,
  current     NUMERIC(15,2) DEFAULT 0,
  target      NUMERIC(15,2) DEFAULT 0,
  unit        TEXT DEFAULT 'units',
  status      TEXT NOT NULL DEFAULT 'On track'
              CHECK (status IN ('On track','At risk','Behind','Completed')),
  due_date    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_projects_modtime ON projects;
CREATE TRIGGER update_projects_modtime
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Revenue losses
CREATE TABLE IF NOT EXISTS losses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  note        TEXT,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense categories
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  month       TEXT,
  year        INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_expenses_modtime ON expenses;
CREATE TRIGGER update_expenses_modtime
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Revenue models / streams
CREATE TABLE IF NOT EXISTS revenue_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  tracked     BOOLEAN NOT NULL DEFAULT TRUE,
  mtd         NUMERIC(15,2) DEFAULT 0,
  share       NUMERIC(5,2)  DEFAULT 0,   -- % of total revenue
  trend       NUMERIC(5,2)  DEFAULT 0,   -- % change MoM
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_revenue_models_modtime ON revenue_models;
CREATE TRIGGER update_revenue_models_modtime
  BEFORE UPDATE ON revenue_models FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Rate card / pricing
CREATE TABLE IF NOT EXISTS rate_card (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  service     TEXT NOT NULL,
  rate        NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'per project',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_rate_card_modtime ON rate_card;
CREATE TRIGGER update_rate_card_modtime
  BEFORE UPDATE ON rate_card FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Receivables / outstanding invoices
CREATE TABLE IF NOT EXISTS receivables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client      TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','overdue','paid')),
  invoice_ref TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_receivables_modtime ON receivables;
CREATE TRIGGER update_receivables_modtime
  BEFORE UPDATE ON receivables FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Growth projections (annual targets per stream)
CREATE TABLE IF NOT EXISTS growth_projections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  stream      TEXT NOT NULL,
  target      NUMERIC(15,2) NOT NULL DEFAULT 0,
  year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_growth_projections_modtime ON growth_projections;
CREATE TRIGGER update_growth_projections_modtime
  BEFORE UPDATE ON growth_projections FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Growth levers (strategic initiatives)
CREATE TABLE IF NOT EXISTS growth_levers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  lever       TEXT NOT NULL,
  target      TEXT,
  owner       TEXT,
  timeline    TEXT,
  status      TEXT NOT NULL DEFAULT 'Planned'
              CHECK (status IN ('Planned','In Progress','Done','Blocked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_growth_levers_modtime ON growth_levers;
CREATE TRIGGER update_growth_levers_modtime
  BEFORE UPDATE ON growth_levers FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Innovation board items
CREATE TABLE IF NOT EXISTS innovation_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'Idea'
              CHECK (stage IN ('Idea','Prototype','Pilot','Scaling')),
  owner       TEXT,
  impact      TEXT,
  next_step   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS update_innovation_items_modtime ON innovation_items;
CREATE TRIGGER update_innovation_items_modtime
  BEFORE UPDATE ON innovation_items FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_agency     ON profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user    ON daily_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_agency  ON daily_tasks(agency_id);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_ag  ON monthly_targets(agency_id);
CREATE INDEX IF NOT EXISTS idx_projects_agency     ON projects(agency_id);
CREATE INDEX IF NOT EXISTS idx_losses_agency       ON losses(agency_id);
CREATE INDEX IF NOT EXISTS idx_expenses_agency     ON expenses(agency_id);
CREATE INDEX IF NOT EXISTS idx_rev_models_agency   ON revenue_models(agency_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_agency    ON rate_card(agency_id);
CREATE INDEX IF NOT EXISTS idx_receivables_agency  ON receivables(agency_id);
CREATE INDEX IF NOT EXISTS idx_growth_proj_agency  ON growth_projections(agency_id);
CREATE INDEX IF NOT EXISTS idx_growth_levers_ag    ON growth_levers(agency_id);
CREATE INDEX IF NOT EXISTS idx_innovation_agency   ON innovation_items(agency_id);
CREATE INDEX IF NOT EXISTS idx_invitations_agency  ON member_invitations(agency_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email   ON member_invitations(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE agencies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_targets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE losses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_models     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card          ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_levers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation_items   ENABLE ROW LEVEL SECURITY;

-- ── agencies (everyone logged-in can read; only admin can write) ──────────────
DROP POLICY IF EXISTS agencies_select ON agencies;
CREATE POLICY agencies_select ON agencies
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS agencies_modify ON agencies;
CREATE POLICY agencies_modify ON agencies
  FOR ALL USING (get_my_role() = 'admin');

-- ── profiles ─────────────────────────────────────────────────────────────────
-- A user can always see their own profile.
-- admin sees all. agency_head sees profiles in their agency.
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    id = auth.uid()                                        -- own row
    OR get_my_role() = 'admin'                             -- admin sees all
    OR (get_my_role() = 'agency_head'
        AND agency_id = get_my_agency_id())                -- head sees their agency
  );

-- Users can update only their own profile (name, etc.).
-- admin and agency_head can also update role/approval for members in their scope.
DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
  );

-- Only admins can delete profiles.
DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_delete ON profiles
  FOR DELETE USING (get_my_role() = 'admin');

-- ── member_invitations ────────────────────────────────────────────────────────
-- agency_head can create and view invitations for their agency.
-- admin can see/manage all. Members cannot touch this table.
DROP POLICY IF EXISTS invitations_select ON member_invitations;
CREATE POLICY invitations_select ON member_invitations
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS invitations_insert ON member_invitations;
CREATE POLICY invitations_insert ON member_invitations
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS invitations_update ON member_invitations;
CREATE POLICY invitations_update ON member_invitations
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS invitations_delete ON member_invitations;
CREATE POLICY invitations_delete ON member_invitations
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
  );

-- ── daily_tasks ───────────────────────────────────────────────────────────────
-- admin: full access everywhere.
-- agency_head: full access for their agency.
-- member: can only read/write/delete their OWN rows in their agency.
DROP POLICY IF EXISTS daily_tasks_select ON daily_tasks;
CREATE POLICY daily_tasks_select ON daily_tasks
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR agency_id = get_my_agency_id()   -- head and approved member see agency tasks
  );

DROP POLICY IF EXISTS daily_tasks_insert ON daily_tasks;
CREATE POLICY daily_tasks_insert ON daily_tasks
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
    OR (get_my_role() = 'member' AND is_approved()
        AND user_id = auth.uid()
        AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS daily_tasks_update ON daily_tasks;
CREATE POLICY daily_tasks_update ON daily_tasks
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
    OR (get_my_role() = 'member' AND is_approved()
        AND user_id = auth.uid()
        AND agency_id = get_my_agency_id())
  );

DROP POLICY IF EXISTS daily_tasks_delete ON daily_tasks;
CREATE POLICY daily_tasks_delete ON daily_tasks
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
    OR (get_my_role() = 'member' AND user_id = auth.uid())
  );

-- ── Macro for the agency data tables ─────────────────────────────────────────
-- All 10 financial/operational tables follow the same pattern:
--   SELECT : admin OR (approved user in same agency)
--   INSERT/UPDATE/DELETE : admin OR agency_head in same agency

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'monthly_targets','projects','losses','expenses','revenue_models',
    'rate_card','receivables','growth_projections','growth_levers','innovation_items'
  ] LOOP
    -- SELECT
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_select ON %I;
      CREATE POLICY %I_select ON %I
        FOR SELECT USING (
          get_my_role() = 'admin'
          OR (is_approved() AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);

    -- INSERT
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_insert ON %I;
      CREATE POLICY %I_insert ON %I
        FOR INSERT WITH CHECK (
          get_my_role() = 'admin'
          OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);

    -- UPDATE
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_update ON %I;
      CREATE POLICY %I_update ON %I
        FOR UPDATE USING (
          get_my_role() = 'admin'
          OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);

    -- DELETE
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I_delete ON %I;
      CREATE POLICY %I_delete ON %I
        FOR DELETE USING (
          get_my_role() = 'admin'
          OR (get_my_role() = 'agency_head' AND agency_id = get_my_agency_id())
        );
    $f$, tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;
