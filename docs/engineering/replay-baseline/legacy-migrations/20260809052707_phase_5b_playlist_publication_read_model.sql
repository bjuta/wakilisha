-- Phase 5B Migration 218:
-- Playlist publication authority and cached public read model.
--
-- Phase 5A remains the authority for Playlist identity, editing, ordering,
-- Registry intake, Review, immutable submitted and approved versions, Media
-- cover selection, and version-bound Trust.
--
-- M218 adds only the approved-to-published transition and public read model.

begin;

do $phase_5b_m218_preflight$
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_version_items') is null
  then
    raise exception
      'STOP: Phase 5A Playlist authority is incomplete';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'playlist_resources'
      and column_name = 'current_published_version_id'
  ) then
    raise exception
      'STOP: Playlist published-version pointer is missing';
  end if;

  if not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'publish_playlists'
  ) then
    raise exception
      'STOP: publish_playlists capability is missing';
  end if;

  if to_regprocedure(
       'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: Governed Media delivery resolver is missing';
  end if;

  if to_regclass(
       'editorial.playlist_publication_snapshots'
     ) is not null
  then
    raise exception
      'STOP: Playlist publication snapshot authority already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type = 'playlist.publish'
  ) then
    raise exception
      'STOP: playlist.publish command type already exists';
  end if;

  if to_regprocedure(
       'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.get_public_playlist(text)'
     ) is not null
     or to_regprocedure(
       'public.list_public_playlists(integer,timestamp with time zone,uuid)'
     ) is not null
  then
    raise exception
      'STOP: One or more M218 public functions already exist';
  end if;
end;
$phase_5b_m218_preflight$;

-- ---------------------------------------------------------------------------
-- Governed publication command registration.
-- ---------------------------------------------------------------------------

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values (
  'playlist.publish',
  'playlist.publish.sync',
  'playlist.publish.accepted',
  'playlist.publish.succeeded',
  'playlist.publish.failed',
  'playlist.publish.retry_scheduled',
  true
);

-- ---------------------------------------------------------------------------
-- Playlist publication capability boundary.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.current_user_can_publish_playlist(
    p_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.playlist_resources binding
      where binding.resource_id = p_resource_id
    )
    and (
      coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'publish_playlists'
        ),
        false
      )
    );
$function$;

revoke all
on function
  editorial.current_user_can_publish_playlist(uuid)
from public, anon;

grant execute
on function
  editorial.current_user_can_publish_playlist(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Extend the existing tightly scoped Trust-copy authorization by one
-- lifecycle transition: approved -> published.
-- ---------------------------------------------------------------------------

create or replace function
  platform_private.begin_playlist_trust_copy_authorization(
    p_source_version_id uuid,
    p_target_version_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_target editorial.playlist_versions%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select source.*
  into v_source
  from editorial.playlist_versions source
  where source.id = p_source_version_id;

  if not found then
    raise exception
      'Playlist Trust copy source version does not exist';
  end if;

  select target.*
  into v_target
  from editorial.playlist_versions target
  where target.id = p_target_version_id;

  if not found then
    raise exception
      'Playlist Trust copy target version does not exist';
  end if;

  if v_source.resource_id is distinct from v_target.resource_id
     or v_source.playlist_id is distinct from v_target.playlist_id
     or v_source.content_fingerprint
          is distinct from v_target.content_fingerprint
     or v_source.item_count
          is distinct from v_target.item_count
     or v_source.source_authority_revision
          is distinct from v_target.source_authority_revision
  then
    raise exception
      'Playlist Trust can only be copied between exact snapshots of the same Playlist';
  end if;

  if not (
    (
      v_source.version_kind = 'working'
      and v_target.version_kind = 'submitted'
    )
    or
    (
      v_source.version_kind = 'submitted'
      and v_target.version_kind = 'approved'
    )
    or
    (
      v_source.version_kind = 'approved'
      and v_target.version_kind = 'published'
    )
  ) then
    raise exception
      'Unsupported Playlist Trust copy transition: % to %',
      v_source.version_kind,
      v_target.version_kind;
  end if;

  insert into
    platform_private.playlist_trust_copy_authorizations (
      authorization_token,
      backend_pid,
      transaction_id,
      source_version_id,
      target_version_id
    )
  values (
    v_token,
    pg_backend_pid(),
    txid_current(),
    p_source_version_id,
    p_target_version_id
  );

  perform set_config(
    'wakilisha.playlist_trust_copy_token',
    v_token::text,
    true
  );

  return v_token;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Exact approved -> published version copy.
-- ---------------------------------------------------------------------------

create or replace function
  editorial.copy_playlist_published_version(
    p_source_version_id uuid,
    p_actor_id uuid
  )
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text,
  item_count integer
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'platform_private'
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_copy_authorization uuid;
begin
  select source.*
  into v_source
  from editorial.playlist_versions source
  where source.id = p_source_version_id;

  if not found then
    raise exception
      'Source Playlist version does not exist';
  end if;

  if v_source.version_kind <> 'approved' then
    raise exception
      'Only an approved Playlist version can be published';
  end if;

  perform 1
  from public.wk_playlists playlist
  where playlist.id = v_source.playlist_id
  for update;

  select coalesce(
    max(version.version_number),
    0
  ) + 1
  into v_version_number
  from editorial.playlist_versions version
  where version.resource_id = v_source.resource_id;

  v_version_id := gen_random_uuid();

  insert into editorial.playlist_versions (
    id,
    resource_id,
    playlist_id,
    version_number,
    version_kind,
    source_authority_revision,
    title,
    slug,
    description,
    curator_label,
    status,
    metadata,
    item_count,
    content_fingerprint,
    cover_asset_id,
    cover_asset_revision_id,
    cover_placement_data,
    cover_display_order,
    cover_alt_text_snapshot,
    cover_caption_snapshot,
    cover_credit_snapshot,
    created_by
  )
  values (
    v_version_id,
    v_source.resource_id,
    v_source.playlist_id,
    v_version_number,
    'published',
    v_source.source_authority_revision,
    v_source.title,
    v_source.slug,
    v_source.description,
    v_source.curator_label,
    'published',
    v_source.metadata,
    v_source.item_count,
    v_source.content_fingerprint,
    v_source.cover_asset_id,
    v_source.cover_asset_revision_id,
    v_source.cover_placement_data,
    v_source.cover_display_order,
    v_source.cover_alt_text_snapshot,
    v_source.cover_caption_snapshot,
    v_source.cover_credit_snapshot,
    p_actor_id
  );

  insert into editorial.playlist_version_trust_revisions (
    playlist_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    v_version_id,
    1,
    1,
    p_actor_id,
    now()
  );

  insert into editorial.playlist_version_items (
    playlist_version_id,
    playlist_item_resource_id,
    playlist_item_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
    title,
    artist_names,
    release_title,
    artwork_url,
    preview_url,
    duration_ms,
    isrc,
    match_status,
    match_confidence,
    normalization_payload,
    notes
  )
  select
    v_version_id,
    item.playlist_item_resource_id,
    item.playlist_item_id,
    item.position,
    item.registry_track_id,
    item.registry_release_id,
    item.provider_key,
    item.provider_track_id,
    item.provider_url,
    item.title,
    item.artist_names,
    item.release_title,
    item.artwork_url,
    item.preview_url,
    item.duration_ms,
    item.isrc,
    item.match_status,
    item.match_confidence,
    item.normalization_payload,
    item.notes
  from editorial.playlist_version_items item
  where item.playlist_version_id = p_source_version_id
  order by item.position;

  v_copy_authorization :=
    platform_private.begin_playlist_trust_copy_authorization(
      p_source_version_id,
      v_version_id
    );

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    citation.resource_id,
    citation.resource_kind,
    'playlist_version',
    v_version_id,
    citation.citation_id,
    citation.citation_purpose,
    citation.target_anchor_type,
    citation.target_anchor_data,
    citation.display_order,
    citation.public_safe,
    citation.created_by
  from editorial.resource_citations citation
  where citation.target_version_type = 'playlist_version'
    and citation.target_version_id = p_source_version_id;

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  select
    credit.resource_id,
    credit.resource_kind,
    'playlist_version',
    v_version_id,
    credit.credit_id,
    credit.display_order,
    credit.is_primary,
    credit.public_safe,
    credit.created_by
  from editorial.resource_credits credit
  where credit.target_version_type = 'playlist_version'
    and credit.target_version_id = p_source_version_id;

  perform
    platform_private.end_playlist_trust_copy_authorization(
      v_copy_authorization
    );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_source.content_fingerprint;
  item_count := v_source.item_count;
  return next;
end;
$function$;

revoke all
on function
  editorial.copy_playlist_published_version(uuid,uuid)
from public, anon, authenticated;

grant execute
on function
  editorial.copy_playlist_published_version(uuid,uuid)
to service_role;

-- ---------------------------------------------------------------------------
-- Immutable cached public Playlist snapshots.
-- ---------------------------------------------------------------------------

create table editorial.playlist_publication_snapshots (
  id uuid primary key default gen_random_uuid(),

  resource_id uuid not null,
  playlist_id uuid not null,
  version_id uuid not null,

  command_receipt_id uuid not null,

  slug text not null,
  title text not null,
  description text,
  curator_label text,

  cover_url text,
  cover_alt_text text,
  cover_caption text,
  cover_credit text,

  item_count integer not null,
  content_fingerprint text not null,

  payload jsonb not null,

  published_at timestamptz not null,
  first_published_at timestamptz not null,
  published_by uuid,

  created_at timestamptz not null default now(),

  constraint playlist_publication_snapshots_binding_fkey
    foreign key (resource_id, playlist_id)
    references editorial.playlist_resources(
      resource_id,
      playlist_id
    )
    on update cascade
    on delete restrict,

  constraint playlist_publication_snapshots_version_fkey
    foreign key (
      version_id,
      resource_id,
      playlist_id
    )
    references editorial.playlist_versions(
      id,
      resource_id,
      playlist_id
    )
    on update cascade
    on delete restrict,

  constraint playlist_publication_snapshots_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint playlist_publication_snapshots_actor_fkey
    foreign key (published_by)
    references auth.users(id)
    on delete set null,

  constraint playlist_publication_snapshots_version_key
    unique (version_id),

  constraint playlist_publication_snapshots_item_count_check
    check (item_count >= 0),

  constraint playlist_publication_snapshots_payload_check
    check (jsonb_typeof(payload) = 'object'),

  constraint playlist_publication_snapshots_slug_check
    check (nullif(btrim(slug), '') is not null),

  constraint playlist_publication_snapshots_title_check
    check (nullif(btrim(title), '') is not null)
);

create index
  playlist_publication_snapshots_playlist_published_idx
on editorial.playlist_publication_snapshots (
  playlist_id,
  published_at desc
);

create index
  playlist_publication_snapshots_public_order_idx
on editorial.playlist_publication_snapshots (
  published_at desc,
  id desc
);

alter table editorial.playlist_publication_snapshots
  enable row level security;

revoke all
on editorial.playlist_publication_snapshots
from public, anon, authenticated;

grant select
on editorial.playlist_publication_snapshots
to service_role;

create or replace function
  editorial.protect_playlist_publication_snapshot()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Playlist publication snapshots are immutable';
end;
$function$;

create trigger playlist_publication_snapshots_immutable
before update or delete
on editorial.playlist_publication_snapshots
for each row
execute function
  editorial.protect_playlist_publication_snapshot();

-- ---------------------------------------------------------------------------
-- Materialize the public rendering snapshot.
-- ---------------------------------------------------------------------------

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
              item.preview_url
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

-- ---------------------------------------------------------------------------
-- Governed publish command.
-- ---------------------------------------------------------------------------

create or replace function
  public.publish_playlist_version(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_approved_version_id uuid,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_approved editorial.playlist_versions%rowtype;
  v_published record;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_snapshot_id uuid;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
  v_source_version_id uuid;
  v_published_at timestamptz := now();
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if v_binding.resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_publish_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist publication permission is required';
  end if;

  v_source_version_id :=
    coalesce(
      p_approved_version_id,
      v_binding.current_approved_version_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.publish',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'approved_version_id',
        v_source_version_id,
      'note',
        nullif(btrim(p_note), ''),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be published.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status <> 'approved'
        or v_source_version_id is null
        or v_binding.current_approved_version_id
             is distinct from v_source_version_id
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_publishable',
      'Only the exact current approved Playlist version can be published.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status,
        'current_approved_version_id',
          v_binding.current_approved_version_id
      )
    );

  else
    select approved.*
    into v_approved
    from editorial.playlist_versions approved
    where approved.id = v_source_version_id
      and approved.resource_id =
            v_binding.resource_id
      and approved.playlist_id =
            p_playlist_id
      and approved.version_kind = 'approved';

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'approved_version_invalid',
        'The approved Playlist version is no longer publishable.',
        jsonb_build_object(
          'playlist_id',
            p_playlist_id,
          'approved_version_id',
            v_source_version_id
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      select *
      into v_published
      from editorial.copy_playlist_published_version(
        v_approved.id,
        v_actor
      );

      update editorial.playlist_resources binding_update
      set current_published_version_id =
            v_published.version_id
      where binding_update.playlist_id =
              p_playlist_id;

      update editorial.resources resource
      set
        current_published_version_id =
          v_published.version_id,
        lifecycle_state = 'published',
        visibility = 'public',
        updated_at = now()
      where resource.id =
              v_binding.resource_id;

      update public.wk_playlists playlist
      set
        status = 'published',
        published_at = v_published_at,
        canonical_url =
          'https://wakilisha.africa/playlists/'
          || v_approved.slug,
        authority_revision =
          playlist.authority_revision + 1,
        updated_at = now()
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      v_snapshot_id :=
        editorial.materialize_playlist_publication_snapshot(
          v_published.version_id,
          v_published_at,
          v_actor,
          v_begin.command_receipt_id
        );

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'approved_version_id',
          v_approved.id,
        'version_id',
          v_published.version_id,
        'version_number',
          v_published.version_number,
        'publication_snapshot_id',
          v_snapshot_id,
        'published_at',
          v_published_at,
        'lifecycle_status',
          'published',
        'correlation_id',
          v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.publish_playlist_version(
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.publish_playlist_version(
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public collection read.
-- Cursor order is published_at DESC, snapshot id DESC.
-- ---------------------------------------------------------------------------

create or replace function
  public.list_public_playlists(
    p_limit integer default 24,
    p_before_published_at timestamptz default null,
    p_before_snapshot_id uuid default null
  )
returns table(
  snapshot_id uuid,
  playlist_id uuid,
  resource_id uuid,
  version_id uuid,
  slug text,
  title text,
  description text,
  curator_label text,
  cover_url text,
  cover_alt_text text,
  item_count integer,
  published_at timestamptz,
  first_published_at timestamptz
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
  select
    snapshot.id,
    snapshot.playlist_id,
    snapshot.resource_id,
    snapshot.version_id,
    snapshot.slug,
    snapshot.title,
    snapshot.description,
    snapshot.curator_label,
    snapshot.cover_url,
    snapshot.cover_alt_text,
    snapshot.item_count,
    snapshot.published_at,
    snapshot.first_published_at
  from editorial.playlist_publication_snapshots snapshot
  join editorial.playlist_resources binding
    on binding.resource_id = snapshot.resource_id
   and binding.playlist_id = snapshot.playlist_id
   and binding.current_published_version_id =
         snapshot.version_id
  where (
    p_before_published_at is null
    or (
      snapshot.published_at,
      snapshot.id
    ) < (
      p_before_published_at,
      coalesce(
        p_before_snapshot_id,
        'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
      )
    )
  )
  order by
    snapshot.published_at desc,
    snapshot.id desc
  limit least(
    greatest(coalesce(p_limit, 24), 1),
    50
  );
$function$;

revoke all
on function public.list_public_playlists(
  integer,
  timestamp with time zone,
  uuid
)
from public;

grant execute
on function public.list_public_playlists(
  integer,
  timestamp with time zone,
  uuid
)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public detail read.
--
-- Core composition is cached in the immutable publication snapshot.
-- Governance-sensitive Trust and correction presentation is resolved at read
-- time so later Source or Credit withdrawal takes effect without republishing.
-- ---------------------------------------------------------------------------

create or replace function
  public.get_public_playlist(
    p_slug text
  )
returns jsonb
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  with active_snapshot as (
    select snapshot.*
    from editorial.playlist_publication_snapshots snapshot
    join editorial.playlist_resources binding
      on binding.resource_id = snapshot.resource_id
     and binding.playlist_id = snapshot.playlist_id
     and binding.current_published_version_id =
           snapshot.version_id
    where snapshot.slug = p_slug
    order by snapshot.published_at desc
    limit 1
  )
  select
    snapshot.payload
    ||
    jsonb_build_object(
      'credits',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'resource_id',
                  attachment.resource_id,
                'resource_kind',
                  attachment.resource_kind,
                'display_order',
                  attachment.display_order,
                'is_primary',
                  attachment.is_primary,
                'credit_id',
                  credit.id,
                'role',
                  credit.credit_role,
                'role_label',
                  credit.role_label_snapshot,
                'display_name',
                  credit.display_name_snapshot,
                'note',
                  credit.credit_note,
                'author_slug',
                  credit.registry_author_slug_snapshot,
                'username',
                  credit.user_username_snapshot
              )
              order by
                attachment.resource_kind,
                attachment.resource_id,
                attachment.display_order
            )
            from editorial.resource_credits attachment
            join editorial.credits credit
              on credit.id = attachment.credit_id
            join editorial.credit_governance governance
              on governance.credit_id = credit.id
            left join editorial.external_contributors contributor
              on contributor.id = credit.external_contributor_id
            where attachment.target_version_type =
                    'playlist_version'
              and attachment.target_version_id =
                    snapshot.version_id
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
              )
          ),
          '[]'::jsonb
        ),

      'citations',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'resource_id',
                  attachment.resource_id,
                'resource_kind',
                  attachment.resource_kind,
                'display_order',
                  attachment.display_order,
                'purpose',
                  attachment.citation_purpose,
                'anchor_type',
                  attachment.target_anchor_type,
                'anchor',
                  attachment.target_anchor_data,
                'citation_id',
                  citation.id,
                'public_label',
                  citation.public_label,
                'locator_type',
                  citation.locator_type,
                'locator',
                  citation.locator_data,
                'source',
                  jsonb_build_object(
                    'source_id',
                      source.id,
                    'source_version_id',
                      source_version.id,
                    'type',
                      source_version.source_type,
                    'title',
                      source_version.title,
                    'creator',
                      source_version.creator_display,
                    'publisher',
                      source_version.publisher_display,
                    'url',
                      case
                        when source.exposure_class = 'public'
                          then source_version.source_url
                        else null
                      end,
                    'publication_date',
                      source_version.publication_date,
                    'credit_line',
                      source_version.credit_line
                  )
              )
              order by
                attachment.resource_kind,
                attachment.resource_id,
                attachment.display_order
            )
            from editorial.resource_citations attachment
            join editorial.citations citation
              on citation.id = attachment.citation_id
            join editorial.source_versions source_version
              on source_version.id =
                   citation.source_version_id
            join editorial.sources source
              on source.id = citation.source_id
            where attachment.target_version_type =
                    'playlist_version'
              and attachment.target_version_id =
                    snapshot.version_id
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
                    citation.source_version_id
          ),
          '[]'::jsonb
        ),

      'corrections',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id',
                  note.id,
                'resource_id',
                  note.affected_resource_id,
                'resource_kind',
                  note.affected_resource_kind,
                'note',
                  note.note_text,
                'published_at',
                  note.published_at
              )
              order by note.published_at
            )
            from editorial.correction_public_notes note
            where (
              note.affected_resource_id =
                snapshot.resource_id
              or note.affected_resource_id in (
                select
                  nullif(
                    track
                      ->> 'playlist_item_resource_id',
                    ''
                  )::uuid
                from jsonb_array_elements(
                  snapshot.payload -> 'tracks'
                ) track
              )
            )
            and not exists (
              select 1
              from editorial.correction_public_notes newer
              where newer.supersedes_note_id = note.id
            )
          ),
          '[]'::jsonb
        )
    )
  from active_snapshot snapshot;
$function$;

revoke all
on function public.get_public_playlist(text)
from public;

grant execute
on function public.get_public_playlist(text)
to anon, authenticated, service_role;

commit;
