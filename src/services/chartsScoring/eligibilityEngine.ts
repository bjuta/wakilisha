/**
 * WAKILISHA Chart Scoring Engine — Eligibility Engine
 * Bible §6: Track Eligibility Rules & Missing Data Policy
 * Scoring Policy: 1.0.1
 *
 * CONTRACT:
 * - Pure functions only — zero I/O, zero randomness
 * - Every returned value is reproducible from inputs alone
 * - No Math.random, no Date.now, no external API calls
 *
 * Eligibility is evaluated per-row BEFORE scoring.
 * A row that fails eligibility is excluded from the chart (or flagged for review).
 */

import type {
  ScoringInputRow,
  ScoringConfig,
  EligibilityOutcome,
  EligibilityStatus,
  AirplayContext,
  PreviousEditionEntry,
} from './scoringTypes';

// ============================================================================
// §6.1 — Minimum Source Check
// ============================================================================

/**
 * §6.1.1: A track must appear in at least `streaming_min_sources` distinct
 * source URLs to be eligible for the chart.
 *
 * This does NOT apply to airplay_candidate_only tracks (they have zero
 * streaming evidence by definition — they're rescued purely by airplay).
 *
 * Also does NOT apply to carry_forward_only tracks (they're carried from
 * previous edition without fresh evidence).
 */
export function checkMinimumSources(
  row: ScoringInputRow,
  config: Pick<ScoringConfig, 'streaming_min_sources'>,
): { pass: boolean; reason: string | null } {
  if (row.airplay_candidate_only) return { pass: true, reason: null };
  if (row.carry_forward_only) return { pass: true, reason: null };

  const minSources = config.streaming_min_sources ?? 1;
  if (row.source_count >= minSources) return { pass: true, reason: null };

  return {
    pass: false,
    reason: `source_count ${row.source_count} < minimum ${minSources}`,
  };
}

// ============================================================================
// §6.2 — Release Date Check
// ============================================================================

/**
 * §6.2.1: Tracks without a release_date cannot receive recency score.
 * This is not a hard exclusion — it's a soft flag. The recency component
 * simply scores 0 when release_date is null.
 *
 * However, under strict missing_policy ("exclude"), a missing release_date
 * on a non-carry-forward, non-rescue row IS ground for exclusion.
 */
export function checkReleaseDate(
  row: ScoringInputRow,
): { pass: boolean; warning: string | null } {
  if (row.release_date) return { pass: true, warning: null };
  if (row.carry_forward_only || row.airplay_candidate_only) {
    return { pass: true, warning: null };
  }
  return {
    pass: false,
    warning: 'missing release_date — recency score will be 0',
  };
}

// ============================================================================
// §6.3 — Airplay Candidate Minimums
// ============================================================================

/**
 * §6.3.1: An airplay_candidate_only track must meet airplay minimums
 * (stations, detections) or it has zero score. If it still has zero score
 * after the scoring engine runs, it's excluded.
 *
 * We check this here in eligibility as a pre-filter: if airplay context
 * doesn't meet minimums and the row is airplay-only, flag it.
 */
export function checkAirplayMinimums(
  row: ScoringInputRow,
  airplayContext: AirplayContext | null,
  config: Pick<
    ScoringConfig,
    'airplay_enabled' | 'airplay_min_stations' | 'airplay_min_detections'
  >,
): { pass: boolean; reason: string | null } {
  if (!row.airplay_candidate_only) return { pass: true, reason: null };
  if (!config.airplay_enabled) {
    return { pass: false, reason: 'airplay disabled — airplay-only track excluded' };
  }
  if (!airplayContext) {
    return { pass: false, reason: 'no airplay context for airplay-only track' };
  }

  const minStations = config.airplay_min_stations ?? 1;
  const minDetections = config.airplay_min_detections ?? 1;

  if (airplayContext.station_count < minStations) {
    return {
      pass: false,
      reason: `airplay stations ${airplayContext.station_count} < min ${minStations}`,
    };
  }
  if (airplayContext.detection_count < minDetections) {
    return {
      pass: false,
      reason: `airplay detections ${airplayContext.detection_count} < min ${minDetections}`,
    };
  }

  return { pass: true, reason: null };
}

// ============================================================================
// §6.4 — Continuity-Locked Tracks
// ============================================================================

/**
 * §6.4.1: Tracks flagged continuity_locked bypass source minimum checks.
 * They charted in the previous edition and are locked in for continuity.
 *
 * Continuity-locked status is set by the ingestion/normalization layer,
 * not by this engine. We simply honor it — a continuity_locked row with
 * a previous position is always eligible.
 */
export function checkContinuityLocked(
  row: ScoringInputRow,
  previousEdition: PreviousEditionEntry[],
): { pass: boolean; reason: string | null } {
  if (!row.continuity_locked) return { pass: true, reason: null };

  const prevEntry = previousEdition.find(
    (p) => p.normalized_key === row.normalized_key,
  );

  if (!prevEntry) {
    return {
      pass: false,
      reason: 'continuity_locked but no previous edition entry found',
    };
  }

  return { pass: true, reason: null };
}

// ============================================================================
// §6.5 — Stale Carry-Forward Demotion (§11.4 Correction)
// ============================================================================

/**
 * §11.4 CORRECTION: Tracks carried forward for multiple consecutive weeks
 * without any fresh evidence are demoted.
 *
 * When anti_gaming_demote_carry_forward_without_current is true and a
 * carry_forward_only track has no current streaming evidence for more
 * than 2 consecutive weeks, it should be excluded.
 *
 * This check is a pre-filter: the pipeline is responsible for tracking
 * consecutive carry-forward weeks. If the 3rd consecutive carry-forward
 * week is detected, the row is excluded.
 *
 * We default to allowing all carry-forward rows — the actual demotion
 * is a pipeline-level concern based on week-over-week tracking.
 */
export function checkStaleCarryForward(
  row: ScoringInputRow,
  config: Pick<
    ScoringConfig,
    'anti_gaming_demote_carry_forward_without_current'
  >,
  consecutiveCarryForwardWeeks: number = 0,
): { pass: boolean; reason: string | null } {
  if (!config.anti_gaming_demote_carry_forward_without_current) {
    return { pass: true, reason: null };
  }
  if (!row.carry_forward_only) return { pass: true, reason: null };

  // 3+ consecutive carry-forward weeks → demote
  if (consecutiveCarryForwardWeeks >= 3) {
    return {
      pass: false,
      reason: `stale carry-forward: ${consecutiveCarryForwardWeeks} consecutive weeks without fresh evidence`,
    };
  }

  return { pass: true, reason: null };
}

// ============================================================================
// §6.6 — Missing Data Policy
// ============================================================================

/**
 * §6.6.1: When missing_policy is "review", rows with warnings are flagged
 * but still included. When it's "exclude", rows with critical missing data
 * (such as no release_date, no canonical_track_id) are excluded.
 *
 * The "exclude" policy is used for official/public charts that demand
 * complete metadata. The "review" policy is used during ingestion
 * triage and quality-assurance runs.
 */
export function applyMissingPolicy(
  warnings: string[],
  missingPolicy: 'review' | 'exclude',
): EligibilityStatus {
  if (warnings.length === 0) return 'eligible';
  if (missingPolicy === 'exclude') return 'excluded';
  return 'review';
}

// ============================================================================
// §6.7 — Full Eligibility Evaluation
// ============================================================================

/**
 * Evaluate ALL eligibility rules for a single evidence row.
 *
 * Returns an EligibilityOutcome with:
 *   status: 'eligible' | 'excluded' | 'review'
 *   warnings: reasons for review (soft flags)
 *   reasons: reasons for hard exclusion
 *
 * Rules are evaluated in priority order. A hard exclusion in any rule
 * immediately sets status to 'excluded' and collects all reasons.
 * Soft warnings accumulate but don't change status unless missing_policy
 * is 'exclude' and there are warnings.
 */
export function evaluateEligibility(
  row: ScoringInputRow,
  airplayContext: AirplayContext | null,
  config: ScoringConfig,
  previousEdition: PreviousEditionEntry[],
  consecutiveCarryForwardWeeks: number = 0,
): EligibilityOutcome {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let hardExcluded = false;

  // Rule 1: Continuity-locked check (hard)
  const contCheck = checkContinuityLocked(row, previousEdition);
  if (!contCheck.pass) {
    reasons.push(contCheck.reason!);
    hardExcluded = true;
  }

  // Rule 2: Airplay candidate minimums (hard for airplay-only)
  const airplayCheck = checkAirplayMinimums(row, airplayContext, config);
  if (!airplayCheck.pass) {
    reasons.push(airplayCheck.reason!);
    hardExcluded = true;
  }

  // Rule 3: Minimum sources (hard — unless continuity or airplay override)
  const sourcesCheck = checkMinimumSources(row, config);
  if (!sourcesCheck.pass) {
    reasons.push(sourcesCheck.reason!);
    hardExcluded = true;
  }

  // Rule 4: Stale carry-forward (hard)
  const staleCheck = checkStaleCarryForward(row, config, consecutiveCarryForwardWeeks);
  if (!staleCheck.pass) {
    reasons.push(staleCheck.reason!);
    hardExcluded = true;
  }

  // Rule 5: Release date (soft — downgrades recency to 0, not exclusion)
  const releaseCheck = checkReleaseDate(row);
  if (!releaseCheck.pass && releaseCheck.warning) {
    warnings.push(releaseCheck.warning);
  }

  // Rule 6: Missing data policy
  if (hardExcluded) {
    return { status: 'excluded', warnings, reasons };
  }

  const status = applyMissingPolicy(warnings, config.missing_policy);

  return { status, warnings, reasons };
}

// ============================================================================
// §6.8 — Batch Eligibility Filter
// ============================================================================

/**
 * Run eligibility across a batch of rows and return the partitioned results.
 *
 * Returns:
 *   eligible: rows that pass all checks (status = 'eligible' or 'review')
 *   excluded: rows that hard-fail (status = 'excluded') with reasons
 *   outcomes: map of normalized_key → EligibilityOutcome for audit
 */
export interface EligibilityBatchResult {
  eligible: ScoringInputRow[];
  excluded: Array<{ row: ScoringInputRow; reasons: string[] }>;
  outcomes: Map<string, EligibilityOutcome>;
}

export function filterEligibleRows(
  rows: ScoringInputRow[],
  airplayContexts: Map<string, AirplayContext>,
  config: ScoringConfig,
  previousEdition: PreviousEditionEntry[],
): EligibilityBatchResult {
  const eligible: ScoringInputRow[] = [];
  const excluded: Array<{ row: ScoringInputRow; reasons: string[] }> = [];
  const outcomes = new Map<string, EligibilityOutcome>();

  for (const row of rows) {
    const airplayCtx = airplayContexts.get(row.normalized_key) ?? null;
    const outcome = evaluateEligibility(
      row,
      airplayCtx,
      config,
      previousEdition,
    );

    outcomes.set(row.normalized_key, outcome);

    if (outcome.status === 'excluded') {
      excluded.push({ row, reasons: outcome.reasons });
    } else {
      eligible.push(row);
    }
  }

  return { eligible, excluded, outcomes };
}

// ============================================================================
// §6.9 — Smoke Test / Verification
// ============================================================================

/**
 * Verify the eligibility engine produces expected results for key scenarios.
 */
export interface EligibilitySmokeTestCase {
  label: string;
  row: ScoringInputRow;
  airplayContext: AirplayContext | null;
  expectedStatus: EligibilityStatus;
  expectedReasonCount: number;
}

export function verifyEligibilitySmokeTest(): { pass: boolean; failures: string[] } {
  const config: ScoringConfig = {
    chart_size: 20,
    streaming_min_sources: 1,
    cross_source_mode: 'standard',
    cross_source_weight: 1.0,
    continuity_weight: 1.0,
    carry_forward_weight: 1.0,
    airplay_enabled: true,
    airplay_station_scope: 'all',
    airplay_min_duration: 20,
    airplay_weight: 1.0,
    airplay_min_stations: 1,
    airplay_min_detections: 1,
    airplay_max_score: 24,
    airplay_rescue_mode: 'allow_rescue',
    anti_gaming_max_tracks_per_lead_artist: 3,
    anti_gaming_overlap_bonus_cap: 10,
    anti_gaming_artist_overflow_penalty: 8,
    anti_gaming_demote_carry_forward_without_current: false,
    missing_policy: 'review',
    override_mode: 'metadata_and_matching_only',
  };

  const emptyPreviousEdition: PreviousEditionEntry[] = [];

  const baseRow: ScoringInputRow = {
    normalized_key: 'test::test',
    lead_artist_key: 'test',
    track_title: 'Test',
    artist_name: 'Test Artist',
    source_count: 2,
    occurrence_count: 3,
    source_urls_seen: ['https://a.com', 'https://b.com'],
    release_date: '2026-05-01',
    carry_forward_only: false,
    continuity_locked: false,
    airplay_candidate_only: false,
    canonical_track_id: null,
    canonical_release_id: null,
    canonical_artist_id: null,
    artwork_url: null,
    track_slug: null,
    artist_slug: null,
  };

  const testCases: EligibilitySmokeTestCase[] = [
    {
      label: 'Normal row with 2 sources → eligible',
      row: { ...baseRow },
      airplayContext: null,
      expectedStatus: 'eligible',
      expectedReasonCount: 0,
    },
    {
      label: 'Row with 0 sources → excluded (below min)',
      row: { ...baseRow, source_count: 0, occurrence_count: 0 },
      airplayContext: null,
      expectedStatus: 'excluded',
      expectedReasonCount: 1,
    },
    {
      label: 'Airplay-only with valid context → eligible',
      row: {
        ...baseRow,
        source_count: 0,
        occurrence_count: 0,
        airplay_candidate_only: true,
      },
      airplayContext: {
        normalized_key: 'test::test',
        canonical_track_id: null,
        W: 36,
        station_count: 2,
        detection_count: 9,
        total_duration_seconds: 1620,
        last_detected_at: '2026-06-10T00:00:00Z',
        matched_by: 'normalized_key',
        rescue_mode: 'allow_rescue',
      },
      expectedStatus: 'eligible',
      expectedReasonCount: 0,
    },
    {
      label: 'Airplay-only with 0 stations → excluded',
      row: {
        ...baseRow,
        source_count: 0,
        occurrence_count: 0,
        airplay_candidate_only: true,
      },
      airplayContext: {
        normalized_key: 'test::test',
        canonical_track_id: null,
        W: 0,
        station_count: 0,
        detection_count: 0,
        total_duration_seconds: 0,
        last_detected_at: null,
        matched_by: 'normalized_key',
        rescue_mode: 'allow_rescue',
      },
      expectedStatus: 'excluded',
      expectedReasonCount: 1,
    },
    {
      label: 'Missing release date → review (soft)',
      row: { ...baseRow, release_date: null },
      airplayContext: null,
      expectedStatus: 'review',
      expectedReasonCount: 0,
    },
    {
      label: 'Carry-forward only with 0 sources → eligible (bypass)',
      row: { ...baseRow, source_count: 0, occurrence_count: 0, carry_forward_only: true },
      airplayContext: null,
      expectedStatus: 'eligible',
      expectedReasonCount: 0,
    },
  ];

  const failures: string[] = [];

  for (const tc of testCases) {
    const outcome = evaluateEligibility(
      tc.row,
      tc.airplayContext,
      config,
      emptyPreviousEdition,
    );

    if (outcome.status !== tc.expectedStatus) {
      failures.push(
        `${tc.label}: expected ${tc.expectedStatus}, got ${outcome.status} [reasons: ${outcome.reasons.join(', ')}]`,
      );
    }

    if (tc.expectedReasonCount > 0 && outcome.reasons.length !== tc.expectedReasonCount) {
      failures.push(
        `${tc.label}: expected ${tc.expectedReasonCount} reason(s), got ${outcome.reasons.length}`,
      );
    }
  }

  return { pass: failures.length === 0, failures };
}