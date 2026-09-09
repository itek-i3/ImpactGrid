-- Some businesses tracked under one agency (e.g. ACR) are themselves a
-- separate agency on this platform (e.g. itek runs its own workspace but is
-- also tracked as one of ACR's portfolio businesses). linked_agency_id ties
-- a business row to that real agency, so its finance figures are the SAME
-- daily_finance rows either side reads or writes -- not a separate copy
-- that can drift out of sync.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS linked_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_linked_agency ON businesses(linked_agency_id) WHERE linked_agency_id IS NOT NULL;

-- Grants read/write on another agency's daily_finance rows only when that
-- agency is linked to one of MY agency's business rows. One-directional:
-- the linked agency does not gain any access to mine.
CREATE OR REPLACE FUNCTION has_linked_finance_access(target_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses
    WHERE agency_id = get_my_agency_id() AND linked_agency_id = target_agency_id
  );
$$;

DROP POLICY IF EXISTS daily_finance_select ON daily_finance;
CREATE POLICY daily_finance_select ON daily_finance
  FOR SELECT USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id() OR has_linked_finance_access(agency_id)
  );

DROP POLICY IF EXISTS daily_finance_insert ON daily_finance;
CREATE POLICY daily_finance_insert ON daily_finance
  FOR INSERT WITH CHECK (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id() OR has_linked_finance_access(agency_id)
  );

DROP POLICY IF EXISTS daily_finance_update ON daily_finance;
CREATE POLICY daily_finance_update ON daily_finance
  FOR UPDATE USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id() OR has_linked_finance_access(agency_id)
  );

DROP POLICY IF EXISTS daily_finance_delete ON daily_finance;
CREATE POLICY daily_finance_delete ON daily_finance
  FOR DELETE USING (
    get_my_role() = 'superadmin' OR agency_id = get_my_agency_id() OR has_linked_finance_access(agency_id)
  );

-- Linking a business grants that business's owning agency read/write access
-- to the linked agency's finance data — the linked agency never opted in, so
-- this is restricted to superadmins rather than left to any agency manager
-- (who could otherwise link to any other agency's id and silently gain
-- access to its financial data).
CREATE OR REPLACE FUNCTION enforce_linked_agency_superadmin_only()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.linked_agency_id IS NOT NULL AND get_my_role() <> 'superadmin' THEN
      RAISE EXCEPTION 'Only a superadmin can link a business to another agency';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.linked_agency_id IS DISTINCT FROM OLD.linked_agency_id AND get_my_role() <> 'superadmin' THEN
      RAISE EXCEPTION 'Only a superadmin can link a business to another agency';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_linked_agency_guard ON businesses;
CREATE TRIGGER businesses_linked_agency_guard
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION enforce_linked_agency_superadmin_only();
