-- Final acceptance for the first real Phase 5B Playlist publication.

do $verify$
declare
  v_playlist_id uuid;
  v_published_version_id uuid;
  v_snapshot_id uuid;
  v_parity integer;
  v_tracks integer;
  v_playable integer;
  v_artists integer;
  v_registry integer;
  v_notes integer;
begin
  select id
  into v_playlist_id
  from public.wk_playlists
  where slug='top-50-kenyan-songs-of-2025'
    and status='published'
    and authority_revision=54
    and published_at is not null
    and canonical_url='https://wakilisha.africa/playlists/top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    raise exception 'FAIL: Top 50 Playlist is not exact published revision 54.';
  end if;

  if (
    select count(*)
    from public.registry_provider_track_suggestion_artists c
    join public.registry_provider_track_suggestions s
      on s.id=c.suggestion_id
    where s.source_playlist_id=v_playlist_id
      and c.credit_role not in ('primary','featured')
  ) <> 0 then
    raise exception 'FAIL: unresolved Top 50 artist roles remain.';
  end if;

  with reviewed as (
    select
      s.canonical_track_id track_id,
      c.registry_artist_id artist_id,
      c.credit_role,
      c.credit_order
    from public.registry_provider_track_suggestion_artists c
    join public.registry_provider_track_suggestions s
      on s.id=c.suggestion_id
    where s.source_playlist_id=v_playlist_id
  )
  select count(*)
  into v_parity
  from reviewed r
  join public.registry_track_artists ta
    on ta.track_id=r.track_id
   and ta.artist_id=r.artist_id
   and ta.status='active'
  where (
    (r.credit_role='primary' and ta.role='primary_artist' and ta.is_primary and not ta.is_featured)
    or
    (r.credit_role='featured' and ta.role='featured_artist' and not ta.is_primary and ta.is_featured)
  )
    and ta.credit_order=r.credit_order;

  if v_parity<>107 then
    raise exception 'FAIL: expected 107/107 canonical Registry artist-credit parity, found %.',v_parity;
  end if;

  if (
    select count(*)
    from public.wk_playlist_items item
    where item.playlist_id=v_playlist_id
      and item.lifecycle_state='active'
      and item.provider_key='apple_music'
      and item.normalization_payload#>>'{playback,validation_status}'='playable'
  ) <> 50 then
    raise exception 'FAIL: expected 50 validated Apple Music Playlist items.';
  end if;

  select current_published_version_id
  into v_published_version_id
  from editorial.playlist_resources
  where playlist_id=v_playlist_id;

  if v_published_version_id is null then
    raise exception 'FAIL: Playlist-specific published-version pointer is missing.';
  end if;

  if (
    select count(*)
    from editorial.playlist_versions
    where playlist_id=v_playlist_id and version_kind='submitted'
  )<>1
  or (
    select count(*)
    from editorial.playlist_versions
    where playlist_id=v_playlist_id and version_kind='approved'
  )<>1
  or (
    select count(*)
    from editorial.playlist_versions
    where playlist_id=v_playlist_id and version_kind='published'
  )<>1
  then
    raise exception 'FAIL: expected exactly one submitted, approved and published Playlist version.';
  end if;

  if (
    select count(*)
    from editorial.playlist_review_events
    where playlist_id=v_playlist_id
  )<>2 then
    raise exception 'FAIL: expected exactly two durable Playlist review events.';
  end if;

  select id
  into v_snapshot_id
  from editorial.playlist_publication_snapshots
  where playlist_id=v_playlist_id
    and version_id=v_published_version_id;

  if v_snapshot_id is null then
    raise exception 'FAIL: durable Top 50 publication snapshot is missing.';
  end if;

  select
    jsonb_array_length(payload->'tracks'),
    (select count(*) from jsonb_array_elements(payload->'tracks') t where coalesce((t->'playback'->>'playable')::boolean,false)),
    (select count(*) from jsonb_array_elements(payload->'tracks') t where jsonb_array_length(coalesce(t->'artists','[]'::jsonb))>0),
    (select count(*) from jsonb_array_elements(payload->'tracks') t where nullif(btrim(t#>>'{registry,track_path}'),'') is not null),
    (select count(*) from jsonb_array_elements(payload->'tracks') t where nullif(btrim(t->>'notes'),'') is not null)
  into v_tracks,v_playable,v_artists,v_registry,v_notes
  from editorial.playlist_publication_snapshots
  where id=v_snapshot_id;

  if v_tracks<>50 or v_playable<>50 or v_artists<>50 or v_registry<>50 or v_notes<>50 then
    raise exception 'FAIL: public snapshot mismatch: tracks %, playable %, artists %, registry %, notes %.',v_tracks,v_playable,v_artists,v_registry,v_notes;
  end if;

  if position(
    E'update editorial.resources resource\n      set\n        current_published_version_id ='
    in pg_get_functiondef(
      'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
    )
  ) > 0 then
    raise exception 'FAIL: Playlist publication still writes the generic Article-only published-version pointer.';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification','PASS',
  'playlist','Top 50 Kenyan Songs Of 2025',
  'status','published',
  'authority_revision',54,
  'registry_artist_credit_parity',107,
  'validated_playback_items',50,
  'public_tracks',50,
  'playable_tracks',50,
  'artist_linked_tracks',50,
  'registry_linked_tracks',50,
  'editor_notes',50
) as phase_5b_top50_first_playlist_publication_acceptance;
