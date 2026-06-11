-- ============================================================
-- WAKILISHA Charts Scoring Schema Migration
-- Date: 2026-06-11
-- Scoring Policy: 1.0.1 (corrections §11.1-11.4 applied)
-- Bible ref: WAKILISHA-CHART-SCORING-BIBLE.md
-- ============================================================
-- This migration adds:
--   1. All 7 score component columns to wk_chart_entries_v2 (NUMERIC 12,4)
--   2. Policy snapshot columns to wk_chart_editions_v2 (bible §12)
--   3. Full §9 config registry to wk_chart_programs_v2
--   4. Expanded wk_chart_methodologies_v2 + wk_chart_eligibility_rules_v2
--   5. NEW: wk_chart_airplay_stations (station_weight editorial lever)
--   6. NEW: wk_chart_airplay_evidence (Monday-anchored weekly buckets)
--   7. NEW: wk_chart_scoring_runs (per-run audit trail)
-- ============================================================

-- 1. ENTRIES: identity + source evidence
ALTER TABLE wk_chart_entries_v2
  ADD COLUMN IF NOT EXISTS normalized_key          text,
  ADD COLUMN IF NOT EXISTS lead_artist_key         text,
  ADD COLUMN IF NOT EXISTS source_count            integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS occurrence_count        integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_urls_seen        jsonb         NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS release_date            date,
  ADD COLUMN IF NOT EXISTS release_recency_days    integer,
  ADD COLUMN IF NOT EXISTS canonical_track_id      text,
  ADD COLUMN IF NOT EXISTS canonical_release_id    text,
  ADD COLUMN IF NOT EXISTS canonical_artist_id     text;

-- 1b. ENTRIES: 7 score components + penalty + total (NUMERIC 12,4 per contract §1.6)
ALTER TABLE wk_chart_entries_v2
  ADD COLUMN IF NOT EXISTS source_score            NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cross_source_bonus      NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overlap_bonus           NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recency_score           NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS continuity_score        NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carry_forward_bonus     NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS airplay_score           NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anti_gaming_penalty     NUMERIC(12,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_score             NUMERIC(12,4)  NOT NULL DEFAULT 0;

-- 1c. ENTRIES: flags, audit, policy
ALTER TABLE wk_chart_entries_v2
  ADD COLUMN IF NOT EXISTS carry_forward_only          boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS continuity_locked           boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS airplay_candidate_only      boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overlap_bonus_capped        boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_artist_overflow        boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stale_carry_forward_demoted boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligibility_status          text          DEFAULT 'eligible',
  ADD COLUMN IF NOT EXISTS eligibility_warnings        jsonb         NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS source_payload              jsonb         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scoring_policy_version      text,
  ADD COLUMN IF NOT EXISTS methodology_version         text,
  ADD COLUMN IF NOT EXISTS eligibility_policy_version  text,
  ADD COLUMN IF NOT EXISTS created_at                  timestamptz   NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at                  timestamptz   NOT NULL DEFAULT now();

-- 1d. ENTRIES: airplay audit surface (bible §5.3 + §7)
ALTER TABLE wk_chart_entries_v2
  ADD COLUMN IF NOT EXISTS airplay_detections       integer,
  ADD COLUMN IF NOT EXISTS airplay_station_count    integer,
  ADD COLUMN IF NOT EXISTS airplay_total_duration   integer,
  ADD COLUMN IF NOT EXISTS airplay_weighted_score   NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS airplay_last_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS airplay_matched_by       text,
  ADD COLUMN IF NOT EXISTS airplay_rescue_mode      text;

-- 2. EDITIONS: policy snapshot (bible §12) + operational columns
ALTER TABLE wk_chart_editions_v2
  ADD COLUMN IF NOT EXISTS status                      text          NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS methodology_version         text,
  ADD COLUMN IF NOT EXISTS source_policy_version       text,
  ADD COLUMN IF NOT EXISTS eligibility_policy_version  text,
  ADD COLUMN IF NOT EXISTS scoring_policy_version      text,
  ADD COLUMN IF NOT EXISTS rule_set_snapshot           jsonb         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chart_size                  integer,
  ADD COLUMN IF NOT EXISTS carry_forward_count         integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_entries_count           integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS re_entries_count            integer       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exclusion_summary           jsonb         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS override_mode               text          DEFAULT 'metadata_and_matching_only',
  ADD COLUMN IF NOT EXISTS ingest_run_id               text,
  ADD COLUMN IF NOT EXISTS published_at                timestamptz,
  ADD COLUMN IF NOT EXISTS published_by                text,
  ADD COLUMN IF NOT EXISTS created_at                  timestamptz   NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at                  timestamptz   NOT NULL DEFAULT now();

-- 3. PROGRAMS: full §9 config registry with spec-compliant defaults
ALTER TABLE wk_chart_programs_v2
  ADD COLUMN IF NOT EXISTS chart_size                                    integer       NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS streaming_min_sources                         integer       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cross_source_mode                             text          NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS cross_source_weight                           NUMERIC(8,4)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS continuity_weight                             NUMERIC(8,4)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS carry_forward_weight                          NUMERIC(8,4)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS airplay_enabled                               boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS airplay_station_scope                         text          NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS airplay_min_duration                          integer       NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS airplay_weight                                NUMERIC(8,4)  NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS airplay_min_stations                          integer       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS airplay_min_detections                        integer       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS airplay_max_score                             NUMERIC(8,4)  NOT NULL DEFAULT 24.0,
  ADD COLUMN IF NOT EXISTS airplay_rescue_mode                           text          NOT NULL DEFAULT 'allow_rescue',
  ADD COLUMN IF NOT EXISTS anti_gaming_max_tracks_per_lead_artist        integer       NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS anti_gaming_overlap_bonus_cap                 integer       NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS anti_gaming_artist_overflow_penalty           NUMERIC(8,4)  NOT NULL DEFAULT 8.0,
  ADD COLUMN IF NOT EXISTS anti_gaming_demote_carry_forward_without_current boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_policy                                text          NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS override_mode                                 text          NOT NULL DEFAULT 'metadata_and_matching_only',
  ADD COLUMN IF NOT EXISTS created_at                                    timestamptz   NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at                                    timestamptz   NOT NULL DEFAULT now();

-- 4. METHODOLOGIES + ELIGIBILITY: rule_set and governance columns
ALTER TABLE wk_chart_methodologies_v2
  ADD COLUMN IF NOT EXISTS scoring_policy_version  text,
  ADD COLUMN IF NOT EXISTS rule_set                jsonb         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS changelog               text,
  ADD COLUMN IF NOT EXISTS effective_from          date,
  ADD COLUMN IF NOT EXISTS created_at              timestamptz   NOT NULL DEFAULT now();

ALTER TABLE wk_chart_methodologies_v2
  ADD CONSTRAINT wk_chart_methodologies_v2_version_unique UNIQUE (methodology_version);

ALTER TABLE wk_chart_eligibility_rules_v2
  ADD COLUMN IF NOT EXISTS rule_set                jsonb         NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description             text,
  ADD COLUMN IF NOT EXISTS effective_from          date,
  ADD COLUMN IF NOT EXISTS created_at              timestamptz   NOT NULL DEFAULT now();

ALTER TABLE wk_chart_eligibility_rules_v2
  ADD CONSTRAINT wk_chart_eligibility_rules_v2_version_unique UNIQUE (eligibility_version);

-- 5. NEW TABLE: airplay stations (bible §5.1)
CREATE TABLE IF NOT EXISTS wk_chart_airplay_stations (
  id                   text        PRIMARY KEY,
  station_name         text        NOT NULL,
  station_slug         text        NOT NULL UNIQUE,
  country_code         text,
  station_weight       NUMERIC(8,2) NOT NULL DEFAULT 1.00,
  is_active            boolean     NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 6. NEW TABLE: airplay evidence (bible §5.1-5.3, Monday-anchored weekly)
CREATE TABLE IF NOT EXISTS wk_chart_airplay_evidence (
  id                    text          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  canonical_track_id    text          NOT NULL,
  station_id            text          NOT NULL REFERENCES wk_chart_airplay_stations(id),
  week_start            date          NOT NULL,
  detection_count       integer       NOT NULL DEFAULT 0,
  total_played_duration integer       NOT NULL DEFAULT 0,
  station_weight        NUMERIC(8,2)  NOT NULL DEFAULT 1.00,
  weighted_score        NUMERIC(12,4) NOT NULL DEFAULT 0,
  normalized_key        text,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (canonical_track_id, station_id, week_start)
);

-- 7. NEW TABLE: scoring runs audit trail (bible §12 governance)
CREATE TABLE IF NOT EXISTS wk_chart_scoring_runs (
  id                          text          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  program_id                  text          NOT NULL,
  edition_date                date          NOT NULL,
  status                      text          NOT NULL DEFAULT 'pending',
  scoring_policy_version      text          NOT NULL DEFAULT '1.0.1',
  methodology_version         text,
  source_policy_version       text,
  eligibility_policy_version  text,
  rule_set_snapshot           jsonb         NOT NULL DEFAULT '{}',
  source_urls                 jsonb         NOT NULL DEFAULT '[]',
  total_rows                  integer       NOT NULL DEFAULT 0,
  eligible_rows               integer       NOT NULL DEFAULT 0,
  excluded_rows               integer       NOT NULL DEFAULT 0,
  carry_forward_rows          integer       NOT NULL DEFAULT 0,
  airplay_rescue_rows         integer       NOT NULL DEFAULT 0,
  exclusion_summary           jsonb         NOT NULL DEFAULT '{}',
  run_notes                   text,
  error_message               text,
  created_by                  text,
  started_at                  timestamptz,
  completed_at                timestamptz,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

-- 8. SEED: scoring policy v1.0.1 methodology row
INSERT INTO wk_chart_methodologies_v2 (methodology_version, label, scoring_policy_version, rule_set, changelog, effective_from)
VALUES (
  'v1.0.1',
  'WAKILISHA Scoring Policy 1.0.1',
  '1.0.1',
  '{"source_score":{"points_per_source":24,"cap":72},"cross_source_bonus":{"mode":"standard","points_per_extra":6,"cap":18,"weight":1.0},"overlap_bonus":{"points_per_extra_occurrence":2,"cap":10},"recency_score":{"brackets":[{"max_days":30,"points":18},{"max_days":90,"points":12},{"max_days":180,"points":8},{"max_days":365,"points":4},{"max_days":null,"points":0}]},"continuity_score":{"formula":"max(4, 18 - min(14, p - 1))","weight":1.0},"carry_forward_bonus":{"formula":"max(8, 18 - min(10, max(0, p - 1)))","weight":1.0},"airplay_score":{"base_multiplier":4.25,"station_bonus_per_extra":1.5,"station_bonus_cap":6.0,"detection_divisor":3,"detection_bonus_cap":4.0,"max_score":24,"weight":1.0},"anti_gaming":{"max_tracks_per_lead_artist":3,"overflow_penalty":8,"overlap_bonus_cap":10,"demote_stale_carry_forward_penalty":12},"corrections":{"11.1":true,"11.2":true,"11.3":true,"11.4":true}}',
  'Corrections §11.1-11.4 applied. Enforcement of airplay_min_stations/detections; per-detection duration filter; sort before anti-gaming overflow; zero-weight stored correctly.',
  '2026-06-11'
) ON CONFLICT (methodology_version) DO NOTHING;

INSERT INTO wk_chart_eligibility_rules_v2 (eligibility_version, label, rule_set, description, effective_from)
VALUES (
  'v1.0',
  'Default — All Artists',
  '{"missing_policy":"review","countries_include":null,"countries_exclude":null,"genders_include":null,"types_include":null,"release_start":null,"release_end":null}',
  'Default eligibility: all artists, all countries. Missing data rows flagged for review, not excluded.',
  '2026-06-11'
) ON CONFLICT (eligibility_version) DO NOTHING;

-- 9. Backfill existing programs to reference policy versions
UPDATE wk_chart_programs_v2
SET
  default_methodology_version       = COALESCE(default_methodology_version, 'v1.0.1'),
  default_eligibility_rules_version = COALESCE(default_eligibility_rules_version, 'v1.0'),
  updated_at                        = now()
WHERE default_methodology_version IS NULL
   OR default_eligibility_rules_version IS NULL;