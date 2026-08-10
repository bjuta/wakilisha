do $verify$
declare
  v_playlist_id uuid;
  v_parity integer;
begin
  if to_regprocedure(
    'public.sync_registry_track_intake_artist_credits(uuid,uuid)'
  ) is null then
    raise exception
      'FAIL: generic existing-Track artist synchronization helper is missing.';
  end if;

  if position(
    'sync_registry_track_intake_artist_credits'
    in pg_get_functiondef(
      'public.admin_resolve_registry_track_intake(uuid,uuid,text)'::regprocedure
    )
  ) = 0 then
    raise exception
      'FAIL: existing-Track resolver does not synchronize reviewed artist credits.';
  end if;

  select id
  into v_playlist_id
  from public.wk_playlists
  where slug = 'top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    return;
  end if;

  with reviewed as (
    select
      suggestion.canonical_track_id as track_id,
      credit.registry_artist_id as artist_id,
      credit.credit_role,
      credit.credit_order
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
  )
  select count(*)::integer
  into v_parity
  from reviewed
  join public.registry_track_artists track_artist
    on track_artist.track_id = reviewed.track_id
   and track_artist.artist_id = reviewed.artist_id
   and track_artist.status = 'active'
  where (
    (
      reviewed.credit_role = 'primary'
      and track_artist.role = 'primary_artist'
      and track_artist.is_primary
      and not track_artist.is_featured
    )
    or (
      reviewed.credit_role = 'featured'
      and track_artist.role = 'featured_artist'
      and not track_artist.is_primary
      and track_artist.is_featured
    )
  )
    and track_artist.credit_order = reviewed.credit_order;

  if v_parity <> 107 then
    raise exception
      'FAIL: expected 107/107 Top 50 Registry artist-credit parity, found %.',
      v_parity;
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'generic_existing_track_artist_sync', true,
  'clean_replay_safe_when_editorial_seed_absent', true
) as phase_5b_existing_track_artist_sync_and_replay_integrity_acceptance;
