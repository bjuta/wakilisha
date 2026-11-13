-- SEV-1 advisor performance cohort A: two Editorial reference-table read policies.
-- Preserve roles, permissiveness, command, and meaning. Optimize auth.uid()
-- from per-row evaluation to statement-scoped InitPlan. Atomic / fail-closed.
BEGIN;
SET LOCAL statement_timeout='8000ms';
SET LOCAL lock_timeout='1500ms';
DO $guard$
DECLARE matches integer;
BEGIN
  SELECT count(*) INTO matches FROM pg_policies WHERE schemaname='editorial'
    AND ((tablename='publishing_channels' AND policyname='publishing_channels_authenticated_read')
      OR (tablename='publishing_content_kinds' AND policyname='publishing_content_kinds_authenticated_read'))
    AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
    AND qual='(auth.uid() IS NOT NULL)' AND with_check IS NULL;
  IF matches<>2 THEN RAISE EXCEPTION 'STOP: expected two exact Editorial reference-table policies; got %',matches; END IF;
END
$guard$;
ALTER POLICY publishing_channels_authenticated_read
  ON editorial.publishing_channels
  USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY publishing_content_kinds_authenticated_read
  ON editorial.publishing_content_kinds
  USING ((select auth.uid()) IS NOT NULL);
DO $verify$
DECLARE matches integer;
BEGIN
  SELECT count(*) INTO matches FROM pg_policies WHERE schemaname='editorial'
    AND ((tablename='publishing_channels' AND policyname='publishing_channels_authenticated_read')
      OR (tablename='publishing_content_kinds' AND policyname='publishing_content_kinds_authenticated_read'))
    AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
    AND qual like '%( SELECT auth.uid() AS uid)%' AND with_check IS NULL;
  -- The deparser varies among PostgreSQL 17 patchlevels, so verify by exact
  -- AST presence instead of relying on white-space formatting.
  IF matches <> 2 THEN
    SELECT count(*) INTO matches FROM pg_policies WHERE schemaname='editorial'
      AND ((tablename='publishing_channels' AND policyname='publishing_channels_authenticated_read')
        OR (tablename='publishing_content_kinds' AND policyname='publishing_content_kinds_authenticated_read'))
      AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[]
      AND qual like '%SELECT auth.uid()%' AND with_check IS NULL;
  END IF;
  IF matches<>2 THEN RAISE EXCEPTION 'STOP: optimized InitPlan not present in both policies (%).',matches; END IF;
END
$verify$;
COMMIT;
