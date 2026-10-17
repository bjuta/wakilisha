-- MIZIZI QV2: authorized human question freeze command, not an ACH verdict.
-- Filename minted by accepted Supabase CLI 2.107.0: Actions #39066809190.
-- Unmerged predecessors #1243, #1248 and #1249 remain required.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $preflight$
begin
 if current_user<>'postgres'
  or to_regclass('mizizi_private.case_question_versions') is null
  or to_regclass('mizizi_private.cases') is null
  or to_regclass('mizizi_private.write_holds') is null
  or to_regprocedure('mizizi_private.assert_headquarters_operator_v1(text)') is null
  or to_regprocedure('mizizi_private.assert_registry_admission_not_held_v1(text,integer)') is null
  or to_regprocedure('public.admin_mizizi_case_questions_v1(uuid,integer)') is null
 then raise exception 'STOP_MZ_QV2_REQUIRED_ACCEPTED_AUTHORITY_MISSING';end if;
 if to_regprocedure('public.admin_mizizi_freeze_case_question_v1(uuid,integer,uuid,integer,text,jsonb,text)') is not null
 then raise exception 'STOP_MZ_QV2_RPC_COLLISION';end if;
 if has_schema_privilege('authenticated','mizizi_private','USAGE')
  or has_table_privilege('authenticated','mizizi_private.case_question_versions','INSERT')
  or has_table_privilege('service_role','mizizi_private.case_question_versions','INSERT')
 then raise exception 'STOP_MZ_QV2_PRIVATE_TABLE_NOT_SEALED';end if;
end;
$preflight$;

-- The identity/role/hold checks are performed against real signed-in
-- user state. The caller supplies a stable UUID for idempotent retries, not
-- a source assertion, decision or rights grant.
create function public.admin_mizizi_freeze_case_question_v1(
 p_case_id uuid,
 p_expected_case_revision integer,
 p_question_id uuid,
 p_expected_question_revision integer,
 p_question_text text,
 p_hypotheses jsonb,
 p_reason text
)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog
as $write$
declare
 v_actor uuid;
 v_case mizizi_private.cases%rowtype;
 v_prior mizizi_private.case_question_versions%rowtype;
 v_recorded mizizi_private.case_question_versions%rowtype;
 v_next integer;
 v_count integer;
 v_replay boolean;
begin
 v_actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_case_id is null or p_question_id is null
  or p_expected_case_revision is null or p_expected_case_revision<1
  or p_expected_question_revision is null
  or p_expected_question_revision<0 or p_expected_question_revision>=20
  or p_question_text is null
  or p_hypotheses is null
  or p_reason is null or char_length(btrim(p_reason)) not between 12 and 1000
  or p_reason<>btrim(p_reason)
  or p_reason ~ '[[:cntrl:]]'
 then raise exception 'Invalid frozen question request' using errcode='22023';end if;

 -- Shared DB05 advisory lock serializes a concurrent global/workspace Hold.
 -- No new Registry operation or execution grant is created by this check.
 perform mizizi_private.assert_registry_admission_not_held_v1(
  'mizizi.question_freeze_v1',1
 );
 select * into v_case from mizizi_private.cases
 where id=p_case_id for update;
 if not found then
  raise exception 'Question case not found' using errcode='42501';end if;
 if v_case.revision<>p_expected_case_revision
   or v_case.case_state not in ('open','in_progress') then
  raise exception 'Question freeze case revision stale or terminal'
   using errcode='PT409';end if;
 if not exists(select 1 from mizizi_private.workspaces w
  where w.id=v_case.workspace_id
   and w.workspace_key='wakilisha-internal'
   and w.workspace_kind='internal' and w.status='active')
 then raise exception 'Question case is outside authorized workspace'
  using errcode='42501';end if;

 -- Locking the DB02 case row serializes version allocation across writers.
 select * into v_prior from mizizi_private.case_question_versions q
 where q.workspace_id=v_case.workspace_id and q.case_id=v_case.id
  and q.question_id=p_question_id
 order by q.question_revision desc limit 1;
 v_next:=coalesce(v_prior.question_revision,0)+1;

 -- The same user may safely retry an identical request after network loss.
 -- Altered payload, a different actor or earlier request cannot be replayed.
 v_replay:=v_prior.id is not null
  and v_prior.question_revision=p_expected_question_revision+1
  and v_prior.expected_case_revision=p_expected_case_revision
  and v_prior.question_text=p_question_text
  and v_prior.hypotheses=p_hypotheses
  and v_prior.freeze_reason=p_reason
  and v_prior.frozen_by_user_id=v_actor;
 if v_replay then
  return jsonb_build_object(
   'questionId',v_prior.question_id,'questionRevision',v_prior.question_revision,
   'caseId',v_case.id,'caseRevision',v_case.revision,
   'questionFingerprint',v_prior.question_fingerprint,'outcome','replayed');
 end if;
 if coalesce(v_prior.question_revision,0)<>p_expected_question_revision
 then raise exception 'Question revision conflict' using errcode='PT409';end if;

 if p_expected_question_revision=0 then
  select count(*) into v_count from (
   select distinct question_id from mizizi_private.case_question_versions
   where workspace_id=v_case.workspace_id and case_id=v_case.id
  ) q;
  if v_count>=100 then
   raise exception 'Question count at bound' using errcode='54000';end if;
 end if;

 insert into mizizi_private.case_question_versions(
  workspace_id,case_id,question_id,question_revision,
  expected_case_revision,question_text,hypotheses,
  frozen_by_user_id,freeze_reason)
 values(v_case.workspace_id,v_case.id,p_question_id,v_next,
  v_case.revision,p_question_text,p_hypotheses,v_actor,p_reason)
 returning * into v_recorded;
 return jsonb_build_object(
   'questionId',v_recorded.question_id,
   'questionRevision',v_recorded.question_revision,
   'caseId',v_recorded.case_id,'caseRevision',v_recorded.expected_case_revision,
   'questionFingerprint',v_recorded.question_fingerprint,
   'outcome',case when v_next=1 then 'created' else 'revised' end
 );
end;
$write$;

revoke all on function
 public.admin_mizizi_freeze_case_question_v1(uuid,integer,uuid,integer,text,jsonb,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function
 public.admin_mizizi_freeze_case_question_v1(uuid,integer,uuid,integer,text,jsonb,text)
 to authenticated;

comment on function public.admin_mizizi_freeze_case_question_v1(uuid,integer,uuid,integer,text,jsonb,text) is
 'Human steward/owner only: append an immutable question revision, never Registry mutation, ACH approval, source licence or publication. Uses DB05 global/workspace Hold admission lock.';

commit;
