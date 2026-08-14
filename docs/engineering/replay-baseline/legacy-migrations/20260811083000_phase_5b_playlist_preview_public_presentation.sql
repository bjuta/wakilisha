-- Phase 5B Migration 233:
-- Resolve a nonce-bound immutable Playlist version into the same presentation
-- contract consumed by the public Playlist renderer, without publishing it or
-- creating a publication snapshot.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_5b_m233_preflight$
declare
  v_preview_definition text;
  v_materializer_definition text;
begin
  if to_regprocedure(
       'public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)'
     ) is null
     or to_regprocedure(
       'public.resolve_playlist_preview_nonce(text)'
     ) is null
     or to_regprocedure(
       'editorial.playlist_version_snapshot_json(uuid)'
     ) is null
  then
    raise exception
      'STOP: M232 Playlist Preview authority is incomplete';
  end if;

  if to_regprocedure(
       'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: Public Playlist presentation dependencies are incomplete';
  end if;

  if to_regclass('public.wk_playlist_preview_links') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_version_items') is null
     or to_regclass('editorial.playlist_publication_snapshots') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_track_provider_links') is null
  then
    raise exception
      'STOP: Required Playlist Preview read-model tables are missing';
  end if;

  if to_regprocedure(
       'editorial.playlist_version_public_presentation_json(uuid)'
     ) is not null
  then
    raise exception
      'STOP: M233 Playlist Preview presentation helper already exists';
  end if;

  select pg_get_functiondef(
    'public.resolve_playlist_preview_nonce(text)'::regprocedure
  )
  into v_preview_definition;

  if position(
       'playlist_version_snapshot_json'
       in v_preview_definition
     ) = 0
  then
    raise exception
      'STOP: M232 Playlist Preview resolver no longer matches the accepted source contract';
  end if;

  select pg_get_functiondef(
    'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'::regprocedure
  )
  into v_materializer_definition;

  if position(
       'artist_credits.artists'
       in v_materializer_definition
     ) = 0
     or position(
       'apple_music_catalog_id'
       in v_materializer_definition
     ) = 0
     or position(
       'resolve_media_asset_delivery'
       in v_materializer_definition
     ) = 0
  then
    raise exception
      'STOP: Published Playlist presentation authority changed before M233';
  end if;
end;
$phase_5b_m233_preflight$;

create or replace function
  editorial.playlist_version_public_presentation_json(
    p_version_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_version editorial.playlist_versions%rowtype;
  v_cover record;
  v_tracks jsonb;
  v_first_published_at timestamptz;
  v_credits jsonb;
  v_citations jsonb;
  v_corrections jsonb;
  v_payload jsonb;
begin
  select version.*
  into v_version
  from editorial.playlist_versions version
  where version.id = p_version_id;

  if not found then
    return null;
  end if;

  select
    null::uuid as logical_asset_id,
    null::text as resolved_mode,
    null::uuid as resolved_asset_revision_id,
    null::uuid as resolved_file_object_id,
    null::text as safe_delivery_url,
    null::text as resolved_mime_type,
    null::integer as width,
    null::integer as height,
    null::numeric as duration_seconds,
    null::text as approved_alt_text,
    null::text as approved_caption,
    null::text as approved_credit
  into v_cover;

  if v_version.cover_asset_id is not null then
    select *
    into v_cover
    from public.resolve_media_asset_delivery(
      v_version.cover_asset_id,
      null,
      v_version.cover_asset_revision_id,
      null
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playlist_item_resource_id', item.playlist_item_resource_id,
        'playlist_item_id', item.playlist_item_id,
        'position', item.position,
        'title', item.title,
        'artist_names', to_jsonb(item.artist_names),
        'artists', artist_credits.artists,
        'release_title', item.release_title,
        'artwork_url', item.artwork_url,
        'duration_ms', item.duration_ms,
        'notes', item.notes,
        'match_status', item.match_status,
        'registry',
          case
            when registry_track.id is null then null
            else jsonb_build_object(
              'track_id', registry_track.id,
              'track_slug', registry_track.slug,
              'track_path',
                case
                  when primary_artist.slug is not null
                    then '/tracks/' || primary_artist.slug || '/' || registry_track.slug
                  else null
                end,
              'release_id', registry_release.id,
              'release_slug', registry_release.slug,
              'release_path',
                case
                  when registry_release.id is not null
                       and primary_artist.slug is not null
                    then '/releases/' || primary_artist.slug || '/' || registry_release.slug
                  else null
                end,
              'primary_artist_id', primary_artist.id,
              'primary_artist_slug', primary_artist.slug,
              'primary_artist_name', primary_artist.display_name
            )
          end,
        'playback',
          jsonb_build_object(
            'playable', playback.playable,
            'engine', playback.engine,
            'provider_key', normalized.provider_key,
            'provider_object_id', normalized.provider_object_id,
            'provider_url', normalized.provider_url,
            'embed_url', normalized.embed_url,
            'preview_url', normalized.preview_url,
            'fallback_preview_url', item.preview_url,
            'apple_music_catalog_id', apple_music.apple_music_catalog_id
          )
      )
      order by item.position
    ),
    '[]'::jsonb
  )
  into v_tracks
  from editorial.playlist_version_items item

  left join public.registry_tracks registry_track
    on registry_track.id = item.registry_track_id
   and registry_track.status = 'active'

  left join public.registry_releases registry_release
    on registry_release.id =
         coalesce(
           item.registry_release_id,
           registry_track.release_id
         )
   and registry_release.status = 'active'

  left join lateral (
    select
      artist.id,
      artist.slug,
      artist.display_name
    from public.registry_track_artists credit
    join public.registry_artists artist
      on artist.id = credit.artist_id
    where credit.track_id = item.registry_track_id
      and credit.status = 'active'
      and artist.status = 'active'
    order by
      credit.is_primary desc,
      credit.id
    limit 1
  ) primary_artist on true

  left join lateral (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'artist_id', artist.id,
            'artist_slug', artist.slug,
            'name', artist.display_name,
            'image_url', artist.public_image_url,
            'role', credit.role,
            'is_primary', credit.is_primary,
            'is_featured', credit.is_featured,
            'credit_order', credit.credit_order,
            'display_credit', credit.display_credit
          )
          order by
            coalesce(credit.credit_order, 2147483647),
            credit.is_primary desc,
            credit.is_featured desc,
            credit.id
        ),
        '[]'::jsonb
      ) as artists
    from public.registry_track_artists credit
    join public.registry_artists artist
      on artist.id = credit.artist_id
    where credit.track_id = item.registry_track_id
      and credit.status = 'active'
      and artist.status = 'active'
  ) artist_credits on true

  left join lateral (
    select
      coalesce(
        nullif(btrim(item.provider_key), ''),
        nullif(
          btrim(item.normalization_payload #>> '{playback,provider_key}'),
          ''
        ),
        case
          when lower(coalesce(item.provider_url, '')) like '%youtube.com/%'
            or lower(coalesce(item.provider_url, '')) like '%youtu.be/%'
            then 'youtube'
          when lower(coalesce(item.provider_url, '')) like '%soundcloud.com/%'
            then 'soundcloud'
          when lower(coalesce(item.provider_url, '')) like '%music.apple.com/%'
            then 'apple_music'
          when lower(coalesce(item.provider_url, '')) like '%open.spotify.com/%'
            then 'spotify'
          else null
        end
      ) as provider_key,

      coalesce(
        nullif(btrim(item.provider_track_id), ''),
        nullif(
          btrim(item.normalization_payload #>> '{playback,provider_object_id}'),
          ''
        )
      ) as provider_object_id,

      coalesce(
        nullif(btrim(item.provider_url), ''),
        nullif(
          btrim(item.normalization_payload #>> '{playback,provider_url}'),
          ''
        )
      ) as provider_url,

      nullif(
        btrim(item.normalization_payload #>> '{playback,embed_url}'),
        ''
      ) as embed_url,

      coalesce(
        nullif(btrim(item.preview_url), ''),
        nullif(
          btrim(item.normalization_payload #>> '{playback,preview_url}'),
          ''
        )
      ) as preview_url
  ) normalized on true

  left join lateral (
    select
      coalesce(
        case
          when normalized.provider_key = 'apple_music'
            then normalized.provider_object_id
          else null
        end,

        (
          select nullif(btrim(link.provider_track_id), '')
          from public.registry_track_provider_links link
          where link.track_id = item.registry_track_id
            and link.provider_key = 'apple_music'
            and link.match_status = 'matched'
          order by
            link.match_confidence desc,
            link.last_checked_at desc,
            link.created_at desc
          limit 1
        ),

        nullif(btrim(registry_track.metadata ->> 'apple_music_track_id'), ''),
        nullif(btrim(registry_track.metadata ->> 'apple_music_id'), ''),
        nullif(btrim(registry_track.metadata ->> 'appleMusicId'), ''),
        nullif(btrim(registry_track.metadata ->> 'apple_music_catalog_id'), ''),
        nullif(btrim(registry_track.metadata ->> 'appleMusicCatalogId'), ''),
        nullif(btrim(registry_track.metadata #>> '{apple_music,id}'), ''),
        nullif(btrim(registry_track.metadata #>> '{apple_music,catalog_id}'), ''),
        nullif(btrim(registry_track.metadata #>> '{appleMusic,id}'), ''),
        nullif(btrim(registry_track.metadata #>> '{appleMusic,catalogId}'), ''),
        nullif(btrim(registry_track.metadata #>> '{providers,apple_music,id}'), ''),
        nullif(btrim(registry_track.metadata #>> '{providers,apple_music,catalog_id}'), ''),
        nullif(btrim(registry_track.metadata #>> '{provider_ids,apple_music}'), ''),
        nullif(btrim(registry_track.metadata #>> '{source_ids,apple_music}'), '')
      ) as apple_music_catalog_id
  ) apple_music on true

  left join lateral (
    select
      case
        when normalized.provider_key = 'youtube'
             and normalized.provider_object_id is not null
          then 'youtube'
        when normalized.provider_key = 'soundcloud'
             and normalized.provider_url is not null
          then 'soundcloud'
        when normalized.provider_key = 'apple_music'
             and normalized.provider_object_id is not null
          then 'apple_music'
        when normalized.preview_url is not null
          then 'audio'
        else 'unavailable'
      end as engine,

      case
        when normalized.provider_key = 'youtube'
             and normalized.provider_object_id is not null
          then true
        when normalized.provider_key = 'soundcloud'
             and normalized.provider_url is not null
          then true
        when normalized.provider_key = 'apple_music'
             and normalized.provider_object_id is not null
          then true
        when normalized.preview_url is not null
          then true
        else false
      end as playable
  ) playback on true

  where item.playlist_version_id = p_version_id;

  select min(snapshot.first_published_at)
  into v_first_published_at
  from editorial.playlist_publication_snapshots snapshot
  where snapshot.playlist_id = v_version.playlist_id;

  select coalesce(
    jsonb_agg(
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
      order by
        attachment.resource_kind,
        attachment.resource_id,
        attachment.display_order
    ),
    '[]'::jsonb
  )
  into v_credits
  from editorial.resource_credits attachment
  join editorial.credits credit
    on credit.id = attachment.credit_id
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  left join editorial.external_contributors contributor
    on contributor.id = credit.external_contributor_id
  where attachment.target_version_type = 'playlist_version'
    and attachment.target_version_id = v_version.id
    and attachment.public_safe
    and governance.public_safe
    and governance.credit_state = 'active'
    and (
      credit.external_contributor_id is null
      or (
        contributor.contributor_state = 'active'
        and contributor.public_safe
        and contributor.consent_status in (
          'granted',
          'not_required'
        )
      )
    );

  select coalesce(
    jsonb_agg(
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
        'source',
          jsonb_build_object(
            'source_id', source.id,
            'source_version_id', source_version.id,
            'type', source_version.source_type,
            'title', source_version.title,
            'creator', source_version.creator_display,
            'publisher', source_version.publisher_display,
            'url',
              case
                when source.exposure_class = 'public'
                  then source_version.source_url
                else null
              end,
            'publication_date', source_version.publication_date,
            'credit_line', source_version.credit_line
          )
      )
      order by
        attachment.resource_kind,
        attachment.resource_id,
        attachment.display_order
    ),
    '[]'::jsonb
  )
  into v_citations
  from editorial.resource_citations attachment
  join editorial.citations citation
    on citation.id = attachment.citation_id
  join editorial.source_versions source_version
    on source_version.id = citation.source_version_id
  join editorial.sources source
    on source.id = citation.source_id
  where attachment.target_version_type = 'playlist_version'
    and attachment.target_version_id = v_version.id
    and attachment.public_safe
    and citation.public_safe
    and citation.citation_state = 'active'
    and source.source_state = 'active'
    and source.withdrawn_at is null
    and source.exposure_class in (
      'public',
      'public_redacted'
    )
    and source.current_approved_version_id =
          citation.source_version_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', note.id,
        'resource_id', note.affected_resource_id,
        'resource_kind', note.affected_resource_kind,
        'note', note.note_text,
        'published_at', note.published_at
      )
      order by note.published_at
    ),
    '[]'::jsonb
  )
  into v_corrections
  from editorial.correction_public_notes note
  where (
    note.affected_resource_id = v_version.resource_id
    or note.affected_resource_id in (
      select
        nullif(
          track ->> 'playlist_item_resource_id',
          ''
        )::uuid
      from jsonb_array_elements(v_tracks) track
    )
  )
  and not exists (
    select 1
    from editorial.correction_public_notes newer
    where newer.supersedes_note_id = note.id
  );

  v_payload := jsonb_build_object(
    'playlist_id', v_version.playlist_id,
    'resource_id', v_version.resource_id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'slug', v_version.slug,
    'title', v_version.title,
    'description', v_version.description,
    'curator_label', v_version.curator_label,
    'cover',
      case
        when v_version.cover_asset_id is null
          then null
        else jsonb_build_object(
          'asset_id', v_version.cover_asset_id,
          'asset_revision_id', v_version.cover_asset_revision_id,
          'url', v_cover.safe_delivery_url,
          'mime_type', v_cover.resolved_mime_type,
          'width', v_cover.width,
          'height', v_cover.height,
          'alt_text',
            coalesce(
              v_version.cover_alt_text_snapshot,
              v_cover.approved_alt_text
            ),
          'caption',
            coalesce(
              v_version.cover_caption_snapshot,
              v_cover.approved_caption
            ),
          'credit',
            coalesce(
              v_version.cover_credit_snapshot,
              v_cover.approved_credit
            )
        )
      end,
    'item_count', v_version.item_count,
    'tracks', v_tracks,
    'provenance',
      jsonb_build_object(
        'version_number', v_version.version_number,
        'content_fingerprint', v_version.content_fingerprint,
        'source_authority_revision', v_version.source_authority_revision,
        'published_at', null,
        'first_published_at', v_first_published_at,
        'published_by', null,
        'command_receipt_id', null
      ),
    'credits', v_credits,
    'citations', v_citations,
    'corrections', v_corrections
  );

  return v_payload;
end;
$function$;

revoke all
on function
  editorial.playlist_version_public_presentation_json(uuid)
from public, anon, authenticated;

create or replace function
  public.resolve_playlist_preview_nonce(
    p_nonce text
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_link public.wk_playlist_preview_links%rowtype;
  v_payload jsonb;
begin
  select link.*
  into v_link
  from public.wk_playlist_preview_links link
  where link.nonce = p_nonce
    and link.revoked_at is null
    and link.expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  v_payload :=
    editorial.playlist_version_public_presentation_json(
      v_link.version_id
    );

  if v_payload is null then
    return null;
  end if;

  return
    v_payload
    ||
    jsonb_build_object(
      'preview_nonce', v_link.nonce,
      'preview_expires_at', v_link.expires_at
    );
end;
$function$;

revoke all
on function public.resolve_playlist_preview_nonce(text)
from public;

grant execute
on function public.resolve_playlist_preview_nonce(text)
to anon, authenticated, service_role;

commit;
