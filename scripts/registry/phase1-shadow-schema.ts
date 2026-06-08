import { createRegistryPool } from "./phase1-db";

const ddl = `
create extension if not exists pgcrypto;

create table if not exists public.registry_release_artists (
  id uuid primary key default gen_random_uuid(),
  release_id uuid,
  artist_id uuid,
  artist_slug text,
  artist_name_text text,
  role text not null default 'primary_artist',
  is_primary boolean not null default true,
  is_featured boolean not null default false,
  credit_order integer not null default 1,
  display_credit text,
  source text not null default 'phase1_shadow_backfill',
  confidence integer not null default 0,
  status text not null default 'shadow',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_track_artists (
  id uuid primary key default gen_random_uuid(),
  track_id uuid,
  artist_id uuid,
  artist_slug text,
  artist_name_text text,
  role text not null default 'primary_artist',
  is_primary boolean not null default true,
  is_featured boolean not null default false,
  credit_order integer not null default 1,
  display_credit text,
  source text not null default 'phase1_shadow_backfill',
  confidence integer not null default 0,
  status text not null default 'shadow',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_release_tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid,
  track_id uuid,
  disc_number integer not null default 1,
  track_number integer,
  source text not null default 'phase1_shadow_backfill',
  confidence integer not null default 0,
  status text not null default 'shadow',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_provider_sources (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  provider text not null,
  provider_entity_type text,
  provider_entity_id text,
  provider_url text,
  storefront text,
  is_primary_source boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active'
);

create table if not exists public.registry_field_provenance (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  field_name text not null,
  field_value text,
  source_type text not null,
  source_id text,
  source_table text,
  confidence integer not null default 0,
  decision text not null default 'observed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.registry_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_label text not null default 'system',
  action text not null,
  entity_type text,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.registry_countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text unique,
  iso3 text unique,
  name text not null,
  region text,
  subregion text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_imprints (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  label_id uuid,
  country_code text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registry_release_artists add column if not exists release_id uuid;
alter table public.registry_release_artists add column if not exists artist_id uuid;
alter table public.registry_release_artists add column if not exists artist_slug text;
alter table public.registry_release_artists add column if not exists artist_name_text text;
alter table public.registry_release_artists add column if not exists role text not null default 'primary_artist';
alter table public.registry_release_artists add column if not exists is_primary boolean not null default true;
alter table public.registry_release_artists add column if not exists is_featured boolean not null default false;
alter table public.registry_release_artists add column if not exists credit_order integer not null default 1;
alter table public.registry_release_artists add column if not exists display_credit text;
alter table public.registry_release_artists add column if not exists source text not null default 'phase1_shadow_backfill';
alter table public.registry_release_artists add column if not exists confidence integer not null default 0;
alter table public.registry_release_artists add column if not exists status text not null default 'shadow';
alter table public.registry_release_artists add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.registry_release_artists add column if not exists created_at timestamptz not null default now();
alter table public.registry_release_artists add column if not exists updated_at timestamptz not null default now();

alter table public.registry_track_artists add column if not exists track_id uuid;
alter table public.registry_track_artists add column if not exists artist_id uuid;
alter table public.registry_track_artists add column if not exists artist_slug text;
alter table public.registry_track_artists add column if not exists artist_name_text text;
alter table public.registry_track_artists add column if not exists role text not null default 'primary_artist';
alter table public.registry_track_artists add column if not exists is_primary boolean not null default true;
alter table public.registry_track_artists add column if not exists is_featured boolean not null default false;
alter table public.registry_track_artists add column if not exists credit_order integer not null default 1;
alter table public.registry_track_artists add column if not exists display_credit text;
alter table public.registry_track_artists add column if not exists source text not null default 'phase1_shadow_backfill';
alter table public.registry_track_artists add column if not exists confidence integer not null default 0;
alter table public.registry_track_artists add column if not exists status text not null default 'shadow';
alter table public.registry_track_artists add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.registry_track_artists add column if not exists created_at timestamptz not null default now();
alter table public.registry_track_artists add column if not exists updated_at timestamptz not null default now();

alter table public.registry_release_tracks add column if not exists release_id uuid;
alter table public.registry_release_tracks add column if not exists track_id uuid;
alter table public.registry_release_tracks add column if not exists disc_number integer not null default 1;
alter table public.registry_release_tracks add column if not exists track_number integer;
alter table public.registry_release_tracks add column if not exists source text not null default 'phase1_shadow_backfill';
alter table public.registry_release_tracks add column if not exists confidence integer not null default 0;
alter table public.registry_release_tracks add column if not exists status text not null default 'shadow';
alter table public.registry_release_tracks add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.registry_release_tracks add column if not exists created_at timestamptz not null default now();
alter table public.registry_release_tracks add column if not exists updated_at timestamptz not null default now();

create unique index if not exists registry_release_artists_release_artist_role_idx
  on public.registry_release_artists (release_id, artist_id, role, credit_order)
  where release_id is not null and artist_id is not null;

create unique index if not exists registry_release_artists_release_slug_role_idx
  on public.registry_release_artists (release_id, artist_slug, role, credit_order)
  where release_id is not null and artist_id is null and artist_slug is not null;

create unique index if not exists registry_track_artists_track_artist_role_idx
  on public.registry_track_artists (track_id, artist_id, role, credit_order)
  where track_id is not null and artist_id is not null;

create unique index if not exists registry_track_artists_track_slug_role_idx
  on public.registry_track_artists (track_id, artist_slug, role, credit_order)
  where track_id is not null and artist_id is null and artist_slug is not null;

create unique index if not exists registry_release_tracks_release_track_idx
  on public.registry_release_tracks (release_id, track_id)
  where release_id is not null and track_id is not null;

create index if not exists registry_release_artists_release_id_idx on public.registry_release_artists (release_id);
create index if not exists registry_release_artists_artist_id_idx on public.registry_release_artists (artist_id);
create index if not exists registry_release_artists_artist_slug_idx on public.registry_release_artists (artist_slug);
create index if not exists registry_track_artists_track_id_idx on public.registry_track_artists (track_id);
create index if not exists registry_track_artists_artist_id_idx on public.registry_track_artists (artist_id);
create index if not exists registry_track_artists_artist_slug_idx on public.registry_track_artists (artist_slug);
create index if not exists registry_release_tracks_release_id_idx on public.registry_release_tracks (release_id);
create index if not exists registry_release_tracks_track_id_idx on public.registry_release_tracks (track_id);
create index if not exists registry_provider_sources_entity_idx on public.registry_provider_sources (entity_type, entity_id);
create index if not exists registry_provider_sources_provider_idx on public.registry_provider_sources (provider, provider_entity_type, provider_entity_id);
create index if not exists registry_field_provenance_entity_idx on public.registry_field_provenance (entity_type, entity_id);
create index if not exists registry_audit_log_entity_idx on public.registry_audit_log (entity_type, entity_id);
create index if not exists registry_audit_log_created_at_idx on public.registry_audit_log (created_at desc);

insert into public.registry_audit_log (actor_label, action, entity_type, metadata)
values (
  'system',
  'phase1_shadow_schema_applied',
  'registry_shadow_schema',
  jsonb_build_object(
    'scope', 'additive_only',
    'public_rendering_changed', false,
    'public_api_changed', false,
    'destructive_changes', false
  )
);
`;

async function main() {
  const pool = createRegistryPool();

  try {
    await pool.query("select 1");
    console.log("[phase1-shadow-schema] Database connection verified.");

    await pool.query("begin");
    await pool.query(ddl);
    await pool.query("commit");

    console.log("[phase1-shadow-schema] Additive shadow schema applied successfully.");
    console.log("[phase1-shadow-schema] No public rendering or public API code was changed.");
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    console.error("[phase1-shadow-schema] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
