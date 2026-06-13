-- Allow anyone to read the list of agencies (including unauthenticated anonymous users during signup)
DROP POLICY IF EXISTS agencies_select ON agencies;
CREATE POLICY agencies_select ON agencies
  FOR SELECT USING (true);
