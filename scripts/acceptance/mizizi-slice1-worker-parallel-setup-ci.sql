-- WAKILISHA Slice 1 true-concurrency fixture. CI-only disposable database.
-- Fresh local 230 migration replay only. NEVER on linked, Preview or Production DB.
-- SET SESSION AUTHORIZATION is a local simulator, NOT a real service JWT/JIT login.
-- This separate fixture must COMMIT to become visible to two independent DB sessions.
-- Never run on a linked or hosted database. The CI job destroys its local volume.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $guard$
DECLARE n integer; head text;
BEGIN
 SELECT count(*),max(version) INTO n,head FROM supabase_migrations.schema_migrations;
 IF n<>230 OR head<>'20261014182214'
   OR session_user<>'supabase_admin' OR current_user<>'supabase_admin'
   OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin')
   OR (SELECT count(*) FROM mizizi_private.cases)<>0
   OR (SELECT count(*) FROM public.registry_releases)<>0
   OR (SELECT count(*) FROM platform_private.jobs)<>0
   OR to_regprocedure('public.mizizi_claim_case_research_jobs_v1(text,integer,integer)') IS NULL
   OR to_regprocedure('public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)') IS NULL
   OR to_regprocedure('public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'STOP_CI_WORKER_EXACT_EMPTY_LOCAL_230_REQUIRED'; END IF;
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
COMMIT;
\echo WK_CI_PARALLEL_FIXTURE_LOCAL_COMMIT=PASS
