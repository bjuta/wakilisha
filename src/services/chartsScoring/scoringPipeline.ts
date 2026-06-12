/**
 * WAKILISHA Chart Scoring Pipeline
 * Bible §2: Full Pipeline Orchestration
 * Scoring Policy: 1.0.1
 *
 * This module ties together the four pure engines:
 *   1. normalize        — title/artist identity keys
 *   2. airplayEngine    — ACRCloud evidence → AirplayContext
 *   3. eligibilityEngine — per-row eligibility checks
 *   4. scoringEngine    — evidence-blend scoring formula
 *
 * The pipeline itself is pure orchestration — no I/O, no randomness.
 * The Edge Function handles all Supabase reads/writes and calls into
 * this module for the actual computation.
 */

import type {
  ScoringInputRow,
  ScoringConfig,
  ScoringPipelineContext,
  AirplayContext,
  PreviousEditionEntry,
  AirplayEvidenceBucket,
  AirplayRescueMode,
  PolicySnapshot,
  ScoredRow,
  EligibilityStatus,
  EligibilityOutcome,
  SourcePayload,
} from './scoringTypes';
import { DEFAULT_SCORING_CONFIG, CURRENT_SCORING_POLICY_VERSION, CURRENT_METHODOLOGY_VERSION, CURRENT_ELIGIBILITY_POLICY_VERSION, CURRENT_SOURCE_POLICY_VERSION } from './scoringTypes';
import { build_normalized_key } from './normalize';
import {
  identifyAirplayRescueCandidates,
  buildAirplayContextMap,
} from './airplayEngine';
import {
  evaluateEligibility,
  filterEligibleRows,
} from './eligibilityEngine';
import {
  scoreEvidenceRow,
  applyAntiGamingAndFinalize,
  type ScoredTrack,
} from './scoringEngine';

// ============================================================================
// Types
// ============================================================================

/** Raw evidence from upstream ingestion — title + artist + source URLs */
export interface RawEvidenceRecord {
  track_title: string;
  artist_name: string;
  source_urls: string[];
  release_date: string | null;
  canonical_track_id: string | null;
  canonical_release_id: string | null;
  canonical_artist_id: string | null;
  artwork_url: string | null;
  track_slug: string | null;
  artist_slug: string | null;
}

/** Full pipeline result — everything needed to write to DB */
export interface PipelineResult {
  scoredRows: ScoredRow[];
  excludedRows: Array<{ normalized_key: string; reasons: string[] }>;
  editionSummary: EditionSummary;
  policySnapshot: PolicySnapshot;
  airplayContexts: Map<string, AirplayContext>;
  eligibilityOutcomes: Map<string, EligibilityOutcome>;
}

/** Quick summary stats for the edition record */
export interface EditionSummary {
  total_input_rows: number;
  eligible_rows: number;
  excluded_rows: number;
  carry_forward_count: number;
  new_entries_count: number;
  re_entries_count: number;
  airplay_rescue_count: number;
  exclusion_summary: Record<string, number>;
  chart_size: number;
}

// ============================================================================
// §2.1 — Build ScoringInputRows from Raw Evidence
// ============================================================================

/**
 * Convert raw evidence records into ScoringInputRow[] with normalized keys.
 *
 * Each distinct normalized_key gets one row, aggregating all source URLs
 * and occurrence counts from the raw records that map to that key.
 */
export function buildScoringInputRows(
  rawEvidence: RawEvidenceRecord[],
): ScoringInputRow[] {
  const keyMap = new Map<string, {
    sources: Set<string>;
    occurrences: number;
    record: RawEvidenceRecord;
  }>();

  for (const rec of rawEvidence) {
    const normalizedKey = build_normalized_key(rec.track_title, rec.artist_name);
    if (!normalizedKey) continue;

    const existing = keyMap.get(normalizedKey);
    if (existing) {
      for (const url of rec.source_urls) {
        existing.sources.add(url);
      }
      existing.occurrences += rec.source_urls.length;
      // Keep the record with a release_date if we find one
      if (!existing.record.release_date && rec.release_date) {
        existing.record = rec;
      }
    } else {
      keyMap.set(normalizedKey, {
        sources: new Set(rec.source_urls),
        occurrences: rec.source_urls.length,
        record: rec,
      });
    }
  }

  const rows: ScoringInputRow[] = [];

  for (const [key, aggregated] of keyMap) {
    rows.push({
      normalized_key: key,
      lead_artist_key: key.split('::')[1] ?? '',
      track_title: aggregated.record.track_title,
      artist_name: aggregated.record.artist_name,
      source_count: aggregated.sources.size,
      occurrence_count: aggregated.occurrences,
      source_urls_seen: Array.from(aggregated.sources),
      release_date: aggregated.record.release_date,
      carry_forward_only: false,
      continuity_locked: false,
      airplay_candidate_only: false,
      canonical_track_id: aggregated.record.canonical_track_id,
      canonical_release_id: aggregated.record.canonical_release_id,
      canonical_artist_id: aggregated.record.canonical_artist_id,
      artwork_url: aggregated.record.artwork_url,
      track_slug: aggregated.record.track_slug,
      artist_slug: aggregated.record.artist_slug,
    });
  }

  return rows;
}

// ============================================================================
// §2.2 — Carry-Forward Merge
// ============================================================================

/**
 * Identify tracks from the PREVIOUS edition that have NO fresh evidence
 * this week. These become carry_forward_only rows.
 *
 * The carry-forward safety net prevents popular tracks from vanishing
 * due to a single week of missing playlist/chart data.
 *
 * Returns the merged array: fresh evidence rows + carry-forward rows.
 * Updates carry_forward_only flag on the synthetic rows.
 */
export function carryForwardMerge(
  freshRows: ScoringInputRow[],
  previousEdition: PreviousEditionEntry[],
  previousEditionTitles: Map<string, {
    track_title: string;
    artist_name: string;
    canonical_track_id: string | null;
    release_date: string | null;
  }> = new Map(),
): ScoringInputRow[] {
  const freshKeys = new Set(freshRows.map((r) => r.normalized_key));
  const merged = [...freshRows];

  for (const prev of previousEdition) {
    if (freshKeys.has(prev.normalized_key)) continue;

    const meta = previousEditionTitles.get(prev.normalized_key);

    merged.push({
      normalized_key: prev.normalized_key,
      lead_artist_key: prev.normalized_key.split('::')[1] ?? '',
      track_title: meta?.track_title ?? '',
      artist_name: meta?.artist_name ?? '',
      source_count: 0,
      occurrence_count: 0,
      source_urls_seen: [],
      release_date: meta?.release_date ?? null,
      carry_forward_only: true,
      continuity_locked: false,
      airplay_candidate_only: false,
      canonical_track_id: meta?.canonical_track_id ?? null,
      canonical_release_id: null,
      canonical_artist_id: null,
      artwork_url: null,
      track_slug: null,
      artist_slug: null,
    });
  }

  return merged;
}

// ============================================================================
// §2.3 — Movement Classification
// ============================================================================

type Movement = 'up' | 'down' | 'same' | 'new' | 'reentry' | null;

function classifyMovement(
  currentRank: number,
  previousRank: number | null,
  previousEdition: PreviousEditionEntry[],
  normalizedKey: string,
): Movement {
  if (previousRank === null) {
    // Was this track EVER in a previous edition? If so, it's a re-entry
    if (previousEdition.some((p) => p.normalized_key === normalizedKey)) {
      return 'reentry';
    }
    return 'new';
  }

  if (currentRank === previousRank) return 'same';
  if (currentRank < previousRank) return 'up';
  return 'down';
}

// ============================================================================
// §2.4 — Build Edition Summary
// ============================================================================

function buildEditionSummary(
  scored: ScoredRow[],
  excludedCount: number,
  totalInput: number,
  carryForwardCount: number,
  airplayRescueCount: number,
  previousEdition: PreviousEditionEntry[],
  chartSize: number,
): EditionSummary {
  const previousKeys = new Set(previousEdition.map((p) => p.normalized_key));

  let newEntries = 0;
  let reEntries = 0;

  for (const row of scored) {
    const prevRank = previousEdition.find(
      (p) => p.normalized_key === row.normalized_key,
    )?.position;
    if (prevRank) continue; // was in previous edition
    if (previousKeys.has(row.normalized_key)) {
      reEntries++;
    } else {
      newEntries++;
    }
  }

  // Exclusion summary by reason category
  const exclusionSummary: Record<string, number> = {};
  if (excludedCount > 0) {
    exclusionSummary['total_excluded'] = excludedCount;
  }

  return {
    total_input_rows: totalInput,
    eligible_rows: scored.length,
    excluded_rows: excludedCount,
    carry_forward_count: carryForwardCount,
    new_entries_count: newEntries,
    re_entries_count: reEntries,
    airplay_rescue_count: airplayRescueCount,
    exclusion_summary: exclusionSummary,
    chart_size: chartSize,
  };
}

// ============================================================================
// §2.5 — Build Full SourcePayload for Audit Trail
// ============================================================================

function buildSourcePayload(
  row: ScoringInputRow,
  breakdown: ReturnType<typeof scoreEvidenceRow>,
  antiGaming: {
    penalty: number;
    overflow: boolean;
    overflowIndex: number;
    capped: boolean;
  },
  airplayContext: AirplayContext | null,
  outcome: EligibilityOutcome,
): SourcePayload {
  return {
    score_breakdown: {
      source_score: breakdown.source_score,
      cross_source_bonus: breakdown.cross_source_bonus,
      overlap_bonus: breakdown.overlap_bonus,
      recency_score: breakdown.recency_score,
      continuity_score: breakdown.continuity_score,
      carry_forward_bonus: breakdown.carry_forward_bonus,
      airplay_score: breakdown.airplay_score,
      anti_gaming_penalty: antiGaming.penalty,
      total_score: breakdown.total_score - antiGaming.penalty,
    },
    anti_gaming: {
      overlap_bonus_capped: antiGaming.capped,
      lead_artist_overflow: antiGaming.overflow,
      overflow_index: antiGaming.overflowIndex,
      stale_carry_forward_demoted: false,
    },
    airplay_detail: airplayContext,
    eligibility: outcome,
    source_urls_seen: row.source_urls_seen,
    inputs: {
      source_count: row.source_count,
      occurrence_count: row.occurrence_count,
      release_date: row.release_date,
      release_recency_days: breakdown.release_recency_days,
      previous_position: null, // filled below
      carry_forward_only: row.carry_forward_only,
      continuity_locked: row.continuity_locked,
      airplay_candidate_only: row.airplay_candidate_only,
    },
  };
}

// ============================================================================
// §2.6 — The Full Pipeline (Main Entry Point)
// ============================================================================

/**
 * Run the complete §2 scoring pipeline from raw evidence to ranked shortlist.
 *
 * This is THE function. Feed it evidence, get back scored & ranked rows.
 *
 * Pipeline stages:
 *   1. Build ScoringInputRow[] from raw evidence (normalize + aggregate)
 *   2. Build AirplayContext map from airplay evidence buckets
 *   3. Identify airplay rescue candidates (if rescue mode allows)
 *   4. Merge rescue candidates into the evidence set
 *   5. Carry-forward merge: add previous-edition tracks missing this week
 *   6. Eligibility filter: exclude ineligible rows
 *   7. Score all eligible rows (scoreEvidenceRow per row)
 *   8. Apply anti-gaming penalties across all rows
 *   9. Sort by final total descending
 *   10. Shortlist to chart_size
 *   11. Assign ranks & classify movements
 *   12. Build full audit payloads
 */
export function runFullPipeline(
  rawEvidence: RawEvidenceRecord[],
  airplayBuckets: AirplayEvidenceBucket[],
  previousEdition: PreviousEditionEntry[],
  previousEditionTitles: Map<string, {
    track_title: string;
    artist_name: string;
    canonical_track_id: string | null;
    release_date: string | null;
  }>,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  editionDate: string = new Date().toISOString().split('T')[0],
): PipelineResult {
  // ── Policy snapshot ──
  const policySnapshot: PolicySnapshot = {
    methodology_version: CURRENT_METHODOLOGY_VERSION,
    source_policy_version: CURRENT_SOURCE_POLICY_VERSION,
    eligibility_policy_version: CURRENT_ELIGIBILITY_POLICY_VERSION,
    scoring_policy_version: CURRENT_SCORING_POLICY_VERSION,
    rule_set_snapshot: config,
  };

  // ── Stage 1: Build input rows ──
  let inputRows = buildScoringInputRows(rawEvidence);
  const totalInput = inputRows.length;

  // ── Stage 2: Build airplay context map ──
  const rescueMode: AirplayRescueMode = config.airplay_rescue_mode ?? 'allow_rescue';
  const airplayContexts = buildAirplayContextMap(airplayBuckets, rescueMode);

  // ── Stage 3: Identify airplay rescue candidates ──
  let airplayRescueCount = 0;
  if (config.airplay_enabled && rescueMode === 'allow_rescue') {
    const rescueCandidates = identifyAirplayRescueCandidates(
      airplayContexts,
      inputRows,
      rescueMode,
    );
    inputRows = [...inputRows, ...rescueCandidates];
    airplayRescueCount = rescueCandidates.length;
  }

  // ── Stage 4: Carry-forward merge ──
  const carryForwardRows = carryForwardMerge(
    inputRows,
    previousEdition,
    previousEditionTitles,
  );
  const carryForwardOnly = carryForwardRows.filter((r) => r.carry_forward_only);
  const carryForwardCount = carryForwardOnly.length;

  // ── Stage 5: Eligibility filter ──
  const { eligible, excluded, outcomes } = filterEligibleRows(
    carryForwardRows,
    airplayContexts,
    config,
    previousEdition,
  );

  // ── Stage 6–7: Score eligible rows ──
  const provisionals = eligible.map((row) => {
    const airplayCtx = airplayContexts.get(row.normalized_key) ?? null;
    const breakdown = scoreEvidenceRow(
      row,
      previousEdition,
      airplayCtx,
      config,
      editionDate,
    );
    return {
      normalized_key: row.normalized_key,
      lead_artist_key: row.lead_artist_key,
      provisional_breakdown: breakdown,
    };
  });

  const finalized = applyAntiGamingAndFinalize(provisionals, config);

  // Sort by final total descending
  finalized.sort((a, b) => b.final_total - a.final_total);

  // ── Stage 8: Shortlist to chart_size ──
  const chartSize = config.chart_size ?? 20;
  const shortlist = finalized.slice(0, chartSize);

  // ── Stage 9: Assign ranks & movements ──
  const previousMap = new Map<string, number>();
  for (const prev of previousEdition) {
    previousMap.set(prev.normalized_key, prev.position);
  }

  const buildRankedRows = (): ScoredRow[] => {
    // Map back to original eligible rows for metadata
    const eligibleMap = new Map(eligible.map((r) => [r.normalized_key, r]));
    // Excluded map for reasons
    const excludedMap = new Map(
      excluded.map((e) => [e.row.normalized_key, e.reasons]),
    );

    const scoredRows: ScoredRow[] = [];

    for (let i = 0; i < shortlist.length; i++) {
      const scored = shortlist[i];
      const rank = i + 1;
      const originalRow = eligibleMap.get(scored.normalized_key);
      const prevRank = previousMap.get(scored.normalized_key) ?? null;
      const movement = classifyMovement(rank, prevRank, previousEdition, scored.normalized_key);
      const airplayCtx = airplayContexts.get(scored.normalized_key) ?? null;
      const outcome = outcomes.get(scored.normalized_key) ?? {
        status: 'eligible' as EligibilityStatus,
        warnings: [],
        reasons: [],
      };

      const b = scored.provisional_breakdown;

      const sourcePayload = buildSourcePayload(
        originalRow!,
        b,
        {
          penalty: scored.anti_gaming_penalty,
          overflow: scored.lead_artist_overflow,
          overflowIndex: scored.overflow_index,
          capped: b.overlap_bonus_capped,
        },
        airplayCtx,
        outcome,
      );

      // Fill previous_position in source_payload
      sourcePayload.inputs.previous_position = prevRank;

      scoredRows.push({
        normalized_key: scored.normalized_key,
        lead_artist_key: scored.lead_artist_key,
        track_title: originalRow?.track_title ?? '',
        artist_name: originalRow?.artist_name ?? '',
        source_count: originalRow?.source_count ?? 0,
        occurrence_count: originalRow?.occurrence_count ?? 0,
        source_urls_seen: originalRow?.source_urls_seen ?? [],
        release_date: originalRow?.release_date ?? null,
        carry_forward_only: originalRow?.carry_forward_only ?? false,
        continuity_locked: originalRow?.continuity_locked ?? false,
        airplay_candidate_only: originalRow?.airplay_candidate_only ?? false,
        canonical_track_id: originalRow?.canonical_track_id ?? null,
        canonical_release_id: originalRow?.canonical_release_id ?? null,
        canonical_artist_id: originalRow?.canonical_artist_id ?? null,
        artwork_url: originalRow?.artwork_url ?? null,
        track_slug: originalRow?.track_slug ?? null,
        artist_slug: originalRow?.artist_slug ?? null,
        rank,
        previous_rank: prevRank,
        movement,
        source_score: b.source_score,
        cross_source_bonus: b.cross_source_bonus,
        overlap_bonus: b.overlap_bonus,
        recency_score: b.recency_score,
        continuity_score: b.continuity_score,
        carry_forward_bonus: b.carry_forward_bonus,
        airplay_score: b.airplay_score,
        anti_gaming_penalty: scored.anti_gaming_penalty,
        total_score: scored.final_total,
        eligibility_status: outcome.status,
        eligibility_warnings: outcome.warnings,
        overlap_bonus_capped: b.overlap_bonus_capped,
        lead_artist_overflow: scored.lead_artist_overflow,
        stale_carry_forward_demoted: false,
        airplay_detections: airplayCtx?.detection_count ?? null,
        airplay_station_count: airplayCtx?.station_count ?? null,
        airplay_total_duration: airplayCtx?.total_duration_seconds ?? null,
        airplay_weighted_score: airplayCtx?.W ?? null,
        airplay_last_detected_at: airplayCtx?.last_detected_at ?? null,
        airplay_matched_by: airplayCtx?.matched_by ?? null,
        airplay_rescue_mode: airplayCtx?.rescue_mode ?? null,
        scoring_policy_version: CURRENT_SCORING_POLICY_VERSION,
        methodology_version: CURRENT_METHODOLOGY_VERSION,
        eligibility_policy_version: CURRENT_ELIGIBILITY_POLICY_VERSION,
        source_payload: sourcePayload,
        release_recency_days: b.release_recency_days,
      });
    }

    return scoredRows;
  };

  const scoredRows = buildRankedRows();

  // ── Stage 10: Build edition summary ──
  const editionSummary = buildEditionSummary(
    scoredRows,
    excluded.length,
    totalInput,
    scoredRows.filter((r) => r.carry_forward_only).length,
    scoredRows.filter((r) => r.airplay_candidate_only).length,
    previousEdition,
    chartSize,
  );

  // Build exclusion summary from actual reasons
  const exclusionReasons: Record<string, number> = {};
  for (const ex of excluded) {
    for (const reason of ex.reasons) {
      const key = reason.split(':')[0]?.trim() ?? reason;
      exclusionReasons[key] = (exclusionReasons[key] ?? 0) + 1;
    }
  }
  editionSummary.exclusion_summary = exclusionReasons;

  return {
    scoredRows,
    excludedRows: excluded.map((e) => ({
      normalized_key: e.row.normalized_key,
      reasons: e.reasons,
    })),
    editionSummary,
    policySnapshot,
    airplayContexts,
    eligibilityOutcomes: outcomes,
  };
}

// ============================================================================
// §2.7 — Pipeline Report (for debugging / audit log)
// ============================================================================

export function pipelineReport(result: PipelineResult): string {
  const s = result.editionSummary;
  const lines = [
    '═══════════════════════════════════════════',
    '  SCORING PIPELINE — Run Report',
    '═══════════════════════════════════════════',
    `  Scoring Policy:   ${result.policySnapshot.scoring_policy_version}`,
    `  Methodology:      ${result.policySnapshot.methodology_version}`,
    `  Eligibility:      ${result.policySnapshot.eligibility_policy_version}`,
    '',
    '  ── Inputs ──',
    `  Total input rows:      ${s.total_input_rows}`,
    `  Eligible:              ${s.eligible_rows}`,
    `  Excluded:              ${s.excluded_rows}`,
    '',
    '  ── Composition ──',
    `  Carry-forward only:    ${s.carry_forward_count}`,
    `  Airplay rescues:       ${s.airplay_rescue_count}`,
    `  New entries:           ${s.new_entries_count}`,
    `  Re-entries:            ${s.re_entries_count}`,
    `  Chart size:            ${s.chart_size}`,
    '',
    '  ── Top 10 ──',
  ];

  for (const row of result.scoredRows.slice(0, 10)) {
    lines.push(
      `  #${row.rank}  ${row.total_score.toFixed(2)}  ${row.track_title} — ${row.artist_name}  [${row.movement}]`,
    );
  }

  if (result.excludedRows.length > 0) {
    lines.push('');
    lines.push('  ── Excluded ──');
    for (const ex of result.excludedRows) {
      lines.push(`  ${ex.normalized_key}: ${ex.reasons.join('; ')}`);
    }
  }

  lines.push('═══════════════════════════════════════════');
  return lines.join('\n');
}