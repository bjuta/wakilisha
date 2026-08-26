-- Phase 7A K2: Video authority foundation.
--
-- Video becomes the first new typed domain to consume the Phase 7A K0/K1
-- Resource Version and canonical Resource lifecycle primitives directly.
--
-- This migration intentionally does not:
-- - create Video Review event authority;
-- - create public Video mutation/read RPCs;
-- - activate Video frontend routes or editor UI;
-- - create a second Media upload, file, processing, rights, or transcript store;
-- - create typed Video lifecycle-pointer mirrors.
--
-- The permanent lifecycle invariant is:
--   editorial.resources.current_*_version_id -> editorial.resource_versions
--
-- editorial.video_publication_resources contains identity only:
--   resource_id, resource_kind, publication_id.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k2-video-authority-foundation',
    0
  )
);

create temporary table phase_7a_k2_baseline
on commit drop
as
select
  (
    select count(*)
    from editorial.resources
  ) as resource_count,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            resource_row.id::text,
            resource_row.resource_kind,
            resource_row.lifecycle_state,
            resource_row.visibility,
            coalesce(resource_row.current_working_version_id::text, ''),
            coalesce(resource_row.current_submitted_version_id::text, ''),
            coalesce(resource_row.current_approved_version_id::text, ''),
            coalesce(resource_row.current_published_version_id::text, '')
          ),
          E'\n'
          order by resource_row.id::text
        ),
        ''
      )
    )
    from editorial.resources resource_row
  ) as resource_fingerprint,
  (
    select count(*)
    from editorial.resource_versions
  ) as resource_version_count,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.resource_kind,
            version_row.version_type,
            version_row.version_kind,
            version_row.version_number::text,
            version_row.content_fingerprint
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from editorial.resource_versions version_row
  ) as resource_version_fingerprint,
  (
    select count(*)
    from media.usage_links
  ) as media_usage_count,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            usage_row.id::text,
            usage_row.asset_id::text,
            coalesce(usage_row.asset_revision_id::text, ''),
            usage_row.target_authority,
            usage_row.target_kind,
            usage_row.target_id::text,
            coalesce(usage_row.target_version_kind, ''),
            coalesce(usage_row.target_version_id::text, ''),
            usage_row.usage_role,
            usage_row.usage_state,
            usage_row.usage_revision::text
          ),
          E'\n'
          order by usage_row.id::text
        ),
        ''
      )
    )
    from media.usage_links usage_row
  ) as media_usage_fingerprint,
  (
    select count(*)
    from editorial.resource_version_editorial_metadata
  ) as discovery_metadata_count,
  (
    select count(*)
    from editorial.resource_version_taxonomy_terms
  ) as discovery_taxonomy_count;

do $phase_7a_k2_preflight$
declare
  v_binding_definition text;
  v_resolver_definition text;
  v_media_target_definition text;
begin
  if to_regnamespace('video') is not null
     or to_regclass('video.publications') is not null
     or to_regclass('video.publication_versions') is not null
     or to_regclass('editorial.video_publication_resources') is not null
  then
    raise exception
      'STOP: Video authority already exists';
  end if;

  if to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_kinds') is null
     or to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.resource_version_types') is null
     or to_regclass('editorial.resource_version_type_kinds') is null
     or to_regclass('editorial.shows') is null
     or to_regclass('editorial.show_episodes') is null
     or to_regclass('editorial.resource_version_editorial_metadata') is null
     or to_regclass('editorial.resource_version_taxonomy_terms') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.asset_governance_versions') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('media.usage_roles') is null
     or to_regclass('public.capability_definitions') is null
     or to_regclass('public.role_capabilities') is null
     or to_regclass('platform_private.command_types') is null
  then
    raise exception
      'STOP: required Resource, Discovery, Media, capability, or command authority is incomplete';
  end if;

  if to_regprocedure(
       'editorial.register_typed_resource_version()'
     ) is null
     or to_regprocedure(
       'editorial.resolve_resource_version_identity(text,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.assert_resource_binding_integrity()'
     ) is null
     or to_regprocedure(
       'editorial.assert_resource_version_pointer_integrity()'
     ) is null
     or to_regprocedure(
       'editorial.sync_typed_lifecycle_from_resource()'
     ) is null
     or to_regprocedure(
       'editorial.copy_resource_version_editorial_metadata(text,uuid,text,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'media.usage_role_matches_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'
     ) is null
     or to_regprocedure(
       'media.enforce_usage_link_integrity()'
     ) is null
  then
    raise exception
      'STOP: required Resource Version, lifecycle, Discovery, or Media helper is missing';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind in ('standalone_video', 'video_episode')
  ) then
    raise exception
      'STOP: one or more Video Resource kinds already exist';
  end if;

  if exists (
    select 1
    from editorial.resource_version_types
    where version_type = 'video_publication_version'
  ) then
    raise exception
      'STOP: Video Resource Version type already exists';
  end if;

  if exists (
    select 1
    from media.usage_roles
    where usage_role in (
      'video_master',
      'video_poster',
      'video_caption',
      'video_transcript'
    )
  ) then
    raise exception
      'STOP: one or more Video Media usage roles already exist';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key in (
      'view_video',
      'edit_own_video',
      'edit_others_video',
      'publish_video',
      'delete_video'
    )
  ) then
    raise exception
      'STOP: one or more Video capabilities already exist';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'video.source.register',
      'video.publication.create',
      'video.publication.metadata.update',
      'video.publication.source.set',
      'video.publication.show_episode.bind',
      'video.publication.poster.set',
      'video.publication.captions.replace',
      'video.publication.transcript.set',
      'video.publication.chapters.replace',
      'video.publication.version.snapshot_working'
    )
  ) then
    raise exception
      'STOP: one or more Video K2 command types already exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('reviewer'),
        ('author'),
        ('writer')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions role_row
      where role_row.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: expected editorial role vocabulary is incomplete';
  end if;

  v_binding_definition := pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  );

  if position('when ''show''' in v_binding_definition) = 0
     or position('when ''show_episode''' in v_binding_definition) = 0
     or position('when ''standalone_video''' in v_binding_definition) > 0
     or position('when ''video_episode''' in v_binding_definition) > 0
  then
    raise exception
      'STOP: Resource binding integrity authority drifted before Video extension';
  end if;

  v_resolver_definition := pg_get_functiondef(
    'editorial.resolve_resource_version_identity(text,uuid)'::regprocedure
  );

  if position('audio_publication_version' in v_resolver_definition) = 0
     or position('video_publication_version' in v_resolver_definition) > 0
  then
    raise exception
      'STOP: Resource Version resolver drifted before Video extension';
  end if;

  v_media_target_definition := pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  );

  if position('p_target_authority = ''editorial''' in v_media_target_definition) = 0
     or position('p_target_authority = ''video''' in v_media_target_definition) > 0
  then
    raise exception
      'STOP: Media target validation authority drifted before Video extension';
  end if;
end;
$phase_7a_k2_preflight$;

-- ---------------------------------------------------------------------------
-- Private typed Video authority.
-- ---------------------------------------------------------------------------

create schema video;

revoke all
  on schema video
  from public, anon, authenticated, service_role;

create table video.publication_classifications (
  classification text primary key
    check (
      length(classification) between 2 and 100
      and classification ~ '^[a-z][a-z0-9_]*$'
    ),
  label text not null
    check (length(label) between 1 and 200),
  description text not null
    check (length(description) between 1 and 2000),
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into video.publication_classifications (
  classification,
  label,
  description,
  enabled,
  sort_order
)
values
  ('documentary', 'Documentary', 'Documentary Video publication.', true, 10),
  ('interview', 'Interview', 'Interview Video publication.', true, 20),
  ('performance', 'Performance', 'Performance Video publication.', true, 30),
  ('explainer', 'Explainer', 'Explainer Video publication.', true, 40),
  ('field_footage', 'Field Footage', 'Field or observational Video publication.', true, 50),
  ('other', 'Other', 'Other governed Video publication.', true, 1000);

create table video.source_providers (
  provider_key text primary key
    check (
      length(provider_key) between 2 and 100
      and provider_key ~ '^[a-z][a-z0-9_]*$'
    ),
  label text not null
    check (length(label) between 1 and 200),
  description text not null
    check (length(description) between 1 and 2000),
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into video.source_providers (
  provider_key,
  label,
  description,
  enabled,
  sort_order
)
values
  ('youtube', 'YouTube', 'YouTube-hosted Video source identity.', true, 10),
  ('vimeo', 'Vimeo', 'Vimeo-hosted Video source identity.', true, 20);

create table video.caption_track_kinds (
  track_kind text primary key
    check (
      length(track_kind) between 2 and 100
      and track_kind ~ '^[a-z][a-z0-9_]*$'
    ),
  label text not null
    check (length(label) between 1 and 200),
  description text not null
    check (length(description) between 1 and 2000),
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

insert into video.caption_track_kinds (
  track_kind,
  label,
  description,
  enabled,
  sort_order
)
values
  ('captions', 'Captions', 'Accessibility timed text including relevant dialogue and sound cues.', true, 10),
  ('subtitles', 'Subtitles', 'Timed spoken-language text such as translation or dialogue subtitles.', true, 20),
  ('forced_subtitles', 'Forced Subtitles', 'Partial subtitles shown only where the viewing context requires them.', true, 30);

create table video.sources (
  id uuid primary key default extensions.gen_random_uuid(),
  source_kind text not null
    check (source_kind in ('native_media', 'external_provider')),
  provider_key text
    references video.source_providers(provider_key)
    on update cascade
    on delete restrict,
  provider_object_id text
    check (
      provider_object_id is null
      or length(btrim(provider_object_id)) between 1 and 500
    ),
  canonical_url text
    check (
      canonical_url is null
      or (
        length(canonical_url) between 8 and 2000
        and canonical_url ~ '^https://'
      )
    ),
  media_asset_id uuid
    references media.assets(id)
    on delete restrict,
  media_asset_revision_id uuid
    references media.asset_revisions(id)
    on delete restrict,
  source_metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(source_metadata) = 'object'
      and octet_length(source_metadata::text) <= 32768
    ),
  -- Immutable historical actor snapshot. Do not FK-bind immutable provenance
  -- to mutable account identity.
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint video_sources_shape_check
    check (
      (
        source_kind = 'native_media'
        and provider_key is null
        and provider_object_id is null
        and canonical_url is null
        and media_asset_id is not null
        and media_asset_revision_id is not null
      )
      or (
        source_kind = 'external_provider'
        and provider_key is not null
        and nullif(btrim(provider_object_id), '') is not null
        and canonical_url is not null
        and media_asset_id is null
        and media_asset_revision_id is null
      )
    )
);

create unique index video_sources_native_identity_key
  on video.sources(media_asset_id, media_asset_revision_id)
  where source_kind = 'native_media';

create unique index video_sources_provider_identity_key
  on video.sources(provider_key, provider_object_id)
  where source_kind = 'external_provider';

create table video.publications (
  id uuid primary key default extensions.gen_random_uuid(),
  publication_kind text not null
    check (publication_kind in ('standalone', 'episode')),
  standalone_slug text
    check (
      standalone_slug is null
      or (
        length(standalone_slug) between 1 and 200
        and standalone_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  standalone_title text
    check (
      standalone_title is null
      or length(standalone_title) between 1 and 300
    ),
  standalone_summary text
    check (
      length(coalesce(standalone_summary, '')) <= 30000
    ),
  classification text not null
    references video.publication_classifications(classification)
    on update cascade
    on delete restrict,
  selected_source_id uuid
    references video.sources(id)
    on delete restrict,
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    ),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_publications_identity_shape_check
    check (
      (
        publication_kind = 'standalone'
        and standalone_slug is not null
        and standalone_title is not null
      )
      or (
        publication_kind = 'episode'
        and standalone_slug is null
        and standalone_title is null
        and standalone_summary is null
      )
    )
);

create unique index video_publications_standalone_slug_key
  on video.publications(standalone_slug)
  where publication_kind = 'standalone';

create index video_publications_created_idx
  on video.publications(created_at desc, id);

create table video.caption_tracks (
  id uuid primary key default extensions.gen_random_uuid(),
  publication_id uuid not null
    references video.publications(id)
    on update cascade
    on delete cascade,
  media_asset_id uuid not null
    references media.assets(id)
    on delete restrict,
  media_asset_revision_id uuid not null
    references media.asset_revisions(id)
    on delete restrict,
  language_tag text not null
    check (
      language_tag = lower(replace(btrim(language_tag), '_', '-'))
      and language_tag ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$'
    ),
  track_kind text not null
    references video.caption_track_kinds(track_kind)
    on update cascade
    on delete restrict,
  label text not null
    check (
      nullif(btrim(label), '') is not null
      and length(label) <= 200
    ),
  is_default boolean not null default false,
  display_order integer not null default 0
    check (display_order >= 0),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    publication_id,
    media_asset_id,
    media_asset_revision_id,
    language_tag,
    track_kind
  )
);

create unique index video_caption_tracks_one_default_key
  on video.caption_tracks(publication_id)
  where is_default;

create index video_caption_tracks_publication_order_idx
  on video.caption_tracks(publication_id, display_order, id);

create table video.publication_chapters (
  id uuid primary key default extensions.gen_random_uuid(),
  publication_id uuid not null
    references video.publications(id)
    on update cascade
    on delete cascade,
  chapter_number integer not null
    check (chapter_number >= 1),
  start_seconds numeric(12, 3) not null
    check (start_seconds >= 0),
  title text not null
    check (
      nullif(btrim(title), '') is not null
      and length(title) <= 500
    ),
  description text
    check (length(coalesce(description, '')) <= 10000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, chapter_number)
);

create index video_publication_chapters_start_idx
  on video.publication_chapters(publication_id, start_seconds, chapter_number);

-- ---------------------------------------------------------------------------
-- Stable Resource binding and shared Show Episode membership.
-- ---------------------------------------------------------------------------

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values
  (
    'standalone_video',
    'Standalone Video',
    'Canonical standalone Video publication identity.',
    true
  ),
  (
    'video_episode',
    'Video Episode',
    'Canonical Video rendition bound to a shared Show Episode identity.',
    true
  );

create table editorial.video_publication_resources (
  resource_id uuid primary key,
  resource_kind text not null
    check (resource_kind in ('standalone_video', 'video_episode')),
  publication_id uuid not null unique
    references video.publications(id)
    on update cascade
    on delete restrict,
  constraint video_publication_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade
);

create table editorial.video_episode_shared_links (
  video_publication_id uuid primary key
    references video.publications(id)
    on update cascade
    on delete restrict,
  show_episode_resource_id uuid not null unique
    references editorial.show_episodes(resource_id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default now()
);

alter table editorial.video_publication_resources enable row level security;
alter table editorial.video_episode_shared_links enable row level security;

revoke all
  on editorial.video_publication_resources,
     editorial.video_episode_shared_links
  from public, anon, authenticated, service_role;

create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial', 'audio'
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;
    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
  into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*) into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;
    when 'playlist' then
      select count(*) into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;
    when 'playlist_item' then
      select count(*) into binding_count
      from editorial.playlist_item_resources
      where resource_id = target_resource_id;
    when 'registry_artist' then
      select count(*) into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;
    when 'correction_case' then
      select count(*) into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;
    when 'media_asset' then
      select count(*) into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;
    when 'person' then
      select count(*) into binding_count
      from editorial.people
      where resource_id = target_resource_id;
    when 'organization' then
      select count(*) into binding_count
      from editorial.organizations
      where resource_id = target_resource_id;
    when 'audio_show' then
      select count(*) into binding_count
      from editorial.audio_show_resources
      where resource_id = target_resource_id;
    when 'audio_season' then
      select count(*) into binding_count
      from editorial.audio_season_resources
      where resource_id = target_resource_id;
    when 'audio_episode' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'audio_episode';
    when 'standalone_audio' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_audio';
    when 'show' then
      select count(*) into binding_count
      from editorial.shows
      where resource_id = target_resource_id;
    when 'show_episode' then
      select count(*) into binding_count
      from editorial.show_episodes
      where resource_id = target_resource_id;
    when 'video_episode' then
      select count(*) into binding_count
      from editorial.video_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'video_episode';
    when 'standalone_video' then
      select count(*) into binding_count
      from editorial.video_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_video';
    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

create constraint trigger video_publication_resources_binding_integrity
after insert or update or delete
on editorial.video_publication_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create or replace function editorial.prevent_video_resource_binding_retarget()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if new.resource_id is distinct from old.resource_id
     or new.resource_kind is distinct from old.resource_kind
     or new.publication_id is distinct from old.publication_id
  then
    raise exception
      'Video Resource binding identity cannot be retargeted.';
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.prevent_video_resource_binding_retarget()
  from public, anon, authenticated, service_role;

create trigger video_publication_resources_prevent_retarget
before update of resource_id, resource_kind, publication_id
on editorial.video_publication_resources
for each row
execute function editorial.prevent_video_resource_binding_retarget();

create or replace function editorial.assert_video_publication_resource_kind_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'video'
as $function$
declare
  v_publication_id uuid;
  v_publication_kind text;
  v_resource_kind text;
begin
  if tg_table_schema = 'editorial'
     and tg_table_name = 'video_publication_resources'
  then
    v_publication_id := case
      when tg_op = 'DELETE' then old.publication_id
      else new.publication_id
    end;
  else
    v_publication_id := case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;
  end if;

  select publication.publication_kind
  into v_publication_kind
  from video.publications publication
  where publication.id = v_publication_id;

  if not found then
    return null;
  end if;

  select binding.resource_kind
  into v_resource_kind
  from editorial.video_publication_resources binding
  where binding.publication_id = v_publication_id;

  if not found then
    return null;
  end if;

  if (v_publication_kind = 'episode' and v_resource_kind <> 'video_episode')
     or (
       v_publication_kind = 'standalone'
       and v_resource_kind <> 'standalone_video'
     )
  then
    raise exception
      'Video publication kind does not match its Resource kind.';
  end if;

  return null;
end;
$function$;

revoke execute
  on function editorial.assert_video_publication_resource_kind_integrity()
  from public, anon, authenticated, service_role;

create constraint trigger video_publication_resources_kind_integrity
after insert or update or delete
on editorial.video_publication_resources
deferrable initially deferred
for each row
execute function editorial.assert_video_publication_resource_kind_integrity();

create constraint trigger video_publications_resource_kind_integrity
after insert or update of publication_kind
on video.publications
deferrable initially deferred
for each row
execute function editorial.assert_video_publication_resource_kind_integrity();

create or replace function video.assert_publication_episode_binding_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'editorial'
as $function$
declare
  v_publication_id uuid;
  v_publication_kind text;
  v_link_count bigint;
begin
  if tg_table_schema = 'editorial'
     and tg_table_name = 'video_episode_shared_links'
  then
    v_publication_id := case
      when tg_op = 'DELETE' then old.video_publication_id
      else new.video_publication_id
    end;
  else
    v_publication_id := case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;
  end if;

  select publication.publication_kind
  into v_publication_kind
  from video.publications publication
  where publication.id = v_publication_id;

  if not found then
    return null;
  end if;

  select count(*)
  into v_link_count
  from editorial.video_episode_shared_links link
  where link.video_publication_id = v_publication_id;

  if v_publication_kind = 'episode'
     and v_link_count <> 1
  then
    raise exception
      'Video Episode requires exactly one shared Show Episode binding.';
  end if;

  if v_publication_kind = 'standalone'
     and v_link_count <> 0
  then
    raise exception
      'Standalone Video cannot bind a shared Show Episode.';
  end if;

  return null;
end;
$function$;

revoke execute
  on function video.assert_publication_episode_binding_integrity()
  from public, anon, authenticated, service_role;

create constraint trigger video_publications_episode_binding_integrity
after insert or update of publication_kind
on video.publications
deferrable initially deferred
for each row
execute function video.assert_publication_episode_binding_integrity();

create constraint trigger video_episode_shared_links_integrity
after insert or update or delete
on editorial.video_episode_shared_links
deferrable initially deferred
for each row
execute function video.assert_publication_episode_binding_integrity();

-- ---------------------------------------------------------------------------
-- Typed Media semantic integrity.
-- ---------------------------------------------------------------------------

create or replace function video.enforce_source_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_asset_kind text;
  v_asset_state text;
  v_revision_asset_id uuid;
  v_verification_state text;
  v_rights_status text;
  v_consent_status text;
  v_embargo_state text;
  v_embargo_until timestamptz;
  v_source_protection_class text;
  v_retention_state text;
  v_public_safety_state text;
begin
  if new.source_kind = 'external_provider' then
    if not exists (
      select 1
      from video.source_providers provider
      where provider.provider_key = new.provider_key
        and provider.enabled
    ) then
      raise exception
        'Video provider source requires an enabled provider.';
    end if;

    return new;
  end if;

  select
    asset.asset_kind,
    asset.lifecycle_state
  into
    v_asset_kind,
    v_asset_state
  from media.assets asset
  where asset.id = new.media_asset_id;

  if not found
     or v_asset_kind <> 'video'
     or v_asset_state <> 'active'
  then
    raise exception
      'Native Video source requires one active Video Media asset.';
  end if;

  select
    revision.asset_id,
    file_row.verification_state
  into
    v_revision_asset_id,
    v_verification_state
  from media.asset_revisions revision
  join media.file_objects file_row
    on file_row.id = revision.original_file_object_id
  where revision.id = new.media_asset_revision_id;

  if not found
     or v_revision_asset_id <> new.media_asset_id
     or v_verification_state <> 'verified'
  then
    raise exception
      'Native Video source requires one exact verified revision of the same Video asset.';
  end if;

  select
    governance.rights_status,
    governance.consent_status,
    governance.embargo_state,
    governance.embargo_until,
    governance.source_protection_class,
    governance.retention_state,
    governance.public_safety_state
  into
    v_rights_status,
    v_consent_status,
    v_embargo_state,
    v_embargo_until,
    v_source_protection_class,
    v_retention_state,
    v_public_safety_state
  from media.assets asset
  join media.asset_governance_versions governance
    on governance.id = asset.current_governance_version_id
  where asset.id = new.media_asset_id;

  if not found
     or v_public_safety_state not in (
       'approved_public',
       'approved_redacted'
     )
     or v_rights_status not in (
       'owned',
       'licensed',
       'public_domain',
       'fair_use'
     )
     or v_consent_status not in (
       'granted',
       'not_required'
     )
     or v_source_protection_class not in (
       'public',
       'public_redacted'
     )
     or v_retention_state not in (
       'retain',
       'review_required'
     )
     or v_embargo_state = 'active'
     or (
       v_embargo_state = 'scheduled'
       and v_embargo_until is not null
       and v_embargo_until > now()
     )
  then
    raise exception
      'Current Media governance does not permit the native Video source.';
  end if;

  return new;
end;
$function$;

revoke execute
  on function video.enforce_source_integrity()
  from public, anon, authenticated, service_role;

create trigger video_sources_integrity
before insert
on video.sources
for each row
execute function video.enforce_source_integrity();

create or replace function video.reject_immutable_row_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Immutable Video authority rows cannot be changed or deleted.';
end;
$function$;

revoke execute
  on function video.reject_immutable_row_mutation()
  from public, anon, authenticated, service_role;

create trigger video_sources_immutable
before update or delete
on video.sources
for each row
execute function video.reject_immutable_row_mutation();

create or replace function video.enforce_caption_media_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_asset_kind text;
  v_revision_asset_id uuid;
  v_verification_state text;
begin
  select asset.asset_kind
  into v_asset_kind
  from media.assets asset
  where asset.id = new.media_asset_id;

  select
    revision.asset_id,
    file_row.verification_state
  into
    v_revision_asset_id,
    v_verification_state
  from media.asset_revisions revision
  join media.file_objects file_row
    on file_row.id = revision.original_file_object_id
  where revision.id = new.media_asset_revision_id;

  if v_asset_kind <> 'caption'
     or v_revision_asset_id is distinct from new.media_asset_id
     or v_verification_state <> 'verified'
  then
    raise exception
      'Video caption track requires one exact verified Caption Media revision.';
  end if;

  if not exists (
    select 1
    from video.caption_track_kinds kind_row
    where kind_row.track_kind = new.track_kind
      and kind_row.enabled
  ) then
    raise exception
      'Video caption track kind is disabled or unknown.';
  end if;

  return new;
end;
$function$;

revoke execute
  on function video.enforce_caption_media_integrity()
  from public, anon, authenticated, service_role;

create trigger video_caption_tracks_media_integrity
before insert or update of
  media_asset_id,
  media_asset_revision_id,
  track_kind
on video.caption_tracks
for each row
execute function video.enforce_caption_media_integrity();

create or replace function video.assert_chapter_sequence_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video'
as $function$
declare
  v_parent_id uuid;
  v_count bigint;
  v_min integer;
  v_max integer;
begin
  if tg_table_name = 'publication_chapters' then
    v_parent_id := case
      when tg_op = 'DELETE' then old.publication_id
      else new.publication_id
    end;

    select
      count(*),
      min(chapter.chapter_number),
      max(chapter.chapter_number)
    into
      v_count,
      v_min,
      v_max
    from video.publication_chapters chapter
    where chapter.publication_id = v_parent_id;

    if v_count > 0
       and (v_min <> 1 or v_max <> v_count)
    then
      raise exception
        'Video chapter numbers must be contiguous from 1.';
    end if;

    if exists (
      select 1
      from (
        select
          chapter.start_seconds,
          lag(chapter.start_seconds) over (
            order by chapter.chapter_number
          ) as prior_start
        from video.publication_chapters chapter
        where chapter.publication_id = v_parent_id
      ) ordered
      where ordered.prior_start is not null
        and ordered.start_seconds <= ordered.prior_start
    ) then
      raise exception
        'Video chapter start times must increase strictly.';
    end if;

    return null;
  end if;

  v_parent_id := case
    when tg_op = 'DELETE' then old.publication_version_id
    else new.publication_version_id
  end;

  select
    count(*),
    min(chapter.chapter_number),
    max(chapter.chapter_number)
  into
    v_count,
    v_min,
    v_max
  from video.publication_version_chapters chapter
  where chapter.publication_version_id = v_parent_id;

  if v_count > 0
     and (v_min <> 1 or v_max <> v_count)
  then
    raise exception
      'Video version chapter numbers must be contiguous from 1.';
  end if;

  if exists (
    select 1
    from (
      select
        chapter.start_seconds,
        lag(chapter.start_seconds) over (
          order by chapter.chapter_number
        ) as prior_start
      from video.publication_version_chapters chapter
      where chapter.publication_version_id = v_parent_id
    ) ordered
    where ordered.prior_start is not null
      and ordered.start_seconds <= ordered.prior_start
  ) then
    raise exception
      'Video version chapter start times must increase strictly.';
  end if;

  return null;
end;
$function$;

revoke execute
  on function video.assert_chapter_sequence_integrity()
  from public, anon, authenticated, service_role;

create constraint trigger video_publication_chapter_sequence_integrity
after insert or update or delete
on video.publication_chapters
deferrable initially deferred
for each row
execute function video.assert_chapter_sequence_integrity();

-- ---------------------------------------------------------------------------
-- Immutable Video publication versions.
-- ---------------------------------------------------------------------------

create table video.publication_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_id uuid not null
    references editorial.resources(id)
    on update cascade
    on delete restrict,
  publication_id uuid not null
    references video.publications(id)
    on update cascade
    on delete restrict,
  version_number bigint not null
    check (version_number >= 1),
  version_kind text not null
    check (
      version_kind in (
        'working',
        'submitted',
        'approved',
        'published'
      )
    ),
  source_authority_revision bigint not null
    check (source_authority_revision >= 1),
  publication_kind text not null
    check (publication_kind in ('standalone', 'episode')),
  show_resource_id uuid
    references editorial.shows(resource_id)
    on update cascade
    on delete restrict,
  show_episode_resource_id uuid
    references editorial.show_episodes(resource_id)
    on update cascade
    on delete restrict,
  slug_snapshot text not null
    check (
      length(slug_snapshot) between 1 and 200
      and slug_snapshot ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  title_snapshot text not null
    check (length(title_snapshot) between 1 and 300),
  summary_snapshot text
    check (length(coalesce(summary_snapshot, '')) <= 30000),
  classification text not null
    references video.publication_classifications(classification)
    on update cascade
    on delete restrict,
  source_id uuid not null
    references video.sources(id)
    on delete restrict,
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    ),
  content_fingerprint text not null
    check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  -- Immutable historical actor snapshot. Do not FK-bind immutable provenance.
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (publication_id, version_number),
  unique (id, resource_id, publication_id),
  constraint video_publication_versions_identity_shape_check
    check (
      (
        publication_kind = 'standalone'
        and show_resource_id is null
        and show_episode_resource_id is null
      )
      or (
        publication_kind = 'episode'
        and show_resource_id is not null
        and show_episode_resource_id is not null
      )
    )
);

create index video_publication_versions_resource_created_idx
  on video.publication_versions(resource_id, created_at desc, id);

create index video_publication_versions_publication_created_idx
  on video.publication_versions(publication_id, created_at desc, id);

create or replace function video.enforce_publication_version_identity_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'editorial'
as $function$
declare
  v_resource_kind text;
  v_show_episode_resource_id uuid;
  v_show_resource_id uuid;
begin
  select binding.resource_kind
  into v_resource_kind
  from editorial.video_publication_resources binding
  where binding.resource_id = new.resource_id
    and binding.publication_id = new.publication_id;

  if not found then
    raise exception
      'Video publication version requires the exact Video Resource binding.';
  end if;

  if (new.publication_kind = 'standalone' and v_resource_kind <> 'standalone_video')
     or (new.publication_kind = 'episode' and v_resource_kind <> 'video_episode')
  then
    raise exception
      'Video publication version kind does not match its Resource kind.';
  end if;

  if new.publication_kind = 'standalone' then
    if new.show_resource_id is not null
       or new.show_episode_resource_id is not null
    then
      raise exception
        'Standalone Video version cannot snapshot shared Show identity.';
    end if;

    return new;
  end if;

  select
    link.show_episode_resource_id,
    episode.show_resource_id
  into
    v_show_episode_resource_id,
    v_show_resource_id
  from editorial.video_episode_shared_links link
  join editorial.show_episodes episode
    on episode.resource_id = link.show_episode_resource_id
  where link.video_publication_id = new.publication_id;

  if not found
     or new.show_episode_resource_id is distinct from v_show_episode_resource_id
     or new.show_resource_id is distinct from v_show_resource_id
  then
    raise exception
      'Video Episode version must snapshot its exact shared Show and Show Episode identity.';
  end if;

  return new;
end;
$function$;

revoke execute
  on function video.enforce_publication_version_identity_integrity()
  from public, anon, authenticated, service_role;

create trigger video_publication_versions_identity_integrity
before insert
on video.publication_versions
for each row
execute function video.enforce_publication_version_identity_integrity();

create table video.publication_version_caption_tracks (
  publication_version_id uuid not null
    references video.publication_versions(id)
    on delete restrict,
  track_number integer not null
    check (track_number >= 1),
  media_asset_id uuid not null
    references media.assets(id)
    on delete restrict,
  media_asset_revision_id uuid not null
    references media.asset_revisions(id)
    on delete restrict,
  language_tag text not null
    check (
      language_tag = lower(replace(btrim(language_tag), '_', '-'))
      and language_tag ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$'
    ),
  track_kind text not null
    references video.caption_track_kinds(track_kind)
    on update cascade
    on delete restrict,
  label text not null
    check (
      nullif(btrim(label), '') is not null
      and length(label) <= 200
    ),
  is_default boolean not null,
  primary key (publication_version_id, track_number)
);

create unique index video_publication_version_one_default_caption_key
  on video.publication_version_caption_tracks(publication_version_id)
  where is_default;

create table video.publication_version_chapters (
  publication_version_id uuid not null
    references video.publication_versions(id)
    on delete restrict,
  chapter_number integer not null
    check (chapter_number >= 1),
  start_seconds numeric(12, 3) not null
    check (start_seconds >= 0),
  title text not null
    check (
      nullif(btrim(title), '') is not null
      and length(title) <= 500
    ),
  description text
    check (length(coalesce(description, '')) <= 10000),
  primary key (publication_version_id, chapter_number)
);

create trigger video_publication_version_caption_media_integrity
before insert or update of
  media_asset_id,
  media_asset_revision_id,
  track_kind
on video.publication_version_caption_tracks
for each row
execute function video.enforce_caption_media_integrity();

create constraint trigger video_publication_version_chapter_sequence_integrity
after insert or update or delete
on video.publication_version_chapters
deferrable initially deferred
for each row
execute function video.assert_chapter_sequence_integrity();

create trigger video_publication_versions_immutable
before update or delete
on video.publication_versions
for each row
execute function video.reject_immutable_row_mutation();

create trigger video_publication_version_caption_tracks_immutable
before update or delete
on video.publication_version_caption_tracks
for each row
execute function video.reject_immutable_row_mutation();

create trigger video_publication_version_chapters_immutable
before update or delete
on video.publication_version_chapters
for each row
execute function video.reject_immutable_row_mutation();

-- ---------------------------------------------------------------------------
-- K0 Resource Version registration and K1 lifecycle consumption.
-- ---------------------------------------------------------------------------

insert into editorial.resource_version_types (
  version_type,
  label,
  description,
  source_table_schema,
  source_table_name,
  enabled
)
values (
  'video_publication_version',
  'Video Publication Version',
  'Global Resource Version identity for an immutable Video publication version.',
  'video',
  'publication_versions',
  true
);

insert into editorial.resource_version_type_kinds (
  version_type,
  resource_kind
)
values
  ('video_publication_version', 'standalone_video'),
  ('video_publication_version', 'video_episode');

create trigger video_publication_versions_register_resource_version
after insert
on video.publication_versions
for each row
execute function editorial.register_typed_resource_version();

create or replace function editorial.resolve_resource_version_identity(
  p_target_version_type text,
  p_target_version_id uuid
)
returns table(
  resource_id uuid,
  resource_kind text,
  version_kind text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial', 'audio', 'video'
as $function$
begin
  if p_target_version_id is null then
    return;
  end if;

  if p_target_version_type = 'article_version' then
    return query
    select
      version.resource_id,
      resource.resource_kind,
      version.version_kind
    from editorial.article_versions version
    join editorial.resources resource
      on resource.id = version.resource_id
    where version.id = p_target_version_id;
  elsif p_target_version_type = 'playlist_version' then
    return query
    select
      version.resource_id,
      resource.resource_kind,
      version.version_kind
    from editorial.playlist_versions version
    join editorial.resources resource
      on resource.id = version.resource_id
    where version.id = p_target_version_id;
  elsif p_target_version_type = 'audio_publication_version' then
    return query
    select
      version.resource_id,
      resource.resource_kind,
      version.version_kind
    from audio.publication_versions version
    join editorial.resources resource
      on resource.id = version.resource_id
    where version.id = p_target_version_id;
  elsif p_target_version_type = 'video_publication_version' then
    return query
    select
      version.resource_id,
      resource.resource_kind,
      version.version_kind
    from video.publication_versions version
    join editorial.resources resource
      on resource.id = version.resource_id
    where version.id = p_target_version_id;
  else
    raise exception
      'Unsupported editorial version type: %',
      p_target_version_type;
  end if;
end;
$function$;

-- Discovery storage accepts Video version identity. Public Video Discovery reads
-- and writes remain deferred until governed Video command/read authority exists.
alter table editorial.resource_version_editorial_metadata
  drop constraint resource_version_editorial_metadata_target_version_type_check;

alter table editorial.resource_version_editorial_metadata
  add constraint resource_version_editorial_metadata_target_version_type_check
  check (
    target_version_type in (
      'article_version',
      'playlist_version',
      'audio_publication_version',
      'video_publication_version'
    )
  );

alter table editorial.resource_version_taxonomy_terms
  drop constraint resource_version_taxonomy_terms_target_version_type_check;

alter table editorial.resource_version_taxonomy_terms
  add constraint resource_version_taxonomy_terms_target_version_type_check
  check (
    target_version_type in (
      'article_version',
      'playlist_version',
      'audio_publication_version',
      'video_publication_version'
    )
  );

create or replace function editorial.materialize_video_resource_version_editorial_metadata()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'video'
as $function$
declare
  v_resource_kind text;
  v_source_id uuid;
begin
  select resource.resource_kind
  into v_resource_kind
  from editorial.resources resource
  where resource.id = new.resource_id;

  if v_resource_kind not in ('standalone_video', 'video_episode') then
    raise exception
      'Video version Resource identity is invalid for Discovery materialization.';
  end if;

  select source.id
  into v_source_id
  from video.publication_versions source
  where source.resource_id = new.resource_id
    and source.version_number < new.version_number
    and (
      (
        new.version_kind in ('working', 'submitted')
        and source.version_kind = 'working'
      )
      or (
        new.version_kind = 'approved'
        and source.version_kind = 'submitted'
      )
      or (
        new.version_kind = 'published'
        and source.version_kind = 'approved'
      )
    )
  order by source.version_number desc
  limit 1;

  if v_source_id is not null then
    perform editorial.copy_resource_version_editorial_metadata(
      'video_publication_version',
      v_source_id,
      'video_publication_version',
      new.id,
      new.created_by
    );
  else
    insert into editorial.resource_version_editorial_metadata (
      target_version_type,
      target_version_id,
      resource_id,
      resource_kind,
      metadata_revision,
      updated_by,
      created_at,
      updated_at
    )
    values (
      'video_publication_version',
      new.id,
      new.resource_id,
      v_resource_kind,
      1,
      new.created_by,
      new.created_at,
      new.created_at
    );
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.materialize_video_resource_version_editorial_metadata()
  from public, anon, authenticated, service_role;

create trigger video_publication_versions_materialize_editorial_metadata
after insert
on video.publication_versions
for each row
execute function editorial.materialize_video_resource_version_editorial_metadata();

-- ---------------------------------------------------------------------------
-- Media usage extension: Video becomes a normal governed consumer.
-- ---------------------------------------------------------------------------

-- The canonical Media target validator and storage constraints must agree.
-- Prior to Video, these checks intentionally excluded the Video target family.
alter table media.usage_links
  drop constraint usage_links_target_authority_check;

alter table media.usage_links
  add constraint usage_links_target_authority_check
  check (
    target_authority in (
      'editorial',
      'registry',
      'charts',
      'guides',
      'sources',
      'video'
    )
  );

alter table media.usage_links
  drop constraint usage_links_target_kind_check;

alter table media.usage_links
  add constraint usage_links_target_kind_check
  check (
    target_kind in (
      'article',
      'artist',
      'author',
      'release',
      'track',
      'chart_entry',
      'guide',
      'guide_page',
      'highlight',
      'source',
      'playlist',
      'audio_publication',
      'video_publication'
    )
  );

insert into media.usage_roles (
  usage_role,
  label,
  description,
  enabled,
  sort_order
)
values
  (
    'video_master',
    'Video Master',
    'Exact native Video Media revision selected as a Video publication master.',
    true,
    66
  ),
  (
    'video_poster',
    'Video Poster',
    'Exact Image Media revision selected as a Video publication poster.',
    true,
    67
  ),
  (
    'video_caption',
    'Video Caption',
    'Exact Caption Media revision attached to a Video publication.',
    true,
    68
  ),
  (
    'video_transcript',
    'Video Transcript',
    'Exact Transcript Media revision attached to a Video publication.',
    true,
    69
  );

create or replace function media.usage_role_matches_target(
  p_usage_role text,
  p_target_authority text,
  p_target_kind text
)
returns boolean
language sql
immutable
parallel safe
set search_path to 'pg_catalog'
as $function$
  select case p_usage_role
    when 'article_hero' then
      p_target_authority = 'editorial'
      and p_target_kind = 'article'
    when 'article_inline' then
      p_target_authority = 'editorial'
      and p_target_kind = 'article'
    when 'playlist_cover' then
      p_target_authority = 'editorial'
      and p_target_kind = 'playlist'
    when 'chart_artwork' then
      p_target_authority = 'charts'
      and p_target_kind = 'chart_entry'
    when 'artist_portrait' then
      p_target_authority = 'registry'
      and p_target_kind = 'artist'
    when 'author_avatar' then
      p_target_authority = 'registry'
      and p_target_kind = 'author'
    when 'author_cover' then
      p_target_authority = 'registry'
      and p_target_kind = 'author'
    when 'release_artwork' then
      p_target_authority = 'registry'
      and p_target_kind = 'release'
    when 'track_artwork' then
      p_target_authority = 'registry'
      and p_target_kind = 'track'
    when 'guide_hero' then
      p_target_authority = 'guides'
      and p_target_kind in ('guide', 'guide_page')
    when 'highlight_artwork' then
      p_target_authority = 'registry'
      and p_target_kind = 'highlight'
    when 'source_attachment' then
      p_target_authority = 'sources'
      and p_target_kind = 'source'
    when 'video_master' then
      p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    when 'video_poster' then
      p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    when 'video_caption' then
      p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    when 'video_transcript' then
      p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    when 'other' then
      true
    else
      false
  end;
$function$;

create or replace function editorial.current_user_can_view_video(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.resources resource_row
      where resource_row.id = p_resource_id
        and resource_row.resource_kind in (
          'standalone_video',
          'video_episode'
        )
        and (
          public.current_user_is_administrator()
          or public.current_user_has_capability('view_video')
          or (
            public.current_user_has_capability('edit_own_video')
            and resource_row.owner_id = auth.uid()
          )
          or public.current_user_has_capability('edit_others_video')
        )
    );
$function$;

create or replace function editorial.current_user_can_edit_video(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.resources resource_row
      where resource_row.id = p_resource_id
        and resource_row.resource_kind in (
          'standalone_video',
          'video_episode'
        )
        and (
          public.current_user_is_administrator()
          or public.current_user_has_capability('edit_others_video')
          or (
            public.current_user_has_capability('edit_own_video')
            and resource_row.owner_id = auth.uid()
          )
        )
    );
$function$;

create or replace function editorial.current_user_can_publish_video(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.video_publication_resources binding
      where binding.resource_id = p_resource_id
    )
    and (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(
        public.current_user_has_capability('publish_video'),
        false
      )
    );
$function$;

revoke execute
  on function editorial.current_user_can_view_video(uuid),
     editorial.current_user_can_edit_video(uuid),
     editorial.current_user_can_publish_video(uuid)
  from public, anon, authenticated, service_role;

create or replace function media.validate_usage_target(
  p_actor_id uuid,
  p_target_authority text,
  p_target_kind text,
  p_target_id uuid,
  p_target_version_kind text default null,
  p_target_version_id uuid default null,
  p_require_edit_authority boolean default true,
  p_require_attachable_target boolean default true
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'editorial', 'video', 'auth'
as $function$
declare
  v_exists boolean := false;
  v_authorized boolean := false;
  v_version_kind text;
  v_target_snapshot jsonb;
begin
  if p_actor_id is null then
    raise exception 'Media target validation requires an actor';
  end if;

  if p_target_id is null then
    raise exception 'Media usage target identity is required';
  end if;

  if not (
    (
      p_target_authority = 'editorial'
      and p_target_kind in ('article', 'playlist')
    )
    or (
      p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    )
    or (
      p_target_authority = 'registry'
      and p_target_kind in (
        'artist',
        'author',
        'release',
        'track',
        'highlight'
      )
    )
    or (
      p_target_authority = 'charts'
      and p_target_kind = 'chart_entry'
    )
    or (
      p_target_authority = 'guides'
      and p_target_kind in ('guide', 'guide_page')
    )
    or (
      p_target_authority = 'sources'
      and p_target_kind = 'source'
    )
  ) then
    raise exception 'Unsupported Media usage target authority and kind';
  end if;

  case
    when p_target_authority = 'editorial'
      and p_target_kind = 'article'
    then
      select to_jsonb(article_row)
      into v_target_snapshot
      from public.wk_articles article_row
      where article_row.id = p_target_id;

    when p_target_authority = 'editorial'
      and p_target_kind = 'playlist'
    then
      select to_jsonb(playlist_row)
      into v_target_snapshot
      from public.wk_playlists playlist_row
      where playlist_row.id = p_target_id;

    when p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    then
      select
        to_jsonb(publication_row)
        || jsonb_build_object(
          'lifecycle_state',
          resource_row.lifecycle_state
        )
      into v_target_snapshot
      from video.publications publication_row
      join editorial.video_publication_resources binding
        on binding.publication_id = publication_row.id
      join editorial.resources resource_row
        on resource_row.id = binding.resource_id
      where publication_row.id = p_target_id;

    when p_target_authority = 'registry'
      and p_target_kind = 'artist'
    then
      select to_jsonb(artist_row)
      into v_target_snapshot
      from public.registry_artists artist_row
      where artist_row.id = p_target_id;

    when p_target_authority = 'registry'
      and p_target_kind = 'author'
    then
      select to_jsonb(author_row)
      into v_target_snapshot
      from public.registry_authors author_row
      where author_row.id = p_target_id;

    when p_target_authority = 'registry'
      and p_target_kind = 'release'
    then
      select to_jsonb(release_row)
      into v_target_snapshot
      from public.registry_releases release_row
      where release_row.id = p_target_id;

    when p_target_authority = 'registry'
      and p_target_kind = 'track'
    then
      select to_jsonb(track_row)
      into v_target_snapshot
      from public.registry_tracks track_row
      where track_row.id = p_target_id;

    when p_target_authority = 'registry'
      and p_target_kind = 'highlight'
    then
      select to_jsonb(highlight_row)
      into v_target_snapshot
      from public.registry_artist_highlights highlight_row
      where highlight_row.id = p_target_id;

    when p_target_authority = 'charts'
      and p_target_kind = 'chart_entry'
    then
      select to_jsonb(entry_row)
      into v_target_snapshot
      from public.chart_entries entry_row
      where entry_row.id = p_target_id;

    when p_target_authority = 'guides'
      and p_target_kind = 'guide'
    then
      select to_jsonb(guide_row)
      into v_target_snapshot
      from public.guides guide_row
      where guide_row.id = p_target_id;

    when p_target_authority = 'guides'
      and p_target_kind = 'guide_page'
    then
      select to_jsonb(page_row)
      into v_target_snapshot
      from public.guide_pages page_row
      where page_row.id = p_target_id;

    when p_target_authority = 'sources'
      and p_target_kind = 'source'
    then
      select to_jsonb(source_row)
      into v_target_snapshot
      from editorial.sources source_row
      where source_row.id = p_target_id;
  end case;

  v_exists := v_target_snapshot is not null;

  if not v_exists then
    raise exception 'Media usage target does not exist';
  end if;

  if p_require_attachable_target
    and not media.usage_target_snapshot_is_attachable(v_target_snapshot)
  then
    raise exception 'Media usage target is archived or unresolved';
  end if;

  if (
    p_target_version_kind is null
    and p_target_version_id is not null
  ) or (
    p_target_version_kind is not null
    and p_target_version_id is null
  ) then
    raise exception 'Media target-version kind and identity must be supplied together';
  end if;

  if p_target_version_id is not null then
    if p_target_authority = 'editorial'
      and p_target_kind = 'article'
    then
      select version_row.version_kind
      into v_version_kind
      from editorial.article_versions version_row
      where version_row.id = p_target_version_id
        and version_row.article_id = p_target_id;

      if not found
        or v_version_kind is distinct from p_target_version_kind
      then
        raise exception 'Media Article target version is invalid';
      end if;

    elsif p_target_authority = 'editorial'
      and p_target_kind = 'playlist'
    then
      select version_row.version_kind
      into v_version_kind
      from editorial.playlist_versions version_row
      where version_row.id = p_target_version_id
        and version_row.playlist_id = p_target_id;

      if not found
        or v_version_kind is distinct from p_target_version_kind
      then
        raise exception 'Media Playlist target version is invalid';
      end if;

    elsif p_target_authority = 'video'
      and p_target_kind = 'video_publication'
    then
      if p_target_version_kind <> 'video_publication_version'
        or not exists (
          select 1
          from video.publication_versions version_row
          where version_row.id = p_target_version_id
            and version_row.publication_id = p_target_id
        )
      then
        raise exception 'Media Video target version is invalid';
      end if;

    elsif p_target_authority = 'sources'
      and p_target_kind = 'source'
    then
      if p_target_version_kind <> 'source_version'
        or not exists (
          select 1
          from editorial.source_versions version_row
          where version_row.id = p_target_version_id
            and version_row.source_id = p_target_id
        )
      then
        raise exception 'Media Source target version is invalid';
      end if;

    else
      raise exception 'This Media usage target does not support version identity';
    end if;
  end if;

  if not p_require_edit_authority then
    return;
  end if;

  if public.current_user_is_administrator() then
    return;
  end if;

  case p_target_authority
    when 'editorial' then
      if p_target_kind = 'article' then
        v_authorized :=
          public.current_user_has_capability('edit_others_articles')
          or public.current_user_has_capability('publish_articles')
          or (
            public.current_user_has_capability('edit_own_articles')
            and exists (
              select 1
              from editorial.article_resources binding
              join editorial.resources resource_row
                on resource_row.id = binding.resource_id
              where binding.article_id = p_target_id
                and resource_row.owner_id = p_actor_id
            )
          );
      elsif p_target_kind = 'playlist' then
        v_authorized :=
          public.current_user_has_capability('edit_others_playlists')
          or public.current_user_has_capability('publish_playlists')
          or (
            public.current_user_has_capability('edit_own_playlists')
            and exists (
              select 1
              from editorial.playlist_resources binding
              join editorial.resources resource_row
                on resource_row.id = binding.resource_id
              where binding.playlist_id = p_target_id
                and resource_row.owner_id = p_actor_id
            )
          );
      end if;

    when 'video' then
      select editorial.current_user_can_edit_video(binding.resource_id)
      into v_authorized
      from editorial.video_publication_resources binding
      where binding.publication_id = p_target_id;

    when 'registry' then
      v_authorized := public.current_user_has_capability('manage_registry');

    when 'charts' then
      v_authorized := public.current_user_has_capability('manage_charts');

    when 'guides' then
      v_authorized := public.current_user_has_capability('edit_guides');

    when 'sources' then
      v_authorized := public.current_user_has_capability('manage_sources');
  end case;

  if not coalesce(v_authorized, false) then
    raise exception 'Edit authority for the Media usage target is required';
  end if;
end;
$function$;

create or replace function media.enforce_usage_link_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'media'
as $function$
declare
  v_revision_asset_id uuid;
  v_asset_kind text;
begin
  if new.asset_revision_id is not null then
    select revision.asset_id
    into v_revision_asset_id
    from media.asset_revisions revision
    where revision.id = new.asset_revision_id;

    if not found
       or v_revision_asset_id <> new.asset_id
    then
      raise exception
        'Media usage revision must belong to the same asset';
    end if;
  end if;

  if new.resolution_mode = 'legacy_snapshot'
     and not exists (
       select 1
       from media.legacy_asset_links link
       where link.asset_id = new.asset_id
     )
  then
    raise exception
      'Legacy-snapshot Media usage requires an immutable legacy bridge';
  end if;

  if new.usage_role in (
       'video_master',
       'video_poster',
       'video_caption',
       'video_transcript'
     )
  then
    if new.target_authority <> 'video'
       or new.target_kind <> 'video_publication'
       or new.resolution_mode <> 'exact_revision'
       or new.asset_revision_id is null
    then
      raise exception
        'Video Media usage requires an exact Video publication target.';
    end if;

    select asset.asset_kind
    into v_asset_kind
    from media.assets asset
    where asset.id = new.asset_id;

    if (new.usage_role = 'video_master' and v_asset_kind <> 'video')
       or (new.usage_role = 'video_poster' and v_asset_kind <> 'image')
       or (new.usage_role = 'video_caption' and v_asset_kind <> 'caption')
       or (new.usage_role = 'video_transcript' and v_asset_kind <> 'transcript')
    then
      raise exception
        'Video Media usage role does not match the Media asset kind.';
    end if;

    if new.target_version_id is not null
       and new.target_version_kind <> 'video_publication_version'
    then
      raise exception
        'Version-bound Video Media usage requires Video publication version identity.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.usage_state = old.usage_state then
      raise exception
        'Media usage lifecycle update must change usage state';
    end if;

    if new.usage_revision <> old.usage_revision + 1 then
      raise exception
        'Media usage lifecycle update must increment usage revision exactly once';
    end if;
  end if;

  return new;
end;
$function$;

create unique index media_video_singleton_active_usage_key
  on media.usage_links (
    target_id,
    usage_role,
    coalesce(
      target_version_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  )
  where target_authority = 'video'
    and target_kind = 'video_publication'
    and usage_role in (
      'video_master',
      'video_poster',
      'video_transcript'
    )
    and usage_state = 'active';

create or replace function video.assert_selected_source_media_usage_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_publication_id uuid;
  v_selected_source_id uuid;
  v_source video.sources%rowtype;
  v_master_count bigint;
  v_matching_master_count bigint;
begin
  if tg_table_schema = 'media'
     and tg_table_name = 'usage_links'
  then
    if tg_op = 'INSERT' then
      if new.target_authority <> 'video'
         or new.target_kind <> 'video_publication'
         or new.usage_role <> 'video_master'
      then
        return null;
      end if;
      v_publication_id := new.target_id;
    elsif tg_op = 'DELETE' then
      if old.target_authority <> 'video'
         or old.target_kind <> 'video_publication'
         or old.usage_role <> 'video_master'
      then
        return null;
      end if;
      v_publication_id := old.target_id;
    else
      if new.target_authority <> 'video'
         or new.target_kind <> 'video_publication'
         or new.usage_role <> 'video_master'
      then
        return null;
      end if;
      v_publication_id := new.target_id;
    end if;
  else
    v_publication_id := case
      when tg_op = 'DELETE' then old.id
      else new.id
    end;
  end if;

  select publication.selected_source_id
  into v_selected_source_id
  from video.publications publication
  where publication.id = v_publication_id;

  if not found then
    return null;
  end if;

  select count(*)
  into v_master_count
  from media.usage_links usage
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = v_publication_id
    and usage.target_version_id is null
    and usage.usage_role = 'video_master'
    and usage.usage_state = 'active';

  if v_selected_source_id is null then
    if v_master_count <> 0 then
      raise exception
        'Video publication without a selected source cannot carry an active native master usage.';
    end if;
    return null;
  end if;

  select source.*
  into v_source
  from video.sources source
  where source.id = v_selected_source_id;

  if not found then
    raise exception
      'Selected Video source does not exist.';
  end if;

  if v_source.source_kind = 'external_provider' then
    if v_master_count <> 0 then
      raise exception
        'Provider-backed Video cannot carry an active native master usage.';
    end if;
    return null;
  end if;

  select count(*)
  into v_matching_master_count
  from media.usage_links usage
  where usage.target_authority = 'video'
    and usage.target_kind = 'video_publication'
    and usage.target_id = v_publication_id
    and usage.target_version_id is null
    and usage.usage_role = 'video_master'
    and usage.usage_state = 'active'
    and usage.resolution_mode = 'exact_revision'
    and usage.asset_id = v_source.media_asset_id
    and usage.asset_revision_id = v_source.media_asset_revision_id;

  if v_master_count <> 1
     or v_matching_master_count <> 1
  then
    raise exception
      'Selected native Video source and active video_master Media usage must agree exactly.';
  end if;

  return null;
end;
$function$;

revoke execute
  on function video.assert_selected_source_media_usage_integrity()
  from public, anon, authenticated, service_role;

create constraint trigger video_publications_selected_source_usage_integrity
after insert or update of selected_source_id
on video.publications
deferrable initially deferred
for each row
execute function video.assert_selected_source_media_usage_integrity();

create constraint trigger media_usage_video_master_selection_integrity
after insert or update or delete
on media.usage_links
deferrable initially deferred
for each row
execute function video.assert_selected_source_media_usage_integrity();

-- ---------------------------------------------------------------------------
-- Video capability and future command vocabulary.
-- ---------------------------------------------------------------------------

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'view_video',
    'View Video',
    'View internal Video publication work where Video authority allows it.',
    'content'
  ),
  (
    'edit_own_video',
    'Edit own Video',
    'Create and edit Video work owned by the current worker.',
    'content'
  ),
  (
    'edit_others_video',
    'Edit others Video',
    'Edit Video work owned by other workers.',
    'content'
  ),
  (
    'publish_video',
    'Publish Video',
    'Approve publication actions for reviewed Video versions.',
    'content'
  ),
  (
    'delete_video',
    'Delete Video',
    'Perform authorized destructive Video administration.',
    'content'
  );

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'view_video'),
  ('editor', 'view_video'),
  ('reviewer', 'view_video'),
  ('administrator', 'edit_own_video'),
  ('editor', 'edit_own_video'),
  ('author', 'edit_own_video'),
  ('writer', 'edit_own_video'),
  ('administrator', 'edit_others_video'),
  ('editor', 'edit_others_video'),
  ('administrator', 'publish_video'),
  ('editor', 'publish_video'),
  ('administrator', 'delete_video'),
  ('editor', 'delete_video');

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  (
    'video.source.register',
    'video.source.register.sync',
    'video.source.register.accepted',
    'video.source.register.succeeded',
    'video.source.register.failed',
    'video.source.register.retry_scheduled',
    true
  ),
  (
    'video.publication.create',
    'video.publication.create.sync',
    'video.publication.create.accepted',
    'video.publication.create.succeeded',
    'video.publication.create.failed',
    'video.publication.create.retry_scheduled',
    true
  ),
  (
    'video.publication.metadata.update',
    'video.publication.metadata.update.sync',
    'video.publication.metadata.update.accepted',
    'video.publication.metadata.update.succeeded',
    'video.publication.metadata.update.failed',
    'video.publication.metadata.update.retry_scheduled',
    true
  ),
  (
    'video.publication.source.set',
    'video.publication.source.set.sync',
    'video.publication.source.set.accepted',
    'video.publication.source.set.succeeded',
    'video.publication.source.set.failed',
    'video.publication.source.set.retry_scheduled',
    true
  ),
  (
    'video.publication.show_episode.bind',
    'video.publication.show_episode.bind.sync',
    'video.publication.show_episode.bind.accepted',
    'video.publication.show_episode.bind.succeeded',
    'video.publication.show_episode.bind.failed',
    'video.publication.show_episode.bind.retry_scheduled',
    true
  ),
  (
    'video.publication.poster.set',
    'video.publication.poster.set.sync',
    'video.publication.poster.set.accepted',
    'video.publication.poster.set.succeeded',
    'video.publication.poster.set.failed',
    'video.publication.poster.set.retry_scheduled',
    true
  ),
  (
    'video.publication.captions.replace',
    'video.publication.captions.replace.sync',
    'video.publication.captions.replace.accepted',
    'video.publication.captions.replace.succeeded',
    'video.publication.captions.replace.failed',
    'video.publication.captions.replace.retry_scheduled',
    true
  ),
  (
    'video.publication.transcript.set',
    'video.publication.transcript.set.sync',
    'video.publication.transcript.set.accepted',
    'video.publication.transcript.set.succeeded',
    'video.publication.transcript.set.failed',
    'video.publication.transcript.set.retry_scheduled',
    true
  ),
  (
    'video.publication.chapters.replace',
    'video.publication.chapters.replace.sync',
    'video.publication.chapters.replace.accepted',
    'video.publication.chapters.replace.succeeded',
    'video.publication.chapters.replace.failed',
    'video.publication.chapters.replace.retry_scheduled',
    true
  ),
  (
    'video.publication.version.snapshot_working',
    'video.publication.version.snapshot_working.sync',
    'video.publication.version.snapshot_working.accepted',
    'video.publication.version.snapshot_working.succeeded',
    'video.publication.version.snapshot_working.failed',
    'video.publication.version.snapshot_working.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Defense in depth: typed Video tables are not browser mutation surfaces.
-- ---------------------------------------------------------------------------

alter table video.publication_classifications enable row level security;
alter table video.source_providers enable row level security;
alter table video.caption_track_kinds enable row level security;
alter table video.sources enable row level security;
alter table video.publications enable row level security;
alter table video.caption_tracks enable row level security;
alter table video.publication_chapters enable row level security;
alter table video.publication_versions enable row level security;
alter table video.publication_version_caption_tracks enable row level security;
alter table video.publication_version_chapters enable row level security;

revoke all
  on all tables in schema video
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Migration-local proof: existing authority is untouched and Video ratchets
-- directly onto K0/K1 primitives.
-- ---------------------------------------------------------------------------

do $phase_7a_k2_proof$
declare
  v_baseline phase_7a_k2_baseline%rowtype;
  v_count bigint;
begin
  select *
  into strict v_baseline
  from phase_7a_k2_baseline;

  if (select count(*) from editorial.resources) <> v_baseline.resource_count
     or (
       select md5(
         coalesce(
           string_agg(
             concat_ws(
               '|',
               resource_row.id::text,
               resource_row.resource_kind,
               resource_row.lifecycle_state,
               resource_row.visibility,
               coalesce(resource_row.current_working_version_id::text, ''),
               coalesce(resource_row.current_submitted_version_id::text, ''),
               coalesce(resource_row.current_approved_version_id::text, ''),
               coalesce(resource_row.current_published_version_id::text, '')
             ),
             E'\n'
             order by resource_row.id::text
           ),
           ''
         )
       )
       from editorial.resources resource_row
     ) is distinct from v_baseline.resource_fingerprint
  then
    raise exception
      'STOP: K2 mutated pre-existing Resource identity or lifecycle data';
  end if;

  if (select count(*) from editorial.resource_versions)
       <> v_baseline.resource_version_count
     or (
       select md5(
         coalesce(
           string_agg(
             concat_ws(
               '|',
               version_row.id::text,
               version_row.resource_id::text,
               version_row.resource_kind,
               version_row.version_type,
               version_row.version_kind,
               version_row.version_number::text,
               version_row.content_fingerprint
             ),
             E'\n'
             order by version_row.id::text
           ),
           ''
         )
       )
       from editorial.resource_versions version_row
     ) is distinct from v_baseline.resource_version_fingerprint
  then
    raise exception
      'STOP: K2 mutated pre-existing Resource Version data';
  end if;

  if (select count(*) from media.usage_links) <> v_baseline.media_usage_count
     or (
       select md5(
         coalesce(
           string_agg(
             concat_ws(
               '|',
               usage_row.id::text,
               usage_row.asset_id::text,
               coalesce(usage_row.asset_revision_id::text, ''),
               usage_row.target_authority,
               usage_row.target_kind,
               usage_row.target_id::text,
               coalesce(usage_row.target_version_kind, ''),
               coalesce(usage_row.target_version_id::text, ''),
               usage_row.usage_role,
               usage_row.usage_state,
               usage_row.usage_revision::text
             ),
             E'\n'
             order by usage_row.id::text
           ),
           ''
         )
       )
       from media.usage_links usage_row
     ) is distinct from v_baseline.media_usage_fingerprint
  then
    raise exception
      'STOP: K2 mutated pre-existing Media usage data';
  end if;

  if (select count(*) from editorial.resource_version_editorial_metadata)
       <> v_baseline.discovery_metadata_count
     or (select count(*) from editorial.resource_version_taxonomy_terms)
       <> v_baseline.discovery_taxonomy_count
  then
    raise exception
      'STOP: K2 mutated pre-existing Discovery attachment data';
  end if;

  select count(*)
  into v_count
  from information_schema.columns column_row
  where column_row.table_schema = 'editorial'
    and column_row.table_name = 'video_publication_resources';

  if v_count <> 3
     or exists (
       select 1
       from information_schema.columns column_row
       where column_row.table_schema = 'editorial'
         and column_row.table_name = 'video_publication_resources'
         and column_row.column_name in (
           'current_working_version_id',
           'current_submitted_version_id',
           'current_approved_version_id',
           'current_published_version_id'
         )
     )
  then
    raise exception
      'STOP: Video binding renewed typed lifecycle-pointer duplication';
  end if;

  if (
    select count(*)
    from editorial.resource_version_type_kinds mapping
    where mapping.version_type = 'video_publication_version'
      and mapping.resource_kind in ('standalone_video', 'video_episode')
  ) <> 2
  then
    raise exception
      'STOP: Video Resource Version type/kind mapping is incomplete';
  end if;

  if (
    select count(*)
    from media.usage_roles role_row
    where role_row.usage_role in (
      'video_master',
      'video_poster',
      'video_caption',
      'video_transcript'
    )
      and role_row.enabled
  ) <> 4
  then
    raise exception
      'STOP: Video Media usage vocabulary is incomplete';
  end if;
end;
$phase_7a_k2_proof$;

commit;
