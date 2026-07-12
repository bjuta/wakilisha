-- Living Memory public read contract.
-- Editorial opener data is stored on Registry entity rows, not bundled in the frontend.

alter table public.registry_artists
  add column if not exists living_memory_editorial_opener text,
  add column if not exists living_memory_public_prompt text,
  add column if not exists living_memory_editorial_label text,
  add column if not exists living_memory_status text not null default 'draft',
  add column if not exists living_memory_updated_at timestamptz;

alter table public.registry_releases
  add column if not exists living_memory_editorial_opener text,
  add column if not exists living_memory_public_prompt text,
  add column if not exists living_memory_editorial_label text,
  add column if not exists living_memory_status text not null default 'draft',
  add column if not exists living_memory_updated_at timestamptz;

alter table public.registry_tracks
  add column if not exists living_memory_editorial_opener text,
  add column if not exists living_memory_public_prompt text,
  add column if not exists living_memory_editorial_label text,
  add column if not exists living_memory_status text not null default 'draft',
  add column if not exists living_memory_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'registry_artists_living_memory_status_check') then
    alter table public.registry_artists
      add constraint registry_artists_living_memory_status_check
      check (living_memory_status in ('draft', 'published', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'registry_releases_living_memory_status_check') then
    alter table public.registry_releases
      add constraint registry_releases_living_memory_status_check
      check (living_memory_status in ('draft', 'published', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'registry_tracks_living_memory_status_check') then
    alter table public.registry_tracks
      add constraint registry_tracks_living_memory_status_check
      check (living_memory_status in ('draft', 'published', 'archived'));
  end if;
end $$;

create or replace function public.get_public_living_memory(
  p_entity_type text,
  p_entity_id text default null,
  p_entity_slug text default null
)
returns table (
  entity_type text,
  entity_id uuid,
  entity_slug text,
  editorial_opener text,
  public_prompt text,
  editorial_label text,
  status text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_entity_type = 'artist' then
    return query
    select
      'artist'::text,
      a.id,
      a.slug,
      a.living_memory_editorial_opener,
      a.living_memory_public_prompt,
      a.living_memory_editorial_label,
      a.living_memory_status,
      a.living_memory_updated_at
    from public.registry_artists a
    where a.status = 'active'
      and a.living_memory_status = 'published'
      and nullif(trim(a.living_memory_editorial_opener), '') is not null
      and (
        (p_entity_id is not null and a.id::text = p_entity_id)
        or (p_entity_slug is not null and a.slug = p_entity_slug)
      )
    limit 1;
  elsif p_entity_type = 'release' then
    return query
    select
      'release'::text,
      r.id,
      r.slug,
      r.living_memory_editorial_opener,
      r.living_memory_public_prompt,
      r.living_memory_editorial_label,
      r.living_memory_status,
      r.living_memory_updated_at
    from public.registry_releases r
    where r.status in ('active', 'draft')
      and r.living_memory_status = 'published'
      and nullif(trim(r.living_memory_editorial_opener), '') is not null
      and (
        (p_entity_id is not null and r.id::text = p_entity_id)
        or (p_entity_slug is not null and r.slug = p_entity_slug)
      )
    limit 1;
  elsif p_entity_type = 'track' then
    return query
    select
      'track'::text,
      t.id,
      t.slug,
      t.living_memory_editorial_opener,
      t.living_memory_public_prompt,
      t.living_memory_editorial_label,
      t.living_memory_status,
      t.living_memory_updated_at
    from public.registry_tracks t
    where t.status in ('active', 'needs_review', 'draft')
      and t.living_memory_status = 'published'
      and nullif(trim(t.living_memory_editorial_opener), '') is not null
      and (
        (p_entity_id is not null and t.id::text = p_entity_id)
        or (p_entity_slug is not null and t.slug = p_entity_slug)
      )
    limit 1;
  else
    return;
  end if;
end;
$$;

revoke all on function public.get_public_living_memory(text, text, text) from public;
grant execute on function public.get_public_living_memory(text, text, text) to anon, authenticated;
