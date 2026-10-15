-- Candidate source ONLY. Must be minted as one canonical Supabase CLI migration
-- on the accepted owner Mac checkout after local replay, verifier and code review.
-- No direct browser rights on mizizi_private or platform_private tables.
-- Human operator commands do not make Registry decisions or issue execution grants.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $wk_operator_preflight$
begin
 if to_regclass('mizizi_private.workspaces') is null
    or to_regclass('mizizi_private.workspace_memberships') is null
    or to_regclass('mizizi_private.cases') is null
    or to_regclass('mizizi_private.case_events') is null
    or to_regclass('mizizi_private.case_receipt_links') is null
    or to_regclass('mizizi_private.write_holds') is null
    or to_regprocedure('public.current_user_has_capability(text)') is null
 then raise exception 'STOP: accepted MIZIZI Slice 1 substrate absent'; end if;
 if exists(select 1 from (values
   ('public.admin_mizizi_bootstrap_internal_owner_v1(text)'),
   ('public.admin_mizizi_cases_v1(integer,timestamp with time zone,uuid)'),
   ('public.admin_mizizi_case_events_v1(uuid,integer)'),
   ('public.admin_mizizi_begin_case_research_v1(uuid,integer,text)'),
   ('public.admin_mizizi_hold_workspace_writes_v1(text,text,timestamp with time zone)'),
   ('public.admin_mizizi_release_workspace_hold_v1(uuid,integer,text)'),
   ('public.admin_mizizi_list_workspace_holds_v1(integer)')
 ) f(signature) where to_regprocedure(f.signature) is not null)
 then raise exception 'STOP: operator RPC identity already exists'; end if;
 if (select count(*) from mizizi_private.workspaces)<>1 or not exists(
  select 1 from mizizi_private.workspaces
  where workspace_key='wakilisha-internal' and workspace_kind='internal' and status='active')
 then raise exception 'STOP: internal workspace invariant changed'; end if;
end;
$wk_operator_preflight$;

-- Reusable SECURITY DEFINER helper. The only authority is a real signed-in
-- Auth user with a currently active Registry capability AND workspace role.
create function mizizi_private.assert_headquarters_operator_v1(p_minimum_role text)
returns uuid language plpgsql stable security definer set search_path=pg_catalog
as $wk_assert$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or auth.role()<>'authenticated'
    or not public.current_user_has_capability('manage_registry')
 then raise exception 'Headquarters administrator authorization required' using errcode='42501'; end if;
 if not exists (
   select 1 from mizizi_private.workspace_memberships m
   join mizizi_private.workspaces w on w.id=m.workspace_id
   where m.user_id=v_actor and m.revoked_at is null
     and m.valid_from<=clock_timestamp()
     and (m.valid_until is null or m.valid_until>clock_timestamp())
     and w.workspace_key='wakilisha-internal' and w.status='active'
     and (p_minimum_role='reader' or (p_minimum_role='reviewer' and m.member_role in ('reviewer','steward','owner'))
       or (p_minimum_role='steward' and m.member_role in ('steward','owner'))
       or (p_minimum_role='owner' and m.member_role='owner'))
 ) then raise exception 'Headquarters membership or role not authorized' using errcode='42501'; end if;
 return v_actor;
end;
$wk_assert$;
revoke all on function mizizi_private.assert_headquarters_operator_v1(text) from public,anon,authenticated,service_role,mizizi_executor;

-- One-time bootstrap requires both existing platform capabilities, not a
-- subscriber, service-role token or a fabricated JWT. Workspace row locking
-- serializes concurrent bootstraps; after the first membership this closes.
create function public.admin_mizizi_bootstrap_internal_owner_v1(p_reason text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog
as $wk_bootstrap$
declare v_actor uuid:=auth.uid(); v_ws uuid; v_membership uuid;
begin
 if auth.role()<>'authenticated' or v_actor is null
    or not public.current_user_has_capability('manage_registry')
    or not public.current_user_has_capability('manage_users')
 then raise exception 'Initial Headquarters owner requires both administrator capabilities' using errcode='42501'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 12 and 1000
 then raise exception 'A meaningful bootstrap reason is required' using errcode='22023'; end if;
 select id into strict v_ws from mizizi_private.workspaces
  where workspace_key='wakilisha-internal' and status='active' for update;
 if exists(select 1 from mizizi_private.workspace_memberships where workspace_id=v_ws)
 then raise exception 'Headquarters workspace already bootstrapped' using errcode='55000'; end if;
 insert into mizizi_private.workspace_memberships(
  workspace_id,user_id,member_role,grant_source,granted_by,last_changed_by,change_reason)
 values(v_ws,v_actor,'owner','internal_bootstrap',v_actor,v_actor,btrim(p_reason))
 returning id into strict v_membership;
 return v_membership;
end;
$wk_bootstrap$;
revoke all on function public.admin_mizizi_bootstrap_internal_owner_v1(text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_bootstrap_internal_owner_v1(text) to authenticated;

-- Bounded read of durable cases, not a reconstructed queue masquerading as
-- cases. Review ID is returned only when an immutable typed link exists.
create function public.admin_mizizi_cases_v1(
 p_limit integer default 50,p_before_updated_at timestamptz default null,p_before_case_id uuid default null)
returns setof jsonb language plpgsql stable security definer set search_path=pg_catalog
as $wk_cases$
begin
 perform mizizi_private.assert_headquarters_operator_v1('reader');
 if p_limit is null or p_limit<1 or p_limit>100
    or ((p_before_updated_at is null)<>(p_before_case_id is null))
 then raise exception 'Invalid Headquarters case pagination' using errcode='22023'; end if;
 return query
 select jsonb_build_object(
  'caseId',c.id,'workspaceId',c.workspace_id,'caseRevision',c.revision,
  'subjectType',c.subject_type,'subjectId',c.subject_id,
  'claimFamily',c.claim_family_key,'claimKey',c.claim_key,
  'state',c.case_state,'stage',c.current_stage,
  'epistemicState',c.epistemic_state,'mutationState',c.mutation_state,
  'publicationState',c.publication_state,'deliveryState',c.delivery_state,
  'riskClass',c.risk_class,'nextActionAt',c.next_action_at,
  'updatedAt',c.updated_at,'reviewId',linked.authority_id,
  'receiptCount',(select count(*) from mizizi_private.case_receipt_links e where e.case_id=c.id)
 )
 from mizizi_private.cases c
 join mizizi_private.workspaces w on w.id=c.workspace_id
 left join lateral (
  select l.authority_id from mizizi_private.case_receipt_links l
  where l.workspace_id=c.workspace_id and l.case_id=c.id
    and l.relation_type='review_item' and l.authority_schema='public'
    and l.authority_object_type='registry_review_items'
  order by l.linked_at,l.id limit 1
 ) linked on true
 where w.workspace_key='wakilisha-internal' and w.status='active'
  and (p_before_updated_at is null or (c.updated_at,c.id)<(p_before_updated_at,p_before_case_id))
 order by c.updated_at desc,c.id desc
 limit p_limit;
end;
$wk_cases$;
revoke all on function public.admin_mizizi_cases_v1(integer,timestamptz,uuid) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_cases_v1(integer,timestamptz,uuid) to authenticated;

create function public.admin_mizizi_case_events_v1(p_case_id uuid,p_limit integer default 50)
returns setof jsonb language plpgsql stable security definer set search_path=pg_catalog
as $wk_events$
begin
 perform mizizi_private.assert_headquarters_operator_v1('reader');
 if p_case_id is null or p_limit is null or p_limit not between 1 and 100
 then raise exception 'Invalid Headquarters case event request' using errcode='22023'; end if;
 if not exists (
  select 1 from mizizi_private.cases c join mizizi_private.workspaces w on w.id=c.workspace_id
  where c.id=p_case_id and w.workspace_key='wakilisha-internal' and w.status='active')
 then raise exception 'Case not found in authorized workspace' using errcode='42501'; end if;
 return query select jsonb_build_object(
  'eventId',e.event_id,'revision',e.case_revision,'type',e.event_type,
  'previousState',e.previous_case_state,'state',e.resulting_case_state,
  'previousStage',e.previous_stage,'stage',e.resulting_stage,
  'reason',e.reason,'actorKey',e.actor_key,'recordedAt',e.recorded_at
 ) from mizizi_private.case_events e where e.case_id=p_case_id
 order by e.event_seq desc limit p_limit;
end;
$wk_events$;
revoke all on function public.admin_mizizi_case_events_v1(uuid,integer) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_case_events_v1(uuid,integer) to authenticated;

-- Human case-stage instruction only. It does NOT decide a Registry review,
-- approve an execution grant, or itself enqueue a research job. The later
-- trusted executor independently checks the case revision and research stage.
create function public.admin_mizizi_begin_case_research_v1(
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
 then raise exception 'Stale case revision' using errcode='40001'; end if;
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

-- A workspace hold is append-only through existing DB05 triggers. No expiry
-- auto-releases this hold. It blocks Registry mutation admission, not reads.
create function public.admin_mizizi_hold_workspace_writes_v1(
 p_hold_key text,p_reason text,p_review_after timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $wk_hold$
declare v_actor uuid; v_workspace uuid; v_hold uuid;
begin
 v_actor:=mizizi_private.assert_headquarters_operator_v1('owner');
 if p_hold_key is null or p_hold_key !~ '^[A-Za-z0-9][A-Za-z0-9:_./-]{7,159}$'
    or p_reason is null or char_length(btrim(p_reason)) not between 12 and 2000
    or (p_review_after is not null and p_review_after<=clock_timestamp())
 then raise exception 'Invalid workspace Hold Writes request' using errcode='22023'; end if;
 select id into strict v_workspace from mizizi_private.workspaces
  where workspace_key='wakilisha-internal' and status='active';
 insert into mizizi_private.write_holds (
  hold_key,scope_kind,workspace_id,status,hold_reason,held_by_actor_key,review_after)
 values(p_hold_key,'workspace',v_workspace,'active',btrim(p_reason),
  'user:'||v_actor::text,p_review_after)
 returning id into strict v_hold;
 return jsonb_build_object('holdId',v_hold,'holdKey',p_hold_key,'status','active','revision',1);
end;
$wk_hold$;
revoke all on function public.admin_mizizi_hold_workspace_writes_v1(text,text,timestamptz) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_hold_workspace_writes_v1(text,text,timestamptz) to authenticated;

create function public.admin_mizizi_release_workspace_hold_v1(
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
 then raise exception 'Hold already released or stale revision' using errcode='40001'; end if;
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

create function public.admin_mizizi_list_workspace_holds_v1(p_limit integer default 50)
returns setof jsonb language plpgsql stable security definer set search_path=pg_catalog
as $wk_list_holds$
begin
 perform mizizi_private.assert_headquarters_operator_v1('reader');
 if p_limit is null or p_limit<1 or p_limit>100
 then raise exception 'Invalid hold list limit' using errcode='22023'; end if;
 return query select jsonb_build_object(
  'holdId',h.id,'holdKey',h.hold_key,'scopeKind',h.scope_kind,'status',h.status,
  'reason',h.hold_reason,'revision',h.revision,'heldAt',h.held_at,
  'reviewAfter',h.review_after,'releasedAt',h.released_at)
 from mizizi_private.write_holds h
 join mizizi_private.workspaces w on w.id=h.workspace_id
 where h.scope_kind='workspace' and w.workspace_key='wakilisha-internal'
 order by h.held_at desc,h.id desc limit p_limit;
end;
$wk_list_holds$;
revoke all on function public.admin_mizizi_list_workspace_holds_v1(integer) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_list_workspace_holds_v1(integer) to authenticated;

commit;
