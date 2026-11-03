-- WK100 Phase 1 W3 recovery contract CANDIDATE ONLY.
-- Not a migration, not enabled, and not authorization to deploy or collect.
-- Mint a real migration filename with the accepted Supabase CLI after PG17 proof.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $preflight$
begin
  if to_regclass('public.wk_chart_capture_contracts_v1') is null
     or to_regclass('public.wk_chart_capture_attempts_v1') is null
     or to_regclass('platform_private.wk100_source_method_decisions_v1') is null
     or to_regclass('platform_private.wk100_source_proposals_v1') is null
     or to_regclass('platform_private.wk100_collection_actions_v1') is not null
     or to_regprocedure('public.wk100_record_collection_action_v1(text,date,uuid,timestamp with time zone,smallint,integer,uuid,text)') is not null
  then raise exception 'STOP: WK100 recovery authority baseline mismatch'; end if;
end; $preflight$;

create table platform_private.wk100_collection_actions_v1 (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  contract_id uuid not null references public.wk_chart_capture_contracts_v1(id)
    on update restrict on delete restrict,
  source_key text not null check(source_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  week_start_eat date not null check(extract(isodow from week_start_eat)=1),
  action_kind text not null check(action_kind in
    ('retry_requested','coverage_requested','coverage_accepted','coverage_rejected')),
  action_revision integer not null check(action_revision between 0 and 99999),
  scheduled_at timestamptz,
  attempt_number smallint,
  reason text not null check(
    length(reason) between 8 and 500 and reason=btrim(reason)
    and reason !~ '[[:cntrl:]<>]'),
  actor_user_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  can_score boolean not null default false check(can_score=false),
  can_publish boolean not null default false check(can_publish=false),
  constraint wk100_recovery_action_shape check (
    (action_kind='retry_requested' and action_revision=0
      and scheduled_at is not null and attempt_number between 2 and 8)
    or
    (action_kind<>'retry_requested' and action_revision between 1 and 99999
      and scheduled_at is null and attempt_number is null)
  )
);
comment on table platform_private.wk100_collection_actions_v1 is
  'Immutable W3 recovery intent and coverage review history. No action grants capture, source admission, scoring, weight changes or publication.';
alter table platform_private.wk100_collection_actions_v1 enable row level security;
revoke all on platform_private.wk100_collection_actions_v1
  from public,anon,authenticated,service_role;
create unique index wk100_recovery_one_slot_attempt_v1
  on platform_private.wk100_collection_actions_v1
    (contract_id,scheduled_at,attempt_number)
  where action_kind='retry_requested';
create unique index wk100_coverage_one_revision_v1
  on platform_private.wk100_collection_actions_v1
    (contract_id,week_start_eat,action_revision)
  where action_kind<>'retry_requested';

create function platform_private.wk100_collection_action_immutable_v1()
returns trigger language plpgsql set search_path=pg_catalog as $immutable$
begin
  raise exception 'wk100_collection_action_immutable';
end; $immutable$;
create trigger wk100_collection_actions_row_guard
  before update or delete on platform_private.wk100_collection_actions_v1
  for each row execute function platform_private.wk100_collection_action_immutable_v1();
create trigger wk100_collection_actions_truncate_guard
  before truncate on platform_private.wk100_collection_actions_v1
  for each statement execute function platform_private.wk100_collection_action_immutable_v1();
revoke all on function platform_private.wk100_collection_action_immutable_v1()
  from public,anon,authenticated,service_role;

create function public.wk100_record_collection_action_v1(
  p_action text,p_week date,p_contract_id uuid,p_scheduled_at timestamptz,
  p_expected_attempt_number smallint,p_expected_revision integer,
  p_operation_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $action$
declare
  v_actor uuid:=auth.uid();
  v_contract public.wk_chart_capture_contracts_v1%rowtype;
  v_method platform_private.wk100_source_method_decisions_v1%rowtype;
  v_proposal platform_private.wk100_source_proposals_v1%rowtype;
  v_latest_attempt public.wk_chart_capture_attempts_v1%rowtype;
  v_latest_action platform_private.wk100_collection_actions_v1%rowtype;
  v_previous_operation platform_private.wk100_collection_actions_v1%rowtype;
  v_new_id uuid;
  v_next_attempt smallint;
  v_next_revision integer;
  v_kind text;
begin
  if v_actor is null
     or not public.current_user_has_capability('manage_ingest')
     or not public.current_user_has_capability('manage_charts')
  then raise exception 'wk100_recovery_not_authorized' using errcode='42501'; end if;
  if p_action not in ('request_retry','request_exception','accept_exception','reject_exception')
     or p_week is null or extract(isodow from p_week)<>1
     or p_contract_id is null or p_operation_id is null
     or p_reason is null or p_reason<>btrim(p_reason)
     or length(p_reason) not between 8 and 500
     or p_reason ~ '[[:cntrl:]<>]'
  then raise exception 'wk100_recovery_invalid' using errcode='22023'; end if;
  select * into v_contract from public.wk_chart_capture_contracts_v1
    where id=p_contract_id;
  if not found or v_contract.admission_state<>'candidate'
  then raise exception 'wk100_recovery_source_unavailable' using errcode='22023'; end if;

  -- Serialize operations for one source/week, including separate browser tabs.
  perform pg_catalog.pg_advisory_xact_lock(11420,
    pg_catalog.hashtext(v_contract.source_key||':'||p_week::text));
  select * into v_previous_operation
    from platform_private.wk100_collection_actions_v1
    where operation_id=p_operation_id;
  if found then
    if v_previous_operation.actor_user_id<>v_actor
       or v_previous_operation.contract_id<>p_contract_id
       or v_previous_operation.week_start_eat<>p_week
       or v_previous_operation.reason<>p_reason
       or v_previous_operation.action_kind<>case p_action
         when 'request_retry' then 'retry_requested'
         when 'request_exception' then 'coverage_requested'
         when 'accept_exception' then 'coverage_accepted'
         when 'reject_exception' then 'coverage_rejected' end
       or v_previous_operation.scheduled_at is distinct from p_scheduled_at
       or (p_action='request_retry' and
           v_previous_operation.attempt_number is distinct from
           p_expected_attempt_number+1)
       or (p_action<>'request_retry' and
           v_previous_operation.action_revision is distinct from p_expected_revision+1)
    then raise exception 'wk100_recovery_operation_conflict' using errcode='40001'; end if;
    return jsonb_build_object('actionId',v_previous_operation.id,
      'actionKind',v_previous_operation.action_kind,
      'revision',v_previous_operation.action_revision,
      'attemptNumber',v_previous_operation.attempt_number,
      'weekStartEat',p_week,'contractId',p_contract_id,
      'recorded',true,'canCollect',false,'canScore',false,'canPublish',false);
  end if;

  if p_action='request_retry' then
    if p_scheduled_at is null or p_expected_attempt_number not between 1 and 7
       or p_expected_revision is not null
       or p_scheduled_at>now() or p_scheduled_at<now()-interval '20 minutes'
       or p_scheduled_at < (p_week::timestamp at time zone 'Africa/Nairobi')
       or p_scheduled_at >= ((p_week+7)::timestamp at time zone 'Africa/Nairobi')
    then raise exception 'wk100_retry_outside_valid_slot' using errcode='22023'; end if;
    select * into v_method from platform_private.wk100_source_method_decisions_v1
      where source_key=v_contract.source_key
      order by decision_revision desc limit 1;
    select * into v_proposal from platform_private.wk100_source_proposals_v1
      where source_key=v_contract.source_key
      order by revision desc limit 1;
    if v_method.source_key is null or v_proposal.source_key is null
       or v_method.decision_state<>'collector_admitted'
       or v_method.proposal_revision<>v_proposal.revision
       or v_method.provider_key<>v_contract.provider_key
       or v_method.parser_class<>v_contract.adapter_version
       or v_method.authorization_expires_at<=now()
    then raise exception 'wk100_retry_method_not_current' using errcode='42501'; end if;
    select * into v_latest_attempt from public.wk_chart_capture_attempts_v1
      where contract_id=p_contract_id and week_start_eat=p_week
        and scheduled_at=p_scheduled_at
      order by attempt_number desc limit 1;
    if v_latest_attempt.id is null or v_latest_attempt.attempt_number<>p_expected_attempt_number
       or v_latest_attempt.status not in ('transport_failed','missed')
       or exists (
         select 1 from public.wk_chart_capture_attempts_v1
         where contract_id=p_contract_id and scheduled_at=p_scheduled_at
           and status in ('succeeded','partial_depth','parse_failed','target_period_unavailable')
       )
    then raise exception 'wk100_retry_not_retryable' using errcode='40001'; end if;
    v_next_attempt:=p_expected_attempt_number+1;
    if exists(
      select 1 from platform_private.wk100_collection_actions_v1
      where contract_id=p_contract_id and scheduled_at=p_scheduled_at
        and attempt_number=v_next_attempt and action_kind='retry_requested'
    ) then raise exception 'wk100_retry_already_requested' using errcode='40001'; end if;
    v_next_revision:=0;
    v_kind:='retry_requested';
  else
    if p_scheduled_at is not null or p_expected_attempt_number is not null
       or p_expected_revision is null or p_expected_revision not between 0 and 99998
       or p_week > (now() at time zone 'Africa/Nairobi')::date
    then raise exception 'wk100_coverage_request_invalid' using errcode='22023'; end if;
    select * into v_latest_action
      from platform_private.wk100_collection_actions_v1
      where contract_id=p_contract_id and week_start_eat=p_week
        and action_kind<>'retry_requested'
      order by action_revision desc limit 1;
    if coalesce(v_latest_action.action_revision,0)<>p_expected_revision
    then raise exception 'wk100_coverage_revision_conflict' using errcode='40001'; end if;
    if p_action='request_exception' then
      if v_latest_action.action_kind='coverage_requested' or exists(
        select 1 from public.wk_chart_capture_attempts_v1
        where contract_id=p_contract_id and week_start_eat=p_week
          and status in ('succeeded','partial_depth')
      )
      then raise exception 'wk100_coverage_not_missing' using errcode='40001'; end if;
      v_kind:='coverage_requested';
    else
      if v_latest_action.action_kind is distinct from 'coverage_requested' or
         not exists(
          select 1 from public.user_role_assignments
          where user_id=v_actor and role_key='super_admin'
            and status='active' and (expires_at is null or expires_at>now())
         )
      then raise exception 'wk100_coverage_decision_not_authorized' using errcode='42501'; end if;
      v_kind:=case when p_action='accept_exception'
        then 'coverage_accepted' else 'coverage_rejected' end;
    end if;
    v_next_revision:=p_expected_revision+1;
    v_next_attempt:=null;
  end if;
  insert into platform_private.wk100_collection_actions_v1(
    operation_id,contract_id,source_key,week_start_eat,action_kind,action_revision,
    scheduled_at,attempt_number,reason,actor_user_id)
  values(p_operation_id,p_contract_id,v_contract.source_key,p_week,
    v_kind,v_next_revision,p_scheduled_at,v_next_attempt,p_reason,v_actor)
  returning id into v_new_id;
  return jsonb_build_object('actionId',v_new_id,'actionKind',v_kind,
    'revision',v_next_revision,'attemptNumber',v_next_attempt,
    'weekStartEat',p_week,'contractId',p_contract_id,
    'recorded',true,'canCollect',false,'canScore',false,'canPublish',false);
end; $action$;
revoke all on function public.wk100_record_collection_action_v1(
  text,date,uuid,timestamptz,smallint,integer,uuid,text)
from public,anon,authenticated,service_role;
grant execute on function public.wk100_record_collection_action_v1(
  text,date,uuid,timestamptz,smallint,integer,uuid,text) to authenticated;

create function public.wk100_list_collection_actions_v1(p_week date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $read$
declare v_items jsonb;
begin
  if auth.uid() is null
     or not public.current_user_has_capability('manage_ingest')
     or not public.current_user_has_capability('manage_charts')
  then raise exception 'wk100_recovery_not_authorized' using errcode='42501'; end if;
  if p_week is null or extract(isodow from p_week)<>1
  then raise exception 'wk100_recovery_invalid_week' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'actionId',id,'sourceKey',source_key,'contractId',contract_id,
      'weekStartEat',week_start_eat,'actionKind',action_kind,
      'revision',action_revision,'scheduledAt',scheduled_at,
      'attemptNumber',attempt_number,'reason',reason,'createdAt',created_at,
      'canCollect',false,'canScore',false,'canPublish',false)
      order by created_at,id),'[]'::jsonb) into v_items
  from platform_private.wk100_collection_actions_v1
  where week_start_eat=p_week;
  if jsonb_array_length(v_items)>1000
  then raise exception 'wk100_recovery_page_limit'; end if;
  return v_items;
end; $read$;
revoke all on function public.wk100_list_collection_actions_v1(date)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_list_collection_actions_v1(date)
  to authenticated;

-- The signed service scheduler reads pending manual retries without obtaining
-- any client authority or exposing secrets. Existing worker leases still own
-- reservation and no row here can force capture or bypass slot eligibility.
create function public.wk100_service_retry_requests_v1(p_week date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $requests$
declare v_items jsonb;
begin
  if auth.role() is distinct from 'service_role'
  then raise exception 'wk100_recovery_service_only' using errcode='42501'; end if;
  if p_week is null or extract(isodow from p_week)<>1
  then raise exception 'wk100_recovery_invalid_week' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_key',source_key,'contract_id',contract_id,'week_start_eat',week_start_eat,
    'scheduled_at',scheduled_at,'attempt_number',attempt_number)
    order by scheduled_at,source_key),'[]'::jsonb)
  into v_items
  from platform_private.wk100_collection_actions_v1 a
  where a.week_start_eat=p_week and a.action_kind='retry_requested'
    and a.scheduled_at between now()-interval '20 minutes' and now()
    and not exists(
      select 1 from public.wk_chart_capture_attempts_v1 receipt
      where receipt.contract_id=a.contract_id and receipt.scheduled_at=a.scheduled_at
        and receipt.attempt_number>=a.attempt_number
    );
  if jsonb_array_length(v_items)>500
  then raise exception 'wk100_recovery_page_limit'; end if;
  return v_items;
end; $requests$;
revoke all on function public.wk100_service_retry_requests_v1(date)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_service_retry_requests_v1(date)
  to service_role;
commit;
