-- Phase 5A Migration 208: canonical Playlist authority foundation.
--
-- This migration establishes the permanent Playlist identity and version
-- substrate without creating the Phase 5A mutation command layer.
--
-- It:
-- 1. removes the two product-owner-confirmed fake Playlist records under exact guards
-- 2. registers Playlist-item Resource identity
-- 3. adds Playlist working revision and stable item lifecycle semantics
-- 4. creates typed Playlist-item Resource bindings
-- 5. creates Playlist versions and immutable ordered item snapshots
-- 6. adds typed Playlist version pointers
-- 7. extends shared Media usage for Playlist covers
-- 8. extends shared Citation and Credit attachment authority to Playlist versions
-- 9. adds Playlist-domain capabilities
-- 10. removes the Playlist tables' updated_at dependency on Institute helpers
--
-- It does not:
-- - expose a new public Playlist read model
-- - create Playlist mutation commands
-- - cut the frontend over from the frozen Institute bridge
-- - publish Playlist content
-- - deploy any Edge Function
-- - create a second Media, Citation, Credit, Review, or Registry authority

begin;

do $phase_5a_m208_preflight$
declare
  playlist_count bigint;
  item_count bigint;
  playlist_resource_count bigint;
  fake_resource_dependency_count bigint;
  fake_review_packet_count bigint;
begin
  if to_regclass('public.wk_playlists') is null then
    raise exception 'STOP: public.wk_playlists does not exist';
  end if;

  if to_regclass('public.wk_playlist_items') is null then
    raise exception 'STOP: public.wk_playlist_items does not exist';
  end if;

  if to_regclass('editorial.resources') is null then
    raise exception 'STOP: editorial.resources does not exist';
  end if;

  if to_regclass('editorial.resource_kinds') is null then
    raise exception 'STOP: editorial.resource_kinds does not exist';
  end if;

  if to_regclass('editorial.playlist_resources') is null then
    raise exception 'STOP: editorial.playlist_resources does not exist';
  end if;

  if to_regclass('editorial.resource_citations') is null then
    raise exception 'STOP: editorial.resource_citations does not exist';
  end if;

  if to_regclass('editorial.resource_credits') is null then
    raise exception 'STOP: editorial.resource_credits does not exist';
  end if;

  if to_regclass('media.assets') is null then
    raise exception 'STOP: media.assets does not exist';
  end if;

  if to_regclass('media.asset_purposes') is null then
    raise exception 'STOP: media.asset_purposes does not exist';
  end if;

  if to_regclass('media.usage_links') is null then
    raise exception 'STOP: media.usage_links does not exist';
  end if;

  if to_regclass('media.usage_roles') is null then
    raise exception 'STOP: media.usage_roles does not exist';
  end if;

  if to_regclass('public.capability_definitions') is null then
    raise exception 'STOP: public.capability_definitions does not exist';
  end if;

  if to_regclass('public.role_definitions') is null then
    raise exception 'STOP: public.role_definitions does not exist';
  end if;

  if to_regclass('public.role_capabilities') is null then
    raise exception 'STOP: public.role_capabilities does not exist';
  end if;

  if to_regprocedure('platform_private.touch_updated_at()') is null then
    raise exception 'STOP: platform_private.touch_updated_at() does not exist';
  end if;

  if to_regclass('editorial.playlist_item_resources') is not null then
    raise exception 'STOP: editorial.playlist_item_resources already exists';
  end if;

  if to_regclass('editorial.playlist_versions') is not null then
    raise exception 'STOP: editorial.playlist_versions already exists';
  end if;

  if to_regclass('editorial.playlist_version_items') is not null then
    raise exception 'STOP: editorial.playlist_version_items already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'authority_revision'
  ) then
    raise exception 'STOP: wk_playlists.authority_revision already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlist_items'
      and column_name in ('lifecycle_state', 'removed_at', 'removed_by')
  ) then
    raise exception 'STOP: One or more Phase 5A Playlist-item lifecycle columns already exist';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind = 'playlist_item'
  ) then
    raise exception 'STOP: playlist_item Resource kind already exists';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key in (
      'view_playlists',
      'edit_own_playlists',
      'edit_others_playlists',
      'publish_playlists',
      'delete_playlists'
    )
  ) then
    raise exception 'STOP: One or more Phase 5A Playlist capabilities already exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('reviewer'),
        ('writer'),
        ('author')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions definition
      where definition.role_key = required.role_key
    )
  ) then
    raise exception 'STOP: One or more required Playlist role definitions do not exist';
  end if;

  select count(*)
  into playlist_count
  from public.wk_playlists;

  if playlist_count <> 2 then
    raise exception
      'STOP: Expected exactly 2 known fake Playlist rows, found %',
      playlist_count;
  end if;

  if exists (
    select 1
    from public.wk_playlists
    where id not in (
      '4a422c74-1257-4dc6-b58e-516491ace629'::uuid,
      '8df68493-70dd-417f-bd04-69c74d7ff1e8'::uuid
    )
  ) then
    raise exception 'STOP: An unexpected Playlist row exists';
  end if;

  if not exists (
    select 1
    from public.wk_playlists
    where id = '4a422c74-1257-4dc6-b58e-516491ace629'::uuid
      and slug = 'between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton'
      and metadata ->> 'created_from' = 'institute_playlist_bridge'
      and source_inquiry_id is null
      and source_work_product_link_id is null
      and published_at is null
  ) then
    raise exception 'STOP: First known fake Playlist no longer matches the accepted cleanup fingerprint';
  end if;

  if not exists (
    select 1
    from public.wk_playlists
    where id = '8df68493-70dd-417f-bd04-69c74d7ff1e8'::uuid
      and slug = 'between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton-2'
      and metadata ->> 'created_from' = 'institute_playlist_bridge'
      and source_inquiry_id is null
      and source_work_product_link_id is null
      and published_at is null
  ) then
    raise exception 'STOP: Second known fake Playlist no longer matches the accepted cleanup fingerprint';
  end if;

  select count(*)
  into item_count
  from public.wk_playlist_items;

  if item_count <> 4 then
    raise exception
      'STOP: Expected exactly 4 known fake Playlist items, found %',
      item_count;
  end if;

  if exists (
    select 1
    from public.wk_playlist_items
    where id not in (
      '41bc3640-c659-4f17-bcb2-5ceefa654115'::uuid,
      '9a9e3125-6247-437e-8826-e69f88c68547'::uuid,
      '4813028a-9047-4ace-8e99-fbe7ce1442a4'::uuid,
      '9ca2c07f-4d59-4fef-a623-824cc92ee2ba'::uuid
    )
  ) then
    raise exception 'STOP: An unexpected Playlist item exists';
  end if;

  if exists (
    select 1
    from public.wk_playlist_items
    where playlist_id not in (
      '4a422c74-1257-4dc6-b58e-516491ace629'::uuid,
      '8df68493-70dd-417f-bd04-69c74d7ff1e8'::uuid
    )
  ) then
    raise exception 'STOP: A Playlist item belongs to an unexpected Playlist';
  end if;

  select count(*)
  into playlist_resource_count
  from editorial.playlist_resources;

  if playlist_resource_count <> 1 then
    raise exception
      'STOP: Expected exactly 1 fake Playlist Resource binding, found %',
      playlist_resource_count;
  end if;

  if not exists (
    select 1
    from editorial.playlist_resources
    where playlist_id = '8df68493-70dd-417f-bd04-69c74d7ff1e8'::uuid
      and resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid
      and resource_kind = 'playlist'
  ) then
    raise exception 'STOP: Fake Playlist Resource binding no longer matches accepted state';
  end if;

  if not exists (
    select 1
    from editorial.resources
    where id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid
      and resource_kind = 'playlist'
  ) then
    raise exception 'STOP: Fake Playlist Resource identity no longer matches accepted state';
  end if;

  select
    (select count(*) from editorial.resource_aliases
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.resource_credits
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.resource_citations
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.publishing_items
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from platform_private.command_receipts
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.correction_cases
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.correction_targets
      where target_resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.correction_applications
      where target_resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.correction_public_notes
      where affected_resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.correction_related_resource_reviews
      where related_resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
    + (select count(*) from editorial.media_asset_resources
      where resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid)
  into fake_resource_dependency_count;

  if fake_resource_dependency_count <> 0 then
    raise exception
      'STOP: Fake Playlist Resource acquired % dependent record(s)',
      fake_resource_dependency_count;
  end if;

  select count(*)
  into fake_review_packet_count
  from public.institute_review_packets
  where snapshot_json #>> '{workProduct,productId}' in (
      '4a422c74-1257-4dc6-b58e-516491ace629',
      '8df68493-70dd-417f-bd04-69c74d7ff1e8'
    )
     or snapshot_json #>> '{workProduct,productSlug}' in (
      'between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton',
      'between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton-2'
    );

  if fake_review_packet_count <> 0 then
    raise exception
      'STOP: Found % Institute review packet(s) tied to fake Playlist data',
      fake_review_packet_count;
  end if;
end;
$phase_5a_m208_preflight$;

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values (
  'playlist_item',
  'Playlist item',
  'Stable identity for one ordered item in a WAKILISHA Playlist.',
  true
);

alter table public.wk_playlists
  add column authority_revision bigint not null default 1;

alter table public.wk_playlists
  add constraint wk_playlists_authority_revision_check
  check (authority_revision >= 1);

alter table public.wk_playlist_items
  add column lifecycle_state text not null default 'active',
  add column removed_at timestamptz,
  add column removed_by uuid;

alter table public.wk_playlist_items
  alter column position drop not null;

alter table public.wk_playlist_items
  drop constraint wk_playlist_items_position_check;

alter table public.wk_playlist_items
  drop constraint wk_playlist_items_playlist_id_position_key;

alter table public.wk_playlist_items
  add constraint wk_playlist_items_removed_by_fkey
  foreign key (removed_by)
  references auth.users(id)
  on delete set null;

alter table public.wk_playlist_items
  add constraint wk_playlist_items_lifecycle_state_check
  check (lifecycle_state in ('active', 'removed'));

alter table public.wk_playlist_items
  add constraint wk_playlist_items_lifecycle_integrity_check
  check (
    (
      lifecycle_state = 'active'
      and position is not null
      and position > 0
      and removed_at is null
      and removed_by is null
    )
    or
    (
      lifecycle_state = 'removed'
      and position is null
      and removed_at is not null
    )
  );

drop index if exists public.wk_playlist_items_playlist_position_idx;

create unique index wk_playlist_items_active_position_key
  on public.wk_playlist_items (playlist_id, position)
  where lifecycle_state = 'active';

create index wk_playlist_items_playlist_position_idx
  on public.wk_playlist_items (playlist_id, position)
  where lifecycle_state = 'active';

create index wk_playlist_items_removed_idx
  on public.wk_playlist_items (playlist_id, removed_at desc)
  where lifecycle_state = 'removed';

drop trigger if exists wk_playlists_set_updated_at
  on public.wk_playlists;

create trigger wk_playlists_set_updated_at
before update on public.wk_playlists
for each row
execute function platform_private.touch_updated_at();

drop trigger if exists wk_playlist_items_set_updated_at
  on public.wk_playlist_items;

create trigger wk_playlist_items_set_updated_at
before update on public.wk_playlist_items
for each row
execute function platform_private.touch_updated_at();

create table editorial.playlist_item_resources (
  resource_id uuid primary key,
  resource_kind text not null default 'playlist_item',
  playlist_item_id uuid not null unique,

  constraint playlist_item_resources_kind_check
    check (resource_kind = 'playlist_item'),

  constraint playlist_item_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint playlist_item_resources_item_fkey
    foreign key (playlist_item_id)
    references public.wk_playlist_items(id)
    on update cascade
    on delete restrict,

  constraint playlist_item_resources_resource_item_key
    unique (resource_id, playlist_item_id)
);

comment on table editorial.playlist_item_resources is
  'Typed canonical binding between a stable Resource and a Playlist item.';

revoke all on editorial.playlist_item_resources
  from public, anon, authenticated;

grant select, insert, update, delete
  on editorial.playlist_item_resources
  to service_role;

alter table editorial.playlist_resources
  add constraint playlist_resources_resource_playlist_key
  unique (resource_id, playlist_id);

create table editorial.playlist_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  playlist_id uuid not null,
  version_number bigint not null,
  version_kind text not null,
  source_authority_revision bigint not null,
  title text not null,
  slug text not null,
  description text,
  curator_label text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  item_count integer not null,
  content_fingerprint text not null,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint playlist_versions_resource_playlist_fkey
    foreign key (resource_id, playlist_id)
    references editorial.playlist_resources(resource_id, playlist_id)
    on update cascade
    on delete restrict,

  constraint playlist_versions_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint playlist_versions_number_check
    check (version_number >= 1),

  constraint playlist_versions_kind_check
    check (
      version_kind in (
        'working',
        'submitted',
        'approved',
        'published'
      )
    ),

  constraint playlist_versions_authority_revision_check
    check (source_authority_revision >= 1),

  constraint playlist_versions_title_check
    check (nullif(btrim(title), '') is not null),

  constraint playlist_versions_slug_check
    check (nullif(btrim(slug), '') is not null),

  constraint playlist_versions_metadata_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint playlist_versions_item_count_check
    check (item_count >= 0),

  constraint playlist_versions_fingerprint_check
    check (content_fingerprint ~ '^[0-9a-f]{64}$'),

  constraint playlist_versions_resource_number_key
    unique (resource_id, version_number),

  constraint playlist_versions_identity_binding_key
    unique (id, resource_id, playlist_id)
);

comment on table editorial.playlist_versions is
  'Immutable Playlist snapshots used for working recovery, Review, approval, and publication.';

create index playlist_versions_playlist_created_idx
  on editorial.playlist_versions (playlist_id, created_at desc);

create index playlist_versions_resource_kind_created_idx
  on editorial.playlist_versions (resource_id, version_kind, created_at desc);

revoke all on editorial.playlist_versions
  from public, anon, authenticated;

grant select, insert
  on editorial.playlist_versions
  to service_role;

create table editorial.playlist_version_items (
  playlist_version_id uuid not null,
  playlist_item_resource_id uuid not null,
  playlist_item_id uuid not null,
  position integer not null,
  registry_track_id uuid,
  registry_release_id uuid,
  provider_key text,
  provider_track_id text,
  provider_url text,
  title text,
  artist_names text[] not null default '{}'::text[],
  release_title text,
  artwork_url text,
  preview_url text,
  duration_ms integer,
  isrc text,
  match_status text not null,
  match_confidence numeric(5,4),
  normalization_payload jsonb not null default '{}'::jsonb,
  notes text,

  constraint playlist_version_items_pkey
    primary key (playlist_version_id, playlist_item_resource_id),

  constraint playlist_version_items_version_fkey
    foreign key (playlist_version_id)
    references editorial.playlist_versions(id)
    on delete cascade,

  constraint playlist_version_items_item_identity_fkey
    foreign key (playlist_item_resource_id, playlist_item_id)
    references editorial.playlist_item_resources(resource_id, playlist_item_id)
    on delete restrict,

  constraint playlist_version_items_registry_track_fkey
    foreign key (registry_track_id)
    references public.registry_tracks(id)
    on delete set null,

  constraint playlist_version_items_registry_release_fkey
    foreign key (registry_release_id)
    references public.registry_releases(id)
    on delete set null,

  constraint playlist_version_items_position_check
    check (position > 0),

  constraint playlist_version_items_provider_key_check
    check (
      provider_key is null
      or (
        provider_key = lower(provider_key)
        and provider_key ~ '^[a-z0-9_]+$'
      )
    ),

  constraint playlist_version_items_duration_ms_check
    check (duration_ms is null or duration_ms > 0),

  constraint playlist_version_items_match_status_check
    check (
      match_status in (
        'matched',
        'external_only',
        'missing_registry_track',
        'needs_review',
        'rejected',
        'pending'
      )
    ),

  constraint playlist_version_items_match_confidence_check
    check (
      match_confidence is null
      or (match_confidence >= 0 and match_confidence <= 1)
    ),

  constraint playlist_version_items_normalization_check
    check (jsonb_typeof(normalization_payload) = 'object'),

  constraint playlist_version_items_position_key
    unique (playlist_version_id, position)
);

comment on table editorial.playlist_version_items is
  'Immutable ordered Playlist-item snapshots belonging to one Playlist version.';

create index playlist_version_items_track_idx
  on editorial.playlist_version_items (registry_track_id)
  where registry_track_id is not null;

create index playlist_version_items_provider_idx
  on editorial.playlist_version_items (provider_key, provider_track_id)
  where provider_key is not null
    and provider_track_id is not null;

revoke all on editorial.playlist_version_items
  from public, anon, authenticated;

grant select, insert
  on editorial.playlist_version_items
  to service_role;

alter table editorial.playlist_resources
  add column current_working_version_id uuid,
  add column current_submitted_version_id uuid,
  add column current_approved_version_id uuid,
  add column current_published_version_id uuid;

alter table editorial.playlist_resources
  add constraint playlist_resources_working_version_fkey
  foreign key (current_working_version_id, resource_id, playlist_id)
  references editorial.playlist_versions(id, resource_id, playlist_id)
  on delete restrict
  deferrable initially deferred;

alter table editorial.playlist_resources
  add constraint playlist_resources_submitted_version_fkey
  foreign key (current_submitted_version_id, resource_id, playlist_id)
  references editorial.playlist_versions(id, resource_id, playlist_id)
  on delete restrict
  deferrable initially deferred;

alter table editorial.playlist_resources
  add constraint playlist_resources_approved_version_fkey
  foreign key (current_approved_version_id, resource_id, playlist_id)
  references editorial.playlist_versions(id, resource_id, playlist_id)
  on delete restrict
  deferrable initially deferred;

alter table editorial.playlist_resources
  add constraint playlist_resources_published_version_fkey
  foreign key (current_published_version_id, resource_id, playlist_id)
  references editorial.playlist_versions(id, resource_id, playlist_id)
  on delete restrict
  deferrable initially deferred;

insert into media.asset_purposes (
  asset_purpose,
  label,
  description,
  sort_order
)
values (
  'playlist_cover',
  'Playlist cover',
  'Cover artwork selected for a WAKILISHA Playlist.',
  45
)
on conflict (asset_purpose)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;

insert into media.usage_roles (
  usage_role,
  label,
  description,
  sort_order
)
values (
  'playlist_cover',
  'Playlist cover',
  'Cover placement for a WAKILISHA Playlist.',
  35
)
on conflict (usage_role)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = true;

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
      'playlist'
    )
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
    when 'other' then
      true
    else
      false
  end;
$function$;

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
set search_path to 'pg_catalog', 'public', 'editorial', 'auth'
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

alter table editorial.resource_citations
  drop constraint resource_citations_resource_kind_check;

alter table editorial.resource_citations
  drop constraint resource_citations_target_type_check;

alter table editorial.resource_citations
  add constraint resource_citations_resource_kind_check
  check (resource_kind in ('article', 'playlist', 'playlist_item'));

alter table editorial.resource_citations
  add constraint resource_citations_target_type_check
  check (
    (
      resource_kind = 'article'
      and target_version_type = 'article_version'
    )
    or
    (
      resource_kind in ('playlist', 'playlist_item')
      and target_version_type = 'playlist_version'
    )
  );

alter table editorial.resource_credits
  drop constraint resource_credits_resource_kind_check;

alter table editorial.resource_credits
  drop constraint resource_credits_target_type_check;

alter table editorial.resource_credits
  add constraint resource_credits_resource_kind_check
  check (resource_kind in ('article', 'playlist', 'playlist_item'));

alter table editorial.resource_credits
  add constraint resource_credits_target_type_check
  check (
    (
      resource_kind = 'article'
      and target_version_type = 'article_version'
    )
    or
    (
      resource_kind in ('playlist', 'playlist_item')
      and target_version_type = 'playlist_version'
    )
  );

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'view_playlists',
    'View Playlists',
    'View internal Playlist work where Playlist authority allows it.',
    'content'
  ),
  (
    'edit_own_playlists',
    'Edit own Playlists',
    'Create and edit Playlists owned by the current worker.',
    'content'
  ),
  (
    'edit_others_playlists',
    'Edit others Playlists',
    'Edit Playlist work owned by other workers.',
    'content'
  ),
  (
    'publish_playlists',
    'Publish Playlists',
    'Approve publication actions for reviewed Playlist versions.',
    'content'
  ),
  (
    'delete_playlists',
    'Delete Playlists',
    'Perform authorized destructive Playlist administration.',
    'content'
  );

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'view_playlists'),
  ('administrator', 'edit_own_playlists'),
  ('administrator', 'edit_others_playlists'),
  ('administrator', 'publish_playlists'),
  ('administrator', 'delete_playlists'),
  ('editor', 'view_playlists'),
  ('editor', 'edit_own_playlists'),
  ('editor', 'edit_others_playlists'),
  ('editor', 'publish_playlists'),
  ('editor', 'delete_playlists'),
  ('reviewer', 'view_playlists'),
  ('writer', 'edit_own_playlists'),
  ('author', 'edit_own_playlists');

-- Guarded fake-data retirement occurs only after all schema ALTER operations.
-- This avoids pending FK trigger events blocking ALTER TABLE on Playlist authority tables.

-- Remove only the product-owner-confirmed fake Playlist state.

delete from editorial.playlist_resources
where playlist_id = '8df68493-70dd-417f-bd04-69c74d7ff1e8'::uuid
  and resource_id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid
  and resource_kind = 'playlist';

delete from public.wk_playlists
where id in (
  '4a422c74-1257-4dc6-b58e-516491ace629'::uuid,
  '8df68493-70dd-417f-bd04-69c74d7ff1e8'::uuid
);

delete from editorial.resources
where id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid
  and resource_kind = 'playlist';

do $phase_5a_m208_cleanup_proof$
begin
  if exists (select 1 from public.wk_playlists) then
    raise exception 'STOP: Playlist cleanup did not converge to zero rows';
  end if;

  if exists (select 1 from public.wk_playlist_items) then
    raise exception 'STOP: Playlist-item cleanup did not converge to zero rows';
  end if;

  if exists (select 1 from editorial.playlist_resources) then
    raise exception 'STOP: Playlist Resource cleanup did not converge to zero rows';
  end if;

  if exists (
    select 1
    from editorial.resources
    where id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid
  ) then
    raise exception 'STOP: Fake Playlist Resource identity still exists';
  end if;
end;
$phase_5a_m208_cleanup_proof$;

do $phase_5a_m208_postconditions$
declare
  playlist_capability_count bigint;
begin
  if exists (select 1 from public.wk_playlists) then
    raise exception 'STOP: Canonical Playlist foundation did not begin from zero Playlist rows';
  end if;

  if exists (select 1 from public.wk_playlist_items) then
    raise exception 'STOP: Canonical Playlist foundation did not begin from zero Playlist items';
  end if;

  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'playlist_item'
      and enabled
  ) then
    raise exception 'STOP: playlist_item Resource kind was not registered';
  end if;

  if to_regclass('editorial.playlist_item_resources') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_version_items') is null then
    raise exception 'STOP: One or more Playlist authority tables were not created';
  end if;

  if not exists (
    select 1
    from media.usage_roles
    where usage_role = 'playlist_cover'
      and enabled
  ) then
    raise exception 'STOP: Playlist cover Media usage role was not registered';
  end if;

  select count(*)
  into playlist_capability_count
  from public.capability_definitions
  where capability_key in (
    'view_playlists',
    'edit_own_playlists',
    'edit_others_playlists',
    'publish_playlists',
    'delete_playlists'
  );

  if playlist_capability_count <> 5 then
    raise exception
      'STOP: Expected 5 Playlist capabilities, found %',
      playlist_capability_count;
  end if;
end;
$phase_5a_m208_postconditions$;

commit;
