-- WAKILISHA runtime database schema
-- Phase 4: Database schema ownership
--
-- This schema makes the new backend/database the source of truth for runtime
-- admin, ingestion, registry, publishing, snapshots, settings, integrations,
-- and legacy import mapping. WordPress is intentionally not part of runtime.
-- It is only represented through legacy import tables.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Generic helpers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION wk_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- Chart ontology: Series × Market = Program
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  default_chart_kind text NOT NULL DEFAULT 'tracks' CHECK (default_chart_kind IN ('tracks', 'releases', 'artists', 'videos')),
  default_period_type text NOT NULL DEFAULT 'weekly',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  country_code text,
  region_code text,
  market_type text NOT NULL DEFAULT 'country' CHECK (market_type IN ('country', 'region', 'diaspora', 'global', 'editorial')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_eligibility_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  version text NOT NULL DEFAULT 'v1',
  visibility text NOT NULL DEFAULT 'admin_only' CHECK (visibility IN ('public', 'admin_only', 'internal_only')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE IF NOT EXISTS chart_market_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  primary_market_slug text NOT NULL REFERENCES chart_markets(slug),
  included_markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  aggregation_mode text NOT NULL DEFAULT 'combined' CHECK (aggregation_mode IN ('combined', 'separate_then_combined', 'weighted', 'minimum_presence', 'editorial')),
  visibility text NOT NULL DEFAULT 'admin_only' CHECK (visibility IN ('public', 'admin_only', 'internal_only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_slug text NOT NULL UNIQUE,
  label text NOT NULL,
  series_slug text NOT NULL REFERENCES chart_series(slug),
  market_slug text NOT NULL REFERENCES chart_markets(slug),
  chart_kind text NOT NULL DEFAULT 'tracks' CHECK (chart_kind IN ('tracks', 'releases', 'artists', 'videos')),
  default_chart_size integer NOT NULL DEFAULT 100 CHECK (default_chart_size > 0),
  default_period_type text NOT NULL DEFAULT 'weekly',
  default_methodology_version text,
  default_eligibility_profile_id uuid REFERENCES chart_eligibility_profiles(id),
  default_market_scope_id uuid REFERENCES chart_market_scopes(id),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'internal_only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_slug, market_slug, chart_kind)
);

CREATE TABLE IF NOT EXISTS chart_slug_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('chart_program', 'chart_edition', 'artist', 'track', 'release', 'label', 'genre')),
  legacy_slug text NOT NULL,
  canonical_slug text NOT NULL,
  redirect_status text NOT NULL DEFAULT 'active' CHECK (redirect_status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, legacy_slug)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Registry: canonical entities and provider identity links
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registry_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  normalized_name text NOT NULL,
  sort_name text,
  bio text,
  artist_type text CHECK (artist_type IN ('solo', 'group', 'collective', 'band', 'duo', 'unknown')),
  gender text CHECK (gender IN ('female', 'male', 'mixed', 'nonbinary', 'unknown', 'not_applicable')),
  origin_iso2 text,
  origin_confidence numeric(5,4),
  public_image_url text,
  image_source_provider text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'needs_review', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registry_artist_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES registry_artists(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  confidence numeric(5,4),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS registry_artist_provider_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES registry_artists(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  provider_artist_id text,
  provider_url text,
  display_name text,
  payload_hash text,
  last_seen_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_review', 'blocked', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, provider_artist_id)
);

CREATE TABLE IF NOT EXISTS registry_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  description text,
  country_code text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'needs_review', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registry_genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_genre_id uuid REFERENCES registry_genres(id),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registry_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  normalized_title text NOT NULL,
  release_type text CHECK (release_type IN ('single', 'ep', 'album', 'mixtape', 'compilation', 'video', 'live', 'unknown')),
  upc text,
  release_date date,
  release_date_precision text CHECK (release_date_precision IN ('year', 'month', 'day', 'unknown')),
  label_id uuid REFERENCES registry_labels(id),
  artwork_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'needs_review', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registry_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  normalized_title text NOT NULL,
  isrc text,
  release_id uuid REFERENCES registry_releases(id),
  duration_ms integer,
  explicit boolean,
  track_number integer,
  disc_number integer,
  artwork_url text,
  preview_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'needs_review', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registry_track_artist_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES registry_tracks(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES registry_artists(id),
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'primary_artist' CHECK (role IN ('primary_artist', 'featured_artist', 'collaborator', 'producer', 'composer', 'remixer', 'group_member', 'unknown')),
  credit_order integer NOT NULL DEFAULT 1,
  confidence numeric(5,4),
  review_status text NOT NULL DEFAULT 'resolved' CHECK (review_status IN ('resolved', 'needs_review', 'split_required', 'blocked', 'ignored')),
  source_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registry_track_provider_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES registry_tracks(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  provider_track_id text,
  provider_release_id text,
  provider_url text,
  isrc text,
  upc text,
  payload_hash text,
  last_seen_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_review', 'blocked', 'archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, provider_track_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Ingestion lifecycle
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_title text NOT NULL,
  chart_slug text NOT NULL,
  edition_date date NOT NULL,
  program_id uuid REFERENCES chart_programs(id),
  eligibility_profile_id uuid REFERENCES chart_eligibility_profiles(id),
  market_scope_id uuid REFERENCES chart_market_scopes(id),
  market_scope_snapshot jsonb,
  enrichment_options jsonb,
  chart_size integer NOT NULL DEFAULT 100 CHECK (chart_size > 0),
  chart_kind text NOT NULL DEFAULT 'tracks' CHECK (chart_kind IN ('tracks', 'releases', 'artists', 'videos')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'dry_run_complete', 'ready_to_commit', 'committing', 'committed', 'failed', 'cancelled', 'needs_review')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercial_readiness jsonb,
  created_by text,
  dry_run_completed_at timestamptz,
  committed_at timestamptz,
  edition_id uuid,
  error_message text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_ingest_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  provider_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fetched', 'failed', 'ignored')),
  fetched_at timestamptz,
  row_count integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  raw_payload_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_ingest_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  source_id uuid REFERENCES chart_ingest_sources(id) ON DELETE SET NULL,
  source_row_id text,
  rank integer NOT NULL,
  previous_rank integer,
  movement text,
  title text NOT NULL,
  artist_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  artwork_url text,
  source_provider text NOT NULL,
  source_url text,
  match_status text NOT NULL DEFAULT 'no_match' CHECK (match_status IN ('canonical', 'shell', 'no_match', 'duplicate_candidate', 'needs_review')),
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  canonical_track_id uuid REFERENCES registry_tracks(id),
  canonical_release_id uuid REFERENCES registry_releases(id),
  release_shell_id text,
  eligibility_decision jsonb,
  row_intelligence jsonb,
  raw_payload jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, rank, source_provider, title)
);

CREATE TABLE IF NOT EXISTS chart_ingest_excluded_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  ingest_row_id uuid REFERENCES chart_ingest_rows(id) ON DELETE SET NULL,
  rank integer,
  title text NOT NULL,
  artist_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_code text NOT NULL,
  reason_message text NOT NULL,
  eligibility_profile_id uuid REFERENCES chart_eligibility_profiles(id),
  metadata_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Publishing, snapshots, source coverage, audit
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES chart_programs(id),
  public_slug text NOT NULL,
  edition_slug text NOT NULL,
  edition_label text NOT NULL,
  edition_date date NOT NULL,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'staged', 'published', 'archived')),
  entry_count integer NOT NULL DEFAULT 0,
  source_run_id uuid REFERENCES chart_ingest_runs(id),
  snapshot_id uuid,
  public_url text,
  api_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, edition_slug),
  UNIQUE (program_id, edition_date)
);

CREATE TABLE IF NOT EXISTS chart_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES chart_editions(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  previous_rank integer,
  movement text CHECK (movement IN ('up', 'down', 'same', 'new', 'reentry', 're_entry')),
  track_id uuid REFERENCES registry_tracks(id),
  release_id uuid REFERENCES registry_releases(id),
  track_slug text,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  artist_slug text,
  artwork_url text,
  source_entry_id text,
  score numeric,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, rank)
);

CREATE TABLE IF NOT EXISTS chart_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES chart_editions(id) ON DELETE CASCADE,
  snapshot_hash text NOT NULL,
  snapshot_payload jsonb NOT NULL,
  entry_count integer NOT NULL DEFAULT 0,
  integrity jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, snapshot_hash)
);

ALTER TABLE chart_editions
  ADD CONSTRAINT chart_editions_snapshot_fk
  FOREIGN KEY (snapshot_id) REFERENCES chart_snapshots(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS chart_source_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES chart_editions(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  provider_key text,
  source_url text,
  fetched_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  excluded_count integer NOT NULL DEFAULT 0,
  coverage_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor text,
  message text,
  before_payload jsonb,
  after_payload jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin settings and integration config
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('configured', 'not_configured', 'degraded', 'disabled')),
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  configured_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret_ref text,
  last_tested_at timestamptz,
  last_test_result jsonb,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Legacy import boundary: WordPress is import-only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legacy_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider text NOT NULL DEFAULT 'wordpress' CHECK (source_provider IN ('wordpress', 'csv', 'manual', 'other')),
  source_base_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'dry_run', 'mapped', 'ready_to_import', 'importing', 'imported', 'failed', 'cancelled')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES legacy_import_jobs(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  legacy_field text NOT NULL,
  target_table text NOT NULL,
  target_field text NOT NULL,
  transform text,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES legacy_import_jobs(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  legacy_id text NOT NULL,
  target_table text,
  target_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mapped', 'imported', 'failed', 'ignored')),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, source_kind, legacy_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chart_programs_series_market ON chart_programs(series_slug, market_slug);
CREATE INDEX IF NOT EXISTS idx_chart_editions_program_date ON chart_editions(program_id, edition_date DESC);
CREATE INDEX IF NOT EXISTS idx_chart_entries_edition_rank ON chart_entries(edition_id, rank ASC);
CREATE INDEX IF NOT EXISTS idx_chart_ingest_runs_status ON chart_ingest_runs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chart_ingest_rows_run_rank ON chart_ingest_rows(run_id, rank ASC);
CREATE INDEX IF NOT EXISTS idx_registry_artists_normalized ON registry_artists(normalized_name);
CREATE INDEX IF NOT EXISTS idx_registry_artist_aliases_normalized ON registry_artist_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_registry_tracks_isrc ON registry_tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_tracks_normalized ON registry_tracks(normalized_title);
CREATE INDEX IF NOT EXISTS idx_legacy_import_records_lookup ON legacy_import_records(source_kind, legacy_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS touch_chart_series_updated_at ON chart_series;
CREATE TRIGGER touch_chart_series_updated_at BEFORE UPDATE ON chart_series FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_chart_markets_updated_at ON chart_markets;
CREATE TRIGGER touch_chart_markets_updated_at BEFORE UPDATE ON chart_markets FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_chart_programs_updated_at ON chart_programs;
CREATE TRIGGER touch_chart_programs_updated_at BEFORE UPDATE ON chart_programs FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_chart_ingest_runs_updated_at ON chart_ingest_runs;
CREATE TRIGGER touch_chart_ingest_runs_updated_at BEFORE UPDATE ON chart_ingest_runs FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_chart_editions_updated_at ON chart_editions;
CREATE TRIGGER touch_chart_editions_updated_at BEFORE UPDATE ON chart_editions FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_registry_artists_updated_at ON registry_artists;
CREATE TRIGGER touch_registry_artists_updated_at BEFORE UPDATE ON registry_artists FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_registry_tracks_updated_at ON registry_tracks;
CREATE TRIGGER touch_registry_tracks_updated_at BEFORE UPDATE ON registry_tracks FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_admin_settings_updated_at ON admin_settings;
CREATE TRIGGER touch_admin_settings_updated_at BEFORE UPDATE ON admin_settings FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_provider_credentials_updated_at ON provider_credentials;
CREATE TRIGGER touch_provider_credentials_updated_at BEFORE UPDATE ON provider_credentials FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();
DROP TRIGGER IF EXISTS touch_legacy_import_jobs_updated_at ON legacy_import_jobs;
CREATE TRIGGER touch_legacy_import_jobs_updated_at BEFORE UPDATE ON legacy_import_jobs FOR EACH ROW EXECUTE FUNCTION wk_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Compatibility views for existing V2 read-only scripts
-- These preserve the current script contract while the runtime backend migrates
-- to canonical table names.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW wk_chart_series_v2 AS
SELECT id::text, slug AS series_slug, label AS series_label, description, status, metadata, created_at, updated_at
FROM chart_series;

CREATE OR REPLACE VIEW wk_chart_markets_v2 AS
SELECT id::text, slug AS market_slug, label AS market_label, country_code, region_code, market_type, status, metadata, created_at, updated_at
FROM chart_markets;

CREATE OR REPLACE VIEW wk_chart_programs_v2 AS
SELECT
  p.id::text,
  p.series_slug,
  p.market_slug,
  p.public_slug,
  p.label AS public_label,
  p.label AS short_label,
  p.public_slug AS source_family_slug,
  p.default_period_type,
  p.default_methodology_version,
  COALESCE(ep.version, 'v1') AS default_eligibility_rules_version,
  p.status,
  p.metadata,
  p.created_at,
  p.updated_at
FROM chart_programs p
LEFT JOIN chart_eligibility_profiles ep ON ep.id = p.default_eligibility_profile_id;

CREATE OR REPLACE VIEW wk_chart_editions_v2 AS
SELECT
  id::text,
  program_id::text,
  edition_slug,
  edition_label,
  edition_date::text,
  period_start::text,
  period_end::text,
  entry_count,
  status,
  source_run_id::text,
  snapshot_id::text,
  created_at,
  updated_at
FROM chart_editions;

CREATE OR REPLACE VIEW wk_chart_entries_v2 AS
SELECT
  id::text,
  edition_id::text,
  rank,
  previous_rank,
  movement,
  track_slug,
  track_title,
  artist_name,
  artist_slug,
  artwork_url,
  source_entry_id,
  raw_payload
FROM chart_entries;

CREATE OR REPLACE VIEW wk_chart_source_coverage_v2 AS
SELECT id::text, edition_id::text, source_name, provider_key, source_url, fetched_count, accepted_count, excluded_count, coverage_payload, created_at
FROM chart_source_coverage;

CREATE OR REPLACE VIEW wk_chart_slug_aliases_v2 AS
SELECT id::text, entity_type, legacy_slug, canonical_slug, redirect_status, created_at
FROM chart_slug_aliases;

CREATE OR REPLACE VIEW wk_chart_methodologies_v2 AS
SELECT
  (settings ->> 'version') AS id,
  (settings ->> 'version') AS methodology_version,
  settings AS methodology_payload
FROM admin_settings
WHERE domain = 'chart_methodologies';

CREATE OR REPLACE VIEW wk_chart_eligibility_rules_v2 AS
SELECT id::text, version AS eligibility_version, rules AS eligibility_payload, created_at, updated_at
FROM chart_eligibility_profiles;

COMMIT;
