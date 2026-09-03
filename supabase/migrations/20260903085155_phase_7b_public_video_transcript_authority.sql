-- Phase 7B: governed public Video transcript authority.
--
-- Extends the accepted V4C public Video reader with the exact immutable
-- video_transcript relationship and a service-only protected transcript
-- delivery target. Existing Video playback, adaptive delivery, captions,
-- chapters, and Media authority remain unchanged.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7b-video-authority',
    0
  )
);

do $phase_7b_public_video_transcript_preflight$
declare
  v_reader text;
begin
  if to_regprocedure(
       'public.get_public_video_publication(text,text)'
     ) is null
     or to_regprocedure(
       'public.get_public_video_caption_delivery_target(uuid,integer)'
     ) is null
  then
    raise exception
      'STOP: accepted V4C public Video authority is incomplete';
  end if;

  if to_regprocedure(
       'public.get_public_video_transcript_delivery_target(uuid)'
     ) is not null
  then
    raise exception
      'STOP: public Video transcript delivery target already exists';
  end if;

  v_reader := pg_get_functiondef(
    'public.get_public_video_publication(text,text)'::regprocedure
  );

  if position('adaptive_delivery' in v_reader) = 0
     or position('''renditions''' in v_reader) = 0
     or position('video_hls_360p_playlist' in v_reader) = 0
     or position('video_hls_720p_playlist' in v_reader) = 0
     or position('''transcript''' in v_reader) > 0
     or position('usage_role = ''video_transcript''' in v_reader) > 0
  then
    raise exception
      'STOP: public Video reader is not at the accepted V4C baseline';
  end if;
end;
$phase_7b_public_video_transcript_preflight$;

create or replace function public.get_public_video_publication(
  p_slug text,
  p_show_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','editorial','video','media'
as $function$
declare
  v_slug text := nullif(lower(btrim(p_slug)), '');
  v_show_slug text := nullif(lower(btrim(p_show_slug)), '');
  v_version_id uuid;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_version video.publication_versions%rowtype;
  v_source video.sources%rowtype;
  v_show editorial.shows%rowtype;
  v_episode editorial.show_episodes%rowtype;
  v_delivery jsonb := null;
  v_adaptive_delivery jsonb := null;
  v_poster jsonb := null;
  v_transcript jsonb := null;
  v_canonical_path text;
  v_first_published_at timestamptz;
  v_published_at timestamptz;
  v_reviewed_at timestamptz;
begin
  if v_slug is null then
    return null;
  end if;

  if v_show_slug is null then
    select version_row.id
    into v_version_id
    from editorial.video_publication_resources binding_row
    join editorial.resources resource_row
      on resource_row.id = binding_row.resource_id
     and resource_row.resource_kind = binding_row.resource_kind
     and resource_row.lifecycle_state = 'published'
     and resource_row.visibility = 'public'
     and resource_row.current_published_version_id is not null
    join video.publication_versions version_row
      on version_row.id = resource_row.current_published_version_id
     and version_row.publication_id = binding_row.publication_id
     and version_row.resource_id = binding_row.resource_id
     and version_row.version_kind = 'published'
     and version_row.publication_kind = 'standalone'
     and version_row.slug_snapshot = v_slug
    limit 1;
  else
    select version_row.id
    into v_version_id
    from editorial.video_publication_resources binding_row
    join editorial.resources resource_row
      on resource_row.id = binding_row.resource_id
     and resource_row.resource_kind = binding_row.resource_kind
     and resource_row.lifecycle_state = 'published'
     and resource_row.visibility = 'public'
     and resource_row.current_published_version_id is not null
    join video.publication_versions version_row
      on version_row.id = resource_row.current_published_version_id
     and version_row.publication_id = binding_row.publication_id
     and version_row.resource_id = binding_row.resource_id
     and version_row.version_kind = 'published'
     and version_row.publication_kind = 'episode'
     and version_row.slug_snapshot = v_slug
    join editorial.shows show_row
      on show_row.resource_id = version_row.show_resource_id
     and show_row.slug = v_show_slug
    join editorial.resources show_resource
      on show_resource.id = show_row.resource_id
     and show_resource.resource_kind = 'show'
     and show_resource.lifecycle_state = 'active'
    join editorial.show_episodes episode_row
      on episode_row.resource_id = version_row.show_episode_resource_id
     and episode_row.show_resource_id = show_row.resource_id
     and episode_row.slug = v_slug
    join editorial.resources episode_resource
      on episode_resource.id = episode_row.resource_id
     and episode_resource.resource_kind = 'show_episode'
     and episode_resource.lifecycle_state = 'active'
    limit 1;
  end if;

  if v_version_id is null then
    return null;
  end if;

  select version_row.*
  into strict v_version
  from video.publication_versions version_row
  where version_row.id = v_version_id;

  select binding_row.*
  into strict v_binding
  from editorial.video_publication_resources binding_row
  where binding_row.publication_id = v_version.publication_id
    and binding_row.resource_id = v_version.resource_id;

  select resource_row.*
  into strict v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id
    and resource_row.current_published_version_id = v_version.id
    and resource_row.lifecycle_state = 'published'
    and resource_row.visibility = 'public';

  if v_version.publication_kind = 'episode' then
    select show_row.*
    into strict v_show
    from editorial.shows show_row
    join editorial.resources show_resource
      on show_resource.id = show_row.resource_id
     and show_resource.resource_kind = 'show'
     and show_resource.lifecycle_state = 'active'
    where show_row.resource_id = v_version.show_resource_id
      and show_row.slug = v_show_slug;

    select episode_row.*
    into strict v_episode
    from editorial.show_episodes episode_row
    join editorial.resources episode_resource
      on episode_resource.id = episode_row.resource_id
     and episode_resource.resource_kind = 'show_episode'
     and episode_resource.lifecycle_state = 'active'
    where episode_row.resource_id = v_version.show_episode_resource_id
      and episode_row.show_resource_id = v_show.resource_id
      and episode_row.slug = v_slug;
  end if;

  begin
    perform video.assert_publishable_publication_version(v_version.id);
  exception
    when others then
      return null;
  end;

  select source_row.*
  into strict v_source
  from video.sources source_row
  where source_row.id = v_version.source_id;

  if v_source.source_kind = 'native_media' then
    select jsonb_build_object(
      'kind', 'native_media',
      'url', file_row.delivery_url,
      'mime_type', file_row.mime_type,
      'byte_size', file_row.byte_size,
      'sha256', file_row.sha256,
      'duration_seconds',
        nullif(file_row.technical_metadata #>> '{source_probe,duration_seconds}', '')::numeric
    )
    into v_delivery
    from media.variants variant_row
    join media.file_objects file_row
      on file_row.id = variant_row.derived_file_object_id
     and file_row.verification_state = 'verified'
     and file_row.mime_type = 'video/mp4'
     and file_row.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
    where variant_row.asset_id = v_source.media_asset_id
      and variant_row.asset_revision_id = v_source.media_asset_revision_id
      and variant_row.variant_role = 'video_transcode'
    order by variant_row.created_at desc
    limit 1;

    if v_delivery is null then
      return null;
    end if;

    with selected_adaptive as (
      select
        selection_row.variant_role,
        variant_row.generator_name,
        variant_row.generator_version,
        variant_row.transformation_spec,
        file_row.delivery_url,
        file_row.mime_type,
        file_row.byte_size,
        file_row.sha256,
        file_row.verification_state
      from media.variant_selections selection_row
      join media.asset_revisions source_revision
        on source_revision.id =
           selection_row.asset_revision_id
       and source_revision.asset_id =
           v_source.media_asset_id
      join media.variants variant_row
        on variant_row.id = selection_row.variant_id
       and variant_row.asset_revision_id =
           selection_row.asset_revision_id
       and variant_row.variant_role =
           selection_row.variant_role
       and variant_row.asset_id =
           v_source.media_asset_id
       and variant_row.source_file_object_id =
           source_revision.original_file_object_id
      join media.file_objects file_row
        on file_row.id =
           variant_row.derived_file_object_id
      where selection_row.asset_revision_id =
            v_source.media_asset_revision_id
        and selection_row.variant_role in (
          'video_hls_master',
          'video_hls_360p_playlist',
          'video_hls_360p_media',
          'video_hls_720p_playlist',
          'video_hls_720p_media'
        )
        and variant_row.generator_name =
            'wakilisha-media-processor'
        and variant_row.generator_version =
            'phase7b-v4a-v1'
        and variant_row.transformation_spec ->> 'profile' =
            'video-adaptive-v1'
        and file_row.verification_state = 'verified'
        and file_row.delivery_url like
            'https://media.wakilisha.africa/derivatives/%'
    ),
    complete_package as (
      select true as complete
      from selected_adaptive
      having count(*) = 5
        and count(*) filter (
          where variant_role = 'video_hls_master'
            and mime_type =
                'application/vnd.apple.mpegurl'
        ) = 1
        and count(*) filter (
          where variant_role =
                'video_hls_360p_playlist'
            and mime_type =
                'application/vnd.apple.mpegurl'
        ) = 1
        and count(*) filter (
          where variant_role =
                'video_hls_360p_media'
            and mime_type = 'video/mp2t'
        ) = 1
        and count(*) filter (
          where variant_role =
                'video_hls_720p_playlist'
            and mime_type =
                'application/vnd.apple.mpegurl'
        ) = 1
        and count(*) filter (
          where variant_role =
                'video_hls_720p_media'
            and mime_type = 'video/mp2t'
        ) = 1
    )
    select jsonb_build_object(
      'kind', 'hls',
      'url', master.delivery_url,
      'mime_type', master.mime_type,
      'byte_size', master.byte_size,
      'sha256', master.sha256,
      'profile_version', 'video-adaptive-v1',
      'rendition_count', 2,
      'renditions', jsonb_build_array(
        jsonb_build_object(
          'height', 360,
          'label', '360p',
          'url', rendition_360.delivery_url,
          'mime_type', rendition_360.mime_type,
          'byte_size', rendition_360.byte_size,
          'sha256', rendition_360.sha256
        ),
        jsonb_build_object(
          'height', 720,
          'label', '720p',
          'url', rendition_720.delivery_url,
          'mime_type', rendition_720.mime_type,
          'byte_size', rendition_720.byte_size,
          'sha256', rendition_720.sha256
        )
      )
    )
    into v_adaptive_delivery
    from selected_adaptive master
    join selected_adaptive rendition_360
      on rendition_360.variant_role =
         'video_hls_360p_playlist'
    join selected_adaptive rendition_720
      on rendition_720.variant_role =
         'video_hls_720p_playlist'
    cross join complete_package package
    where package.complete
      and master.variant_role =
          'video_hls_master'
    limit 1;

    select jsonb_build_object(
      'url', file_row.delivery_url,
      'mime_type', file_row.mime_type
    )
    into v_poster
    from media.usage_links usage_row
    join media.asset_revisions revision_row
      on revision_row.id = usage_row.asset_revision_id
     and revision_row.asset_id = usage_row.asset_id
    join media.file_objects file_row
      on file_row.id = revision_row.original_file_object_id
     and file_row.verification_state = 'verified'
     and file_row.mime_type like 'image/%'
     and file_row.delivery_url like 'https://media.wakilisha.africa/%'
    where usage_row.target_authority = 'video'
      and usage_row.target_kind = 'video_publication'
      and usage_row.target_id = v_version.publication_id
      and usage_row.target_version_kind = 'video_publication_version'
      and usage_row.target_version_id = v_version.id
      and usage_row.usage_role = 'video_poster'
      and usage_row.usage_state = 'active'
      and usage_row.resolution_mode = 'exact_revision'
    order by usage_row.display_order, usage_row.created_at
    limit 1;

    if v_poster is null then
      select jsonb_build_object(
        'url', file_row.delivery_url,
        'mime_type', file_row.mime_type
      )
      into v_poster
      from media.variants variant_row
      join media.file_objects file_row
        on file_row.id = variant_row.derived_file_object_id
       and file_row.verification_state = 'verified'
       and file_row.mime_type like 'image/%'
       and file_row.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
      where variant_row.asset_id = v_source.media_asset_id
        and variant_row.asset_revision_id = v_source.media_asset_revision_id
        and variant_row.variant_role = 'poster_frame'
      order by variant_row.created_at desc
      limit 1;
    end if;
  else
    v_delivery := jsonb_build_object(
      'kind', 'provider',
      'provider_key', v_source.provider_key,
      'provider_object_id', v_source.provider_object_id,
      'canonical_url', v_source.canonical_url
    );
  end if;

  select jsonb_build_object(
    'asset_id', usage_row.asset_id,
    'asset_revision_id', usage_row.asset_revision_id,
    'mime_type', file_row.mime_type,
    'delivery_path',
      '/video/transcripts/' ||
      v_version.id::text ||
      '.txt'
  )
  into v_transcript
  from media.usage_links usage_row
  join media.assets asset_row
    on asset_row.id = usage_row.asset_id
   and asset_row.asset_kind = 'transcript'
   and asset_row.lifecycle_state = 'active'
  join media.asset_revisions revision_row
    on revision_row.id = usage_row.asset_revision_id
   and revision_row.asset_id = usage_row.asset_id
  join media.file_objects file_row
    on file_row.id = revision_row.original_file_object_id
   and file_row.verification_state = 'verified'
   and file_row.storage_provider = 'lightsail_media'
   and file_row.mime_type = 'text/plain'
   and file_row.storage_path ~
       '^private-files/transcripts/.+[.]txt$'
  where usage_row.target_authority = 'video'
    and usage_row.target_kind = 'video_publication'
    and usage_row.target_id = v_version.publication_id
    and usage_row.target_version_kind =
        'video_publication_version'
    and usage_row.target_version_id = v_version.id
    and usage_row.usage_role = 'video_transcript'
    and usage_row.usage_state = 'active'
    and usage_row.resolution_mode = 'exact_revision'
  order by usage_row.display_order, usage_row.created_at
  limit 1;

  v_canonical_path :=
    case
      when v_version.publication_kind = 'episode'
      then '/video/' || v_show.slug || '/' || v_episode.slug
      else '/video/' || v_version.slug_snapshot
    end;

  select min(event_row.created_at)
  into v_first_published_at
  from editorial.resource_lifecycle_events event_row
  where event_row.resource_id = v_binding.resource_id
    and event_row.action = 'published';

  select event_row.created_at
  into v_published_at
  from editorial.resource_lifecycle_events event_row
  where event_row.resource_id = v_binding.resource_id
    and event_row.action = 'published'
    and event_row.version_id = v_version.id
  order by event_row.event_number desc
  limit 1;

  select approved_event.created_at
  into v_reviewed_at
  from editorial.resource_lifecycle_events published_event
  join editorial.resource_lifecycle_events approved_event
    on approved_event.resource_id = published_event.resource_id
   and approved_event.action = 'approved'
   and approved_event.version_id =
       nullif(published_event.metadata->>'approved_version_id', '')::uuid
  where published_event.resource_id = v_binding.resource_id
    and published_event.action = 'published'
    and published_event.version_id = v_version.id
  order by approved_event.event_number desc
  limit 1;

  return jsonb_build_object(
    'publication_id', v_version.publication_id,
    'resource_id', v_binding.resource_id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'publication_kind', v_version.publication_kind,
    'canonical_path', v_canonical_path,
    'slug', v_version.slug_snapshot,
    'title', v_version.title_snapshot,
    'summary', v_version.summary_snapshot,
    'classification', v_version.classification,
    'content_fingerprint', v_version.content_fingerprint,
    'show',
      case
        when v_version.publication_kind = 'episode'
        then jsonb_build_object(
          'resource_id', v_show.resource_id,
          'slug', v_show.slug,
          'title', v_show.title,
          'description', v_show.description,
          'canonical_path',
            case
              when exists (
                select 1
                from editorial.resources show_resource
                where show_resource.id = v_show.resource_id
                  and show_resource.resource_kind = 'show'
                  and show_resource.lifecycle_state = 'active'
                  and show_resource.visibility = 'public'
              )
              then '/shows/' || v_show.slug
              else null
            end
        )
        else null
      end,
    'episode',
      case
        when v_version.publication_kind = 'episode'
        then jsonb_build_object(
          'resource_id', v_episode.resource_id,
          'slug', v_episode.slug,
          'title', v_episode.title,
          'summary', v_episode.summary,
          'episode_number', v_episode.episode_number
        )
        else null
      end,
    'delivery', v_delivery,
    'adaptive_delivery', v_adaptive_delivery,
    'poster', v_poster,
    'transcript', v_transcript,
    'captions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'track_number', track_row.track_number,
          'language_tag', track_row.language_tag,
          'track_kind', track_row.track_kind,
          'label', track_row.label,
          'is_default', track_row.is_default,
          'mime_type', file_row.mime_type,
          'delivery_path',
            '/video/captions/' ||
            v_version.id::text ||
            '/' ||
            track_row.track_number::text ||
            '.vtt'
        )
        order by track_row.track_number
      )
      from video.publication_version_caption_tracks track_row
      join media.asset_revisions revision_row
        on revision_row.id = track_row.media_asset_revision_id
       and revision_row.asset_id = track_row.media_asset_id
      join media.file_objects file_row
        on file_row.id = revision_row.original_file_object_id
       and file_row.verification_state = 'verified'
       and file_row.mime_type = 'text/vtt'
       and file_row.storage_path ~ '^private-files/captions/.+[.]vtt$'
      where track_row.publication_version_id = v_version.id
        and exists (
          select 1
          from media.usage_links usage_row
          where usage_row.target_authority = 'video'
            and usage_row.target_kind = 'video_publication'
            and usage_row.target_id = v_version.publication_id
            and usage_row.target_version_kind = 'video_publication_version'
            and usage_row.target_version_id = v_version.id
            and usage_row.usage_role = 'video_caption'
            and usage_row.usage_state = 'active'
            and usage_row.resolution_mode = 'exact_revision'
            and usage_row.asset_id = track_row.media_asset_id
            and usage_row.asset_revision_id = track_row.media_asset_revision_id
        )
    ), '[]'::jsonb),
    'chapters', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'chapter_number', chapter_row.chapter_number,
          'start_seconds', chapter_row.start_seconds,
          'title', chapter_row.title,
          'description', chapter_row.description
        )
        order by chapter_row.chapter_number
      )
      from video.publication_version_chapters chapter_row
      where chapter_row.publication_version_id = v_version.id
    ), '[]'::jsonb),
    'provenance', jsonb_build_object(
      'version_number', v_version.version_number,
      'first_published_at', v_first_published_at,
      'published_at', v_published_at,
      'reviewed_at', v_reviewed_at
    ),
    'credits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'resource_id', attachment.resource_id,
          'resource_kind', attachment.resource_kind,
          'display_order', attachment.display_order,
          'is_primary', attachment.is_primary,
          'credit_id', credit.id,
          'role', credit.credit_role,
          'role_label', credit.role_label_snapshot,
          'display_name', credit.display_name_snapshot,
          'note', credit.credit_note,
          'author_slug', credit.registry_author_slug_snapshot,
          'username', credit.user_username_snapshot
        )
        order by attachment.display_order, attachment.id
      )
      from editorial.resource_credits attachment
      join editorial.credits credit
        on credit.id = attachment.credit_id
      join editorial.credit_governance governance
        on governance.credit_id = credit.id
      left join editorial.external_contributors contributor
        on contributor.id = credit.external_contributor_id
      where attachment.resource_id = v_binding.resource_id
        and attachment.target_version_type = 'video_publication_version'
        and attachment.target_version_id = v_version.id
        and attachment.public_safe
        and governance.public_safe
        and governance.credit_state = 'active'
        and (
          credit.external_contributor_id is null
          or (
            contributor.contributor_state = 'active'
            and contributor.public_safe
            and contributor.consent_status in ('granted', 'not_required')
          )
        )
    ), '[]'::jsonb),
    'citations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'resource_id', attachment.resource_id,
          'resource_kind', attachment.resource_kind,
          'display_order', attachment.display_order,
          'purpose', attachment.citation_purpose,
          'anchor_type', attachment.target_anchor_type,
          'anchor', attachment.target_anchor_data,
          'citation_id', citation.id,
          'public_label', citation.public_label,
          'locator_type', citation.locator_type,
          'locator', citation.locator_data,
          'source', jsonb_build_object(
            'source_id', source_row.id,
            'source_version_id', source_version.id,
            'type', source_version.source_type,
            'title', source_version.title,
            'creator', source_version.creator_display,
            'publisher', source_version.publisher_display,
            'url',
              case
                when source_row.exposure_class = 'public'
                then source_version.source_url
                else null
              end,
            'publication_date', source_version.publication_date,
            'credit_line', source_version.credit_line
          )
        )
        order by attachment.display_order, attachment.id
      )
      from editorial.resource_citations attachment
      join editorial.citations citation
        on citation.id = attachment.citation_id
      join editorial.source_versions source_version
        on source_version.id = citation.source_version_id
      join editorial.sources source_row
        on source_row.id = citation.source_id
      where attachment.resource_id = v_binding.resource_id
        and attachment.target_version_type = 'video_publication_version'
        and attachment.target_version_id = v_version.id
        and attachment.public_safe
        and citation.public_safe
        and citation.citation_state = 'active'
        and source_row.source_state = 'active'
        and source_row.withdrawn_at is null
        and source_row.exposure_class in ('public', 'public_redacted')
        and source_row.current_approved_version_id = citation.source_version_id
    ), '[]'::jsonb)
  );
exception
  when no_data_found then
    return null;
end;
$function$;

create or replace function public.get_public_video_transcript_delivery_target(
  p_publication_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','editorial','video','media'
as $function$
declare
  v_version video.publication_versions%rowtype;
  v_usage media.usage_links%rowtype;
  v_file media.file_objects%rowtype;
begin
  if p_publication_version_id is null then
    return null;
  end if;

  select version_row.*
  into v_version
  from video.publication_versions version_row
  join editorial.video_publication_resources binding_row
    on binding_row.publication_id = version_row.publication_id
   and binding_row.resource_id = version_row.resource_id
  join editorial.resources resource_row
    on resource_row.id = binding_row.resource_id
   and resource_row.resource_kind = binding_row.resource_kind
   and resource_row.lifecycle_state = 'published'
   and resource_row.visibility = 'public'
   and resource_row.current_published_version_id = version_row.id
  where version_row.id = p_publication_version_id
    and version_row.version_kind = 'published';

  if not found then
    return null;
  end if;

  begin
    perform video.assert_publishable_publication_version(v_version.id);
  exception
    when others then
      return null;
  end;

  select usage_row.*
  into v_usage
  from media.usage_links usage_row
  join media.assets asset_row
    on asset_row.id = usage_row.asset_id
   and asset_row.asset_kind = 'transcript'
   and asset_row.lifecycle_state = 'active'
  where usage_row.target_authority = 'video'
    and usage_row.target_kind = 'video_publication'
    and usage_row.target_id = v_version.publication_id
    and usage_row.target_version_kind = 'video_publication_version'
    and usage_row.target_version_id = v_version.id
    and usage_row.usage_role = 'video_transcript'
    and usage_row.usage_state = 'active'
    and usage_row.resolution_mode = 'exact_revision'
  order by usage_row.display_order, usage_row.created_at
  limit 1;

  if not found then
    return null;
  end if;

  select file_row.*
  into v_file
  from media.asset_revisions revision_row
  join media.file_objects file_row
    on file_row.id = revision_row.original_file_object_id
  where revision_row.id = v_usage.asset_revision_id
    and revision_row.asset_id = v_usage.asset_id
    and file_row.verification_state = 'verified'
    and file_row.storage_provider = 'lightsail_media'
    and file_row.storage_path ~
        '^private-files/transcripts/.+[.]txt$'
    and file_row.mime_type = 'text/plain';

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'publication_version_id', v_version.id,
    'asset_id', v_usage.asset_id,
    'asset_revision_id', v_usage.asset_revision_id,
    'file_object_id', v_file.id,
    'storage_path', v_file.storage_path,
    'mime_type', v_file.mime_type,
    'byte_size', v_file.byte_size,
    'sha256', v_file.sha256
  );
end;
$function$;

revoke all
  on function public.get_public_video_transcript_delivery_target(uuid)
  from public, anon, authenticated;

grant execute
  on function public.get_public_video_transcript_delivery_target(uuid)
  to service_role;

commit;
