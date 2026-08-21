-- Phase 6B M1: published Audio public-read authority.
--
-- Public delivery remains a projection over the exact current published Audio
-- version. The private Audio, Media, and Trust schemas stay closed.

create or replace function public.get_public_audio_publication(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, audio, media
as $function$
declare
  v_slug text := nullif(btrim(p_slug), '');
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_version audio.publication_versions%rowtype;
  v_snapshot audio.publication_snapshots%rowtype;
  v_feed audio.publication_feed_identities%rowtype;
  v_media record;
  v_waveform_url text;
  v_transcript jsonb := null;
  v_show jsonb := null;
  v_season jsonb := null;
  v_first_published_at timestamptz;
begin
  if v_slug is null then
    return null;
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.slug = v_slug
    and publication.status = 'published'
  limit 1;

  if not found then
    return null;
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
   and resource_row.resource_kind = binding.resource_kind
   and resource_row.lifecycle_state = 'published'
   and resource_row.visibility = 'public'
  where binding.publication_id = v_publication.id
    and binding.current_published_version_id is not null;

  if not found then
    return null;
  end if;

  select version_row.*
  into v_version
  from audio.publication_versions version_row
  where version_row.id = v_binding.current_published_version_id
    and version_row.publication_id = v_publication.id
    and version_row.resource_id = v_binding.resource_id
    and version_row.version_kind = 'published'
    and version_row.status = 'published';

  if not found then
    return null;
  end if;

  select snapshot.*
  into v_snapshot
  from audio.publication_snapshots snapshot
  where snapshot.publication_id = v_publication.id
    and snapshot.resource_id = v_binding.resource_id
    and snapshot.published_version_id = v_version.id
  order by snapshot.published_at desc, snapshot.created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select feed.*
  into v_feed
  from audio.publication_feed_identities feed
  where feed.publication_id = v_publication.id
    and feed.resource_id = v_binding.resource_id;

  if not found
     or v_feed.guid is distinct from v_snapshot.guid
     or v_feed.enclosure_url is distinct from v_snapshot.enclosure_url
  then
    return null;
  end if;

  -- Re-run current governance checks against the exact immutable published
  -- version. Publication can become unavailable if Media or Transcript rights
  -- become unsafe after publication.
  begin
    select safe_media.*
    into strict v_media
    from audio.assert_publishable_version_media(v_version.id) safe_media;
  exception
    when others then
      return null;
  end;

  if v_media.delivery_variant_id is distinct from v_snapshot.enclosure_variant_id
     or v_media.delivery_url is distinct from v_snapshot.enclosure_source_url
     or v_media.mime_type is distinct from v_snapshot.enclosure_mime_type
     or v_media.byte_size is distinct from v_snapshot.enclosure_byte_size
     or v_media.sha256 is distinct from v_snapshot.enclosure_sha256
  then
    return null;
  end if;

  select file_object.delivery_url
  into v_waveform_url
  from media.variants variant
  join media.file_objects file_object
    on file_object.id = variant.derived_file_object_id
  where variant.asset_id = v_version.master_media_asset_id
    and variant.asset_revision_id = v_version.master_media_revision_id
    and variant.variant_role = 'waveform_data'
    and file_object.verification_state = 'verified'
    and file_object.delivery_url like 'https://media.wakilisha.africa/derivatives/%'
  order by variant.created_at desc
  limit 1;

  if v_version.transcript_media_asset_id is not null
     and v_version.transcript_media_revision_id is not null
  then
    select jsonb_build_object(
      'asset_id', transcript_asset.id,
      'asset_revision_id', transcript_revision.id,
      'url', transcript_file.delivery_url,
      'mime_type', transcript_file.mime_type,
      'filename', transcript_file.original_filename
    )
    into v_transcript
    from media.assets transcript_asset
    join media.asset_revisions transcript_revision
      on transcript_revision.id = v_version.transcript_media_revision_id
     and transcript_revision.asset_id = transcript_asset.id
    join media.file_objects transcript_file
      on transcript_file.id = transcript_revision.original_file_object_id
    where transcript_asset.id = v_version.transcript_media_asset_id
      and transcript_asset.asset_kind = 'transcript'
      and transcript_asset.lifecycle_state = 'active'
      and transcript_file.verification_state = 'verified'
    limit 1;
  end if;

  if v_version.show_id is not null then
    select jsonb_build_object(
      'id', show_row.id,
      'resource_id', show_binding.resource_id,
      'slug', show_row.slug,
      'title', show_row.title,
      'description', show_row.description
    )
    into v_show
    from audio.shows show_row
    join editorial.audio_show_resources show_binding
      on show_binding.show_id = show_row.id
    join editorial.resources show_resource
      on show_resource.id = show_binding.resource_id
     and show_resource.resource_kind = 'audio_show'
     and show_resource.lifecycle_state = 'active'
     and show_resource.visibility = 'public'
    where show_row.id = v_version.show_id;
  end if;

  if v_version.season_id is not null then
    select jsonb_build_object(
      'id', season_row.id,
      'resource_id', season_binding.resource_id,
      'season_number', season_row.season_number,
      'title', season_row.title,
      'description', season_row.description
    )
    into v_season
    from audio.seasons season_row
    join editorial.audio_season_resources season_binding
      on season_binding.season_id = season_row.id
    join editorial.resources season_resource
      on season_resource.id = season_binding.resource_id
     and season_resource.resource_kind = 'audio_season'
     and season_resource.lifecycle_state = 'active'
     and season_resource.visibility = 'public'
    where season_row.id = v_version.season_id
      and season_row.show_id = v_version.show_id;
  end if;

  select min(snapshot.published_at)
  into v_first_published_at
  from audio.publication_snapshots snapshot
  where snapshot.publication_id = v_publication.id
    and snapshot.resource_id = v_binding.resource_id;

  return jsonb_build_object(
    'publication_id', v_publication.id,
    'resource_id', v_binding.resource_id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'publication_kind', v_version.publication_kind,
    'canonical_path', '/audio/' || v_version.slug,
    'slug', v_version.slug,
    'title', v_version.title,
    'summary', v_version.summary,
    'episode_number', v_version.episode_number,
    'show', v_show,
    'season', v_season,
    'delivery', jsonb_build_object(
      'url', v_snapshot.enclosure_source_url,
      'mime_type', v_snapshot.enclosure_mime_type,
      'byte_size', v_snapshot.enclosure_byte_size,
      'sha256', v_snapshot.enclosure_sha256,
      'duration_seconds', v_snapshot.enclosure_duration_seconds,
      'waveform_url', v_waveform_url
    ),
    'transcript', v_transcript,
    'chapters', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'chapter_number', chapter.chapter_number,
          'start_seconds', chapter.start_seconds,
          'title', chapter.title,
          'chapter_url', chapter.chapter_url,
          'image_url', chapter.image_url
        )
        order by chapter.chapter_number
      )
      from audio.publication_version_chapters chapter
      where chapter.publication_version_id = v_version.id
    ), '[]'::jsonb),
    'feed', jsonb_build_object(
      'guid', v_snapshot.guid,
      'enclosure_url', v_snapshot.enclosure_url
    ),
    'provenance', jsonb_build_object(
      'version_number', v_version.version_number,
      'first_published_at', v_first_published_at,
      'published_at', v_snapshot.published_at
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
        and attachment.target_version_type = 'audio_publication_version'
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
            'source_id', source.id,
            'source_version_id', source_version.id,
            'type', source_version.source_type,
            'title', source_version.title,
            'creator', source_version.creator_display,
            'publisher', source_version.publisher_display,
            'url', case
              when source.exposure_class = 'public'
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
      join editorial.sources source
        on source.id = citation.source_id
      where attachment.resource_id = v_binding.resource_id
        and attachment.target_version_type = 'audio_publication_version'
        and attachment.target_version_id = v_version.id
        and attachment.public_safe
        and citation.public_safe
        and citation.citation_state = 'active'
        and source.source_state = 'active'
        and source.withdrawn_at is null
        and source.exposure_class in ('public', 'public_redacted')
        and source.current_approved_version_id = citation.source_version_id
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_public_audio_publication(text) from public;
grant execute on function public.get_public_audio_publication(text) to anon, authenticated;
