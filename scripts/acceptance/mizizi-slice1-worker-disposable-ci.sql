-- WAKILISHA Slice 1, CI-only, disposable PostgreSQL service-worker acceptance.
-- Fresh local 229 migration replay only. NEVER on linked, Preview or Production DB.
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
 IF n<>229 OR head<>'20261014134759'
   OR session_user<>'supabase_admin' OR current_user<>'supabase_admin'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin')
   OR (SELECT count(*) FROM mizizi_private.cases)<>0
   OR (SELECT count(*) FROM public.registry_releases)<>0
   OR (SELECT count(*) FROM platform_private.jobs)<>0
   OR to_regprocedure('public.mizizi_claim_case_research_jobs_v1(text,integer,integer)') IS NULL
   OR to_regprocedure('public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)') IS NULL
   OR to_regprocedure('public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'STOP_CI_WORKER_EXACT_EMPTY_LOCAL_229_REQUIRED'; END IF;
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
 PERFORM set_config('wk.ci.review',result.review_item_id::text,true);
 PERFORM set_config('wk.ci.link',result.receipt_link_id::text,true);
END $admit_source$;
-- Original A06/A08/A09/A10, proven against the real source gateway and
-- review broker in the SAME disposable rollback transaction. This never
-- substitutes an invented Registry fixture for the accepted source record.
DO $wk_source_replay_and_denial$
DECLARE v_finding jsonb; v_replay record; v_denied boolean;
BEGIN
 v_finding:=jsonb_build_object(
  'entityType','release','entityId',current_setting('wk.ci.release'),
  'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',
  'fieldName','slug','currentValue',current_setting('wk.ci.slug'),
  'proposedValue',current_setting('wk.ci.candidate'),
  'fingerprint',current_setting('wk.ci.fp'),
  'confidence',1,'severity','high','disposition','review',
  'reason','Disposable local source-bound worker lease acceptance.',
  'evidence',jsonb_build_object('fixture','ci-only'));
 SELECT * INTO STRICT v_replay FROM mizizi_private.admit_review_case_gateway_v1(
  current_setting('wk.ci.ws')::uuid,'wk-ci-local-worker',v_finding);
 IF v_replay.outcome<>'unchanged'
  OR v_replay.review_item_id<>current_setting('wk.ci.review')::uuid
  OR v_replay.headquarters_case_id<>current_setting('wk.ci.case')::uuid
  OR v_replay.headquarters_case_revision<>1
  OR v_replay.receipt_link_id<>current_setting('wk.ci.link')::uuid
 THEN RAISE EXCEPTION 'STOP_A10_SOURCE_GATEWAY_REPLAY_NOT_EXACT'; END IF;
 RAISE NOTICE 'CI_A10_DUPLICATE_FINDING_REPLAY_ONE_CASE_ONE_RECEIPT=PASS';
 v_denied:=false;
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
   current_setting('wk.ci.ws')::uuid,'wk-ci-local-worker',
   jsonb_set(v_finding,'{ruleVersion}','"1.4.0"'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_A06_UNSUPPORTED_SOURCE_RULE_ADMITTED'; END IF;
 RAISE NOTICE 'CI_A06_UNSUPPORTED_RELEASE_RULE_REJECTED=PASS';
 v_denied:=false;
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
   current_setting('wk.ci.ws')::uuid,'wk-ci-local-worker',
   jsonb_set(v_finding,'{entityId}',to_jsonb(gen_random_uuid()::text)));
 EXCEPTION WHEN SQLSTATE '40001' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_A08_ABSENT_CANONICAL_SOURCE_ADMITTED'; END IF;
 RAISE NOTICE 'CI_A08_MISSING_SOURCE_UUID_REJECTED_BY_LIVE_REGISTRY_BROKER=PASS';
 v_denied:=false;
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
   current_setting('wk.ci.ws')::uuid,'wk-ci-local-worker',
   jsonb_set(v_finding,'{entityId}','null'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_A08_ABSENT_ENTITY_ID_FIELD_ADMITTED'; END IF;
 RAISE NOTICE 'CI_A08_MISSING_ENTITY_ID_FIELD_REJECTED_AT_BOUNDARY=PASS';
 v_denied:=false;
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
   current_setting('wk.ci.ws')::uuid,'wk-ci-local-worker',
   jsonb_set(v_finding,'{fingerprint}',to_jsonb(repeat('f',64))));
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_A09_FORGED_SOURCE_FINGERPRINT_ADMITTED'; END IF;
 RAISE NOTICE 'CI_A09_DETERMINISTIC_FINGERPRINT_DRIFT_REJECTED=PASS';
END $wk_source_replay_and_denial$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_source_evidence_counts$
BEGIN
 IF (SELECT count(*) FROM public.registry_review_items
      WHERE id=current_setting('wk.ci.review')::uuid)<>1
  OR (SELECT count(*) FROM mizizi_private.case_receipt_links
      WHERE id=current_setting('wk.ci.link')::uuid
       AND case_id=current_setting('wk.ci.case')::uuid)<>1
  OR (SELECT count(*) FROM mizizi_private.case_events
      WHERE case_id=current_setting('wk.ci.case')::uuid AND case_revision=1)<>1
 THEN RAISE EXCEPTION 'STOP_A10_SOURCE_REPLAY_DUPLICATE_HISTORY_OR_REVIEW'; END IF;
 RAISE NOTICE 'CI_A10_BROKER_HISTORY_AND_REVIEW_CARDINALITY=PASS';
END $wk_source_evidence_counts$;
-- Synthetic local state transition ONLY; NOT a signed-in human decision.
UPDATE mizizi_private.cases
 SET revision=revision+1,case_state='in_progress',current_stage='research',
 transition_actor_key='system:mizizi',
 transition_reason='Disposable local research-stage fixture, not a human decision.'
 WHERE id=current_setting('wk.ci.case')::uuid AND revision=1;
-- C15/C16 immutability and C19 ordered case journal, direct PostgreSQL
-- trigger proof under a local superuser; no false RLS-permission denial.
DO $wk_case_immutability$
DECLARE v_event uuid; v_link uuid; v_denied boolean; v_case uuid;
BEGIN
 v_case:=current_setting('wk.ci.case')::uuid;
 SELECT event_id INTO STRICT v_event FROM mizizi_private.case_events
 WHERE case_id=v_case AND case_revision=1;
 SELECT id INTO STRICT v_link FROM mizizi_private.case_receipt_links
 WHERE case_id=v_case AND relation_type='review_item';
 v_denied:=false;
 BEGIN
  UPDATE mizizi_private.case_receipt_links SET link_reason='forged edit'
  WHERE id=v_link;
 EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C15_LINK_UPDATE_NOT_IMMUTABLE'; END IF;
 v_denied:=false;
 BEGIN
  DELETE FROM mizizi_private.case_receipt_links WHERE id=v_link;
 EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C15_LINK_DELETE_NOT_IMMUTABLE'; END IF;
 RAISE NOTICE 'CI_C15_RECEIPT_LINK_EDIT_AND_DELETE_IMMUTABLE=PASS';
 v_denied:=false;
 BEGIN
  UPDATE mizizi_private.case_events SET reason='forged event edit'
  WHERE event_id=v_event;
 EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C16_EVENT_UPDATE_NOT_IMMUTABLE'; END IF;
 v_denied:=false;
 BEGIN
  DELETE FROM mizizi_private.case_events WHERE event_id=v_event;
 EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C16_EVENT_DELETE_NOT_IMMUTABLE'; END IF;
 RAISE NOTICE 'CI_C16_CASE_EVENT_EDIT_AND_DELETE_IMMUTABLE=PASS';
 IF (SELECT count(*) FROM mizizi_private.case_events
     WHERE case_id=v_case)<>2
  OR (SELECT count(*) FROM mizizi_private.case_events
     WHERE case_id=v_case AND case_revision IN (1,2))<>2
  OR (SELECT array_agg(e.case_revision ORDER BY e.event_seq)
      FROM mizizi_private.case_events e WHERE e.case_id=v_case)
     IS DISTINCT FROM ARRAY[1,2]::integer[]
  OR (SELECT count(*) FROM mizizi_private.case_receipt_links
     WHERE case_id=v_case AND id=v_link)<>1
 THEN RAISE EXCEPTION 'STOP_C19_EVENT_CHAIN_OR_RECEIPT_PERSISTENCE_DRIFT'; END IF;
 RAISE NOTICE 'CI_C19_TWO_REVISIONS_ORDERED_AND_LINK_PRESERVED=PASS';
END $wk_case_immutability$;
SELECT encode(extensions.digest(convert_to(
 current_setting('wk.ci.case')||E'\n'||current_setting('wk.ci.ws')
 ||E'\n2\nread_only_research\n'||
 'Check bounded local worker recovery without external provider access.','UTF8'),
 'sha256'),'hex') AS wk_research_fp \gset
SELECT set_config('wk.ci.research_fp',:'wk_research_fp',true);
SET SESSION AUTHORIZATION mizizi_executor;
DO $admit_job$
DECLARE result record; replay record; denied boolean:=false;
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
 SELECT * INTO STRICT replay FROM mizizi_private.admit_case_research_job_v1(
  current_setting('wk.ci.case')::uuid,current_setting('wk.ci.ws')::uuid,2,
  'system:mizizi','wk-ci-research:'||current_setting('wk.ci.case')||':2',
  current_setting('wk.ci.research_fp'),
  'Check bounded local worker recovery without external provider access.');
 IF replay.outcome<>'replayed' OR replay.job_id<>result.job_id
  OR replay.command_receipt_id<>result.command_receipt_id
 THEN RAISE EXCEPTION 'STOP_J27_SHARED_JOB_REPLAY_IDENTITY_DRIFT'; END IF;
 RAISE NOTICE 'CI_J27_TYPED_RESEARCH_JOB_IDEMPOTENT_REPLAY=PASS';
 BEGIN
  PERFORM * FROM mizizi_private.admit_case_research_job_v1(
   current_setting('wk.ci.case')::uuid,current_setting('wk.ci.ws')::uuid,2,
   'system:mizizi','wk-ci-research:'||current_setting('wk.ci.case')||':2',
   repeat('e',64),
   'Check bounded local worker recovery without external provider access.');
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'STOP_J28_RESEARCH_FINGERPRINT_DRIFT_ADMITTED'; END IF;
 RAISE NOTICE 'CI_J28_SHARED_JOB_FINGERPRINT_DRIFT_REJECTED=PASS';
END $admit_job$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_job_evidence_counts$
BEGIN
 IF (SELECT count(*) FROM platform_private.jobs
      WHERE command_receipt_id=current_setting('wk.ci.receipt')::uuid)<>1
  OR (SELECT count(*) FROM platform_private.outbox_events
      WHERE command_receipt_id=current_setting('wk.ci.receipt')::uuid
       AND event_type='mizizi.case_research_v1.accepted')<>1
  OR (SELECT count(*) FROM mizizi_private.case_receipt_links
      WHERE case_id=current_setting('wk.ci.case')::uuid
       AND relation_type='command_receipt'
       AND authority_id=current_setting('wk.ci.receipt')::uuid)<>1
 THEN RAISE EXCEPTION 'STOP_J27_J28_RETRY_ADDED_DUPLICATE_COMMAND_HISTORY'; END IF;
 IF (SELECT count(*) FROM platform_private.command_receipts r
    WHERE r.id=current_setting('wk.ci.receipt')::uuid
      AND r.command_type='mizizi.case_research_v1'
      AND r.principal_key='system:mizizi'
      AND r.resource_id=current_setting('wk.ci.case')::uuid)<>1
    OR (SELECT count(*) FROM editorial.resources res
      WHERE res.id=current_setting('wk.ci.case')::uuid
        AND res.resource_kind='mizizi_case'
        AND res.visibility='internal' AND res.lifecycle_state='active')<>1
    OR (SELECT count(*) FROM mizizi_private.case_resource_bindings b
      WHERE b.case_id=current_setting('wk.ci.case')::uuid
        AND b.resource_id=current_setting('wk.ci.case')::uuid
        AND b.workspace_id=current_setting('wk.ci.ws')::uuid)<>1
    OR (SELECT count(*) FROM platform_private.jobs j
      WHERE j.id=current_setting('wk.ci.job')::uuid AND j.status='queued'
        AND j.job_type='mizizi.case_research_v1'
        AND j.command_type='mizizi.case_research_v1'
        AND j.resource_id=current_setting('wk.ci.case')::uuid)<>1
    OR (SELECT count(*) FROM platform_private.registry_execution_grants
      WHERE status='active')<>0
  THEN RAISE EXCEPTION 'STOP_J26_REAL_TYPED_RESEARCH_ADMISSION_AUTHORITY_DRIFT'; END IF;
  RAISE NOTICE 'CI_J26_SOURCE_BOUND_CASE_TYPED_RESOURCE_JOB_AND_COMMAND_RECEIPT=PASS';
  RAISE NOTICE 'CI_J27_J28_ONE_COMMAND_RECEIPT_ONE_JOB_ONE_OUTBOX=PASS';
END $wk_job_evidence_counts$;
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

-- C14 is a trusted-gateway replay negative, NOT an authenticated operator
-- completion. The durable source-backed case is put into done_for_now only by
-- this local disposable superuser after all worker and hold assertions finish.
DO $wk_c14_synthetic_terminal_fixture$
BEGIN
 IF (SELECT count(*) FROM mizizi_private.cases c
      WHERE c.id=current_setting('wk.ci.case')::uuid
        AND c.revision=2 AND c.case_state='in_progress'
        AND c.current_stage='research')<>1
 OR (SELECT count(*) FROM mizizi_private.case_events
      WHERE case_id=current_setting('wk.ci.case')::uuid)<>2
 THEN RAISE EXCEPTION 'STOP_C14_EXPECTED_AUTHENTIC_SOURCE_CASE_MISSING'; END IF;
 UPDATE mizizi_private.cases
 SET revision=3,case_state='done_for_now',
   transition_actor_key='system:mizizi',
   transition_reason='Disposable terminal replay probe; no human decision or closure.'
 WHERE id=current_setting('wk.ci.case')::uuid AND revision=2;
 IF NOT FOUND THEN RAISE EXCEPTION 'STOP_C14_SYNTHETIC_TERMINAL_REVISION_NOT_CREATED'; END IF;
END $wk_c14_synthetic_terminal_fixture$;
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_c14_trusted_gateway_terminal_replay$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
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
 EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN
  RAISE EXCEPTION 'STOP_C14_COMPLETED_CASE_REPLAY_UNEXPECTEDLY_ACCEPTED';
 END IF;
 RAISE NOTICE 'CI_C14_SYNTHETIC_DONE_FOR_NOW_TRUSTED_GATEWAY_REPLAY_DENIED=PASS';
END $wk_c14_trusted_gateway_terminal_replay$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_c14_independent_terminal_postcheck$
BEGIN
 IF (SELECT count(*) FROM mizizi_private.cases
     WHERE id=current_setting('wk.ci.case')::uuid AND revision=3
       AND case_state='done_for_now' AND current_stage='research')<>1
 OR (SELECT array_agg(e.case_revision ORDER BY e.event_seq)
     FROM mizizi_private.case_events e
     WHERE e.case_id=current_setting('wk.ci.case')::uuid)
    IS DISTINCT FROM ARRAY[1,2,3]::integer[]
 OR (SELECT count(*) FROM mizizi_private.case_receipt_links
     WHERE case_id=current_setting('wk.ci.case')::uuid
       AND id=current_setting('wk.ci.link')::uuid
       AND relation_type='review_item')<>1
 OR (SELECT count(*) FROM public.registry_review_items
     WHERE id=current_setting('wk.ci.review')::uuid AND status='open')<>1
 THEN RAISE EXCEPTION 'STOP_C14_REJECTED_REPLAY_ALTERED_IMMUTABLE_CASE_OR_REVIEW'; END IF;
 RAISE NOTICE 'CI_C14_TERMINAL_REPLAY_PRESERVED_JOURNAL_AND_REVIEW_RECEIPT=PASS';
 RAISE NOTICE 'CI_C14_AUTHENTICATED_DURABLE_COMPLETION=NOT_RUN';
END $wk_c14_independent_terminal_postcheck$;


-- C12: same live canonical Release, changed deterministic observation,
-- one existing Registry human review and immutable receipt, two revisions.
WITH nonce AS (SELECT substr(md5(gen_random_uuid()::text),1,12) AS suffix),
 created AS (
 INSERT INTO public.registry_releases(slug,title,normalized_title,status,metadata)
 SELECT 'wk-ci-c12-'||suffix,'C12 Disposable Release','c12 disposable release',
  'active',jsonb_build_object('fixture','c12-local-only')
 FROM nonce RETURNING id,slug
)
SELECT set_config('wk.c12.release',id::text,true),
 set_config('wk.c12.slug',slug,true),
 set_config('wk.c12.first',slug||'-accepted',true),
 set_config('wk.c12.second',slug||'-revised',true)
FROM created;
SELECT set_config('wk.c12.fp1',mizizi_private.finding_fingerprint_v1(
 'release_slug_provider_packaging','1.2.0','release',
 current_setting('wk.c12.release'),'slug',
 current_setting('wk.c12.slug'),current_setting('wk.c12.first')),true);
SELECT set_config('wk.c12.fp2',mizizi_private.finding_fingerprint_v1(
 'release_slug_provider_packaging','1.2.0','release',
 current_setting('wk.c12.release'),'slug',
 current_setting('wk.c12.slug'),current_setting('wk.c12.second')),true);
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_c12_changed_source$
DECLARE v_first record;v_changed record;v_repeat record;
 v_input jsonb;v_new jsonb;v_denied boolean:=false;
BEGIN
 v_input:=jsonb_build_object(
  'entityType','release','entityId',current_setting('wk.c12.release'),
  'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',
  'fieldName','slug','currentValue',current_setting('wk.c12.slug'),
  'proposedValue',current_setting('wk.c12.first'),
  'fingerprint',current_setting('wk.c12.fp1'),
  'confidence',1,'severity','high','disposition','review',
  'reason','Disposable C12 actual first source observation.',
  'evidence',jsonb_build_object('fixture','c12-local-only'));
 SELECT * INTO STRICT v_first FROM mizizi_private.admit_review_case_gateway_v1(
  current_setting('wk.ci.ws')::uuid,'wk-ci-c12-review',v_input);
 IF v_first.outcome<>'created' OR v_first.headquarters_case_revision<>1
 THEN RAISE EXCEPTION 'STOP_C12_FIRST_OBSERVATION_NOT_CREATED'; END IF;
 PERFORM set_config('wk.c12.case',v_first.headquarters_case_id::text,true);
 PERFORM set_config('wk.c12.review',v_first.review_item_id::text,true);
 PERFORM set_config('wk.c12.link',v_first.receipt_link_id::text,true);
 v_new:=jsonb_set(v_input,'{proposedValue}',to_jsonb(current_setting('wk.c12.second')));
 v_new:=jsonb_set(v_new,'{fingerprint}',to_jsonb(current_setting('wk.c12.fp2')));
 SELECT * INTO STRICT v_changed FROM mizizi_private.admit_review_case_gateway_v1(
  current_setting('wk.ci.ws')::uuid,'wk-ci-c12-review',v_new);
 IF v_changed.outcome<>'observation_recorded'
  OR v_changed.headquarters_case_revision<>2
  OR v_changed.headquarters_case_id<>v_first.headquarters_case_id
  OR v_changed.review_item_id<>v_first.review_item_id
  OR v_changed.receipt_link_id<>v_first.receipt_link_id
 THEN RAISE EXCEPTION 'STOP_C12_CHANGED_FINDING_CASE_REVIEW_BINDING'; END IF;
 SELECT * INTO STRICT v_repeat FROM mizizi_private.admit_review_case_gateway_v1(
  current_setting('wk.ci.ws')::uuid,'wk-ci-c12-review',v_new);
 IF v_repeat.outcome<>'unchanged' OR v_repeat.headquarters_case_revision<>2
  OR v_repeat.review_item_id<>v_first.review_item_id
  OR v_repeat.receipt_link_id<>v_first.receipt_link_id
 THEN RAISE EXCEPTION 'STOP_C12_CHANGED_OBSERVATION_REPLAY_NONIDEMPOTENT'; END IF;
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
    current_setting('wk.ci.ws')::uuid,'wk-ci-c12-review',
    jsonb_set(v_new,'{fingerprint}',to_jsonb(repeat('f',64))));
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C12_FORGED_SECOND_FINGERPRINT'; END IF;
 RAISE NOTICE 'CI_C12_CHANGED_VERIFIED_OBSERVATION_ONE_CASE_REVIEW_RECEIPT=PASS';
 RAISE NOTICE 'CI_C12_CHANGED_OBSERVATION_EXACT_REPLAY_AND_FORGED_HASH=PASS';
END $wk_c12_changed_source$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_c12_independent_provenance$
DECLARE v_case uuid:=current_setting('wk.c12.case')::uuid;
 v_row uuid;v_denied boolean:=false;
BEGIN
 IF (SELECT count(*) FROM mizizi_private.cases
  WHERE id=v_case AND revision=2 AND case_state='open'
   AND last_observation_fingerprint=current_setting('wk.c12.fp2'))<>1
 OR (SELECT array_agg(o.case_revision ORDER BY o.case_revision)
   FROM mizizi_private.case_observations o WHERE o.case_id=v_case)
    IS DISTINCT FROM ARRAY[1,2]::integer[]
 OR (SELECT count(*) FROM mizizi_private.case_observations
   WHERE case_id=v_case AND case_revision=2
    AND previous_case_revision=1
    AND previous_observation_fingerprint=current_setting('wk.c12.fp1')
    AND observation_fingerprint=current_setting('wk.c12.fp2')
    AND original_review_key='mizizi:'||current_setting('wk.c12.fp1'))<>1
 OR (SELECT count(*) FROM mizizi_private.case_receipt_links
   WHERE case_id=v_case AND id=current_setting('wk.c12.link')::uuid)<>1
 OR (SELECT count(*) FROM public.registry_review_items
   WHERE id=current_setting('wk.c12.review')::uuid AND status='open'
    AND review_key='mizizi:'||current_setting('wk.c12.fp1'))<>1
 OR (SELECT count(*) FROM public.registry_releases
   WHERE id=current_setting('wk.c12.release')::uuid AND status='active'
    AND slug=current_setting('wk.c12.slug'))<>1
 OR (SELECT count(*) FROM mizizi_private.case_events
    WHERE case_id=v_case)<>2
 THEN RAISE EXCEPTION 'STOP_C12_PROVENANCE_OR_REGISTRY_MUTATION_DRIFT'; END IF;
 SELECT id INTO STRICT v_row FROM mizizi_private.case_observations
  WHERE case_id=v_case AND case_revision=1;
 BEGIN UPDATE mizizi_private.case_observations SET source_finding_sha256=repeat('1',64)
   WHERE id=v_row; EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C12_OBSERVATION_RECEIPT_UPDATE_ALLOWED'; END IF;
 v_denied:=false;
 BEGIN DELETE FROM mizizi_private.case_observations WHERE id=v_row;
 EXCEPTION WHEN SQLSTATE '23514' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C12_OBSERVATION_RECEIPT_DELETE_ALLOWED'; END IF;
 RAISE NOTICE 'CI_C12_TWO_IMMUTABLE_OBSERVATIONS_ONE_UNCHANGED_REVIEW=PASS';
END $wk_c12_independent_provenance$;


-- A05: real canonical Release packaging-shaped 1.2.0 source, review only.
WITH source AS (
 INSERT INTO public.registry_releases(slug,title,normalized_title,status,metadata)
 VALUES ('wk-ci-a05-single','A05 Disposable Release (Single)',
   'a05 disposable release single','active','{"ci_only":true}'::jsonb)
 RETURNING id,slug
)
SELECT set_config('wk.a05.id',id::text,true),
 set_config('wk.a05.slug',slug,true) FROM source;
SELECT set_config('wk.a05.fp',mizizi_private.finding_fingerprint_v1(
 'release_slug_provider_packaging','1.2.0','release',
 current_setting('wk.a05.id'),'slug',current_setting('wk.a05.slug'),
 'wk-ci-a05'),true);
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_a05$
DECLARE v record;
BEGIN
 SELECT * INTO STRICT v FROM mizizi_private.admit_review_case_gateway_v1(
 current_setting('wk.ci.ws')::uuid,'wk-ci-a05',
 jsonb_build_object('entityType','release','entityId',current_setting('wk.a05.id'),
 'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',
 'fieldName','slug','currentValue',current_setting('wk.a05.slug'),
 'proposedValue','wk-ci-a05','fingerprint',current_setting('wk.a05.fp'),
 'confidence',1,'severity','high','disposition','review',
 'reason','Canonical Release packaging suffix is structural, requires human review.',
 'evidence',jsonb_build_object('packagingType','single','ci_only',true)));
 IF v.outcome<>'created' OR v.headquarters_case_revision<>1
 OR v.review_item_id IS NULL OR v.receipt_link_id IS NULL
 THEN RAISE EXCEPTION 'STOP_A05_APPROVED_PACKAGING_SOURCE_NOT_ADMITTED'; END IF;
 PERFORM set_config('wk.a05.case',v.headquarters_case_id::text,true);
 PERFORM set_config('wk.a05.review',v.review_item_id::text,true);
 RAISE NOTICE 'CI_A05_APPROVED_RELEASE_PACKAGING_V1_2_SOURCE_GATEWAY=PASS';
END $wk_a05$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_a05_check$
BEGIN
 IF (SELECT count(*) FROM public.registry_releases WHERE id=current_setting('wk.a05.id')::uuid
  AND slug='wk-ci-a05-single' AND status='active')<>1
 OR (SELECT count(*) FROM mizizi_private.cases WHERE id=current_setting('wk.a05.case')::uuid
  AND revision=1 AND subject_id=current_setting('wk.a05.id')::uuid
  AND claim_key='mizizi.release_slug_provider_packaging.slug')<>1
 OR (SELECT count(*) FROM public.registry_review_items WHERE id=current_setting('wk.a05.review')::uuid
  AND status='open' AND review_key='mizizi:'||current_setting('wk.a05.fp'))<>1
 OR (SELECT count(*) FROM mizizi_private.case_receipt_links
  WHERE case_id=current_setting('wk.a05.case')::uuid AND
  authority_id=current_setting('wk.a05.review')::uuid)<>1
 THEN RAISE EXCEPTION 'STOP_A05_CANONICAL_SOURCE_OR_REVIEW_INTEGRITY'; END IF;
 RAISE NOTICE 'CI_A05_CANONICAL_RELEASE_UNCHANGED_REVIEW_AND_RECEIPT=PASS';
END $wk_a05_check$;

-- C11: same canonical Track, two different approved rule/claim identities.
WITH source AS (
 INSERT INTO public.registry_tracks(slug,title,normalized_title,status,metadata)
 VALUES ('wk-ci-c11-feat-unverified','C11 Disposable Track',
 'c11 disposable track','active','{"ci_only":true}'::jsonb)
 RETURNING id
)
SELECT set_config('wk.c11.id',id::text,true) FROM source;
SELECT set_config('wk.c11.fp1',mizizi_private.finding_fingerprint_v1(
 'track_slug_identity_noise','1.2.0','track',current_setting('wk.c11.id'),
 'slug','wk-ci-c11-feat-unverified','wk-ci-c11-clean'),true),
 set_config('wk.c11.fp2',mizizi_private.finding_fingerprint_v1(
 'track_slug_credit_evidence_gap','1.3.0','track',current_setting('wk.c11.id'),
 'slug','wk-ci-c11-feat-unverified','wk-ci-c11-credit-check'),true);
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_c11$
DECLARE v_first record; v_second record;
BEGIN
 SELECT * INTO STRICT v_first FROM mizizi_private.admit_review_case_gateway_v1(
 current_setting('wk.ci.ws')::uuid,'wk-ci-c11',
 jsonb_build_object('entityType','track','entityId',current_setting('wk.c11.id'),
 'ruleId','track_slug_identity_noise','ruleVersion','1.2.0','fieldName','slug',
 'currentValue','wk-ci-c11-feat-unverified','proposedValue','wk-ci-c11-clean',
 'fingerprint',current_setting('wk.c11.fp1'),'confidence',1,
 'severity','high','disposition','review',
 'reason','First approved same-source Track slug claim.',
 'evidence',jsonb_build_object('ci_only',true)));
 SELECT * INTO STRICT v_second FROM mizizi_private.admit_review_case_gateway_v1(
 current_setting('wk.ci.ws')::uuid,'wk-ci-c11',
 jsonb_build_object('entityType','track','entityId',current_setting('wk.c11.id'),
 'ruleId','track_slug_credit_evidence_gap','ruleVersion','1.3.0','fieldName','slug',
 'currentValue','wk-ci-c11-feat-unverified','proposedValue','wk-ci-c11-credit-check',
 'fingerprint',current_setting('wk.c11.fp2'),'confidence',1,
 'severity','high','disposition','review',
 'reason','Second approved same-source Track feature-credit claim.',
 'evidence',jsonb_build_object('ci_only',true,'gap','unverified credit')));
 IF v_first.outcome<>'created' OR v_second.outcome<>'created'
 OR v_first.headquarters_case_id=v_second.headquarters_case_id
 OR v_first.review_item_id=v_second.review_item_id
 OR v_first.receipt_link_id=v_second.receipt_link_id
 OR v_first.headquarters_case_revision<>1 OR v_second.headquarters_case_revision<>1
 THEN RAISE EXCEPTION 'STOP_C11_DISTINCT_CLAIM_ADMISSION_NOT_INDEPENDENT'; END IF;
 RAISE NOTICE 'CI_C11_SAME_TRACK_TWO_INDEPENDENT_APPROVED_CLAIMS=PASS';
END $wk_c11$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_c11_check$
BEGIN
 IF (SELECT count(*) FROM mizizi_private.cases
  WHERE subject_id=current_setting('wk.c11.id')::uuid AND revision=1
  AND claim_family_key='track_identity_metadata_review_v1'
  AND claim_key IN ('mizizi.track_slug_identity_noise.slug',
                    'mizizi.track_slug_credit_evidence_gap.slug'))<>2
 OR (SELECT count(*) FROM public.registry_review_items
  WHERE entity_id=current_setting('wk.c11.id')::uuid AND status='open')<>2
 OR (SELECT count(*) FROM mizizi_private.case_events e
   JOIN mizizi_private.cases c ON c.id=e.case_id
   WHERE c.subject_id=current_setting('wk.c11.id')::uuid)<>2
 OR (SELECT count(*) FROM mizizi_private.case_receipt_links l
   JOIN mizizi_private.cases c ON c.id=l.case_id
   WHERE c.subject_id=current_setting('wk.c11.id')::uuid
     AND l.relation_type='review_item')<>2
 OR (SELECT count(*) FROM public.registry_tracks
  WHERE id=current_setting('wk.c11.id')::uuid AND slug='wk-ci-c11-feat-unverified')<>1
 THEN RAISE EXCEPTION 'STOP_C11_DISTINCT_CLAIM_LEDGER_POSTCHECK'; END IF;
 RAISE NOTICE 'CI_C11_TWO_DISTINCT_CASES_REVIEWS_EVENTS_NO_SOURCE_WRITE=PASS';
END $wk_c11_check$;

-- C13: an observation sourced against an obsolete canonical slug cannot
-- advance the already recorded C12 case; this is distinct from replaying
-- a previous hash while the canonical source has not changed.
UPDATE public.registry_releases SET slug=current_setting('wk.c12.second')
 WHERE id=current_setting('wk.c12.release')::uuid
 AND slug=current_setting('wk.c12.slug');
DO $wk_c13_preflight$
BEGIN
 IF (SELECT count(*) FROM public.registry_releases
 WHERE id=current_setting('wk.c12.release')::uuid
 AND slug=current_setting('wk.c12.second'))<>1
 THEN RAISE EXCEPTION 'STOP_C13_CANONICAL_FIXTURE_NOT_CHANGED'; END IF;
END $wk_c13_preflight$;
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_c13$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
 current_setting('wk.ci.ws')::uuid,'wk-ci-c12-review',
 jsonb_build_object('entityType','release','entityId',current_setting('wk.c12.release'),
 'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0','fieldName','slug',
 'currentValue',current_setting('wk.c12.slug'),'proposedValue',current_setting('wk.c12.first'),
 'fingerprint',current_setting('wk.c12.fp1'),'confidence',1,
 'severity','high','disposition','review',
 'reason','Prior stale observation after the canonical source changed.',
 'evidence',jsonb_build_object('ci_only',true)));
 EXCEPTION WHEN SQLSTATE '40001' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'STOP_C13_STALE_CANONICAL_OBSERVATION_ACCEPTED'; END IF;
 RAISE NOTICE 'CI_C13_CANONICAL_SOURCE_DRIFT_STALE_OBSERVATION_DENIED=PASS';
END $wk_c13$;
SET SESSION AUTHORIZATION DEFAULT;
DO $wk_c13_check$
BEGIN
 IF (SELECT count(*) FROM mizizi_private.cases
  WHERE id=current_setting('wk.c12.case')::uuid AND revision=2
  AND last_observation_fingerprint=current_setting('wk.c12.fp2'))<>1
 OR (SELECT count(*) FROM mizizi_private.case_observations
  WHERE case_id=current_setting('wk.c12.case')::uuid)<>2
 OR (SELECT count(*) FROM mizizi_private.case_events
  WHERE case_id=current_setting('wk.c12.case')::uuid)<>2
 OR (SELECT count(*) FROM public.registry_review_items
  WHERE id=current_setting('wk.c12.review')::uuid AND status='open')<>1
 THEN RAISE EXCEPTION 'STOP_C13_REJECTED_STALE_CASE_MUTATED'; END IF;
 RAISE NOTICE 'CI_C13_STALE_CANONICAL_DENIAL_PRESERVED_EVENT_AND_REVIEW=PASS';
END $wk_c13_check$;

ROLLBACK;
\echo WK_CI_DISPOSABLE_WORKER_SQL_ROLLBACK=PASS
