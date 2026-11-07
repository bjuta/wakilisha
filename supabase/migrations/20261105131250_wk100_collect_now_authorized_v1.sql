-- WAKILISHA 100 Phase 1: real-clock, signed-in Admin Collect Now candidate.
-- Forward-only SQL candidate. Mint the migration filename with the accepted
-- Supabase CLI and prove isolated PG/RLS replay BEFORE activation.
-- No fabricated provider timestamp, source admission, rank, scoring or publish.
-- The original periodic scheduler and reservation function remain unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $preflight$ begin
  if to_regclass('platform_private.wk100_source_method_decisions_v1') is null
     or to_regclass('platform_private.wk100_source_proposals_v1') is null
     or to_regclass('private.wk_chart_runtime_reservations_v1') is null
     or to_regprocedure('private.wk_chart_runtime_guard_v1()') is null
     or to_regprocedure('public.wk_chart_runtime_reserve_v1(uuid,date,timestamp with time zone,smallint)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regclass('platform_private.wk100_collect_now_requests_v1') is not null
     or to_regprocedure('public.wk100_request_collect_now_v1(uuid,uuid)') is not null
  then raise exception 'WK100_COLLECT_NOW_AUTHORITY_BASELINE_DRIFT'; end if;
end $preflight$;

create table platform_private.wk100_collect_now_requests_v1 (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  contract_id uuid not null references public.wk_chart_capture_contracts_v1(id)
    on update restrict on delete restrict,
  source_key text not null check(source_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  contract_version text not null,
  week_start_eat date not null check(extract(isodow from week_start_eat)=1),
  scheduled_at timestamptz not null,
  requested_at timestamptz not null default clock_timestamp(),
  constraint wk100_collect_now_exact_minute check(
    extract(second from scheduled_at at time zone 'UTC')=0),
  constraint wk100_collect_now_week check(
    scheduled_at >= (week_start_eat::timestamp at time zone 'Africa/Nairobi') and
    scheduled_at < ((week_start_eat+7)::timestamp at time zone 'Africa/Nairobi')),
  constraint wk100_collect_now_one_contract_instant unique(contract_id,scheduled_at)
);
comment on table platform_private.wk100_collect_now_requests_v1 is
  'Immutable signed-in operator intent for real-clock one-time collection. Never a provider receipt or publication grant.';
alter table platform_private.wk100_collect_now_requests_v1 enable row level security;
revoke all on platform_private.wk100_collect_now_requests_v1
  from public,anon,authenticated,service_role;

create function platform_private.wk100_collect_now_immutable_v1()
returns trigger language plpgsql set search_path=pg_catalog as $immutable$
begin raise exception 'wk100_collect_now_immutable'; end; $immutable$;
create trigger wk100_collect_now_no_update_delete
  before update or delete on platform_private.wk100_collect_now_requests_v1
  for each row execute function platform_private.wk100_collect_now_immutable_v1();
create trigger wk100_collect_now_no_truncate
  before truncate on platform_private.wk100_collect_now_requests_v1
  for each statement execute function platform_private.wk100_collect_now_immutable_v1();
revoke all on function platform_private.wk100_collect_now_immutable_v1()
  from public,anon,authenticated,service_role;

create function public.wk100_request_collect_now_v1(p_contract_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $request$
declare
  v_actor uuid:=auth.uid();
  v_contract public.wk_chart_capture_contracts_v1%rowtype;
  v_method platform_private.wk100_source_method_decisions_v1%rowtype;
  v_proposal platform_private.wk100_source_proposals_v1%rowtype;
  v_prior platform_private.wk100_collect_now_requests_v1%rowtype;
  v_slot timestamptz;
  v_week date;
  v_count integer;
  v_id uuid;
begin
  if v_actor is null
     or not public.current_user_has_capability('manage_ingest')
     or not public.current_user_has_capability('manage_charts')
     or p_contract_id is null or p_operation_id is null
  then raise exception 'wk100_collect_now_not_authorized' using errcode='42501'; end if;
  select * into v_contract from public.wk_chart_capture_contracts_v1
    where id=p_contract_id;
  if not found or v_contract.admission_state<>'candidate'
     or v_contract.market<>'KE'
     or v_contract.provider_key not in
       ('apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke')
  then raise exception 'wk100_collect_now_contract_not_admitted' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(11803,pg_catalog.hashtext(v_contract.source_key));
  select * into v_prior from platform_private.wk100_collect_now_requests_v1
    where operation_id=p_operation_id;
  if found then
    if v_prior.actor_user_id<>v_actor or v_prior.contract_id<>p_contract_id
    then raise exception 'wk100_collect_now_operation_conflict' using errcode='23505'; end if;
    return jsonb_build_object('operationId',v_prior.operation_id,
      'contractId',v_prior.contract_id,'sourceKey',v_prior.source_key,
      'weekStartEat',v_prior.week_start_eat,
      'scheduledAt',to_char(v_prior.scheduled_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'status','already_requested','canScore',false,'canPublish',false);
  end if;
  select * into v_method from platform_private.wk100_source_method_decisions_v1
    where source_key=v_contract.source_key order by decision_revision desc limit 1;
  select * into v_proposal from platform_private.wk100_source_proposals_v1
    where source_key=v_contract.source_key order by revision desc limit 1;
  if v_method.source_key is null or v_proposal.source_key is null
     or v_method.decision_state<>'collector_admitted'
     or v_method.authorization_expires_at<=now()
     or v_method.provider_key<>v_contract.provider_key
     or v_method.proposal_revision<>v_proposal.revision
     or v_method.parser_class<>v_contract.adapter_version
     or v_method.native_period_authority not in ('provider_defined','observed_as_of')
  then raise exception 'wk100_collect_now_method_not_current' using errcode='22023'; end if;
  -- The database, never the Admin, chooses the actual current-minute slot.
  v_slot:=date_trunc('minute',clock_timestamp());
  v_week:=date_trunc('week',v_slot at time zone 'Africa/Nairobi')::date;
  select count(*) into v_count from platform_private.wk100_collect_now_requests_v1
    where contract_id=p_contract_id
      and (scheduled_at at time zone 'Africa/Nairobi')::date =
          (v_slot at time zone 'Africa/Nairobi')::date;
  if v_count>=4 then
    raise exception 'wk100_collect_now_daily_budget_exhausted' using errcode='22023';
  end if;
  if exists(select 1 from platform_private.wk100_collect_now_requests_v1
    where contract_id=p_contract_id and scheduled_at=v_slot)
  then raise exception 'wk100_collect_now_minute_already_requested' using errcode='23505'; end if;
  insert into platform_private.wk100_collect_now_requests_v1(
    operation_id,actor_user_id,contract_id,source_key,contract_version,
    week_start_eat,scheduled_at)
  values(p_operation_id,v_actor,p_contract_id,v_contract.source_key,
    v_contract.contract_version,v_week,v_slot) returning id into v_id;
  return jsonb_build_object('operationId',p_operation_id,
    'requestId',v_id,'contractId',p_contract_id,'sourceKey',v_contract.source_key,
    'weekStartEat',v_week,
    'scheduledAt',to_char(v_slot at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'status','requested','canScore',false,'canPublish',false);
end; $request$;
revoke all on function public.wk100_request_collect_now_v1(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_request_collect_now_v1(uuid,uuid)
  to authenticated;

-- No secret, endpoint, method, private raw bytes, or payload supplied by Admin.
-- A service-role projection is needed by both dispatcher and worker.
create function public.wk100_service_collect_now_requests_v1(p_week date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $project$
declare v_out jsonb;
begin
  perform private.wk_chart_runtime_guard_v1();
  if p_week is null or extract(isodow from p_week)<>1
  then raise exception 'wk100_collect_now_week_invalid' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'operation_id',r.operation_id,'actor_user_id',r.actor_user_id,
    'contract_id',r.contract_id,'source_key',r.source_key,
    'contract_version',r.contract_version,'week_start_eat',r.week_start_eat,
    'scheduled_at',to_char(r.scheduled_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"')) order by r.scheduled_at,r.source_key),'[]'::jsonb)
  into v_out
  from platform_private.wk100_collect_now_requests_v1 r
  join public.wk_chart_capture_contracts_v1 c on c.id=r.contract_id
  join lateral (
    select * from platform_private.wk100_source_method_decisions_v1 d
    where d.source_key=r.source_key order by d.decision_revision desc limit 1
  ) d on true
  where r.week_start_eat=p_week
    and r.scheduled_at<=now()
    and r.scheduled_at>=now()-interval '20 minutes'
    and c.admission_state='candidate' and c.market='KE'
    and c.source_key=r.source_key and c.contract_version=r.contract_version
    and d.decision_state='collector_admitted'
    and d.provider_key=c.provider_key
    and d.authorization_expires_at>now()
    and not exists(select 1 from public.wk_chart_capture_attempts_v1 a
      where a.contract_id=r.contract_id and a.scheduled_at=r.scheduled_at);
  return v_out;
end; $project$;
revoke all on function public.wk100_service_collect_now_requests_v1(date)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_service_collect_now_requests_v1(date)
  to service_role;

-- The original reserve_v1 retains all exact daily/weekly checkpoint checks.
-- This separate reserve is service-only and additionally demands a signed-in
-- Admin's immutable exact-time request. It never accepts future/backdated time,
-- a re-used attempt, or a request outside the 20-minute real-clock window.
create function public.wk_chart_runtime_reserve_now_v1(
  p_contract_id uuid,p_week_start_eat date,p_scheduled_at timestamptz,
  p_attempt_number smallint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $reserve$
declare
  c public.wk_chart_capture_contracts_v1%rowtype;
  r private.wk_chart_runtime_reservations_v1%rowtype;
  v_method platform_private.wk100_source_method_decisions_v1%rowtype;
  v_new_lease uuid;
  v_new_id uuid;
begin
  perform private.wk_chart_runtime_guard_v1();
  select * into c from public.wk_chart_capture_contracts_v1 where id=p_contract_id;
  if not found or c.admission_state<>'candidate' or c.market<>'KE'
     or p_week_start_eat is null or extract(isodow from p_week_start_eat)<>1
     or p_scheduled_at is null or p_attempt_number is distinct from 1
     or extract(second from p_scheduled_at at time zone 'UTC')<>0
     or p_scheduled_at>(now()) or p_scheduled_at<now()-interval '20 minutes'
     or p_scheduled_at < (p_week_start_eat::timestamp at time zone 'Africa/Nairobi')
     or p_scheduled_at >= ((p_week_start_eat+7)::timestamp at time zone 'Africa/Nairobi')
  then raise exception 'wk100_collect_now_reservation_invalid' using errcode='22023'; end if;
  select * into v_method from platform_private.wk100_source_method_decisions_v1
    where source_key=c.source_key order by decision_revision desc limit 1;
  if v_method.source_key is null or v_method.decision_state<>'collector_admitted'
     or v_method.authorization_expires_at<=now()
     or v_method.provider_key<>c.provider_key
     or v_method.parser_class<>c.adapter_version
  then raise exception 'wk100_collect_now_method_revoked' using errcode='42501'; end if;
  if not exists (
    select 1 from platform_private.wk100_collect_now_requests_v1 t
    where t.contract_id=p_contract_id and t.source_key=c.source_key
      and t.contract_version=c.contract_version
      and t.week_start_eat=p_week_start_eat and t.scheduled_at=p_scheduled_at)
  then raise exception 'wk100_collect_now_ticket_required' using errcode='42501'; end if;
  insert into private.wk_chart_runtime_reservations_v1(
    contract_id,week_start_eat,scheduled_at,attempt_number)
  values(p_contract_id,p_week_start_eat,p_scheduled_at,p_attempt_number)
  on conflict (contract_id,scheduled_at,attempt_number) do nothing
  returning id into v_new_id;
  select * into strict r from private.wk_chart_runtime_reservations_v1
    where contract_id=p_contract_id and scheduled_at=p_scheduled_at
      and attempt_number=p_attempt_number for update;
  if r.week_start_eat<>p_week_start_eat
  then raise exception 'WK100 reservation week conflict'; end if;
  if r.state='committed'
  then return jsonb_build_object('state','committed','receipt_id',r.receipt_id,
    'reservation_id',r.id); end if;
  if v_new_id is null and r.lease_expires_at>now()
  then raise exception using errcode='55P03',message='WK100 reservation lease already active'; end if;
  v_new_lease:=gen_random_uuid();
  update private.wk_chart_runtime_reservations_v1
    set lease_id=v_new_lease,lease_expires_at=now()+interval '3 minutes',
      updated_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('state',r.state,'reservation_id',r.id,
    'lease_id',v_new_lease,'object_key',r.object_key,
    'payload_sha256',r.payload_sha256,'content_type',r.content_type,
    'byte_length',r.byte_length,'fetched_at',r.fetched_at);
end; $reserve$;
revoke all on function public.wk_chart_runtime_reserve_now_v1(
  uuid,date,timestamptz,smallint) from public,anon,authenticated,service_role;
grant execute on function public.wk_chart_runtime_reserve_now_v1(
  uuid,date,timestamptz,smallint) to service_role;

-- Privilege boundaries must fail closed even if the data API is called directly.
do $wkpost$ begin
  if has_table_privilege('anon','platform_private.wk100_collect_now_requests_v1','SELECT')
    or has_table_privilege('authenticated','platform_private.wk100_collect_now_requests_v1','SELECT')
    or has_function_privilege('anon','public.wk100_request_collect_now_v1(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.wk_chart_runtime_reserve_now_v1(uuid,date,timestamptz,smallint)','EXECUTE')
    or has_function_privilege('anon','public.wk100_service_collect_now_requests_v1(date)','EXECUTE')
    or has_function_privilege('authenticated','public.wk100_service_collect_now_requests_v1(date)','EXECUTE')
  then raise exception 'WK100_COLLECT_NOW_ROLE_BOUNDARY_FAILURE'; end if;
  raise notice 'WK100_COLLECT_NOW_BACKEND_ONLY_NO_UI_NO_PUBLISH_PASS';
end $wkpost$;
commit;
