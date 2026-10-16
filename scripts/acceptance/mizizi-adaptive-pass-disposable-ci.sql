-- Disposable ONLY. Original 231 history first, then DB04 and source-first DB05.
-- No Production/Preview, authentic research or external source permissions.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $gate$
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>233
   or (select max(version) from supabase_migrations.schema_migrations)<>'20261016092731'
   or to_regclass('mizizi_private.research_passes') is null
 then raise exception 'DB04/DB05 require exact 233-migration replay';end if;
 if has_table_privilege('service_role','mizizi_private.research_passes','SELECT')
    or has_table_privilege('authenticated','mizizi_private.research_passes','SELECT')
    or has_table_privilege('anon','mizizi_private.research_passes','INSERT')
    or has_schema_privilege('service_role','mizizi_private','USAGE')
    or not has_function_privilege('service_role','public.mizizi_append_research_pass_v1(uuid,text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.mizizi_append_research_pass_v1(uuid,text,text,text,text)','EXECUTE')
 then raise exception 'DB04 private pass authority drift';end if;
end $gate$;
select id::text as wk_ws from mizizi_private.workspaces
 where workspace_key='wakilisha-internal' and status='active' \gset
with row as (
 insert into public.registry_releases(slug,title,normalized_title,status,metadata)
 values ('wk-ci-db04-'||substr(md5(gen_random_uuid()::text),1,12),
 'Disposable Research Source','disposable research source','active',
 '{"ci_only":true}'::jsonb)
 returning id,slug
)
select id::text as wk_release,slug as wk_slug,slug||'-alternative' as wk_target
from row \gset
select mizizi_private.finding_fingerprint_v1(
 'release_slug_provider_packaging','1.2.0','release',:'wk_release',
 'slug',:'wk_slug',:'wk_target') as wk_finding_fp \gset
select set_config('wk.db04.ws',:'wk_ws',true),
 set_config('wk.db04.release',:'wk_release',true),
 set_config('wk.db04.slug',:'wk_slug',true),
 set_config('wk.db04.target',:'wk_target',true),
 set_config('wk.db04.fp',:'wk_finding_fp',true);
set session authorization mizizi_executor;
do $case$
declare c record;
begin
 select * into strict c from mizizi_private.admit_review_case_gateway_v1(
 current_setting('wk.db04.ws')::uuid,'wk-ci-db04',
 jsonb_build_object('entityType','release','entityId',current_setting('wk.db04.release'),
 'ruleId','release_slug_provider_packaging','ruleVersion','1.2.0',
 'fieldName','slug','currentValue',current_setting('wk.db04.slug'),
 'proposedValue',current_setting('wk.db04.target'),
 'fingerprint',current_setting('wk.db04.fp'),'confidence',1,
 'severity','high','disposition','review',
 'reason','Local-only DB04 researched source receipt regression.',
 'evidence',jsonb_build_object('ci_only',true)));
 if c.outcome<>'created' or c.headquarters_case_revision<>1
 then raise exception 'DB04 case broker failed';end if;
 perform set_config('wk.db04.case',c.headquarters_case_id::text,true);
end $case$;
set session authorization default;
update mizizi_private.cases set revision=revision+1,
 case_state='in_progress',current_stage='research',
 transition_actor_key='system:mizizi',
 transition_reason='Disposable DB04 research-stage fixture not a human decision.'
 where id=current_setting('wk.db04.case')::uuid and revision=1;
select encode(sha256(convert_to(
 current_setting('wk.db04.case')||E'\n'||current_setting('wk.db04.ws')
 ||E'\n2\nread_only_research\n'||
 'Investigate the unfamiliar research question in isolated local acceptance.',
 'UTF8')),'hex') as wk_request_fp \gset
select set_config('wk.db04.request_fp',:'wk_request_fp',true);
set session authorization mizizi_executor;
do $job$
declare j record;
begin
 select * into strict j from mizizi_private.admit_case_research_job_v1(
 current_setting('wk.db04.case')::uuid,current_setting('wk.db04.ws')::uuid,2,
 'system:mizizi','wk-ci-db04:'||current_setting('wk.db04.case')||':2',
 current_setting('wk.db04.request_fp'),
 'Investigate the unfamiliar research question in isolated local acceptance.');
 if j.outcome<>'created' or j.job_status<>'queued'
 then raise exception 'DB04 shared job admission failed';end if;
 perform set_config('wk.db04.job',j.job_id::text,true);
end $job$;
set session authorization default;
set session authorization service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $claim$
declare j record;
begin
 select * into strict j from public.mizizi_claim_case_research_jobs_v1(
 'wk-db04-reader',1,300);
 if j.job_id<>current_setting('wk.db04.job')::uuid
 then raise exception 'DB04 expected leased job missing';end if;
end $claim$;
do $append$
declare
 body1 text; body2 text; hash1 text; hash2 text;
 r record; denied boolean:=false;
begin
 body1:=jsonb_build_object(
 'contract','mizizi.adaptive_investigation.v1',
 'caseId',current_setting('wk.db04.case'),
 'workspaceId',current_setting('wk.db04.ws'),
 'ordinal',1,'question','What is known from the first authentic source?',
 'predecessorFingerprint',null,
 'sourceReceipts','[]'::jsonb,'findings','[]'::jsonb,
 'proposedLeads',jsonb_build_array(jsonb_build_object(
    'question','Which original evidence could resolve the follow-up?',
    'expectedInformationGain',0.9,'importance',0.8,'estimatedCostUnits',1,
    'rationale','The next source may distinguish competing explanations.')),
 'passFinding','Evidence is inconclusive and suggests a more important question.',
 'decision',jsonb_build_object('action','continue',
   'nextQuestion','Which original evidence could resolve the follow-up?',
   'rationale','The new evidence source is worth investigating.',
   'revisitTrigger',null),
 'modelVersion','disposable-fixture','promptFingerprint',repeat('b',64),
 'recordedAt',to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),'costUnits',0)::text;
 hash1:=encode(sha256(convert_to(body1,'UTF8')),'hex');
 select * into strict r from public.mizizi_append_research_pass_v1(
 current_setting('wk.db04.job')::uuid,'wk-db04-reader',body1,hash1,null);
 if r.outcome<>'created' or r.ordinal<>1 then
  raise exception 'DB04 pass one append not persisted';end if;
 select * into strict r from public.mizizi_append_research_pass_v1(
 current_setting('wk.db04.job')::uuid,'wk-db04-reader',body1,hash1,null);
 if r.outcome<>'replayed' then
  raise exception 'DB04 pass one idempotent retry failed';end if;
 body2:=jsonb_build_object(
 'contract','mizizi.adaptive_investigation.v1',
 'caseId',current_setting('wk.db04.case'),
 'workspaceId',current_setting('wk.db04.ws'),
 'ordinal',2,
 'question','Which original evidence could resolve the follow-up?',
 'predecessorFingerprint',hash1,
 'sourceReceipts','[]'::jsonb,'findings','[]'::jsonb,
 'proposedLeads','[]'::jsonb,
 'passFinding','The second inquiry still lacks definitive source material.',
 'decision',jsonb_build_object('action','pause','nextQuestion',null,
  'rationale','Await an independent new observation.',
  'revisitTrigger','Original source availability or permission changes'),
 'modelVersion','disposable-fixture','promptFingerprint',repeat('b',64),
 'recordedAt',to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'),'costUnits',0)::text;
 hash2:=encode(sha256(convert_to(body2,'UTF8')),'hex');
 begin
  perform * from public.mizizi_append_research_pass_v1(
   current_setting('wk.db04.job')::uuid,'wk-db04-reader',body2,hash2,repeat('a',64));
 exception when SQLSTATE '22023' or SQLSTATE '55000' then denied:=true;end;
 if not denied then raise exception 'DB04 false predecessor was accepted';end if;
 select * into strict r from public.mizizi_append_research_pass_v1(
 current_setting('wk.db04.job')::uuid,'wk-db04-reader',body2,hash2,hash1);
 if r.outcome<>'created' or r.ordinal<>2 then
  raise exception 'DB04 pass two append failed';end if;
 if (select count(*) from public.mizizi_read_research_passes_v1(
   current_setting('wk.db04.job')::uuid,'wk-db04-reader'))<>2
 then raise exception 'DB04 pass recovery read mismatch';end if;
 perform set_config('wk.db04.hash1',hash1,true);
 raise notice 'WK_DB04_TWO_PASSES_ATOMIC_CAS_REPLAY=PASS';
end $append$;
set session authorization default;
do $immutable$
declare denied boolean:=false;
begin
 begin
 update mizizi_private.research_passes set body_text='tampered'
 where case_id=current_setting('wk.db04.case')::uuid and ordinal=1;
 exception when SQLSTATE '55000' then denied:=true;end;
 if not denied then raise exception 'DB04 immutable research history modified';end if;
 if (select count(*) from mizizi_private.research_passes
 where case_id=current_setting('wk.db04.case')::uuid)<>2
 then raise exception 'DB04 pass count drift';end if;
 raise notice 'WK_DB04_IMMUTABLE_PASS_HISTORY=PASS';
end $immutable$;
set session authorization anon;
select set_config('request.jwt.claim.role','anon',true);
do $denial$
declare denied boolean:=false;
begin
 begin
 perform * from public.mizizi_read_research_passes_v1(
 current_setting('wk.db04.job')::uuid,'wk-db04-reader');
 exception when SQLSTATE '42501' then denied:=true;end;
 if not denied then raise exception 'DB04 anon private research was accessible';end if;
 raise notice 'WK_DB04_ANON_RESEARCH_READ_DENIED=PASS';
end $denial$;
set session authorization default;
-- The unfamiliar family must be admitted independently of historical rule
-- versions. This synthetic fixture does NOT count as an authentic investigation.
with t as (
 insert into public.registry_tracks(slug,title,normalized_title,status,metadata)
 values ('wk-ci-db04-unfamiliar-'||substr(md5(gen_random_uuid()::text),1,10),
  'Disposable Unknown Track','disposable unknown track','active','{"ci_only":true}'::jsonb)
 returning id
)
select id::text as wk_unknown_track from t \gset
select set_config('wk.db04.unknown_track',:'wk_unknown_track',true);
set session authorization mizizi_executor;
do $unknown_case$
declare a record;b record;
begin
 select * into strict a from mizizi_private.admit_unfamiliar_track_investigation_v1(
 current_setting('wk.db04.ws')::uuid,
 current_setting('wk.db04.unknown_track')::uuid,
 'Which original source establishes the historically credited musician?');
 if a.outcome<>'created' or a.case_revision<>1
 then raise exception 'DB04 unknown research-only admission failed';end if;
 select * into strict b from mizizi_private.admit_unfamiliar_track_investigation_v1(
 current_setting('wk.db04.ws')::uuid,
 current_setting('wk.db04.unknown_track')::uuid,
 'Which original source establishes the historically credited musician?');
 if b.outcome<>'replayed' or b.case_id<>a.case_id
 then raise exception 'DB04 unknown case replay mutated or duplicated';end if;
 perform set_config('wk.db04.unknown_case',a.case_id::text,true);
 raise notice 'WK_DB04_UNFAMILIAR_RESEARCH_ONLY_CASE_INTAKE=PASS';
end $unknown_case$;
set session authorization default;
do $unknown_check$
begin
 if (select count(*) from mizizi_private.cases where
 id=current_setting('wk.db04.unknown_case')::uuid and
 subject_id=current_setting('wk.db04.unknown_track')::uuid and
 claim_family_key='cultural_investigation_v1' and current_stage='research' and
 epistemic_state='unknown' and mutation_state='not_planned' and
 last_observation_fingerprint ~ '^[0-9a-f]{64}$')<>1
 then raise exception 'DB04 research-only unknown case drift';end if;
 if (select count(*) from mizizi_private.case_events
  where case_id=current_setting('wk.db04.unknown_case')::uuid)<>1
 then raise exception 'DB04 unknown case journal not exact';end if;
 raise notice 'WK_DB04_UNFAMILIAR_CASE_JOURNAL_NO_REGISTRY_MUTATION=PASS';
end $unknown_check$;
-- Source-first external cultural observation without a canonical Track.
-- This remains a deterministic fixture; no Wikidata HTTP or model invoked.
set session authorization mizizi_executor;
do $external$
declare a record; b record; denied boolean:=false;
begin
 select * into strict a from mizizi_private.admit_external_wikidata_research_v1(
 current_setting('wk.db04.ws')::uuid,'Q97652493',12345,repeat('c',64),
 'What distinguishes the musical work "Jerusalema" from another same-name work?');
 if a.outcome<>'created' or a.case_revision<>1
 then raise exception 'Source-first case not admitted';end if;
 select * into strict b from mizizi_private.admit_external_wikidata_research_v1(
 current_setting('wk.db04.ws')::uuid,'Q97652493',12345,repeat('c',64),
 'What distinguishes the musical work "Jerusalema" from another same-name work?');
 if b.case_id<>a.case_id or b.outcome<>'replayed'
 then raise exception 'Source-first idempotent replay failed';end if;
 begin
  perform * from mizizi_private.admit_external_wikidata_research_v1(
   current_setting('wk.db04.ws')::uuid,'Q97652493',12346,repeat('d',64),
   'What distinguishes the musical work "Jerusalema" from another same-name work?');
 exception when sqlstate '55000' then denied:=true;end;
 if not denied then raise exception 'Conflicting original source revision was accepted';end if;
 perform set_config('wk.db04.external_case',a.case_id::text,true);
 raise notice 'WK_DB05_AUTHENTICALLY_UNFAMILIAR_SOURCE_FIRST_GATEWAY=PASS';
end $external$;
set session authorization default;
do $external_invariants$
begin
 if (select count(*) from mizizi_private.cases
  where id=current_setting('wk.db04.external_case')::uuid
    and subject_type='work'
    and claim_family_key='cultural_investigation_v1'
    and current_stage='research'
    and epistemic_state='unknown'
    and mutation_state='not_planned'
    and last_observation_fingerprint=repeat('c',64)
    and policy_ruleset_version='mizizi.wikidata_research_only.v1')<>1
 then raise exception 'External source-only case authority drift';end if;
 if (select count(*) from mizizi_private.case_events
    where case_id=current_setting('wk.db04.external_case')::uuid)<>1
 then raise exception 'External source case journal missing or duplicated';end if;
 if exists(select 1 from public.registry_tracks where title='Jerusalema')
 then raise exception 'External source case synthesized canonical Track';end if;
 if has_function_privilege('authenticated',
  'mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)',
  'execute') or has_function_privilege('service_role',
  'mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)',
  'execute') or not has_function_privilege('mizizi_executor',
  'mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)',
  'execute')
 then raise exception 'External source JIT-only privilege widened';end if;
 raise notice 'WK_DB05_SOURCE_FIRST_NO_CANONICAL_MUTATION=PASS';
end $external_invariants$;
rollback;
\echo WK_DB04_DB05_DISPOSABLE_RESEARCH_MEMORY_ROLLBACK=PASS
