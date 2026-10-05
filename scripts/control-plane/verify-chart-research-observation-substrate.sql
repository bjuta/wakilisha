begin;

do $verify_structure$
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
      raise exception 'CHART_RESEARCH_SUBSTRATE_FAIL: missing table %', v_table;
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
        'CHART_RESEARCH_SUBSTRATE_FAIL: browser role privilege leaked on %',
        v_table;
    end if;

    if has_table_privilege('service_role','public.'||v_table,'DELETE') then
      raise exception
        'CHART_RESEARCH_SUBSTRATE_FAIL: service delete authority leaked on %',
        v_table;
    end if;
  end loop;

  if not has_table_privilege('service_role','public.chart_research_windows','SELECT')
     or not has_table_privilege('service_role','public.chart_research_windows','INSERT')
     or not has_table_privilege('service_role','public.chart_research_windows','UPDATE')
     or not has_table_privilege('service_role','public.chart_research_source_runs','SELECT')
     or not has_table_privilege('service_role','public.chart_research_source_runs','INSERT')
     or not has_table_privilege('service_role','public.chart_research_source_runs','UPDATE')
     or not has_table_privilege('service_role','public.chart_research_observations','SELECT')
     or not has_table_privilege('service_role','public.chart_research_observations','INSERT')
     or not has_table_privilege('service_role','public.chart_research_model_runs','SELECT')
     or not has_table_privilege('service_role','public.chart_research_model_runs','INSERT')
     or not has_table_privilege('service_role','public.chart_research_model_runs','UPDATE')
     or not has_table_privilege('service_role','public.chart_research_rank_outputs','SELECT')
     or not has_table_privilege('service_role','public.chart_research_rank_outputs','INSERT')
     or not has_table_privilege('service_role','public.chart_research_stress_runs','SELECT')
     or not has_table_privilege('service_role','public.chart_research_stress_runs','INSERT')
     or not has_table_privilege('service_role','public.chart_research_stress_runs','UPDATE')
     or not has_table_privilege('service_role','public.chart_research_validation_results','SELECT')
     or not has_table_privilege('service_role','public.chart_research_validation_results','INSERT')
     or not has_table_privilege('service_role','public.chart_research_audit_events','SELECT')
  then
    raise exception
      'CHART_RESEARCH_SUBSTRATE_FAIL: service authority incomplete';
  end if;

  if has_table_privilege(
       'service_role',
       'public.chart_research_audit_events',
       'INSERT'
     )
  then
    raise exception
      'CHART_RESEARCH_SUBSTRATE_FAIL: service can forge audit receipts';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='chart_research_rank_outputs'
      and indexname='chart_research_rank_outputs_track_idx'
      and indexdef like '%(canonical_track_id)%'
  ) then
    raise exception
      'CHART_RESEARCH_SUBSTRATE_FAIL: rank-output Track foreign key is not covered by the canonical_track_id index';
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
      and column_name='metric_value'
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
      'CHART_RESEARCH_SUBSTRATE_FAIL: observation semantic contract incomplete';
  end if;
end
$verify_structure$;

do $verify_behavior$
declare
  v_window uuid:=gen_random_uuid();
  v_source_run uuid:=gen_random_uuid();
  v_observation uuid:=gen_random_uuid();
  v_audit_count integer;
  v_guarded boolean:=false;
begin
  insert into public.chart_research_windows(
    id,
    tracking_start,
    tracking_end,
    phase,
    protocol_version,
    source_constitution_version,
    expected_source_keys
  )
  values (
    v_window,
    timestamptz '2026-10-05 00:00:00+00',
    timestamptz '2026-10-12 00:00:00+00',
    'engineering_pilot',
    'verify-v1',
    'verify-v1',
    array['fixture']
  );

  insert into public.chart_research_source_runs(
    id,
    window_id,
    source_key,
    provider,
    source_surface,
    provider_market,
    fetch_status,
    parse_status,
    row_count,
    chart_depth,
    censoring_type,
    health_state,
    adapter_version,
    territorial_confidence
  )
  values (
    v_source_run,
    v_window,
    'fixture',
    'fixture',
    'fixture://chart',
    'KE',
    'succeeded',
    'succeeded',
    1,
    100,
    'top_n',
    'healthy',
    'verify-v1',
    'provider_defined'
  );

  insert into public.chart_research_observations(
    id,
    window_id,
    source_run_id,
    provider,
    source_surface,
    provider_market,
    provider_row_key,
    identity_status,
    identity_confidence,
    rank,
    chart_depth,
    censoring_type,
    period_start,
    period_end,
    captured_at,
    behavior_class,
    officiality_class,
    territorial_confidence,
    missingness_state,
    raw_payload_hash,
    raw_payload_ref,
    adapter_version
  )
  values (
    v_observation,
    v_window,
    v_source_run,
    'fixture',
    'fixture://chart',
    'KE',
    'fixture:1',
    'unresolved',
    'unknown',
    1,
    100,
    'top_n',
    timestamptz '2026-10-05 00:00:00+00',
    timestamptz '2026-10-12 00:00:00+00',
    timestamptz '2026-10-12 00:05:00+00',
    'consumption',
    'official_chart',
    'provider_defined',
    'observed',
    repeat('a',64),
    '{"fixture":true}'::jsonb,
    'verify-v1'
  );

  select count(*)::integer
  into v_audit_count
  from public.chart_research_audit_events
  where row_id in (v_window,v_source_run,v_observation);

  if v_audit_count <> 3 then
    raise exception
      'CHART_RESEARCH_SUBSTRATE_FAIL: expected 3 audit receipts, found %',
      v_audit_count;
  end if;

  begin
    update public.chart_research_observations
    set rank=2
    where id=v_observation;
  exception
    when insufficient_privilege then
      v_guarded:=true;
  end;

  if not v_guarded then
    raise exception
      'CHART_RESEARCH_SUBSTRATE_FAIL: immutable observation accepted UPDATE';
  end if;
end
$verify_behavior$;

do $verify_publication_boundary$
begin
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
      'CHART_RESEARCH_SUBSTRATE_FAIL: publication-table coupling exists';
  end if;

  raise notice 'CHART_RESEARCH_OBSERVATION_SUBSTRATE_PASS';
end
$verify_publication_boundary$;

rollback;
