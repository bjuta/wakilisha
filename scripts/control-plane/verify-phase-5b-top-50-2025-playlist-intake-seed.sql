-- Phase 5B M225 verifier: first real Playlist intake seed.

do $phase_5b_m225_verify$
declare
  v_playlist_id uuid;
  v_item_count integer;
  v_suggestion_count integer;
  v_artist_credit_count integer;
  v_youtube_count integer;
  v_spotify_count integer;
  v_note_count integer;
  v_provider_identity_count integer;
  v_corrupt_abbas_count integer;
begin
  select playlist.id
  into v_playlist_id
  from public.wk_playlists playlist
  where playlist.slug = 'top-50-kenyan-songs-of-2025'
    and playlist.title = 'Top 50 Kenyan Songs Of 2025'
    and playlist.status in (
      'draft',
      'in_progress',
      'submitted_for_review',
      'approved',
      'published'
    )
    and playlist.curator_label = 'Hafare Segelan'
    and playlist.metadata ->> 'source_article_author' =
      'Hafare Segelan'
    and playlist.metadata ->> 'source_article_url' =
      'https://wakilisha.africa/magazine/top-kenyan-songs-of-2025'
    and playlist.metadata ->> 'source_article_resource_id' =
      '7295c263-bffb-4635-97ac-1688f4a29d5c'
    and playlist.metadata ->> 'source_article_version_id' =
      '16448b28-c792-48e8-a234-59cb558ee009'
    and playlist.metadata ->> 'source_article_content_fingerprint' =
      'b919f79db5c3a1c95770cae1b2774d1db249e7f7d7ad62677d8c1666b64be664';

  if not found then
    raise exception
      'FAIL: Target Playlist identity or article provenance does not match.';
  end if;

  select count(*)::integer
  into v_item_count
  from public.wk_playlist_items item
  where item.playlist_id = v_playlist_id
    and item.lifecycle_state = 'active';

  if v_item_count <> 50 then
    raise exception
      'FAIL: Expected 50 active Playlist items, found %.',
      v_item_count;
  end if;

  if exists (
    select expected.position
    from generate_series(1, 50) expected(position)
    where not exists (
      select 1
      from public.wk_playlist_items item
      where item.playlist_id = v_playlist_id
        and item.lifecycle_state = 'active'
        and item.position = expected.position
    )
  ) then
    raise exception
      'FAIL: Playlist positions are not the complete sequence 1 through 50.';
  end if;

  select count(*)::integer
  into v_note_count
  from public.wk_playlist_items item
  where item.playlist_id = v_playlist_id
    and item.lifecycle_state = 'active'
    and nullif(btrim(item.notes), '') is not null;

  if v_note_count <> 50 then
    raise exception
      'FAIL: Expected editorial notes on all 50 Playlist items, found %.',
      v_note_count;
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where suggestion.provider_key = 'youtube'
    )::integer,
    count(*) filter (
      where suggestion.provider_key = 'spotify'
    )::integer,
    count(
      distinct
      suggestion.provider_key
      || ':'
      || suggestion.provider_object_id
    )::integer
  into
    v_suggestion_count,
    v_youtube_count,
    v_spotify_count,
    v_provider_identity_count
  from public.registry_provider_track_suggestions suggestion
  where suggestion.source_playlist_id = v_playlist_id
    and suggestion.intake_origin = 'playlist_editor'
    and suggestion.source_contribution_id is null
    and suggestion.source_playlist_item_id is not null
    and suggestion.reserved_position is null
    and suggestion.validation_snapshot ->> 'source_kind' =
      'published_article_track'
    and suggestion.validation_snapshot
          ->> 'source_article_version_id' =
      '16448b28-c792-48e8-a234-59cb558ee009';

  if v_suggestion_count <> 50
     or v_youtube_count <> 49
     or v_spotify_count <> 1
     or v_provider_identity_count <> 50
  then
    raise exception
      'FAIL: Seeded Track Intake source contract mismatch. rows %, youtube %, spotify %, provider identities %.',
      v_suggestion_count,
      v_youtube_count,
      v_spotify_count,
      v_provider_identity_count;
  end if;

  if exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    join public.wk_playlist_items item
      on item.id = suggestion.source_playlist_item_id
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'needs_review'
      and (
        suggestion.playlist_note is distinct from item.notes
        or suggestion.provider_key is distinct from item.provider_key
        or suggestion.provider_object_id is distinct from item.provider_track_id
        or suggestion.provider_url is distinct from item.provider_url
        or suggestion.submitted_track_title is distinct from item.title
      )
  ) then
    raise exception
      'FAIL: Track Intake evidence and materialized Playlist items diverged.';
  end if;

  select count(*)::integer
  into v_artist_credit_count
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  where suggestion.source_playlist_id = v_playlist_id;

  if v_artist_credit_count <> 107 then
    raise exception
      'FAIL: Expected 107 preserved artist-credit observations, found %.',
      v_artist_credit_count;
  end if;

  select count(*)::integer
  into v_corrupt_abbas_count
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  join public.wk_playlist_items item
    on item.id = suggestion.source_playlist_item_id
  where suggestion.source_playlist_id = v_playlist_id
    and credit.observed_name = 'Abbas K뫿'
    and item.position in (2, 29);

  if v_corrupt_abbas_count <> 2 then
    raise exception
      'FAIL: The two source-corrupted Abbas K artist observations were not preserved for manual review.';
  end if;
end;
$phase_5b_m225_verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'playlist_slug', playlist.slug,
  'playlist_status', playlist.status,
  'playlist_items', (
    select count(*)
    from public.wk_playlist_items item
    where item.playlist_id = playlist.id
      and item.lifecycle_state = 'active'
  ),
  'track_intake_rows', (
    select count(*)
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = playlist.id
      and suggestion.validation_snapshot ->> 'source_kind' =
        'published_article_track'
  ),
  'needs_review_rows', (
    select count(*)
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = playlist.id
      and suggestion.status = 'needs_review'
  ),
  'unresolved_artist_credits', (
    select count(*)
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = playlist.id
      and credit.resolution_mode = 'unresolved'
  ),
  'source_youtube_rows', (
    select count(*)
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = playlist.id
      and suggestion.provider_key = 'youtube'
  ),
  'source_spotify_rows', (
    select count(*)
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = playlist.id
      and suggestion.provider_key = 'spotify'
  ),
  'editor_notes', (
    select count(*)
    from public.wk_playlist_items item
    where item.playlist_id = playlist.id
      and item.lifecycle_state = 'active'
      and nullif(btrim(item.notes), '') is not null
  )
) as phase_5b_top_50_2025_intake_acceptance
from public.wk_playlists playlist
where playlist.slug = 'top-50-kenyan-songs-of-2025';

