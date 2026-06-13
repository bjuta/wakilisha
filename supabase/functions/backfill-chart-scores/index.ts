/**
 * WAKILISHA Chart Score Backfill
 * Supabase Edge Function — recomputes scoring for already-imported editions
 *
 * Reads entries from wk_chart_entries_v2, reconstructs scoring inputs,
 * runs the full §2 pipeline chronologically per program, and writes back
 * scores, movement, eligibility flags, and edition summaries.
 *
 * Also backfills lead_artist_key for legacy entries where it's null.
 *
 * Accepts: { program_id? } — omit to backfill all programs
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════════
// TYPES (mirrors scoring pipeline)
// ════════════════════════════════════════════════════════════════

type CrossSourceMode = "off" | "standard" | "strong";
type AirplayRescueMode = "allow_rescue" | "strengthen_only";
type MissingPolicy = "review" | "exclude";
type Movement = "up" | "down" | "same" | "new" | "reentry" | null;

interface ScoringConfig {
  chart_size: number;
  streaming_min_sources: number;
  cross_source_mode: CrossSourceMode;
  cross_source_weight: number;
  continuity_weight: number;
  carry_forward_weight: number;
  airplay_enabled: boolean;
  airplay_station_scope: string;
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
}

interface PreviousEditionEntry {
  normalized_key: string;
  position: number;
}

interface ProvisionalBreakdown {
  source_score: number;
  cross_source_bonus: number;
  overlap_bonus: number;
  recency_score: number;
  continuity_score: number;
  carry_forward_bonus: number;
  airplay_score: number;
  total_score: number;
  overlap_bonus_capped: boolean;
  release_recency_days: number | null;
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

const SCORING_POLICY_VERSION = "1.0.1";
const METHODOLOGY_VERSION = "v1.0.1";
const ELIGIBILITY_VERSION = "v1.0";

// ════════════════════════════════════════════════════════════════
// MATH HELPERS
// ════════════════════════════════════════════════════════════════

function round4(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10000) / 10000;
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000));
}

// ════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ════════════════════════════════════════════════════════════════

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

function scoreEvidenceRow(
  row: ScoringInputRow,
  previousEdition: PreviousEditionEntry[],
  config: ScoringConfig,
  editionDate: string,
): ProvisionalBreakdown {
  const prevEntry = previousEdition.find((p) => p.normalized_key === row.normalized_key) ?? null;
  const prevPosition = prevEntry?.position ?? null;
  const releaseRecencyDays = row.release_date ? daysBetween(row.release_date, editionDate) : null;

  const src = sourceScore(row.source_count);
  const cross = crossSourceBonus(row.source_count, config.cross_source_mode, config.cross_source_weight);
  const overlapCap = config.anti_gaming_overlap_bonus_cap ?? 10;
  const overlapRaw = (row.occurrence_count - row.source_count) * 2;
  const overlap = overlapBonus(row.occurrence_count, row.source_count, overlapCap);
  const recency = recencyScore(row.release_date, editionDate);
  const continuity = continuityScore(prevPosition, config.continuity_weight);
  const carryFwd = carryForwardBonus(prevPosition, config.carry_forward_weight, row.carry_forward_only);
  const total = round4(src + cross + overlap + recency + continuity + carryFwd);

  return {
    source_score: src, cross_source_bonus: cross, overlap_bonus: overlap,
    recency_score: recency, continuity_score: continuity, carry_forward_bonus: carryFwd,
    airplay_score: 0, total_score: total,
    overlap_bonus_capped: overlapRaw > overlapCap, release_recency_days: releaseRecencyDays,
  };
}

// ════════════════════════════════════════════════════════════════
// ANTI-GAMING (§3.3) — groups by lead_artist_key, caps per-artist
// tracks, applies overflow penalty to excess tracks.
// ════════════════════════════════════════════════════════════════

function applyAntiGamingAndFinalize(
  scored: Array<{ normalized_key: string; lead_artist_key: string; provisional_breakdown: ProvisionalBreakdown }>,
  config: ScoringConfig,
): ScoredTrack[] {
  const maxTracks = config.anti_gaming_max_tracks_per_lead_artist ?? 3;
  const overflowPenalty = config.anti_gaming_artist_overflow_penalty ?? 8;

  const groups = new Map<string, typeof scored>();
  for (const s of scored) {
    // When lead_artist_key is empty, derive from normalized_key (last segment)
    // so every null-keyed track gets its own unique anti-gaming group
    const key = s.lead_artist_key || s.normalized_key.split("::")[1] || `__anon__${s.normalized_key}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const penalties = new Map<string, { penalty: number; overflow: boolean; overflowIndex: number }>();

  for (const [, group] of groups) {
    if (group.length <= maxTracks) {
      for (const t of group) penalties.set(t.normalized_key, { penalty: 0, overflow: false, overflowIndex: 0 });
      continue;
    }
    const sorted = [...group].sort((a, b) => b.provisional_breakdown.total_score - a.provisional_breakdown.total_score);
    for (let i = 0; i < sorted.length; i++) {
      if (i < maxTracks) {
        penalties.set(sorted[i].normalized_key, { penalty: 0, overflow: false, overflowIndex: 0 });
      } else {
        const oi = i - maxTracks + 1;
        penalties.set(sorted[i].normalized_key, { penalty: round4(oi * overflowPenalty), overflow: true, overflowIndex: oi });
      }
    }
  }

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

// ════════════════════════════════════════════════════════════════
// MOVEMENT CLASSIFICATION
// ════════════════════════════════════════════════════════════════

function classifyMovement(
  currentRank: number,
  previousRank: number | null,
  previousEdition: PreviousEditionEntry[],
  normalizedKey: string,
): Movement {
  if (previousRank === null) {
    if (previousEdition.some((p) => p.normalized_key === normalizedKey)) return "reentry";
    return "new";
  }
  if (currentRank === previousRank) return "same";
  return currentRank < previousRank ? "up" : "down";
}

// ════════════════════════════════════════════════════════════════
// MAIN BACKFILL LOGIC
// ════════════════════════════════════════════════════════════════

interface BackfillEditionResult {
  edition_id: string;
  edition_date: string;
  entry_count: number;
  scored_count: number;
}

interface BackfillProgramResult {
  program_id: string;
  editions_processed: number;
  entries_updated: number;
  editions: BackfillEditionResult[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ════════════════════════════════════════════════════════════
    // STEP 0 — Backfill lead_artist_key for legacy entries where it's null
    // Legacy WP imports omitted this column; derive from normalized_key
    // which follows the format "track-title::artist-slug"
    // ════════════════════════════════════════════════════════════
    console.log("STEP 0: Backfilling lead_artist_key for null entries...");

    const { data: nullKeyRows, error: nullKeyErr } = await supabase
      .from("wk_chart_entries_v2")
      .select("id, normalized_key")
      .is("lead_artist_key", null);

    if (nullKeyErr) {
      console.error(`Failed to query null lead_artist_key entries: ${nullKeyErr.message}`);
    } else if (nullKeyRows && nullKeyRows.length > 0) {
      console.log(`Found ${nullKeyRows.length} entries with null lead_artist_key — fixing...`);

      // Batch-update in chunks of 500 to stay within payload limits
      const chunkSize = 500;
      let fixed = 0;
      for (let i = 0; i < nullKeyRows.length; i += chunkSize) {
        const chunk = nullKeyRows.slice(i, i + chunkSize);
        const updates = chunk.map((row) => ({
          id: row.id,
          lead_artist_key: (row.normalized_key as string).split("::")[1] || "",
        }));

        // Use upsert to patch just the id + lead_artist_key columns
        const { error: updateErr } = await supabase
          .from("wk_chart_entries_v2")
          .upsert(updates, { onConflict: "id" });

        if (updateErr) {
          console.error(`Chunk at offset ${i} failed: ${updateErr.message}`);
        } else {
          fixed += updates.length;
        }
      }
      console.log(`Backfilled lead_artist_key for ${fixed}/${nullKeyRows.length} entries`);
    } else {
      console.log("No null lead_artist_key entries — column is clean");
    }

    // ── Fetch programs ──
    let programIdParam: string | null = null;
    try {
      const body = await req.json();
      programIdParam = body.program_id ?? null;
    } catch {
      // no body — backfill all
    }

    let programQuery = supabase.from("wk_chart_programs_v2").select("*");
    if (programIdParam) programQuery = programQuery.eq("id", programIdParam);
    const { data: programs, error: progErr } = await programQuery;

    if (progErr) throw new Error(`Failed to fetch programs: ${progErr.message}`);
    if (!programs || programs.length === 0) {
      return new Response(JSON.stringify({ error: "No programs found." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: BackfillProgramResult[] = [];
    let totalEntriesUpdated = 0;

    for (const program of (programs as Record<string, unknown>[])) {
      const progId = String(program.id ?? "");

      // ── Build scoring config from program settings ──
      const config: ScoringConfig = {
        chart_size: Number(program.chart_size ?? 20),
        streaming_min_sources: Number(program.streaming_min_sources ?? 1),
        cross_source_mode: (program.cross_source_mode as CrossSourceMode) ?? "standard",
        cross_source_weight: Number(program.cross_source_weight ?? 1),
        continuity_weight: Number(program.continuity_weight ?? 1),
        carry_forward_weight: Number(program.carry_forward_weight ?? 1),
        airplay_enabled: false,
        airplay_station_scope: "all",
        airplay_min_duration: 20,
        airplay_weight: 1,
        airplay_min_stations: 1,
        airplay_min_detections: 1,
        airplay_max_score: 24,
        airplay_rescue_mode: "allow_rescue",
        anti_gaming_max_tracks_per_lead_artist: Number(program.anti_gaming_max_tracks_per_lead_artist ?? 3),
        anti_gaming_overlap_bonus_cap: Number(program.anti_gaming_overlap_bonus_cap ?? 10),
        anti_gaming_artist_overflow_penalty: Number(program.anti_gaming_artist_overflow_penalty ?? 8),
        anti_gaming_demote_carry_forward_without_current: false,
        missing_policy: "review",
      };

      // ── Fetch editions for this program, chronologically ──
      const { data: editions, error: edErr } = await supabase
        .from("wk_chart_editions_v2")
        .select("id, edition_date, entry_count")
        .eq("program_id", progId)
        .order("edition_date", { ascending: true });

      if (edErr) throw new Error(`Failed to fetch editions for ${progId}: ${edErr.message}`);
      if (!editions || editions.length === 0) {
        results.push({ program_id: progId, editions_processed: 0, entries_updated: 0, editions: [] });
        continue;
      }

      const editionResults: BackfillEditionResult[] = [];
      let previousEdition: PreviousEditionEntry[] = [];
      const chartSize = config.chart_size ?? 20;

      for (const edition of (editions as Record<string, unknown>[])) {
        const editionId = String(edition.id ?? "");
        const editionDate = String(edition.edition_date ?? "");

        // ── Fetch entries for this edition ──
        const { data: entries, error: entriesErr } = await supabase
          .from("wk_chart_entries_v2")
          .select("*")
          .eq("edition_id", editionId)
          .order("rank", { ascending: true });

        if (entriesErr || !entries) {
          console.error(`Failed to fetch entries for ${editionId}: ${entriesErr?.message}`);
          continue;
        }

        if (entries.length === 0) continue;

        // ── Build scoring input rows from entries ──
        // lead_artist_key is now guaranteed populated from STEP 0,
        // but keep the fallback as a safety net
        const inputRows: ScoringInputRow[] = (entries as Record<string, unknown>[]).map((e) => {
          const sourceUrls = (e.source_urls_seen as string[]) ?? [];
          const sourceCount = Number(e.source_count ?? sourceUrls.length);
          const occurrenceCount = Number(e.occurrence_count ?? sourceCount);
          const normalizedKey = String(e.normalized_key ?? "");
          const dbLeadArtistKey = String(e.lead_artist_key ?? "");
          const leadArtistKey = dbLeadArtistKey || normalizedKey.split("::")[1] || "";

          return {
            normalized_key: normalizedKey,
            lead_artist_key: leadArtistKey,
            track_title: String(e.track_title ?? ""),
            artist_name: String(e.artist_name ?? ""),
            source_count: sourceCount,
            occurrence_count: occurrenceCount,
            source_urls_seen: sourceUrls,
            release_date: e.release_date ? String(e.release_date).slice(0, 10) : null,
            carry_forward_only: false,
            continuity_locked: false,
            airplay_candidate_only: false,
            canonical_track_id: e.canonical_track_id ? String(e.canonical_track_id) : null,
          };
        });

        // ── Score each row ──
        const provisionals = inputRows.map((row) => {
          const bd = scoreEvidenceRow(row, previousEdition, config, editionDate);
          return { normalized_key: row.normalized_key, lead_artist_key: row.lead_artist_key, provisional_breakdown: bd };
        });

        const finalized = applyAntiGamingAndFinalize(provisionals, config);
        finalized.sort((a, b) => b.final_total - a.final_total);
        const shortlist = finalized.slice(0, chartSize);

        // ── Update entries ──
        const prevMap = new Map(previousEdition.map((p) => [p.normalized_key, p.position]));
        const inputMap = new Map(inputRows.map((r) => [r.normalized_key, r]));

        for (let i = 0; i < shortlist.length; i++) {
          const scored = shortlist[i];
          const rank = i + 1;
          const orig = inputMap.get(scored.normalized_key);
          const prevRank = prevMap.get(scored.normalized_key) ?? null;
          const movement = classifyMovement(rank, prevRank, previousEdition, scored.normalized_key);
          const b = scored.provisional;

          const matchEntry = (entries as Record<string, unknown>[]).find(
            (e) => String(e.normalized_key) === scored.normalized_key
          );

          if (!matchEntry?.id) continue;

          await supabase.from("wk_chart_entries_v2").update({
            rank,
            previous_rank: prevRank,
            movement,
            source_score: b.source_score,
            cross_source_bonus: b.cross_source_bonus,
            overlap_bonus: b.overlap_bonus,
            recency_score: b.recency_score,
            continuity_score: b.continuity_score,
            carry_forward_bonus: b.carry_forward_bonus,
            airplay_score: 0,
            anti_gaming_penalty: scored.anti_gaming_penalty,
            total_score: scored.final_total,
            overlap_bonus_capped: b.overlap_bonus_capped,
            lead_artist_overflow: scored.lead_artist_overflow,
            stale_carry_forward_demoted: false,
            eligibility_status: "eligible",
            eligibility_warnings: [],
            scoring_policy_version: SCORING_POLICY_VERSION,
            methodology_version: METHODOLOGY_VERSION,
            eligibility_policy_version: ELIGIBILITY_VERSION,
            source_payload: {
              score_breakdown: {
                source_score: b.source_score,
                cross_source_bonus: b.cross_source_bonus,
                overlap_bonus: b.overlap_bonus,
                recency_score: b.recency_score,
                continuity_score: b.continuity_score,
                carry_forward_bonus: b.carry_forward_bonus,
                airplay_score: 0,
                anti_gaming_penalty: scored.anti_gaming_penalty,
                total_score: scored.final_total,
              },
              anti_gaming: {
                overlap_bonus_capped: b.overlap_bonus_capped,
                lead_artist_overflow: scored.lead_artist_overflow,
                overflow_index: scored.overflow_index,
                stale_carry_forward_demoted: false,
              },
              airplay_detail: null,
              eligibility: { status: "eligible", warnings: [], reasons: [] },
              source_urls_seen: orig?.source_urls_seen ?? [],
              inputs: {
                source_count: orig?.source_count ?? 0,
                occurrence_count: orig?.occurrence_count ?? 0,
                release_date: orig?.release_date ?? null,
                release_recency_days: b.release_recency_days,
                previous_position: prevRank,
                carry_forward_only: false,
                continuity_locked: false,
                airplay_candidate_only: false,
              },
            },
            release_recency_days: b.release_recency_days,
          }).eq("id", String(matchEntry.id));
        }

        // ── Update edition summary ──
        const newEntries = shortlist.filter((s) => {
          const pk = prevMap.get(s.normalized_key);
          return pk === undefined || pk === null;
        }).length;

        const reEntries = shortlist.filter((s) => {
          const pk = prevMap.get(s.normalized_key);
          return (pk === undefined || pk === null) && previousEdition.some((p) => p.normalized_key === s.normalized_key);
        }).length;

        await supabase.from("wk_chart_editions_v2").update({
          entry_count: shortlist.length,
          new_entries_count: newEntries,
          re_entries_count: reEntries,
          scoring_policy_version: SCORING_POLICY_VERSION,
          methodology_version: METHODOLOGY_VERSION,
          eligibility_policy_version: ELIGIBILITY_VERSION,
          chart_size: chartSize,
          carry_forward_count: 0,
          updated_at: new Date().toISOString(),
        }).eq("id", editionId);

        // ── Prepare for next edition ──
        previousEdition = shortlist.map((s, idx) => ({
          normalized_key: s.normalized_key,
          position: idx + 1,
        }));

        editionResults.push({
          edition_id: editionId,
          edition_date: editionDate,
          entry_count: entries.length,
          scored_count: shortlist.length,
        });

        totalEntriesUpdated += shortlist.length;
      }

      results.push({
        program_id: progId,
        editions_processed: editionResults.length,
        entries_updated: editionResults.reduce((sum, e) => sum + e.scored_count, 0),
        editions: editionResults,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      programs_processed: results.length,
      total_entries_updated: totalEntriesUpdated,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
