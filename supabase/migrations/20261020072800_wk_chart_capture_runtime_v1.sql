-- Filename authority: CLI-minted on operator's accepted Mac ONLY.
-- WAKILISHA 100 candidate collection: durable lease+reservation and atomic receipt persistence.
-- Never seeds source admission, schedules any cron, or publishes an edition.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

do $preflight$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 233
    or (select max(version) from supabase_migrations.schema_migrations) <> '20261019203244'
    or to_regclass('public.wk_chart_capture_attempts_v1') is null
    or to_regclass('public.wk_chart_capture_rows_v1') is null
    or not exists (select 1 from storage.buckets where id='wk-chart-raw-evidence-v1' and public=false)
    or to_regclass('private.wk_chart_runtime_reservations_v1') is not null
    or exists (select 1 from public.wk_chart_capture_contracts_v1)
    or exists (select 1 from public.wk_chart_capture_attempts_v1)
    or exists (select 1 from public.wk_chart_capture_rows_v1)
    or exists (select 1 from public.wk_chart_weekly_freezes_v1)
    or (select count(*) from pg_policies where schemaname='storage' and tablename='objects')<>12
  then raise exception 'STOP: WK100 runtime requires clean 233 schema, four empty receipts, unchanged private Storage';
  end if;
end; $preflight$;

create table private.wk_chart_runtime_reservations_v1 (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.wk_chart_capture_contracts_v1(id) on update restrict on delete restrict,
  week_start_eat date not null,
  scheduled_at timestamptz not null,
  attempt_number smallint not null check (attempt_number between 1 and 8),
  state text not null default 'reserved' check (state in ('reserved','bound','uploaded','verified','committed')),
  lease_id uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null default (now() + interval '3 minutes'),
  object_key text unique check (object_key is null or (length(object_key) between 12 and 320
     and object_key !~ '(\.\.|[?&=#])' and object_key ~ '^[a-zA-Z0-9_./-]+$')),
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[a-f0-9]{64}$'),
  content_type text check (content_type is null or content_type in
    ('application/json','text/html','text/csv','application/octet-stream')),
  byte_length integer check (byte_length is null or byte_length between 1 and 4194304),
  fetched_at timestamptz,
  receipt_id uuid unique references public.wk_chart_capture_attempts_v1(id) on update restrict on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wk_chart_runtime_reservation_slot unique(contract_id,scheduled_at,attempt_number),
  constraint wk_chart_runtime_reservation_period check (extract(isodow from week_start_eat)=1 and
    scheduled_at >= (week_start_eat::timestamp at time zone 'Africa/Nairobi') and
    scheduled_at < ((week_start_eat + 7)::timestamp at time zone 'Africa/Nairobi')),
  constraint wk_chart_runtime_payload_bundle check (
    (state='reserved' and object_key is null and payload_sha256 is null
      and content_type is null and byte_length is null and fetched_at is null)
    or (state in ('bound','uploaded','verified','committed') and object_key is not null
      and payload_sha256 is not null and content_type is not null
      and byte_length is not null and fetched_at is not null)
    or (state='committed' and object_key is null and receipt_id is not null)
  )
);
comment on table private.wk_chart_runtime_reservations_v1 is
  'Private resumable lease ledger; only exact service-role RPCs may transition states. Captures are candidate evidence, never source admission.';
create index wk_chart_runtime_state_idx on private.wk_chart_runtime_reservations_v1(state,lease_expires_at);
alter table private.wk_chart_runtime_reservations_v1 enable row level security;
revoke all on private.wk_chart_runtime_reservations_v1 from public,anon,authenticated,service_role;

create function private.wk_chart_runtime_guard_v1()
returns void language plpgsql security definer set search_path=pg_catalog as $fn$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode='42501',message='WK100 service role required';
  end if;
end; $fn$;

-- Idempotent ownership of exactly one authorized EAT checkpoint/attempt number.
-- A busy reservation is never stolen; after 3 minutes only a fresh lease may resume.
create function public.wk_chart_runtime_reserve_v1(
  p_contract_id uuid, p_week_start_eat date, p_scheduled_at timestamptz,
  p_attempt_number smallint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare c public.wk_chart_capture_contracts_v1%rowtype;
  r private.wk_chart_runtime_reservations_v1%rowtype;
  v_local timestamp;
  v_day integer;
  v_minute integer;
  v_new_lease uuid;
  v_new_id uuid;
begin
  perform private.wk_chart_runtime_guard_v1();
  select * into c from public.wk_chart_capture_contracts_v1 where id=p_contract_id;
  if not found or c.admission_state<>'candidate' or p_week_start_eat is null
    or extract(isodow from p_week_start_eat)<>1
    or p_scheduled_at is null or p_attempt_number not between 1 and 8
    or p_scheduled_at < (p_week_start_eat::timestamp at time zone 'Africa/Nairobi')
    or p_scheduled_at >= ((p_week_start_eat+7)::timestamp at time zone 'Africa/Nairobi')
    or p_scheduled_at > now() or p_scheduled_at < now()-interval '20 minutes'
  then raise exception 'WK100 slot not authorized or outside bounded capture window'; end if;
  v_local:=p_scheduled_at at time zone 'Africa/Nairobi';
  v_day:= (v_local::date - p_week_start_eat);
  v_minute:=extract(hour from v_local)::int*60+extract(minute from v_local)::int;
  if extract(second from v_local)<>0 or
    (c.cadence_kind='daily' and v_minute<>(c.eat_hour*60+c.eat_minute)) or
    (c.cadence_kind='weekly' and (v_day<>c.weekday_eat or v_minute<>(c.eat_hour*60+c.eat_minute))) or
    (c.cadence_kind='interval_hours' and
      ( (extract(epoch from (v_local-(p_week_start_eat::timestamp+c.eat_hour*interval '1 hour'+c.eat_minute*interval '1 minute')))::bigint)
        < 0 or
        mod((extract(epoch from (v_local-(p_week_start_eat::timestamp+c.eat_hour*interval '1 hour'+c.eat_minute*interval '1 minute')))::bigint),c.interval_hours*3600)<>0))
  then raise exception 'WK100 checkpoint not in exact candidate source contract'; end if;
  insert into private.wk_chart_runtime_reservations_v1(contract_id,week_start_eat,scheduled_at,attempt_number)
  values(p_contract_id,p_week_start_eat,p_scheduled_at,p_attempt_number)
  on conflict (contract_id,scheduled_at,attempt_number) do nothing returning id into v_new_id;
  select * into strict r from private.wk_chart_runtime_reservations_v1
    where contract_id=p_contract_id and scheduled_at=p_scheduled_at and attempt_number=p_attempt_number for update;
  if r.week_start_eat<>p_week_start_eat then raise exception 'WK100 reservation week conflict'; end if;
  if r.state='committed' then
    return jsonb_build_object('state','committed','receipt_id',r.receipt_id,'reservation_id',r.id);
  end if;
  if v_new_id is null and r.lease_expires_at>now() then
    raise exception using errcode='55P03',message='WK100 reservation lease already active';
  end if;
  v_new_lease:=gen_random_uuid();
  update private.wk_chart_runtime_reservations_v1
    set lease_id=v_new_lease,lease_expires_at=now()+interval '3 minutes',updated_at=clock_timestamp()
    where id=r.id;
  return jsonb_build_object('state',r.state,'reservation_id',r.id,
    'lease_id',v_new_lease,'object_key',r.object_key,'payload_sha256',r.payload_sha256,
    'content_type',r.content_type,'byte_length',r.byte_length,'fetched_at',r.fetched_at);
end; $fn$;

create function private.wk_chart_runtime_lock_v1(p_reservation_id uuid,p_lease_id uuid)
returns private.wk_chart_runtime_reservations_v1 language plpgsql
security definer set search_path=pg_catalog as $fn$
declare r private.wk_chart_runtime_reservations_v1%rowtype;
begin
  perform private.wk_chart_runtime_guard_v1();
  select * into strict r from private.wk_chart_runtime_reservations_v1
    where id=p_reservation_id for update;
  if r.lease_id is distinct from p_lease_id or r.lease_expires_at<=now() or r.state='committed' then
    raise exception using errcode='55P03',message='WK100 lease expired or reservation committed';
  end if;
  return r;
end; $fn$;

-- Bind hash before any Storage bytes are uploaded. Advance only in order.
create function public.wk_chart_runtime_advance_v1(
  p_reservation_id uuid,p_lease_id uuid,p_action text,
  p_object_key text default null,p_payload_sha256 text default null,
  p_content_type text default null,p_byte_length integer default null,
  p_fetched_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r private.wk_chart_runtime_reservations_v1%rowtype;
  v_source text;
  v_utc_slot text;
  v_expected_prefix text;
  v_ext text;
begin
  r:=private.wk_chart_runtime_lock_v1(p_reservation_id,p_lease_id);
  if p_action='bind' and r.state='reserved' then
    select source_key into strict v_source from public.wk_chart_capture_contracts_v1 where id=r.contract_id;
    v_utc_slot:=to_char(r.scheduled_at at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"');
    v_expected_prefix:=format('v1/%s/%s/%s-%s/',r.week_start_eat,v_source,v_utc_slot,r.attempt_number);
    v_ext:=case p_content_type when 'application/json' then '.json'
      when 'text/html' then '.html' when 'text/csv' then '.csv'
      when 'application/octet-stream' then '.bin' else null end;
    if p_object_key is null or p_payload_sha256 is null or p_content_type is null
      or p_byte_length is null or p_fetched_at is null
      or left(p_object_key,length(v_expected_prefix))<>v_expected_prefix
      or p_payload_sha256 !~ '^[a-f0-9]{64}$'
      or p_object_key is distinct from (v_expected_prefix||p_payload_sha256||v_ext)
      or p_content_type not in ('application/json','text/html','text/csv','application/octet-stream')
      or (p_content_type='application/json' and right(p_object_key,5)<>'.json')
      or (p_content_type='text/html' and right(p_object_key,5)<>'.html')
      or (p_content_type='text/csv' and right(p_object_key,4)<>'.csv')
      or (p_content_type='application/octet-stream' and right(p_object_key,4)<>'.bin')
      or p_byte_length not between 1 and 4194304
      or p_fetched_at not between r.scheduled_at and r.scheduled_at+interval '24 hours'
    then raise exception 'WK100 invalid private raw-object binding'; end if;
    update private.wk_chart_runtime_reservations_v1 set state='bound',object_key=p_object_key,
      payload_sha256=p_payload_sha256,content_type=p_content_type,byte_length=p_byte_length,
      fetched_at=p_fetched_at,updated_at=clock_timestamp() where id=r.id;
  elsif p_action='uploaded' and r.state='bound' then
    if not exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1' and name=r.object_key)
    then raise exception 'WK100 stored object not found for uploaded transition'; end if;
    update private.wk_chart_runtime_reservations_v1 set state='uploaded',updated_at=clock_timestamp() where id=r.id;
  elsif p_action='verified' and r.state='uploaded' then
    if not exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1' and name=r.object_key)
    then raise exception 'WK100 stored object vanished before private digest verification'; end if;
    update private.wk_chart_runtime_reservations_v1 set state='verified',updated_at=clock_timestamp() where id=r.id;
  elsif p_action='bind' and r.state in ('bound','uploaded','verified')
     and r.object_key is not distinct from p_object_key
     and r.payload_sha256 is not distinct from p_payload_sha256
     and r.content_type is not distinct from p_content_type
     and r.byte_length is not distinct from p_byte_length
     and r.fetched_at is not distinct from p_fetched_at then
    null; -- same lease, exact idempotence only
  else
    raise exception 'WK100 invalid reservation state transition % -> %',r.state,p_action;
  end if;
  return jsonb_build_object('reservation_id',r.id,'action',p_action,'accepted',true);
end; $fn$;

-- One PostgreSQL transaction owns the immutable header and every rank row.
create function public.wk_chart_runtime_commit_v1(
  p_reservation_id uuid,p_lease_id uuid,p_outcome text,
  p_rows jsonb,p_upstream_reference text,
  p_native_period_start timestamptz default null,p_native_period_end timestamptz default null,
  p_native_period_evidence_ref text default null,p_failure_code text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r private.wk_chart_runtime_reservations_v1%rowtype;
  c public.wk_chart_capture_contracts_v1%rowtype;
  v_id uuid;
  v_count integer;
  v_rank integer;
  v_item jsonb;
  v_native text;
  v_state text;
begin
  r:=private.wk_chart_runtime_lock_v1(p_reservation_id,p_lease_id);
  select * into strict c from public.wk_chart_capture_contracts_v1 where id=r.contract_id;
  if c.admission_state<>'candidate' or r.state<>'verified'
    or p_outcome not in ('succeeded','partial_depth','parse_failed','target_period_unavailable')
    or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>c.expected_depth
    or p_upstream_reference is null or length(btrim(p_upstream_reference)) not between 3 and 200
    or p_upstream_reference~'[?&=]'
  then raise exception 'WK100 receipt commit boundary rejected'; end if;
  v_count:=jsonb_array_length(p_rows);
  if (p_outcome='succeeded' and v_count<>c.expected_depth)
    or (p_outcome='partial_depth' and (v_count<1 or v_count>=c.expected_depth))
    or (p_outcome in ('parse_failed','target_period_unavailable') and
      (v_count<>0 or p_failure_code !~ '^[a-z][a-z0-9_]{2,63}$'))
  then raise exception 'WK100 inconsistent native depth/status'; end if;
  for v_rank in 1..v_count loop
    v_item:=p_rows->(v_rank-1);
    if jsonb_typeof(v_item)<>'object'
       or (select count(*) from jsonb_object_keys(v_item) k where k not in
         ('rank','provider_track_id','title','artist','view_count'))>0
       or (v_item->>'rank') is distinct from v_rank::text
       or (v_item->>'provider_track_id') is null and (v_item->>'title') is null
       or (v_item ? 'view_count' and c.native_metric<>'rank_and_count')
       or (not (v_item ? 'view_count') and c.native_metric='rank_and_count')
    then raise exception 'WK100 invalid native rank/metric row'; end if;
  end loop;
  if (p_native_period_start is null)<>(p_native_period_end is null)
    or (p_native_period_start is null)<>(p_native_period_evidence_ref is null)
    or (p_native_period_start is not null and p_native_period_start>=p_native_period_end)
  then raise exception 'WK100 native period evidence invalid'; end if;
  v_native:=case when p_native_period_start is null then 'unknown' else 'provider_defined' end;
  insert into public.wk_chart_capture_attempts_v1(contract_id,week_start_eat,scheduled_at,
    attempt_number,fetched_at,status,http_status,observed_depth,record_count,payload_sha256,
    raw_object_key,native_period_authority,native_period_start,native_period_end,
    native_period_evidence_ref,upstream_reference,failure_code)
  values(r.contract_id,r.week_start_eat,r.scheduled_at,r.attempt_number,r.fetched_at,
    p_outcome,200,v_count,v_count,r.payload_sha256,r.object_key,v_native,
    p_native_period_start,p_native_period_end,p_native_period_evidence_ref,
    p_upstream_reference,p_failure_code)
  returning id into v_id;
  for v_rank in 1..v_count loop
    v_item:=p_rows->(v_rank-1);
    insert into public.wk_chart_capture_rows_v1(attempt_id,source_rank,provider_track_id,
      title_observed,artist_observed,source_native_count)
    values(v_id,v_rank,v_item->>'provider_track_id',v_item->>'title',v_item->>'artist',
       case when v_item ? 'view_count' then (v_item->>'view_count')::bigint else null end);
  end loop;
  update private.wk_chart_runtime_reservations_v1
    set state='committed',receipt_id=v_id,updated_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('receipt_id',v_id,'status',p_outcome,'rows',v_count,'can_publish',false);
end; $fn$;

create function public.wk_chart_runtime_fail_v1(
 p_reservation_id uuid,p_lease_id uuid,p_outcome text,p_upstream_reference text,
 p_failure_code text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r private.wk_chart_runtime_reservations_v1%rowtype;
 v_id uuid;
begin
 r:=private.wk_chart_runtime_lock_v1(p_reservation_id,p_lease_id);
 if r.state<>'reserved' or p_outcome not in ('transport_failed','missed')
   or p_failure_code !~ '^[a-z][a-z0-9_]{2,63}$'
   or length(btrim(p_upstream_reference)) not between 3 and 200
   or p_upstream_reference~'[?&=]'
 then raise exception 'WK100 invalid transport-failure receipt'; end if;
 insert into public.wk_chart_capture_attempts_v1(contract_id,week_start_eat,scheduled_at,
   attempt_number,fetched_at,status,upstream_reference,failure_code)
 values(r.contract_id,r.week_start_eat,r.scheduled_at,r.attempt_number,
   case when p_outcome='missed' then null else now() end,p_outcome,p_upstream_reference,p_failure_code)
 returning id into v_id;
 update private.wk_chart_runtime_reservations_v1 set state='committed',receipt_id=v_id,
   updated_at=clock_timestamp() where id=r.id;
 return jsonb_build_object('receipt_id',v_id,'status',p_outcome,'can_publish',false);
end; $fn$;

revoke all on function private.wk_chart_runtime_guard_v1(),
 private.wk_chart_runtime_lock_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.wk_chart_runtime_reserve_v1(uuid,date,timestamptz,smallint),
 public.wk_chart_runtime_advance_v1(uuid,uuid,text,text,text,text,integer,timestamptz),
 public.wk_chart_runtime_commit_v1(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text),
 public.wk_chart_runtime_fail_v1(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.wk_chart_runtime_reserve_v1(uuid,date,timestamptz,smallint),
 public.wk_chart_runtime_advance_v1(uuid,uuid,text,text,text,text,integer,timestamptz),
 public.wk_chart_runtime_commit_v1(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text),
 public.wk_chart_runtime_fail_v1(uuid,uuid,text,text,text) to service_role;

-- No policy on reservation; no job; no contract/receipt seed; no source admission.
do $postflight$
begin
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects')<>12
    or exists(select 1 from private.wk_chart_runtime_reservations_v1)
    or exists(select 1 from public.wk_chart_capture_contracts_v1)
    or exists(select 1 from public.wk_chart_capture_attempts_v1)
    or exists(select 1 from public.wk_chart_capture_rows_v1)
    or exists(select 1 from public.wk_chart_weekly_freezes_v1)
    or has_function_privilege('anon','public.wk_chart_runtime_reserve_v1(uuid,date,timestamptz,smallint)','EXECUTE')
    or has_function_privilege('authenticated','public.wk_chart_runtime_reserve_v1(uuid,date,timestamptz,smallint)','EXECUTE')
  then raise exception 'STOP: WK100 runtime postflight drift'; end if;
  raise notice 'WK100_CAPTURE_RUNTIME_INERT_NO_SOURCES_NO_CRON_NO_PUBLICATION=PASS';
end; $postflight$;
commit;
