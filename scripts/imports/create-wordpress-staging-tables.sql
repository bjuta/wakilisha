-- WAKILISHA WordPress -> React import staging tables
-- Run this before npm run imports:stage-wordpress-records.

CREATE TABLE IF NOT EXISTS wk_import_staging_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL,
  source_kind text NOT NULL DEFAULT 'wordpress_export_zip',
  source_file text NOT NULL,
  source_entity text NOT NULL,
  source_record_id text,
  source_slug text,
  target_entity text NOT NULL,
  target_status text NOT NULL DEFAULT 'draft' CHECK (target_status IN ('draft', 'ready', 'needs_review', 'blocked', 'ignored')),
  target_slug text,
  title text,
  body text,
  excerpt text,
  published_at timestamptz,
  author_name text,
  source_url text,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapped_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_candidate_ids text[] NOT NULL DEFAULT '{}',
  warnings text[] NOT NULL DEFAULT '{}',
  errors text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wk_import_staging_records_run ON wk_import_staging_records(ingestion_run_id);
CREATE INDEX IF NOT EXISTS idx_wk_import_staging_records_target ON wk_import_staging_records(target_entity, target_status);
CREATE INDEX IF NOT EXISTS idx_wk_import_staging_records_source_entity ON wk_import_staging_records(source_entity);
CREATE INDEX IF NOT EXISTS idx_wk_import_staging_records_slug ON wk_import_staging_records(target_slug);

CREATE TABLE IF NOT EXISTS wk_import_staging_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL,
  source_file text,
  source_entity text,
  source_record_id text,
  failure_stage text NOT NULL,
  message text NOT NULL,
  raw_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wk_import_staging_failures_run ON wk_import_staging_failures(ingestion_run_id);

CREATE OR REPLACE FUNCTION wk_import_staging_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wk_import_staging_records_touch_updated_at ON wk_import_staging_records;
CREATE TRIGGER trg_wk_import_staging_records_touch_updated_at
BEFORE UPDATE ON wk_import_staging_records
FOR EACH ROW
EXECUTE FUNCTION wk_import_staging_touch_updated_at();
