-- Phase 5B M227 verifier: all Top 50 artist credits resolve to active Registry artists.

do $verify_m227$
declare
  v_playlist_id uuid;
  v_total integer;
  v_existing integer;
  v_active_bound integer;
  v_unresolved integer;
  v_new_artist integer;
begin
  select id
  into v_playlist_id
  from public.wk_playlists
  where slug = 'top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    raise exception
      'FAIL: Top 50 Playlist is missing.';
  end if;

  select count(*)::integer
  into v_total
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  where suggestion.source_playlist_id = v_playlist_id;

  select count(*)::integer
  into v_existing
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  where suggestion.source_playlist_id = v_playlist_id
    and credit.resolution_mode = 'existing_artist'
    and credit.registry_artist_id is not null;

  select count(*)::integer
  into v_active_bound
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  join public.registry_artists artist
    on artist.id = credit.registry_artist_id
   and artist.status = 'active'
  where suggestion.source_playlist_id = v_playlist_id
    and credit.resolution_mode = 'existing_artist';

  select count(*)::integer
  into v_unresolved
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  where suggestion.source_playlist_id = v_playlist_id
    and credit.resolution_mode = 'unresolved';

  select count(*)::integer
  into v_new_artist
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  where suggestion.source_playlist_id = v_playlist_id
    and credit.resolution_mode = 'new_artist';

  if v_total <> 107
     or v_existing <> 107
     or v_active_bound <> 107
     or v_unresolved <> 0
     or v_new_artist <> 0
  then
    raise exception
      'FAIL: Top 50 artist resolution mismatch. total %, existing %, active %, unresolved %, new %.',
      v_total,
      v_existing,
      v_active_bound,
      v_unresolved,
      v_new_artist;
  end if;

  if not exists (
    select 1
    from public.registry_artists
    where slug = 'liboi'
      and display_name = 'Liboi'
      and status = 'active'
  ) then
    raise exception
      'FAIL: Liboi was not activated at canonical slug liboi.';
  end if;

  if exists (
    select 1
    from public.registry_artists
    where slug = 'liboi__trashed'
      and status <> 'archived'
  ) then
    raise exception
      'FAIL: Legacy Liboi trashed slug remains non-archived.';
  end if;
end;
$verify_m227$;

select jsonb_build_object(
  'verification', 'PASS',
  'top50_artist_credits', 107,
  'existing_artist_credits', 107,
  'active_bound_credits', 107,
  'unresolved_credits', 0,
  'new_artist_credits', 0,
  'liboi_status', (
    select status
    from public.registry_artists
    where slug = 'liboi'
      and display_name = 'Liboi'
    limit 1
  )
) as phase_5b_top50_remaining_artist_resolution_acceptance;
