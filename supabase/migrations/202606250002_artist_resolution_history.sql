-- Durable admin history for artist merge/decouple attempts.
-- This is intentionally append-only so admins can audit both successful and failed cleanup decisions.

create extension if not exists pgcrypto;

create table if not exists public.registry_artist_resolution_events (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('alias_merge', 'artist_merge', 'artist_decouple')),
  status text not null check (status in ('success', 'failed', 'cancelled')),
  source_artist_id uuid,
  source_artist_slug text,
  source_artist_name text,
  source_snapshot jsonb not null default '{}'::jsonb,
  replacement_artists jsonb not null default '[]'::jsonb,
  track_links jsonb not null default '[]'::jsonb,
  release_links jsonb not null default '[]'::jsonb,
  chart_entries jsonb not null default '[]'::jsonb,
  note text,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  actor_id uuid default auth.uid(),
  actor_label text default 'admin',
  created_at timestamptz not null default now()
);

create index if not exists registry_artist_resolution_events_created_idx
  on public.registry_artist_resolution_events (created_at desc);

create index if not exists registry_artist_resolution_events_source_idx
  on public.registry_artist_resolution_events (source_artist_id, created_at desc);

create index if not exists registry_artist_resolution_events_status_idx
  on public.registry_artist_resolution_events (status, created_at desc);

alter table public.registry_artist_resolution_events enable row level security;

drop policy if exists registry_artist_resolution_events_admin_read
  on public.registry_artist_resolution_events;

create policy registry_artist_resolution_events_admin_read
  on public.registry_artist_resolution_events
  for select
  to authenticated
  using (public.current_user_has_capability('manage_registry'));

drop policy if exists registry_artist_resolution_events_admin_insert
  on public.registry_artist_resolution_events;

create policy registry_artist_resolution_events_admin_insert
  on public.registry_artist_resolution_events
  for insert
  to authenticated
  with check (public.current_user_has_capability('manage_registry'));

grant select, insert on public.registry_artist_resolution_events to authenticated;

create or replace function public.admin_log_artist_resolution_event(
  p_action text,
  p_status text,
  p_source_artist_id uuid default null,
  p_source_snapshot jsonb default '{}'::jsonb,
  p_replacement_artists jsonb default '[]'::jsonb,
  p_track_links jsonb default '[]'::jsonb,
  p_release_links jsonb default '[]'::jsonb,
  p_chart_entries jsonb default '[]'::jsonb,
  p_note text default null,
  p_error_message text default null,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_status text;
  v_source_snapshot jsonb;
  v_event_id uuid;
  v_source_artist_id uuid;
  v_source_artist_slug text;
  v_source_artist_name text;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  v_action := nullif(trim(coalesce(p_action, '')), '');
  v_status := nullif(trim(coalesce(p_status, '')), '');

  if v_action not in ('alias_merge', 'artist_merge', 'artist_decouple') then
    raise exception 'invalid_resolution_action';
  end if;

  if v_status not in ('success', 'failed', 'cancelled') then
    raise exception 'invalid_resolution_status';
  end if;

  v_source_snapshot := coalesce(p_source_snapshot, '{}'::jsonb);
  v_source_artist_id := coalesce(
    p_source_artist_id,
    nullif(v_source_snapshot->>'artist_id', '')::uuid
  );
  v_source_artist_slug := nullif(coalesce(
    v_source_snapshot->>'artist_slug',
    v_source_snapshot->>'slug'
  ), '');
  v_source_artist_name := nullif(coalesce(
    v_source_snapshot->>'display_name',
    v_source_snapshot->>'name'
  ), '');

  if v_source_artist_id is not null then
    select
      coalesce(v_source_artist_slug, a.slug),
      coalesce(v_source_artist_name, a.display_name)
    into v_source_artist_slug, v_source_artist_name
    from public.registry_artists a
    where a.id = v_source_artist_id
    limit 1;
  end if;

  insert into public.registry_artist_resolution_events (
    action,
    status,
    source_artist_id,
    source_artist_slug,
    source_artist_name,
    source_snapshot,
    replacement_artists,
    track_links,
    release_links,
    chart_entries,
    note,
    error_message,
    result
  )
  values (
    v_action,
    v_status,
    v_source_artist_id,
    v_source_artist_slug,
    v_source_artist_name,
    v_source_snapshot,
    coalesce(p_replacement_artists, '[]'::jsonb),
    coalesce(p_track_links, '[]'::jsonb),
    coalesce(p_release_links, '[]'::jsonb),
    coalesce(p_chart_entries, '[]'::jsonb),
    nullif(p_note, ''),
    nullif(p_error_message, ''),
    coalesce(p_result, '{}'::jsonb)
  )
  returning id into v_event_id;

  return jsonb_build_object('eventId', v_event_id);
end;
$$;

create or replace function public.admin_get_artist_resolution_history(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit integer;
  v_events jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'), false) then
    raise exception 'insufficient_privilege';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 100), 1), 300);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'action', e.action,
        'status', e.status,
        'source_artist_id', e.source_artist_id,
        'source_artist_slug', e.source_artist_slug,
        'source_artist_name', e.source_artist_name,
        'source_snapshot', e.source_snapshot,
        'replacement_artists', e.replacement_artists,
        'track_links', e.track_links,
        'release_links', e.release_links,
        'chart_entries', e.chart_entries,
        'note', e.note,
        'error_message', e.error_message,
        'result', e.result,
        'actor_id', e.actor_id,
        'actor_label', e.actor_label,
        'created_at', e.created_at
      )
      order by e.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select *
    from public.registry_artist_resolution_events
    order by created_at desc
    limit v_limit
  ) e;

  return v_events;
end;
$$;

grant execute on function public.admin_log_artist_resolution_event(text, text, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb) to authenticated;
grant execute on function public.admin_get_artist_resolution_history(integer) to authenticated;
