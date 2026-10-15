-- Read-only MIZIZI 231 Preview Registry evidence confidentiality verifier.
-- No fixture, review decision, grant, operation, DDL or source mutation.
BEGIN TRANSACTION READ ONLY;
DO $wk_reader_catalog$
DECLARE v_table text; v_policy text; v_qual text;
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>231
     OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261015091718'
     OR (SELECT count(*) FROM supabase_migrations.schema_migrations
          WHERE version='20261015091718' AND name='mizizi_registry_review_reader_rls_v1')<>1
  THEN RAISE EXCEPTION 'WK_READER_231_EXACT_LEDGER_MISMATCH'; END IF;
  FOREACH v_table IN ARRAY ARRAY['registry_review_items','registry_canonicalization_decisions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c
      WHERE c.oid=to_regclass('public.'||v_table) AND c.relrowsecurity)
       OR NOT has_table_privilege('authenticated','public.'||v_table,'SELECT')
       OR has_table_privilege('anon','public.'||v_table,'SELECT')
    THEN RAISE EXCEPTION 'WK_READER_231_TABLE_GRANT_OR_RLS_DRIFT: %',v_table; END IF;
    v_policy:=CASE WHEN v_table='registry_review_items'
      THEN 'Authenticated users can read registry review items'
      ELSE 'Authenticated users can read registry canonicalization decision' END;
    SELECT qual INTO v_qual FROM pg_policies
      WHERE schemaname='public' AND tablename=v_table
        AND policyname=v_policy AND cmd='SELECT'
        AND roles=ARRAY['authenticated']::name[];
    IF v_qual IS NULL
       OR position('auth.uid()' in v_qual)=0
       OR position('IS NOT NULL' in v_qual)=0
       OR position('current_user_has_capability' in v_qual)=0
       OR position('view_review_queue' in v_qual)=0
       OR v_qual='true'
       OR (SELECT count(*) FROM pg_policies
           WHERE schemaname='public' AND tablename=v_table
             AND cmd='SELECT' AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles)))<>1
    THEN RAISE EXCEPTION 'WK_READER_231_AUTH_POLICY_DRIFT: %',v_table; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='registry_review_items'
        AND cmd='SELECT' AND policyname='mizizi_executor_release_single_review_read'
        AND roles=ARRAY['mizizi_executor']::name[]
        AND position('release_single_identity_conflict' in qual)>0
        AND position('1.4.0' in qual)>0)<>1
     OR has_table_privilege('mizizi_executor','public.registry_review_items','SELECT')
     OR NOT has_column_privilege('mizizi_executor','public.registry_review_items','source_payload','SELECT')
     OR NOT has_function_privilege('authenticated','public.current_user_has_capability(text)','EXECUTE')
  THEN RAISE EXCEPTION 'WK_READER_231_EXECUTOR_OR_CAPABILITY_DRIFT'; END IF;
END
$wk_reader_catalog$;
SET LOCAL ROLE authenticated;
DO $wk_reader_no_identity$
BEGIN
  IF auth.uid() IS NOT NULL
     OR public.current_user_has_capability('view_review_queue')
     OR (SELECT count(*) FROM public.registry_review_items)<>0
     OR (SELECT count(*) FROM public.registry_canonicalization_decisions)<>0
  THEN RAISE EXCEPTION 'WK_READER_231_MISSING_IDENTITY_READ_BYPASS'; END IF;
END
$wk_reader_no_identity$;
ROLLBACK;
SELECT 'WK_231_PREVIEW_REGISTRY_READER_RLS_VERIFIED=PASS' AS result;
