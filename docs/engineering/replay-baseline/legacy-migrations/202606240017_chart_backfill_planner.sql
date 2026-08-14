create table if not exists public.chart_ingest_family_presets (
  family_id text primary key,
  config_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.chart_upsert_family_ingest_preset(
  p_family_id text,
  p_config_json jsonb,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.chart_ingest_family_presets%rowtype;
begin
  if nullif(trim(p_family_id), '') is null then
    raise exception 'family_id_required';
  end if;

  insert into public.chart_ingest_family_presets (
    family_id,
    config_json,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    p_family_id,
    coalesce(p_config_json, '{}'::jsonb),
    p_actor_user_id,
    p_actor_user_id,
    now(),
    now()
  )
  on conflict (family_id) do update
  set
    config_json = excluded.config_json,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning *
  into v_row;

  return jsonb_build_object(
    'familyId', v_row.family_id,
    'config', v_row.config_json,
    'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.chart_get_family_ingest_presets()
returns table (
  family_id text,
  config_json jsonb,
  updated_at timestamptz,
  updated_by text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    family_id,
    config_json,
    updated_at,
    updated_by
  from public.chart_ingest_family_presets
  order by family_id;
$$;

create or replace function public.chart_get_weekly_backfill_plan(
  p_family_id text,
  p_start_date date,
  p_end_date date
)
returns table (
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
language sql
stable
security definer
set search_path = public
as $$
  with preset as (
    select
      family_id,
      config_json,
      coalesce(
        nullif(config_json->>'releaseWindowStart', '')::date,
        '2024-01-01'::date
      ) as release_window_start
    from public.chart_ingest_family_presets
    where family_id = p_family_id
  ),
  mondays as (
    select generate_series(
      date_trunc('week', p_start_date::timestamp)::date,
      date_trunc('week', p_end_date::timestamp)::date,
      interval '7 days'
    )::date as edition_date
  ),
  latest_runs as (
    select distinct on (r.edition_date)
      r.edition_date::date as edition_date,
      r.id::text as run_id,
      r.status as run_status,
      r.updated_at
    from public.chart_ingest_runs r
    where r.program_id::text = p_family_id
      and r.edition_date::date between p_start_date and p_end_date
    order by r.edition_date, r.updated_at desc
  ),
  editions as (
    select distinct on (e.edition_date)
      e.edition_date::date as edition_date,
      e.id::text as edition_id,
      e.status,
      e.entry_count
    from public.wk_chart_editions_v2 e
    where e.program_id::text = p_family_id
      and e.edition_date::date between p_start_date and p_end_date
    order by e.edition_date, e.updated_at desc
  )
  select
    m.edition_date,
    coalesce(p.release_window_start, '2024-01-01'::date) as release_window_start,
    (m.edition_date - interval '1 day')::date as release_window_end,
    e.edition_id as existing_edition_id,
    e.status as existing_edition_status,
    e.entry_count as existing_entry_count,
    lr.run_id as latest_run_id,
    lr.run_status as latest_run_status,
    lr.updated_at as latest_run_updated_at,
    case
      when e.status = 'published' then 'published'
      when e.status is not null then 'edition_exists'
      when lr.run_status in ('dry_run_complete', 'ready_to_commit') then 'open_run'
      when lr.run_status in ('running', 'queued') then 'wait_for_run'
      when lr.run_status in ('failed', 'cancelled') then 'rerun'
      else 'create_run'
    end as recommended_action
  from mondays m
  left join preset p on true
  left join editions e on e.edition_date = m.edition_date
  left join latest_runs lr on lr.edition_date = m.edition_date
  order by m.edition_date;
$$;

grant select, insert, update on public.chart_ingest_family_presets to service_role;
grant execute on function public.chart_upsert_family_ingest_preset(text, jsonb, text) to service_role;
grant execute on function public.chart_get_family_ingest_presets() to service_role;
grant execute on function public.chart_get_weekly_backfill_plan(text, date, date) to service_role;
