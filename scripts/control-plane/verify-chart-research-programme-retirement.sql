begin;

do $verify$
declare
  v_name text;
begin
  foreach v_name in array array[
    'public.chart_research_windows',
    'public.chart_research_source_runs',
    'public.chart_research_observations',
    'public.chart_research_model_runs',
    'public.chart_research_rank_outputs',
    'public.chart_research_stress_runs',
    'public.chart_research_validation_results',
    'public.chart_research_audit_events',
    'private.chart_source_soak_v3_runs',
    'private.chart_source_soak_v3_requests',
    'private.chart_source_soak_v3_observations',
    'private.chart_source_soak_v3_scheduler_control',
    'private.chart_source_soak_v3_spotify_ugc_panel',
    'private.chart_source_soak_v3_spotify_ugc_requests',
    'private.chart_source_soak_v3_spotify_ugc_observations'
  ]
  loop
    if to_regclass(v_name) is not null then
      raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: relation remains: %', v_name;
    end if;
  end loop;

  if to_regprocedure('private.chart_research_append_only_guard_v1()') is not null
     or to_regprocedure('private.chart_research_audit_row_v1()') is not null
     or to_regprocedure('private.chart_research_touch_updated_at_v1()') is not null
     or to_regprocedure('private.chart_source_soak_v3_collect_due()') is not null
     or to_regprocedure('private.chart_source_soak_v3_scheduled_enqueue()') is not null
     or to_regprocedure('private.chart_source_soak_v3_slot_utc(timestamptz)') is not null
     or to_regprocedure('private.chart_source_soak_v3_collect(uuid)') is not null
     or to_regprocedure('private.chart_source_soak_v3_enqueue(text,timestamptz)') is not null
  then
    raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: research function remains';
  end if;

  if to_regclass('cron.job') is not null then
    if exists (
      select 1
      from cron.job
      where jobname in (
        'wakilisha-chart-source-soak-v3-enqueue',
        'wakilisha-chart-source-soak-v3-collect'
      )
    ) then
      raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: research cron remains';
    end if;
  end if;

  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.wk_chart_editions_v2') is null
     or to_regclass('public.wk_chart_entries_v2') is null
  then
    raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: product chart/Registry authority missing';
  end if;

  if not exists (select 1 from pg_extension where extname='pg_net')
     or not exists (select 1 from pg_extension where extname='supabase_vault')
  then
    raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: shared platform extension removed';
  end if;

  if exists (select 1 from pg_extension where extname='pg_cron') then
    if to_regclass('cron.job') is null then
      raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: pg_cron installed without cron.job';
    end if;

    if not exists (
      select 1 from cron.job
      where jobname='briefing-daily-generate'
        and active
    ) then
      raise exception 'CHART_RESEARCH_RETIREMENT_FAIL: unrelated briefing cron missing/inactive';
    end if;
  else
    raise notice 'CHART_RESEARCH_RETIREMENT_PREVIEW_PG_CRON=SKIP';
  end if;

  raise notice 'CHART_RESEARCH_PROGRAMME_RETIREMENT=PASS';
end
$verify$;

rollback;
