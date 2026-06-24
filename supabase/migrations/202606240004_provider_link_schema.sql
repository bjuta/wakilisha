-- WAKILISHA provider link substrate.
-- Durable provider identity and playback metadata for Spotify, Apple Music, YouTube, Boomplay, Audiomack, etc.

create extension if not exists pgcrypto;

create table if not exists public.registry_track_provider_links (
  id uuid primary key default gen_random_uuid(),

  track_id uuid not null references public.registry_tracks(id) on delete cascade,

  provider_key text not null check (
    provider_key = lower(provider_key)
    and provider_key ~ '^[a-z0-9_]+$'
  ),
  provider_track_id text not null,
  provider_release_id text,
  provider_artist_ids text[] not null default '{}'::text[],

  isrc text,
  upc text,

  preview_url text,
  artwork_url text,
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  storefront text,

  match_method text not null default 'unknown' check (
    match_method in (
      'isrc',
      'isrc_duration',
      'upc_track_number',
      'exact_title_artist',
      'fuzzy_title_artist',
      'manual',
      'source_import',
      'unknown'
    )
  ),
  match_confidence numeric(5,4) not null default 0 check (
    match_confidence >= 0 and match_confidence <= 1
  ),
  match_status text not null default 'matched' check (
    match_status in ('matched', 'needs_review', 'rejected', 'unavailable', 'stale')
  ),

  raw_payload jsonb not null default '{}'::jsonb,

  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_track_provider_links_track_provider_track_key
    unique (track_id, provider_key, provider_track_id),

  constraint registry_track_provider_links_provider_identity_key
    unique (provider_key, provider_track_id)
);

create index if not exists registry_track_provider_links_track_idx
  on public.registry_track_provider_links (track_id);

create index if not exists registry_track_provider_links_provider_idx
  on public.registry_track_provider_links (provider_key, provider_track_id);

create index if not exists registry_track_provider_links_isrc_idx
  on public.registry_track_provider_links (provider_key, isrc)
  where isrc is not null;

create index if not exists registry_track_provider_links_upc_idx
  on public.registry_track_provider_links (provider_key, upc)
  where upc is not null;

create index if not exists registry_track_provider_links_public_playback_idx
  on public.registry_track_provider_links (track_id, provider_key, match_status, match_confidence desc)
  where match_status = 'matched';

alter table public.registry_track_provider_links enable row level security;

drop policy if exists registry_track_provider_links_public_matched_read
  on public.registry_track_provider_links;

create policy registry_track_provider_links_public_matched_read
  on public.registry_track_provider_links
  for select
  to anon, authenticated
  using (match_status = 'matched');

drop policy if exists registry_track_provider_links_admin_manage
  on public.registry_track_provider_links;

create policy registry_track_provider_links_admin_manage
  on public.registry_track_provider_links
  for all
  to authenticated
  using (public.current_user_has_capability('manage_registry'))
  with check (public.current_user_has_capability('manage_registry'));

grant select on public.registry_track_provider_links to anon, authenticated;
grant insert, update, delete on public.registry_track_provider_links to authenticated;

create or replace function public.registry_get_public_track_playback_providers(
  p_track_ids uuid[],
  p_provider_key text default 'apple_music'
)
returns table (
  track_id uuid,
  provider_key text,
  provider_track_id text,
  provider_release_id text,
  isrc text,
  upc text,
  preview_url text,
  artwork_url text,
  duration_ms integer,
  storefront text,
  match_method text,
  match_confidence numeric,
  last_checked_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (l.track_id)
    l.track_id,
    l.provider_key,
    l.provider_track_id,
    l.provider_release_id,
    l.isrc,
    l.upc,
    l.preview_url,
    l.artwork_url,
    l.duration_ms,
    l.storefront,
    l.match_method,
    l.match_confidence,
    l.last_checked_at
  from public.registry_track_provider_links l
  where l.track_id = any(coalesce(p_track_ids, '{}'::uuid[]))
    and l.provider_key = lower(coalesce(nullif(trim(p_provider_key), ''), 'apple_music'))
    and l.match_status = 'matched'
  order by
    l.track_id,
    l.match_confidence desc,
    l.last_checked_at desc,
    l.created_at desc;
$$;

grant execute on function public.registry_get_public_track_playback_providers(uuid[], text) to anon, authenticated;

create or replace function public.registry_get_track_provider_links(
  p_track_id uuid default null,
  p_provider_key text default null,
  p_provider_track_id text default null,
  p_isrc text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  track_id uuid,
  provider_key text,
  provider_track_id text,
  provider_release_id text,
  provider_artist_ids text[],
  isrc text,
  upc text,
  preview_url text,
  artwork_url text,
  duration_ms integer,
  storefront text,
  match_method text,
  match_confidence numeric,
  match_status text,
  raw_payload jsonb,
  last_checked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.current_user_has_capability('manage_registry') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    l.id,
    l.track_id,
    l.provider_key,
    l.provider_track_id,
    l.provider_release_id,
    l.provider_artist_ids,
    l.isrc,
    l.upc,
    l.preview_url,
    l.artwork_url,
    l.duration_ms,
    l.storefront,
    l.match_method,
    l.match_confidence,
    l.match_status,
    l.raw_payload,
    l.last_checked_at,
    l.created_at,
    l.updated_at
  from public.registry_track_provider_links l
  where (p_track_id is null or l.track_id = p_track_id)
    and (p_provider_key is null or l.provider_key = lower(p_provider_key))
    and (p_provider_track_id is null or l.provider_track_id = p_provider_track_id)
    and (p_isrc is null or l.isrc = p_isrc)
  order by l.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 250);
end;
$$;

revoke execute on function public.registry_get_track_provider_links(uuid, text, text, text, integer)
  from public, anon, authenticated;

grant execute on function public.registry_get_track_provider_links(uuid, text, text, text, integer)
  to authenticated;

create or replace function public.registry_upsert_track_provider_link(
  p_track_id uuid,
  p_provider_key text,
  p_provider_track_id text,
  p_provider_release_id text default null,
  p_provider_artist_ids text[] default null,
  p_isrc text default null,
  p_upc text default null,
  p_preview_url text default null,
  p_artwork_url text default null,
  p_duration_ms integer default null,
  p_storefront text default null,
  p_match_method text default 'unknown',
  p_match_confidence numeric default 0,
  p_match_status text default 'matched',
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_key text := lower(nullif(trim(coalesce(p_provider_key, '')), ''));
  v_provider_track_id text := nullif(trim(coalesce(p_provider_track_id, '')), '');
  v_link public.registry_track_provider_links%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.current_user_has_capability('manage_registry') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_track_id is null then
    raise exception 'track_id is required' using errcode = '22023';
  end if;

  if v_provider_key is null then
    raise exception 'provider_key is required' using errcode = '22023';
  end if;

  if v_provider_track_id is null then
    raise exception 'provider_track_id is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.registry_tracks where id = p_track_id) then
    raise exception 'Track not found' using errcode = 'P0002';
  end if;

  insert into public.registry_track_provider_links (
    track_id,
    provider_key,
    provider_track_id,
    provider_release_id,
    provider_artist_ids,
    isrc,
    upc,
    preview_url,
    artwork_url,
    duration_ms,
    storefront,
    match_method,
    match_confidence,
    match_status,
    raw_payload,
    last_checked_at,
    updated_at
  )
  values (
    p_track_id,
    v_provider_key,
    v_provider_track_id,
    nullif(trim(coalesce(p_provider_release_id, '')), ''),
    coalesce(p_provider_artist_ids, '{}'::text[]),
    nullif(trim(coalesce(p_isrc, '')), ''),
    nullif(trim(coalesce(p_upc, '')), ''),
    nullif(trim(coalesce(p_preview_url, '')), ''),
    nullif(trim(coalesce(p_artwork_url, '')), ''),
    p_duration_ms,
    lower(nullif(trim(coalesce(p_storefront, '')), '')),
    coalesce(nullif(trim(p_match_method), ''), 'unknown'),
    least(greatest(coalesce(p_match_confidence, 0), 0), 1),
    coalesce(nullif(trim(p_match_status), ''), 'matched'),
    coalesce(p_raw_payload, '{}'::jsonb),
    now(),
    now()
  )
  on conflict (track_id, provider_key, provider_track_id)
  do update set
    provider_release_id = excluded.provider_release_id,
    provider_artist_ids = excluded.provider_artist_ids,
    isrc = excluded.isrc,
    upc = excluded.upc,
    preview_url = excluded.preview_url,
    artwork_url = excluded.artwork_url,
    duration_ms = excluded.duration_ms,
    storefront = excluded.storefront,
    match_method = excluded.match_method,
    match_confidence = excluded.match_confidence,
    match_status = excluded.match_status,
    raw_payload = excluded.raw_payload,
    last_checked_at = now(),
    updated_at = now()
  returning * into v_link;

  return to_jsonb(v_link);
end;
$$;

revoke execute on function public.registry_upsert_track_provider_link(
  uuid, text, text, text, text[], text, text, text, text, integer, text, text, numeric, text, jsonb
) from public, anon, authenticated;

grant execute on function public.registry_upsert_track_provider_link(
  uuid, text, text, text, text[], text, text, text, text, integer, text, text, numeric, text, jsonb
) to authenticated;
