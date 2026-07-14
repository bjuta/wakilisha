-- WAKILISHA React Rebuild
-- 002_repaired_graph_tables.sql
--
-- Clean graph tables produced by the data repair layer.
-- React page payloads should read from this repaired schema, not staging tables.

create schema if not exists wakilisha_repaired;

create table if not exists wakilisha_repaired.entity_slugs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  slug text not null,
  full_path text,
  status text not null default 'active',
  is_primary boolean not null default false,
  legacy_path text,
  redirect_to_entity_type text,
  redirect_to_entity_id text,
  source text,
  needs_review boolean not null default false,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_slugs_status_check check (status in ('active', 'redirect', 'retired', 'duplicate', 'review'))
);

create index if not exists entity_slugs_entity_idx
  on wakilisha_repaired.entity_slugs(entity_type, entity_id);

create index if not exists entity_slugs_slug_idx
  on wakilisha_repaired.entity_slugs(slug);

create unique index if not exists entity_slugs_primary_unique_idx
  on wakilisha_repaired.entity_slugs(entity_type, entity_id)
  where is_primary = true and status = 'active';

create table if not exists wakilisha_repaired.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  source_entity_type text not null,
  source_entity_id text not null,
  relationship_type text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  position integer,
  role text,
  confidence numeric not null default 0.5,
  source text,
  source_ref text,
  source_payload jsonb,
  needs_review boolean not null default false,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entity_relationships_source_idx
  on wakilisha_repaired.entity_relationships(source_entity_type, source_entity_id);

create index if not exists entity_relationships_target_idx
  on wakilisha_repaired.entity_relationships(target_entity_type, target_entity_id);

create index if not exists entity_relationships_type_idx
  on wakilisha_repaired.entity_relationships(relationship_type);

create unique index if not exists entity_relationships_dedupe_idx
  on wakilisha_repaired.entity_relationships(
    source_entity_type,
    source_entity_id,
    relationship_type,
    target_entity_type,
    target_entity_id,
    coalesce(role, ''),
    coalesce(position, -1)
  );

create table if not exists wakilisha_repaired.track_artists (
  track_id text not null,
  artist_id text not null,
  artist_name_snapshot text,
  role text default 'primary',
  position integer default 1,
  source text,
  confidence numeric not null default 0.5,
  needs_review boolean not null default false,
  review_reason text,
  primary key (track_id, artist_id, coalesce(role, ''), coalesce(position, -1))
);

create table if not exists wakilisha_repaired.release_tracks (
  release_id text not null,
  track_id text not null,
  disc_number integer default 1,
  track_number integer,
  title_snapshot text,
  artist_snapshot text,
  source text,
  confidence numeric not null default 0.5,
  needs_review boolean not null default false,
  review_reason text,
  primary key (release_id, track_id, coalesce(disc_number, 1), coalesce(track_number, -1))
);

create table if not exists wakilisha_repaired.artist_genres (
  artist_id text not null,
  genre_id text not null,
  source text,
  confidence numeric not null default 0.5,
  needs_review boolean not null default false,
  review_reason text,
  primary key (artist_id, genre_id)
);

create table if not exists wakilisha_repaired.track_playback_sources (
  id uuid primary key default gen_random_uuid(),
  track_id text not null,
  provider text,
  provider_track_id text,
  isrc text,
  preview_url text,
  duration_ms integer,
  artwork_url text,
  source_url text,
  source_ref text,
  source_payload jsonb,
  confidence numeric not null default 0.5,
  needs_review boolean not null default false,
  review_reason text,
  created_at timestamptz not null default now()
);

create index if not exists track_playback_sources_track_idx
  on wakilisha_repaired.track_playback_sources(track_id);

create table if not exists wakilisha_repaired.content_route_classification (
  id uuid primary key default gen_random_uuid(),
  legacy_wp_post_id text,
  legacy_post_type text,
  slug text,
  title text,
  classification text not null,
  react_route text,
  migration_action text,
  needs_review boolean not null default false,
  review_reason text,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  constraint content_route_classification_check check (
    classification in ('article', 'guide', 'surface_page', 'app_mount', 'taxonomy_shell', 'utility_page', 'commerce_page', 'retire', 'review')
  )
);

create table if not exists wakilisha_repaired.review_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  label text,
  issue text not null,
  source text,
  confidence numeric,
  recommendation text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_queue_status_check check (status in ('open', 'accepted', 'rejected', 'resolved', 'ignored'))
);
