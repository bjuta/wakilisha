-- Read-only DB05 invariant. Retain exact reviewed 228-231 anchors even after later forward migrations.
-- Same retained authority and ACL checks. No tables modified.
DO $wk_228$
DECLARE v_definition text; n integer; latest text;
BEGIN
 SELECT count(*),max(version) INTO n,latest
 FROM supabase_migrations.schema_migrations;
 IF NOT ((n=228 AND latest='20261014094213')
      OR (n=229 AND latest='20261014134759')
      OR (n=230 AND latest='20261014182214')
      OR (n>=231 AND latest>='20261015091718'
        AND (select count(*) from supabase_migrations.schema_migrations m
             where (m.version='20261014094213' and m.name='mizizi_db05_hold_supersedes_prior_registry_grants_v1')
                or (m.version='20261014134759' and m.name='mizizi_db02_observation_completion_authority_v1')
                or (m.version='20261014182214' and m.name='mizizi_db02_prior_observation_replay_fence_v1')
                or (m.version='20261015091718' and m.name='mizizi_registry_review_reader_rls_v1'))=4)) THEN
   RAISE EXCEPTION 'STOP_DB05_EXPECTED_REVIEWED_228_TO_231_ANCHORS';
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
