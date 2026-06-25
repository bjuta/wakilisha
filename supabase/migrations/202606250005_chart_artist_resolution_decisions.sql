create extension if not exists pgcrypto;

create table if not exists public.chart_artist_resolution_decisions (
  id uuid primary key default gen_random_uuid(),
  chart_entry_id text not null unique,
  edition_id text not null,
  program_id text,
  edition_date date,
  rank integer,
  track_title text,
  raw_artist_name text,
  artist_slug text,
  canonical_artist_id text,
  decision_type text not null check (decision_type in ('accepted_as_group', 'split_plan', 'alias_plan', 'needs_follow_up')),
  decision_status text not null default 'draft' check (decision_status in ('draft', 'ready', 'resolved', 'superseded')),
  parsed_tokens jsonb not null default '[]'::jsonb,
  selected_artists jsonb not null default '[]'::jsonb,
  note text,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chart_artist_resolution_decisions_edition_idx
  on public.chart_artist_resolution_decisions (edition_id, updated_at desc);

create index if not exists chart_artist_resolution_decisions_status_idx
  on public.chart_artist_resolution_decisions (decision_status, updated_at desc);

create index if not exists chart_artist_resolution_decisions_type_idx
  on public.chart_artist_resolution_decisions (decision_type, updated_at desc);

alter table public.chart_artist_resolution_decisions enable row level security;

drop policy if exists chart_artist_resolution_decisions_admin_read
  on public.chart_artist_resolution_decisions;

create policy chart_artist_resolution_decisions_admin_read
  on public.chart_artist_resolution_decisions
  for select
  to authenticated
  using (
    public.current_user_has_capability('manage_charts')
    or public.current_user_has_capability('manage_registry')
    or public.current_user_has_capability('view_charts_admin')
    or public.current_user_is_administrator()
  );

drop policy if exists chart_artist_resolution_decisions_admin_write
  on public.chart_artist_resolution_decisions;

create policy chart_artist_resolution_decisions_admin_write
  on public.chart_artist_resolution_decisions
  for all
  to authenticated
  using (
    public.current_user_has_capability('manage_charts')
    or public.current_user_has_capability('manage_registry')
    or public.current_user_is_administrator()
  )
  with check (
    public.current_user_has_capability('manage_charts')
    or public.current_user_has_capability('manage_registry')
    or public.current_user_is_administrator()
  );

grant select, insert, update, delete on public.chart_artist_resolution_decisions to authenticated;

create or replace function public.chart_artist_resolution_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chart_artist_resolution_decisions_touch_updated_at
  on public.chart_artist_resolution_decisions;

create trigger chart_artist_resolution_decisions_touch_updated_at
  before update on public.chart_artist_resolution_decisions
  for each row execute function public.chart_artist_resolution_touch_updated_at();

create or replace function public.admin_get_chart_artist_resolution_decisions(
  p_edition_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rows jsonb;
begin
  if not (
    coalesce(public.current_user_has_capability('view_charts_admin'), false)
    or coalesce(public.current_user_has_capability('manage_charts'), false)
    or coalesce(public.current_user_has_capability('manage_registry'), false)
    or coalesce(public.current_user_is_administrator(), false)
  ) then
    raise exception 'insufficient_privilege';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'chart_entry_id', d.chart_entry_id,
        'edition_id', d.edition_id,
        'program_id', d.program_id,
        'decision_type', d.decision_type,
        'decision_status', d.decision_status,
        'parsed_tokens', d.parsed_tokens,
        'selected_artists', d.selected_artists,
        'note', d.note,
        'actor_id', d.actor_id,
        'created_at', d.created_at,
        'updated_at', d.updated_at
      )
      order by d.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.chart_artist_resolution_decisions d
  where d.edition_id = p_edition_id;

  return v_rows;
end;
$$;

create or replace function public.admin_upsert_chart_artist_resolution_decision(
  p_chart_entry_id text,
  p_decision_type text,
  p_decision_status text default 'draft',
  p_parsed_tokens jsonb default '[]'::jsonb,
  p_selected_artists jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
  v_decision_type text;
  v_decision_status text;
  v_decision_id uuid;
begin
  if not (
    coalesce(public.current_user_has_capability('manage_charts'), false)
    or coalesce(public.current_user_has_capability('manage_registry'), false)
    or coalesce(public.current_user_is_administrator(), false)
  ) then
    raise exception 'insufficient_privilege';
  end if;

  v_decision_type := nullif(trim(coalesce(p_decision_type, '')), '');
  v_decision_status := nullif(trim(coalesce(p_decision_status, '')), '');

  if v_decision_type not in ('accepted_as_group', 'split_plan', 'alias_plan', 'needs_follow_up') then
    raise exception 'invalid_decision_type';
  end if;

  if v_decision_status not in ('draft', 'ready', 'resolved', 'superseded') then
    raise exception 'invalid_decision_status';
  end if;

  select
    e.id::text as chart_entry_id,
    e.edition_id::text as edition_id,
    ed.program_id::text as program_id,
    ed.edition_date,
    e.rank,
    e.track_title,
    e.artist_name,
    e.artist_slug,
    e.canonical_artist_id
  into v_entry
  from public.wk_chart_entries_v2 e
  join public.wk_chart_editions_v2 ed on ed.id::text = e.edition_id::text
  where e.id::text = p_chart_entry_id
  limit 1;

  if v_entry.chart_entry_id is null then
    raise exception 'chart_entry_not_found';
  end if;

  insert into public.chart_artist_resolution_decisions (
    chart_entry_id,
    edition_id,
    program_id,
    edition_date,
    rank,
    track_title,
    raw_artist_name,
    artist_slug,
    canonical_artist_id,
    decision_type,
    decision_status,
    parsed_tokens,
    selected_artists,
    note,
    actor_id
  )
  values (
    v_entry.chart_entry_id,
    v_entry.edition_id,
    v_entry.program_id,
    v_entry.edition_date,
    v_entry.rank,
    v_entry.track_title,
    v_entry.artist_name,
    v_entry.artist_slug,
    v_entry.canonical_artist_id,
    v_decision_type,
    v_decision_status,
    coalesce(p_parsed_tokens, '[]'::jsonb),
    coalesce(p_selected_artists, '[]'::jsonb),
    nullif(p_note, ''),
    auth.uid()
  )
  on conflict (chart_entry_id) do update
  set
    program_id = excluded.program_id,
    edition_date = excluded.edition_date,
    rank = excluded.rank,
    track_title = excluded.track_title,
    raw_artist_name = excluded.raw_artist_name,
    artist_slug = excluded.artist_slug,
    canonical_artist_id = excluded.canonical_artist_id,
    decision_type = excluded.decision_type,
    decision_status = excluded.decision_status,
    parsed_tokens = excluded.parsed_tokens,
    selected_artists = excluded.selected_artists,
    note = excluded.note,
    actor_id = auth.uid(),
    updated_at = now()
  returning id into v_decision_id;

  return jsonb_build_object(
    'decisionId', v_decision_id,
    'chartEntryId', v_entry.chart_entry_id,
    'editionId', v_entry.edition_id,
    'decisionType', v_decision_type,
    'decisionStatus', v_decision_status
  );
end;
$$;

grant execute on function public.admin_get_chart_artist_resolution_decisions(text) to authenticated;
grant execute on function public.admin_upsert_chart_artist_resolution_decision(text, text, text, jsonb, jsonb, text) to authenticated;
