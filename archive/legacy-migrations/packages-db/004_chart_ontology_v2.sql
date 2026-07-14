-- WAKILISHA Chart Ontology V2
-- Additive scaffold only. Do not drop, rename, or mutate existing content tables.

CREATE TABLE IF NOT EXISTS wk_chart_series_v2 (
  id TEXT PRIMARY KEY,
  series_slug TEXT NOT NULL UNIQUE,
  series_label TEXT NOT NULL,
  description TEXT,
  chart_mode TEXT NOT NULL DEFAULT 'data' CHECK (chart_mode IN ('data', 'editorial', 'hybrid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wk_chart_markets_v2 (
  id TEXT PRIMARY KEY,
  market_slug TEXT NOT NULL UNIQUE,
  market_label TEXT NOT NULL,
  market_type TEXT NOT NULL DEFAULT 'country' CHECK (market_type IN ('country', 'region', 'continent', 'global', 'diaspora')),
  country_code TEXT,
  parent_market_slug TEXT,
  timezone TEXT,
  default_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wk_chart_programs_v2 (
  id TEXT PRIMARY KEY,
  series_slug TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  public_label TEXT NOT NULL,
  short_label TEXT,
  source_family_slug TEXT,
  default_period_type TEXT,
  default_methodology_version TEXT,
  default_eligibility_rules_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_slug, market_slug)
);

CREATE TABLE IF NOT EXISTS wk_chart_editions_v2 (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  source_edition_id TEXT,
  edition_slug TEXT NOT NULL,
  edition_label TEXT NOT NULL,
  edition_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  entry_count INTEGER NOT NULL DEFAULT 0,
  snapshot_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, edition_slug)
);

CREATE TABLE IF NOT EXISTS wk_chart_entries_v2 (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  previous_rank INTEGER,
  movement TEXT,
  track_slug TEXT,
  track_title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  artist_slug TEXT,
  artwork_url TEXT,
  source_entry_id TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (edition_id, rank)
);

CREATE TABLE IF NOT EXISTS wk_chart_methodologies_v2 (
  id TEXT PRIMARY KEY,
  methodology_version TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  formula_payload JSONB,
  source_weights_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wk_chart_eligibility_rules_v2 (
  id TEXT PRIMARY KEY,
  eligibility_version TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  rules_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wk_chart_source_coverage_v2 (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  coverage_status TEXT NOT NULL CHECK (coverage_status IN ('available', 'partial', 'unavailable', 'manual')),
  coverage_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wk_chart_snapshots_v2 (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  snapshot_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS wk_chart_corrections_v2 (
  id TEXT PRIMARY KEY,
  edition_id TEXT,
  entry_id TEXT,
  correction_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  private_note TEXT,
  public_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS wk_chart_slug_aliases_v2 (
  id TEXT PRIMARY KEY,
  legacy_slug TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('chart_program', 'chart_edition', 'track', 'artist')),
  redirect_status TEXT NOT NULL DEFAULT 'active' CHECK (redirect_status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (legacy_slug, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_wk_chart_series_v2_series_slug ON wk_chart_series_v2 (series_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_markets_v2_market_slug ON wk_chart_markets_v2 (market_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_programs_v2_public_slug ON wk_chart_programs_v2 (public_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_programs_v2_source_family_slug ON wk_chart_programs_v2 (source_family_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_editions_v2_edition_slug ON wk_chart_editions_v2 (edition_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_editions_v2_program_id ON wk_chart_editions_v2 (program_id);
CREATE INDEX IF NOT EXISTS idx_wk_chart_entries_v2_edition_id ON wk_chart_entries_v2 (edition_id);
CREATE INDEX IF NOT EXISTS idx_wk_chart_entries_v2_track_slug ON wk_chart_entries_v2 (track_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_source_coverage_v2_edition_id ON wk_chart_source_coverage_v2 (edition_id);
CREATE INDEX IF NOT EXISTS idx_wk_chart_snapshots_v2_edition_id ON wk_chart_snapshots_v2 (edition_id);
CREATE INDEX IF NOT EXISTS idx_wk_chart_corrections_v2_edition_id ON wk_chart_corrections_v2 (edition_id);
CREATE INDEX IF NOT EXISTS idx_wk_chart_corrections_v2_entry_id ON wk_chart_corrections_v2 (entry_id);
CREATE INDEX IF NOT EXISTS idx_wk_chart_slug_aliases_v2_legacy_slug ON wk_chart_slug_aliases_v2 (legacy_slug);
CREATE INDEX IF NOT EXISTS idx_wk_chart_slug_aliases_v2_canonical_slug ON wk_chart_slug_aliases_v2 (canonical_slug);
