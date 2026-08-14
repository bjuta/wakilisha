-- Phase 5B Migration 228: canonicalize all 50 reviewed Top 50 Playlist tracks.
--
-- Canonical title authority:
--   * accepted Apple Music Track Intake title matched to the approved ISRC
--   * never the shorter Article label when richer accepted title evidence exists
--
-- Identity authority:
--   * reuse 14 active Registry Tracks by exact approved ISRC
--   * create 36 genuinely missing canonical Registry Tracks
--
-- Reuse metadata policy:
--   * preserve established canonical metadata except the accepted canonical title
--   * 13 reused titles already match accepted enrichment exactly
--   * Tiki Tako is upgraded from "TIKI TAKO" to
--     "TIKI TAKO (feat. Mejja)"
--   * copy reviewed provider links from intake scope to canonical Track scope
--
-- Playlist authority:
--   * existing Phase 5B canonicalization trigger updates the same Playlist item
--   * positions and Editor's Notes remain untouched

begin;

-- The evidence recorder already accepts provider title observations.
-- M228 closes the missing accepted-decision boundary so future Track Intake
-- reviews may approve title exactly like ISRC, artwork, duration and release data.
create or replace function public.admin_save_registry_track_intake_enrichment(
  p_suggestion_id uuid,
  p_fields jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public'
as $function$
declare
  v_field record;
  v_value text;
  v_count integer := 0;
  v_allowed constant text[] := array[
    'title',
    'isrc',
    'duration_ms',
    'track_artwork_url',
    'preview_url',
    'release_title',
    'release_artwork_url',
    'release_date',
    'release_date_precision',
    'label_name',
    'imprint_name',
    'genre',
    'track_number',
    'disc_number',
    'explicit',
    'upc',
    'copyright_text'
  ];
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_provider_track_suggestions suggestion
    where suggestion.id = p_suggestion_id
      and suggestion.status = 'needs_review'
  ) then
    raise exception
      'Only Track Intake items awaiting review can be enriched.';
  end if;

  if p_fields is null
     or jsonb_typeof(p_fields) <> 'object'
  then
    raise exception
      'Accepted enrichment fields must be a JSON object.';
  end if;

  for v_field in
    select entry.key, entry.value
    from jsonb_each(p_fields) entry
  loop
    if not (v_field.key = any(v_allowed)) then
      raise exception
        'Unsupported accepted Track Intake field: %',
        v_field.key;
    end if;

    if v_field.value = 'null'::jsonb then
      delete from public.registry_enrichment_suggestions suggestion
      where suggestion.registry_entity_type = 'track'
        and suggestion.registry_entity_id =
          p_suggestion_id::text
        and suggestion.field_name = v_field.key
        and suggestion.decision_status in (
          'draft',
          'approved'
        );

      continue;
    end if;

    v_value :=
      case jsonb_typeof(v_field.value)
        when 'string'
          then v_field.value #>> '{}'
        else v_field.value::text
      end;

    if nullif(btrim(v_value), '') is null then
      continue;
    end if;

    delete from public.registry_enrichment_suggestions suggestion
    where suggestion.registry_entity_type = 'track'
      and suggestion.registry_entity_id =
        p_suggestion_id::text
      and suggestion.field_name = v_field.key
      and suggestion.decision_status in (
        'draft',
        'approved'
      );

    insert into public.registry_enrichment_suggestions (
      registry_entity_type,
      registry_entity_id,
      field_name,
      current_value,
      suggested_value,
      provider_item_id,
      confidence_score,
      decision_status,
      decision_reason,
      created_at,
      updated_at
    )
    values (
      'track',
      p_suggestion_id::text,
      v_field.key,
      null,
      v_value,
      p_suggestion_id::text,
      1.0000,
      'approved',
      nullif(btrim(p_reason), ''),
      now(),
      now()
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'suggestion_id',
      p_suggestion_id,
    'accepted_field_count',
      v_count
  );
end;
$function$;

revoke all
on function public.admin_save_registry_track_intake_enrichment(
  uuid,
  jsonb,
  text
)
from public, anon, service_role;

grant execute
on function public.admin_save_registry_track_intake_enrichment(
  uuid,
  jsonb,
  text
)
to authenticated;

do $m228$
declare
  v_playlist_id uuid;
  v_admin_user_id uuid :=
    '27937fb0-147f-4d0f-b735-3b9b9b82f38f'::uuid;

  v_row record;

  v_existing_track_id uuid;
  v_existing_track_title text;

  v_approved_isrc text;
  v_approved_title text;

  v_title_observation
    public.provider_field_observations%rowtype;

  v_result jsonb;

  v_reused integer := 0;
  v_created integer := 0;
  v_processed integer := 0;
  v_title_decisions integer := 0;
  v_existing_title_updates integer := 0;

  v_before_title text;
begin
  if not exists (
    select 1
    from auth.users user_row
    where user_row.id = v_admin_user_id
      and lower(user_row.email) =
          lower('admin@wakilisha.africa')
  ) then
    raise exception
      'STOP: Expected WAKILISHA Registry administrator identity is unavailable.';
  end if;

  if not exists (
    select 1
    from public.user_role_assignments assignment
    left join public.role_capabilities capability
      on capability.role_key = assignment.role_key
     and capability.capability_key = 'manage_registry'
    where assignment.user_id = v_admin_user_id
      and assignment.status = 'active'
      and (
        assignment.expires_at is null
        or assignment.expires_at > now()
      )
      and (
        assignment.role_key = 'administrator'
        or capability.capability_key = 'manage_registry'
      )
  ) then
    raise exception
      'STOP: Expected Registry administrator no longer has active Registry authority.';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_admin_user_id::text,
    true
  );

  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  if auth.uid() is distinct from v_admin_user_id
     or not (
       public.current_user_is_administrator()
       or public.current_user_has_capability('manage_registry')
     )
  then
    raise exception
      'STOP: M228 could not establish the existing authenticated Registry admin authority.';
  end if;

  select playlist.id
  into v_playlist_id
  from public.wk_playlists playlist
  where playlist.slug =
    'top-50-kenyan-songs-of-2025'
  for update;

  if v_playlist_id is null then
    raise exception
      'STOP: Top 50 Kenyan Songs Of 2025 Playlist is missing.';
  end if;

  if (
    select count(*)::integer
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'needs_review'
      and suggestion.canonical_track_id is null
      and suggestion.canonicalized_track_id is null
  ) <> 50 then
    raise exception
      'STOP: M228 expects exactly 50 uncanonicalized Top 50 intake rows.';
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
      'STOP: M228 requires all 107 artist credits bound to active Registry artists.';
  end if;

  if (
    select count(distinct enrichment.registry_entity_id)::integer
    from public.registry_enrichment_suggestions enrichment
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id::text =
         enrichment.registry_entity_id
    where suggestion.source_playlist_id = v_playlist_id
      and enrichment.registry_entity_type = 'track'
      and enrichment.field_name = 'isrc'
      and enrichment.decision_status = 'approved'
      and nullif(
        btrim(enrichment.suggested_value),
        ''
      ) is not null
  ) <> 50 then
    raise exception
      'STOP: Every Top 50 Track Intake row requires one approved ISRC before canonicalization.';
  end if;

  if (
    select count(*)::integer
    from public.registry_enrichment_suggestions enrichment
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id::text =
         enrichment.registry_entity_id
    where suggestion.source_playlist_id = v_playlist_id
      and enrichment.registry_entity_type = 'track'
      and enrichment.field_name = 'title'
      and enrichment.decision_status = 'approved'
  ) <> 0 then
    raise exception
      'STOP: M228 expected the pre-fix title-approval gap to contain zero approved titles.';
  end if;

  for v_row in
    select
      suggestion.id as suggestion_id,
      item.position,
      item.title as article_title,
      suggestion.provider_title as current_provider_title
    from public.registry_provider_track_suggestions suggestion
    join public.wk_playlist_items item
      on item.id = suggestion.source_playlist_item_id
     and item.playlist_id =
         suggestion.source_playlist_id
     and item.lifecycle_state = 'active'
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'needs_review'
    order by item.position, suggestion.id
  loop
    select nullif(
      btrim(enrichment.suggested_value),
      ''
    )
    into v_approved_isrc
    from public.registry_enrichment_suggestions enrichment
    where enrichment.registry_entity_type = 'track'
      and enrichment.registry_entity_id =
          v_row.suggestion_id::text
      and enrichment.field_name = 'isrc'
      and enrichment.decision_status = 'approved'
    order by
      enrichment.updated_at desc,
      enrichment.id desc
    limit 1;

    if v_approved_isrc is null then
      raise exception
        'STOP: Position % (%) has no approved ISRC.',
        v_row.position,
        v_row.article_title;
    end if;

    select observation.*
    into v_title_observation
    from public.provider_field_observations observation
    where observation.provider_item_id =
          v_row.suggestion_id::text
      and observation.entity_type = 'track'
      and observation.field_name = 'title'
      and observation.provider = 'apple_music'
      and observation.source_path =
          'track_intake.provider_inspect'
      and observation.raw_payload
            #>> '{data,0,attributes,isrc}' =
          v_approved_isrc
      and nullif(
        btrim(observation.field_value),
        ''
      ) is not null
    order by
      observation.created_at desc,
      observation.id desc
    limit 1;

    if not found then
      raise exception
        'STOP: Position % (%) has no reviewed Apple Music title observation matching approved ISRC %.',
        v_row.position,
        v_row.article_title,
        v_approved_isrc;
    end if;

    v_approved_title :=
      nullif(
        btrim(v_title_observation.field_value),
        ''
      );

    if v_approved_title is null then
      raise exception
        'STOP: Position % (%) produced a blank enriched title.',
        v_row.position,
        v_row.article_title;
    end if;

    delete from public.registry_enrichment_suggestions enrichment
    where enrichment.registry_entity_type = 'track'
      and enrichment.registry_entity_id =
          v_row.suggestion_id::text
      and enrichment.field_name = 'title'
      and enrichment.decision_status in (
        'draft',
        'approved'
      );

    insert into public.registry_enrichment_suggestions (
      registry_entity_type,
      registry_entity_id,
      field_name,
      current_value,
      suggested_value,
      provider_item_id,
      confidence_score,
      decision_status,
      decision_reason,
      created_at,
      updated_at
    )
    values (
      'track',
      v_row.suggestion_id::text,
      'title',
      v_row.current_provider_title,
      v_approved_title,
      v_row.suggestion_id::text,
      coalesce(
        v_title_observation.confidence_score,
        1.0000
      ),
      'approved',
      'Accepted from the reviewed Apple Music inspection matched to the approved ISRC during Phase 5B Top 50 canonicalization.',
      now(),
      now()
    );

    update public.registry_provider_track_suggestions suggestion
    set provider_title = v_approved_title
    where suggestion.id = v_row.suggestion_id;

    v_title_decisions :=
      v_title_decisions + 1;

    select
      track.id,
      track.title
    into
      v_existing_track_id,
      v_existing_track_title
    from public.registry_tracks track
    where track.isrc = v_approved_isrc
      and track.status = 'active'
    order by
      track.created_at,
      track.id
    limit 1;

    if v_existing_track_id is not null then
      if v_existing_track_title
         is distinct from v_approved_title
      then
        if v_row.position <> 50
           or v_approved_isrc <> 'QZTAU2591214'
           or v_existing_track_title <> 'TIKI TAKO'
           or v_approved_title <>
              'TIKI TAKO (feat. Mejja)'
        then
          raise exception
            'STOP: Unexpected reused-track title conflict at position %. Existing %, accepted %.',
            v_row.position,
            v_existing_track_title,
            v_approved_title;
        end if;

        v_before_title :=
          v_existing_track_title;

        update public.registry_tracks track
        set
          title = v_approved_title,
          normalized_title = trim(
            regexp_replace(
              lower(v_approved_title),
              '[^[:alnum:]]+',
              ' ',
              'g'
            )
          ),
          updated_at = now()
        where track.id =
          v_existing_track_id;

        insert into public.registry_canonical_write_events (
          registry_entity_type,
          registry_entity_id,
          source_suggestion_id,
          source_table,
          field_name,
          target_path,
          before_value,
          after_value,
          action,
          status,
          error_message,
          actor,
          created_at
        )
        values (
          'track',
          v_existing_track_id::text,
          v_row.suggestion_id::text,
          'registry_provider_track_suggestions',
          'title',
          'registry_tracks.title',
          jsonb_build_object(
            'title',
            v_before_title
          ),
          jsonb_build_object(
            'title',
            v_approved_title
          ),
          'apply_enrichment',
          'applied',
          null,
          auth.uid()::text,
          now()
        );

        v_existing_title_updates :=
          v_existing_title_updates + 1;
      end if;

      select public.admin_resolve_registry_track_intake(
        v_row.suggestion_id,
        v_existing_track_id,
        'Phase 5B Top 50 reviewed canonicalization: reused active Registry Track by approved ISRC while preserving established canonical metadata.'
      )
      into v_result;

      insert into public.provider_entity_links (
        registry_entity_type,
        registry_entity_id,
        provider,
        provider_entity_id,
        provider_url,
        match_status,
        confidence_score,
        created_at,
        updated_at
      )
      select
        'track',
        v_existing_track_id::text,
        link.provider,
        link.provider_entity_id,
        link.provider_url,
        'confirmed',
        link.confidence_score,
        now(),
        now()
      from public.provider_entity_links link
      where link.registry_entity_type = 'track'
        and link.registry_entity_id =
            v_row.suggestion_id::text
        and not exists (
          select 1
          from public.provider_entity_links canonical_link
          where canonical_link.registry_entity_type = 'track'
            and canonical_link.registry_entity_id =
                v_existing_track_id::text
            and canonical_link.provider = link.provider
            and canonical_link.provider_entity_id =
                link.provider_entity_id
        );

      v_reused := v_reused + 1;
    else
      select public.admin_create_registry_track_from_intake_enriched(
        v_row.suggestion_id,
        v_approved_title,
        'Phase 5B Top 50 reviewed canonicalization: created canonical Registry Track using accepted provider-enriched title.'
      )
      into v_result;

      v_created := v_created + 1;
    end if;

    if coalesce(
      v_result ->> 'status',
      ''
    ) <> 'canonicalized'
    then
      raise exception
        'STOP: Position % (%) did not canonicalize successfully.',
        v_row.position,
        v_approved_title;
    end if;

    v_processed := v_processed + 1;
  end loop;

  if v_processed <> 50
     or v_reused <> 14
     or v_created <> 36
     or v_title_decisions <> 50
     or v_existing_title_updates <> 1
  then
    raise exception
      'STOP: M228 canonicalization split drifted. processed %, reused %, created %, title decisions %, reused title updates %.',
      v_processed,
      v_reused,
      v_created,
      v_title_decisions,
      v_existing_title_updates;
  end if;

  if (
    select count(*)::integer
    from public.registry_provider_track_suggestions suggestion
    join public.registry_enrichment_suggestions title_decision
      on title_decision.registry_entity_type = 'track'
     and title_decision.registry_entity_id =
         suggestion.id::text
     and title_decision.field_name = 'title'
     and title_decision.decision_status = 'approved'
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.provider_title =
          title_decision.suggested_value
  ) <> 50 then
    raise exception
      'STOP: Expected 50 approved enriched titles reflected on Track Intake suggestions.';
  end if;

  if (
    select count(*)::integer
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_playlist_id = v_playlist_id
      and suggestion.status = 'canonicalized'
      and suggestion.canonical_track_id is not null
      and suggestion.canonicalized_track_id =
          suggestion.canonical_track_id
  ) <> 50 then
    raise exception
      'STOP: Expected all 50 Top 50 intake rows canonicalized.';
  end if;

  if (
    select count(*)::integer
    from public.wk_playlist_items item
    join public.registry_provider_track_suggestions suggestion
      on suggestion.source_playlist_item_id =
         item.id
    join public.registry_enrichment_suggestions title_decision
      on title_decision.registry_entity_type = 'track'
     and title_decision.registry_entity_id =
         suggestion.id::text
     and title_decision.field_name = 'title'
     and title_decision.decision_status = 'approved'
    where item.playlist_id = v_playlist_id
      and item.lifecycle_state = 'active'
      and item.registry_track_id is not null
      and item.match_status = 'matched'
      and item.match_confidence = 1.0000
      and item.title =
          title_decision.suggested_value
  ) <> 50 then
    raise exception
      'STOP: Expected all 50 Playlist items materialized with accepted enriched titles.';
  end if;

  if (
    select count(distinct item.position)::integer
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
      'STOP: Playlist ordering changed during track canonicalization.';
  end if;

  if (
    select count(*)::integer
    from public.wk_playlist_items item
    where item.playlist_id = v_playlist_id
      and item.lifecycle_state = 'active'
      and nullif(
        btrim(item.notes),
        ''
      ) is not null
  ) <> 50 then
    raise exception
      'STOP: One or more Editor''s Notes were lost during canonicalization.';
  end if;
end;
$m228$;

commit;
