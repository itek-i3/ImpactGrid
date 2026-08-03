-- Superadmins are already treated as members of every agency for data access
-- (is_agency_member() grants them access to any agency regardless of
-- agency_members rows). But UI features that build a "members of this
-- agency" list — e.g. chat contacts / sender-name resolution — query
-- agency_members directly, so a superadmin with no explicit row there is
-- invisible to those lists even though they can read/write the data fine.
-- This ties every superadmin to every agency as a real agency_members row,
-- and keeps that true going forward when either side changes.

-- Backfill: every existing superadmin joins every existing agency.
INSERT INTO agency_members (agency_id, user_id, role)
SELECT a.id, p.id, 'member'
FROM agencies a
CROSS JOIN profiles p
WHERE p.role = 'superadmin'
ON CONFLICT (user_id, agency_id) DO NOTHING;

-- New agency created → add every current superadmin to it.
CREATE OR REPLACE FUNCTION add_superadmins_to_new_agency()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO agency_members (agency_id, user_id, role)
  SELECT NEW.id, p.id, 'member'
  FROM profiles p
  WHERE p.role = 'superadmin'
  ON CONFLICT (user_id, agency_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_superadmins_to_new_agency ON agencies;
CREATE TRIGGER trg_add_superadmins_to_new_agency
  AFTER INSERT ON agencies
  FOR EACH ROW EXECUTE FUNCTION add_superadmins_to_new_agency();

-- Profile created as (or promoted to) superadmin → join every existing agency.
CREATE OR REPLACE FUNCTION add_new_superadmin_to_all_agencies()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'superadmin' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'superadmin') THEN
    INSERT INTO agency_members (agency_id, user_id, role)
    SELECT a.id, NEW.id, 'member'
    FROM agencies a
    ON CONFLICT (user_id, agency_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_new_superadmin_to_all_agencies ON profiles;
CREATE TRIGGER trg_add_new_superadmin_to_all_agencies
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION add_new_superadmin_to_all_agencies();
