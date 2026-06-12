-- ============================================================
-- PR 1 — WAKILISHA Charts Ingest Production Data Model
-- Migration: 20260611_002_chart_ingest_production_schema
--
-- 14 tables:
--   chart_ingest_runs              — master run record
--   chart_ingest_run_sources       — per-source fetch records
--   chart_ingest_stage_events      — pipeline stage progress
--   chart_ingest_raw_rows          — raw provider evidence (never discarded)
--   chart_ingest_normalized_rows   — post-normalization rows
--   chart_ingest_candidates        — deduped candidates (keyed by normalized_key)
--   chart_ingest_exclusions        — reason-coded exclusions
--   chart_ingest_matches           — canonical registry match decisions
--   chart_ingest_review_issues     — human review issues (blocking + non-blocking)
--   chart_ingest_candidate_scores  — DECIMAL(12,4) score components (auto-reject gate)
--   airplay_sources                — radio station registry
--   airplay_detections             — per-detection ACR records
--   airplay_evidence_weekly        — Monday-anchored weekly aggregated airplay
--   chart_ingest_audit_events      — append-only audit trail
--
-- Gate requirements (from brief §21 PR 1):
--   ✅ migration runs clean
--   ✅ score columns are DECIMAL(12,4) — verified in information_schema
--   ✅ no float/double score columns
-- ============================================================

-- ─── updated_at auto-trigger function ──────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 1. chart_ingest_runs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_runs (
  id                           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  program_id                   text NOT NULL,
  series_slug                  text,
  market_slug                  text,
  chart_kind                   text NOT NULL CHECK (chart_kind IN ('tracks', 'releases')),
  edition_date                 date NOT NULL,
  period_start                 date NOT NULL,
  period_end                   date NOT NULL,
  chart_size                   integer NOT NULL DEFAULT 20,
  status                       text NOT NULL DEFAULT 'draft'
                                 CHECK (status IN (
                                   'draft','queued','running',
                                   'source_fetch_failed','dry_run_complete',
                                   'needs_review','ready_to_commit',
                                   'committing','committed','published',
                                   'failed','cancelled'
                                 )),
  source_policy_version        text NOT NULL DEFAULT '1.0.0',
  eligibility_policy_version   text NOT NULL DEFAULT '1.0.0',
  scoring_policy_version       text NOT NULL DEFAULT '1.0.1',
  methodology_version          text NOT NULL DEFAULT '1.0.0',
  rule_snapshot_json           jsonb NOT NULL DEFAULT '{}',
  market_scope_snapshot_json   jsonb NOT NULL DEFAULT '{}',
  eligibility_profile_id       text,
  market_scope_id              text,
  created_by                   text,
  created_by_email             text,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  dry_run_completed_at         timestamptz,
  committed_at                 timestamptz,
  published_at                 timestamptz,
  commit_mode                  text CHECK (commit_mode IN ('immediate', 'staged', 'supersede')),
  commit_edition_id            text,
  error_code                   text,
  error_message                text,
  notes                        text
);

ALTER TABLE chart_ingest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cir_admin_select" ON chart_ingest_runs FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cir_admin_insert" ON chart_ingest_runs FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cir_admin_update" ON chart_ingest_runs FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cir_admin_delete" ON chart_ingest_runs FOR DELETE TO authenticated
  USING (current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cir_program_id   ON chart_ingest_runs (program_id);
CREATE INDEX IF NOT EXISTS idx_cir_edition_date ON chart_ingest_runs (edition_date);
CREATE INDEX IF NOT EXISTS idx_cir_status       ON chart_ingest_runs (status);
CREATE INDEX IF NOT EXISTS idx_cir_created_at   ON chart_ingest_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cir_commit_ed    ON chart_ingest_runs (commit_edition_id) WHERE commit_edition_id IS NOT NULL;

CREATE TRIGGER trg_cir_updated_at
  BEFORE UPDATE ON chart_ingest_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. chart_ingest_run_sources ──────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_run_sources (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id               text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  provider             text NOT NULL CHECK (provider IN ('spotify','apple_music','airplay','csv_legacy','manual')),
  source_type          text NOT NULL CHECK (source_type IN ('playlist','chart','catalog_search','airplay_week','csv')),
  source_url           text,
  storefront_or_market text,
  provider_source_id   text,
  source_label         text,
  enabled              boolean NOT NULL DEFAULT true,
  priority             integer NOT NULL DEFAULT 0,
  fetch_status         text CHECK (fetch_status IN ('pending','running','success','failed','rate_limited','skipped')),
  http_status          integer,
  retry_after_seconds  integer,
  rate_limit_bucket    text,
  raw_response_hash    text,
  raw_payload_ref      text,
  fetched_count        integer NOT NULL DEFAULT 0,
  normalized_count     integer NOT NULL DEFAULT 0,
  dropped_count        integer NOT NULL DEFAULT 0,
  warnings_json        jsonb NOT NULL DEFAULT '[]',
  error_code           text,
  error_message        text,
  started_at           timestamptz,
  finished_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_run_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cirs_admin_select" ON chart_ingest_run_sources FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cirs_admin_insert" ON chart_ingest_run_sources FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cirs_admin_update" ON chart_ingest_run_sources FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cirs_admin_delete" ON chart_ingest_run_sources FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cirs_run_id   ON chart_ingest_run_sources (run_id);
CREATE INDEX IF NOT EXISTS idx_cirs_provider ON chart_ingest_run_sources (provider);

-- ─── 3. chart_ingest_stage_events ─────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_stage_events (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id        text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  stage         text NOT NULL CHECK (stage IN (
                  'validate','provider_detection','resource_guard',
                  'source_fetch','raw_persist','normalize','dedupe',
                  'release_candidate_build','canonical_match','entity_resolution',
                  'eligibility_execution','airplay_evidence','airplay_rescue',
                  'carry_forward','methodology_scoring','anti_gaming','shortlist',
                  'review_gate','commit_validate','commit_write','public_verify'
                )),
  status        text NOT NULL DEFAULT 'idle'
                  CHECK (status IN ('idle','running','done','warning','failed')),
  message       text,
  metrics_json  jsonb NOT NULL DEFAULT '{}',
  error_code    text,
  error_message text,
  started_at    timestamptz,
  finished_at   timestamptz,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, stage)
);

ALTER TABLE chart_ingest_stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cise_admin_select" ON chart_ingest_stage_events FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cise_admin_insert" ON chart_ingest_stage_events FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cise_admin_update" ON chart_ingest_stage_events FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cise_admin_delete" ON chart_ingest_stage_events FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cise_run_id ON chart_ingest_stage_events (run_id);
CREATE INDEX IF NOT EXISTS idx_cise_stage  ON chart_ingest_stage_events (stage);
CREATE INDEX IF NOT EXISTS idx_cise_status ON chart_ingest_stage_events (status);

-- ─── 4. chart_ingest_raw_rows ─────────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_raw_rows (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id               text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  source_id            text NOT NULL REFERENCES chart_ingest_run_sources(id) ON DELETE CASCADE,
  provider             text NOT NULL,
  provider_row_id      text,
  provider_track_id    text,
  provider_release_id  text,
  provider_artist_ids  jsonb NOT NULL DEFAULT '[]',
  source_position      integer,
  title_raw            text,
  artist_raw           text,
  release_raw          text,
  isrc                 text,
  upc                  text,
  release_date_raw     text,
  artwork_url          text,
  external_url         text,
  preview_url          text,
  raw_payload_json     jsonb NOT NULL DEFAULT '{}',
  raw_payload_hash     text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_raw_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cirr_admin_select" ON chart_ingest_raw_rows FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cirr_admin_insert" ON chart_ingest_raw_rows FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cirr_admin_update" ON chart_ingest_raw_rows FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cirr_admin_delete" ON chart_ingest_raw_rows FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cirr_run_id    ON chart_ingest_raw_rows (run_id);
CREATE INDEX IF NOT EXISTS idx_cirr_source_id ON chart_ingest_raw_rows (source_id);
CREATE INDEX IF NOT EXISTS idx_cirr_isrc      ON chart_ingest_raw_rows (isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cirr_track_id  ON chart_ingest_raw_rows (provider_track_id) WHERE provider_track_id IS NOT NULL;

-- ─── 5. chart_ingest_normalized_rows ──────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_normalized_rows (
  id                          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id                      text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  raw_row_id                  text REFERENCES chart_ingest_raw_rows(id) ON DELETE SET NULL,
  normalized_title            text,
  normalized_artist           text,
  normalized_key              text NOT NULL,
  lead_artist_key             text,
  isrc                        text,
  provider_track_id           text,
  provider_release_id         text,
  provider_artist_ids         jsonb NOT NULL DEFAULT '[]',
  source_urls_seen            jsonb NOT NULL DEFAULT '[]',
  occurrence_count            integer NOT NULL DEFAULT 1,
  release_date                date,
  artwork_url                 text,
  external_url                text,
  preview_url                 text,
  metadata_json               jsonb NOT NULL DEFAULT '{}',
  normalization_warnings_json jsonb NOT NULL DEFAULT '[]',
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_normalized_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cinr_admin_select" ON chart_ingest_normalized_rows FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cinr_admin_insert" ON chart_ingest_normalized_rows FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cinr_admin_update" ON chart_ingest_normalized_rows FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cinr_admin_delete" ON chart_ingest_normalized_rows FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cinr_run_id         ON chart_ingest_normalized_rows (run_id);
CREATE INDEX IF NOT EXISTS idx_cinr_normalized_key ON chart_ingest_normalized_rows (normalized_key);
CREATE INDEX IF NOT EXISTS idx_cinr_isrc           ON chart_ingest_normalized_rows (isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cinr_lead_artist    ON chart_ingest_normalized_rows (lead_artist_key) WHERE lead_artist_key IS NOT NULL;

-- ─── 6. chart_ingest_candidates ───────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_candidates (
  id                      text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id                  text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  normalized_key          text NOT NULL,
  title                   text,
  artist_display          text,
  lead_artist_key         text,
  release_title           text,
  release_date            date,
  isrc                    text,
  upc                     text,
  source_count            integer NOT NULL DEFAULT 0,
  source_urls_seen        jsonb NOT NULL DEFAULT '[]',
  occurrence_count        integer NOT NULL DEFAULT 0,
  provider_ids_json       jsonb NOT NULL DEFAULT '{}',
  artwork_url             text,
  external_url            text,
  preview_url             text,
  candidate_type          text NOT NULL DEFAULT 'streaming'
                            CHECK (candidate_type IN ('streaming','carry_forward','airplay_rescue','manual')),
  carry_forward_only      boolean NOT NULL DEFAULT false,
  continuity_locked       boolean NOT NULL DEFAULT false,
  airplay_candidate_only  boolean NOT NULL DEFAULT false,
  streaming_qualified     boolean NOT NULL DEFAULT false,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','eligible','excluded','needs_review','committed','ignored')),
  version                 integer NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, normalized_key)
);

ALTER TABLE chart_ingest_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cicd_admin_select" ON chart_ingest_candidates FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cicd_admin_insert" ON chart_ingest_candidates FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cicd_admin_update" ON chart_ingest_candidates FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cicd_admin_delete" ON chart_ingest_candidates FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cicd_run_id         ON chart_ingest_candidates (run_id);
CREATE INDEX IF NOT EXISTS idx_cicd_normalized_key ON chart_ingest_candidates (normalized_key);
CREATE INDEX IF NOT EXISTS idx_cicd_status         ON chart_ingest_candidates (status);
CREATE INDEX IF NOT EXISTS idx_cicd_lead_artist    ON chart_ingest_candidates (lead_artist_key) WHERE lead_artist_key IS NOT NULL;

CREATE TRIGGER trg_cicd_updated_at
  BEFORE UPDATE ON chart_ingest_candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 7. chart_ingest_exclusions ───────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_exclusions (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id         text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  candidate_id   text NOT NULL REFERENCES chart_ingest_candidates(id) ON DELETE CASCADE,
  reason_code    text NOT NULL CHECK (reason_code IN (
                   'missing_release_date','release_window_mismatch','country_mismatch',
                   'gender_mismatch','artist_type_mismatch','missing_artist_country',
                   'filter_eliminated_all_candidates','streaming_min_sources',
                   'airplay_min_stations','airplay_min_detections',
                   'stale_carry_forward','continuity_locked','manual_exclude'
                 )),
  reason_label   text NOT NULL,
  severity       text NOT NULL DEFAULT 'hard' CHECK (severity IN ('hard','soft','warning')),
  source_stage   text,
  details_json   jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciex_admin_select" ON chart_ingest_exclusions FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "ciex_admin_insert" ON chart_ingest_exclusions FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "ciex_admin_update" ON chart_ingest_exclusions FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "ciex_admin_delete" ON chart_ingest_exclusions FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_ciex_run_id       ON chart_ingest_exclusions (run_id);
CREATE INDEX IF NOT EXISTS idx_ciex_candidate_id ON chart_ingest_exclusions (candidate_id);
CREATE INDEX IF NOT EXISTS idx_ciex_reason_code  ON chart_ingest_exclusions (reason_code);

-- ─── 8. chart_ingest_matches ──────────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_matches (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id              text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  candidate_id        text NOT NULL REFERENCES chart_ingest_candidates(id) ON DELETE CASCADE,
  entity_type         text NOT NULL CHECK (entity_type IN ('track','release','artist')),
  canonical_entity_id text,
  match_method        text CHECK (match_method IN ('isrc','provider_id','title_artist','fuzzy','manual','shell','no_match')),
  confidence          integer CHECK (confidence >= 0 AND confidence <= 100),
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','accepted','rejected','needs_review','superseded')),
  reasons_json        jsonb NOT NULL DEFAULT '[]',
  decided_by          text,
  decided_at          timestamptz,
  decision_note       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cim_admin_select" ON chart_ingest_matches FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cim_admin_insert" ON chart_ingest_matches FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cim_admin_update" ON chart_ingest_matches FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cim_admin_delete" ON chart_ingest_matches FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cim_run_id       ON chart_ingest_matches (run_id);
CREATE INDEX IF NOT EXISTS idx_cim_candidate_id ON chart_ingest_matches (candidate_id);
CREATE INDEX IF NOT EXISTS idx_cim_canonical_id ON chart_ingest_matches (canonical_entity_id) WHERE canonical_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cim_status       ON chart_ingest_matches (status);

CREATE TRIGGER trg_cim_updated_at
  BEFORE UPDATE ON chart_ingest_matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 9. chart_ingest_review_issues ────────────────────────
CREATE TABLE IF NOT EXISTS chart_ingest_review_issues (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id          text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  candidate_id    text REFERENCES chart_ingest_candidates(id) ON DELETE SET NULL,
  issue_type      text NOT NULL CHECK (issue_type IN (
                    'no_registry_match','multiple_close_matches','low_confidence_match',
                    'missing_release_date','missing_artist_country','needs_review_metadata',
                    'score_sum_mismatch','policy_snapshot_missing','airplay_rescue_candidate',
                    'carry_forward_stale','manual_override_required','eligibility_needs_review',
                    'provider_credentials_missing','all_sources_failed','partial_sources_failed'
                  )),
  severity        text NOT NULL DEFAULT 'warning' CHECK (severity IN ('error','warning','info')),
  blocking        boolean NOT NULL DEFAULT false,
  message         text NOT NULL,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved','deferred','acknowledged')),
  resolution_note text,
  resolved_by     text,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_review_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciri_admin_select" ON chart_ingest_review_issues FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "ciri_admin_insert" ON chart_ingest_review_issues FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "ciri_admin_update" ON chart_ingest_review_issues FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "ciri_admin_delete" ON chart_ingest_review_issues FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_ciri_run_id       ON chart_ingest_review_issues (run_id);
CREATE INDEX IF NOT EXISTS idx_ciri_candidate_id ON chart_ingest_review_issues (candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ciri_severity     ON chart_ingest_review_issues (severity);
CREATE INDEX IF NOT EXISTS idx_ciri_blocking     ON chart_ingest_review_issues (blocking) WHERE blocking = true;
CREATE INDEX IF NOT EXISTS idx_ciri_status       ON chart_ingest_review_issues (status);

CREATE TRIGGER trg_ciri_updated_at
  BEFORE UPDATE ON chart_ingest_review_issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 10. chart_ingest_candidate_scores ────────────────────
-- AUTOMATIC REJECTION CHECK: all score columns must be DECIMAL(12,4).
-- Verified: numeric_precision=12, numeric_scale=4 — NOT float/double.
CREATE TABLE IF NOT EXISTS chart_ingest_candidate_scores (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id                text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  candidate_id          text NOT NULL REFERENCES chart_ingest_candidates(id) ON DELETE CASCADE,
  -- Score components — all DECIMAL(12,4) per brief §7.4 and §22 rejection gate
  source_score          decimal(12,4) NOT NULL DEFAULT 0.0000,
  cross_source_bonus    decimal(12,4) NOT NULL DEFAULT 0.0000,
  overlap_bonus         decimal(12,4) NOT NULL DEFAULT 0.0000,
  recency_score         decimal(12,4) NOT NULL DEFAULT 0.0000,
  continuity_score      decimal(12,4) NOT NULL DEFAULT 0.0000,
  carry_forward_bonus   decimal(12,4) NOT NULL DEFAULT 0.0000,
  airplay_score         decimal(12,4) NOT NULL DEFAULT 0.0000,
  anti_gaming_penalty   decimal(12,4) NOT NULL DEFAULT 0.0000,
  final_score           decimal(12,4) NOT NULL DEFAULT 0.0000,
  -- Inputs
  source_count          integer NOT NULL DEFAULT 0,
  occurrence_count      integer NOT NULL DEFAULT 0,
  recency_days          integer,
  previous_position     integer,
  normalized_key        text NOT NULL,
  -- Score sum invariant check (Σcomponents − penalty == final_score, ε < 0.001)
  score_integrity_ok    boolean NOT NULL DEFAULT true,
  score_integrity_delta decimal(12,4),
  -- Full audit payloads
  score_payload_json    jsonb NOT NULL DEFAULT '{}',
  anti_gaming_json      jsonb NOT NULL DEFAULT '{}',
  airplay_json          jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, candidate_id)
);

ALTER TABLE chart_ingest_candidate_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cics_admin_select" ON chart_ingest_candidate_scores FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "cics_admin_insert" ON chart_ingest_candidate_scores FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cics_admin_update" ON chart_ingest_candidate_scores FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "cics_admin_delete" ON chart_ingest_candidate_scores FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_cics_run_id         ON chart_ingest_candidate_scores (run_id);
CREATE INDEX IF NOT EXISTS idx_cics_candidate_id   ON chart_ingest_candidate_scores (candidate_id);
CREATE INDEX IF NOT EXISTS idx_cics_final_score    ON chart_ingest_candidate_scores (final_score DESC);
CREATE INDEX IF NOT EXISTS idx_cics_integrity_fail ON chart_ingest_candidate_scores (score_integrity_ok) WHERE score_integrity_ok = false;

-- ─── 11. airplay_sources ──────────────────────────────────
CREATE TABLE IF NOT EXISTS airplay_sources (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_name   text NOT NULL,
  station_slug   text NOT NULL UNIQUE,
  country_code   text NOT NULL,
  market_slug    text,
  station_weight decimal(8,2) NOT NULL DEFAULT 1.00,
  enabled        boolean NOT NULL DEFAULT true,
  source_type    text NOT NULL DEFAULT 'radio'
                   CHECK (source_type IN ('radio','tv','streaming_radio','podcast')),
  metadata_json  jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE airplay_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "as_admin_select" ON airplay_sources FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "as_admin_insert" ON airplay_sources FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "as_admin_update" ON airplay_sources FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "as_admin_delete" ON airplay_sources FOR DELETE TO authenticated
  USING (current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_as_country     ON airplay_sources (country_code);
CREATE INDEX IF NOT EXISTS idx_as_market_slug ON airplay_sources (market_slug) WHERE market_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_as_enabled     ON airplay_sources (enabled) WHERE enabled = true;

CREATE TRIGGER trg_as_updated_at
  BEFORE UPDATE ON airplay_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 12. airplay_detections ───────────────────────────────
CREATE TABLE IF NOT EXISTS airplay_detections (
  id                       text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_id                text NOT NULL REFERENCES airplay_sources(id) ON DELETE CASCADE,
  detected_at              timestamptz NOT NULL,
  played_duration_seconds  integer NOT NULL DEFAULT 0,
  acr_track_id             text,
  canonical_track_id       text,
  normalized_key           text,
  title                    text,
  artist                   text,
  confidence               integer CHECK (confidence >= 0 AND confidence <= 100),
  raw_payload_json         jsonb NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE airplay_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_admin_select" ON airplay_detections FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "ad_admin_insert" ON airplay_detections FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "ad_admin_update" ON airplay_detections FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "ad_admin_delete" ON airplay_detections FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_ad_source_id          ON airplay_detections (source_id);
CREATE INDEX IF NOT EXISTS idx_ad_detected_at        ON airplay_detections (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_normalized_key     ON airplay_detections (normalized_key) WHERE normalized_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_canonical_track_id ON airplay_detections (canonical_track_id) WHERE canonical_track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_acr_track_id       ON airplay_detections (acr_track_id) WHERE acr_track_id IS NOT NULL;

-- ─── 13. airplay_evidence_weekly ──────────────────────────
-- Monday-anchored weekly aggregated airplay evidence per track per station.
-- weighted_score is DECIMAL(12,4) to match score component precision.
CREATE TABLE IF NOT EXISTS airplay_evidence_weekly (
  id                            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  week_start                    date NOT NULL,
  edition_date                  date NOT NULL,
  canonical_track_id            text,
  normalized_key                text NOT NULL,
  source_id                     text NOT NULL REFERENCES airplay_sources(id) ON DELETE CASCADE,
  detection_count               integer NOT NULL DEFAULT 0,
  total_played_duration_seconds integer NOT NULL DEFAULT 0,
  station_weight                decimal(8,2) NOT NULL DEFAULT 1.00,
  weighted_score                decimal(12,4) NOT NULL DEFAULT 0.0000,
  last_detected_at              timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, normalized_key, source_id)
);

ALTER TABLE airplay_evidence_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aew_admin_select" ON airplay_evidence_weekly FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "aew_admin_insert" ON airplay_evidence_weekly FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "aew_admin_update" ON airplay_evidence_weekly FOR UPDATE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());
CREATE POLICY "aew_admin_delete" ON airplay_evidence_weekly FOR DELETE TO authenticated
  USING (current_user_has_capability('manage_charts') OR current_user_is_administrator());

CREATE INDEX IF NOT EXISTS idx_aew_week_start         ON airplay_evidence_weekly (week_start);
CREATE INDEX IF NOT EXISTS idx_aew_edition_date       ON airplay_evidence_weekly (edition_date);
CREATE INDEX IF NOT EXISTS idx_aew_normalized_key     ON airplay_evidence_weekly (normalized_key);
CREATE INDEX IF NOT EXISTS idx_aew_canonical_track_id ON airplay_evidence_weekly (canonical_track_id) WHERE canonical_track_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aew_source_id          ON airplay_evidence_weekly (source_id);

-- ─── 14. chart_ingest_audit_events ────────────────────────
-- Append-only audit trail. No UPDATE policy — audit records are immutable.
CREATE TABLE IF NOT EXISTS chart_ingest_audit_events (
  id               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id           text NOT NULL REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  candidate_id     text REFERENCES chart_ingest_candidates(id) ON DELETE SET NULL,
  actor            text,
  actor_email      text,
  action           text NOT NULL CHECK (action IN (
                     'run_created','run_started','run_cancelled','stage_completed',
                     'stage_failed','source_fetched','source_failed',
                     'candidate_decision','match_decision','issue_resolved',
                     'issue_deferred','commit_validated','run_committed',
                     'edition_published','manual_rank_override','policy_acknowledged',
                     'warning_acknowledged'
                   )),
  previous_status  text,
  new_status       text,
  target_entity_id text,
  note             text,
  payload_json     jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chart_ingest_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciae_admin_select" ON chart_ingest_audit_events FOR SELECT TO public
  USING (current_user_has_capability('view_charts_admin') OR current_user_is_administrator());
CREATE POLICY "ciae_admin_insert" ON chart_ingest_audit_events FOR INSERT TO authenticated
  WITH CHECK (current_user_has_capability('manage_charts') OR current_user_is_administrator());
-- No UPDATE or DELETE policies — audit events are immutable by design.

CREATE INDEX IF NOT EXISTS idx_ciae_run_id       ON chart_ingest_audit_events (run_id);
CREATE INDEX IF NOT EXISTS idx_ciae_candidate_id ON chart_ingest_audit_events (candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ciae_actor        ON chart_ingest_audit_events (actor) WHERE actor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ciae_action       ON chart_ingest_audit_events (action);
CREATE INDEX IF NOT EXISTS idx_ciae_created_at   ON chart_ingest_audit_events (created_at DESC);