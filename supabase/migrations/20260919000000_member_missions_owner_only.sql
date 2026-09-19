-- A member's mission (Team Member Focus Board / Team missions / My Tasks) is
-- editable only by the member it belongs to.
--
-- 20260709000014_member_missions.sql let any manager in the agency, and any
-- superadmin, write anyone's row as well. Writes are now owner-only.
--
-- Reads are unchanged: member_missions_select (is_agency_member) still lets
-- everyone in the agency — and superadmins, which is_agency_member includes —
-- see the whole board. The Daily Tasks chat bridge writes the sender's own row
-- (service-role client, user_id = the sender), so it is unaffected.
DROP POLICY IF EXISTS member_missions_write ON member_missions;
CREATE POLICY member_missions_write ON member_missions
  FOR ALL USING (
    user_id = auth.uid() AND is_agency_member(agency_id)
  ) WITH CHECK (
    user_id = auth.uid() AND is_agency_member(agency_id)
  );
