-- Phase 5B Migration 227: resolve the final three Top 50 artist credits.
--
-- Reuses active Dyana Cods and Soundkraft identities.
-- Repairs and activates the existing Liboi draft shell.
-- No new Registry Artist is created.

begin;

do $m227$
declare
  v_playlist_id uuid;
  v_dyana_id uuid;
  v_soundkraft_id uuid;
  v_liboi_id uuid;
  v_updated integer;
begin
  select id
  into v_playlist_id
  from public.wk_playlists
  where slug = 'top-50-kenyan-songs-of-2025'
  for update;

  if v_playlist_id is null then
    raise exception
      'STOP: Top 50 Kenyan Songs Of 2025 Playlist is missing.';
  end if;

  select id
  into v_dyana_id
  from public.registry_artists
  where slug = 'dyana-cods'
    and display_name = 'Dyana Cods'
    and status = 'active';

  if v_dyana_id is null then
    raise exception
      'STOP: Active Dyana Cods Registry identity is missing.';
  end if;

  select id
  into v_soundkraft_id
  from public.registry_artists
  where slug = 'soundkraft'
    and display_name = 'Soundkraft'
    and status = 'active';

  if v_soundkraft_id is null then
    raise exception
      'STOP: Active Soundkraft Registry identity is missing.';
  end if;

  select id
  into v_liboi_id
  from public.registry_artists
  where slug = 'liboi__trashed'
    and display_name = 'Liboi'
    and status = 'draft'
  for update;

  if v_liboi_id is null then
    raise exception
      'STOP: Expected Liboi draft shell was not found.';
  end if;

  if exists (
    select 1
    from public.registry_artists
    where lower(slug) = 'liboi'
      and id <> v_liboi_id
      and status <> 'archived'
  ) then
    raise exception
      'STOP: A competing non-archived liboi slug already exists.';
  end if;

  if (
    select count(*)::integer
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'needs_review'
      and credit.resolution_mode = 'unresolved'
      and credit.registry_artist_id is null
      and credit.observed_name in (
        'Dyana Cods',
        'Liboi',
        'Soundkraft'
      )
  ) <> 3 then
    raise exception
      'STOP: Expected exactly the three known unresolved credits.';
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
      and credit.resolution_mode = 'unresolved'
      and credit.observed_name not in (
        'Dyana Cods',
        'Liboi',
        'Soundkraft'
      )
  ) then
    raise exception
      'STOP: Unexpected unresolved Top 50 artist credit exists.';
  end if;

  update public.registry_artists
  set
    slug = 'liboi',
    status = 'active',
    metadata =
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'phase5b_top50_artist_resolution',
        jsonb_build_object(
          'playlist_slug',
            'top-50-kenyan-songs-of-2025',
          'action',
            'activated_existing_draft',
          'previous_slug',
            'liboi__trashed',
          'resolved_at',
            now()
        )
      ),
    updated_at = now()
  where id = v_liboi_id;

  with mapping(observed_name, artist_id) as (
    values
      ('Dyana Cods'::text, v_dyana_id),
      ('Liboi'::text, v_liboi_id),
      ('Soundkraft'::text, v_soundkraft_id)
  ),
  updated as (
    update public.registry_provider_track_suggestion_artists credit
    set
      resolution_mode = 'existing_artist',
      registry_artist_id = mapping.artist_id
    from public.registry_provider_track_suggestions suggestion,
         mapping
    where suggestion.id = credit.suggestion_id
      and suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'needs_review'
      and credit.resolution_mode = 'unresolved'
      and credit.registry_artist_id is null
      and credit.observed_name = mapping.observed_name
    returning credit.id
  )
  select count(*)::integer
  into v_updated
  from updated;

  if v_updated <> 3 then
    raise exception
      'STOP: Expected to resolve exactly three artist credits, resolved %.',
      v_updated;
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
      and credit.resolution_mode <> 'existing_artist'
  ) then
    raise exception
      'STOP: Top 50 still contains non-existing-artist credit resolution modes.';
  end if;

  if (
    select count(*)::integer
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    join public.registry_artists artist
      on artist.id = credit.registry_artist_id
     and artist.status = 'active'
    where suggestion.source_playlist_id = v_playlist_id
      and credit.resolution_mode = 'existing_artist'
  ) <> 107 then
    raise exception
      'STOP: Expected all 107 Top 50 artist credits resolved to active Registry artists.';
  end if;
end;
$m227$;

commit;
