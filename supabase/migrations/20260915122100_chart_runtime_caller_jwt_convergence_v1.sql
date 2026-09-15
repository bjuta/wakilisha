begin;

do $preflight$
begin
  if to_regclass('public.wk_chart_editions_v2') is null
     or to_regclass('public.wk_chart_entries_v2') is null
  then
    raise exception 'STOP: chart output tables are missing.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='wk_chart_editions_v2'
      and policyname='wk_chart_editions_v2_admin_insert'
      and with_check like '%manage_charts%'
  )
  or not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='wk_chart_entries_v2'
      and policyname='wk_chart_entries_v2_admin_insert'
      and with_check like '%manage_charts%'
  )
  then
    raise exception
      'STOP: existing manage_charts chart-output RLS authority drifted.';
  end if;

  if to_regprocedure('public.chart_get_run_origin_review_queue(text)') is null
     or to_regprocedure('public.chart_get_family_ingest_presets()') is null
     or to_regprocedure('public.chart_get_weekly_backfill_plan(text,date,date)') is null
     or to_regprocedure('public.chart_reset_run_after_origin_resolution(text)') is null
     or to_regprocedure('public.chart_upsert_family_ingest_preset(text,jsonb,text)') is null
  then
    raise exception 'STOP: expected chart helper authority is missing.';
  end if;

  if to_regprocedure('public.chart_materialize_candidate_registry_v1(uuid,uuid)') is null
     or to_regprocedure('public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)') is null
     or to_regprocedure('public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)') is null
  then
    raise exception 'STOP: governed Slice-2 Registry RPC authority is missing.';
  end if;
end
$preflight$;

grant insert, update, delete
on public.wk_chart_editions_v2,
   public.wk_chart_entries_v2
to authenticated;

create or replace function public.chart_get_run_origin_review_queue_v1(
  p_run_id text
)
returns table(
  review_key text,
  issue_type text,
  source_slug text,
  source_name text,
  canonical_artist_id uuid,
  canonical_slug text,
  canonical_name text,
  current_origin_iso2 text,
  target_iso2 text,
  impacted_candidate_count integer,
  top_score numeric,
  examples jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('view_charts_admin'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='view_charts_admin is required.';
  end if;

  return query
  select q.*
  from public.chart_get_run_origin_review_queue(p_run_id) q;
end;
$$;

create or replace function public.chart_get_family_ingest_presets_v1()
returns table(
  family_id text,
  config_json jsonb,
  updated_at timestamptz,
  updated_by text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('view_charts_admin'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='view_charts_admin is required.';
  end if;

  return query
  select p.*
  from public.chart_get_family_ingest_presets() p;
end;
$$;

create or replace function public.chart_get_weekly_backfill_plan_v1(
  p_family_id text,
  p_start_date date,
  p_end_date date
)
returns table(
  edition_date date,
  release_window_start date,
  release_window_end date,
  existing_edition_id text,
  existing_edition_status text,
  existing_entry_count integer,
  latest_run_id text,
  latest_run_status text,
  latest_run_updated_at timestamptz,
  recommended_action text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('view_charts_admin'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='view_charts_admin is required.';
  end if;

  return query
  select p.*
  from public.chart_get_weekly_backfill_plan(
    p_family_id,
    p_start_date,
    p_end_date
  ) p;
end;
$$;

create or replace function public.chart_reset_run_after_origin_resolution_v1(
  p_run_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('manage_ingest'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='manage_ingest is required.';
  end if;

  return public.chart_reset_run_after_origin_resolution(p_run_id);
end;
$$;

create or replace function public.chart_upsert_family_ingest_preset_v1(
  p_family_id text,
  p_config_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('manage_ingest'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='manage_ingest is required.';
  end if;

  return public.chart_upsert_family_ingest_preset(
    p_family_id,
    p_config_json,
    auth.uid()::text
  );
end;
$$;

create or replace function public.chart_get_entry_registry_identity_v1(
  p_edition_id text default null
)
returns table(
  entry_id text,
  track_title text,
  artist_name text,
  current_artist_slug text,
  canonical_track_id text,
  canonical_track_slug text,
  canonical_primary_artist_slug text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('publish_charts'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='publish_charts is required.';
  end if;

  return query
  select
    e.id::text,
    e.track_title::text,
    e.artist_name::text,
    e.artist_slug::text,
    e.canonical_track_id::text,
    t.slug::text,
    primary_credit.artist_slug::text
  from public.wk_chart_entries_v2 e
  left join public.registry_tracks t
    on t.id::text=e.canonical_track_id::text
  left join lateral (
    select ta.artist_slug
    from public.registry_track_artists ta
    where ta.track_id=t.id
      and ta.is_primary is true
    order by
      ta.credit_order asc nulls last,
      ta.created_at asc,
      ta.id asc
    limit 1
  ) primary_credit on true
  where p_edition_id is null
     or e.edition_id::text=p_edition_id;
end;
$$;

revoke all on function public.chart_get_run_origin_review_queue_v1(text)
from PUBLIC, anon, service_role;
grant execute on function public.chart_get_run_origin_review_queue_v1(text)
to authenticated;

revoke all on function public.chart_get_family_ingest_presets_v1()
from PUBLIC, anon, service_role;
grant execute on function public.chart_get_family_ingest_presets_v1()
to authenticated;

revoke all on function public.chart_get_weekly_backfill_plan_v1(text,date,date)
from PUBLIC, anon, service_role;
grant execute on function public.chart_get_weekly_backfill_plan_v1(text,date,date)
to authenticated;

revoke all on function public.chart_reset_run_after_origin_resolution_v1(text)
from PUBLIC, anon, service_role;
grant execute on function public.chart_reset_run_after_origin_resolution_v1(text)
to authenticated;

revoke all on function public.chart_upsert_family_ingest_preset_v1(text,jsonb)
from PUBLIC, anon, service_role;
grant execute on function public.chart_upsert_family_ingest_preset_v1(text,jsonb)
to authenticated;

revoke all on function public.chart_get_entry_registry_identity_v1(text)
from PUBLIC, anon, service_role;
grant execute on function public.chart_get_entry_registry_identity_v1(text)
to authenticated;

revoke all on function public.chart_get_run_origin_review_queue(text)
from PUBLIC, anon, authenticated, service_role;

revoke all on function public.chart_get_family_ingest_presets()
from PUBLIC, anon, authenticated, service_role;

revoke all on function public.chart_get_weekly_backfill_plan(text,date,date)
from PUBLIC, anon, authenticated, service_role;

revoke all on function public.chart_reset_run_after_origin_resolution(text)
from PUBLIC, anon, authenticated, service_role;

revoke all on function public.chart_upsert_family_ingest_preset(text,jsonb,text)
from PUBLIC, anon, authenticated, service_role;

revoke all on function public.chart_set_artist_origin_for_charts(
  uuid,text,text,text,text,text
)
from PUBLIC, anon, authenticated, service_role;

revoke all on function public.chart_create_artist_origin_shell(
  text,text,text,text,text
)
from PUBLIC, anon, authenticated, service_role;

commit;
