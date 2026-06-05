-- WAKILISHA WordPress -> React production promotion tables
-- These are canonical promotion targets for staged imports.
-- Run after create-wordpress-staging-tables.sql and before npm run imports:promote-wordpress-staging.

CREATE TABLE IF NOT EXISTS wk_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  body text,
  excerpt text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_name text,
  source_url text,
  source_kind text NOT NULL DEFAULT 'wordpress_export_zip',
  source_ingestion_run_id uuid NOT NULL,
  source_staging_record_id uuid NOT NULL UNIQUE,
  source_record_id text,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapped_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_wk_content_items_type ON wk_content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_wk_content_items_run ON wk_content_items(source_ingestion_run_id);
CREATE INDEX IF NOT EXISTS idx_wk_content_items_status ON wk_content_items(status);

CREATE TABLE IF NOT EXISTS wk_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  url text,
  source_kind text NOT NULL DEFAULT 'wordpress_export_zip',
  source_ingestion_run_id uuid NOT NULL,
  source_staging_record_id uuid NOT NULL UNIQUE,
  source_record_id text,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapped_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wk_authors_run ON wk_authors(source_ingestion_run_id);

CREATE TABLE IF NOT EXISTS wk_taxonomy_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy text NOT NULL DEFAULT 'term',
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  source_kind text NOT NULL DEFAULT 'wordpress_export_zip',
  source_ingestion_run_id uuid NOT NULL,
  source_staging_record_id uuid NOT NULL UNIQUE,
  source_record_id text,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapped_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(taxonomy, slug)
);

CREATE INDEX IF NOT EXISTS idx_wk_taxonomy_terms_taxonomy ON wk_taxonomy_terms(taxonomy);
CREATE INDEX IF NOT EXISTS idx_wk_taxonomy_terms_run ON wk_taxonomy_terms(source_ingestion_run_id);

CREATE TABLE IF NOT EXISTS wk_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  source_url text NOT NULL,
  mime_type text,
  status text NOT NULL DEFAULT 'needs_review' CHECK (status IN ('ready', 'needs_review', 'blocked', 'archived')),
  source_kind text NOT NULL DEFAULT 'wordpress_export_zip',
  source_ingestion_run_id uuid NOT NULL,
  source_staging_record_id uuid NOT NULL UNIQUE,
  source_record_id text,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapped_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wk_media_assets_run ON wk_media_assets(source_ingestion_run_id);
CREATE INDEX IF NOT EXISTS idx_wk_media_assets_status ON wk_media_assets(status);

CREATE TABLE IF NOT EXISTS wk_import_promotion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL,
  staging_record_id uuid,
  target_table text NOT NULL,
  target_record_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('promoted', 'skipped', 'failed')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wk_import_promotion_events_run ON wk_import_promotion_events(ingestion_run_id);
CREATE INDEX IF NOT EXISTS idx_wk_import_promotion_events_staging ON wk_import_promotion_events(staging_record_id);

CREATE OR REPLACE FUNCTION wk_promotion_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wk_content_items_touch_updated_at ON wk_content_items;
CREATE TRIGGER trg_wk_content_items_touch_updated_at BEFORE UPDATE ON wk_content_items FOR EACH ROW EXECUTE FUNCTION wk_promotion_touch_updated_at();

DROP TRIGGER IF EXISTS trg_wk_authors_touch_updated_at ON wk_authors;
CREATE TRIGGER trg_wk_authors_touch_updated_at BEFORE UPDATE ON wk_authors FOR EACH ROW EXECUTE FUNCTION wk_promotion_touch_updated_at();

DROP TRIGGER IF EXISTS trg_wk_taxonomy_terms_touch_updated_at ON wk_taxonomy_terms;
CREATE TRIGGER trg_wk_taxonomy_terms_touch_updated_at BEFORE UPDATE ON wk_taxonomy_terms FOR EACH ROW EXECUTE FUNCTION wk_promotion_touch_updated_at();

DROP TRIGGER IF EXISTS trg_wk_media_assets_touch_updated_at ON wk_media_assets;
CREATE TRIGGER trg_wk_media_assets_touch_updated_at BEFORE UPDATE ON wk_media_assets FOR EACH ROW EXECUTE FUNCTION wk_promotion_touch_updated_at();
