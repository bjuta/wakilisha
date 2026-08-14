-- Phase 5B Migration 223:
-- Snapshot complete Registry artist identity for every credited artist on a
-- published Playlist track before the first public Playlist is released.
--
-- This replaces only the publication materializer. Existing Registry,
-- Playlist editing, playback, Community, Save, and Follow authority remain
-- unchanged.

begin;

do $phase_5b_m223_preflight$
begin
  if to_regprocedure(
       'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: Playlist publication materializer is missing';
  end if;

  if to_regclass(
       'editorial.playlist_publication_snapshots'
     ) is null
  then
    raise exception
      'STOP: Playlist publication snapshot authority is missing';
  end if;

  if exists (
    select 1
    from editorial.playlist_publication_snapshots
  )
  then
    raise exception
      'STOP: M223 must be applied before the first Playlist publication snapshot';
  end if;

  if to_regclass(
       'public.registry_track_artists'
     ) is null
     or to_regclass(
       'public.registry_artists'
     ) is null
  then
    raise exception
      'STOP: Registry artist-credit authority is missing';
  end if;

  if exists (
    select required.column_name
    from (
      values
        ('track_id'),
        ('artist_id'),
        ('role'),
        ('is_primary'),
        ('is_featured'),
        ('credit_order'),
        ('display_credit'),
        ('status')
    ) required(column_name)
    where not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'registry_track_artists'
        and column_info.column_name = required.column_name
    )
  )
  then
    raise exception
      'STOP: Registry track-artist credit contract is incomplete';
  end if;

  if exists (
    select required.column_name
    from (
      values
        ('id'),
        ('slug'),
        ('display_name'),
        ('public_image_url'),
        ('status')
    ) required(column_name)
    where not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'registry_artists'
        and column_info.column_name = required.column_name
    )
  )
  then
    raise exception
      'STOP: Registry artist identity contract is incomplete';
  end if;
end;
$phase_5b_m223_preflight$;

create or replace function
  editorial.materialize_playlist_publication_snapshot(
    p_version_id uuid,
    p_published_at timestamptz,
    p_published_by uuid,
    p_command_receipt_id uuid
  )
returns uuid
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
  v_snapshot_id uuid := gen_random_uuid();
  v_payload jsonb;
begin
  select version.*
  into v_version
  from editorial.playlist_versions version
  where version.id = p_version_id
    and version.version_kind = 'published';

  if not found then
    raise exception
      'Public Playlist snapshot requires a published Playlist version';
  end if;

  if exists (
    select 1
    from editorial.playlist_publication_snapshots snapshot
    where snapshot.version_id = p_version_id
  ) then
    select snapshot.id
    into v_snapshot_id
    from editorial.playlist_publication_snapshots snapshot
    where snapshot.version_id = p_version_id;

    return v_snapshot_id;
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
        'playlist_item_resource_id',
          item.playlist_item_resource_id,
        'playlist_item_id',
          item.playlist_item_id,
        'position',
          item.position,
        'title',
          item.title,
        'artist_names',
          to_jsonb(item.artist_names),
        'artists',
          artist_credits.artists,
        'release_title',
          item.release_title,
        'artwork_url',
          item.artwork_url,
        'duration_ms',
          item.duration_ms,
        'notes',
          item.notes,
        'match_status',
          item.match_status,
        'registry',
          case
            when registry_track.id is null then null
            else jsonb_build_object(
              'track_id',
                registry_track.id,
              'track_slug',
                registry_track.slug,
              'track_path',
                case
                  when primary_artist.slug is not null
                    then
                      '/tracks/'
                      || primary_artist.slug
                      || '/'
                      || registry_track.slug
                  else null
                end,
              'release_id',
                registry_release.id,
              'release_slug',
                registry_release.slug,
              'release_path',
                case
                  when registry_release.id is not null
                       and primary_artist.slug is not null
                    then
                      '/releases/'
                      || primary_artist.slug
                      || '/'
                      || registry_release.slug
                  else null
                end,
              'primary_artist_id',
                primary_artist.id,
              'primary_artist_slug',
                primary_artist.slug,
              'primary_artist_name',
                primary_artist.display_name
            )
          end,
        'playback',
          jsonb_build_object(
            'playable',
              playback.playable,
            'engine',
              playback.engine,
            'provider_key',
              normalized.provider_key,
            'provider_object_id',
              normalized.provider_object_id,
            'provider_url',
              normalized.provider_url,
            'embed_url',
              normalized.embed_url,
            'preview_url',
              normalized.preview_url,
            'fallback_preview_url',
              item.preview_url,
            'apple_music_catalog_id',
              apple_music.apple_music_catalog_id
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
            'artist_id',
              artist.id,
            'artist_slug',
              artist.slug,
            'name',
              artist.display_name,
            'image_url',
              artist.public_image_url,
            'role',
              credit.role,
            'is_primary',
              credit.is_primary,
            'is_featured',
              credit.is_featured,
            'credit_order',
              credit.credit_order,
            'display_credit',
              credit.display_credit
          )
          order by
            coalesce(
              credit.credit_order,
              2147483647
            ),
            credit.is_primary desc,
            credit.is_featured desc,
            credit.id
        ),
        '[]'::jsonb
      ) as artists
    from public.registry_track_artists credit
    join public.registry_artists artist
      on artist.id =
           credit.artist_id
    where credit.track_id =
          item.registry_track_id
      and credit.status =
          'active'
      and artist.status =
          'active'
  ) artist_credits on true

  left join lateral (
    select
      coalesce(
        nullif(btrim(item.provider_key), ''),
        nullif(
          btrim(
            item.normalization_payload
              #>> '{playback,provider_key}'
          ),
          ''
        ),
        case
          when lower(
            coalesce(item.provider_url, '')
          ) like '%youtube.com/%'
            or lower(
              coalesce(item.provider_url, '')
            ) like '%youtu.be/%'
            then 'youtube'

          when lower(
            coalesce(item.provider_url, '')
          ) like '%soundcloud.com/%'
            then 'soundcloud'

          when lower(
            coalesce(item.provider_url, '')
          ) like '%music.apple.com/%'
            then 'apple_music'

          when lower(
            coalesce(item.provider_url, '')
          ) like '%open.spotify.com/%'
            then 'spotify'

          else null
        end
      ) as provider_key,

      coalesce(
        nullif(btrim(item.provider_track_id), ''),
        nullif(
          btrim(
            item.normalization_payload
              #>> '{playback,provider_object_id}'
          ),
          ''
        )
      ) as provider_object_id,

      coalesce(
        nullif(btrim(item.provider_url), ''),
        nullif(
          btrim(
            item.normalization_payload
              #>> '{playback,provider_url}'
          ),
          ''
        )
      ) as provider_url,

      nullif(
        btrim(
          item.normalization_payload
            #>> '{playback,embed_url}'
        ),
        ''
      ) as embed_url,

      coalesce(
        nullif(btrim(item.preview_url), ''),
        nullif(
          btrim(
            item.normalization_payload
              #>> '{playback,preview_url}'
          ),
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
          select
            nullif(
              btrim(
                link.provider_track_id
              ),
              ''
            )
          from public.registry_track_provider_links link
          where link.track_id =
                item.registry_track_id
            and link.provider_key =
                'apple_music'
            and link.match_status =
                'matched'
          order by
            link.match_confidence desc,
            link.last_checked_at desc,
            link.created_at desc
          limit 1
        ),

        nullif(
          btrim(
            registry_track.metadata
              ->> 'apple_music_track_id'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              ->> 'apple_music_id'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              ->> 'appleMusicId'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              ->> 'apple_music_catalog_id'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              ->> 'appleMusicCatalogId'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{apple_music,id}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{apple_music,catalog_id}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{appleMusic,id}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{appleMusic,catalogId}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{providers,apple_music,id}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{providers,apple_music,catalog_id}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{provider_ids,apple_music}'
          ),
          ''
        ),

        nullif(
          btrim(
            registry_track.metadata
              #>> '{source_ids,apple_music}'
          ),
          ''
        )
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

  select coalesce(
    min(snapshot.first_published_at),
    p_published_at
  )
  into v_first_published_at
  from editorial.playlist_publication_snapshots snapshot
  where snapshot.playlist_id = v_version.playlist_id;

  v_payload := jsonb_build_object(
    'playlist_id',
      v_version.playlist_id,
    'resource_id',
      v_version.resource_id,
    'version_id',
      v_version.id,
    'version_number',
      v_version.version_number,
    'slug',
      v_version.slug,
    'title',
      v_version.title,
    'description',
      v_version.description,
    'curator_label',
      v_version.curator_label,
    'cover',
      case
        when v_version.cover_asset_id is null
          then null
        else jsonb_build_object(
          'asset_id',
            v_version.cover_asset_id,
          'asset_revision_id',
            v_version.cover_asset_revision_id,
          'url',
            v_cover.safe_delivery_url,
          'mime_type',
            v_cover.resolved_mime_type,
          'width',
            v_cover.width,
          'height',
            v_cover.height,
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
    'item_count',
      v_version.item_count,
    'tracks',
      v_tracks,
    'provenance',
      jsonb_build_object(
        'version_number',
          v_version.version_number,
        'content_fingerprint',
          v_version.content_fingerprint,
        'source_authority_revision',
          v_version.source_authority_revision,
        'published_at',
          p_published_at,
        'first_published_at',
          v_first_published_at,
        'published_by',
          p_published_by,
        'command_receipt_id',
          p_command_receipt_id
      )
  );

  insert into editorial.playlist_publication_snapshots (
    id,
    resource_id,
    playlist_id,
    version_id,
    command_receipt_id,
    slug,
    title,
    description,
    curator_label,
    cover_url,
    cover_alt_text,
    cover_caption,
    cover_credit,
    item_count,
    content_fingerprint,
    payload,
    published_at,
    first_published_at,
    published_by
  )
  values (
    v_snapshot_id,
    v_version.resource_id,
    v_version.playlist_id,
    v_version.id,
    p_command_receipt_id,
    v_version.slug,
    v_version.title,
    v_version.description,
    v_version.curator_label,
    case
      when v_version.cover_asset_id is null
        then null
      else v_cover.safe_delivery_url
    end,
    case
      when v_version.cover_asset_id is null
        then null
      else coalesce(
        v_version.cover_alt_text_snapshot,
        v_cover.approved_alt_text
      )
    end,
    case
      when v_version.cover_asset_id is null
        then null
      else coalesce(
        v_version.cover_caption_snapshot,
        v_cover.approved_caption
      )
    end,
    case
      when v_version.cover_asset_id is null
        then null
      else coalesce(
        v_version.cover_credit_snapshot,
        v_cover.approved_credit
      )
    end,
    v_version.item_count,
    v_version.content_fingerprint,
    v_payload,
    p_published_at,
    v_first_published_at,
    p_published_by
  );

  return v_snapshot_id;
end;
$function$;

revoke all
on function
  editorial.materialize_playlist_publication_snapshot(
    uuid,
    timestamp with time zone,
    uuid,
    uuid
  )
from public, anon, authenticated;

grant execute
on function
  editorial.materialize_playlist_publication_snapshot(
    uuid,
    timestamp with time zone,
    uuid,
    uuid
  )
to service_role;

commit;
