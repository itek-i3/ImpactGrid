-- ImpactFund agency module — one self-contained migration, run top to
-- bottom. (Earlier drafts split this across several files that depended on
-- each other's tables already existing; if you only ran the latest one out
-- of order you'd hit "relation ... does not exist" — this file replaces all
-- of them and creates everything, in the right order, in one pass.)
--
-- Members and investors/donors are both just name records — a person can
-- start paying their membership fee before anyone creates them a login.
-- Everything else (who's a member, who backed which project, the whole
-- money trail) is read from fund_contributions, one append-only table:
-- a total is always SUM(amount) filtered to an id, never a stored balance.

DROP TABLE IF EXISTS fund_contributions CASCADE;
DROP TABLE IF EXISTS fund_members CASCADE;
DROP TABLE IF EXISTS fund_contributors CASCADE;
DROP TABLE IF EXISTS fund_projects CASCADE;
DROP TABLE IF EXISTS fund_settings CASCADE;

-- ── 1. fund_members — people paying into the fund; not accounts ───────────
CREATE TABLE fund_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  contact    TEXT,
  notes      TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fund_members_agency ON fund_members(agency_id, created_at DESC);

ALTER TABLE fund_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_members_select ON fund_members FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_members_write ON fund_members FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

CREATE TRIGGER update_fund_members_modtime BEFORE UPDATE ON fund_members
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE fund_members REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. fund_contributors — investors and donors; not members, no vote ──────
CREATE TABLE fund_contributors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('investor', 'donor')),
  name            TEXT NOT NULL,
  contact         TEXT,
  expected_return TEXT, -- e.g. "12% annually" — investors only; blank for donors
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fund_contributors_agency ON fund_contributors(agency_id, type, created_at DESC);

ALTER TABLE fund_contributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_contributors_select ON fund_contributors FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_contributors_write ON fund_contributors FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

CREATE TRIGGER update_fund_contributors_modtime BEFORE UPDATE ON fund_contributors
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE fund_contributors REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_contributors; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. fund_projects — what the fund is raising/spending money on ──────────
CREATE TABLE fund_projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  summary        TEXT,
  target_amount  NUMERIC,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fund_projects_agency ON fund_projects(agency_id, created_at DESC);

ALTER TABLE fund_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_projects_select ON fund_projects FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_projects_write ON fund_projects FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

CREATE TRIGGER update_fund_projects_modtime BEFORE UPDATE ON fund_projects
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE fund_projects REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_projects; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. fund_settings — just the membership fee, edited inline on Members ──
CREATE TABLE fund_settings (
  agency_id       UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  membership_fee  NUMERIC NOT NULL DEFAULT 5000, -- the chama's actual joining fee
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fund_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_settings_select ON fund_settings FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_settings_write ON fund_settings FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

ALTER TABLE fund_settings REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_settings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. fund_contributions — the one money-in ledger everything reads from ──
CREATE TABLE fund_contributions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  member_id      UUID REFERENCES fund_members(id) ON DELETE SET NULL,
  contributor_id UUID REFERENCES fund_contributors(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES fund_projects(id) ON DELETE SET NULL, -- null = not earmarked to a project
  category       TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('membership', 'monthly', 'project', 'investment', 'donation', 'general')),
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  description    TEXT,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fund_contributions_one_source CHECK (
    (member_id IS NOT NULL AND contributor_id IS NULL) OR (member_id IS NULL AND contributor_id IS NOT NULL)
  )
);

CREATE INDEX idx_fund_contributions_agency ON fund_contributions(agency_id, created_at DESC);
CREATE INDEX idx_fund_contributions_member ON fund_contributions(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX idx_fund_contributions_contributor ON fund_contributions(contributor_id) WHERE contributor_id IS NOT NULL;
CREATE INDEX idx_fund_contributions_project ON fund_contributions(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE fund_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY fund_contributions_select ON fund_contributions FOR SELECT USING (is_agency_member(agency_id));
CREATE POLICY fund_contributions_write ON fund_contributions FOR ALL USING (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
) WITH CHECK (
  get_my_role() = 'superadmin' OR (get_my_role() = 'manager' AND is_agency_member(agency_id))
);

ALTER TABLE fund_contributions REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE fund_contributions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
