/**
 * WAKILISHA Chart Scoring Runner — v4 (artist origin filter)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CrossSourceMode = "off" | "standard" | "strong";
type AirplayStationScope = "all" | "selected";
type AirplayRescueMode = "allow_rescue" | "strengthen_only";
type MissingPolicy = "review" | "exclude";
type OverrideMode = "metadata_and_matching_only" | "full";
type EligibilityStatus = "eligible" | "excluded" | "review";
type Movement = "up" | "down" | "same" | "new" | "reentry" | null;

interface ScoringConfig {
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
}

interface ScoringInputRow {
  normalized_key: string;
  lead_artist_key: string;
  track_title: string;
  artist_name: string;
  source_count: number;
  occurrence_count: number;
  source_urls_seen: string[];
  release_date: string | null;
  carry_forward_only: boolean;
  continuity_locked: boolean;
  airplay_candidate_only: boolean;
  canonical_track_id: string | null;
  canonical_release_id: string | null;
  canonical_artist_id: string | null;
  artwork_url: string | null;
  track_slug: string | null;
  artist_slug: string | null;
}

interface AirplayEvidenceBucket {
  canonical_track_id: string;
  normalized_key: string | null;
  station_id: string;
  station_weight: number;
  week_start: string;
  detection_count: number;
  total_played_duration: number;
  weighted_score: number;
}

interface AirplayContext {
  normalized_key: string;
  canonical_track_id: string | null;
  W: number;
  station_count: number;
  detection_count: number;
  total_duration_seconds: number;
  last_detected_at: string | null;
  matched_by: "track_id" | "canonical_match" | "normalized_key";
  rescue_mode: AirplayRescueMode;
}

interface PreviousEditionEntry {
  normalized_key: string;
  position: number;
}

interface EligibilityOutcome {
  status: EligibilityStatus;
  warnings: string[];
  reasons: string[];
}

interface ScoredRow {
  normalized_key: string;
  lead_artist_key: string;
  track_title: string;
  artist_name: string;
  source_count: number;
  occurrence_count: number;
  source_urls_seen: string[];
  release_date: string | null;
  carry_forward_only: boolean;
  continuity_locked: boolean;
  airplay_candidate_only: boolean;
  canonical_track_id: string | null;
  canonical_release_id: string | null;
  canonical_artist_id: string | null;
  artwork_url: string | null;
  track_slug: string | null;
  artist_slug: string | null;
  rank: number;
  previous_rank: number | null;
  movement: Movement;
  source_score: number;
  cross_source_bonus: number;
  overlap_bonus: number;
  recency_score: number;
  continuity_score: number;
  carry_forward_bonus: number;
  airplay_score: number;
  anti_gaming_penalty: number;
  total_score: number;
  eligibility_status: EligibilityStatus;
  eligibility_warnings: string[];
  overlap_bonus_capped: boolean;
  lead_artist_overflow: boolean;
  stale_carry_forward_demoted: boolean;
  airplay_detections: number | null;
  airplay_station_count: number | null;
  airplay_total_duration: number | null;
  airplay_weighted_score: number | null;
  airplay_last_detected_at: string | null;
  airplay_matched_by: string | null;
  airplay_rescue_mode: string | null;
  scoring_policy_version: string;
  methodology_version: string;
  eligibility_policy_version: string;
  source_payload: Record<string, unknown>;
  release_recency_days: number | null;
}

const SCORING_POLICY_VERSION = "1.0.1";
const METHODOLOGY_VERSION = "v1.0.1";
const ELIGIBILITY_VERSION = "v1.0";
const SOURCE_POLICY_VERSION = "v1.0";

function round4(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10000) / 10000;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000));
}

const LN = Math.log;

function collapseWhitespace(text: string): string {
  return text.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ").trim();
}

function stripBracketedContent(text: string): string {
  let r = text;
  r = r.replace(/\([^)]*\)/g, " ");
  r = r.replace(/\[[^\]]*\]/g, " ");
  r = r.replace(/\{[^}]*\}/g, " ");
  return r;
}

const FEAT_RE = /\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)/gi;

function normalizeCore(text: string): string {
  if (!text || !text.trim()) return "";
  let r = text.normalize("NFKD").toLowerCase();
  r = stripBracketedContent(r);
  r = r.replace(FEAT_RE, " ");
  r = r.replace(/\s+x\s+/gi, " ").replace(/\s+&\s+/g, " ");
  r = r.replace(/[\u2010-\u2015\u2212]/g, " ");
  r = r.replace(/[-–—‒―•·‧]/g, " ");
  r = r.replace(/[\/\\|]/g, " ");
  r = r.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷]/g, " ");
  return collapseWhitespace(r);
}

function leadArtistKey(artistLine: string): string {
  if (!artistLine?.trim()) return "";
  let extracted = artistLine;
  const featSplit = extracted.split(/\s+(?:feat\.|ft\.|featuring)\s+/i);
  if (featSplit.length > 1) extracted = featSplit[0];
  const collabSplit = extracted.split(/\s+(?:x|&)\s+/i);
  if (collabSplit.length > 1) extracted = collabSplit[0];
  const commaSplit = extracted.split(/\s*,\s*/);
  extracted = commaSplit[0];
  return normalizeCore(extracted);
}

function buildNormalizedKey(title: string, artistLine: string): string {
  const nt = normalizeCore(title);
  const lk = leadArtistKey(artistLine);
  if (!nt || !lk) return "";
  return `${nt}::${lk}`;
}

function sourceScore(sourceCount: number): number {
  return round4(Math.min(72, sourceCount * 24));
}

const CS_PER_EXTRA: Record<string, number> = { off: 0, standard: 6, strong: 10 };
const CS_CAP: Record<string, number> = { off: 0, standard: 18, strong: 30 };

function crossSourceBonus(sourceCount: number, mode: string, weight: number): number {
  if (sourceCount <= 1) return 0;
  const extra = sourceCount - 1;
  const per = CS_PER_EXTRA[mode] ?? 6;
  const cap = CS_CAP[mode] ?? 18;
  return round4(Math.min(cap, extra * per) * weight);
}

function overlapBonus(occurrenceCount: number, sourceCount: number, cap: number): number {
  const extra = occurrenceCount - sourceCount;
  if (extra <= 0) return 0;
  return round4(Math.min(cap, extra * 2));
}

function recencyScore(releaseDate: string | null, editionDate: string): number {
  if (!releaseDate) return 0;
  const age = daysBetween(releaseDate, editionDate);
  if (age === null) return 0;
  if (age <= 7) return 18;
  if (age <= 30) return 12;
  if (age <= 90) return 8;
  if (age <= 180) return 4;
  return 0;
}

function continuityScore(prevPosition: number | null, weight: number): number {
  if (prevPosition === null || prevPosition <= 0) return 0;
  return round4(Math.max(4, 18 - Math.min(14, prevPosition - 1)) * weight);
}

function carryForwardBonus(prevPosition: number | null, weight: number, isCFO: boolean): number {
  if (!isCFO || prevPosition === null || prevPosition <= 0) return 0;
  return round4(Math.max(8, 18 - Math.min(10, prevPosition - 1)) * weight);
}

function airplayScore(context: AirplayContext | null, config: ScoringConfig): number {
  if (!context || !config.airplay_enabled) return 0;
  if (context.station_count < (config.airplay_min_stations ?? 1)) return 0;
  if (context.detection_count < (config.airplay_min_detections ?? 1)) return 0;
  const lnTerm = LN(1 + context.W) * 4.25;
  const stationBonus = context.station_count * 2.0;
  const detectionBonus = context.detection_count * 0.5;
  const maxScore = config.airplay_max_score ?? 24;
  const weight = config.airplay_weight ?? 1.0;
  return round4(clamp((lnTerm + stationBonus + detectionBonus) * weight, 0, maxScore));
}

interface ProvisionalBreakdown {
  source_score: number;
  cross_source_bonus: number;
  overlap_bonus: number;
  recency_score: number;
  continuity_score: number;
  carry_forward_bonus: number;
  airplay_score: number;
  anti_gaming_penalty: number;
  total_score: number;
  overlap_bonus_capped: boolean;
  release_recency_days: number | null;
}

function scoreEvidenceRow(
  row: ScoringInputRow,
  previousEdition: PreviousEditionEntry[],
  airplayContext: AirplayContext | null,
  config: ScoringConfig,
  editionDate: string,
): ProvisionalBreakdown {
  const prevEntry = previousEdition.find((p) => p.normalized_key === row.normalized_key) ?? null;
  const prevPosition = prevEntry?.position ?? null;
  const releaseRecencyDays = row.release_date ? daysBetween(row.release_date, editionDate) : null;

  const src = sourceScore(row.source_count);
  const cross = crossSourceBonus(row.source_count, config.cross_source_mode, config.cross_source_weight);
  const overlapRaw = (row.occurrence_count - row.source_count) * 2;
  const overlapCap = config.anti_gaming_overlap_bonus_cap ?? 10;
  const overlap = overlapBonus(row.occurrence_count, row.source_count, overlapCap);
  const recency = recencyScore(row.release_date, editionDate);
  const continuity = continuityScore(prevPosition, config.continuity_weight);
  const carryFwd = carryForwardBonus(prevPosition, config.carry_forward_weight, row.carry_forward_only);
  const airplay = airplayScore(airplayContext, config);
  const total = round4(src + cross + overlap + recency + continuity + carryFwd + airplay);

  return {
    source_score: src, cross_source_bonus: cross, overlap_bonus: overlap,
    recency_score: recency, continuity_score: continuity, carry_forward_bonus: carryFwd,
    airplay_score: airplay, anti_gaming_penalty: 0, total_score: total,
    overlap_bonus_capped: overlapRaw > overlapCap, release_recency_days: releaseRecencyDays,
  };
}

interface ScoredTrack {
  normalized_key: string;
  lead_artist_key: string;
  provisional: ProvisionalBreakdown;
  final_total: number;
  anti_gaming_penalty: number;
  lead_artist_overflow: boolean;
  overflow_index: number;
}

function computeAntiGamingPenalties(
  tracks: Array<{ normalized_key: string; lead_artist_key: string; provisional_total: number }>,
  config: ScoringConfig,
): Map<string, { penalty: number; overflow: boolean; overflowIndex: number }> {
  const maxTracks = config.anti_gaming_max_tracks_per_lead_artist ?? 3;
  const overflowPenalty = config.anti_gaming_artist_overflow_penalty ?? 8;
  const result = new Map<string, { penalty: number; overflow: boolean; overflowIndex: number }>();

  if (tracks.length === 0) return result;

  const groups = new Map<string, typeof tracks>();
  for (const t of tracks) {
    const key = t.lead_artist_key || "__unknown__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  for (const [, group] of groups) {
    if (group.length <= maxTracks) {
      for (const t of group) result.set(t.normalized_key, { penalty: 0, overflow: false, overflowIndex: 0 });
      continue;
    }
    const sorted = [...group].sort((a, b) => b.provisional_total - a.provisional_total);
    for (let i = 0; i < sorted.length; i++) {
      if (i < maxTracks) {
        result.set(sorted[i].normalized_key, { penalty: 0, overflow: false, overflowIndex: 0 });
      } else {
        const oi = i - maxTracks + 1;
        result.set(sorted[i].normalized_key, { penalty: round4(oi * overflowPenalty), overflow: true, overflowIndex: oi });
      }
    }
  }
  return result;
}

function applyAntiGamingAndFinalize(
  scored: Array<{ normalized_key: string; lead_artist_key: string; provisional_breakdown: ProvisionalBreakdown }>,
  config: ScoringConfig,
): ScoredTrack[] {
  const inputs = scored.map((s) => ({
    normalized_key: s.normalized_key,
    lead_artist_key: s.lead_artist_key,
    provisional_total: s.provisional_breakdown.total_score,
  }));
  const penalties = computeAntiGamingPenalties(inputs, config);
  return scored.map((s) => {
    const p = penalties.get(s.normalized_key) ?? { penalty: 0, overflow: false, overflowIndex: 0 };
    return {
      normalized_key: s.normalized_key,
      lead_artist_key: s.lead_artist_key,
      provisional: s.provisional_breakdown,
      final_total: round4(s.provisional_breakdown.total_score - p.penalty),
      anti_gaming_penalty: p.penalty,
      lead_artist_overflow: p.overflow,
      overflow_index: p.overflowIndex,
    };
  });
}

function buildAirplayContextMap(
  buckets: AirplayEvidenceBucket[],
  rescueMode: AirplayRescueMode,
): Map<string, AirplayContext> {
  const map = new Map<string, AirplayContext>();
  if (buckets.length === 0) return map;

  const keyGroups = new Map<string, AirplayEvidenceBucket[]>();
  for (const b of buckets) {
    const key = b.normalized_key || b.canonical_track_id || "__unmatched__";
    if (!keyGroups.has(key)) keyGroups.set(key, []);
    keyGroups.get(key)!.push(b);
  }

  for (const [key, group] of keyGroups) {
    let W = 0, totalDuration = 0, totalDetections = 0;
    let lastDetected: string | null = null;
    const stationSet = new Set<string>();

    for (const b of group) {
      W += b.weighted_score;
      totalDuration += b.total_played_duration;
      totalDetections += b.detection_count;
      stationSet.add(b.station_id);
      if (!lastDetected || b.week_start > lastDetected) lastDetected = b.week_start;
    }

    const cti = group.find((b) => b.canonical_track_id)?.canonical_track_id ?? null;

    map.set(key, {
      normalized_key: key,
      canonical_track_id: cti,
      W, station_count: stationSet.size, detection_count: totalDetections,
      total_duration_seconds: totalDuration, last_detected_at: lastDetected,
      matched_by: "normalized_key", rescue_mode: rescueMode,
    });
  }

  return map;
}

function identifyAirplayRescueCandidates(
  airplayContexts: Map<string, AirplayContext>,
  existingRows: ScoringInputRow[],
  rescueMode: AirplayRescueMode,
): ScoringInputRow[] {
  if (rescueMode !== "allow_rescue" || airplayContexts.size === 0) return [];
  const hasStreaming = new Set(existingRows.map((r) => r.normalized_key));
  const candidates: ScoringInputRow[] = [];
  for (const [key, ctx] of airplayContexts) {
    if (hasStreaming.has(key) || ctx.detection_count === 0) continue;
    candidates.push({
      normalized_key: key, lead_artist_key: "", track_title: "", artist_name: "",
      source_count: 0, occurrence_count: 0, source_urls_seen: [],
      release_date: null, carry_forward_only: false, continuity_locked: false,
      airplay_candidate_only: true, canonical_track_id: ctx.canonical_track_id,
      canonical_release_id: null, canonical_artist_id: null, artwork_url: null,
      track_slug: null, artist_slug: null,
    });
  }
  return candidates;
}

function evaluateEligibility(
  row: ScoringInputRow,
  airplayContext: AirplayContext | null,
  config: ScoringConfig,
): EligibilityOutcome {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let hardExcluded = false;

  if (row.airplay_candidate_only) {
    if (!config.airplay_enabled) { reasons.push("airplay disabled"); hardExcluded = true; }
    else if (!airplayContext) { reasons.push("no airplay context"); hardExcluded = true; }
    else {
      if (airplayContext.station_count < (config.airplay_min_stations ?? 1))
        { reasons.push(`airplay stations ${airplayContext.station_count} < min`); hardExcluded = true; }
      if (airplayContext.detection_count < (config.airplay_min_detections ?? 1))
        { reasons.push(`airplay detections ${airplayContext.detection_count} < min`); hardExcluded = true; }
    }
  }

  if (!row.airplay_candidate_only && !row.carry_forward_only) {
    if (row.source_count < (config.streaming_min_sources ?? 1))
      { reasons.push(`source_count ${row.source_count} < min`); hardExcluded = true; }
  }

  if (!row.release_date && !row.carry_forward_only && !row.airplay_candidate_only)
    warnings.push("missing release_date");

  if (hardExcluded) return { status: "excluded", warnings, reasons };
  const status = warnings.length > 0 && config.missing_policy === "exclude" ? "excluded" : warnings.length > 0 ? "review" : "eligible";
  return { status, warnings, reasons };
}

// ── Artist Origin Filter (v4) ──

function parseIndividualArtistNames(artistLine: string): string[] {
  if (!artistLine || !artistLine.trim()) return [];
  const parts = artistLine.split(/\s*,\s*/);
  const names: string[] = [];
  for (const part of parts) {
    const subs = part.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i);
    for (const sub of subs) {
      const xs = sub.split(/\s+x\s+/i);
      for (const x of xs) {
        const amps = x.split(/\s+&\s+/);
        for (const a of amps) {
          const trimmed = a.trim();
          if (trimmed) names.push(trimmed);
        }
      }
    }
  }
  return names;
}

async function checkArtistOrigin(
  artistName: string,
  targetCountry: string,
  db: ReturnType<typeof createClient>,
): Promise<{ hasEligible: boolean; eligibleArtist: string | null; allOrigins: string[] }> {
  const individualNames = parseIndividualArtistNames(artistName);
  if (individualNames.length === 0) return { hasEligible: false, eligibleArtist: null, allOrigins: [] };

  const targetUpper = targetCountry.toUpperCase();
  const allOrigins: string[] = [];

  // Batch exact display_name match
  const { data: exactMatches } = await db
    .from("registry_artists")
    .select("display_name, origin_iso2")
    .in("display_name", individualNames)
    .eq("status", "active");

  const foundNames = new Set<string>();
  if (exactMatches) {
    for (const m of exactMatches) {
      const iso2 = ((m.origin_iso2 as string) || "").toUpperCase();
      allOrigins.push(`${m.display_name}:${iso2 || "unknown"}`);
      foundNames.add(((m.display_name as string) || "").toLowerCase());
      if (iso2 === targetUpper) {
        return { hasEligible: true, eligibleArtist: m.display_name as string, allOrigins };
      }
    }
  }

  // Fuzzy lookup for unresolved names
  const unresolved = individualNames.filter((n) => !foundNames.has(n.toLowerCase()));
  for (const name of unresolved) {
    const { data: fuzzy } = await db
      .from("registry_artists")
      .select("display_name, origin_iso2")
      .ilike("display_name", name)
      .eq("status", "active")
      .limit(3);
    if (fuzzy && fuzzy.length > 0) {
      const best = fuzzy.find(
        (r) => ((r.display_name as string) || "").toLowerCase() === name.toLowerCase()
      ) || fuzzy[0];
      const iso2 = ((best.origin_iso2 as string) || "").toUpperCase();
      allOrigins.push(`${best.display_name}:${iso2 || "unknown"}`);
      if (iso2 === targetUpper) {
        return { hasEligible: true, eligibleArtist: best.display_name as string, allOrigins };
      }
    } else {
      allOrigins.push(`${name}:not_found`);
    }
  }

  return { hasEligible: false, eligibleArtist: null, allOrigins };
}

// ── Pipeline ──

interface RawEvidenceRecord {
  track_title: string;
  artist_name: string;
  source_urls: string[];
  release_date: string | null;
  canonical_track_id: string | null;
}

function buildScoringInputRows(rawEvidence: RawEvidenceRecord[]): ScoringInputRow[] {
  const keyMap = new Map<string, { sources: Set<string>; occurrences: number; record: RawEvidenceRecord }>();
  for (const rec of rawEvidence) {
    const key = buildNormalizedKey(rec.track_title, rec.artist_name);
    if (!key) continue;
    const existing = keyMap.get(key);
    if (existing) {
      for (const url of rec.source_urls) existing.sources.add(url);
      existing.occurrences += rec.source_urls.length;
      if (!existing.record.release_date && rec.release_date) existing.record = rec;
    } else {
      keyMap.set(key, { sources: new Set(rec.source_urls), occurrences: rec.source_urls.length, record: rec });
    }
  }
  return [...keyMap.entries()].map(([key, agg]) => ({
    normalized_key: key, lead_artist_key: key.split("::")[1] ?? "",
    track_title: agg.record.track_title, artist_name: agg.record.artist_name,
    source_count: agg.sources.size, occurrence_count: agg.occurrences,
    source_urls_seen: [...agg.sources], release_date: agg.record.release_date,
    carry_forward_only: false, continuity_locked: false, airplay_candidate_only: false,
    canonical_track_id: agg.record.canonical_track_id, canonical_release_id: null,
    canonical_artist_id: null, artwork_url: null, track_slug: null, artist_slug: null,
  }));
}

function carryForwardMerge(
  freshRows: ScoringInputRow[],
  previousEdition: PreviousEditionEntry[],
  prevMeta: Map<string, { track_title: string; artist_name: string }>,
): ScoringInputRow[] {
  const freshKeys = new Set(freshRows.map((r) => r.normalized_key));
  const merged = [...freshRows];
  for (const prev of previousEdition) {
    if (freshKeys.has(prev.normalized_key)) continue;
    const meta = prevMeta.get(prev.normalized_key);
    merged.push({
      normalized_key: prev.normalized_key,
      lead_artist_key: prev.normalized_key.split("::")[1] ?? "",
      track_title: meta?.track_title ?? "", artist_name: meta?.artist_name ?? "",
      source_count: 0, occurrence_count: 0, source_urls_seen: [], release_date: null,
      carry_forward_only: true, continuity_locked: false, airplay_candidate_only: false,
      canonical_track_id: null, canonical_release_id: null, canonical_artist_id: null,
      artwork_url: null, track_slug: null, artist_slug: null,
    });
  }
  return merged;
}

function classifyMovement(
  currentRank: number, previousRank: number | null,
  previousEdition: PreviousEditionEntry[], normalizedKey: string,
): Movement {
  if (previousRank === null) return previousEdition.some((p) => p.normalized_key === normalizedKey) ? "reentry" : "new";
  if (currentRank === previousRank) return "same";
  return currentRank < previousRank ? "up" : "down";
}

interface PipelineResult {
  scoredRows: ScoredRow[];
  excludedCount: number;
  originExcludedCount: number;
  summary: Record<string, number>;
}

async function runFullPipeline(
  rawEvidence: RawEvidenceRecord[],
  airplayBuckets: AirplayEvidenceBucket[],
  previousEdition: PreviousEditionEntry[],
  prevMeta: Map<string, { track_title: string; artist_name: string }>,
  config: ScoringConfig,
  editionDate: string,
  targetCountry: string | null,
  db: ReturnType<typeof createClient> | null,
): Promise<PipelineResult> {
  let inputRows = buildScoringInputRows(rawEvidence);

  const rescueMode: AirplayRescueMode = config.airplay_rescue_mode ?? "allow_rescue";
  const airplayContexts = buildAirplayContextMap(airplayBuckets, rescueMode);

  let rescueCount = 0;
  if (config.airplay_enabled && rescueMode === "allow_rescue") {
    const rescues = identifyAirplayRescueCandidates(airplayContexts, inputRows, rescueMode);
    inputRows = [...inputRows, ...rescues];
    rescueCount = rescues.length;
  }

  const merged = carryForwardMerge(inputRows, previousEdition, prevMeta);
  const cfCount = merged.filter((r) => r.carry_forward_only).length;

  const eligible: ScoringInputRow[] = [];
  let originExcludedCount = 0;

  for (const row of merged) {
    const ctx = airplayContexts.get(row.normalized_key) ?? null;
    const outcome = evaluateEligibility(row, ctx, config);
    if (outcome.status === "excluded") continue;

    // ── Artist origin filter (v4) ──
    if (targetCountry && db && row.artist_name) {
      const originCheck = await checkArtistOrigin(row.artist_name, targetCountry, db);
      if (!originCheck.hasEligible) {
        originExcludedCount++;
        continue;
      }
    }

    eligible.push(row);
  }

  const provisionals = eligible.map((row) => {
    const ctx = airplayContexts.get(row.normalized_key) ?? null;
    const bd = scoreEvidenceRow(row, previousEdition, ctx, config, editionDate);
    return { normalized_key: row.normalized_key, lead_artist_key: row.lead_artist_key, provisional_breakdown: bd };
  });

  const finalized = applyAntiGamingAndFinalize(provisionals, config);
  finalized.sort((a, b) => b.final_total - a.final_total);

  const chartSize = config.chart_size ?? 20;
  const shortlist = finalized.slice(0, chartSize);

  const eligibleMap = new Map(eligible.map((r) => [r.normalized_key, r]));
  const prevMap = new Map(previousEdition.map((p) => [p.normalized_key, p.position]));

  const scoredRows: ScoredRow[] = shortlist.map((scored, i) => {
    const rank = i + 1;
    const orig = eligibleMap.get(scored.normalized_key);
    const prevRank = prevMap.get(scored.normalized_key) ?? null;
    const movement = classifyMovement(rank, prevRank, previousEdition, scored.normalized_key);
    const ctx = airplayContexts.get(scored.normalized_key) ?? null;
    const b = scored.provisional;

    const sp: Record<string, unknown> = {
      score_breakdown: {
        source_score: b.source_score, cross_source_bonus: b.cross_source_bonus,
        overlap_bonus: b.overlap_bonus, recency_score: b.recency_score,
        continuity_score: b.continuity_score, carry_forward_bonus: b.carry_forward_bonus,
        airplay_score: b.airplay_score, anti_gaming_penalty: scored.anti_gaming_penalty,
        total_score: scored.final_total,
      },
      anti_gaming: {
        overlap_bonus_capped: b.overlap_bonus_capped,
        lead_artist_overflow: scored.lead_artist_overflow,
        overflow_index: scored.overflow_index,
        stale_carry_forward_demoted: false,
      },
      airplay_detail: ctx ? {
        normalized_key: ctx.normalized_key,
        canonical_track_id: ctx.canonical_track_id,
        W: ctx.W,
        station_count: ctx.station_count,
        detection_count: ctx.detection_count,
        total_duration_seconds: ctx.total_duration_seconds,
        last_detected_at: ctx.last_detected_at,
        matched_by: ctx.matched_by,
        rescue_mode: ctx.rescue_mode,
      } : null,
      eligibility: { status: "eligible", warnings: [], reasons: [] },
      source_urls_seen: orig?.source_urls_seen ?? [],
      inputs: {
        source_count: orig?.source_count ?? 0, occurrence_count: orig?.occurrence_count ?? 0,
        release_date: orig?.release_date ?? null, release_recency_days: b.release_recency_days,
        previous_position: prevRank, carry_forward_only: orig?.carry_forward_only ?? false,
        continuity_locked: false, airplay_candidate_only: orig?.airplay_candidate_only ?? false,
      },
    };

    return {
      normalized_key: scored.normalized_key, lead_artist_key: scored.lead_artist_key,
      track_title: orig?.track_title ?? "", artist_name: orig?.artist_name ?? "",
      source_count: orig?.source_count ?? 0, occurrence_count: orig?.occurrence_count ?? 0,
      source_urls_seen: orig?.source_urls_seen ?? [], release_date: orig?.release_date ?? null,
      carry_forward_only: orig?.carry_forward_only ?? false, continuity_locked: false,
      airplay_candidate_only: orig?.airplay_candidate_only ?? false,
      canonical_track_id: orig?.canonical_track_id ?? null,
      canonical_release_id: null, canonical_artist_id: null,
      artwork_url: null, track_slug: null, artist_slug: null,
      rank, previous_rank: prevRank, movement,
      source_score: b.source_score, cross_source_bonus: b.cross_source_bonus,
      overlap_bonus: b.overlap_bonus, recency_score: b.recency_score,
      continuity_score: b.continuity_score, carry_forward_bonus: b.carry_forward_bonus,
      airplay_score: b.airplay_score, anti_gaming_penalty: scored.anti_gaming_penalty,
      total_score: scored.final_total,
      eligibility_status: "eligible", eligibility_warnings: [],
      overlap_bonus_capped: b.overlap_bonus_capped,
      lead_artist_overflow: scored.lead_artist_overflow,
      stale_carry_forward_demoted: false,
      airplay_detections: ctx?.detection_count ?? null,
      airplay_station_count: ctx?.station_count ?? null,
      airplay_total_duration: ctx?.total_duration_seconds ?? null,
      airplay_weighted_score: ctx?.W ?? null,
      airplay_last_detected_at: ctx?.last_detected_at ?? null,
      airplay_matched_by: ctx?.matched_by ?? null,
      airplay_rescue_mode: ctx?.rescue_mode ?? null,
      scoring_policy_version: SCORING_POLICY_VERSION,
      methodology_version: METHODOLOGY_VERSION,
      eligibility_policy_version: ELIGIBILITY_VERSION,
      source_payload: sp,
      release_recency_days: b.release_recency_days,
    };
  });

  return {
    scoredRows,
    excludedCount: 0,
    originExcludedCount,
    summary: {
      total_input: rawEvidence.length,
      eligible: eligible.length,
      carry_forward: cfCount,
      airplay_rescue: rescueCount,
      origin_excluded: originExcludedCount,
      chart_size: chartSize,
      new_entries: scoredRows.filter((r) => r.movement === "new").length,
      re_entries: scoredRows.filter((r) => r.movement === "reentry").length,
    },
  };
}

// ── Request Handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase service role key missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { program_id, edition_date } = body;

    if (!program_id || !edition_date) {
      return new Response(JSON.stringify({ error: "program_id and edition_date are required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: program, error: progErr } = await supabase
      .from("wk_chart_programs_v2").select("*").eq("id", program_id).maybeSingle();

    if (progErr || !program) {
      return new Response(JSON.stringify({ error: `Program not found: ${progErr?.message ?? "unknown"}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config: ScoringConfig = {
      chart_size: program.chart_size ?? 20,
      streaming_min_sources: program.streaming_min_sources ?? 1,
      cross_source_mode: (program.cross_source_mode as CrossSourceMode) ?? "standard",
      cross_source_weight: Number(program.cross_source_weight ?? 1),
      continuity_weight: Number(program.continuity_weight ?? 1),
      carry_forward_weight: Number(program.carry_forward_weight ?? 1),
      airplay_enabled: program.airplay_enabled ?? false,
      airplay_station_scope: (program.airplay_station_scope as AirplayStationScope) ?? "all",
      airplay_min_duration: program.airplay_min_duration ?? 20,
      airplay_weight: Number(program.airplay_weight ?? 1),
      airplay_min_stations: program.airplay_min_stations ?? 1,
      airplay_min_detections: program.airplay_min_detections ?? 1,
      airplay_max_score: Number(program.airplay_max_score ?? 24),
      airplay_rescue_mode: (program.airplay_rescue_mode as AirplayRescueMode) ?? "allow_rescue",
      anti_gaming_max_tracks_per_lead_artist: program.anti_gaming_max_tracks_per_lead_artist ?? 3,
      anti_gaming_overlap_bonus_cap: program.anti_gaming_overlap_bonus_cap ?? 10,
      anti_gaming_artist_overflow_penalty: Number(program.anti_gaming_artist_overflow_penalty ?? 8),
      anti_gaming_demote_carry_forward_without_current: program.anti_gaming_demote_carry_forward_without_current ?? false,
      missing_policy: (program.missing_policy as MissingPolicy) ?? "review",
      override_mode: (program.override_mode as OverrideMode) ?? "metadata_and_matching_only",
    };

    // Extract target country from program's market_slug
    const marketSlug = (program.market_slug as string) || "";
    const targetCountry = marketSlug.toUpperCase() || null;

    const { data: run, error: runErr } = await supabase
      .from("wk_chart_scoring_runs")
      .insert({
        program_id,
        edition_date,
        status: "running",
        scoring_policy_version: SCORING_POLICY_VERSION,
        methodology_version: METHODOLOGY_VERSION,
        source_policy_version: SOURCE_POLICY_VERSION,
        eligibility_policy_version: ELIGIBILITY_VERSION,
        rule_set_snapshot: config,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runErr || !run) {
      return new Response(JSON.stringify({ error: `Failed to create scoring run: ${runErr?.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runId = run.id;

    try {
      const { data: stagingRows, error: stagingErr } = await supabase
        .from("wk_import_staging_records")
        .select("title, raw_record, mapped_record, source_url, target_slug")
        .eq("target_entity", "chart_entries")
        .eq("target_status", "ready")
        .order("published_at", { ascending: false })
        .limit(500);

      if (stagingErr) throw new Error(`Staging fetch failed: ${stagingErr.message}`);

      let airplayBuckets: AirplayEvidenceBucket[] = [];
      if (config.airplay_enabled) {
        const { data: airplayRows, error: airplayErr } = await supabase
          .from("airplay_evidence_weekly")
          .select("*")
          .eq("edition_date", editionDate);

        if (!airplayErr && airplayRows) {
          airplayBuckets = airplayRows.map((r: Record<string, unknown>) => ({
            canonical_track_id: String(r.canonical_track_id ?? ""),
            normalized_key: String(r.normalized_key ?? ""),
            station_id: String(r.source_id ?? ""),
            station_weight: Number(r.station_weight ?? 1),
            week_start: String(r.week_start ?? ""),
            detection_count: Number(r.detection_count ?? 0),
            total_played_duration: Number(r.total_played_duration_seconds ?? 0),
            weighted_score: Number(r.weighted_score ?? 0),
          }));
        }
      }

      const { data: prevEdition, error: prevErr } = await supabase
        .from("wk_chart_editions_v2")
        .select("id")
        .eq("program_id", program_id)
        .lt("edition_date", edition_date)
        .order("edition_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      let previousEdition: PreviousEditionEntry[] = [];
      let prevMeta = new Map<string, { track_title: string; artist_name: string }>();

      if (prevEdition && !prevErr) {
        const { data: prevEntries } = await supabase
          .from("wk_chart_entries_v2")
          .select("normalized_key, rank, track_title, artist_name")
          .eq("edition_id", prevEdition.id)
          .order("rank", { ascending: true });

        if (prevEntries) {
          previousEdition = prevEntries.map((e: Record<string, unknown>) => ({
            normalized_key: String(e.normalized_key ?? ""),
            position: Number(e.rank ?? 0),
          }));
          for (const e of prevEntries as Array<Record<string, unknown>>) {
            prevMeta.set(String(e.normalized_key ?? ""), {
              track_title: String(e.track_title ?? ""),
              artist_name: String(e.artist_name ?? ""),
            });
          }
        }
      }

      const rawEvidence: RawEvidenceRecord[] = (stagingRows ?? []).map((sr: Record<string, unknown>) => {
        const rawRec = (sr.raw_record ?? {}) as Record<string, unknown>;
        const mappedRec = (sr.mapped_record ?? {}) as Record<string, unknown>;
        return {
          track_title: String(sr.title ?? rawRec.title ?? ""),
          artist_name: String(rawRec.artist_name ?? mappedRec.artist_name ?? ""),
          source_urls: [String(sr.source_url ?? rawRec.source_url ?? "")].filter(Boolean),
          release_date: String(rawRec.release_date ?? mappedRec.release_date ?? "").slice(0, 10) || null,
          canonical_track_id: String(sr.target_slug ?? "").startsWith("track-") ? String(sr.target_slug) : null,
        };
      }).filter((r: RawEvidenceRecord) => r.track_title);

      const result = await runFullPipeline(rawEvidence, airplayBuckets, previousEdition, prevMeta, config, editionDate, targetCountry, supabase);

      const editionSlug = `${program.public_slug ?? "chart"}-${editionDate}`;
      const editionLabel = `${program.public_label ?? "Chart"} — ${editionDate}`;

      const { data: edition, error: editionErr } = await supabase
        .from("wk_chart_editions_v2")
        .upsert({
          program_id,
          edition_slug: editionSlug,
          edition_label: editionLabel,
          edition_date: editionDate,
          period_start: editionDate,
          period_end: editionDate,
          entry_count: result.scoredRows.length,
          status: "draft",
          methodology_version: METHODOLOGY_VERSION,
          source_policy_version: SOURCE_POLICY_VERSION,
          eligibility_policy_version: ELIGIBILITY_VERSION,
          scoring_policy_version: SCORING_POLICY_VERSION,
          rule_set_snapshot: config,
          chart_size: config.chart_size,
          carry_forward_count: result.summary.carry_forward as number,
          new_entries_count: result.summary.new_entries as number,
          re_entries_count: result.summary.re_entries as number,
          exclusion_summary: { origin_excluded: result.originExcludedCount },
          override_mode: config.override_mode,
        }, { onConflict: "program_id,edition_date" })
        .select("id")
        .single();

      if (editionErr || !edition) throw new Error(`Edition upsert failed: ${editionErr?.message}`);

      await supabase.from("wk_chart_entries_v2").delete().eq("edition_id", edition.id);

      const entryRows = result.scoredRows.map((row) => ({
        edition_id: edition.id,
        rank: row.rank,
        previous_rank: row.previous_rank,
        movement: row.movement,
        track_slug: row.track_slug,
        track_title: row.track_title,
        artist_slug: row.artist_slug,
        artist_name: row.artist_name,
        artwork_url: row.artwork_url,
        normalized_key: row.normalized_key,
        lead_artist_key: row.lead_artist_key,
        source_count: row.source_count,
        occurrence_count: row.occurrence_count,
        source_urls_seen: row.source_urls_seen,
        release_date: row.release_date,
        release_recency_days: row.release_recency_days,
        canonical_track_id: row.canonical_track_id,
        canonical_release_id: row.canonical_release_id,
        canonical_artist_id: row.canonical_artist_id,
        source_score: row.source_score,
        cross_source_bonus: row.cross_source_bonus,
        overlap_bonus: row.overlap_bonus,
        recency_score: row.recency_score,
        continuity_score: row.continuity_score,
        carry_forward_bonus: row.carry_forward_bonus,
        airplay_score: row.airplay_score,
        anti_gaming_penalty: row.anti_gaming_penalty,
        total_score: row.total_score,
        carry_forward_only: row.carry_forward_only,
        continuity_locked: row.continuity_locked,
        airplay_candidate_only: row.airplay_candidate_only,
        overlap_bonus_capped: row.overlap_bonus_capped,
        lead_artist_overflow: row.lead_artist_overflow,
        stale_carry_forward_demoted: row.stale_carry_forward_demoted,
        eligibility_status: row.eligibility_status,
        eligibility_warnings: row.eligibility_warnings,
        source_payload: row.source_payload,
        scoring_policy_version: row.scoring_policy_version,
        methodology_version: row.methodology_version,
        eligibility_policy_version: row.eligibility_policy_version,
        airplay_detections: row.airplay_detections,
        airplay_station_count: row.airplay_station_count,
        airplay_total_duration: row.airplay_total_duration,
        airplay_weighted_score: row.airplay_weighted_score,
        airplay_last_detected_at: row.airplay_last_detected_at,
        airplay_matched_by: row.airplay_matched_by,
        airplay_rescue_mode: row.airplay_rescue_mode,
      }));

      const BATCH = 50;
      for (let i = 0; i < entryRows.length; i += BATCH) {
        const batch = entryRows.slice(i, i + BATCH);
        const { error: insertErr } = await supabase.from("wk_chart_entries_v2").insert(batch);
        if (insertErr) throw new Error(`Entry insert batch ${i} failed: ${insertErr.message}`);
      }

      await supabase.from("wk_chart_scoring_runs").update({
        status: "completed",
        total_rows: rawEvidence.length,
        eligible_rows: result.summary.eligible as number,
        excluded_rows: result.excludedCount + result.originExcludedCount,
        carry_forward_rows: result.summary.carry_forward as number,
        airplay_rescue_rows: result.summary.airplay_rescue as number,
        source_urls: [...new Set(rawEvidence.flatMap((r) => r.source_urls))],
        completed_at: new Date().toISOString(),
      }).eq("id", runId);

      return new Response(JSON.stringify({
        success: true,
        run_id: runId,
        edition_id: edition.id,
        edition_slug: editionSlug,
        target_country: targetCountry,
        origin_excluded: result.originExcludedCount,
        summary: result.summary,
        top5: result.scoredRows.slice(0, 5).map((r) => ({
          rank: r.rank, title: r.track_title, artist: r.artist_name, score: r.total_score,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (pipelineErr) {
      const errMsg = pipelineErr instanceof Error ? pipelineErr.message : "Unknown pipeline error";
      await supabase.from("wk_chart_scoring_runs").update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);

      throw pipelineErr;
    }

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
