-- Filename authority: Supabase CLI v2.107.0, minted on the accepted JB Mac.
-- CANONICAL_MIGRATION_PATH=supabase/migrations/20261019152307_wk_chart_observation_receipts_v1.sql
-- First product-level, nonpublishing WAKILISHA 100 capture persistence boundary.
-- No admitted providers, credentials, jobs, ingestion, scoring, Registry writes,
-- existing edition mutation, automatic approval, or publication.
-- Raw provider payload bytes must be secured and hashed by a later worker; this
-- migration stores their location and expected digest, not their contents.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $wk_chart_capture_preflight$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 231
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261015091718'
     or to_regclass('public.chart_ingest_runs') is null
     or to_regclass('public.wk_chart_editions_v2') is null
     or to_regnamespace('private') is null
     or to_regrole('service_role') is null
  then
    raise exception 'STOP: WK100 receipt substrate expects exact accepted 231-migration baseline';
  end if;
  if to_regclass('public.wk_chart_capture_contracts_v1') is not null
     or to_regclass('public.wk_chart_capture_attempts_v1') is not null
     or to_regclass('public.wk_chart_capture_rows_v1') is not null
     or to_regclass('public.wk_chart_weekly_freezes_v1') is not null
     or to_regprocedure('private.wk_chart_capture_block_mutation_v1()') is not null
     or to_regprocedure('private.wk_chart_capture_validate_attempt_v1()') is not null
     or to_regprocedure('private.wk_chart_capture_validate_row_v1()') is not null
     or to_regprocedure('private.wk_chart_capture_validate_freeze_v1()') is not null
  then
    raise exception 'STOP: WK100 capture v1 objects already exist';
  end if;
end;
$wk_chart_capture_preflight$;

-- A contract is a historical observation specification, NOT an approved source.
-- All v1 contracts are candidate_only; admission requires a separately reviewed
-- methodology and a later explicit, versioned product change.
create table public.wk_chart_capture_contracts_v1 (
  id uuid primary key default gen_random_uuid(),
  source_key text not null check (source_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  contract_version text not null check (contract_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$'),
  provider_key text not null check (provider_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  source_surface text not null check (length(btrim(source_surface)) between 3 and 180),
  market text not null default 'KE' check (market = 'KE'),
  behavior text not null check (behavior in
    ('consumption','video_consumption','discovery','ugc_curation','broadcast_exposure')),
  native_metric text not null check (native_metric in ('rank','rank_and_count','event_count')),
  expected_depth integer not null check (expected_depth between 1 and 500),
  cadence_kind text not null check (cadence_kind in ('daily','interval_hours','weekly')),
  interval_hours smallint,
  eat_hour smallint not null check (eat_hour between 0 and 23),
  eat_minute smallint not null check (eat_minute between 0 and 59),
  weekday_eat smallint,
  minimum_healthy_checkpoints smallint not null check (minimum_healthy_checkpoints >= 1),
  adapter_version text not null check (length(btrim(adapter_version)) between 2 and 100),
  adapter_sha256 text not null check (adapter_sha256 ~ '^[a-f0-9]{64}$'),
  -- v1 never constitutes sources as approved merely because they can be parsed.
  admission_state text not null default 'candidate' check (admission_state = 'candidate'),
  created_at timestamptz not null default now(),
  constraint wk_chart_capture_contract_unique unique (source_key, contract_version),
  constraint wk_chart_capture_contract_cadence check (
    (cadence_kind='daily' and interval_hours is null and weekday_eat is null
       and minimum_healthy_checkpoints <= 7)
    or (cadence_kind='interval_hours' and interval_hours in (3,4,6,8,12,24)
       and weekday_eat is null
       and minimum_healthy_checkpoints <= 168 / interval_hours)
    or (cadence_kind='weekly' and interval_hours is null and weekday_eat between 0 and 6
       and minimum_healthy_checkpoints = 1)
  )
);
comment on table public.wk_chart_capture_contracts_v1 is
  'Immutable candidate source contracts only. Insertion confers NO chart-scoring or publication authority.';

-- Each retry has its own receipt. Never overwrite an earlier failure or a
-- successful observation. Exactly one tuple (contract, slot, attempt_number).
create table public.wk_chart_capture_attempts_v1 (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.wk_chart_capture_contracts_v1(id)
    on update restrict on delete restrict,
  week_start_eat date not null check (extract(isodow from week_start_eat) = 1),
  scheduled_at timestamptz not null,
  attempt_number smallint not null check (attempt_number between 1 and 8),
  fetched_at timestamptz,
  status text not null check (status in
    ('succeeded','partial_depth','transport_failed','parse_failed',
     'target_period_unavailable','missed')),
  http_status smallint check (http_status is null or http_status between 100 and 599),
  observed_market text not null default 'KE' check (observed_market='KE'),
  observed_depth integer not null default 0 check (observed_depth between 0 and 500),
  record_count integer not null default 0 check (record_count between 0 and 500),
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[a-f0-9]{64}$'),
  -- This is a *private storage object key*, never an arbitrary HTTP URL or token.
  raw_object_key text check (
    raw_object_key is null or
    (length(raw_object_key) between 12 and 320
     and raw_object_key !~ '(\.\.|[?&=#])'
     and raw_object_key ~ '^[a-zA-Z0-9_./-]+$')
  ),
  native_period_authority text not null default 'unknown'
    check (native_period_authority in ('unknown','provider_defined')),
  native_period_start timestamptz,
  native_period_end timestamptz,
  native_period_evidence_ref text check (
    native_period_evidence_ref is null or
    (length(native_period_evidence_ref) between 3 and 240
     and native_period_evidence_ref !~ '[?&=]')
  ),
  upstream_reference text not null check (
    length(btrim(upstream_reference)) between 3 and 200
    and upstream_reference !~ '[?&=]'
  ),
  failure_code text check (failure_code is null or failure_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  created_at timestamptz not null default now(),
  constraint wk_chart_capture_attempt_slot_unique
    unique (contract_id, scheduled_at, attempt_number),
  constraint wk_chart_capture_attempt_time check (
    scheduled_at >= (week_start_eat::timestamp at time zone 'Africa/Nairobi')
    and scheduled_at < ((week_start_eat + 7)::timestamp at time zone 'Africa/Nairobi')
    and (fetched_at is null or
      (fetched_at >= scheduled_at and fetched_at <= scheduled_at + interval '24 hours'))
  ),
  constraint wk_chart_capture_attempt_result check (
    (status in ('succeeded','partial_depth')
      and fetched_at is not null and payload_sha256 is not null
      and raw_object_key is not null and record_count=observed_depth
      and record_count>0 and failure_code is null)
    or (status in ('parse_failed','target_period_unavailable')
      and fetched_at is not null and payload_sha256 is not null
      and raw_object_key is not null and observed_depth=0
      and record_count=0 and failure_code is not null)
    or (status in ('transport_failed','missed')
      and payload_sha256 is null and raw_object_key is null
      and observed_depth=0 and record_count=0 and failure_code is not null
      and (status <> 'missed' or fetched_at is null))
  ),
  constraint wk_chart_capture_attempt_native_period check (
    (native_period_authority='unknown'
      and native_period_start is null and native_period_end is null
      and native_period_evidence_ref is null)
    or (native_period_authority='provider_defined'
      and native_period_start is not null and native_period_end is not null
      and native_period_start < native_period_end
      and native_period_evidence_ref is not null)
  )
);
comment on table public.wk_chart_capture_attempts_v1 is
  'Append-only per-attempt receipt. A response digest is evidence of bytes, not of national coverage or provider authorization.';

-- Keep captured provider ranks separate from Registry canonical records.
-- The v1 rows never write artist, track, rights, credit, or Registry identity.
create table public.wk_chart_capture_rows_v1 (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.wk_chart_capture_attempts_v1(id)
    on update restrict on delete restrict,
  source_rank integer not null check (source_rank between 1 and 500),
  provider_track_id text check (provider_track_id is null or length(provider_track_id) between 1 and 180),
  title_observed text check (title_observed is null or length(title_observed) between 1 and 500),
  artist_observed text check (artist_observed is null or length(artist_observed) between 1 and 500),
  source_native_count bigint check (source_native_count is null or source_native_count >= 0),
  created_at timestamptz not null default now(),
  constraint wk_chart_capture_rank_unique unique (attempt_id, source_rank),
  constraint wk_chart_capture_row_has_reference check (
    provider_track_id is not null or title_observed is not null
  )
);
comment on table public.wk_chart_capture_rows_v1 is
  'Immutable source-native ranked observations. No stream-equivalence, deduced audience size, or Registry canonical assertion.';

-- The later controlled worker supplies an independently replayable hash of
-- receipt IDs/manifest, but the database does NOT grant ranking or publication.
create table public.wk_chart_weekly_freezes_v1 (
  id uuid primary key default gen_random_uuid(),
  week_start_eat date not null check (extract(isodow from week_start_eat)=1),
  constitution_version text not null check (length(btrim(constitution_version)) between 2 and 100),
  methodology_version text not null check (length(btrim(methodology_version)) between 2 and 100),
  freeze_schema_version text not null default 'wk-chart-weekly-evidence-v1'
    check (freeze_schema_version = 'wk-chart-weekly-evidence-v1'),
  -- Fixed to blocked in this first nonpublishing migration. An admitted source
  -- constitution, replay validation and editorial review are separate gates.
  freeze_state text not null default 'blocked' check (freeze_state='blocked'),
  receipt_ids uuid[] not null default '{}'::uuid[]
    check (cardinality(receipt_ids) between 0 and 500),
  receipts_sha256 text not null check (receipts_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  blocking_summary text not null check (length(btrim(blocking_summary)) between 5 and 2000),
  can_publish boolean not null default false check (can_publish=false),
  created_at timestamptz not null default now(),
  constraint wk_chart_weekly_freeze_identity unique
    (week_start_eat,constitution_version,methodology_version,manifest_sha256)
);
comment on table public.wk_chart_weekly_freezes_v1 is
  'Append-only blocked research-independent product capture freeze. NEVER a chart edition or permission to publish.';

create index wk_chart_capture_attempts_week_idx
  on public.wk_chart_capture_attempts_v1(week_start_eat,contract_id,scheduled_at);
create index wk_chart_capture_rows_attempt_idx
  on public.wk_chart_capture_rows_v1(attempt_id,source_rank);
create index wk_chart_weekly_freezes_week_idx
  on public.wk_chart_weekly_freezes_v1(week_start_eat,created_at);

create function private.wk_chart_capture_block_mutation_v1()
returns trigger language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception using errcode='42501',
    message='WK100 immutable capture receipt: UPDATE and DELETE prohibited';
end;
$function$;

-- Enforce cross-table metric/observed-depth constraints at insertion time.
create function private.wk_chart_capture_validate_attempt_v1()
returns trigger language plpgsql
security definer set search_path=pg_catalog
as $function$
declare v_depth integer;
begin
  select c.expected_depth into v_depth
  from public.wk_chart_capture_contracts_v1 c where c.id=new.contract_id;
  if v_depth is null
     or (new.status='succeeded' and new.observed_depth<>v_depth)
     or (new.status='partial_depth' and new.observed_depth>=v_depth) then
    raise exception using errcode='23514',
      message='WK100 successful capture depth disagrees with source contract';
  end if;
  return new;
end;
$function$;

create function private.wk_chart_capture_validate_row_v1()
returns trigger language plpgsql
security definer set search_path=pg_catalog
as $function$
declare v_status text; v_depth integer; v_metric text;
begin
  select a.status,a.observed_depth,c.native_metric
  into v_status,v_depth,v_metric
  from public.wk_chart_capture_attempts_v1 a
  join public.wk_chart_capture_contracts_v1 c on c.id=a.contract_id
  where a.id=new.attempt_id;
  if v_status not in ('succeeded','partial_depth')
     or new.source_rank>v_depth
     or (new.source_native_count is not null and v_metric<>'rank_and_count')
     or (new.source_native_count is null and v_metric='rank_and_count') then
    raise exception using errcode='23514',
      message='WK100 row violates source-native receipt or depth contract';
  end if;
  return new;
end;
$function$;

-- A freeze may reference only existing capture receipts for exactly its week.
-- One record per receipt, no duplicated ID or unrelated week. This does NOT
-- validate scoring, provenance, model fitness, or the provided hash itself.
create function private.wk_chart_capture_validate_freeze_v1()
returns trigger language plpgsql
security definer set search_path=pg_catalog
as $function$
declare v_count integer; v_unique integer; v_found integer; v_incomplete integer;
begin
  v_count:=cardinality(new.receipt_ids);
  select count(distinct x) into v_unique from unnest(new.receipt_ids) as x;
  if v_unique<>v_count then
    raise exception using errcode='23514',message='WK100 freeze contains duplicate receipt IDs';
  end if;
  select count(*) into v_found
    from public.wk_chart_capture_attempts_v1 a
    where a.id=any(new.receipt_ids) and a.week_start_eat=new.week_start_eat;
  if v_found<>v_count then
    raise exception using errcode='23514',message='WK100 freeze contains missing or cross-week receipt IDs';
  end if;
  select count(*) into v_incomplete
  from public.wk_chart_capture_attempts_v1 a
  where a.id=any(new.receipt_ids)
    and a.status in ('succeeded','partial_depth')
    and (select count(*) from public.wk_chart_capture_rows_v1 r
         where r.attempt_id=a.id) <> a.record_count;
  if v_incomplete<>0 then
    raise exception using errcode='23514',message='WK100 freeze contains incompletely persisted source rows';
  end if;
  return new;
end;
$function$;

create trigger wk_chart_capture_contracts_immutable
before update or delete on public.wk_chart_capture_contracts_v1
for each row execute function private.wk_chart_capture_block_mutation_v1();
create trigger wk_chart_capture_attempts_immutable
before update or delete on public.wk_chart_capture_attempts_v1
for each row execute function private.wk_chart_capture_block_mutation_v1();
create trigger wk_chart_capture_rows_immutable
before update or delete on public.wk_chart_capture_rows_v1
for each row execute function private.wk_chart_capture_block_mutation_v1();
create trigger wk_chart_weekly_freezes_immutable
before update or delete on public.wk_chart_weekly_freezes_v1
for each row execute function private.wk_chart_capture_block_mutation_v1();
create trigger wk_chart_capture_attempts_validate
before insert on public.wk_chart_capture_attempts_v1
for each row execute function private.wk_chart_capture_validate_attempt_v1();
create trigger wk_chart_capture_rows_validate
before insert on public.wk_chart_capture_rows_v1
for each row execute function private.wk_chart_capture_validate_row_v1();
create trigger wk_chart_weekly_freezes_validate
before insert on public.wk_chart_weekly_freezes_v1
for each row execute function private.wk_chart_capture_validate_freeze_v1();

-- Service-only, entirely invisible to ordinary PostgREST users. No RLS
-- policies are created. Supabase service_role bypasses RLS, and the collector
-- must remain a server-only holder of that secret, never a browser caller.
alter table public.wk_chart_capture_contracts_v1 enable row level security;
alter table public.wk_chart_capture_attempts_v1 enable row level security;
alter table public.wk_chart_capture_rows_v1 enable row level security;
alter table public.wk_chart_weekly_freezes_v1 enable row level security;

revoke all on public.wk_chart_capture_contracts_v1,
  public.wk_chart_capture_attempts_v1,
  public.wk_chart_capture_rows_v1,
  public.wk_chart_weekly_freezes_v1
  from public, anon, authenticated, service_role;
grant select, insert on public.wk_chart_capture_contracts_v1,
  public.wk_chart_capture_attempts_v1,
  public.wk_chart_capture_rows_v1,
  public.wk_chart_weekly_freezes_v1 to service_role;

revoke all on function private.wk_chart_capture_block_mutation_v1(),
  private.wk_chart_capture_validate_attempt_v1(),
  private.wk_chart_capture_validate_row_v1(),
  private.wk_chart_capture_validate_freeze_v1()
  from public, anon, authenticated, service_role;

-- No seed rows, cron jobs, source qualification or publication side effects.
do $wk_chart_capture_postflight$
declare v_name text;
begin
  foreach v_name in array array[
    'wk_chart_capture_contracts_v1','wk_chart_capture_attempts_v1',
    'wk_chart_capture_rows_v1','wk_chart_weekly_freezes_v1'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_name
        and c.relrowsecurity
    ) or has_table_privilege('anon',format('public.%I',v_name),'SELECT')
      or has_table_privilege('authenticated',format('public.%I',v_name),'SELECT')
      or has_table_privilege('authenticated',format('public.%I',v_name),'INSERT')
      or has_table_privilege('service_role',format('public.%I',v_name),'UPDATE')
      or has_table_privilege('service_role',format('public.%I',v_name),'DELETE')
      or not has_table_privilege('service_role',format('public.%I',v_name),'INSERT')
    then raise exception 'WK100 service-only capture ACL/RLS check failed: %',v_name;
    end if;
  end loop;
  if exists(select 1 from public.wk_chart_capture_contracts_v1)
     or exists(select 1 from public.wk_chart_capture_attempts_v1)
     or exists(select 1 from public.wk_chart_capture_rows_v1)
     or exists(select 1 from public.wk_chart_weekly_freezes_v1) then
    raise exception 'WK100 migration must not create any observation or freeze rows';
  end if;
  raise notice 'WK100_CAPTURE_SCHEMA_V1_SERVICE_ONLY_NO_SEEDS_NO_SCHEDULE=PASS';
end;
$wk_chart_capture_postflight$;
commit;
