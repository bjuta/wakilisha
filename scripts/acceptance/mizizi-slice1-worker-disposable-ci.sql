-- WAKILISHA Slice 1, CI-only, disposable PostgreSQL service-worker acceptance.
-- Fresh local 227 migration replay only. NEVER on linked, Preview or Production DB.
-- SET SESSION AUTHORIZATION is a local simulator, NOT a real service JWT/JIT login.
-- One synthetic canonical Release is transaction-scoped; all changes ROLLBACK.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $guard$
DECLARE n integer; head text;
BEGIN
 SELECT count(*),max(version) INTO n,head FROM supabase_migrations.schema_migrations;
 IF n<>228 OR head<>'20261013194500'
   OR session_user<>'supabase_admin' OR current_user<>'supabase_admin'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin')
   OR (SELECT count(*) FROM mizizi_private.cases)<>0
   OR (SELECT count(*) FROM public.registry_releases)<>0
   OR (SELECT count(*) FROM platform_private.jobs)<>0
   OR to_regprocedure('public.mizizi_claim_case_research_jobs_v1(text,integer,integer)') IS NULL
   OR to_regprocedure('public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)') IS NULL
   OR to_regprocedure('public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'STOP_CI_WORKER_EXACT_EMPTY_LOCAL_226_REQUIRED'; END IF;
END $guard$;
SELECT id::text AS wk_workspace FROM mizizi_private.workspaces
 WHERE workspace_key='wakilisha-internal' AND status='active' \gset
WITH n AS (SELECT substr(md5(gen_random_uuid()::text),1,12) AS key),
fixture AS (
 INSERT INTO public.registry_releases(slug,title,normalized_title,status,metadata)
 SELECT 'wk-ci-worker-'||key,'CI Disposable Release',
 'ci disposable release','active',jsonb_build_object('test_fixture','ci-only')
 FROM n RETURNING id,slug
)
SELECT id::text AS wk_release,slug AS wk_slug,slug||'-accepted' AS wk_candidate
 FROM fixture \gset
SELECT mizizi_private.finding_fingerprint_v1(
 'release_slug_provider_packaging','1.2.0','release',:'wk_release',
 'slug',:'wk_slug',:'wk_candidate') AS wk_source_fp \gset
SELECT set_config('wk.ci.ws',:'wk_workspace',true),
 set_config('wk.ci.release',:'wk_release',true),
 set_config('wk.ci.slug',:'wk_slug',true),
 set_config('wk.ci.candidate',:'wk_candidate',true),
 set_config('wk.ci.fp',:'wk_source_fp',true);
SET SESSION AUTHORIZATION mizizi_executor;
DO $admit_source$
DECLARE result record;
BEGIN
 SELECT * INTO STRICT result FROM mizizi_private.admit_review_case_gateway_v1(
   current_setting('wk.ci.ws')::uuid,'wk-ci-local-worker',
   jsonb_build_object(
     'entityType','release','entityId',current_setting('wk.ci.release'),
     'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',
     'fieldName','slug','currentValue',current_setting('wk.ci.slug'),
     'proposedValue',current_setting('wk.ci.candidate'),
     'fingerprint',current_setting('wk.ci.fp'),
     'confidence',1,'severity','high','disposition','review',
     'reason','Disposable local source-bound worker lease acceptance.',
     'evidence',jsonb_build_object('fixture','ci-only')));
 IF result.outcome<>'created' OR result.headquarters_case_revision<>1
   OR result.review_item_id IS NULL OR result.receipt_link_id IS NULL
 THEN RAISE EXCEPTION 'CI_WORKER_SOURCE_BROKER_FAILED'; END IF;
 PERFORM set_config('wk.ci.case',result.headquarters_case_id::text,true);
END $admit_source$;
SET SESSION AUTHORIZATION DEFAULT;
-- Synthetic local state transition ONLY; NOT a signed-in human decision.
UPDATE mizizi_private.cases
 SET revision=revision+1,case_state='in_progress',current_stage='research',
 transition_actor_key='system:mizizi',
 transition_reason='Disposable local research-stage fixture, not a human decision.'
 WHERE id=current_setting('wk.ci.case')::uuid AND revision=1;
SELECT encode(extensions.digest(convert_to(
 current_setting('wk.ci.case')||E'\n'||current_setting('wk.ci.ws')
 ||E'\n2\nread_only_research\n'||
 'Check bounded local worker recovery without external provider access.','UTF8'),
 'sha256'),'hex') AS wk_research_fp \gset
SELECT set_config('wk.ci.research_fp',:'wk_research_fp',true);
SET SESSION AUTHORIZATION mizizi_executor;
DO $admit_job$
DECLARE result record;
BEGIN
 SELECT * INTO STRICT result FROM mizizi_private.admit_case_research_job_v1(
 current_setting('wk.ci.case')::uuid,current_setting('wk.ci.ws')::uuid,2,
 'system:mizizi','wk-ci-research:'||current_setting('wk.ci.case')||':2',
 current_setting('wk.ci.research_fp'),
 'Check bounded local worker recovery without external provider access.');
 IF result.outcome<>'created' OR result.job_status<>'queued' OR result.resource_id<>current_setting('wk.ci.case')::uuid
 THEN RAISE EXCEPTION 'CI_WORKER_SHARED_JOB_GATEWAY_FAILED'; END IF;
 PERFORM set_config('wk.ci.job',result.job_id::text,true);
 PERFORM set_config('wk.ci.receipt',result.command_receipt_id::text,true);
END $admit_job$;
SET SESSION AUTHORIZATION DEFAULT;
-- First prove non-service role cannot use the worker RPC.
SET SESSION AUTHORIZATION anon;
SELECT set_config('request.jwt.claim.role','anon',true);
DO $nonservice$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM public.mizizi_claim_case_research_jobs_v1('wk-nonservice',1,30);
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'CI_W30_NON_SERVICE_WORKER_ACCEPTED'; END IF;
 RAISE NOTICE 'CI_W30_NON_SERVICE_CLAIM_DENIED=PASS';
END $nonservice$;
SET SESSION AUTHORIZATION DEFAULT;
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $first_claim$
DECLARE first_job record; second_job record;
BEGIN
 SELECT * INTO STRICT first_job
  FROM public.mizizi_claim_case_research_jobs_v1('wk-first-worker',1,30);
 IF first_job.job_id<>current_setting('wk.ci.job')::uuid
 OR first_job.command_receipt_id<>current_setting('wk.ci.receipt')::uuid
 OR first_job.resource_id<>current_setting('wk.ci.case')::uuid
 OR first_job.attempt_count<>1
 THEN RAISE EXCEPTION 'CI_W29_FIRST_WORKER_LEASE_INTEGRITY'; END IF;
 SELECT * INTO second_job
   FROM public.mizizi_claim_case_research_jobs_v1('wk-second-worker',1,30);
 IF FOUND THEN RAISE EXCEPTION 'CI_SECOND_WORKER_STOLE_RUNNING_LEASE'; END IF;
 RAISE NOTICE 'CI_W29_EXCLUSIVE_FIRST_CLAIM=PASS';
 RAISE NOTICE 'CI_SEQUENTIAL_COMPETING_WORKER_DENIED=PASS';
END $first_claim$;
SET SESSION AUTHORIZATION DEFAULT;
-- Fixture clock only. No live lease or Registry state may be changed.
UPDATE platform_private.jobs SET locked_at=now()-interval '2 minutes',
 lease_expires_at=now()-interval '1 minute'
 WHERE id=current_setting('wk.ci.job')::uuid AND status='running'
 AND locked_by='wk-first-worker';
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $recover$
DECLARE n integer; repeated integer;
BEGIN
 SELECT public.mizizi_recover_expired_case_research_jobs_v1(10,1) INTO STRICT n;
 SELECT public.mizizi_recover_expired_case_research_jobs_v1(10,1) INTO STRICT repeated;
 IF n<>1 OR repeated<>0 THEN RAISE EXCEPTION 'CI_W32_EXPIRED_LEASE_RECOVERY_INCONSISTENT'; END IF;
 RAISE NOTICE 'CI_W32_LEASE_RECOVERED_ONCE=PASS';
END $recover$;
SET SESSION AUTHORIZATION DEFAULT;
DO $recovery_check$
BEGIN
 IF (SELECT count(*) FROM platform_private.jobs
 WHERE id=current_setting('wk.ci.job')::uuid AND status='retry_wait'
 AND attempt_count=1 AND locked_by IS NULL)<>1
 OR (SELECT count(*) FROM platform_private.outbox_events
 WHERE job_id=current_setting('wk.ci.job')::uuid
 AND event_type='mizizi.case_research_v1.retry_scheduled')<>1
 THEN RAISE EXCEPTION 'CI_W32_RETRY_OR_OUTBOX_NOT_DURABLE'; END IF;
END $recovery_check$;
UPDATE platform_private.jobs SET available_at=now()-interval '1 minute'
 WHERE id=current_setting('wk.ci.job')::uuid AND status='retry_wait';
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $restart$
DECLARE job record; denied boolean:=false;
BEGIN
 SELECT * INTO STRICT job
 FROM public.mizizi_claim_case_research_jobs_v1('wk-restart-worker',1,30);
 IF job.job_id<>current_setting('wk.ci.job')::uuid OR job.attempt_count<>2
 THEN RAISE EXCEPTION 'CI_W33_RESTART_DID_NOT_REUSE_DURABLE_JOB'; END IF;
 RAISE NOTICE 'CI_W33_RESTART_REUSES_SAME_JOB=PASS';
 BEGIN
  PERFORM public.mizizi_complete_case_research_job_v1(
   current_setting('wk.ci.job')::uuid,'wk-first-worker',
   jsonb_build_object('status','stale_worker'));
 EXCEPTION WHEN SQLSTATE '55000' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'CI_W34_STALE_WORKER_COMPLETED_JOB'; END IF;
 RAISE NOTICE 'CI_W34_STALE_WORKER_COMPLETION_DENIED=PASS';
END $restart$;
SET SESSION AUTHORIZATION DEFAULT;
-- Exhaust attempts in disposable fixture to avoid waiting minutes.
UPDATE platform_private.jobs SET locked_at=now()-interval '2 minutes',
 lease_expires_at=now()-interval '1 minute',attempt_count=max_attempts
 WHERE id=current_setting('wk.ci.job')::uuid AND status='running'
 AND locked_by='wk-restart-worker';
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $terminal$
DECLARE n integer; repeated integer;
BEGIN
 SELECT public.mizizi_recover_expired_case_research_jobs_v1(10,1) INTO STRICT n;
 SELECT public.mizizi_recover_expired_case_research_jobs_v1(10,1) INTO STRICT repeated;
 IF n<>1 OR repeated<>0 THEN RAISE EXCEPTION 'CI_W35_EXHAUSTED_JOB_RECOVERY_INCONSISTENT'; END IF;
END $terminal$;
SET SESSION AUTHORIZATION DEFAULT;
DO $terminal_receipts$
DECLARE v_expected_job uuid:=current_setting('wk.ci.job')::uuid;
BEGIN
 IF (SELECT count(*) FROM platform_private.jobs j WHERE j.id=v_expected_job
   AND j.status='dead_letter' AND j.locked_by IS NULL AND j.attempt_count=j.max_attempts)<>1
 OR (SELECT count(*) FROM platform_private.command_receipts r
   WHERE r.id=current_setting('wk.ci.receipt')::uuid
   AND r.status='failed' AND r.error_code='job_failed')<>1
 OR (SELECT count(*) FROM platform_private.outbox_events e
   WHERE e.job_id=v_expected_job AND e.event_type='mizizi.case_research_v1.failed')<>1
 OR (SELECT count(*) FROM mizizi_private.case_events ce
   WHERE ce.case_id=current_setting('wk.ci.case')::uuid)<>2
 THEN RAISE EXCEPTION 'CI_W35_TERMINAL_RECEIPT_OR_CASE_HISTORY_DRIFT'; END IF;
 RAISE NOTICE 'CI_W35_SINGLE_DEAD_LETTER_AND_IMMUTABLE_HISTORY=PASS';
 RAISE NOTICE 'CI_W31_TRUE_CONCURRENT_DB_SESSIONS=NOT_RUN';
 RAISE NOTICE 'CI_REAL_JWT_OR_OPERATOR_BROWSER=NOT_RUN';
END $terminal_receipts$;

-- DB05 governance holds tested in the SAME disposable rollback transaction.
-- These are database admission-barrier proofs, NOT authenticated operator JWT,
-- genuine pre-existing reviewed grants, or signed-in stale-browser acceptance.
DO $wk_hold_created$
DECLARE v_hold_id uuid;
BEGIN
 INSERT INTO mizizi_private.write_holds
   (hold_key,scope_kind,workspace_id,status,hold_reason,held_by_actor_key)
 VALUES ('wk-ci-hold-'||substr(md5(gen_random_uuid()::text),1,12),
   'workspace',current_setting('wk.ci.ws')::uuid,'active',
   'Disposable SQL-only workspace hold test, not a human instruction.',
   'system:mizizi')
 RETURNING id INTO STRICT v_hold_id;
 PERFORM set_config('wk.ci.hold',v_hold_id::text,true);
 IF (SELECT count(*) FROM mizizi_private.write_holds
      WHERE id=v_hold_id AND status='active' AND revision=1)<>1
    OR (SELECT count(*) FROM mizizi_private.write_hold_events
      WHERE hold_id=v_hold_id AND revision=1 AND event_kind='hold_started')<>1
 THEN RAISE EXCEPTION 'CI_DB05_H36_HOLD_OR_EVENT_NOT_RECORDED'; END IF;
 RAISE NOTICE 'CI_DB05_H36_TRANSACTIONAL_HOLD_AND_HISTORY=PASS';
END $wk_hold_created$;

DO $wk_hold_denials$
DECLARE v_denied boolean;
BEGIN
 -- Direct policy function used by both existing canonical Registry admission
 -- triggers; test both matching and unrelated Registry operation families.
 v_denied:=false;
 BEGIN
   PERFORM mizizi_private.assert_registry_admission_not_held_v1(
     'registry.artist.merge',1);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'CI_DB05_H37_MERGE_ADMITTED_UNDER_HOLD'; END IF;
 v_denied:=false;
 BEGIN
   PERFORM mizizi_private.assert_registry_admission_not_held_v1(
     'registry.artist.create',1);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'CI_DB05_H37_CREATE_ADMITTED_UNDER_HOLD'; END IF;
 RAISE NOTICE 'CI_DB05_H37_SCOPE_HOLD_POLICY_DENIAL=PASS';

 -- Exercise actual BEFORE INSERT gates. The candidate rows are intentionally
 -- not a reviewed plan and can never commit; this proves the hold gate fires
 -- before any downstream FK/review admission. It does not simulate a grant.
 v_denied:=false;
 BEGIN
   INSERT INTO platform_private.registry_execution_grants(
     actor_key,capability_key,operation_key,operation_version,
     plan_payload,plan_fingerprint,target_set_fingerprint,max_rows,
     idempotency_key,status,issued_at,expires_at,
     issued_by_principal_key,policy_ruleset_version)
   VALUES ('mizizi','merge_registry_artist','registry.artist.merge',1,
     '{}'::jsonb,repeat('a',64),repeat('b',64),1,
     'wk-ci-hold-denied', 'active', now(),now()+interval '2 minutes',
     'policy:ci_test','mizizi_ci_v1');
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'CI_DB05_H37_GRANT_TRIGGER_NOT_DENIED'; END IF;

 v_denied:=false;
 BEGIN
   INSERT INTO platform_private.registry_mutation_operations(
     execution_grant_id,actor_key,capability_key,operation_key,
     operation_version,principal_key,plan_fingerprint,
     target_set_fingerprint,max_rows,affected_rows,status,verifier_status,
     result_payload)
   VALUES (gen_random_uuid(),'mizizi','merge_registry_artist',
     'registry.artist.merge',1,'system:mizizi',repeat('a',64),repeat('b',64),
     1,0,'authorized','pending','{}'::jsonb);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'CI_DB05_H37_MUTATION_TRIGGER_NOT_DENIED'; END IF;

 IF (SELECT count(*) FROM platform_private.registry_execution_grants
      WHERE status='active')<>0
   OR (SELECT count(*) FROM platform_private.registry_mutation_operations
      WHERE status IN ('authorized','executing'))<>0
 THEN RAISE EXCEPTION 'CI_DB05_H37_DENIED_ADMISSION_PERSISTED'; END IF;
 RAISE NOTICE 'CI_DB05_H37_BOTH_CANONICAL_ADMISSION_TRIGGERS_DENIED=PASS';
END $wk_hold_denials$;

-- Read-only shared research remains explicitly allowed while Hold Writes
-- fences new Registry mutation admission. A dead-letter job is not claimed.
SET SESSION AUTHORIZATION service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $wk_hold_read$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count
 FROM public.mizizi_claim_case_research_jobs_v1('wk-hold-readonly',1,30);
 IF v_count<>0 THEN RAISE EXCEPTION 'CI_DB05_UNEXPECTED_RESEARCH_JOB_CLAIM'; END IF;
 RAISE NOTICE 'CI_DB05_RESEARCH_CLAIM_RPC_REMAINS_AVAILABLE=PASS';
END $wk_hold_read$;
SET SESSION AUTHORIZATION DEFAULT;

DO $wk_hold_release$
DECLARE v_hold_id uuid:=current_setting('wk.ci.hold')::uuid;
  v_rejected boolean:=false;
BEGIN
 UPDATE mizizi_private.write_holds SET status='released',revision=revision+1,
   released_at=clock_timestamp(),released_by_actor_key='system:mizizi',
   release_reason='Disposable SQL-only Hold Writes release acceptance.'
 WHERE id=v_hold_id AND status='active' AND revision=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'CI_DB05_H40_HOLD_RELEASE_FAILED'; END IF;
 IF (SELECT count(*) FROM mizizi_private.write_hold_events WHERE hold_id=v_hold_id)<>2
    OR (SELECT count(*) FROM mizizi_private.write_hold_events
        WHERE hold_id=v_hold_id AND event_kind='hold_released' AND revision=2)<>1
 THEN RAISE EXCEPTION 'CI_DB05_H40_DOUBLE_OR_MISSING_EVENT'; END IF;
 -- Existing immutable history cannot be edited, and duplicate release is
 -- forbidden even though it is the same local synthetic supervisor identity.
 BEGIN
   UPDATE mizizi_private.write_holds SET status='released',revision=revision+1,
     released_at=clock_timestamp(),released_by_actor_key='system:mizizi',
     release_reason='Duplicate stale release must be refused.'
   WHERE id=v_hold_id;
 EXCEPTION WHEN SQLSTATE '23514' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'CI_DB05_H40_DUPLICATE_RELEASE_ACCEPTED'; END IF;
 PERFORM mizizi_private.assert_registry_admission_not_held_v1('registry.artist.merge',1);
 IF (SELECT count(*) FROM platform_private.registry_execution_grants
     WHERE status='active')<>0
 THEN RAISE EXCEPTION 'CI_DB05_H40_RELEASE_AUTO_CREATED_GRANT'; END IF;

 -- Separate global and exact-operation scopes must have different blast radii.
 INSERT INTO mizizi_private.write_holds
   (hold_key,scope_kind,status,hold_reason,held_by_actor_key)
 VALUES ('wk-ci-global-'||substr(md5(gen_random_uuid()::text),1,12),
   'global','active','Disposable global scope authority acceptance.','system:mizizi')
 RETURNING id INTO STRICT v_hold_id;
 v_rejected:=false;
 BEGIN
   PERFORM mizizi_private.assert_registry_admission_not_held_v1(
     'registry.artist.create',1);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'CI_DB05_GLOBAL_SCOPE_NOT_ENFORCED'; END IF;
 UPDATE mizizi_private.write_holds SET status='released',revision=2,
   released_at=clock_timestamp(),released_by_actor_key='system:mizizi',
   release_reason='Disposable global scope release with audit history.'
 WHERE id=v_hold_id AND revision=1;
 INSERT INTO mizizi_private.write_holds
   (hold_key,scope_kind,workspace_id,operation_key,operation_version,
    status,hold_reason,held_by_actor_key)
 VALUES ('wk-ci-operation-'||substr(md5(gen_random_uuid()::text),1,12),
   'operation',current_setting('wk.ci.ws')::uuid,
   'registry.artist.merge',1,'active',
   'Disposable operation-only policy scope acceptance.','system:mizizi')
 RETURNING id INTO STRICT v_hold_id;
 v_rejected:=false;
 BEGIN
   PERFORM mizizi_private.assert_registry_admission_not_held_v1(
     'registry.artist.merge',1);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'CI_DB05_OPERATION_SCOPE_NOT_ENFORCED'; END IF;
 PERFORM mizizi_private.assert_registry_admission_not_held_v1(
   'registry.artist.create',1);
 UPDATE mizizi_private.write_holds SET status='released',revision=2,
   released_at=clock_timestamp(),released_by_actor_key='system:mizizi',
   release_reason='Disposable operation-only scope release with journal.'
 WHERE id=v_hold_id AND revision=1;
 IF (SELECT count(*) FROM mizizi_private.write_holds
   WHERE status='active')<>0
 OR (SELECT count(*) FROM mizizi_private.write_hold_events
   WHERE event_kind='hold_started')<>3
 OR (SELECT count(*) FROM mizizi_private.write_hold_events
   WHERE event_kind='hold_released')<>3
 THEN RAISE EXCEPTION 'CI_DB05_SCOPE_JOURNAL_OR_ACTIVE_HOLD_DRIFT'; END IF;
 RAISE NOTICE 'CI_DB05_GLOBAL_WORKSPACE_OPERATION_SCOPE=PASS';

 RAISE NOTICE 'CI_DB05_H40_RELEASE_JOURNAL_AND_NO_STANDING_GRANT=PASS';
 RAISE NOTICE 'CI_DB05_H38_GENUINE_STALE_GRANTED_WRITER=NOT_RUN';
 RAISE NOTICE 'CI_DB05_H39_TWO_AUTHENTICATED_OPERATOR_RELEASES=NOT_RUN';
END $wk_hold_release$;

ROLLBACK;
\echo WK_CI_DISPOSABLE_WORKER_SQL_ROLLBACK=PASS
