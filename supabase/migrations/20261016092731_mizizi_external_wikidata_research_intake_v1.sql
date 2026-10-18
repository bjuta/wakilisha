-- MIZIZI Slice 2: source-first unfamiliar cultural question, no canonical Track.
-- Exact CLI-minted migration; JIT-only research admission, no Registry writer.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $preflight$
begin
 if current_user<>'postgres'
  or to_regclass('mizizi_private.cases') is null
  or to_regclass('mizizi_private.research_passes') is null
  or to_regprocedure('mizizi_private.assert_executor_v1()') is null
  or to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)') is null
 then
  raise exception 'STOP_MIZIZI_SOURCE_FIRST_EXACT_BASELINE';
 end if;
 if to_regprocedure('mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)') is not null
 then raise exception 'STOP_MIZIZI_SOURCE_FIRST_GATEWAY_COLLISION';end if;
end;
$preflight$;

-- An independently acquired original Wikidata entity revision is the
-- investigation SUBJECT, not a Registry Work or rights assertion.
-- Caller's exact payload fingerprint is reverified by the external reader;
-- SQL itself does NOT claim correctness of the Wikidata assertion.
create function mizizi_private.admit_external_wikidata_research_v1(
 p_workspace_id uuid,
 p_qid text,
 p_revision bigint,
 p_source_payload_fingerprint text,
 p_public_question text
)
returns table(case_id uuid,workspace_id uuid,case_revision integer,outcome text)
language plpgsql security definer set search_path=pg_catalog
as $gate$
declare
 v_workspace uuid;
 v_qid text;
 v_question text;
 v_key text;
 v_source_uuid uuid;
 v_case mizizi_private.cases%rowtype;
 v_outcome text:='created';
begin
 perform mizizi_private.assert_executor_v1();
 if session_user<>'mizizi_executor' then
  raise exception 'Only approved narrow JIT executor may admit unfamiliar source research'
  using errcode='42501';
 end if;
 v_qid:=btrim(p_qid);
 v_question:=btrim(p_public_question);
 if p_workspace_id is null or p_qid is null
  or p_qid is distinct from v_qid
  or v_qid !~ '^Q[1-9][0-9]{0,11}$'
  or p_revision is null or p_revision<1
  or p_source_payload_fingerprint is null
  or p_source_payload_fingerprint !~ '^[a-f0-9]{64}$'
  or p_public_question is null
  or p_public_question is distinct from v_question
  or char_length(v_question) not between 20 and 500
  or v_question ~ '[[:cntrl:]]'
 then raise exception 'Invalid original public cultural observation' using errcode='22023';end if;
 select w.id into strict v_workspace
 from mizizi_private.workspaces w
 where w.id=p_workspace_id and w.workspace_key='wakilisha-internal'
  and w.workspace_kind='internal' and w.status='active';
 -- Stable external QID proxy identity. Not a Registry Work UUID.
 v_source_uuid:=md5('wikidata:external:work:'||v_qid)::uuid;
 v_key:=encode(sha256(convert_to(
  jsonb_build_array('wikidata',v_qid,lower(v_question))::text,'UTF8'
 )),'hex');
 insert into mizizi_private.cases(
  workspace_id,case_key,subject_type,subject_id,
  claim_family_key,claim_key,case_state,current_stage,
  epistemic_state,mutation_state,policy_ruleset_version,
  last_observation_fingerprint,risk_class,
  transition_actor_key,transition_reason
 )values(
  v_workspace,'mizizi:external:v1:'||v_key,'work',v_source_uuid,
  'cultural_investigation_v1','wikidata.'||lower(v_qid)||'.'||substr(v_key,1,32),
  'in_progress','research','unknown','not_planned',
  'mizizi.wikidata_research_only.v1',p_source_payload_fingerprint,'high',
  'system:mizizi',
  'Research-only Wikidata '||v_qid||' revision '||p_revision::text||
  '; external Work observation, not a canonical Registry identity or rights claim.'
 )on conflict on constraint mizizi_cases_workspace_key_unique do nothing
 returning * into v_case;
 if v_case.id is null then
  select c.* into strict v_case from mizizi_private.cases c
  where c.workspace_id=v_workspace and c.case_key='mizizi:external:v1:'||v_key
  for update;
  if v_case.subject_type<>'work' or v_case.subject_id<>v_source_uuid
   or v_case.claim_family_key<>'cultural_investigation_v1'
   or v_case.claim_key<>'wikidata.'||lower(v_qid)||'.'||substr(v_key,1,32)
   or v_case.policy_ruleset_version<>'mizizi.wikidata_research_only.v1'
   or v_case.last_observation_fingerprint is distinct from p_source_payload_fingerprint
   or v_case.transition_reason not like
     'Research-only Wikidata '||v_qid||' revision '||p_revision::text||';%'
  then raise exception 'Unfamiliar case replay changes historical evidence identity'
    using errcode='55000';
  end if;
  v_outcome:='replayed';
 end if;
 return query select v_case.id,v_workspace,v_case.revision,v_outcome;
end;
$gate$;
revoke all on function mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)
 from public,anon,authenticated,service_role;
grant execute on function mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)
 to mizizi_executor;
commit;
