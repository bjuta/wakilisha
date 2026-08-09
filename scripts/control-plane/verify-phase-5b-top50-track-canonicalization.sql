-- Phase 5B M228 verifier:
-- all 50 reviewed Top 50 tracks are canonicalized using accepted enriched titles.

do $verify_m228$
declare
  v_playlist_id uuid;

  v_items integer;
  v_canonicalized integer;
  v_matched integer;
  v_notes integer;
  v_unique_tracks integer;

  v_created_tracks integer;
  v_reused_tracks integer;
  v_reused_provider_links integer;

  v_approved_titles integer;
  v_provider_titles_match integer;
  v_playlist_titles_match integer;
  v_enriched_title_differences integer;
begin
  select playlist.id
  into v_playlist_id
  from public.wk_playlists playlist
  where playlist.slug =
    'top-50-kenyan-songs-of-2025';

  if v_playlist_id is null then
    raise exception
      'FAIL: Top 50 Playlist is missing.';
  end if;

  select count(*)::integer
  into v_items
  from public.wk_playlist_items item
  where item.playlist_id = v_playlist_id
    and item.lifecycle_state = 'active';

  select count(*)::integer
  into v_canonicalized
  from public.registry_provider_track_suggestions suggestion
  where suggestion.source_playlist_id = v_playlist_id
    and suggestion.status = 'canonicalized'
    and suggestion.canonical_track_id is not null
    and suggestion.canonicalized_track_id =
        suggestion.canonical_track_id;

  select count(*)::integer
  into v_matched
  from public.wk_playlist_items item
  where item.playlist_id = v_playlist_id
    and item.lifecycle_state = 'active'
    and item.registry_track_id is not null
    and item.match_status = 'matched'
    and item.match_confidence = 1.0000;

  select count(*)::integer
  into v_notes
  from public.wk_playlist_items item
  where item.playlist_id = v_playlist_id
    and item.lifecycle_state = 'active'
    and nullif(
      btrim(item.notes),
      ''
    ) is not null;

  select count(
    distinct item.registry_track_id
  )::integer
  into v_unique_tracks
  from public.wk_playlist_items item
  where item.playlist_id = v_playlist_id
    and item.lifecycle_state = 'active'
    and item.registry_track_id is not null;

  select count(*)::integer
  into v_created_tracks
  from public.registry_tracks track
  where track.metadata
          ->> 'track_intake_source_suggestion_id'
        in (
          select suggestion.id::text
          from public.registry_provider_track_suggestions suggestion
          where suggestion.source_playlist_id =
                v_playlist_id
        )
    and track.status = 'active';

  select count(*)::integer
  into v_reused_tracks
  from public.registry_provider_track_suggestions suggestion
  join public.registry_tracks track
    on track.id = suggestion.canonical_track_id
  where suggestion.source_playlist_id = v_playlist_id
    and suggestion.status = 'canonicalized'
    and not (
      coalesce(
        track.metadata
          ->> 'track_intake_source_suggestion_id',
        ''
      ) = suggestion.id::text
    );

  select count(*)::integer
  into v_reused_provider_links
  from public.registry_provider_track_suggestions suggestion
  join public.registry_tracks track
    on track.id = suggestion.canonical_track_id
  join public.provider_entity_links canonical_link
    on canonical_link.registry_entity_type = 'track'
   and canonical_link.registry_entity_id =
       track.id::text
  join public.provider_entity_links source_link
    on source_link.registry_entity_type = 'track'
   and source_link.registry_entity_id =
       suggestion.id::text
   and source_link.provider =
       canonical_link.provider
   and source_link.provider_entity_id =
       canonical_link.provider_entity_id
  where suggestion.source_playlist_id = v_playlist_id
    and suggestion.status = 'canonicalized'
    and not (
      coalesce(
        track.metadata
          ->> 'track_intake_source_suggestion_id',
        ''
      ) = suggestion.id::text
    );

  select count(*)::integer
  into v_approved_titles
  from public.registry_enrichment_suggestions title_decision
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id::text =
       title_decision.registry_entity_id
  where suggestion.source_playlist_id = v_playlist_id
    and title_decision.registry_entity_type = 'track'
    and title_decision.field_name = 'title'
    and title_decision.decision_status = 'approved'
    and nullif(
      btrim(title_decision.suggested_value),
      ''
    ) is not null;

  select count(*)::integer
  into v_provider_titles_match
  from public.registry_provider_track_suggestions suggestion
  join public.registry_enrichment_suggestions title_decision
    on title_decision.registry_entity_type = 'track'
   and title_decision.registry_entity_id =
       suggestion.id::text
   and title_decision.field_name = 'title'
   and title_decision.decision_status = 'approved'
  where suggestion.source_playlist_id = v_playlist_id
    and suggestion.provider_title =
        title_decision.suggested_value;

  select count(*)::integer
  into v_playlist_titles_match
  from public.registry_provider_track_suggestions suggestion
  join public.wk_playlist_items item
    on item.id = suggestion.source_playlist_item_id
  join public.registry_enrichment_suggestions title_decision
    on title_decision.registry_entity_type = 'track'
   and title_decision.registry_entity_id =
       suggestion.id::text
   and title_decision.field_name = 'title'
   and title_decision.decision_status = 'approved'
  where suggestion.source_playlist_id = v_playlist_id
    and item.lifecycle_state = 'active'
    and item.title =
        title_decision.suggested_value;

  select count(*)::integer
  into v_enriched_title_differences
  from public.registry_provider_track_suggestions suggestion
  join public.registry_enrichment_suggestions title_decision
    on title_decision.registry_entity_type = 'track'
   and title_decision.registry_entity_id =
       suggestion.id::text
   and title_decision.field_name = 'title'
   and title_decision.decision_status = 'approved'
  where suggestion.source_playlist_id = v_playlist_id
    and title_decision.suggested_value
        is distinct from
        suggestion.submitted_track_title;

  if v_items <> 50
     or v_canonicalized <> 50
     or v_matched <> 50
     or v_notes <> 50
     or v_unique_tracks <> 50
     or v_created_tracks <> 36
     or v_reused_tracks <> 14
     or v_reused_provider_links <> 29
     or v_approved_titles <> 50
     or v_provider_titles_match <> 50
     or v_playlist_titles_match <> 50
     or v_enriched_title_differences <> 25
  then
    raise exception
      'FAIL: Top 50 canonicalization mismatch. items %, canonicalized %, matched %, notes %, unique %, created %, reused %, reused provider links %, approved titles %, provider-title matches %, playlist-title matches %, enriched title differences %.',
      v_items,
      v_canonicalized,
      v_matched,
      v_notes,
      v_unique_tracks,
      v_created_tracks,
      v_reused_tracks,
      v_reused_provider_links,
      v_approved_titles,
      v_provider_titles_match,
      v_playlist_titles_match,
      v_enriched_title_differences;
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.isrc = 'QZTAU2591214'
      and track.status = 'active'
      and track.title =
          'TIKI TAKO (feat. Mejja)'
  ) then
    raise exception
      'FAIL: Reused Tiki Tako Registry Track did not receive the accepted enriched title.';
  end if;

  if (
    select count(
      distinct item.position
    )::integer
    from public.wk_playlist_items item
    where item.playlist_id = v_playlist_id
      and item.lifecycle_state = 'active'
  ) <> 50
     or (
       select min(item.position)
       from public.wk_playlist_items item
       where item.playlist_id = v_playlist_id
         and item.lifecycle_state = 'active'
     ) <> 1
     or (
       select max(item.position)
       from public.wk_playlist_items item
       where item.playlist_id = v_playlist_id
         and item.lifecycle_state = 'active'
     ) <> 50
  then
    raise exception
      'FAIL: Top 50 Playlist ordering is not exactly positions 1 through 50.';
  end if;
end;
$verify_m228$;

select jsonb_build_object(
  'verification', 'PASS',
  'playlist_items', 50,
  'canonicalized_intake_rows', 50,
  'matched_playlist_items', 50,
  'editor_notes_preserved', 50,
  'accepted_enriched_titles', 50,
  'titles_different_from_article_labels', 25,
  'playlist_titles_from_enrichment', 50,
  'unique_registry_tracks', 50,
  'created_registry_tracks', 36,
  'reused_registry_tracks', 14,
  'reused_registry_provider_links', 29,
  'tiki_tako_title',
    'TIKI TAKO (feat. Mejja)'
) as phase_5b_top50_track_canonicalization_acceptance;
