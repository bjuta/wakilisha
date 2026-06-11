/**
 * WAKILISHA Airplay Sub-Engine
 * Bible §5 — Airplay Evidence Pipeline
 *
 * CONTRACT:
 *  1. Accepts matched raw detections (post entity-resolution)
 *  2. Applies per-detection duration filtering (§11.2)
 *  3. Groups into Monday-anchored weekly buckets per track per station
 *  4. Applies station weights from wk_chart_airplay_stations
 *  5. Computes weighted_score = detection_count × station_weight + total_duration/60
 *  6. Aggregates into AirplayContext for the main scoring engine
 *  7. Supports rescue mode: allow_rescue / strengthen_only (§5.4)
 *
 * All functions are pure — zero I/O, zero randomness, zero stubs.
 * Every returned value is reproducible from inputs alone.
 * No Math.random, no Date.now, no external API calls.
 */

import type {
  RawAirplayDetection,
  AirplayEvidenceBucket,
  AirplayContext,
  AirplayEngineConfig,
  AirplayStationRow,
  AirplayRescueMode,
  ScoringInputRow,
} from './scoringTypes';

// ============================================================================
// Types internal to the airplay engine
// ============================================================================

/** A detection that has been matched to a canonical track via entity resolution */
export interface MatchedAirplayDetection {
  canonical_track_id: string | null;
  normalized_key: string;
  station_id: string;
  /** ISO 8601 timestamp */
  played_at: string;
  /** Duration in seconds */
  duration_seconds: number;
  /** ACRCloud fingerprint metadata (for audit trail) */
  acr_id: string | null;
  fingerprint_confidence: number | null;
}

/** Result of matching raw detections — grouped by match type */
export interface DetectionMatchResult {
  matched_key: string;
  matched_by: 'track_id' | 'canonical_match' | 'normalized_key';
  detections: RawAirplayDetection[];
}

// ============================================================================
// §5.1 — Monday Anchoring
// ============================================================================

/**
 * Snap any date to the immediately-preceding Monday at 00:00:00 UTC.
 *
 * ISO 8601 weeks start on Monday per Bible §5.1.
 * This is the anchor used for all weekly evidence bucketing.
 *
 * Examples:
 *   2026-06-10 (Wed) → 2026-06-08
 *   2026-06-08 (Mon) → 2026-06-08
 *   2026-06-14 (Sun) → 2026-06-08
 */
export function anchorToMonday(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`anchorToMonday: invalid date input: ${String(date)}`);
  }
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// ============================================================================
// §5.2 / §11.2 — Per-Detection Duration Filter
// ============================================================================

/**
 * §11.2 CORRECTION — min_duration applies PER DETECTION, not per weekly total.
 *
 * Prior to scoring policy v1.0.1, the duration check was applied to the
 * weekly total. The correction demands that each individual detection be
 * at least `min_duration` seconds long.
 *
 * Purpose: short "noise" detections (<20s default) are excluded.
 * A station playing only the intro of a song doesn't count as a real spin.
 *
 * Returns a new array — does not mutate input.
 */
export function filterQualifyingDetections<T extends { duration_seconds: number }>(
  detections: T[],
  minDuration: number,
): T[] {
  if (detections.length === 0) return [];
  return detections.filter((d) => d.duration_seconds >= minDuration);
}

// ============================================================================
// §5.3 — Weekly Bucketing (per track × station)
// ============================================================================

/**
 * Bucket field type for grouped detections during the pipeline.
 * Not exported — internal only.
 */
interface DetectionGroup {
  weekStart: string;
  stationId: string;
  detections: MatchedAirplayDetection[];
}

/**
 * Group detections by (week_start, station_id).
 *
 * Each detection is assigned to the Monday that anchors its played_at week.
 * Within each week, detections are further grouped by station.
 *
 * Returns a flat list of {weekStart, stationId, detections[]} groups,
 * sorted by week ascending, then station for determinism.
 */
export function groupDetectionsByWeekAndStation(
  detections: MatchedAirplayDetection[],
): DetectionGroup[] {
  if (detections.length === 0) return [];

  // Map<weekStart, Map<stationId, MatchedAirplayDetection[]>>
  const weekMap = new Map<string, Map<string, MatchedAirplayDetection[]>>();

  for (const det of detections) {
    const week = anchorToMonday(det.played_at);
    if (!weekMap.has(week)) {
      weekMap.set(week, new Map());
    }
    const stationMap = weekMap.get(week)!;
    if (!stationMap.has(det.station_id)) {
      stationMap.set(det.station_id, []);
    }
    stationMap.get(det.station_id)!.push(det);
  }

  const groups: DetectionGroup[] = [];
  for (const [weekStart, stationMap] of weekMap) {
    for (const [stationId, dets] of stationMap) {
      groups.push({ weekStart, stationId, detections: dets });
    }
  }

  // Deterministic sort: week ascending, then station_id ascending
  groups.sort((a, b) => {
    const weekCmp = a.weekStart.localeCompare(b.weekStart);
    if (weekCmp !== 0) return weekCmp;
    return a.stationId.localeCompare(b.stationId);
  });

  return groups;
}

// ============================================================================
// §5.4 — Compute Bucket-Level Weighted Score
// ============================================================================

/**
 * For a single (track, station, week) bucket, compute:
 *
 *   weighted_score = detection_count × station_weight + total_played_duration / 60
 *
 * The station_weight is the multiplier for each individual detection.
 * Duration adds 1 point per 60 seconds (1 minute) of play.
 *
 * Both detection_count and total_played_duration are stored on the bucket
 * for audit trail and for the scoring engine's detection_bonus computation.
 */
export function computeBucketScore(
  detectionCount: number,
  totalDuration: number,
  stationWeight: number,
): number {
  return detectionCount * stationWeight + totalDuration / 60;
}

// ============================================================================
// §5.5 — Build Airplay Evidence Buckets (Full Pipeline)
// ============================================================================

/**
 * Full airplay evidence pipeline for a batch of matched detections:
 *
 *   1. Filter by per-detection min_duration (§11.2)
 *   2. Group into (week_start, station_id) buckets
 *   3. Compute detection_count, total_played_duration per bucket
 *   4. Apply station_weight → weighted_score
 *
 * Only ACTIVE stations contribute (is_active === true).
 * Stations with is_active === false are silently dropped.
 *
 * Returns AirplayEvidenceBucket[] ready for DB insertion or aggregation.
 */
export function buildAirplayEvidenceBuckets(
  detections: MatchedAirplayDetection[],
  stations: Map<string, AirplayStationRow>,
  config: Pick<AirplayEngineConfig, 'airplay_min_duration'>,
): AirplayEvidenceBucket[] {
  // Step 1: Per-detection duration filter
  const qualified = filterQualifyingDetections(detections, config.airplay_min_duration);
  if (qualified.length === 0) return [];

  // Step 2: Weekly bucketing
  const groups = groupDetectionsByWeekAndStation(qualified);

  // Step 3–4: Build evidence buckets
  const buckets: AirplayEvidenceBucket[] = [];

  for (const group of groups) {
    const station = stations.get(group.stationId);

    // Skip inactive or unknown stations
    if (!station || !station.is_active) continue;

    const detectionCount = group.detections.length;
    const totalDuration = group.detections.reduce(
      (sum, d) => sum + d.duration_seconds,
      0,
    );

    // Each detection in the group shares the same canonical_track_id and normalized_key
    // (they were matched before entering the engine)
    const first = group.detections[0];

    const bucket: AirplayEvidenceBucket = {
      canonical_track_id: first.canonical_track_id || '',
      normalized_key: first.normalized_key,
      station_id: group.stationId,
      station_weight: station.station_weight,
      week_start: group.weekStart,
      detection_count: detectionCount,
      total_played_duration: totalDuration,
      weighted_score: computeBucketScore(
        detectionCount,
        totalDuration,
        station.station_weight,
      ),
    };

    buckets.push(bucket);
  }

  return buckets;
}

// ============================================================================
// §5.6 — Aggregate Buckets to AirplayContext
// ============================================================================

/**
 * Aggregate all evidence buckets for a single track across all stations
 * into a single AirplayContext for the scoring engine.
 *
 * W = Σ weighted_score across stations
 * station_count = S = number of distinct stations
 * detection_count = D = total detections across all stations
 * total_duration = sum of all played durations
 */
export function aggregateToAirplayContext(
  buckets: AirplayEvidenceBucket[],
  normalizedKey: string,
  matchedBy: AirplayContext['matched_by'] = 'normalized_key',
  rescueMode: AirplayRescueMode = 'allow_rescue',
): AirplayContext {
  if (buckets.length === 0) {
    return {
      normalized_key: normalizedKey,
      canonical_track_id: null,
      W: 0,
      station_count: 0,
      detection_count: 0,
      total_duration_seconds: 0,
      last_detected_at: null,
      matched_by: matchedBy,
      rescue_mode: rescueMode,
    };
  }

  let W = 0;
  let totalDuration = 0;
  let totalDetections = 0;
  let lastDetected: string | null = null;

  // Track distinct stations
  const stationSet = new Set<string>();

  for (const bucket of buckets) {
    W += bucket.weighted_score;
    totalDuration += bucket.total_played_duration;
    totalDetections += bucket.detection_count;
    stationSet.add(bucket.station_id);

    // last_detected_at is the week_start — the latest week
    if (!lastDetected || bucket.week_start > lastDetected) {
      lastDetected = bucket.week_start;
    }
  }

  // Canonical track ID from the first bucket that has one
  const canonicalTrackId =
    buckets.find((b) => b.canonical_track_id)?.canonical_track_id ?? null;

  return {
    normalized_key: normalizedKey,
    canonical_track_id: canonicalTrackId,
    W,
    station_count: stationSet.size,
    detection_count: totalDetections,
    total_duration_seconds: totalDuration,
    last_detected_at: lastDetected,
    matched_by: matchedBy,
    rescue_mode: rescueMode,
  };
}

// ============================================================================
// §5.7 — Build AirplayContext Map from Buckets
// ============================================================================

/**
 * Given a flat list of AirplayEvidenceBuckets (potentially spanning
 * multiple tracks), aggregate them into a Map<normalized_key, AirplayContext>.
 *
 * This is the primary integration point for the §2 scoring pipeline:
 *   buckets → context map → feed into scoreEvidenceRow for each track
 */
export function buildAirplayContextMap(
  buckets: AirplayEvidenceBucket[],
  rescueMode: AirplayRescueMode = 'allow_rescue',
): Map<string, AirplayContext> {
  const map = new Map<string, AirplayContext>();

  if (buckets.length === 0) return map;

  // Group buckets by normalized_key
  const keyGroups = new Map<string, AirplayEvidenceBucket[]>();

  for (const bucket of buckets) {
    const key = bucket.normalized_key || bucket.canonical_track_id || '__unmatched__';
    if (!keyGroups.has(key)) {
      keyGroups.set(key, []);
    }
    keyGroups.get(key)!.push(bucket);
  }

  for (const [key, group] of keyGroups) {
    map.set(key, aggregateToAirplayContext(group, key, 'normalized_key', rescueMode));
  }

  return map;
}

// ============================================================================
// §5.8 — Rescue Mode: Identify Airplay-Only Candidates
// ============================================================================

/**
 * CONTRACT: Airplay rescue mode determines whether tracks with zero streaming
 * evidence but airplay evidence can still chart.
 *
 *   allow_rescue   — airplay-only tracks can enter the chart
 *   strengthen_only — airplay only boosts tracks that already have streaming
 *
 * When rescueMode is 'allow_rescue', this function identifies tracks from the
 * airplay context map that have NO corresponding streaming evidence row and
 * produce synthetic ScoringInputRow entries for them.
 *
 * These synthetic rows have:
 *   carry_forward_only = false
 *   continuity_locked  = false
 *   airplay_candidate_only = true   ← THE KEY FLAG
 *   source_count = 0, occurrence_count = 0 (no streaming evidence at all)
 *
 * The main scoring engine's scoreEvidenceRow will use airplayCandidateOnly to
 * skip streaming-based components (§4.1–§4.6) and compute only the airplay
 * score. Anti-gaming still applies.
 *
 * strengthened_only mode returns an empty array — airplay can't create
 * new chart entries, only strengthen existing ones.
 */
export function identifyAirplayRescueCandidates(
  airplayContexts: Map<string, AirplayContext>,
  existingRows: ScoringInputRow[],
  rescueMode: AirplayRescueMode,
): ScoringInputRow[] {
  if (rescueMode !== 'allow_rescue') return [];
  if (airplayContexts.size === 0) return [];

  // Build a quick lookup: is there streaming evidence for this normalized_key?
  const hasStreamingEvidence = new Set<string>();
  for (const row of existingRows) {
    hasStreamingEvidence.add(row.normalized_key);
  }

  const candidates: ScoringInputRow[] = [];

  for (const [key, context] of airplayContexts) {
    // Skip if this track already has streaming evidence
    if (hasStreamingEvidence.has(key)) continue;

    // Skip if airplay context has no meaningful evidence
    if (context.detection_count === 0) continue;

    candidates.push({
      normalized_key: key,
      lead_artist_key: '',
      track_title: '',
      artist_name: '',
      source_count: 0,
      occurrence_count: 0,
      source_urls_seen: [],
      release_date: null,
      carry_forward_only: false,
      continuity_locked: false,
      airplay_candidate_only: true,
      canonical_track_id: context.canonical_track_id,
      canonical_release_id: null,
      canonical_artist_id: null,
      artwork_url: null,
      track_slug: null,
      artist_slug: null,
    });
  }

  return candidates;
}

// ============================================================================
// §5.9 — Entity Resolution Helper: Match Raw Detections
// ============================================================================

/**
 * Group raw detections by (track_title, artist_name) → normalized_key
 * for pre-engine matching.
 *
 * This is a simple normalization layer. The actual entity resolution
 * (ISRC → canonical_track_id, fuzzy matching) happens upstream in the
 * registry layer. This function just groups identical title+artist
 * pairs so the engine has a normalized key to work with.
 *
 * Uses a deterministic key format: title::artist (lowercased, trimmed).
 */
export function normalizeDetectionKeys(
  detections: RawAirplayDetection[],
): Map<string, RawAirplayDetection[]> {
  const groups = new Map<string, RawAirplayDetection[]>();

  for (const det of detections) {
    const key = `${det.track_title.trim().toLowerCase()}::${det.artist_name.trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(det);
  }

  return groups;
}

/**
 * Match raw detections to canonical tracks using a simple ISRC or
 * title+artist lookup function provided by the caller.
 *
 * The `resolve` function is injected — it could be a real Supabase query
 * or a test stub. It receives (isrc, title, artist) and returns
 * (canonical_track_id | null, normalized_key).
 *
 * Returns MatchedAirplayDetection[] ready for the main engine pipeline.
 */
export function matchDetectionsToCanonicalTracks(
  detections: RawAirplayDetection[],
  resolve: (
    isrc: string | null,
    title: string,
    artist: string,
  ) => { canonical_track_id: string | null; normalized_key: string },
): MatchedAirplayDetection[] {
  return detections.map((det) => {
    const { canonical_track_id, normalized_key } = resolve(
      det.track_isrc,
      det.track_title,
      det.artist_name,
    );

    return {
      canonical_track_id,
      normalized_key,
      station_id: det.station_id,
      played_at: det.played_at,
      duration_seconds: det.duration_seconds,
      acr_id: det.acr_id,
      fingerprint_confidence: det.fingerprint_confidence,
    };
  });
}

// ============================================================================
// §5.10 — Smoke Test / Verification
// ============================================================================

/**
 * Verify the airplay sub-engine produces the expected results for the
 * Gate C worked example path.
 *
 * Gate C airplay inputs:
 *   2 stations (equal weight 1.0), 9 detections, 27 minutes total
 *   W_expected = 9 × 1.0 + 1620/60 = 9 + 27 = 36
 *
 * This trace builds real buckets from synthetic detections and asserts
 * the aggregated context matches the Gate C expected values.
 *
 * Returns true if the engine is in contract.
 */
export function verifyAirplayEngineSmokeTest(): boolean {
  // ── Build 2 stations with weight 1.0 ──
  const stations = new Map<string, AirplayStationRow>();
  stations.set('stn-alpha', {
    id: 'stn-alpha',
    station_name: 'Alpha FM',
    station_slug: 'alpha-fm',
    country_code: 'KE',
    station_weight: 1.0,
    is_active: true,
    notes: null,
  });
  stations.set('stn-beta', {
    id: 'stn-beta',
    station_name: 'Beta Radio',
    station_slug: 'beta-radio',
    country_code: 'KE',
    station_weight: 1.0,
    is_active: true,
    notes: null,
  });

  // ── Build 9 detections: 4 on Alpha, 5 on Beta ──
  // Gate C: 2 stations, 9 detections, 27 min (1620s) total
  const baseTime = new Date('2026-06-08T12:00:00Z'); // Monday noon

  const detections: MatchedAirplayDetection[] = [];

  // Station Alpha: 4 detections, each 180s (total 720s for this station)
  for (let i = 0; i < 4; i++) {
    const playedAt = new Date(baseTime);
    playedAt.setUTCHours(12 + i * 3);
    detections.push({
      canonical_track_id: null,
      normalized_key: 'test_track::test_artist',
      station_id: 'stn-alpha',
      played_at: playedAt.toISOString(),
      duration_seconds: 180,
      acr_id: null,
      fingerprint_confidence: null,
    });
  }

  // Station Beta: 5 detections, each 180s (total 900s for this station)
  for (let i = 0; i < 5; i++) {
    const playedAt = new Date(baseTime);
    playedAt.setUTCHours(12 + i * 3);
    detections.push({
      canonical_track_id: null,
      normalized_key: 'test_track::test_artist',
      station_id: 'stn-beta',
      played_at: playedAt.toISOString(),
      duration_seconds: 180,
      acr_id: null,
      fingerprint_confidence: null,
    });
  }

  // ── Run the engine ──
  const buckets = buildAirplayEvidenceBuckets(detections, stations, {
    airplay_min_duration: 20,
  });

  const context = aggregateToAirplayContext(
    buckets,
    'test_track::test_artist',
    'normalized_key',
    'allow_rescue',
  );

  // ── Assertions ──
  const checks: Array<{ label: string; pass: boolean; expected: number; actual: number }> = [];

  checks.push({
    label: 'buckets: 2 stations → 2 buckets',
    pass: buckets.length === 2,
    expected: 2,
    actual: buckets.length,
  });

  checks.push({
    label: 'Station count = 2',
    pass: context.station_count === 2,
    expected: 2,
    actual: context.station_count,
  });

  checks.push({
    label: 'Detection count = 9',
    pass: context.detection_count === 9,
    expected: 9,
    actual: context.detection_count,
  });

  checks.push({
    label: 'Total duration = 1620',
    pass: context.total_duration_seconds === 1620,
    expected: 1620,
    actual: context.total_duration_seconds,
  });

  // W = 9 × 1.0 + 1620/60 = 9 + 27 = 36
  checks.push({
    label: 'W = 36 (Gate C expected)',
    pass: Math.abs(context.W - 36) < 0.001,
    expected: 36,
    actual: context.W,
  });

  // ── Verify individual bucket scores ──
  // Alpha: 4 det × 1.0 + 720s/60 = 4 + 12 = 16
  const alphaBucket = buckets.find((b) => b.station_id === 'stn-alpha');
  checks.push({
    label: 'Alpha bucket weighted_score = 16',
    pass: alphaBucket !== undefined && Math.abs(alphaBucket.weighted_score - 16) < 0.001,
    expected: 16,
    actual: alphaBucket?.weighted_score ?? -1,
  });

  // Beta: 5 det × 1.0 + 900s/60 = 5 + 15 = 20
  const betaBucket = buckets.find((b) => b.station_id === 'stn-beta');
  checks.push({
    label: 'Beta bucket weighted_score = 20',
    pass: betaBucket !== undefined && Math.abs(betaBucket.weighted_score - 20) < 0.001,
    expected: 20,
    actual: betaBucket?.weighted_score ?? -1,
  });

  // ── Report ──
  const allPass = checks.every((c) => c.pass);

  if (allPass) {
    return true;
  }

  // Log failures for debugging
  console.error('⚠ Airplay Engine Smoke Test FAILURES:');
  for (const c of checks) {
    if (!c.pass) {
      console.error(
        `  ${c.label}: expected ${c.expected}, got ${c.actual}`,
      );
    }
  }

  return false;
}

// ============================================================================
// §5.11 — Engine Health Report (for debugging/audit)
// ============================================================================

/**
 * Returns a human-readable audit trail string showing what the engine did.
 * Useful for debugging and for the §12 policy audit log.
 */
export function airplayEngineReport(
  detections: MatchedAirplayDetection[],
  stations: Map<string, AirplayStationRow>,
  config: Pick<AirplayEngineConfig, 'airplay_min_duration'>,
): string {
  const total = detections.length;
  const qualified = filterQualifyingDetections(detections, config.airplay_min_duration);
  const dropped = total - qualified.length;
  const buckets = buildAirplayEvidenceBuckets(detections, stations, config);
  const contextMap = buildAirplayContextMap(buckets);

  const lines = [
    '═══════════════════════════════════════════',
    '  AIRPLAY SUB-ENGINE — Processing Report',
    '═══════════════════════════════════════════',
    `  Raw detections received:    ${total}`,
    `  Min-duration threshold:     ${config.airplay_min_duration}s`,
    `  Detections qualified:       ${qualified.length}`,
    `  Detections dropped (short): ${dropped}`,
    '',
    `  Evidence buckets produced:  ${buckets.length}`,
    `  Distinct stations:          ${new Set(buckets.map((b) => b.station_id)).size}`,
    `  Distinct tracks:            ${contextMap.size}`,
    '═══════════════════════════════════════════',
  ];

  // Per-track breakdown
  for (const [key, ctx] of contextMap) {
    lines.push(
      `  Track: ${key} | W=${ctx.W.toFixed(4)} | S=${ctx.station_count} | D=${ctx.detection_count} | dur=${ctx.total_duration_seconds}s`,
    );
  }

  return lines.join('\n');
}