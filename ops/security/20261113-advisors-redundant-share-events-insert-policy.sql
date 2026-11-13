-- Security: remove a redundant unrestricted INSERT policy on public.share_events.
-- Direct INSERT is already forbidden to anon and authenticated (verified live).
-- Only privileged share-count RPC writes and service-role writes remain.
-- This avoids a future accidental GRANT turning WITH CHECK(true) into access.
BEGIN;
SET LOCAL lock_timeout='1500ms';
SET LOCAL statement_timeout='8000ms';
DO $guard$
DECLARE matches integer;
BEGIN
  IF has_table_privilege('anon','public.share_events','INSERT')
     OR has_table_privilege('authenticated','public.share_events','INSERT') THEN
    RAISE EXCEPTION 'STOP: public roles can INSERT into share_events';
  END IF;
  SELECT count(*) INTO matches FROM pg_policies
  WHERE schemaname='public' AND tablename='share_events'
    AND policyname='public_insert_share_events'
    AND cmd='INSERT' AND permissive='PERMISSIVE'
    AND roles=ARRAY['anon','authenticated']::name[]
    AND with_check='true';
  IF matches<>1 THEN RAISE EXCEPTION 'STOP: share_events policy changed'; END IF;
END
$guard$;
DROP POLICY public_insert_share_events ON public.share_events;
DO $verify$
BEGIN
  IF EXISTS (select 1 FROM pg_policies WHERE schemaname='public' AND tablename='share_events' AND policyname='public_insert_share_events') THEN
    RAISE EXCEPTION 'STOP: unrestricted INSERT policy still exists';
  END IF;
  IF has_table_privilege('anon','public.share_events','INSERT')
     OR has_table_privilege('authenticated','public.share_events','INSERT') THEN
    RAISE EXCEPTION 'STOP: public INSERT grant changed unexpectedly';
  END IF;
END
$verify$;
COMMIT;
