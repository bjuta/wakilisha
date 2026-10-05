begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(
  hashtextextended('wakilisha:chart-research-observation-substrate-v1', 0)
);

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null then
    raise exception
      'Chart research observation substrate requires registry_tracks.';
  end if;

  if to_regclass('public.chart_research_windows') is not null
     or to_regclass('public.chart_research_source_runs') is not null
     or to_regclass('public.chart_research_observations') is not null
     or to_regclass('public.chart_research_model_runs') is not null
     or to_regclass('public.chart_research_rank_outputs') is not null
     or to_regclass('public.chart_research_stress_runs') is not null
     or to_regclass('public.chart_research_validation_results') is not null
     or to_regclass('public.chart_research_audit_events') is not null
  then
    raise exception
      'Chart research observation substrate already exists.';
  end if;
end
$preflight$;

create table public.chart_research_windows (
  id uuid primary key default gen_random_uuid(),
  tracking_start timestamptz not null,
  tracking_end timestamptz not null,
  phase text not null check (
    phase in (
      'engineering_pilot',
      'calibration',
      'confirmatory_holdout',
      'post_launch_monitoring'
    )
  ),
  protocol_version text not null check (nullif(btrim(protocol_version),'') is not null),
  source_constitution_version text not null check (
    nullif(btrim(source_constitution_version),'') is not null
  ),
  registry_snapshot_ref text,
  expected_source_keys text[] not null default array[]::text[],
  collection_state text not null default 'draft' check (
    collection_state in (
      'draft',
      'collecting',
      'closed',
      'invalidated'
    )
  ),
  freeze_hash text check (
    freeze_hash is null
    or length(freeze_hash) >= 32
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_research_windows_period_ck
    check (tracking_end > tracking_start),
  constraint chart_research_windows_period_uniq
    unique (tracking_start, tracking_end)
);

comment on table public.chart_research_windows is
  'Non-publishing weekly research windows for WAKILISHA 100 prospective shadow validation.';

create table public.chart_research_source_runs (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null
    references public.chart_research_windows(id)
    on update restrict
    on delete restrict,
  source_key text not null check (nullif(btrim(source_key),'') is not null),
  provider text not null check (nullif(btrim(provider),'') is not null),
  source_family text,
  source_surface text not null check (nullif(btrim(source_surface),'') is not null),
  provider_market text,
  expected boolean not null default true,
  fetch_started_at timestamptz,
  fetch_finished_at timestamptz,
  fetch_status text not null default 'not_attempted' check (
    fetch_status in (
      'not_attempted',
      'queued',
      'running',
      'succeeded',
      'failed'
    )
  ),
  parse_status text not null default 'pending' check (
    parse_status in (
      'pending',
      'succeeded',
      'failed',
      'not_applicable'
    )
  ),
  row_count integer not null default 0 check (row_count >= 0),
  chart_depth integer check (chart_depth is null or chart_depth > 0),
  censoring_type text not null default 'unknown' check (
    censoring_type in (
      'top_n',
      'partitioned',
      'full',
      'unknown',
      'not_applicable'
    )
  ),
  payload_hash text,
  health_state text not null default 'unknown' check (
    health_state in (
      'healthy',
      'degraded',
      'down',
      'parse_failed',
      'partial_window',
      'unknown'
    )
  ),
  failure_reason text,
  adapter_version text not null check (nullif(btrim(adapter_version),'') is not null),
  source_methodology_version text,
  territorial_confidence text not null default 'uncertain' check (
    territorial_confidence in (
      'verified',
      'provider_defined',
      'inferred',
      'uncertain',
      'not_applicable'
    )
  ),
  receipt_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_research_source_runs_window_source_uniq
    unique (window_id, source_key),
  constraint chart_research_source_runs_fetch_window_ck
    check (
      fetch_finished_at is null
      or fetch_started_at is null
      or fetch_finished_at >= fetch_started_at
    )
);

comment on table public.chart_research_source_runs is
  'Per-source collection receipts for non-publishing chart research windows.';

create table public.chart_research_observations (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null
    references public.chart_research_windows(id)
    on update restrict
    on delete restrict,
  source_run_id uuid not null
    references public.chart_research_source_runs(id)
    on update restrict
    on delete restrict,
  provider text not null check (nullif(btrim(provider),'') is not null),
  source_family text,
  source_surface text not null check (nullif(btrim(source_surface),'') is not null),
  provider_market text,
  provider_row_key text not null check (nullif(btrim(provider_row_key),'') is not null),
  provider_track_id text,
  provider_release_id text,
  provider_artist_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(provider_artist_ids)='array'),
  isrc text,
  canonical_track_id uuid
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  identity_status text not null default 'unresolved' check (
    identity_status in (
      'unresolved',
      'resolved',
      'quarantined'
    )
  ),
  identity_confidence text not null default 'unknown' check (
    identity_confidence in (
      'verified',
      'high',
      'medium',
      'low',
      'unknown'
    )
  ),
  rank integer check (rank is null or rank > 0),
  chart_depth integer check (chart_depth is null or chart_depth > 0),
  censoring_type text not null default 'unknown' check (
    censoring_type in (
      'top_n',
      'partitioned',
      'full',
      'unknown',
      'not_applicable'
    )
  ),
  metric_name text,
  metric_value numeric,
  metric_unit text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  captured_at timestamptz not null,
  behavior_class text not null check (
    behavior_class in (
      'consumption',
      'exposure',
      'discovery',
      'transaction',
      'ugc',
      'other'
    )
  ),
  officiality_class text not null default 'unknown' check (
    officiality_class in (
      'official_chart',
      'official_playlist',
      'editorial',
      'ugc_playlist',
      'derived',
      'other',
      'unknown'
    )
  ),
  territorial_confidence text not null default 'uncertain' check (
    territorial_confidence in (
      'verified',
      'provider_defined',
      'inferred',
      'uncertain',
      'not_applicable'
    )
  ),
  missingness_state text not null default 'observed' check (
    missingness_state in (
      'observed',
      'partial_window',
      'below_top_n',
      'not_eligible_at_provider',
      'not_in_source_population',
      'identity_unresolved',
      'cardinal_metric_missing',
      'no_observation'
    )
  ),
  raw_payload_hash text not null check (length(raw_payload_hash) >= 32),
  raw_payload_ref jsonb not null default '{}'::jsonb,
  adapter_version text not null check (nullif(btrim(adapter_version),'') is not null),
  source_methodology_version text,
  created_at timestamptz not null default now(),
  constraint chart_research_observations_source_row_uniq
    unique (source_run_id, provider_row_key),
  constraint chart_research_observations_period_ck
    check (period_end > period_start),
  constraint chart_research_observations_signal_ck
    check (rank is not null or metric_value is not null),
  constraint chart_research_observations_resolved_identity_ck
    check (
      identity_status <> 'resolved'
      or canonical_track_id is not null
    )
);

comment on table public.chart_research_observations is
  'Immutable source x track observations preserving rank, metric, censoring, source-health lineage, and Registry resolution for shadow research.';

create table public.chart_research_model_runs (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null
    references public.chart_research_windows(id)
    on update restrict
    on delete restrict,
  model_id text not null check (nullif(btrim(model_id),'') is not null),
  model_spec_version text not null check (
    nullif(btrim(model_spec_version),'') is not null
  ),
  analysis_commit text not null check (nullif(btrim(analysis_commit),'') is not null),
  config_hash text not null check (length(config_hash) >= 32),
  input_snapshot_hash text not null check (length(input_snapshot_hash) >= 32),
  status text not null default 'queued' check (
    status in (
      'queued',
      'running',
      'succeeded',
      'failed',
      'invalidated'
    )
  ),
  convergence_state text,
  seed bigint,
  diagnostics_json jsonb not null default '{}'::jsonb,
  output_hash text check (output_hash is null or length(output_hash) >= 32),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_research_model_runs_time_ck
    check (
      finished_at is null
      or started_at is null
      or finished_at >= started_at
    )
);

comment on table public.chart_research_model_runs is
  'Versioned model execution receipts for shadow chart research; never publication authority.';

create table public.chart_research_rank_outputs (
  id uuid primary key default gen_random_uuid(),
  model_run_id uuid not null
    references public.chart_research_model_runs(id)
    on update restrict
    on delete restrict,
  canonical_track_id uuid not null
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  rank_estimate integer not null check (rank_estimate > 0),
  latent_score numeric,
  rank_interval_lower integer check (
    rank_interval_lower is null
    or rank_interval_lower > 0
  ),
  rank_interval_upper integer check (
    rank_interval_upper is null
    or rank_interval_upper > 0
  ),
  top10_probability numeric check (
    top10_probability is null
    or (top10_probability >= 0 and top10_probability <= 1)
  ),
  top40_probability numeric check (
    top40_probability is null
    or (top40_probability >= 0 and top40_probability <= 1)
  ),
  uncertainty_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chart_research_rank_outputs_run_track_uniq
    unique (model_run_id, canonical_track_id),
  constraint chart_research_rank_outputs_interval_ck
    check (
      rank_interval_lower is null
      or rank_interval_upper is null
      or rank_interval_lower <= rank_interval_upper
    )
);

comment on table public.chart_research_rank_outputs is
  'Immutable per-model shadow ranking outputs with optional calibrated uncertainty.';

create table public.chart_research_stress_runs (
  id uuid primary key default gen_random_uuid(),
  base_model_run_id uuid not null
    references public.chart_research_model_runs(id)
    on update restrict
    on delete restrict,
  stress_type text not null check (
    stress_type in (
      'source_deletion',
      'censoring_mask',
      'integrity_attack',
      'identity_perturbation',
      'other'
    )
  ),
  stress_spec_version text not null check (
    nullif(btrim(stress_spec_version),'') is not null
  ),
  analysis_commit text not null check (nullif(btrim(analysis_commit),'') is not null),
  stress_parameters_json jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (
    status in (
      'queued',
      'running',
      'succeeded',
      'failed',
      'invalidated'
    )
  ),
  output_hash text check (output_hash is null or length(output_hash) >= 32),
  summary_metrics_json jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_research_stress_runs_time_ck
    check (
      finished_at is null
      or started_at is null
      or finished_at >= started_at
    )
);

comment on table public.chart_research_stress_runs is
  'Versioned source-deletion, censoring, integrity, and identity stress-test receipts.';

create table public.chart_research_validation_results (
  id uuid primary key default gen_random_uuid(),
  model_run_id uuid
    references public.chart_research_model_runs(id)
    on update restrict
    on delete restrict,
  model_spec_version text,
  validation_dataset_version text not null check (
    nullif(btrim(validation_dataset_version),'') is not null
  ),
  validation_type text not null check (nullif(btrim(validation_type),'') is not null),
  metric_name text not null check (nullif(btrim(metric_name),'') is not null),
  metric_value numeric,
  metric_ci jsonb not null default '{}'::jsonb,
  subgroup_key text,
  confirmatory boolean not null default false,
  preregistration_lock_id text,
  analysis_commit text not null check (nullif(btrim(analysis_commit),'') is not null),
  created_at timestamptz not null default now(),
  constraint chart_research_validation_results_model_ref_ck
    check (
      model_run_id is not null
      or nullif(btrim(model_spec_version),'') is not null
    )
);

comment on table public.chart_research_validation_results is
  'Immutable validation metrics carrying explicit confirmatory versus exploratory authority.';

create table public.chart_research_audit_events (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_row_hash text,
  new_row_hash text,
  actor_user_id uuid,
  actor_db_role text not null,
  request_subject text,
  created_at timestamptz not null default now()
);

comment on table public.chart_research_audit_events is
  'Append-only hashed mutation receipt stream for the chart research substrate.';

create index chart_research_source_runs_window_idx
  on public.chart_research_source_runs(window_id, source_key);

create index chart_research_observations_window_idx
  on public.chart_research_observations(window_id, provider, rank);

create index chart_research_observations_track_idx
  on public.chart_research_observations(canonical_track_id, captured_at)
  where canonical_track_id is not null;

create index chart_research_observations_source_run_idx
  on public.chart_research_observations(source_run_id, rank);

create index chart_research_model_runs_window_idx
  on public.chart_research_model_runs(window_id, model_id, created_at);

create index chart_research_rank_outputs_run_rank_idx
  on public.chart_research_rank_outputs(model_run_id, rank_estimate);

create index chart_research_stress_runs_model_idx
  on public.chart_research_stress_runs(base_model_run_id, stress_type);

create index chart_research_validation_results_model_idx
  on public.chart_research_validation_results(model_run_id, confirmatory)
  where model_run_id is not null;

create index chart_research_audit_events_row_idx
  on public.chart_research_audit_events(table_name, row_id, created_at);

create or replace function private.chart_research_touch_updated_at_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end
$function$;

create or replace function private.chart_research_audit_row_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_row_id uuid;
  v_old_json jsonb;
  v_new_json jsonb;
  v_old_hash text;
  v_new_hash text;
begin
  if tg_op = 'INSERT' then
    v_new_json := to_jsonb(new);
    v_row_id := nullif(v_new_json->>'id','')::uuid;
  elsif tg_op = 'UPDATE' then
    v_old_json := to_jsonb(old);
    v_new_json := to_jsonb(new);
    v_row_id := coalesce(
      nullif(v_new_json->>'id','')::uuid,
      nullif(v_old_json->>'id','')::uuid
    );
  elsif tg_op = 'DELETE' then
    v_old_json := to_jsonb(old);
    v_row_id := nullif(v_old_json->>'id','')::uuid;
  end if;

  if v_old_json is not null then
    v_old_hash := encode(
      extensions.digest(v_old_json::text, 'sha256'),
      'hex'
    );
  end if;

  if v_new_json is not null then
    v_new_hash := encode(
      extensions.digest(v_new_json::text, 'sha256'),
      'hex'
    );
  end if;

  insert into public.chart_research_audit_events(
    table_name,
    row_id,
    operation,
    old_row_hash,
    new_row_hash,
    actor_user_id,
    actor_db_role,
    request_subject
  )
  values (
    tg_table_name,
    v_row_id,
    tg_op,
    v_old_hash,
    v_new_hash,
    auth.uid(),
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true),''),
      session_user::text
    ),
    nullif(current_setting('request.jwt.claim.sub', true),'')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end
$function$;

create or replace function private.chart_research_append_only_guard_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception using
    errcode = '42501',
    message = format(
      'Chart research table %s is append-only.',
      tg_table_name
    );
end
$function$;

revoke all on function private.chart_research_touch_updated_at_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.chart_research_audit_row_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.chart_research_append_only_guard_v1()
  from public, anon, authenticated, service_role;

create trigger chart_research_windows_touch_updated_at
before update on public.chart_research_windows
for each row execute function private.chart_research_touch_updated_at_v1();

create trigger chart_research_source_runs_touch_updated_at
before update on public.chart_research_source_runs
for each row execute function private.chart_research_touch_updated_at_v1();

create trigger chart_research_model_runs_touch_updated_at
before update on public.chart_research_model_runs
for each row execute function private.chart_research_touch_updated_at_v1();

create trigger chart_research_stress_runs_touch_updated_at
before update on public.chart_research_stress_runs
for each row execute function private.chart_research_touch_updated_at_v1();

create trigger chart_research_observations_append_only
before update or delete on public.chart_research_observations
for each row execute function private.chart_research_append_only_guard_v1();

create trigger chart_research_rank_outputs_append_only
before update or delete on public.chart_research_rank_outputs
for each row execute function private.chart_research_append_only_guard_v1();

create trigger chart_research_validation_results_append_only
before update or delete on public.chart_research_validation_results
for each row execute function private.chart_research_append_only_guard_v1();

create trigger chart_research_audit_events_append_only
before update or delete on public.chart_research_audit_events
for each row execute function private.chart_research_append_only_guard_v1();

create trigger chart_research_windows_audit
after insert or update or delete on public.chart_research_windows
for each row execute function private.chart_research_audit_row_v1();

create trigger chart_research_source_runs_audit
after insert or update or delete on public.chart_research_source_runs
for each row execute function private.chart_research_audit_row_v1();

create trigger chart_research_observations_audit
after insert on public.chart_research_observations
for each row execute function private.chart_research_audit_row_v1();

create trigger chart_research_model_runs_audit
after insert or update or delete on public.chart_research_model_runs
for each row execute function private.chart_research_audit_row_v1();

create trigger chart_research_rank_outputs_audit
after insert on public.chart_research_rank_outputs
for each row execute function private.chart_research_audit_row_v1();

create trigger chart_research_stress_runs_audit
after insert or update or delete on public.chart_research_stress_runs
for each row execute function private.chart_research_audit_row_v1();

create trigger chart_research_validation_results_audit
after insert on public.chart_research_validation_results
for each row execute function private.chart_research_audit_row_v1();

alter table public.chart_research_windows enable row level security;
alter table public.chart_research_source_runs enable row level security;
alter table public.chart_research_observations enable row level security;
alter table public.chart_research_model_runs enable row level security;
alter table public.chart_research_rank_outputs enable row level security;
alter table public.chart_research_stress_runs enable row level security;
alter table public.chart_research_validation_results enable row level security;
alter table public.chart_research_audit_events enable row level security;

revoke all on table
  public.chart_research_windows,
  public.chart_research_source_runs,
  public.chart_research_observations,
  public.chart_research_model_runs,
  public.chart_research_rank_outputs,
  public.chart_research_stress_runs,
  public.chart_research_validation_results,
  public.chart_research_audit_events
from public, anon, authenticated, service_role;

grant select, insert, update
on table
  public.chart_research_windows,
  public.chart_research_source_runs,
  public.chart_research_model_runs,
  public.chart_research_stress_runs
to service_role;

grant select, insert
on table
  public.chart_research_observations,
  public.chart_research_rank_outputs,
  public.chart_research_validation_results
to service_role;

grant select
on table public.chart_research_audit_events
to service_role;

do $postflight$
declare
  v_table text;
begin
  foreach v_table in array array[
    'chart_research_windows',
    'chart_research_source_runs',
    'chart_research_observations',
    'chart_research_model_runs',
    'chart_research_rank_outputs',
    'chart_research_stress_runs',
    'chart_research_validation_results',
    'chart_research_audit_events'
  ]
  loop
    if to_regclass('public.'||v_table) is null then
      raise exception 'Chart research table missing: %', v_table;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=v_table
        and c.relrowsecurity
    ) then
      raise exception 'Chart research RLS missing: %', v_table;
    end if;

    if has_table_privilege('anon','public.'||v_table,'SELECT')
       or has_table_privilege('anon','public.'||v_table,'INSERT')
       or has_table_privilege('anon','public.'||v_table,'UPDATE')
       or has_table_privilege('anon','public.'||v_table,'DELETE')
       or has_table_privilege('authenticated','public.'||v_table,'SELECT')
       or has_table_privilege('authenticated','public.'||v_table,'INSERT')
       or has_table_privilege('authenticated','public.'||v_table,'UPDATE')
       or has_table_privilege('authenticated','public.'||v_table,'DELETE')
    then
      raise exception
        'Browser role gained direct chart research table authority: %',
        v_table;
    end if;

    if has_table_privilege('service_role','public.'||v_table,'DELETE') then
      raise exception
        'Chart research history regained direct DELETE authority: %',
        v_table;
    end if;
  end loop;

  if not has_table_privilege(
       'service_role',
       'public.chart_research_windows',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'public.chart_research_windows',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'public.chart_research_windows',
       'UPDATE'
     )
     or not has_table_privilege(
       'service_role',
       'public.chart_research_observations',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'public.chart_research_observations',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'public.chart_research_audit_events',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'public.chart_research_audit_events',
       'INSERT'
     )
  then
    raise exception
      'Chart research service authority boundary is incomplete.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='chart_research_observations'
      and column_name='rank'
  )
     or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='chart_research_observations'
      and column_name='chart_depth'
  )
     or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='chart_research_observations'
      and column_name='censoring_type'
  )
     or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='chart_research_observations'
      and column_name='raw_payload_hash'
      and is_nullable='NO'
  )
     or not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='chart_research_observations'
      and column_name='adapter_version'
      and is_nullable='NO'
  )
  then
    raise exception
      'Chart research observation semantic columns are incomplete.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid='public.chart_research_observations'::regclass
      and tgname='chart_research_observations_append_only'
      and not tgisinternal
  )
     or not exists (
    select 1
    from pg_trigger
    where tgrelid='public.chart_research_rank_outputs'::regclass
      and tgname='chart_research_rank_outputs_append_only'
      and not tgisinternal
  )
     or not exists (
    select 1
    from pg_trigger
    where tgrelid='public.chart_research_validation_results'::regclass
      and tgname='chart_research_validation_results_append_only'
      and not tgisinternal
  )
  then
    raise exception
      'Chart research immutable evidence guards are incomplete.';
  end if;

  if exists (
    select 1
    from pg_constraint con
    where con.contype='f'
      and con.conrelid in (
        'public.chart_research_windows'::regclass,
        'public.chart_research_source_runs'::regclass,
        'public.chart_research_observations'::regclass,
        'public.chart_research_model_runs'::regclass,
        'public.chart_research_rank_outputs'::regclass,
        'public.chart_research_stress_runs'::regclass,
        'public.chart_research_validation_results'::regclass
      )
      and con.confrelid in (
        'public.wk_chart_editions_v2'::regclass,
        'public.wk_chart_entries_v2'::regclass
      )
  ) then
    raise exception
      'Chart research substrate acquired publication-table coupling.';
  end if;

  raise notice
    'CHART_RESEARCH_OBSERVATION_SUBSTRATE_V1_PASS';
end
$postflight$;

commit;
