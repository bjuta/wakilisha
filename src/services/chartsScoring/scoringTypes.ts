/**
 * WAKILISHA Chart Scoring Engine — Type Definitions
 * Mirrors the Supabase schema exactly. All score columns are number (NUMERIC 12,4 in DB).
 * Scoring policy v1.0.1 — corrections §11.1-11.4 applied.
 *
 * CRITICAL: No mock data, no stubs, no Math.random permitted here or in any consumer.
 * Every field maps 1:1 to a real DB column or a pure computation thereof.
 */

// ─────────────────────────────────────────────────────────────────────────────
// §9 Config Registry — per-program scoring configuration
// ─────────────────────────────────────────────────────────────────────────────

export type CrossSourceMode = "off" | "standard" | "strong";
export type AirplayStationScope = "all" | "selected";
export type AirplayRescueMode = "allow_rescue" | "strengthen_only";
export type MissingPolicy = "review" | "exclude";
export type OverrideMode = "metadata_and_matching_only" | "full";

/** Full §9 config registry for a chart program — all defaults match bible spec */
export interface ScoringConfig {
  chart_size:                                 number;   // default 20
  streaming_min_sources:                      number;   // default 1
  cross_source_mode:                          CrossSourceMode; // default 'standard'
  cross_source_weight:                        number;   // default 1.0
  continuity_weight:                          number;   // default 1.0
  carry_forward_weight:                       number;   // default 1.0
  airplay_enabled:                            boolean;  // default false
  airplay_station_scope:                      AirplayStationScope; // default 'all'
  airplay_min_duration:                       number;   // default 20 (seconds, per-detection §11.2)
  airplay_weight:                             number;   // default 1.0
  airplay_min_stations:                       number;   // default 1 (enforced §11.1)
  airplay_min_detections:                     number;   // default 1 (enforced §11.1)
  airplay_max_score:                          number;   // default 24
  airplay_rescue_mode:                        AirplayRescueMode; // default 'allow_rescue'
  anti_gaming_max_tracks_per_lead_artist:     number;   // default 3
  anti_gaming_overlap_bonus_cap:              number;   // default 10
  anti_gaming_artist_overflow_penalty:        number;   // default 8
  anti_gaming_demote_carry_forward_without_current: boolean; // default false
  missing_policy:                             MissingPolicy; // default 'review'
  override_mode:                              OverrideMode;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  chart_size:                                  20,
  streaming_min_sources:                        1,
  cross_source_mode:                            "standard",
  cross_source_weight:                          1.0,
  continuity_weight:                            1.0,
  carry_forward_weight:                         1.0,
  airplay_enabled:                              false,
  airplay_station_scope:                        "all",
  airplay_min_duration:                         20,
  airplay_weight:                               1.0,
  airplay_min_stations:                         1,
  airplay_min_detections:                       1,
  airplay_max_score:                            24,
  airplay_rescue_mode:                          "allow_rescue",
  anti_gaming_max_tracks_per_lead_artist:       3,
  anti_gaming_overlap_bonus_cap:                10,
  anti_gaming_artist_overflow_penalty:          8,
  anti_gaming_demote_carry_forward_without_current: false,
  missing_policy:                               "review",
  override_mode:                                "metadata_and_matching_only",
};

// ─────────────────────────────────────────────────────────────────────────────
// §12 Policy Snapshot — version strings stored on every edition
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicySnapshot {
  methodology_version:        string;   // e.g. "v1.0.1"
  source_policy_version:      string;
  eligibility_policy_version: string;
  scoring_policy_version:     string;   // e.g. "1.0.1"
  rule_set_snapshot:          ScoringConfig; // full config serialized
}

/** Current active policy versions. Bump requires a version increment per §12 governance. */
export const CURRENT_SCORING_POLICY_VERSION = "1.0.1";
export const CURRENT_METHODOLOGY_VERSION    = "v1.0.1";
export const CURRENT_SOURCE_POLICY_VERSION  = "v1.0";
export const CURRENT_ELIGIBILITY_POLICY_VERSION = "v1.0";

// ─────────────────────────────────────────────────────────────────────────────
// Input row types (pre-scoring)
// ─────────────────────────────────────────────────────────────────────────────

/** A single evidence row after fetch + normalize + dedupe (bible §2 pipeline) */
export interface ScoringInputRow {
  // Identity (§3)
  normalized_key:      string;
  lead_artist_key:     string;
  track_title:         string;
  artist_name:         string;

  // Source evidence (§4.1 / §4.2 / §4.3)
  source_count:        number;   // distinct source URLs
  occurrence_count:    number;   // total occurrences across all sources
  source_urls_seen:    string[];

  // Recency (§4.4)
  release_date:        string | null; // ISO date or null

  // Carry-forward flags (§4.6)
  carry_forward_only:      boolean;
  continuity_locked:       boolean;
  airplay_candidate_only:  boolean;

  // Canonical links (from registry matching)
  canonical_track_id:   string | null;
  canonical_release_id: string | null;
  canonical_artist_id:  string | null;
  artwork_url:          string | null;
  track_slug:           string | null;
  artist_slug:          string | null;
}

/** Previous published edition entry — used for continuity/carry-forward scoring */
export interface PreviousEditionEntry {
  normalized_key: string;
  position:       number;  // 1-based rank in previous edition
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 Airplay sub-engine types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw detection from ACRCloud (or equivalent) — before filtering or bucketing */
export interface RawAirplayDetection {
  /** ISRC or other external identifier for the track */
  track_isrc: string | null;
  /** Raw track title as reported by the detection service */
  track_title: string;
  /** Raw artist name as reported by the detection service */
  artist_name: string;
  /** Station identifier — must match wk_chart_airplay_stations.id */
  station_id: string;
  /** ISO 8601 timestamp of when the track was detected playing */
  played_at: string;
  /** Duration of the detected play in seconds */
  duration_seconds: number;
  /** ACRCloud fingerprint ID (optional, for audit) */
  acr_id: string | null;
  /** ACRCloud fingerprint confidence 0.0–1.0 (optional, for audit) */
  fingerprint_confidence: number | null;
}

/** Station record from wk_chart_airplay_stations */
export interface AirplayStationRow {
  id: string;
  station_name: string;
  station_slug: string;
  country_code: string | null;
  station_weight: number;
  is_active: boolean;
  notes: string | null;
}

/** Config subset needed by the airplay sub-engine */
export interface AirplayEngineConfig {
  airplay_enabled: boolean;
  airplay_min_duration: number;
  airplay_min_stations: number;
  airplay_min_detections: number;
  airplay_max_score: number;
  airplay_weight: number;
  airplay_station_scope: AirplayStationScope;
  airplay_rescue_mode: AirplayRescueMode;
}

/** Weekly airplay evidence per track per station, after per-detection filter (§11.2) */
export interface AirplayEvidenceBucket {
  canonical_track_id:    string;
  normalized_key:        string | null;
  station_id:            string;
  station_weight:        number;   // NUMERIC(8,2)
  week_start:            string;   // ISO date, Monday-anchored per §5.1
  detection_count:       number;
  total_played_duration: number;   // seconds (sum of qualifying detections ≥ min_duration each)
  weighted_score:        number;   // NUMERIC(12,4): detection_count * station_weight + total_played_duration/60
}

/** Aggregated airplay context per track across all stations for a chart week */
export interface AirplayContext {
  normalized_key:          string;
  canonical_track_id:      string | null;
  W:                       number; // Σ weighted_score across stations
  station_count:           number; // S
  detection_count:         number; // D (total across stations)
  total_duration_seconds:  number;
  last_detected_at:        string | null;
  matched_by:              "track_id" | "canonical_match" | "normalized_key";
  rescue_mode:             AirplayRescueMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 Eligibility
// ─────────────────────────────────────────────────────────────────────────────

export type EligibilityStatus = "eligible" | "excluded" | "review";

export interface EligibilityOutcome {
  status:   EligibilityStatus;
  warnings: string[];   // reasons for review flags
  reasons:  string[];   // reasons for hard exclusion
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 Score components — all NUMERIC(12,4) in DB
// ─────────────────────────────────────────────────────────────────────────────

/** Full per-row score breakdown — stored in wk_chart_entries_v2 and source_payload */
export interface ScoreBreakdown {
  source_score:        number;  // §4.1 — max(72, source_count × 24)
  cross_source_bonus:  number;  // §4.2 — mode-dependent, weight applied
  overlap_bonus:       number;  // §4.3 — 2pts per extra occurrence, cap 10
  recency_score:       number;  // §4.4 — step decay table
  continuity_score:    number;  // §4.5 — max(4, 18 - min(14, p-1)) × weight
  carry_forward_bonus: number;  // §4.6 — only for carry_forward_only rows
  airplay_score:       number;  // §4.7 / §5.3 — ln-based formula
  anti_gaming_penalty: number;  // §7 — cumulative overflow penalty
  total_score:         number;  // sum of above components minus penalty
}

/** Anti-gaming flags stored on the row (bible §7 audit surface) */
export interface AntiGamingFlags {
  overlap_bonus_capped:        boolean;
  lead_artist_overflow:        boolean;
  overflow_index:              number;   // 0 = not overflowing, 1+ = Nth overflow
  stale_carry_forward_demoted: boolean;
}

/** Full audit payload stored in source_payload jsonb column */
export interface SourcePayload {
  score_breakdown:   ScoreBreakdown;
  anti_gaming:       AntiGamingFlags;
  airplay_detail:    AirplayContext | null;
  eligibility:       EligibilityOutcome;
  source_urls_seen:  string[];
  inputs: {
    source_count:        number;
    occurrence_count:    number;
    release_date:        string | null;
    release_recency_days: number | null;
    previous_position:   number | null;
    carry_forward_only:  boolean;
    continuity_locked:   boolean;
    airplay_candidate_only: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output row (post-scoring, ready to write to wk_chart_entries_v2)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoredRow extends ScoringInputRow {
  rank:              number;
  previous_rank:     number | null;
  movement:          "up" | "down" | "same" | "new" | "reentry" | null;

  // Score breakdown (§4 components)
  source_score:      number;
  cross_source_bonus: number;
  overlap_bonus:     number;
  recency_score:     number;
  continuity_score:  number;
  carry_forward_bonus: number;
  airplay_score:     number;
  anti_gaming_penalty: number;
  total_score:       number;

  // Eligibility
  eligibility_status:   EligibilityStatus;
  eligibility_warnings: string[];

  // Anti-gaming flags
  overlap_bonus_capped:        boolean;
  lead_artist_overflow:        boolean;
  stale_carry_forward_demoted: boolean;

  // Airplay audit surface
  airplay_detections:       number | null;
  airplay_station_count:    number | null;
  airplay_total_duration:   number | null;
  airplay_weighted_score:   number | null;
  airplay_last_detected_at: string | null;
  airplay_matched_by:       string | null;
  airplay_rescue_mode:      string | null;

  // Policy versions (§12)
  scoring_policy_version:     string;
  methodology_version:        string;
  eligibility_policy_version: string;

  // Full audit
  source_payload:   SourcePayload;

  // Internals for carry-forward detection
  release_recency_days: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline context — passed through the full §2 pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoringPipelineContext {
  programId:       string;
  editionDate:     string;    // ISO date — injected, never wall-clock
  chartKind:       "tracks" | "releases";
  config:          ScoringConfig;
  policySnapshot:  PolicySnapshot;
  previousEdition: PreviousEditionEntry[];
  airplayContexts: Map<string, AirplayContext>; // keyed by normalized_key
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types (for Supabase reads/writes)
// ─────────────────────────────────────────────────────────────────────────────

export interface WkChartEntryV2Row {
  id:                          string;
  edition_id:                  string;
  rank:                        number;
  previous_rank:               number | null;
  movement:                    string | null;
  track_slug:                  string | null;
  track_title:                 string | null;
  artist_slug:                 string | null;
  artist_name:                 string | null;
  artwork_url:                 string | null;
  normalized_key:              string | null;
  lead_artist_key:             string | null;
  source_count:                number;
  occurrence_count:            number;
  source_urls_seen:            string[];
  release_date:                string | null;
  release_recency_days:        number | null;
  canonical_track_id:          string | null;
  canonical_release_id:        string | null;
  canonical_artist_id:         string | null;
  source_score:                number;
  cross_source_bonus:          number;
  overlap_bonus:               number;
  recency_score:               number;
  continuity_score:            number;
  carry_forward_bonus:         number;
  airplay_score:               number;
  anti_gaming_penalty:         number;
  total_score:                 number;
  carry_forward_only:          boolean;
  continuity_locked:           boolean;
  airplay_candidate_only:      boolean;
  overlap_bonus_capped:        boolean;
  lead_artist_overflow:        boolean;
  stale_carry_forward_demoted: boolean;
  eligibility_status:          string;
  eligibility_warnings:        string[];
  source_payload:              SourcePayload;
  scoring_policy_version:      string | null;
  methodology_version:         string | null;
  eligibility_policy_version:  string | null;
  airplay_detections:          number | null;
  airplay_station_count:       number | null;
  airplay_total_duration:      number | null;
  airplay_weighted_score:      number | null;
  airplay_last_detected_at:    string | null;
  airplay_matched_by:          string | null;
  airplay_rescue_mode:         string | null;
  created_at:                  string;
  updated_at:                  string;
}

export interface WkChartEditionV2Row {
  id:                          string;
  program_id:                  string;
  edition_slug:                string;
  edition_label:               string;
  edition_date:                string;
  period_start:                string | null;
  period_end:                  string | null;
  entry_count:                 number;
  status:                      string;
  methodology_version:         string | null;
  source_policy_version:       string | null;
  eligibility_policy_version:  string | null;
  scoring_policy_version:      string | null;
  rule_set_snapshot:           ScoringConfig;
  chart_size:                  number | null;
  carry_forward_count:         number;
  new_entries_count:           number;
  re_entries_count:            number;
  exclusion_summary:           Record<string, number>;
  override_mode:               string;
  ingest_run_id:               string | null;
  published_at:                string | null;
  published_by:                string | null;
  created_at:                  string;
  updated_at:                  string;
}

/** Row from wk_chart_scoring_runs */
export interface ScoringRunRow {
  id: string;
  program_id: string;
  edition_date: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scoring_policy_version: string;
  methodology_version: string | null;
  source_policy_version: string | null;
  eligibility_policy_version: string | null;
  rule_set_snapshot: ScoringConfig;
  source_urls: string[];
  total_rows: number;
  eligible_rows: number;
  excluded_rows: number;
  carry_forward_rows: number;
  airplay_rescue_rows: number;
  exclusion_summary: Record<string, number>;
  run_notes: string | null;
  error_message: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Row from wk_chart_programs_v2 */
export interface ChartProgramRow {
  id: string;
  series_slug: string;
  market_slug: string;
  public_slug: string;
  public_label: string;
  short_label: string;
  source_family_slug: string;
  default_period_type: string;
  default_methodology_version: string | null;
  default_eligibility_rules_version: string | null;
  chart_size: number;
  streaming_min_sources: number;
  cross_source_mode: CrossSourceMode;
  cross_source_weight: number;
  continuity_weight: number;
  carry_forward_weight: number;
  airplay_enabled: boolean;
  airplay_station_scope: AirplayStationScope;
  airplay_min_duration: number;
  airplay_weight: number;
  airplay_min_stations: number;
  airplay_min_detections: number;
  airplay_max_score: number;
  airplay_rescue_mode: AirplayRescueMode;
  anti_gaming_max_tracks_per_lead_artist: number;
  anti_gaming_overlap_bonus_cap: number;
  anti_gaming_artist_overflow_penalty: number;
  anti_gaming_demote_carry_forward_without_current: boolean;
  missing_policy: MissingPolicy;
  override_mode: OverrideMode;
  created_at: string;
  updated_at: string;
}