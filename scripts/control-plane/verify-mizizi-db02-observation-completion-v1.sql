-- Read-only forward 229/230/231 verifier. No fixtures, DML or hosted mutation.
-- Run only AFTER CLI-minted migration 20261014134759 is installed.
DO $wk_229_assert$
DECLARE
 n integer; v_head text; v_gateway regprocedure; v_done regprocedure;
 v_observations regclass; v_gateway_source text; v_done_source text;
BEGIN
 SELECT count(*),max(version) INTO n,v_head
 FROM supabase_migrations.schema_migrations;
 IF NOT ((n=229 AND v_head='20261014134759')
       OR (n=230 AND v_head='20261014182214')
       OR (n=231 AND v_head='20261015091718'))
   OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations
     WHERE version='20261014134759'
       AND name='mizizi_db02_observation_completion_authority_v1')
   OR (n>=230 AND NOT EXISTS(
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version='20261014182214'
        AND name='mizizi_db02_prior_observation_replay_fence_v1'))
   OR (n=231 AND NOT EXISTS(
       SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version='20261015091718'
         AND name='mizizi_registry_review_reader_rls_v1'))
 THEN RAISE EXCEPTION 'STOP_229_EXACT_REPLAY_LEDGER_NOT_INSTALLED'; END IF;
 v_observations:=to_regclass('mizizi_private.case_observations');
 v_gateway:=to_regprocedure('mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)');
 v_done:=to_regprocedure('public.admin_mizizi_done_for_now_case_v1(uuid,integer,text,timestamp with time zone)');
 IF v_observations IS NULL OR v_gateway IS NULL OR v_done IS NULL
 THEN RAISE EXCEPTION 'STOP_229_PRIVATE_TABLE_OR_RPC_MISSING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c
   WHERE c.oid=v_observations AND c.relkind='r'
    AND c.relrowsecurity AND c.relforcerowsecurity
    AND c.relowner='postgres'::regrole)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint c
     WHERE c.conrelid=v_observations AND c.conname='wk_case_observations_revision_unique'
       AND c.contype='u')
  OR NOT EXISTS(SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid=v_observations AND t.tgname='wk_case_observations_immutable'
       AND t.tgenabled='O' AND NOT t.tgisinternal)
 THEN RAISE EXCEPTION 'STOP_229_OBSERVATION_APPEND_ONLY_RLS_OR_REVISION_DRIFT'; END IF;
 IF EXISTS (
   SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role'),('mizizi_executor'))
     denied(role_name)
   WHERE has_table_privilege(denied.role_name,v_observations,'SELECT')
      OR has_table_privilege(denied.role_name,v_observations,'INSERT')
      OR has_table_privilege(denied.role_name,v_observations,'UPDATE')
      OR has_table_privilege(denied.role_name,v_observations,'DELETE'))
 THEN RAISE EXCEPTION 'STOP_229_PRIVATE_OBSERVATION_TABLE_GRANT_LEAK'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=v_gateway
   AND p.prosecdef AND p.proowner='postgres'::regrole
   AND p.proconfig @> ARRAY['search_path=pg_catalog']::text[])
 OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=v_done
   AND p.prosecdef AND p.proowner='postgres'::regrole
   AND p.proconfig @> ARRAY['search_path=pg_catalog']::text[])
 THEN RAISE EXCEPTION 'STOP_229_DEFINER_SEARCH_PATH_OR_OWNER_DRIFT'; END IF;
 IF has_function_privilege('anon',v_gateway,'EXECUTE')
  OR has_function_privilege('authenticated',v_gateway,'EXECUTE')
  OR has_function_privilege('service_role',v_gateway,'EXECUTE')
  OR NOT has_function_privilege('mizizi_executor',v_gateway,'EXECUTE')
  OR has_function_privilege('anon',v_done,'EXECUTE')
  OR has_function_privilege('service_role',v_done,'EXECUTE')
  OR has_function_privilege('mizizi_executor',v_done,'EXECUTE')
  OR NOT has_function_privilege('authenticated',v_done,'EXECUTE')
 THEN RAISE EXCEPTION 'STOP_229_JIT_OR_SIGNED_IN_RPC_EXECUTE_DRIFT'; END IF;
 SELECT pg_get_functiondef(v_gateway) INTO v_gateway_source;
 SELECT pg_get_functiondef(v_done) INTO v_done_source;
 IF position('Changed finding cannot detach its original human review receipt' in v_gateway_source)=0
  OR position('mizizi_private.case_observations' in v_gateway_source)=0
  OR position('Completed case requires separately authorized reopening' in v_gateway_source)=0
  OR position('source_finding_sha256' in v_gateway_source)=0
  OR position('observation_recorded' in v_gateway_source)=0
  OR position('mizizi_private.assert_headquarters_operator_v1' in v_done_source)=0
  OR position('PT409' in v_done_source)=0
  OR position('next_action_at' in v_done_source)=0
  OR position('r.status=''open''' in v_done_source)=0
 THEN RAISE EXCEPTION 'STOP_229_ORIGINAL_HUMAN_REVIEW_OR_FOLLOWUP_AUTHORITY_DRIFT'; END IF;
 IF n>=230 THEN
  IF position('Previously accepted MIZIZI observation cannot supersede newer evidence'
     in v_gateway_source)=0
   OR position('historical.observation_fingerprint=v_fp' in v_gateway_source)=0
  THEN RAISE EXCEPTION 'STOP_230_OLDER_ACCEPTED_OBSERVATION_NOT_FENCED'; END IF;
  RAISE NOTICE 'WK_230_DB02_OUT_OF_ORDER_OBSERVATION_REPLAY_FENCE=PASS';
 END IF;
 RAISE NOTICE 'WK_229_PRIVATE_OBSERVATION_IMMUTABLE_RLS_AND_EXECUTOR_BOUNDARY=PASS';
 RAISE NOTICE 'WK_229_SIGNED_IN_STEWARD_DONE_FOR_NOW_ACL_AND_CAS=PASS';
END $wk_229_assert$;
