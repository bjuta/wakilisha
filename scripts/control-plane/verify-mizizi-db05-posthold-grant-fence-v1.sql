-- Read-only invariant for DB05 228. No tables modified.
DO $wk_228$
DECLARE v_definition text; n integer; latest text;
BEGIN
 SELECT count(*),max(version) INTO n,latest
 FROM supabase_migrations.schema_migrations;
 IF n<>228 OR latest<>'20261013194500' THEN
   RAISE EXCEPTION 'STOP_DB05_228_EXACT_LEDGER_REQUIRED';
 END IF;
 SELECT pg_get_functiondef(
   'platform_private.registry_execution_grant_has_current_authority(uuid)'::regprocedure)
 INTO STRICT v_definition;
 IF position('h.held_at >= v_grant.issued_at' in v_definition)=0
   OR position('h.scope_kind=''global''' in v_definition)=0
   OR position('h.scope_kind=''workspace''' in v_definition)=0
   OR position('h.scope_kind=''operation''' in v_definition)=0
   OR position('h.operation_key=v_grant.operation_key' in v_definition)=0
   OR position('public.current_user_has_capability' in v_definition)=0
   OR has_function_privilege('anon',
      'platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
   OR has_function_privilege('authenticated',
      'platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
   OR has_function_privilege('service_role',
      'platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
   OR (SELECT p.proowner::regrole::text
       FROM pg_proc p WHERE p.oid='platform_private.registry_execution_grant_has_current_authority(uuid)'::regprocedure)<>'postgres'
 THEN RAISE EXCEPTION 'STOP_DB05_228_STALE_GRANT_FENCE_OR_ACL_DRIFT'; END IF;
 IF to_regprocedure('public.wk_ci_h38_issue_exact_grant_v1(uuid,uuid,text)') IS NOT NULL THEN
   RAISE EXCEPTION 'STOP_DB05_228_PRODUCTION_HAS_LOCAL_ONLY_FIXTURE_SHIM';
 END IF;
 RAISE NOTICE 'WK_DB05_228_RELEASE_NEVER_REAUTHORIZES_OLD_EXACT_GRANTS=PASS';
END $wk_228$;
