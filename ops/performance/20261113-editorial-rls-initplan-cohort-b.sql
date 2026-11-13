-- Cohort B: optimize six exact authenticated Editorial reference-table SELECT policies.
-- No authorization change. Fail closed on any drift.
BEGIN;
SET LOCAL statement_timeout='8000ms';
SET LOCAL lock_timeout='1500ms';
DO $guard$
DECLARE matches integer;
BEGIN
  SELECT count(*) INTO matches FROM pg_policies
  WHERE schemaname='editorial'
    AND ((tablename='citation_locator_types' AND policyname='citation_locator_types_authenticated_read')
      OR (tablename='correction_event_types' AND policyname='correction_event_types_authenticated_read')
      OR (tablename='correction_evidence_roles' AND policyname='correction_evidence_roles_authenticated_read')
      OR (tablename='correction_kinds' AND policyname='correction_kinds_authenticated_read')
      OR (tablename='credit_roles' AND policyname='credit_roles_authenticated_read')
      OR (tablename='source_types' AND policyname='source_types_authenticated_read'))
    AND cmd='SELECT' AND permissive='PERMISSIVE'
    AND roles=ARRAY['authenticated']::name[]
    AND qual='(auth.uid() IS NOT NULL)' AND with_check IS NULL;
  IF matches<>6 THEN RAISE EXCEPTION 'STOP: expected six exact policies, found %',matches; END IF;
END
$guard$;

ALTER POLICY citation_locator_types_authenticated_read ON editorial.citation_locator_types USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY correction_event_types_authenticated_read ON editorial.correction_event_types USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY correction_evidence_roles_authenticated_read ON editorial.correction_evidence_roles USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY correction_kinds_authenticated_read ON editorial.correction_kinds USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY credit_roles_authenticated_read ON editorial.credit_roles USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY source_types_authenticated_read ON editorial.source_types USING ((select auth.uid()) IS NOT NULL);

DO $verify$
DECLARE matches integer;
BEGIN
  SELECT count(*) INTO matches FROM pg_policies
  WHERE schemaname='editorial'
    AND ((tablename='citation_locator_types' AND policyname='citation_locator_types_authenticated_read')
      OR (tablename='correction_event_types' AND policyname='correction_event_types_authenticated_read')
      OR (tablename='correction_evidence_roles' AND policyname='correction_evidence_roles_authenticated_read')
      OR (tablename='correction_kinds' AND policyname='correction_kinds_authenticated_read')
      OR (tablename='credit_roles' AND policyname='credit_roles_authenticated_read')
      OR (tablename='source_types' AND policyname='source_types_authenticated_read'))
    AND cmd='SELECT' AND permissive='PERMISSIVE'
    AND roles=ARRAY['authenticated']::name[]
    AND qual LIKE '%SELECT auth.uid()%' AND with_check IS NULL;
  IF matches<>6 THEN RAISE EXCEPTION 'STOP: six policy postconditions missing (%).',matches; END IF;
END
$verify$;
COMMIT;
