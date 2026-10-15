-- CLI-versioned 227: exact two-RPC HTTP conflict correction.
-- Original migration 226 is immutable; all case/hold policy checks are retained.
-- PostgreSQL 40001 signals a retryable serialization failure and causes the
-- actual PostgREST gateway to keep retrying logical stale revisions to HTTP 504.
-- PT409 is PostgREST's deliberate HTTP 409 contract, not a retry request.
-- No grants, membership or Registry authority is created here.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $wk_stale_preflight$
declare fn regprocedure; n integer; head text;
begin
 select count(*),max(version) into n,head from supabase_migrations.schema_migrations;
 if n<>226 or head<>'20261013123758' then
  raise exception 'STOP_MIZIZI_227_WRONG_PRIOR_LEDGER';
 end if;
 for fn in select unnest(array[
  'public.admin_mizizi_begin_case_research_v1(uuid,integer,text)'::regprocedure,
  'public.admin_mizizi_release_workspace_hold_v1(uuid,integer,text)'::regprocedure
 ]) loop
  if not exists(select 1 from pg_proc p where p.oid=fn
      and p.prosecdef and p.proowner='postgres'::regrole
      and p.proconfig @> array['search_path=pg_catalog']::text[]
      and pg_get_functiondef(p.oid) like '%40001%')
   or has_function_privilege('anon',fn,'EXECUTE')
   or has_function_privilege('service_role',fn,'EXECUTE')
   or not has_function_privilege('authenticated',fn,'EXECUTE')
  then raise exception 'STOP_MIZIZI_227_EXISTING_OPERATOR_GATEWAY_DRIFT'; end if;
 end loop;
end $wk_stale_preflight$;

create or replace function public.admin_mizizi_begin_case_research_v1(
 p_case_id uuid,p_expected_revision integer,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $wk_research$
declare v_actor uuid; v_case mizizi_private.cases%rowtype; v_new_rev integer;
begin
 v_actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_case_id is null or p_expected_revision is null or p_expected_revision<1
    or p_reason is null or char_length(btrim(p_reason)) not between 12 and 1000
 then raise exception 'Invalid case research transition' using errcode='22023'; end if;
 select c.* into v_case from mizizi_private.cases c
  join mizizi_private.workspaces w on w.id=c.workspace_id
  where c.id=p_case_id and w.workspace_key='wakilisha-internal' and w.status='active'
  for update of c;
 if not found then raise exception 'Case not found in authorized workspace' using errcode='42501'; end if;
 if v_case.revision<>p_expected_revision
 then raise exception 'Stale case revision' using errcode='PT409'; end if;
 if v_case.case_state<>'open' or v_case.current_stage<>'triage'
 then raise exception 'Case is not eligible to begin research' using errcode='55000'; end if;
 if not exists (
  select 1 from mizizi_private.case_receipt_links l
  join public.registry_review_items review on review.id=l.authority_id
  where l.case_id=v_case.id and l.workspace_id=v_case.workspace_id
    and l.relation_type='review_item' and l.authority_schema='public'
    and l.authority_object_type='registry_review_items'
    and review.status='open' and review.entity_id=v_case.subject_id
    and review.entity_type=v_case.subject_type
 ) then raise exception 'No current source-bound Registry review receipt' using errcode='23514'; end if;
 update mizizi_private.cases c set revision=c.revision+1,
  case_state='in_progress',current_stage='research',
  transition_actor_key='user:'||v_actor::text,
  transition_reason=btrim(p_reason)
 where c.id=v_case.id and c.workspace_id=v_case.workspace_id and c.revision=p_expected_revision
 returning c.revision into strict v_new_rev;
 return jsonb_build_object('caseId',v_case.id,'workspaceId',v_case.workspace_id,
  'revision',v_new_rev,'state','in_progress','stage','research');
end;
$wk_research$;
revoke all on function public.admin_mizizi_begin_case_research_v1(uuid,integer,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_begin_case_research_v1(uuid,integer,text) to authenticated;

create or replace function public.admin_mizizi_release_workspace_hold_v1(
 p_hold_id uuid,p_expected_revision integer,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $wk_release$
declare v_actor uuid; v_hold mizizi_private.write_holds%rowtype; v_revision integer;
begin
 v_actor:=mizizi_private.assert_headquarters_operator_v1('owner');
 if p_hold_id is null or p_expected_revision is null or p_expected_revision<1
    or p_reason is null or char_length(btrim(p_reason)) not between 12 and 1000
 then raise exception 'Invalid workspace Hold Writes release' using errcode='22023'; end if;
 select h.* into v_hold from mizizi_private.write_holds h
  join mizizi_private.workspaces w on w.id=h.workspace_id
  where h.id=p_hold_id and h.scope_kind='workspace'
    and w.workspace_key='wakilisha-internal' and w.status='active' for update of h;
 if not found then raise exception 'Hold not found in authorized workspace' using errcode='42501'; end if;
 if v_hold.status<>'active' or v_hold.revision<>p_expected_revision
 then raise exception 'Hold already released or stale revision' using errcode='PT409'; end if;
 update mizizi_private.write_holds set status='released',revision=revision+1,
  released_at=clock_timestamp(),released_by_actor_key='user:'||v_actor::text,
  release_reason=btrim(p_reason)
 where id=p_hold_id and status='active' and revision=p_expected_revision
 returning revision into strict v_revision;
 return jsonb_build_object('holdId',p_hold_id,'status','released','revision',v_revision);
end;
$wk_release$;
revoke all on function public.admin_mizizi_release_workspace_hold_v1(uuid,integer,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_release_workspace_hold_v1(uuid,integer,text) to authenticated;

do $wk_stale_postcheck$
declare fn regprocedure;
begin
 for fn in select unnest(array[
  'public.admin_mizizi_begin_case_research_v1(uuid,integer,text)'::regprocedure,
  'public.admin_mizizi_release_workspace_hold_v1(uuid,integer,text)'::regprocedure
 ]) loop
  if not exists(select 1 from pg_proc p where p.oid=fn
   and p.prosecdef and p.proowner='postgres'::regrole
   and p.proconfig @> array['search_path=pg_catalog']::text[]
   and pg_get_functiondef(p.oid) like '%PT409%'
   and pg_get_functiondef(p.oid) not like '%40001%')
   or has_function_privilege('anon',fn,'EXECUTE')
   or has_function_privilege('service_role',fn,'EXECUTE')
   or has_function_privilege('mizizi_executor',fn,'EXECUTE')
   or not has_function_privilege('authenticated',fn,'EXECUTE')
  then raise exception 'STOP_MIZIZI_227_OPERATOR_CONFLICT_OR_ACL_NOT_SEALED'; end if;
 end loop;
 raise notice 'WK_MIZIZI_227_TWO_STALE_HTTP_CONFLICT_RPC_CONTRACTS=PASS';
end $wk_stale_postcheck$;
commit;
