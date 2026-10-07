begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(
  hashtextextended('wakilisha:chart-research-programme-retirement-v1', 0)
);

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.wk_chart_editions_v2') is null
     or to_regclass('public.wk_chart_entries_v2') is null
  then
    raise exception
      'Chart research retirement requires Registry and production chart authority.';
  end if;

  if to_regclass('public.chart_research_windows') is null
     or to_regclass('public.chart_research_source_runs') is null
     or to_regclass('public.chart_research_observations') is null
     or to_regclass('private.chart_source_soak_v3_runs') is null
  then
    raise exception
      'Chart research retirement expected research-era substrates are missing.';
  end if;

  if exists (select 1 from public.chart_research_windows)
     or exists (select 1 from public.chart_research_source_runs)
     or exists (select 1 from public.chart_research_observations)
     or exists (select 1 from public.chart_research_model_runs)
     or exists (select 1 from public.chart_research_rank_outputs)
     or exists (select 1 from public.chart_research_stress_runs)
     or exists (select 1 from public.chart_research_validation_results)
     or exists (select 1 from public.chart_research_audit_events)
  then
    raise exception
      'Production chart_research_* contains rows; archive/reconcile before retirement.';
  end if;
end
$preflight$;

do $unschedule$
begin
  if to_regprocedure('cron.unschedule(text)') is not null then
    begin
      perform cron.unschedule('wakilisha-chart-source-soak-v3-enqueue');
    exception when others then
      null;
    end;

    begin
      perform cron.unschedule('wakilisha-chart-source-soak-v3-collect');
    exception when others then
      null;
    end;
  end if;
end
$unschedule$;

drop function if exists private.chart_source_soak_v3_collect_due();
drop function if exists private.chart_source_soak_v3_scheduled_enqueue();
drop function if exists private.chart_source_soak_v3_slot_utc(timestamptz);
drop function if exists private.chart_source_soak_v3_collect(uuid);
drop function if exists private.chart_source_soak_v3_enqueue(text, timestamptz);

drop table if exists private.chart_source_soak_v3_observations;
drop table if exists private.chart_source_soak_v3_requests;
drop table if exists private.chart_source_soak_v3_spotify_ugc_observations;
drop table if exists private.chart_source_soak_v3_spotify_ugc_requests;
drop table if exists private.chart_source_soak_v3_spotify_ugc_panel;
drop table if exists private.chart_source_soak_v3_scheduler_control;
drop table if exists private.chart_source_soak_v3_runs;

drop table if exists public.chart_research_validation_results;
drop table if exists public.chart_research_stress_runs;
drop table if exists public.chart_research_rank_outputs;
drop table if exists public.chart_research_observations;
drop table if exists public.chart_research_source_runs;
drop table if exists public.chart_research_model_runs;
drop table if exists public.chart_research_audit_events;
drop table if exists public.chart_research_windows;

drop function if exists private.chart_research_append_only_guard_v1();
drop function if exists private.chart_research_audit_row_v1();
drop function if exists private.chart_research_touch_updated_at_v1();

do $postflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.wk_chart_editions_v2') is null
     or to_regclass('public.wk_chart_entries_v2') is null
  then
    raise exception
      'Chart research retirement altered required product authority.';
  end if;

  if to_regclass('public.chart_research_windows') is not null
     or to_regclass('public.chart_research_observations') is not null
     or to_regclass('private.chart_source_soak_v3_runs') is not null
     or to_regprocedure('private.chart_research_audit_row_v1()') is not null
     or to_regprocedure('private.chart_source_soak_v3_collect_due()') is not null
  then
    raise exception
      'Chart research retirement left research-era runtime authority behind.';
  end if;
end
$postflight$;

commit;
