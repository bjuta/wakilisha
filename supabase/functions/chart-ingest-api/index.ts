// ── SHARED BLOCK (Phase A) ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","http://localhost:5173","http://localhost:3000"];

function corsRestricted(req: Request, methods="POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".wakilisha.africa")||o==="https://wakilisha.africa"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }

function callerClient(req: Request): ReturnType<typeof createClient> {
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) throw new Error("Bearer authorization is required.");
  return createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
}

async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> {
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) return null;
  const token=authorization.replace("Bearer ","");
  const db=callerClient(req);
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user) return null;
  return {id:user.id,email:user.email};
}

async function requireCap(db: ReturnType<typeof createClient>,cap:string): Promise<boolean> {
  const {data,error}=await db.rpc("current_user_has_capability",{required_capability:cap});
  return !error&&data===true;
}

const rid=()=>crypto.randomUUID().slice(0,12);
const iso=()=>new Date().toISOString();
// ── END SHARED BLOCK ──

const ALL_STAGES = ["validate","provider_detection","resource_guard","source_fetch","raw_persist","normalize","dedupe","release_candidate_build","canonical_match","entity_resolution","eligibility_execution","airplay_evidence","airplay_rescue","carry_forward","methodology_scoring","anti_gaming","shortlist","review_gate","commit_validate","commit_write","public_verify"];

function json(req: Request, body: unknown, status = 200): Response { const cors = corsRestricted(req); return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
function safeError(req: Request, action: string, err: unknown): Response { const m = err instanceof Error ? err.message : String(err); console.error("[chart-ingest-api] "+action+" error:", m); const cors = corsRestricted(req); return new Response(JSON.stringify({ error: "internal_error", requestId: rid() }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } }); }

const ACTION_CAPABILITIES: Record<string, string> = {
  list_runs:"view_charts_admin",get_run:"view_charts_admin",get_stages:"view_charts_admin",get_sources:"view_charts_admin",get_candidates:"view_charts_admin",get_normalized:"view_charts_admin",get_kpis:"view_charts_admin",get_activity:"view_charts_admin",get_resource_guard:"view_charts_admin",get_review_issues:"view_charts_admin",get_matches_for_run:"view_charts_admin",validate_commit:"view_charts_admin",preflight:"view_charts_admin",csv_list:"view_charts_admin",get_origin_review_queue:"view_charts_admin",get_origin_country_options:"view_charts_admin",get_family_ingest_presets:"view_charts_admin",get_weekly_backfill_plan:"view_charts_admin",
  create_dry_run:"manage_ingest",source_fetch:"manage_ingest",normalize_run:"manage_ingest",run_eligibility:"manage_ingest",run_carry_forward:"manage_ingest",run_scoring:"manage_ingest",run_shortlist:"manage_ingest",run_airplay_detection:"manage_ingest",run_full_pipeline:"manage_ingest",send_gaps_to_review:"manage_ingest",apply_row_decision:"manage_ingest",cancel_run:"manage_ingest",retry_run:"manage_ingest",reset_pipeline:"manage_ingest",csv_upload:"manage_ingest",csv_normalize:"manage_ingest",set_artist_origin_for_run:"manage_registry",create_origin_artist_shell:"manage_registry",reset_after_origin_resolution:"manage_ingest",save_family_ingest_preset:"manage_ingest",commit_run:"publish_charts",fix_chart_artist_slugs:"publish_charts",reingest_edition:"publish_charts"};

Deno.serve(async (req) => {
  const cors = corsRestricted(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await verifyJwt(req);
  if (!auth) return json(req, { error: "unauthorized" }, 401);
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return json(req, { error: "invalid_json" }, 400); }
  const { action, ...params } = body as { action: string; [k: string]: unknown };
  const db=callerClient(req);
  const requiredCapability=ACTION_CAPABILITIES[action];
  if(requiredCapability){const can=await requireCap(db,requiredCapability);if(!can)return json(req,{error:"forbidden"},403);}
  try {
    if (action === "create_dry_run") return handleCreateDryRun(req, db, params, auth);
    if (action === "list_runs") return handleListRuns(req, db, params);
    if (action === "get_run") return handleGetRun(req, db, params);
    if (action === "get_stages") return handleGetStages(req, db, params);
    if (action === "get_sources") return handleGetSources(req, db, params);
    if (action === "get_candidates") return handleGetCandidates(req, db, params);
    if (action === "get_exclusions") return handleGetExclusions(req, db, params);
    if (action === "get_normalized") return handleGetNormalized(req, db, params);
    if (action === "normalize_run") return handleNormalizeRun(req, db, params, auth);
    if (action === "source_fetch") return handleSourceFetch(req, db, params, auth);
    if (action === "run_eligibility") return handleRunEligibilityWithReleaseWindow(req, db, params, auth);
    if (action === "run_carry_forward") return handleRunCarryForward(req, db, params, auth);
    if (action === "run_scoring") return handleRunScoring(req, db, params, auth);
    if (action === "run_shortlist") return handleRunShortlist(req, db, params, auth);
    if (action === "run_airplay_detection") return handleRunAirplayDetection(req, db, params, auth);
    if (action === "run_full_pipeline") return handleRunFullPipeline(req, db, params, auth);
    if (action === "cancel_run") return handleCancelRun(req, db, params, auth);
    if (action === "retry_run") return handleRetryRun(req, db, params, auth);
    if (action === "reset_pipeline") return handleResetPipeline(req, db, params, auth);
    if (action === "preflight") return handlePreflight(req, db, params);
    if (action === "get_kpis") return handleGetKpis(req, db);
    if (action === "get_activity") return handleGetActivity(req, db);
    if (action === "get_resource_guard") return handleGetResourceGuard(req, db, params);
    if (action === "send_gaps_to_review") return handleSendGapsToReview(req, db, params, auth);
    if (action === "apply_row_decision") return handleApplyRowDecision(req, db, params, auth);
    if (action === "get_review_issues") return handleGetReviewIssues(req, db, params);
    if (action === "get_matches_for_run") return handleGetMatchesForRun(req, db, params);
    if (action === "get_origin_review_queue") return handleGetOriginReviewQueue(req, db, params);
    if (action === "get_origin_country_options") return handleGetOriginCountryOptions(req, db, params);
    if (action === "get_family_ingest_presets") return handleGetFamilyIngestPresets(req, db);
    if (action === "save_family_ingest_preset") return handleSaveFamilyIngestPreset(req, db, params, auth);
    if (action === "get_weekly_backfill_plan") return handleGetWeeklyBackfillPlan(req, db, params);
    if (action === "set_artist_origin_for_run") return handleSetArtistOriginForRun(req, db, params, auth);
    if (action === "create_origin_artist_shell") return handleCreateOriginArtistShell(req, db, params, auth);
    if (action === "reset_after_origin_resolution") return handleResetAfterOriginResolution(req, db, params);
    if (action === "validate_commit") return handleValidateCommit(req, db, params);
    if (action === "commit_run") return handleCommitRun(req, db, params, auth);
    if (action === "fix_chart_artist_slugs") return handleFixChartArtistSlugs(req, db, params, auth);
    if (action === "reingest_edition") return handleReingestEdition(req, db, params, auth);
    if (action === "csv_list") return handleCsvList(req, db, params);
    return json(req, { error: "unknown_action: "+action }, 400);
  } catch (err) { return safeError(req, action, err); }
});

// ── HELPERS ──
function detectProvider(url: string): string { if (!url) return "manual"; const u = url.toLowerCase(); if (u.includes("spotify.com")) return "spotify"; if (u.includes("apple.com") || u.includes("itunes.apple")) return "apple_music"; if (u.endsWith(".csv") || u.includes("csv")) return "csv_legacy"; return "manual"; }
function collapseWhitespace(text: string): string { return text.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ").replace(/\s+/g, " ").trim(); }
function stripBracketedContent(text: string): string { let r = text; r = r.replace(/\([^)]*\)/g, " "); r = r.replace(/\[[^\]]*\]/g, " "); r = r.replace(/\{[^}]*\}/g, " "); r = r.replace(/「[^」]*」/g, " "); r = r.replace(/〈[^〉]*〉/g, " "); return r; }
const FEAT_PATTERNS = [/\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)*/gi];
function stripFeaturing(text: string): string { let r = text; for (const p of FEAT_PATTERNS) r = r.replace(p, " "); r = r.replace(/\s+x\s+/gi, " "); r = r.replace(/\s+&\s+/g, " "); r = r.replace(/\bwith\s+(?!(?:the|a\s))(?:[A-Z][^\s,;]+(?:\s+[^\s,;]+)*)/g, " "); return r; }
function normalizeCore(text: string): string { if (!text || !text.trim()) return ""; let r = text; r = r.normalize("NFKD"); r = r.toLowerCase(); r = stripBracketedContent(r); r = stripFeaturing(r); r = r.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " "); r = r.replace(/[-\u2013\u2014\u2012\u2015\u2022\u00B7\u2027]/g, " "); r = r.replace(/[\/\\|]/g, " "); r = r.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~\u00A1-\u00BF\u00D7\u00F7]/g, " "); r = collapseWhitespace(r); return r; }
function normalize_title(title: string): string { return normalizeCore(title); }
function lead_artist_key(full_artist_line: string): string { if (!full_artist_line || !full_artist_line.trim()) return ""; let extracted = full_artist_line; const featSplit = extracted.split(/\s+(?:feat\.|ft\.|featuring)\s+/i); if (featSplit.length > 1) extracted = featSplit[0]; const collabSplit = extracted.split(/\s+(?:x|&)\s+/i); if (collabSplit.length > 1) extracted = collabSplit[0]; const commaSplit = extracted.split(/\s*,\s*/); extracted = commaSplit[0]; return normalizeCore(extracted); }
function build_normalized_key(title: string, full_artist_line: string): string { const nt = normalize_title(title); const lk = lead_artist_key(full_artist_line); if (!nt || !lk) return ""; return nt+"::"+lk; }

function compactIdentityPart(value: unknown): string {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeProviderKey(value: unknown): string {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeIsrc(value: unknown): string {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function addProviderIdToBag(bag: Record<string, Set<string>>, providerRaw: unknown, idRaw: unknown): void {
  const provider = normalizeProviderKey(providerRaw);
  const id = compactIdentityPart(idRaw);
  if (!provider || !id) return;
  if (!bag[provider]) bag[provider] = new Set<string>();
  bag[provider].add(id);
}

function providerIdsJsonFromBag(bag: Record<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [provider, ids] of Object.entries(bag)) out[provider] = [...ids].sort();
  return out;
}

function mergeProviderIdsJson(values: unknown[]): Record<string, string[]> {
  const bag: Record<string, Set<string>> = {};
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [provider, idsRaw] of Object.entries(value as Record<string, unknown>)) {
      const ids = Array.isArray(idsRaw) ? idsRaw : [idsRaw];
      for (const id of ids) addProviderIdToBag(bag, provider, id);
    }
  }
  return providerIdsJsonFromBag(bag);
}

function providerIdentityMapFromRaw(row: Record<string, unknown>): Record<string, string[]> {
  const bag: Record<string, Set<string>> = {};
  addProviderIdToBag(bag, row.provider, row.provider_track_id);

  const raw = row.raw_payload_json;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const payload = raw as Record<string, unknown>;
    addProviderIdToBag(
      bag,
      payload.provider || row.provider,
      payload.songId || payload.trackId || payload.provider_track_id,
    );
  }

  return providerIdsJsonFromBag(bag);
}

function providerIdentityAliasesFromJson(value: unknown): string[] {
  const aliases: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) return aliases;

  for (const [providerRaw, idsRaw] of Object.entries(value as Record<string, unknown>)) {
    const provider = normalizeProviderKey(providerRaw);
    if (!provider) continue;

    const ids = Array.isArray(idsRaw) ? idsRaw : [idsRaw];
    for (const idRaw of ids) {
      const id = compactIdentityPart(idRaw);
      if (id) aliases.push(`provider:${provider}:${id}`);
    }
  }

  return [...new Set(aliases)].sort();
}

function rawSongStrongIdentityAliases(row: Record<string, unknown>): string[] {
  const aliases = new Set<string>();

  const isrc = normalizeIsrc(row.isrc);
  if (isrc) aliases.add(`isrc:${isrc}`);

  const providerMap = providerIdentityMapFromRaw(row);
  for (const alias of providerIdentityAliasesFromJson(providerMap)) aliases.add(alias);

  return [...aliases].sort();
}

function rawSongFallbackIdentityAlias(normalizedKey: string): string {
  return normalizedKey ? `normalized:${normalizedKey}` : "";
}

function candidateEvidenceIdentityKey(candidate: Record<string, unknown>): string {
  const isrc = normalizeIsrc(candidate.isrc);
  if (isrc) return `isrc:${isrc}`;

  const providerAliases = providerIdentityAliasesFromJson(candidate.provider_ids_json);
  if (providerAliases.length > 0) return providerAliases[0];

  const normalizedKey = (candidate.normalized_key as string) || "";
  if (normalizedKey) return `normalized:${normalizedKey}`;

  return `candidate:${candidate.id || crypto.randomUUID()}`;
}

function canonicalTrackIdentityKey(trackId: unknown): string {
  const id = typeof trackId === "string" ? trackId.trim().toLowerCase() : "";
  return id ? `track:${id}` : "";
}

function normalizeSlug(raw: string): string { if (!raw || !raw.trim()) return ""; return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "").slice(0, 200); }
function normalizeIso2(raw: string): string { const u = raw.toUpperCase(); const fixes: Record<string, string> = { "KENYA":"KE","HAITI":"HT","UK":"GB","CANADA":"CA","USA":"US","FRANCE":"FR","GERMANY":"DE","NIGERIA":"NG","TANZANIA":"TZ","UGANDA":"UG","GHANA":"GH" }; return fixes[u] || u; }
function sanitizeDate(raw: string | null | undefined): string | null { if (!raw || !raw.trim()) return null; const r = raw.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(r)) return r; if (/^\d{4}-\d{2}$/.test(r)) return r + "-01"; if (/^\d{4}$/.test(r)) return r + "-01-01"; try { const d = new Date(r); if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0]; } catch { } return null; }

const LN = Math.log;
function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function round4(v: number): number { if (!Number.isFinite(v)) return 0; return Math.round(v * 10000) / 10000; }
function daysBetween(a: string, b: string): number | null { const da = new Date(a), db = new Date(b); if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null; return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000)); }
function sourceScore(sc: number): number { return round4(Math.min(72, sc * 24)); }
const CROSS_SOURCE_PER_EXTRA: Record<string, number> = { off: 0, standard: 6, strong: 10 };
const CROSS_SOURCE_CAP: Record<string, number> = { off: 0, standard: 18, strong: 30 };
function crossSourceBonus(sc: number, mode = "standard", w = 1.0): number { if (sc <= 1) return 0; return round4(Math.min(CROSS_SOURCE_CAP[mode] ?? 18, (sc - 1) * (CROSS_SOURCE_PER_EXTRA[mode] ?? 6)) * w); }
function overlapBonus(oc: number, sc: number, cap = 10): number { const ex = oc - sc; if (ex <= 0) return 0; return round4(Math.min(cap, ex * 2)); }
function recencyScore(rd: string | null, ed: string): number { if (!rd) return 0; const age = daysBetween(rd, ed); if (age === null) return 0; if (age <= 30) return 18; if (age <= 90) return 12; if (age <= 180) return 8; if (age <= 365) return 4; return 0; }
function continuityScore(pp: number | null, w = 1.0): number { if (pp === null || pp <= 0) return 0; return round4(Math.max(4, 18 - Math.min(14, pp - 1)) * w); }
function carryForwardBonus(pp: number | null, w = 1.0, cfOnly = false): number { if (!cfOnly || pp === null || pp <= 0) return 0; return round4(Math.max(8, 18 - Math.min(10, pp - 1)) * w); }
function airplayScore(W: number, sCount: number, dCount: number, enabled = false, maxS = 24): number { if (!enabled || sCount < 1 || dCount < 1) return 0; return round4(clamp((LN(1 + W) * 4.25 + Math.min(6, (sCount - 1) * 1.5) + Math.min(4, Math.floor(dCount / 3))), 0, maxS)); }

interface AntiGamingInput {
  identity_key: string;
  lead_artist_key: string;
  provisional_total: number;
}
interface AntiGamingResult {
  identity_key: string;
  anti_gaming_penalty: number;
  lead_artist_overflow: boolean;
  overflow_index: number;
}
function computeAntiGamingPenalties(
  tracks: AntiGamingInput[],
  maxPer = 3,
  overflowPen = 8,
): AntiGamingResult[] {
  if (tracks.length === 0) return [];

  const groups = new Map<string, AntiGamingInput[]>();
  for (const track of tracks) {
    const leadArtistKey = track.lead_artist_key || "__unknown__";
    if (!groups.has(leadArtistKey)) groups.set(leadArtistKey, []);
    groups.get(leadArtistKey)!.push(track);
  }

  const results = new Map<string, AntiGamingResult>();

  for (const group of groups.values()) {
    if (group.length <= maxPer) {
      for (const track of group) {
        results.set(track.identity_key, {
          identity_key: track.identity_key,
          anti_gaming_penalty: 0,
          lead_artist_overflow: false,
          overflow_index: 0,
        });
      }
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const scoreDelta = b.provisional_total - a.provisional_total;
      return scoreDelta !== 0 ? scoreDelta : a.identity_key.localeCompare(b.identity_key);
    });

    for (let i = 0; i < sorted.length; i++) {
      const track = sorted[i];
      if (i < maxPer) {
        results.set(track.identity_key, {
          identity_key: track.identity_key,
          anti_gaming_penalty: 0,
          lead_artist_overflow: false,
          overflow_index: 0,
        });
      } else {
        const overflowIndex = i - maxPer + 1;
        results.set(track.identity_key, {
          identity_key: track.identity_key,
          anti_gaming_penalty: round4(overflowIndex * overflowPen),
          lead_artist_overflow: true,
          overflow_index: overflowIndex,
        });
      }
    }
  }

  return tracks.map(
    (track) =>
      results.get(track.identity_key) ?? {
        identity_key: track.identity_key,
        anti_gaming_penalty: 0,
        lead_artist_overflow: false,
        overflow_index: 0,
      },
  );
}

function computeProvisionalScore(c: { normalized_key: string; lead_artist_key: string; source_count: number; occurrence_count: number; release_date: string | null; carry_forward_only: boolean; continuity_locked: boolean; airplay_candidate_only: boolean; }, ed: string, pp: number | null, cfg: { cross_source_mode?: string; cross_source_weight?: number; continuity_weight?: number; carry_forward_weight?: number; overlap_bonus_cap?: number; airplay_enabled?: boolean; airplay_max_score?: number; } = {}, airplayCtx?: { W: number; station_count: number; detection_count: number; } | null) { const ss = sourceScore(c.source_count); const cs = crossSourceBonus(c.source_count, cfg.cross_source_mode ?? "standard", cfg.cross_source_weight ?? 1.0); const ob = overlapBonus(c.occurrence_count, c.source_count, cfg.overlap_bonus_cap ?? 10); const rs = recencyScore(c.release_date, ed); const cont = continuityScore(pp, cfg.continuity_weight ?? 1.0); const cf = carryForwardBonus(pp, cfg.carry_forward_weight ?? 1.0, c.carry_forward_only); const ap = airplayScore(airplayCtx?.W ?? 0, airplayCtx?.station_count ?? 0, airplayCtx?.detection_count ?? 0, cfg.airplay_enabled ?? false, cfg.airplay_max_score ?? 24); const rd = c.release_date ? daysBetween(c.release_date, ed) : null; return { source_score: ss, cross_source_bonus: cs, overlap_bonus: ob, recency_score: rs, continuity_score: cont, carry_forward_bonus: cf, airplay_score: ap, provisional_total: round4(ss + cs + ob + rs + cont + cf + ap), recency_days: rd }; }

interface ProviderTrack { title: string; artist: string; release_date: string | null; isrc: string | null; source_position: number; provider_track_id: string | null; provider_release_id: string | null; provider_artist_ids: string[]; artwork_url: string | null; external_url: string | null; preview_url: string | null; raw_payload: unknown; }
interface ProviderFetchResult { tracks: ProviderTrack[]; warnings: string[]; error: string | null; }

async function fetchProviderSource(
  req: Request,
  provider: string,
  sourceUrl: string,
  market: string,
  maxRows: number,
): Promise<ProviderFetchResult> {
  const authorization=req.headers.get("Authorization");
  if(!authorization?.startsWith("Bearer ")) return {tracks:[],warnings:[],error:"Provider fetch requires caller bearer token."};
  let response:Response;
  try {
    response=await fetch(`${SUPABASE_URL}/functions/v1/chart-provider-fetch`,{
      method:"POST",
      headers:{Authorization:authorization,apikey:ANON_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({provider,sourceUrl,market,maxRows}),
    });
  } catch(error) {
    return {tracks:[],warnings:[],error:"Chart provider fetch unavailable: "+(error instanceof Error?error.message:String(error))};
  }
  let payload:ProviderFetchResult;
  try { payload=await response.json() as ProviderFetchResult; }
  catch { return {tracks:[],warnings:[],error:`Chart provider fetch returned invalid JSON (${response.status}).`}; }
  if(!response.ok) return {tracks:[],warnings:payload.warnings??[],error:payload.error||`Chart provider fetch failed (${response.status}).`};
  return {tracks:Array.isArray(payload.tracks)?payload.tracks:[],warnings:Array.isArray(payload.warnings)?payload.warnings:[],error:payload.error??null};
}

function anchorToMonday(dateStr: string): string { const d = new Date(dateStr); if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10); const day = d.getUTCDay(); const diff = day === 0 ? 6 : day - 1; d.setUTCDate(d.getUTCDate() - diff); d.setUTCHours(0, 0, 0, 0); return d.toISOString().split("T")[0]; }

// REGISTRY MATERIALIZATION
// Canonical Registry writes are delegated to the governed Slice-2 RPC family.

function parseArtists(artistLine: string): string[] { if (!artistLine || !artistLine.trim()) return []; const parts = artistLine.split(/\s*,\s*/); const artists: string[] = []; for (const part of parts) { const subs = part.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i); for (const sub of subs) { const xs = sub.split(/\s+x\s+/i); for (const x of xs) { const amps = x.split(/\s+&\s+/); for (const a of amps) { const trimmed = a.trim(); if (trimmed) artists.push(trimmed); } } } } return artists; }

interface ChartMaterializationResult {
  run_id:string; candidate_id:string; track_id:string; track_slug:string;
  track_created:boolean; track_operation_id?:string;
  primary_artist_id:string; primary_artist_slug:string;
  artists:Array<{artist_id:string;artist_slug:string;artist_name:string;created:boolean;operation_id?:string}>;
  credits:Array<{credit_id:string;artist_id:string;created:boolean;operation_id?:string}>;
}

async function materializeChartCandidate(db:ReturnType<typeof createClient>,runId:string,candidateId:string):Promise<ChartMaterializationResult>{
  const {data,error}=await db.rpc("chart_materialize_candidate_registry_v1",{p_run_id:runId,p_candidate_id:candidateId});
  if(error) throw new Error(`Governed Registry materialization failed for candidate ${candidateId}: ${error.message}`);
  const result=(data??{}) as unknown as ChartMaterializationResult;
  if(!result.track_id||!result.track_slug||!result.primary_artist_id||!result.primary_artist_slug) throw new Error(`Governed Registry materialization returned incomplete identity for candidate ${candidateId}.`);
  return {...result,artists:Array.isArray(result.artists)?result.artists:[],credits:Array.isArray(result.credits)?result.credits:[]};
}

// ── HANDLERS ──
async function handleFixChartArtistSlugs(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,user:{id:string;email?:string}) {
  const {editionId,dryRun}=params as {editionId?:string;dryRun?:boolean};
  const isDryRun=dryRun!==false; const now=new Date().toISOString();
  const {data:rows,error}=await db.rpc("chart_get_entry_registry_identity_v1",{p_edition_id:editionId||null});
  if(error) return json(req,{error:"canonical_identity_lookup_failed",detail:error.message},500);
  const fixes:Array<{id:string;track_title:string;artist_name:string;current_slug:string;correct_slug:string;method:string}>=[]; const skipped:string[]=[];
  for(const raw of rows||[]){
    const row=raw as {entry_id?:string;track_title?:string;artist_name?:string;current_artist_slug?:string;canonical_track_id?:string;canonical_primary_artist_slug?:string};
    const id=String(row.entry_id||""); const title=String(row.track_title||""); const artist=String(row.artist_name||"");
    const current=normalizeSlug(String(row.current_artist_slug||"")); const correct=normalizeSlug(String(row.canonical_primary_artist_slug||""));
    if(!id||!row.canonical_track_id||!correct){skipped.push(`${title} by ${artist} (no canonical primary credit)`);continue;}
    if(current===correct)continue;
    fixes.push({id,track_title:title,artist_name:artist,current_slug:current,correct_slug:correct,method:"canonical_track_primary_credit"});
  }
  if(isDryRun)return json(req,{ok:true,dry_run:true,total_entries:(rows||[]).length,to_fix:fixes.length,skipped:skipped.length,fix_preview:fixes.slice(0,50),skipped_samples:skipped.slice(0,20)});
  let fixed=0;
  for(const item of fixes){const {error:updateError}=await db.from("wk_chart_entries_v2").update({artist_slug:item.correct_slug,updated_at:now}).eq("id",item.id);if(!updateError)fixed++;}
  await db.from("chart_ingest_audit_events").insert({run_id:editionId||"global",actor:user.id,actor_email:user.email||null,action:"fix_artist_slugs",new_status:"fixed",payload_json:{fixed,skipped:skipped.length,dryRun:false,totalEntries:(rows||[]).length},created_at:now});
  return json(req,{ok:true,fixed,skipped:skipped.length,total_entries:(rows||[]).length,skipped_samples:skipped.slice(0,20)});
}

async function handleReingestEdition(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,user:{id:string;email?:string}) {
  const {editionId,dryRun}=params as {editionId:string;dryRun?:boolean}; if(!editionId)return json(req,{error:"editionId_required"},400);
  const isDryRun=dryRun!==false; const now=new Date().toISOString();
  const {data:edition,error:editionError}=await db.from("wk_chart_editions_v2").select("id, edition_slug, ingest_run_id").eq("id",editionId).maybeSingle();
  if(editionError)return json(req,{error:"edition_lookup_failed",detail:editionError.message},500); if(!edition)return json(req,{error:"edition_not_found"},404);
  const runId=String(edition.ingest_run_id||"");
  const {data:entries,error:entryError}=await db.from("wk_chart_entries_v2").select("*").eq("edition_id",editionId).order("rank",{ascending:true});
  if(entryError)return json(req,{error:"entry_lookup_failed",detail:entryError.message},500); if(!entries?.length)return json(req,{error:"no_entries"},400);
  const stats={total:entries.length,tracks_found:0,tracks_created:0,artists_found:0,artists_created:0,links_created:0,artist_slugs_fixed:0,track_slugs_normalized:0,canonical_ids_set:0,errors:0};
  const repairs:Array<{id:string;track_title:string;artist_name:string;action:string}>=[];
  for(const entry of entries){
    const id=String(entry.id||""); const title=String(entry.track_title||""); const artist=String(entry.artist_name||""); const key=String(entry.normalized_key||""); const existing=String(entry.canonical_track_id||"");
    try{
      if(!runId||!key){if(existing){stats.tracks_found++;repairs.push({id,track_title:title,artist_name:artist,action:"existing_canonical_binding_preserved"});continue;}throw new Error("missing_original_run_candidate_binding");}
      const {data:candidates,error:candidateError}=await db.from("chart_ingest_candidates").select("id").eq("run_id",runId).eq("normalized_key",key).limit(2);
      if(candidateError)throw new Error("candidate_binding_lookup_failed:"+candidateError.message);
      if(!candidates||candidates.length!==1){if(existing){stats.tracks_found++;repairs.push({id,track_title:title,artist_name:artist,action:"existing_canonical_binding_preserved_without_unique_candidate"});continue;}throw new Error(candidates?.length?"ambiguous_original_candidate_binding":"missing_original_candidate_binding");}
      const candidateId=String(candidates[0].id); if(isDryRun){repairs.push({id,track_title:title,artist_name:artist,action:`would_materialize_candidate:${candidateId}`});continue;}
      const result=await materializeChartCandidate(db,runId,candidateId); if(result.track_created)stats.tracks_created++;else stats.tracks_found++;
      for(const a of result.artists){if(a.created)stats.artists_created++;else stats.artists_found++;} stats.links_created+=result.credits.filter(c=>c.created).length;
      const trackSlug=normalizeSlug(result.track_slug); const artistSlug=normalizeSlug(result.primary_artist_slug);
      if(trackSlug!==String(entry.track_slug||""))stats.track_slugs_normalized++; if(artistSlug!==String(entry.artist_slug||""))stats.artist_slugs_fixed++;
      const {error:updateError}=await db.from("wk_chart_entries_v2").update({canonical_track_id:result.track_id,track_slug:trackSlug,artist_slug:artistSlug,updated_at:now}).eq("id",id);
      if(updateError)throw new Error("chart_entry_update_failed:"+updateError.message); stats.canonical_ids_set++; repairs.push({id,track_title:title,artist_name:artist,action:result.track_created?`created_track:${trackSlug}`:`linked_track:${trackSlug}`});
    }catch(error){stats.errors++;repairs.push({id,track_title:title,artist_name:artist,action:"ERROR:"+(error instanceof Error?error.message:String(error))});}
  }
  await db.from("chart_ingest_audit_events").insert({run_id:editionId,actor:user.id,actor_email:user.email||null,action:"reingest_edition",new_status:isDryRun?"dry_run":"done",payload_json:{...stats,edition_slug:edition.edition_slug,dryRun:isDryRun},created_at:now});
  return json(req,{ok:stats.errors===0,dry_run:isDryRun,edition_slug:String(edition.edition_slug||""),stats,repairs:repairs.slice(0,100)});
}

async function handleCreateDryRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const rq = params.request as Record<string, unknown>; if (!rq) return json(req, { error: "request_required" }, 400); const runId = crypto.randomUUID(); const ed = rq.editionDate as string; const sUrls = (rq.sourceUrls as string[]) || []; const { error: rErr } = await db.from("chart_ingest_runs").insert({ id: runId, program_id: (rq.existingSeriesId as string) || "unknown", series_slug: (rq.existingSeriesId as string) || null, market_slug: (rq.market as string) || "KE", chart_kind: (rq.chartKind as string) || "tracks", edition_date: ed, period_start: ed, period_end: ed, chart_size: (rq.chartSize as number) || 20, status: "queued", rule_snapshot_json: { chartTitle: rq.chartTitle, chartSlug: rq.chartSlug, coverStyle: rq.coverStyle || "default", saveAsRecurringSeries: rq.saveAsRecurringSeries || false, methodologyVersion: rq.methodologyVersion || "1.0.0" }, market_scope_snapshot_json: (rq.marketScopeSnapshot as object) || {}, eligibility_profile_id: (rq.eligibilityProfileId as string) || null, market_scope_id: (rq.marketScopeId as string) || null, scoring_policy_version: "1.0.1", source_policy_version: "1.0.0", eligibility_policy_version: "1.0.0", methodology_version: (rq.methodologyVersion as string) || "1.0.0", created_by: user.id, created_by_email: user.email || null }); if (rErr) return json(req, { error: "run_create_failed", detail: rErr.message }, 500); if (sUrls.length > 0) { const srs = sUrls.map((url, i) => ({ run_id: runId, provider: detectProvider(url), source_type: url.endsWith(".csv") ? "csv" : "playlist", source_url: url, storefront_or_market: (rq.market as string) || "KE", enabled: true, priority: i, fetch_status: "pending" })); await db.from("chart_ingest_run_sources").insert(srs); } const sgs = ALL_STAGES.map(s => ({ run_id: runId, stage: s, status: "idle", metrics_json: {} })); await db.from("chart_ingest_stage_events").insert(sgs); await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: user.email || null, action: "run_created", new_status: "queued", payload_json: { sourceCount: sUrls.length } }); return json(req, { runId, status: "queued" }); }

async function handleListRuns(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const limit = Math.min((params.limit as number) || 100, 200); const { data: runs, error } = await db.from("chart_ingest_runs").select("*").order("created_at", { ascending: false }).limit(limit); if (error) return json(req, { error: error.message }, 500); const rl = runs || []; if (rl.length > 0) { const rids = rl.map((r: { id: string }) => r.id); const [sr, sg] = await Promise.all([db.from("chart_ingest_run_sources").select("*").in("run_id", rids).order("priority"), db.from("chart_ingest_stage_events").select("*").in("run_id", rids).order("created_at")]); const sbm = new Map<string, unknown[]>(); for (const s of (sr.data || [])) { const rid = s.run_id as string; if (!sbm.has(rid)) sbm.set(rid, []); sbm.get(rid)!.push(s); } const stm = new Map<string, unknown[]>(); for (const s of (sg.data || [])) { const rid = s.run_id as string; if (!stm.has(rid)) stm.set(rid, []); stm.get(rid)!.push(s); } return json(req, { runs: rl.map((r: { id: string }) => ({ ...r, chart_ingest_run_sources: sbm.get(r.id) || [], chart_ingest_stage_events: stm.get(r.id) || [] })) }); } return json(req, { runs: [] }); }

async function handleGetRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data: run, error } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (error) return json(req, { error: error.message }, 500); if (!run) return json(req, { error: "run_not_found" }, 404); const [sr, sg] = await Promise.all([db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).order("priority"), db.from("chart_ingest_stage_events").select("*").eq("run_id", runId).order("created_at")]); const [t1, t2, t3, t4] = await Promise.all([db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "eligible"), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "needs_review"), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "excluded")]); return json(req, { run: { ...run, chart_ingest_run_sources: sr.data || [], chart_ingest_stage_events: sg.data || [], candidateCounts: { total: t1.count || 0, eligible: t2.count || 0, needsReview: t3.count || 0, excluded: t4.count || 0 } } }); }

async function handleGetStages(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data, error } = await db.from("chart_ingest_stage_events").select("*").eq("run_id", runId).order("created_at"); if (error) return json(req, { error: error.message }, 500); return json(req, { stages: data || [] }); }

async function handleGetExclusions(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId, limit } = params as { runId: string; limit?: number };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const { data, error } = await db
    .from("chart_ingest_exclusions")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit || 500, 1000));

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { exclusions: data || [] });
}
async function handleGetSources(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data, error } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).order("priority"); if (error) return json(req, { error: error.message }, 500); return json(req, { sources: data || [] }); }
async function handleGetCandidates(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, status, limit = 200 } = params as { runId: string; status?: string; limit?: number }; let q = db.from("chart_ingest_candidates").select("*").eq("run_id", runId).limit(Math.min(limit, 500)); if (status) q = q.eq("status", status); const { data, error } = await q; if (error) return json(req, { error: error.message }, 500); const cs = data || []; if (cs.length > 0) { const cids = cs.map((c: { id: string }) => c.id); const [sc, mc] = await Promise.all([db.from("chart_ingest_candidate_scores").select("*").in("candidate_id", cids), db.from("chart_ingest_matches").select("*").in("candidate_id", cids)]); const sbc = new Map<string, unknown[]>(); for (const s of (sc.data || [])) { const cid = s.candidate_id as string; if (!sbc.has(cid)) sbc.set(cid, []); sbc.get(cid)!.push(s); } const mbc = new Map<string, unknown[]>(); for (const m of (mc.data || [])) { const cid = m.candidate_id as string; if (!mbc.has(cid)) mbc.set(cid, []); mbc.get(cid)!.push(m); } return json(req, { candidates: cs.map((c: { id: string }) => ({ ...c, chart_ingest_candidate_scores: sbc.get(c.id) || [], chart_ingest_matches: mbc.get(c.id) || [] })) }); } return json(req, { candidates: [] }); }
async function handleGetNormalized(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data, error } = await db.from("chart_ingest_normalized_rows").select("*").eq("run_id", runId).order("created_at"); if (error) return json(req, { error: error.message }, 500); return json(req, { normalized_rows: data || [] }); }
async function handleGetReviewIssues(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, candidateId, status: issueStatus } = params as { runId?: string; candidateId?: string; status?: string }; let q = db.from("chart_ingest_review_issues").select("*").order("created_at", { ascending: false }); if (runId) q = q.eq("run_id", runId); if (candidateId) q = q.eq("candidate_id", candidateId); if (issueStatus) q = q.eq("status", issueStatus); const { data, error } = await q; if (error) return json(req, { error: error.message }, 500); return json(req, { review_issues: data || [] }); }
async function handleGetMatchesForRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, candidateId } = params as { runId?: string; candidateId?: string }; let q = db.from("chart_ingest_matches").select("*").order("created_at", { ascending: false }); if (runId) q = q.eq("run_id", runId); if (candidateId) q = q.eq("candidate_id", candidateId); const { data, error } = await q; if (error) return json(req, { error: error.message }, 500); return json(req, { matches: data || [] }); }
async function handleGetKpis(req: Request, db: ReturnType<typeof createClient>) { const wa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); const { count: etw } = await db.from("chart_ingest_runs").select("*", { count: "exact", head: true }).in("status", ["committed", "published"]).gte("committed_at", wa); const { count: rar } = await db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("status", "needs_review"); return json(req, { editionsThisWeek: etw || 0, canonicalMatchRate: 0, rowsAwaitingReview: rar || 0, averageRunTimeMs: 0 }); }
async function handleGetActivity(req: Request, db: ReturnType<typeof createClient>) { const { data: events } = await db.from("chart_ingest_audit_events").select("*").in("action", ["run_created", "run_committed", "edition_published", "run_cancelled"]).order("created_at", { ascending: false }).limit(20); const activity = (events || []).map((e: Record<string, unknown>) => ({ id: e.id, type: e.action === "run_committed" ? "commit" : e.action === "run_cancelled" ? "cancel" : "dry_run", chartTitle: "Run "+(e.run_id as string).slice(0, 8), runId: e.run_id, status: (e.new_status as string) || "unknown", actor: (e.actor_email as string) || (e.actor as string) || "Unknown", createdAt: e.created_at })); return json(req, { activity }); }
async function handleGetResourceGuard(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data: sources } = await db.from("chart_ingest_run_sources").select("provider").eq("run_id", runId).eq("enabled", true); const sc = sources?.length || 0; const { count: ar } = await db.from("chart_ingest_runs").select("*", { count: "exact", head: true }).eq("status", "running"); return json(req, { sourceCount: sc, providerBudgetRemaining: Math.max(0, 100 - sc * 10), workerConcurrency: 4, estimatedRowCount: sc * 100, duplicateRunWarning: (ar || 0) > 0 ? "Another run is currently active." : null, sameEditionDateWarning: null }); }
async function handleSendGapsToReview(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; await db.from("chart_ingest_runs").update({ status: "needs_review", updated_at: new Date().toISOString() }).eq("id", runId).in("status", ["dry_run_complete", "ready_to_commit"]); return json(req, { ok: true }); }
async function handleCancelRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; const { data: run } = await db.from("chart_ingest_runs").select("status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); if (!["draft", "queued", "running", "needs_review", "dry_run_complete"].includes(run.status)) return json(req, { error: "cannot_cancel" }, 400); await db.from("chart_ingest_runs").update({ status: "cancelled", error_message: "Cancelled by admin", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: true, status: "cancelled" }); }
async function handleRetryRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; const { data: run } = await db.from("chart_ingest_runs").select("status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); if (!["failed", "cancelled", "source_fetch_failed"].includes(run.status)) return json(req, { error: "cannot_retry" }, 400); await db.from("chart_ingest_runs").update({ status: "queued", error_code: null, error_message: null, updated_at: new Date().toISOString() }).eq("id", runId); await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null, error_code: null, error_message: null }).eq("run_id", runId); return json(req, { ok: true, status: "queued" }); }
async function handlePreflight(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { programId, editionDate, sources } = params as { programId: string; editionDate: string; sources?: Array<{ provider: string; sourceUrl?: string }> }; const blockers: Array<{ code: string; message: string }> = []; const warnings: Array<{ code: string; message: string }> = []; const es = (sources || []).filter(s => s.sourceUrl); if (es.length === 0) blockers.push({ code: "no_enabled_sources", message: "At least one enabled source URL required." }); if (!programId) blockers.push({ code: "unknown_program", message: "program_id required." }); if (!editionDate) blockers.push({ code: "missing_edition_date", message: "edition_date required." }); if (es.length === 1) warnings.push({ code: "single_source_only", message: "Only one source." }); return json(req, { ok: blockers.length === 0, blockers, warnings, estimates: { sourceCount: es.length, expectedProviderRequests: es.length, expectedRowCap: es.length * 100 } }); }
async function handleValidateCommit(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string };

  if (!runId) {
    return json(req, {
      canCommit: false,
      errors: [{ code: "runId_required", message: "runId is required." }],
      warnings: [],
    });
  }

  const { data: report, error: reportErr } = await db.rpc("chart_get_run_integrity_report", {
    p_run_id: runId,
  });

  if (reportErr || !report) {
    return json(req, {
      canCommit: false,
      errors: [{
        code: "integrity_report_failed",
        message: reportErr?.message || "Unable to load chart run integrity report.",
      }],
      warnings: [],
    });
  }

  const integrity = report as Record<string, unknown>;
  const blockers = Array.isArray(integrity.blockers) ? integrity.blockers.map(String) : [];
  const canCommit = Boolean(integrity.committable) && blockers.length === 0;

  return json(req, {
    canCommit,
    errors: blockers.map((code) => ({
      code,
      message: "Chart run is not committable: " + code,
    })),
    warnings: [],
    integrityReport: integrity,
  });
}

// NORMALIZE
async function handleNormalizeRun(
  req: Request,
  db: ReturnType<typeof createClient>,
  params: Record<string, unknown>,
  user: { id: string; email?: string },
) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const startedAt = Date.now();
  const { data: run } = await db
    .from("chart_ingest_runs")
    .select("id,status")
    .eq("id", runId)
    .maybeSingle();

  if (!run) return json(req, { error: "run_not_found" }, 404);

  await db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId);
  await db.from("chart_ingest_candidates").delete().eq("run_id", runId);
  await db.from("chart_ingest_review_issues").delete().eq("run_id", runId);
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      message: null,
      error_code: null,
      error_message: null,
    })
    .eq("run_id", runId)
    .eq("stage", "normalize");

  const { data: rawRows } = await db
    .from("chart_ingest_raw_rows")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");

  if (!rawRows || rawRows.length === 0) {
    const durationMs = Date.now() - startedAt;
    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        message: "No raw rows to normalize.",
      })
      .eq("run_id", runId)
      .eq("stage", "normalize");

    return json(req, {
      ok: true,
      runId,
      rawCount: 0,
      uniqueCount: 0,
      candidateCount: 0,
      durationMs,
    });
  }

  type NormalizeGroup = {
    normalizedKey: string;
    rows: Array<Record<string, unknown>>;
    sources: Set<string>;
    sourceUrls: Set<string>;
    artwork_url: string | null;
    bestTitle: string;
    bestArtist: string;
    bestIsrc: string | null;
    bestReleaseDate: string | null;
    providerIds: Record<string, Set<string>>;
  };

  const groups = new Map<string, NormalizeGroup>();
  const strongAliasOwners = new Map<string, string>();
  const fallbackAliasOwners = new Map<string, string>();

  function mergeProviderBag(
    target: Record<string, Set<string>>,
    incoming: Record<string, string[]>,
  ): void {
    for (const [provider, ids] of Object.entries(incoming)) {
      for (const id of ids) addProviderIdToBag(target, provider, id);
    }
  }

  function mergeGroups(target: NormalizeGroup, source: NormalizeGroup): void {
    target.rows.push(...source.rows);
    for (const provider of source.sources) target.sources.add(provider);
    for (const url of source.sourceUrls) target.sourceUrls.add(url);
    if (!target.artwork_url && source.artwork_url) target.artwork_url = source.artwork_url;
    if (!target.bestIsrc && source.bestIsrc) target.bestIsrc = source.bestIsrc;
    if (!target.bestReleaseDate && source.bestReleaseDate) {
      target.bestReleaseDate = source.bestReleaseDate;
    }
    for (const [provider, ids] of Object.entries(source.providerIds)) {
      for (const id of ids) addProviderIdToBag(target.providerIds, provider, id);
    }
  }

  for (const row of rawRows as Array<Record<string, unknown>>) {
    const title = (row.title_raw as string) || "";
    const artist = (row.artist_raw as string) || "";
    const normalizedKey = build_normalized_key(title, artist);
    if (!normalizedKey) continue;

    const strongAliases = rawSongStrongIdentityAliases(row);
    const fallbackAlias = rawSongFallbackIdentityAlias(normalizedKey);
    const aliasOwners = strongAliases.length > 0 ? strongAliasOwners : fallbackAliasOwners;
    const aliases = strongAliases.length > 0
      ? strongAliases
      : [fallbackAlias].filter(Boolean);

    const existingGroupIds = [
      ...new Set(
        aliases
          .map((alias) => aliasOwners.get(alias))
          .filter(Boolean) as string[],
      ),
    ];

    const groupId = existingGroupIds[0] || aliases[0] || `row:${String(row.id || crypto.randomUUID())}`;
    let group = groups.get(groupId);
    const rowProviderMap = providerIdentityMapFromRaw(row);
    const sourceKey = normalizeProviderKey(row.provider) || "unknown";

    if (!group) {
      group = {
        normalizedKey,
        rows: [row],
        sources: new Set([sourceKey]),
        sourceUrls: new Set([(row.external_url as string) || ""].filter(Boolean)),
        artwork_url: (row.artwork_url as string) || null,
        bestTitle: title,
        bestArtist: artist,
        bestIsrc: normalizeIsrc(row.isrc) || null,
        bestReleaseDate: sanitizeDate(row.release_date_raw as string),
        providerIds: {},
      };
      mergeProviderBag(group.providerIds, rowProviderMap);
      groups.set(groupId, group);
    } else {
      group.rows.push(row);
      group.sources.add(sourceKey);
      if (row.external_url) group.sourceUrls.add(row.external_url as string);
      if (!group.artwork_url && row.artwork_url) {
        group.artwork_url = row.artwork_url as string;
      }
      if (!group.bestIsrc && row.isrc) group.bestIsrc = normalizeIsrc(row.isrc);
      if (!group.bestReleaseDate && row.release_date_raw) {
        group.bestReleaseDate = sanitizeDate(row.release_date_raw as string);
      }
      mergeProviderBag(group.providerIds, rowProviderMap);
    }

    for (const extraGroupId of existingGroupIds.slice(1)) {
      if (extraGroupId === groupId) continue;
      const extraGroup = groups.get(extraGroupId);
      if (!extraGroup) continue;

      mergeGroups(group, extraGroup);
      groups.delete(extraGroupId);

      for (const [alias, owner] of strongAliasOwners.entries()) {
        if (owner === extraGroupId) strongAliasOwners.set(alias, groupId);
      }
      for (const [alias, owner] of fallbackAliasOwners.entries()) {
        if (owner === extraGroupId) fallbackAliasOwners.set(alias, groupId);
      }
    }

    for (const alias of aliases) aliasOwners.set(alias, groupId);
  }

  if (groups.size === 0) {
    const durationMs = Date.now() - startedAt;
    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        message: "No valid normalized observations.",
      })
      .eq("run_id", runId)
      .eq("stage", "normalize");

    return json(req, {
      ok: true,
      runId,
      rawCount: rawRows.length,
      uniqueCount: 0,
      candidateCount: 0,
      durationMs,
    });
  }

  const now = new Date().toISOString();
  const normalizedRows: Array<Record<string, unknown>> = [];
  const candidates: Array<Record<string, unknown>> = [];

  for (const group of groups.values()) {
    const normalizedKey = group.normalizedKey;
    const leadArtistKey = normalizedKey.split("::")[1] || "";
    const normalizedTitle = normalizedKey.split("::")[0] || "";
    const sourceCount = group.sources.size;
    const occurrenceCount = group.rows.length;
    const sourceUrls = [...group.sourceUrls];
    const releaseDate = sanitizeDate(group.bestReleaseDate);
    const providerIdsJson = providerIdsJsonFromBag(group.providerIds);
    const normalizedRowId = crypto.randomUUID();
    const candidateId = crypto.randomUUID();
    const reasons: string[] = [];

    if (!normalizedTitle) reasons.push("empty_title");
    if (!leadArtistKey) reasons.push("empty_artist");
    if (sourceCount < 1) reasons.push("no_sources");

    normalizedRows.push({
      id: normalizedRowId,
      run_id: runId,
      normalized_key: normalizedKey,
      lead_artist_key: leadArtistKey,
      title: group.bestTitle,
      artist_display: group.bestArtist,
      normalized_title: normalizedTitle,
      source_count: sourceCount,
      occurrence_count: occurrenceCount,
      source_urls_seen: sourceUrls,
      isrc: group.bestIsrc,
      release_date: releaseDate,
      artwork_url: group.artwork_url,
      external_url: (group.rows[0].external_url as string) || null,
      preview_url: (group.rows[0].preview_url as string) || null,
      provider_track_id: (group.rows[0].provider_track_id as string) || null,
      provider_release_id: (group.rows[0].provider_release_id as string) || null,
      provider_artist_ids: (group.rows[0].provider_artist_ids as string[]) || [],
      raw_source_count: group.rows.length,
      created_at: now,
    });

    candidates.push({
      id: candidateId,
      run_id: runId,
      normalized_key: normalizedKey,
      lead_artist_key: leadArtistKey,
      title: group.bestTitle,
      artist_display: group.bestArtist,
      source_count: sourceCount,
      occurrence_count: occurrenceCount,
      source_urls_seen: sourceUrls,
      provider_ids_json: providerIdsJson,
      release_date: releaseDate,
      candidate_type: "streaming",
      status: reasons.length === 0 ? "pending" : "excluded",
      version: 1,
      carry_forward_only: false,
      continuity_locked: false,
      airplay_candidate_only: false,
      streaming_qualified: sourceCount > 0,
      isrc: group.bestIsrc || null,
      upc: null,
      artwork_url: group.artwork_url,
      external_url: (group.rows[0].external_url as string) || null,
      preview_url: (group.rows[0].preview_url as string) || null,
      release_title: null,
      created_at: now,
      updated_at: now,
    });
  }

  const chunkSize = 200;

  for (let i = 0; i < normalizedRows.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_normalized_rows")
      .insert(normalizedRows.slice(i, i + chunkSize));

    if (error) {
      const durationMs = Date.now() - startedAt;
      await db
        .from("chart_ingest_stage_events")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          message: "Normalized-row insert failed: " + error.message,
          error_code: "normalized_insert_failed",
          error_message: error.message,
        })
        .eq("run_id", runId)
        .eq("stage", "normalize");

      return json(req, { error: "normalized_insert_failed", detail: error.message }, 500);
    }
  }

  for (let i = 0; i < candidates.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_candidates")
      .insert(candidates.slice(i, i + chunkSize));

    if (error) {
      const durationMs = Date.now() - startedAt;
      await db
        .from("chart_ingest_stage_events")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          message: "Candidate insert failed: " + error.message,
          error_code: "candidate_insert_failed",
          error_message: error.message,
        })
        .eq("run_id", runId)
        .eq("stage", "normalize");

      return json(req, { error: "candidate_insert_failed", detail: error.message }, 500);
    }
  }

  const invalidCandidates = candidates.filter((candidate) => candidate.status === "excluded");
  if (invalidCandidates.length > 0) {
    const exclusionRows = invalidCandidates.map((candidate) => ({
      id: crypto.randomUUID(),
      run_id: runId,
      candidate_id: candidate.id,
      reason_code: "invalid_normalized_observation",
      reason_label: "Normalized observation is missing required title, Artist, or source evidence.",
      severity: "hard",
      source_stage: "normalize",
      details_json: {},
      created_at: now,
    }));

    for (let i = 0; i < exclusionRows.length; i += chunkSize) {
      await db.from("chart_ingest_exclusions").insert(exclusionRows.slice(i, i + chunkSize));
    }
  }

  const durationMs = Date.now() - startedAt;
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      message: `${groups.size} evidence groups from ${rawRows.length} raw observations.`,
      metrics_json: {
        rawCount: rawRows.length,
        evidenceGroupCount: groups.size,
        pendingIdentityCount: candidates.filter((candidate) => candidate.status === "pending").length,
        invalidCount: invalidCandidates.length,
      },
    })
    .eq("run_id", runId)
    .eq("stage", "normalize");

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: 0,
      message: `${rawRows.length - groups.size} exact evidence duplicates removed; title text was not used to merge rows carrying strong external identity.`,
    })
    .eq("run_id", runId)
    .eq("stage", "dedupe");

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: 0,
      message: `${candidates.length} identity-pending candidates built.`,
    })
    .eq("run_id", runId)
    .eq("stage", "release_candidate_build");

  return json(req, {
    ok: true,
    runId,
    rawCount: rawRows.length,
    uniqueCount: groups.size,
    candidateCount: candidates.length,
    warningCount: invalidCandidates.length,
    durationMs,
  });
}

// SOURCE_FETCH — unchanged from v25
async function handleSourceFetch(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); await db.from("chart_ingest_raw_rows").delete().eq("run_id", runId); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString() }).eq("run_id", runId).eq("stage", "source_fetch"); const { data: sources } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).eq("enabled", true).order("priority"); if (!sources || sources.length === 0) { const d = Date.now(); await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: "No enabled sources." }).eq("run_id", runId).eq("stage", "source_fetch"); return json(req, { ok: true, runId, sourceCount: 0, rawRowCount: 0 }); } const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const cs = (run.chart_size as number) || 20; let trr = 0, tfs = 0; const aw: string[] = []; const srs: Array<{ sourceId: string; fetchedCount: number; droppedCount: number; provider: string; warnings: string[]; error: string | null }> = []; for (const source of sources) { const market = (source.storefront_or_market as string) || "KE"; const mr = Math.min(500, Math.max(cs * 5, cs + 100)); if (source.provider === "csv") { srs.push({ sourceId: source.id, fetchedCount: source.fetched_count || 0, droppedCount: 0, provider: "csv", warnings: [], error: null }); trr += source.fetched_count || 0; continue; } const fr = await fetchProviderSource(req, source.provider as string, source.source_url as string, market, mr); if (fr.error) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: fr.error }); tfs++; aw.push(...fr.warnings); continue; } const tracks = fr.tracks; aw.push(...fr.warnings); if (tracks.length === 0) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null }); continue; } const now = new Date().toISOString(); const rrs = tracks.map(t => ({ id: crypto.randomUUID(), run_id: runId, source_id: source.id, provider: source.provider, provider_row_id: t.provider_track_id ? source.provider+":"+t.provider_track_id+":"+t.source_position : source.provider+":pos:"+t.source_position, provider_track_id: t.provider_track_id, provider_release_id: t.provider_release_id, provider_artist_ids: t.provider_artist_ids, source_position: t.source_position, title_raw: t.title, artist_raw: t.artist, release_raw: null, isrc: t.isrc, upc: null, release_date_raw: t.release_date, artwork_url: t.artwork_url, external_url: t.external_url || source.source_url || null, preview_url: t.preview_url, raw_payload_json: t.raw_payload, raw_payload_hash: null })); const CH = 100; for (let j = 0; j < rrs.length; j += CH) { await db.from("chart_ingest_raw_rows").insert(rrs.slice(j, j + CH)); } trr += rrs.length; srs.push({ sourceId: source.id, fetchedCount: rrs.length, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null }); } const d = Date.now(); const sm = trr > 0 ? trr+" raw rows from "+(sources.length - tfs)+"/"+sources.length+" source(s)" : "All sources failed."; await db.from("chart_ingest_stage_events").update({ status: trr > 0 ? "done" : "failed", finished_at: new Date().toISOString(), duration_ms: d, message: sm }).eq("run_id", runId).eq("stage", "source_fetch"); if (trr > 0) { await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: 1, message: "Raw rows persisted." }).eq("run_id", runId).eq("stage", "raw_persist"); await db.from("chart_ingest_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", runId); } else { await db.from("chart_ingest_runs").update({ status: "source_fetch_failed", error_code: "all_sources_failed", error_message: "Configure credentials in Settings.", updated_at: new Date().toISOString() }).eq("id", runId); } return json(req, { ok: trr > 0, runId, sourceCount: sources.length, rawRowCount: trr, failedSourceCount: tfs, sourceResults: srs, durationMs: d }); }


type ChartTrackResolution = {
  candidateId: string;
  inputTrackIds: string[];
  currentTrackId: string | null;
  resolutionStatus: string;
  blockingReason: string | null;
};

function chunkStrings(values: string[], size = 150): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function candidateTrackIdsFromReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((reason) => String(reason || ""))
        .filter((reason) => reason.startsWith("candidate_track:"))
        .map((reason) => reason.slice("candidate_track:".length))
        .filter(Boolean),
    ),
  ].sort();
}

async function resolveCurrentTrackIdentity(
  db: ReturnType<typeof createClient>,
  trackId: string,
): Promise<{
  inputTrackId: string;
  status: string;
  currentTrackIds: string[];
  currentTrackId: string | null;
}> {
  const { data, error } = await db.rpc("resolve_registry_identity_lineage_v1", {
    p_entity_type: "track",
    p_entity_id: trackId,
    p_max_depth: 16,
  });

  if (error) {
    return {
      inputTrackId: trackId,
      status: "unresolved",
      currentTrackIds: [],
      currentTrackId: null,
    };
  }

  const payload = (data || {}) as Record<string, unknown>;
  const status = String(payload.resolution_status || "unresolved");
  const currentTrackIds = Array.isArray(payload.current_entity_ids)
    ? [...new Set(payload.current_entity_ids.map((id) => String(id || "")).filter(Boolean))].sort()
    : [];

  return {
    inputTrackId: trackId,
    status,
    currentTrackIds,
    currentTrackId:
      (status === "current" || status === "successor") && currentTrackIds.length === 1
        ? currentTrackIds[0]
        : null,
  };
}

async function handleRunCanonicalMatch(
  req: Request,
  db: ReturnType<typeof createClient>,
  params: Record<string, unknown>,
  _user: { id: string; email?: string },
) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const startedAt = Date.now();
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      message: null,
      error_code: null,
      error_message: null,
    })
    .eq("run_id", runId)
    .eq("stage", "canonical_match");

  const [{ data: candidates, error: candidateError }, { data: existingMatches, error: existingMatchError }] =
    await Promise.all([
      db
        .from("chart_ingest_candidates")
        .select("*")
        .eq("run_id", runId)
        .in("status", ["pending", "needs_review", "eligible"]),
      db
        .from("chart_ingest_matches")
        .select("*")
        .eq("run_id", runId),
    ]);

  if (candidateError || existingMatchError) {
    const detail = candidateError?.message || existingMatchError?.message || "candidate_lookup_failed";
    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        message: detail,
        error_code: "canonical_match_lookup_failed",
        error_message: detail,
      })
      .eq("run_id", runId)
      .eq("stage", "canonical_match");
    return json(req, { error: "canonical_match_lookup_failed", detail }, 500);
  }

  const rows = (candidates || []) as Array<Record<string, unknown>>;
  const existingByCandidate = new Map<string, Record<string, unknown>>();
  for (const match of (existingMatches || []) as Array<Record<string, unknown>>) {
    existingByCandidate.set(String(match.candidate_id), match);
  }

  const isrcs = [
    ...new Set(rows.map((candidate) => normalizeIsrc(candidate.isrc)).filter(Boolean)),
  ].sort();

  const trackIdsByIsrc = new Map<string, Set<string>>();
  for (const chunk of chunkStrings(isrcs)) {
    const { data: tracks, error } = await db
      .from("registry_tracks")
      .select("id,isrc,status")
      .in("isrc", chunk);

    if (error) {
      return json(req, { error: "registry_isrc_lookup_failed", detail: error.message }, 500);
    }

    for (const track of tracks || []) {
      const isrc = normalizeIsrc(track.isrc);
      if (!isrc) continue;
      if (!trackIdsByIsrc.has(isrc)) trackIdsByIsrc.set(isrc, new Set<string>());
      trackIdsByIsrc.get(isrc)!.add(String(track.id));
    }
  }

  const providerIdsNeeded = new Map<string, Set<string>>();
  for (const candidate of rows) {
    const providerIds = candidate.provider_ids_json;
    if (!providerIds || typeof providerIds !== "object" || Array.isArray(providerIds)) continue;
    for (const [providerRaw, idsRaw] of Object.entries(providerIds as Record<string, unknown>)) {
      const provider = normalizeProviderKey(providerRaw);
      if (!provider) continue;
      if (!providerIdsNeeded.has(provider)) providerIdsNeeded.set(provider, new Set<string>());
      for (const idRaw of Array.isArray(idsRaw) ? idsRaw : [idsRaw]) {
        const id = compactIdentityPart(idRaw);
        if (id) providerIdsNeeded.get(provider)!.add(id);
      }
    }
  }

  const providerLinkByAlias = new Map<
    string,
    { trackId: string; confidence: number; method: string }
  >();

  for (const [provider, ids] of providerIdsNeeded.entries()) {
    if (ids.size === 0) continue;
    const { data: links, error } = await db
      .from("registry_track_provider_links")
      .select("track_id,provider_key,provider_track_id,match_confidence,match_method")
      .eq("provider_key", provider)
      .eq("match_status", "matched");

    if (error) {
      return json(req, { error: "registry_provider_lookup_failed", detail: error.message }, 500);
    }

    for (const link of links || []) {
      const providerTrackId = compactIdentityPart(link.provider_track_id);
      if (!ids.has(providerTrackId)) continue;
      providerLinkByAlias.set(`${provider}:${providerTrackId}`, {
        trackId: String(link.track_id),
        confidence: Math.max(0, Math.min(100, Math.round(Number(link.match_confidence || 0) * 100))),
        method: String(link.match_method || "provider_id"),
      });
    }
  }

  const now = new Date().toISOString();
  const autoMatches: Array<Record<string, unknown>> = [];
  const noMatchCandidateIds: string[] = [];
  let evidenceMatchedCount = 0;
  let ambiguousEvidenceCount = 0;
  let manualPreservedCount = 0;

  for (const candidate of rows) {
    const candidateId = String(candidate.id);
    const existing = existingByCandidate.get(candidateId);

    if (
      existing &&
      existing.match_method === "manual" &&
      existing.status === "accepted" &&
      existing.canonical_entity_id
    ) {
      manualPreservedCount++;
      continue;
    }

    const trackIds = new Set<string>();
    const reasons: string[] = [];
    let method: "isrc" | "provider_id" | "no_match" = "no_match";
    let confidence = 0;

    const isrc = normalizeIsrc(candidate.isrc);
    if (isrc) {
      const byIsrc = trackIdsByIsrc.get(isrc);
      if (byIsrc && byIsrc.size > 0) {
        method = "isrc";
        confidence = 100;
        reasons.push(`evidence:isrc:${isrc}`);
        for (const trackId of byIsrc) trackIds.add(trackId);
      }
    }

    const providerIds = candidate.provider_ids_json;
    if (providerIds && typeof providerIds === "object" && !Array.isArray(providerIds)) {
      for (const [providerRaw, idsRaw] of Object.entries(providerIds as Record<string, unknown>)) {
        const provider = normalizeProviderKey(providerRaw);
        if (!provider) continue;
        for (const idRaw of Array.isArray(idsRaw) ? idsRaw : [idsRaw]) {
          const id = compactIdentityPart(idRaw);
          if (!id) continue;
          const link = providerLinkByAlias.get(`${provider}:${id}`);
          if (!link) continue;
          if (method === "no_match") method = "provider_id";
          confidence = Math.max(confidence, link.confidence);
          reasons.push(`evidence:provider:${provider}:${id}`);
          trackIds.add(link.trackId);
        }
      }
    }

    const sortedTrackIds = [...trackIds].sort();
    for (const trackId of sortedTrackIds) reasons.push(`candidate_track:${trackId}`);

    if (sortedTrackIds.length === 0) {
      noMatchCandidateIds.push(candidateId);
      autoMatches.push({
        id: existing?.id || crypto.randomUUID(),
        run_id: runId,
        candidate_id: candidateId,
        entity_type: "track",
        canonical_entity_id: null,
        match_method: "no_match",
        confidence: 0,
        status: "needs_review",
        reasons_json: ["No exact Registry Track match from ISRC or matched provider identity."],
        decided_by: null,
        decided_at: null,
        decision_note: null,
        created_at: existing?.created_at || now,
        updated_at: now,
      });
      continue;
    }

    evidenceMatchedCount++;
    if (sortedTrackIds.length > 1) ambiguousEvidenceCount++;

    autoMatches.push({
      id: existing?.id || crypto.randomUUID(),
      run_id: runId,
      candidate_id: candidateId,
      entity_type: "track",
      canonical_entity_id: sortedTrackIds.length === 1 ? sortedTrackIds[0] : null,
      match_method: method,
      confidence,
      status: "pending",
      reasons_json: reasons,
      decided_by: null,
      decided_at: null,
      decision_note: null,
      created_at: existing?.created_at || now,
      updated_at: now,
    });
  }

  const chunkSize = 200;
  for (let i = 0; i < autoMatches.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_matches")
      .upsert(autoMatches.slice(i, i + chunkSize), { onConflict: "run_id,candidate_id" });

    if (error) {
      return json(req, { error: "canonical_match_write_failed", detail: error.message }, 500);
    }
  }

  if (noMatchCandidateIds.length > 0) {
    for (const chunk of chunkStrings(noMatchCandidateIds, 200)) {
      await db
        .from("chart_ingest_candidates")
        .update({ status: "needs_review", updated_at: now })
        .in("id", chunk)
        .eq("run_id", runId);
    }
  }

  const durationMs = Date.now() - startedAt;
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: now,
      duration_ms: durationMs,
      message: `${evidenceMatchedCount} candidates nominated Registry identity; ${noMatchCandidateIds.length} have no exact identifier match.`,
      metrics_json: {
        candidateCount: rows.length,
        evidenceMatchedCount,
        noMatchCount: noMatchCandidateIds.length,
        ambiguousEvidenceCount,
        manualPreservedCount,
      },
    })
    .eq("run_id", runId)
    .eq("stage", "canonical_match");

  return json(req, {
    ok: true,
    runId,
    candidateCount: rows.length,
    evidenceMatchedCount,
    noMatchCount: noMatchCandidateIds.length,
    ambiguousEvidenceCount,
    manualPreservedCount,
    durationMs,
  });
}

async function handleRunEntityResolution(
  req: Request,
  db: ReturnType<typeof createClient>,
  params: Record<string, unknown>,
  _user: { id: string; email?: string },
) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const startedAt = Date.now();
  const now = new Date().toISOString();

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "running",
      started_at: now,
      finished_at: null,
      message: null,
      error_code: null,
      error_message: null,
    })
    .eq("run_id", runId)
    .eq("stage", "entity_resolution");

  const [{ data: candidates, error: candidateError }, { data: matches, error: matchError }] =
    await Promise.all([
      db
        .from("chart_ingest_candidates")
        .select("*")
        .eq("run_id", runId)
        .not("status", "in", '("excluded","ignored")'),
      db
        .from("chart_ingest_matches")
        .select("*")
        .eq("run_id", runId)
        .eq("entity_type", "track"),
    ]);

  if (candidateError || matchError) {
    const detail = candidateError?.message || matchError?.message || "entity_resolution_lookup_failed";
    return json(req, { error: "entity_resolution_lookup_failed", detail }, 500);
  }

  const candidateById = new Map<string, Record<string, unknown>>();
  for (const candidate of (candidates || []) as Array<Record<string, unknown>>) {
    candidateById.set(String(candidate.id), candidate);
  }

  const lineageCache = new Map<string, Awaited<ReturnType<typeof resolveCurrentTrackIdentity>>>();
  const resolutionByCandidate = new Map<string, ChartTrackResolution>();

  for (const match of (matches || []) as Array<Record<string, unknown>>) {
    const candidateId = String(match.candidate_id);
    if (!candidateById.has(candidateId)) continue;

    const inputTrackIds = [
      ...new Set([
        ...candidateTrackIdsFromReasons(match.reasons_json),
        ...(match.canonical_entity_id ? [String(match.canonical_entity_id)] : []),
      ]),
    ].sort();

    if (inputTrackIds.length === 0) {
      resolutionByCandidate.set(candidateId, {
        candidateId,
        inputTrackIds: [],
        currentTrackId: null,
        resolutionStatus: "unresolved",
        blockingReason: "no_registry_match",
      });
      continue;
    }

    const currentIds = new Set<string>();
    const statuses = new Set<string>();
    let blockingReason: string | null = null;

    for (const inputTrackId of inputTrackIds) {
      let lineage = lineageCache.get(inputTrackId);
      if (!lineage) {
        lineage = await resolveCurrentTrackIdentity(db, inputTrackId);
        lineageCache.set(inputTrackId, lineage);
      }

      statuses.add(lineage.status);
      for (const currentId of lineage.currentTrackIds) currentIds.add(currentId);

      if (
        lineage.status === "split" ||
        lineage.status === "retired" ||
        lineage.status === "unresolved" ||
        lineage.status === "cycle" ||
        lineage.status === "max_depth"
      ) {
        blockingReason = `lineage_${lineage.status}`;
      }
    }

    const currentTrackIds = [...currentIds].sort();
    if (currentTrackIds.length !== 1) {
      blockingReason = blockingReason || (
        currentTrackIds.length > 1 ? "multiple_current_tracks" : "no_current_track"
      );
    }

    resolutionByCandidate.set(candidateId, {
      candidateId,
      inputTrackIds,
      currentTrackId: blockingReason === null ? currentTrackIds[0] : null,
      resolutionStatus: [...statuses].sort().join("+") || "unresolved",
      blockingReason,
    });
  }

  const candidatesByCurrentTrack = new Map<string, string[]>();
  for (const resolution of resolutionByCandidate.values()) {
    if (!resolution.currentTrackId) continue;
    if (!candidatesByCurrentTrack.has(resolution.currentTrackId)) {
      candidatesByCurrentTrack.set(resolution.currentTrackId, []);
    }
    candidatesByCurrentTrack.get(resolution.currentTrackId)!.push(resolution.candidateId);
  }

  const matchByCandidate = new Map<string, Record<string, unknown>>();
  for (const match of (matches || []) as Array<Record<string, unknown>>) {
    matchByCandidate.set(String(match.candidate_id), match);
  }

  const methodWeight: Record<string, number> = {
    canonical_history: 60,
    manual: 50,
    isrc: 40,
    provider_id: 30,
    title_artist: 20,
    fuzzy: 10,
    shell: 0,
    no_match: 0,
  };

  const winnerByTrack = new Map<string, string>();
  for (const [trackId, candidateIds] of candidatesByCurrentTrack.entries()) {
    const sorted = [...candidateIds].sort((a, b) => {
      const ma = matchByCandidate.get(a) || {};
      const mb = matchByCandidate.get(b) || {};
      const ca = candidateById.get(a) || {};
      const cb = candidateById.get(b) || {};
      const methodDelta =
        (methodWeight[String(mb.match_method || "")] || 0) -
        (methodWeight[String(ma.match_method || "")] || 0);
      if (methodDelta !== 0) return methodDelta;
      const confidenceDelta = Number(mb.confidence || 0) - Number(ma.confidence || 0);
      if (confidenceDelta !== 0) return confidenceDelta;
      const sourceDelta = Number(cb.source_count || 0) - Number(ca.source_count || 0);
      if (sourceDelta !== 0) return sourceDelta;
      return a.localeCompare(b);
    });
    winnerByTrack.set(trackId, sorted[0]);
  }

  const matchUpdates: Array<Record<string, unknown>> = [];
  const candidateUpdates: Array<{
    id: string;
    status: string;
    merged?: Record<string, unknown>;
  }> = [];
  const reviewIssues: Array<Record<string, unknown>> = [];
  let acceptedCount = 0;
  let supersededCount = 0;
  let reviewCount = 0;

  for (const candidate of (candidates || []) as Array<Record<string, unknown>>) {
    const candidateId = String(candidate.id);
    const match = matchByCandidate.get(candidateId);
    const resolution = resolutionByCandidate.get(candidateId);

    if (!match || !resolution || !resolution.currentTrackId) {
      reviewCount++;
      const issueType =
        resolution?.blockingReason === "multiple_current_tracks" ||
        resolution?.blockingReason?.startsWith("lineage_split")
          ? "multiple_close_matches"
          : "no_registry_match";

      if (match) {
        matchUpdates.push({
          id: match.id,
          run_id: runId,
          candidate_id: candidateId,
          entity_type: "track",
          canonical_entity_id: null,
          match_method: match.match_method || "no_match",
          confidence: Number(match.confidence || 0),
          status: "needs_review",
          reasons_json: [
            ...(Array.isArray(match.reasons_json) ? match.reasons_json : []),
            `entity_resolution:${resolution?.blockingReason || "unresolved"}`,
          ],
          decided_by: match.decided_by || null,
          decided_at: match.decided_at || null,
          decision_note: match.decision_note || null,
          created_at: match.created_at || now,
          updated_at: now,
        });
      }

      candidateUpdates.push({ id: candidateId, status: "needs_review" });
      reviewIssues.push({
        id: crypto.randomUUID(),
        run_id: runId,
        candidate_id: candidateId,
        issue_type: issueType,
        severity: "error",
        blocking: true,
        message:
          issueType === "multiple_close_matches"
            ? "Candidate identity resolves to multiple current Registry Tracks and requires review."
            : "Candidate does not resolve to exactly one current Registry Track.",
        status: "open",
        created_at: now,
        updated_at: now,
      });
      continue;
    }

    const winnerId = winnerByTrack.get(resolution.currentTrackId);
    const isWinner = winnerId === candidateId;

    if (!isWinner) {
      supersededCount++;
      matchUpdates.push({
        id: match.id,
        run_id: runId,
        candidate_id: candidateId,
        entity_type: "track",
        canonical_entity_id: resolution.currentTrackId,
        match_method: match.match_method,
        confidence: Number(match.confidence || 0),
        status: "superseded",
        reasons_json: [
          ...(Array.isArray(match.reasons_json) ? match.reasons_json : []),
          `entity_resolution:${resolution.resolutionStatus}`,
          `canonical_duplicate_of:${winnerId}`,
        ],
        decided_by: match.decided_by || null,
        decided_at: match.decided_at || null,
        decision_note: `Merged into candidate ${winnerId} after Registry UUID convergence.`,
        created_at: match.created_at || now,
        updated_at: now,
      });
      candidateUpdates.push({ id: candidateId, status: "ignored" });
      continue;
    }

    const duplicateIds = (candidatesByCurrentTrack.get(resolution.currentTrackId) || [])
      .filter((id) => id !== candidateId);
    const duplicateCandidates = duplicateIds
      .map((id) => candidateById.get(id))
      .filter(Boolean) as Array<Record<string, unknown>>;
    const allCandidates = [candidate, ...duplicateCandidates];
    const mergedProviderIds = mergeProviderIdsJson(
      allCandidates.map((row) => row.provider_ids_json),
    );
    const providerSourceCount = Object.keys(mergedProviderIds).length;
    const mergedSourceUrls = [
      ...new Set(
        allCandidates.flatMap((row) =>
          Array.isArray(row.source_urls_seen)
            ? row.source_urls_seen.map((url) => String(url || "")).filter(Boolean)
            : [],
        ),
      ),
    ].sort();

    acceptedCount++;
    matchUpdates.push({
      id: match.id,
      run_id: runId,
      candidate_id: candidateId,
      entity_type: "track",
      canonical_entity_id: resolution.currentTrackId,
      match_method: match.match_method,
      confidence: Number(match.confidence || 0),
      status: "accepted",
      reasons_json: [
        ...(Array.isArray(match.reasons_json) ? match.reasons_json : []),
        `entity_resolution:${resolution.resolutionStatus}`,
        `canonical_track:${resolution.currentTrackId}`,
      ],
      decided_by: match.decided_by || null,
      decided_at: match.decided_at || null,
      decision_note: match.decision_note || null,
      created_at: match.created_at || now,
      updated_at: now,
    });
    candidateUpdates.push({
      id: candidateId,
      status: "pending",
      merged: {
        source_count:
          providerSourceCount > 0
            ? providerSourceCount
            : Math.max(...allCandidates.map((row) => Number(row.source_count || 0))),
        occurrence_count: allCandidates.reduce(
          (sum, row) => sum + Number(row.occurrence_count || 0),
          0,
        ),
        source_urls_seen: mergedSourceUrls,
        provider_ids_json: mergedProviderIds,
        streaming_qualified: allCandidates.some((row) => Boolean(row.streaming_qualified)),
        carry_forward_only: allCandidates.every((row) => Boolean(row.carry_forward_only)),
        updated_at: now,
      },
    });
  }

  await db
    .from("chart_ingest_review_issues")
    .delete()
    .eq("run_id", runId)
    .eq("status", "open")
    .in("issue_type", ["no_registry_match", "multiple_close_matches"]);

  const chunkSize = 200;
  for (let i = 0; i < matchUpdates.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_matches")
      .upsert(matchUpdates.slice(i, i + chunkSize), { onConflict: "run_id,candidate_id" });
    if (error) return json(req, { error: "entity_resolution_match_write_failed", detail: error.message }, 500);
  }

  for (const update of candidateUpdates) {
    await db
      .from("chart_ingest_candidates")
      .update({ status: update.status, ...(update.merged || {}), updated_at: now })
      .eq("run_id", runId)
      .eq("id", update.id);
  }

  for (let i = 0; i < reviewIssues.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_review_issues")
      .insert(reviewIssues.slice(i, i + chunkSize));
    if (error) return json(req, { error: "entity_resolution_review_write_failed", detail: error.message }, 500);
  }

  const durationMs = Date.now() - startedAt;
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: now,
      duration_ms: durationMs,
      message: `${acceptedCount} canonical Track UUIDs accepted; ${supersededCount} duplicate candidates folded into canonical identity; ${reviewCount} require review.`,
      metrics_json: {
        acceptedCount,
        supersededCount,
        reviewCount,
        currentTrackCount: winnerByTrack.size,
      },
    })
    .eq("run_id", runId)
    .eq("stage", "entity_resolution");

  return json(req, {
    ok: true,
    runId,
    acceptedCount,
    supersededCount,
    reviewCount,
    currentTrackCount: winnerByTrack.size,
    durationMs,
  });
}

// CARRY_FORWARD
async function handleRunCarryForward(
  req: Request,
  db: ReturnType<typeof createClient>,
  params: Record<string, unknown>,
  _user: { id: string; email?: string },
) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const startedAt = Date.now();
  const now = new Date().toISOString();
  const { data: run, error: runError } = await db
    .from("chart_ingest_runs")
    .select("id,status,edition_date,chart_size,program_id,series_slug")
    .eq("id", runId)
    .maybeSingle();

  if (runError) return json(req, { error: "run_lookup_failed", detail: runError.message }, 500);
  if (!run) return json(req, { error: "run_not_found" }, 404);

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "running",
      started_at: now,
      finished_at: null,
      message: null,
      error_code: null,
      error_message: null,
    })
    .eq("run_id", runId)
    .eq("stage", "carry_forward");

  const editionDate =
    (run.edition_date as string) || new Date().toISOString().split("T")[0];
  const programId = (run.program_id as string) || "unknown";

  const { data: acceptedMatches, error: acceptedMatchError } = await db
    .from("chart_ingest_matches")
    .select("canonical_entity_id")
    .eq("run_id", runId)
    .eq("entity_type", "track")
    .eq("status", "accepted")
    .not("canonical_entity_id", "is", null);

  if (acceptedMatchError) {
    return json(req, {
      error: "carry_forward_fresh_identity_lookup_failed",
      detail: acceptedMatchError.message,
    }, 500);
  }

  const freshTrackIds = new Set(
    (acceptedMatches || [])
      .map((match) => String(match.canonical_entity_id || ""))
      .filter(Boolean),
  );

  const { data: previousEdition, error: previousEditionError } = await db
    .from("wk_chart_editions_v2")
    .select("id")
    .eq("program_id", programId)
    .in("status", ["committed", "published"])
    .lt("edition_date", editionDate)
    .order("edition_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousEditionError) {
    return json(req, {
      error: "carry_forward_previous_edition_lookup_failed",
      detail: previousEditionError.message,
    }, 500);
  }

  if (!previousEdition) {
    const durationMs = Date.now() - startedAt;
    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "done",
        finished_at: now,
        duration_ms: durationMs,
        message: "No previous canonical Chart edition exists for carry-forward.",
        metrics_json: {
          freshTrackCount: freshTrackIds.size,
          previousEntryCount: 0,
          carryForwardCount: 0,
        },
      })
      .eq("run_id", runId)
      .eq("stage", "carry_forward");

    return json(req, {
      ok: true,
      runId,
      carryForwardCount: 0,
      freshEvidenceCount: freshTrackIds.size,
      previousEntryCount: 0,
      skippedExistingCount: 0,
      lineageReviewCount: 0,
      durationMs,
    });
  }

  const { data: previousEntries, error: previousEntryError } = await db
    .from("wk_chart_entries_v2")
    .select(
      "canonical_track_id,normalized_key,rank,track_title,artist_name,release_date,track_slug,artist_slug,artwork_url",
    )
    .eq("edition_id", previousEdition.id)
    .order("rank", { ascending: true });

  if (previousEntryError) {
    return json(req, {
      error: "carry_forward_previous_entries_lookup_failed",
      detail: previousEntryError.message,
    }, 500);
  }

  const entries = (previousEntries || []) as Array<Record<string, unknown>>;
  const lineageCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveCurrentTrackIdentity>>
  >();
  const carriedCurrentIds = new Set<string>();
  const candidates: Array<Record<string, unknown>> = [];
  const matches: Array<Record<string, unknown>> = [];
  const reviewIssues: Array<Record<string, unknown>> = [];
  let skippedExistingCount = 0;
  let lineageReviewCount = 0;

  for (const entry of entries) {
    const historicalTrackId = String(entry.canonical_track_id || "").trim();
    const normalizedKey = String(entry.normalized_key || "");

    if (!historicalTrackId) {
      lineageReviewCount++;
      continue;
    }

    let lineage = lineageCache.get(historicalTrackId);
    if (!lineage) {
      lineage = await resolveCurrentTrackIdentity(db, historicalTrackId);
      lineageCache.set(historicalTrackId, lineage);
    }

    const candidateId = crypto.randomUUID();

    if (!lineage.currentTrackId) {
      lineageReviewCount++;
      candidates.push({
        id: candidateId,
        run_id: runId,
        normalized_key: normalizedKey,
        lead_artist_key: normalizedKey.split("::")[1] || "",
        title: String(entry.track_title || ""),
        artist_display: String(entry.artist_name || ""),
        source_count: 0,
        source_urls_seen: [],
        occurrence_count: 0,
        provider_ids_json: {},
        release_date: sanitizeDate(entry.release_date as string),
        candidate_type: "carry_forward",
        status: "needs_review",
        version: 1,
        carry_forward_only: true,
        continuity_locked: false,
        airplay_candidate_only: false,
        streaming_qualified: false,
        isrc: null,
        upc: null,
        artwork_url: entry.artwork_url || null,
        external_url: null,
        preview_url: null,
        release_title: null,
        created_at: now,
        updated_at: now,
      });
      matches.push({
        id: crypto.randomUUID(),
        run_id: runId,
        candidate_id: candidateId,
        entity_type: "track",
        canonical_entity_id: historicalTrackId,
        match_method: "canonical_history",
        confidence: 100,
        status: "needs_review",
        reasons_json: [
          `canonical_history:${historicalTrackId}`,
          `entity_resolution:${lineage.status}`,
        ],
        decided_by: null,
        decided_at: null,
        decision_note: null,
        created_at: now,
        updated_at: now,
      });
      reviewIssues.push({
        id: crypto.randomUUID(),
        run_id: runId,
        candidate_id: candidateId,
        issue_type: "carry_forward_stale",
        severity: "error",
        blocking: true,
        message: `Previous Chart Track ${historicalTrackId} no longer resolves to exactly one current Registry Track.`,
        status: "open",
        created_at: now,
        updated_at: now,
      });
      continue;
    }

    const currentTrackId = lineage.currentTrackId;
    if (freshTrackIds.has(currentTrackId) || carriedCurrentIds.has(currentTrackId)) {
      skippedExistingCount++;
      continue;
    }

    carriedCurrentIds.add(currentTrackId);
    candidates.push({
      id: candidateId,
      run_id: runId,
      normalized_key: normalizedKey,
      lead_artist_key: normalizedKey.split("::")[1] || "",
      title: String(entry.track_title || ""),
      artist_display: String(entry.artist_name || ""),
      source_count: 0,
      source_urls_seen: [],
      occurrence_count: 0,
      provider_ids_json: {},
      release_date: sanitizeDate(entry.release_date as string),
      candidate_type: "carry_forward",
      status: "pending",
      version: 1,
      carry_forward_only: true,
      continuity_locked: false,
      airplay_candidate_only: false,
      streaming_qualified: false,
      isrc: null,
      upc: null,
      artwork_url: entry.artwork_url || null,
      external_url: null,
      preview_url: null,
      release_title: null,
      created_at: now,
      updated_at: now,
    });
    matches.push({
      id: crypto.randomUUID(),
      run_id: runId,
      candidate_id: candidateId,
      entity_type: "track",
      canonical_entity_id: currentTrackId,
      match_method: "canonical_history",
      confidence: 100,
      status: "accepted",
      reasons_json: [
        `canonical_history:${historicalTrackId}`,
        `entity_resolution:${lineage.status}`,
        `canonical_track:${currentTrackId}`,
      ],
      decided_by: null,
      decided_at: null,
      decision_note: null,
      created_at: now,
      updated_at: now,
    });
  }

  const chunkSize = 200;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_candidates")
      .insert(candidates.slice(i, i + chunkSize));
    if (error) {
      return json(req, { error: "carry_forward_candidate_insert_failed", detail: error.message }, 500);
    }
  }

  for (let i = 0; i < matches.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_matches")
      .insert(matches.slice(i, i + chunkSize));
    if (error) {
      return json(req, { error: "carry_forward_match_insert_failed", detail: error.message }, 500);
    }
  }

  for (let i = 0; i < reviewIssues.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_review_issues")
      .insert(reviewIssues.slice(i, i + chunkSize));
    if (error) {
      return json(req, { error: "carry_forward_review_insert_failed", detail: error.message }, 500);
    }
  }

  const durationMs = Date.now() - startedAt;
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      message:
        carriedCurrentIds.size > 0
          ? `${carriedCurrentIds.size} canonical Track UUIDs carried forward from ${entries.length} previous entries.`
          : "No canonical Track UUID required carry-forward.",
      metrics_json: {
        carryForwardCount: carriedCurrentIds.size,
        freshTrackCount: freshTrackIds.size,
        previousEntryCount: entries.length,
        skippedExistingCount,
        lineageReviewCount,
      },
    })
    .eq("run_id", runId)
    .eq("stage", "carry_forward");

  return json(req, {
    ok: true,
    runId,
    carryForwardCount: carriedCurrentIds.size,
    freshEvidenceCount: freshTrackIds.size,
    previousEntryCount: entries.length,
    skippedExistingCount,
    lineageReviewCount,
    durationMs,
  });
}

// ELIGIBILITY (v25 — ALL-ARTIST ORIGIN FILTER)
async function handleRunEligibility(
  req: Request,
  db: ReturnType<typeof createClient>,
  params: Record<string, unknown>,
  _user: { id: string; email?: string },
) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const startedAt = Date.now();
  const now = new Date().toISOString();

  const { data: run, error: runError } = await db
    .from("chart_ingest_runs")
    .select("id,status,market_scope_snapshot_json")
    .eq("id", runId)
    .maybeSingle();

  if (runError) return json(req, { error: "run_lookup_failed", detail: runError.message }, 500);
  if (!run) return json(req, { error: "run_not_found" }, 404);

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "running",
      started_at: now,
      finished_at: null,
      message: null,
      error_code: null,
      error_message: null,
    })
    .eq("run_id", runId)
    .eq("stage", "eligibility_execution");

  await db
    .from("chart_ingest_exclusions")
    .delete()
    .eq("run_id", runId)
    .eq("source_stage", "eligibility_execution");

  const [{ data: candidates, error: candidateError }, { data: acceptedMatches, error: matchError }] =
    await Promise.all([
      db.from("chart_ingest_candidates").select("*").eq("run_id", runId),
      db
        .from("chart_ingest_matches")
        .select("candidate_id,canonical_entity_id,status,entity_type")
        .eq("run_id", runId)
        .eq("entity_type", "track")
        .eq("status", "accepted")
        .not("canonical_entity_id", "is", null),
    ]);

  if (candidateError || matchError) {
    const detail = candidateError?.message || matchError?.message || "eligibility_lookup_failed";
    return json(req, { error: "eligibility_lookup_failed", detail }, 500);
  }

  const rows = (candidates || []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    const durationMs = Date.now() - startedAt;
    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "done",
        finished_at: now,
        duration_ms: durationMs,
        message: "No candidates.",
      })
      .eq("run_id", runId)
      .eq("stage", "eligibility_execution");

    return json(req, {
      ok: true,
      runId,
      candidateCount: 0,
      excludedCount: 0,
      inputRowCount: 0,
      identityReviewCount: 0,
      durationMs,
    });
  }

  const canonicalTrackByCandidate = new Map<string, string>();
  for (const match of acceptedMatches || []) {
    canonicalTrackByCandidate.set(
      String(match.candidate_id),
      String(match.canonical_entity_id),
    );
  }

  const identityReviewIds: string[] = [];
  const policyEligibleIds: string[] = [];
  const policyExcluded: Array<{ id: string; reasons: string[] }> = [];

  for (const candidate of rows) {
    const candidateId = String(candidate.id);
    const status = String(candidate.status || "pending");

    if (status === "excluded" || status === "ignored") continue;

    if (!canonicalTrackByCandidate.has(candidateId)) {
      identityReviewIds.push(candidateId);
      continue;
    }

    const reasons: string[] = [];
    const normalizedKey = String(candidate.normalized_key || "");
    const title = String(candidate.title || "");
    const artist = String(candidate.artist_display || "");
    const sourceCount = Number(candidate.source_count || 0);
    const carryForwardOnly = Boolean(candidate.carry_forward_only);
    const airplayCandidateOnly = Boolean(candidate.airplay_candidate_only);
    const streamingQualified = Boolean(candidate.streaming_qualified);

    if (!normalizedKey || !normalizedKey.includes("::")) reasons.push("invalid_normalized_key");
    if (!title.trim()) reasons.push("missing_title");
    if (!artist.trim()) reasons.push("missing_artist");
    if (
      !carryForwardOnly &&
      !airplayCandidateOnly &&
      !streamingQualified &&
      sourceCount < 1
    ) {
      reasons.push("no_streaming_sources");
    }

    if (reasons.length === 0) policyEligibleIds.push(candidateId);
    else policyExcluded.push({ id: candidateId, reasons });
  }

  const chunkSize = 200;

  for (const chunk of chunkStrings(identityReviewIds, chunkSize)) {
    await db
      .from("chart_ingest_candidates")
      .update({ status: "needs_review", updated_at: now })
      .in("id", chunk)
      .eq("run_id", runId);
  }

  for (const chunk of chunkStrings(policyEligibleIds, chunkSize)) {
    await db
      .from("chart_ingest_candidates")
      .update({ status: "eligible", updated_at: now })
      .in("id", chunk)
      .eq("run_id", runId);
  }

  const exclusionRows: Array<Record<string, unknown>> = [];
  for (const excluded of policyExcluded) {
    await db
      .from("chart_ingest_candidates")
      .update({ status: "excluded", updated_at: now })
      .eq("run_id", runId)
      .eq("id", excluded.id);

    exclusionRows.push({
      id: crypto.randomUUID(),
      run_id: runId,
      candidate_id: excluded.id,
      reason_code: excluded.reasons[0] || "eligibility_failed",
      reason_label: excluded.reasons.join("; "),
      severity: "hard",
      source_stage: "eligibility_execution",
      details_json: { reasons: excluded.reasons },
      created_at: now,
    });
  }

  for (let i = 0; i < exclusionRows.length; i += chunkSize) {
    const { error } = await db
      .from("chart_ingest_exclusions")
      .insert(exclusionRows.slice(i, i + chunkSize));
    if (error) {
      return json(req, { error: "eligibility_exclusion_write_failed", detail: error.message }, 500);
    }
  }

  const marketScope = (run.market_scope_snapshot_json as Record<string, unknown>) || {};
  let originCountries = (marketScope.artistOriginCountries as string[]) || [];

  if (originCountries.length === 0) {
    const includedMarkets =
      (marketScope.includedMarkets as Array<{ countryCode?: string }>) || [];
    for (const market of includedMarkets) {
      if (market.countryCode) originCountries.push(market.countryCode.toUpperCase());
    }
  }

  const unknownMode = String(marketScope.artistOriginUnknownMode || "exclude");
  let originExcludedCount = 0;
  let originUnknownCount = 0;

  if (originCountries.length > 0 && policyEligibleIds.length > 0) {
    const allowedOrigins = new Set(originCountries.map((code) => normalizeIso2(code)));
    const eligibleTrackIds = [
      ...new Set(
        policyEligibleIds
          .map((candidateId) => canonicalTrackByCandidate.get(candidateId) || "")
          .filter(Boolean),
      ),
    ];

    const trackArtistIds = new Map<string, Set<string>>();
    for (const chunk of chunkStrings(eligibleTrackIds, 150)) {
      const { data: credits, error } = await db
        .from("registry_track_artists")
        .select("track_id,artist_id,status")
        .in("track_id", chunk)
        .eq("status", "active");

      if (error) {
        return json(req, { error: "eligibility_track_artist_lookup_failed", detail: error.message }, 500);
      }

      for (const credit of credits || []) {
        const trackId = String(credit.track_id || "");
        const artistId = String(credit.artist_id || "");
        if (!trackId || !artistId) continue;
        if (!trackArtistIds.has(trackId)) trackArtistIds.set(trackId, new Set<string>());
        trackArtistIds.get(trackId)!.add(artistId);
      }
    }

    const artistIds = [
      ...new Set(
        [...trackArtistIds.values()].flatMap((ids) => [...ids]),
      ),
    ];

    const originByArtist = new Map<string, string | null>();
    for (const chunk of chunkStrings(artistIds, 150)) {
      const { data: artists, error } = await db
        .from("registry_artists")
        .select("id,origin_iso2,status")
        .in("id", chunk)
        .eq("status", "active");

      if (error) {
        return json(req, { error: "eligibility_artist_origin_lookup_failed", detail: error.message }, 500);
      }

      for (const artist of artists || []) {
        originByArtist.set(
          String(artist.id),
          artist.origin_iso2 ? normalizeIso2(String(artist.origin_iso2)) : null,
        );
      }
    }

    const originExcludedIds: string[] = [];
    const originExclusions: Array<Record<string, unknown>> = [];

    for (const candidateId of policyEligibleIds) {
      const trackId = canonicalTrackByCandidate.get(candidateId);
      if (!trackId) continue;

      const creditedArtists = [...(trackArtistIds.get(trackId) || new Set<string>())];
      const knownOrigins = creditedArtists
        .map((artistId) => originByArtist.get(artistId) || null)
        .filter(Boolean) as string[];

      if (knownOrigins.some((origin) => allowedOrigins.has(origin))) continue;
      if (knownOrigins.length === 0 && unknownMode === "include") continue;

      originExcludedIds.push(candidateId);
      if (knownOrigins.length === 0) originUnknownCount++;
      else originExcludedCount++;

      originExclusions.push({
        id: crypto.randomUUID(),
        run_id: runId,
        candidate_id: candidateId,
        reason_code:
          knownOrigins.length === 0 ? "missing_artist_country" : "country_mismatch",
        reason_label:
          knownOrigins.length === 0
            ? "Canonical Track credits do not yet provide a known Artist origin."
            : "Canonical Track Artist origins do not match this Chart market.",
        severity: "hard",
        source_stage: "eligibility_execution",
        details_json: {
          canonicalTrackId: trackId,
          artistIds: creditedArtists,
          knownOrigins,
          allowedOrigins: [...allowedOrigins],
          unknownMode,
        },
        created_at: now,
      });
    }

    for (const chunk of chunkStrings(originExcludedIds, chunkSize)) {
      await db
        .from("chart_ingest_candidates")
        .update({ status: "excluded", updated_at: now })
        .in("id", chunk)
        .eq("run_id", runId);
    }

    for (let i = 0; i < originExclusions.length; i += chunkSize) {
      const { error } = await db
        .from("chart_ingest_exclusions")
        .insert(originExclusions.slice(i, i + chunkSize));
      if (error) {
        return json(req, { error: "eligibility_origin_exclusion_write_failed", detail: error.message }, 500);
      }
    }
  }

  const { count: finalEligibleCount } = await db
    .from("chart_ingest_candidates")
    .select("*", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("status", "eligible");

  const durationMs = Date.now() - startedAt;
  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      message: `${finalEligibleCount || 0} UUID-resolved candidates eligible; ${policyExcluded.length + originExcludedCount + originUnknownCount} policy-excluded; ${identityReviewIds.length} identity-review.`,
      metrics_json: {
        candidateCount: rows.length,
        acceptedIdentityCount: canonicalTrackByCandidate.size,
        eligibleCount: finalEligibleCount || 0,
        policyExcludedCount: policyExcluded.length,
        originExcludedCount,
        originUnknownCount,
        identityReviewCount: identityReviewIds.length,
      },
    })
    .eq("run_id", runId)
    .eq("stage", "eligibility_execution");

  return json(req, {
    ok: true,
    runId,
    candidateCount: rows.length,
    excludedCount: policyExcluded.length + originExcludedCount + originUnknownCount,
    inputRowCount: rows.length,
    originExcludedCount,
    originUnknownCount,
    identityReviewCount: identityReviewIds.length,
    eligibleCount: finalEligibleCount || 0,
    durationMs,
  });
}

// SCORING
async function handleRunScoring(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now(); const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString() }).eq("run_id", runId).eq("stage", "methodology_scoring"); const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const pid = (run.program_id as string) || "unknown"; const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).eq("status", "eligible"); if (!candidates || candidates.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: "No eligible candidates." }).eq("run_id", runId).eq("stage", "methodology_scoring"); return json(req, { ok: true, runId, scoredCount: 0, overflowCount: 0, durationMs: d }); } let pm = new Map<string, number>(); try { const { data: pe } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", pid).in("status", ["committed","published"]).lt("edition_date", ed).order("edition_date", { ascending: false }).limit(1).maybeSingle(); if (pe) { const { data: pes } = await db.from("wk_chart_entries_v2").select("normalized_key, rank").eq("edition_id", pe.id); if (pes) { for (const p of pes) { if (p.normalized_key) pm.set(p.normalized_key, p.rank as number); } } } } catch { } const scfg = { cross_source_mode: "standard" as const, cross_source_weight: 1.0, continuity_weight: 1.0, carry_forward_weight: 1.0, overlap_bonus_cap: 10 }; const scored: Array<{ candidate_id: string; normalized_key: string; lead_artist_key: string; source_score: number; cross_source_bonus: number; overlap_bonus: number; recency_score: number; continuity_score: number; carry_forward_bonus: number; airplay_score: number; provisional_total: number; recency_days: number | null; previous_position: number | null; source_count: number; occurrence_count: number; is_carry_forward: boolean; is_airplay_candidate: boolean }> = []; for (const c of candidates) { const pp = pm.get((c.normalized_key as string) || "") ?? null; const bd = computeProvisionalScore({ normalized_key: (c.normalized_key as string) || "", lead_artist_key: (c.lead_artist_key as string) || "", source_count: (c.source_count as number) || 0, occurrence_count: (c.occurrence_count as number) || 0, release_date: (c.release_date as string) || null, carry_forward_only: !!(c.carry_forward_only), continuity_locked: !!(c.continuity_locked), airplay_candidate_only: !!(c.airplay_candidate_only) }, ed, pp, scfg, null); scored.push({ candidate_id: c.id as string, normalized_key: c.normalized_key as string, lead_artist_key: (c.lead_artist_key as string) || "", source_score: bd.source_score, cross_source_bonus: bd.cross_source_bonus, overlap_bonus: bd.overlap_bonus, recency_score: bd.recency_score, continuity_score: bd.continuity_score, carry_forward_bonus: bd.carry_forward_bonus, airplay_score: bd.airplay_score, provisional_total: bd.provisional_total, recency_days: bd.recency_days, previous_position: pp, source_count: (c.source_count as number) || 0, occurrence_count: (c.occurrence_count as number) || 0, is_carry_forward: !!(c.carry_forward_only), is_airplay_candidate: !!(c.airplay_candidate_only) }); } const ags = computeAntiGamingPenalties(scored.map(s => ({ normalized_key: s.normalized_key, lead_artist_key: s.lead_artist_key, provisional_total: s.provisional_total })), 3, 8); const agbk = new Map(ags.map(r => [r.normalized_key, r])); const n2 = new Date().toISOString(); const srs: Array<Record<string, unknown>> = []; let oc = 0; for (const s of scored) { const ag = agbk.get(s.normalized_key) ?? { anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 }; const fs = round4(s.provisional_total - ag.anti_gaming_penalty); if (ag.lead_artist_overflow) oc++; srs.push({ id: crypto.randomUUID(), run_id: runId, candidate_id: s.candidate_id, source_score: s.source_score, cross_source_bonus: s.cross_source_bonus, overlap_bonus: s.overlap_bonus, recency_score: s.recency_score, continuity_score: s.continuity_score, carry_forward_bonus: s.carry_forward_bonus, anti_gaming_penalty: ag.anti_gaming_penalty, final_score: fs, source_count: s.source_count, occurrence_count: s.occurrence_count, recency_days: s.recency_days, previous_position: s.previous_position, normalized_key: s.normalized_key, score_integrity_ok: Math.abs(round4((s.source_score + s.cross_source_bonus + s.overlap_bonus + s.recency_score + s.continuity_score + s.carry_forward_bonus + s.airplay_score - ag.anti_gaming_penalty) - fs)) < 0.001, score_integrity_delta: round4((s.source_score + s.cross_source_bonus + s.overlap_bonus + s.recency_score + s.continuity_score + s.carry_forward_bonus + s.airplay_score - ag.anti_gaming_penalty) - fs), score_payload_json: { source_score: s.source_score, cross_source_bonus: s.cross_source_bonus, overlap_bonus: s.overlap_bonus, recency_score: s.recency_score, continuity_score: s.continuity_score, carry_forward_bonus: s.carry_forward_bonus, airplay_score: s.airplay_score, anti_gaming_penalty: ag.anti_gaming_penalty, final_score: fs, source_count: s.source_count, occurrence_count: s.occurrence_count, recency_days: s.recency_days, previous_position: s.previous_position }, anti_gaming_json: { anti_gaming_penalty: ag.anti_gaming_penalty, lead_artist_overflow: ag.lead_artist_overflow, overflow_index: ag.overflow_index }, created_at: n2 }); } await db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId); const SCH = 200; for (let j = 0; j < srs.length; j += SCH) {
    const { error: scoreInsertErr } = await db.from("chart_ingest_candidate_scores").insert(srs.slice(j, j + SCH));
    if (scoreInsertErr) {
      const d = Date.now() - ss;
      await db.from("chart_ingest_stage_events").update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: d, message: "Score insert failed: "+scoreInsertErr.message, error_code: "score_insert_failed", error_message: scoreInsertErr.message }).eq("run_id", runId).eq("stage", "methodology_scoring");
      await db.from("chart_ingest_runs").update({ status: "failed", error_code: "score_insert_failed", error_message: scoreInsertErr.message, updated_at: new Date().toISOString() }).eq("id", runId);
      return json(req, { ok: false, runId, error: "score_insert_failed", detail: scoreInsertErr.message }, 500);
    }
  }

  const nonzeroScoreCount = srs.filter((r) => Number(r.final_score) > 0).length;
  if (nonzeroScoreCount === 0) {
    const d = Date.now() - ss;
    await db.from("chart_ingest_stage_events").update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: d, message: "Scoring produced zero nonzero scores.", error_code: "zero_score_output", error_message: "All candidate final_score values were zero." }).eq("run_id", runId).eq("stage", "methodology_scoring");
    await db.from("chart_ingest_runs").update({ status: "failed", error_code: "zero_score_output", error_message: "All candidate final_score values were zero.", updated_at: new Date().toISOString() }).eq("id", runId);
    return json(req, { ok: false, runId, error: "zero_score_output", scoredCount: scored.length, nonzeroScoreCount }, 400);
  }

  const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: scored.length+" scored, "+nonzeroScoreCount+" nonzero, "+oc+" overflows.", metrics_json: { scoredCount: scored.length, nonzeroScoreCount, overflowCount: oc } }).eq("run_id", runId).eq("stage", "methodology_scoring"); await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: 0, message: "Anti-gaming done." }).eq("run_id", runId).eq("stage", "anti_gaming"); return json(req, { ok: true, runId, scoredCount: scored.length, nonzeroScoreCount, overflowCount: oc, airplayTrackCount: 0, durationMs: d }); }

// SHORTLIST
async function handleRunShortlist(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const ss = Date.now();
  const { data: run } = await db
    .from("chart_ingest_runs")
    .select("id,status,edition_date,chart_size")
    .eq("id", runId)
    .maybeSingle();

  if (!run) return json(req, { error: "run_not_found" }, 404);

  await db
    .from("chart_ingest_stage_events")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("run_id", runId)
    .eq("stage", "shortlist");

  const csz = (run.chart_size as number) || 20;

  const { data: candidates } = await db
    .from("chart_ingest_candidates")
    .select("*")
    .eq("run_id", runId)
    .eq("status", "eligible");

  if (!candidates || candidates.length === 0) {
    const d = Date.now() - ss;
    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        duration_ms: d,
        message: "No eligible.",
      })
      .eq("run_id", runId)
      .eq("stage", "shortlist");

    return json(req, {
      ok: true,
      runId,
      shortlistedCount: 0,
      totalScored: 0,
      excludedCount: 0,
      durationMs: d,
    });
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.id as string));

  const { data: scoreRows, error: scoreErr } = await db
    .from("chart_ingest_candidate_scores")
    .select("*")
    .eq("run_id", runId);

  if (scoreErr) {
    const d = Date.now() - ss;

    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: d,
        message: "Shortlist score lookup failed: " + scoreErr.message,
        error_code: "shortlist_score_lookup_failed",
        error_message: scoreErr.message,
      })
      .eq("run_id", runId)
      .eq("stage", "shortlist");

    await db
      .from("chart_ingest_runs")
      .update({
        status: "failed",
        error_code: "shortlist_score_lookup_failed",
        error_message: scoreErr.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return json(req, {
      ok: false,
      runId,
      error: "shortlist_score_lookup_failed",
      detail: scoreErr.message,
      durationMs: d,
    }, 500);
  }

  const scores = (scoreRows || []).filter((score) =>
    candidateIds.has(score.candidate_id as string)
  );

  const nonzeroScores = (scores || []).filter((s) => Number(s.final_score) > 0).length;

  if (!scores || scores.length === 0 || nonzeroScores === 0) {
    const d = Date.now() - ss;
    const detail = !scores || scores.length === 0
      ? "No score rows exist for eligible candidates."
      : "All score rows have final_score = 0.";

    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: d,
        message: "Shortlist blocked: " + detail,
        error_code: "shortlist_missing_scores",
        error_message: detail,
      })
      .eq("run_id", runId)
      .eq("stage", "shortlist");

    await db
      .from("chart_ingest_runs")
      .update({
        status: "failed",
        error_code: "shortlist_missing_scores",
        error_message: detail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return json(req, {
      ok: false,
      runId,
      error: "shortlist_missing_scores",
      detail,
      shortlistedCount: 0,
      totalScored: scores?.length || 0,
      nonzeroScoreCount: nonzeroScores,
      durationMs: d,
    }, 400);
  }

  const { data: originRows, error: originErr } = await db.rpc(
    "chart_get_run_candidate_origin_report",
    { p_run_id: runId },
  );

  if (originErr) {
    const d = Date.now() - ss;

    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: d,
        message: "Shortlist origin filter failed: " + originErr.message,
        error_code: "shortlist_origin_filter_failed",
        error_message: originErr.message,
      })
      .eq("run_id", runId)
      .eq("stage", "shortlist");

    await db
      .from("chart_ingest_runs")
      .update({
        status: "failed",
        error_code: "shortlist_origin_filter_failed",
        error_message: originErr.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return json(req, {
      ok: false,
      runId,
      error: "shortlist_origin_filter_failed",
      detail: originErr.message,
      durationMs: d,
    }, 500);
  }

  const originByCandidate = new Map<string, Record<string, unknown>>();
  for (const row of ((originRows || []) as Array<Record<string, unknown>>)) {
    originByCandidate.set(row.candidate_id as string, row);
  }

  const sbc = new Map<string, { final_score: number }>();
  for (const s of scores || []) {
    sbc.set(s.candidate_id as string, { final_score: Number(s.final_score) || 0 });
  }

  const validCandidates = candidates.filter((candidate) => {
    const origin = originByCandidate.get(candidate.id as string);
    const score = sbc.get(candidate.id as string)?.final_score ?? 0;
    return Boolean(origin?.is_country_eligible) && score > 0;
  });

  const invalidCandidates = candidates.filter((candidate) => {
    const origin = originByCandidate.get(candidate.id as string);
    const score = sbc.get(candidate.id as string)?.final_score ?? 0;
    return !Boolean(origin?.is_country_eligible) || score <= 0;
  });

  const sorted = [...validCandidates].sort((a, b) => {
    const sa = sbc.get(a.id as string)?.final_score ?? 0;
    const sb = sbc.get(b.id as string)?.final_score ?? 0;
    if (sb !== sa) return sb - sa;
    return ((a.normalized_key as string) || "").localeCompare((b.normalized_key as string) || "");
  });

  const seenSongIdentities = new Map<string, Record<string, unknown>>();
  const dedupedSorted: typeof sorted = [];
  const duplicateCandidates: typeof sorted = [];

  for (const candidate of sorted) {
    const identityKey = candidateSongIdentityKey(candidate as Record<string, unknown>);
    if (seenSongIdentities.has(identityKey)) {
      duplicateCandidates.push(candidate);
    } else {
      seenSongIdentities.set(identityKey, candidate as Record<string, unknown>);
      dedupedSorted.push(candidate);
    }
  }

  const now = new Date().toISOString();
  const sids: string[] = [];
  const eids = new Set<string>();

  for (let i = 0; i < dedupedSorted.length; i++) {
    if (i < csz) sids.push(dedupedSorted[i].id as string);
    else eids.add(dedupedSorted[i].id as string);
  }

  for (const invalid of invalidCandidates) {
    eids.add(invalid.id as string);
  }

  for (const duplicate of duplicateCandidates) {
    eids.add(duplicate.id as string);
  }

  await db
    .from("chart_ingest_exclusions")
    .delete()
    .eq("run_id", runId)
    .eq("source_stage", "shortlist")
    .in("reason_code", ["country_mismatch", "missing_artist_country", "duplicate_track"]);

  const countryExclusionRows = invalidCandidates.map((candidate) => {
    const origin = originByCandidate.get(candidate.id as string) || {};
    const reasonCode = (origin.reason_code as string) || "missing_artist_country";
    return {
      id: crypto.randomUUID(),
      run_id: runId,
      candidate_id: candidate.id as string,
      reason_code: reasonCode === "country_mismatch" ? "country_mismatch" : "missing_artist_country",
      reason_label: (origin.reason_label as string) || "Candidate does not have a resolved artist matching this chart country.",
      severity: "hard",
      source_stage: "shortlist",
      details_json: {
        normalizedKey: candidate.normalized_key,
        title: candidate.title,
        artistDisplay: candidate.artist_display,
        finalScore: sbc.get(candidate.id as string)?.final_score ?? 0,
        artists: origin.artists || [],
      },
      created_at: now,
    };
  });

  const duplicateExclusionRows = duplicateCandidates.map((candidate) => ({
    id: crypto.randomUUID(),
    run_id: runId,
    candidate_id: candidate.id as string,
    reason_code: "duplicate_track",
    reason_label: "Duplicate track identity already selected in this chart run.",
    severity: "hard",
    source_stage: "shortlist",
    details_json: {
      normalizedKey: candidate.normalized_key,
      title: candidate.title,
      artistDisplay: candidate.artist_display,
      finalScore: sbc.get(candidate.id as string)?.final_score ?? 0,
      duplicateIdentityKey: candidateSongIdentityKey(candidate as Record<string, unknown>),
    },
    created_at: now,
  }));

  const exclusionRows = [...countryExclusionRows, ...duplicateExclusionRows];

  if (exclusionRows.length > 0) {
    const CH = 200;
    for (let j = 0; j < exclusionRows.length; j += CH) {
      const { error: exErr } = await db
        .from("chart_ingest_exclusions")
        .insert(exclusionRows.slice(j, j + CH));

      if (exErr) {
        const d = Date.now() - ss;

        await db
          .from("chart_ingest_stage_events")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            duration_ms: d,
            message: "Shortlist exclusion write failed: " + exErr.message,
            error_code: "shortlist_exclusion_write_failed",
            error_message: exErr.message,
          })
          .eq("run_id", runId)
          .eq("stage", "shortlist");

        await db
          .from("chart_ingest_runs")
          .update({
            status: "failed",
            error_code: "shortlist_exclusion_write_failed",
            error_message: exErr.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", runId);

        return json(req, {
          ok: false,
          runId,
          error: "shortlist_exclusion_write_failed",
          detail: exErr.message,
          durationMs: d,
        }, 500);
      }
    }
  }

  if (sids.length < csz) {
    const d = Date.now() - ss;
    const detail = `Only ${sids.length} country-clean candidates available for chart size ${csz}.`;

    if (eids.size > 0) {
      const allExcluded = Array.from(eids);
      const CH = 200;
      for (let j = 0; j < allExcluded.length; j += CH) {
        await db
          .from("chart_ingest_candidates")
          .update({ status: "excluded", updated_at: now })
          .in("id", allExcluded.slice(j, j + CH))
          .eq("run_id", runId);
      }
    }

    await db
      .from("chart_ingest_stage_events")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: d,
        message: "Shortlist blocked: " + detail,
        error_code: "shortlist_country_clean_incomplete",
        error_message: detail,
        metrics_json: {
          chartSize: csz,
          countryCleanCandidateCount: sids.length,
          countryFilteredCount: invalidCandidates.length,
          eligibleCandidateCount: candidates.length,
        },
      })
      .eq("run_id", runId)
      .eq("stage", "shortlist");

    await db
      .from("chart_ingest_runs")
      .update({
        status: "failed",
        error_code: "shortlist_country_clean_incomplete",
        error_message: detail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return json(req, {
      ok: false,
      runId,
      error: "shortlist_country_clean_incomplete",
      detail,
      shortlistedCount: sids.length,
      countryFilteredCount: invalidCandidates.length,
      eligibleCandidateCount: candidates.length,
      durationMs: d,
    }, 400);
  }

  if (eids.size > 0) {
    const allExcluded = Array.from(eids);
    const CH = 200;
    for (let j = 0; j < allExcluded.length; j += CH) {
      await db
        .from("chart_ingest_candidates")
        .update({ status: "excluded", updated_at: now })
        .in("id", allExcluded.slice(j, j + CH))
        .eq("run_id", runId);
    }
  }

  const d = Date.now() - ss;

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: d,
      message: `${sids.length} country-clean shortlisted, ${eids.size} excluded, ${invalidCandidates.length} country-filtered, ${duplicateCandidates.length} duplicate-filtered.`,
      metrics_json: {
        shortlistedCount: sids.length,
        excludedCount: eids.size,
        countryFilteredCount: invalidCandidates.length,
        duplicateFilteredCount: duplicateCandidates.length,
        eligibleCandidateCount: candidates.length,
        chartSize: csz,
      },
    })
    .eq("run_id", runId)
    .eq("stage", "shortlist");

  await db
    .from("chart_ingest_stage_events")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      duration_ms: 0,
      message: "Review gate passed.",
    })
    .eq("run_id", runId)
    .eq("stage", "review_gate");

  return json(req, {
    ok: true,
    runId,
    shortlistedCount: sids.length,
    totalScored: candidates.length,
    excludedCount: eids.size,
    countryFilteredCount: invalidCandidates.length,
    duplicateFilteredCount: duplicateCandidates.length,
    chartSize: csz,
    durationMs: d,
  });
}


// FULL PIPELINE
async function handleRunFullPipeline(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const start = Date.now(); const pss: Array<{ stage: string; result: string }> = []; const sfR = await handleSourceFetch(req, db, params, user); const sfB = await sfR.json() as { ok: boolean; rawRowCount: number; error?: string }; pss.push({ stage: "source_fetch", result: sfB.ok ? sfB.rawRowCount+" rows" : "FAILED: "+(sfB.error||"unknown") }); if (!sfB.ok || sfB.rawRowCount === 0) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at source_fetch", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages: pss, durationMs: Date.now() - start }); } const nrR = await handleNormalizeRun(req, db, params, user); const nrB = await nrR.json() as { ok: boolean; uniqueCount: number; candidateCount: number }; pss.push({ stage: "normalize", result: nrB.ok ? nrB.candidateCount+" from "+nrB.uniqueCount : "FAILED" }); if (!nrB.ok || nrB.candidateCount === 0) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at normalize", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages: pss, durationMs: Date.now() - start }); } const cfR = await handleRunCarryForward(req, db, params, user); const cfB = await cfR.json() as { carryForwardCount: number }; pss.push({ stage: "carry_forward", result: cfB.carryForwardCount+" carry-forward" }); const elR = await handleRunEligibilityWithReleaseWindow(req, db, params, user); const elB = await elR.json() as { candidateCount: number; excludedCount: number; originExcludedCount?: number }; pss.push({ stage: "eligibility", result: elB.candidateCount+" total, "+elB.excludedCount+" excluded"+(elB.originExcludedCount?" ("+elB.originExcludedCount+" origin-filtered)":"") }); const scR = await handleRunScoring(req, db, params, user); const scB = await scR.json() as { ok: boolean; scoredCount: number }; pss.push({ stage: "scoring", result: scB.ok ? scB.scoredCount+" scored" : "FAILED" }); if (!scB.ok || scB.scoredCount === 0) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at scoring", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages: pss, durationMs: Date.now() - start }); } const slR = await handleRunShortlist(req, db, params, user); const slB = await slR.json() as { shortlistedCount: number }; pss.push({ stage: "shortlist", result: slB.shortlistedCount+" shortlisted" }); if (slB.shortlistedCount === 0) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at shortlist", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages: pss, durationMs: Date.now() - start }); } const td = Date.now() - start; await db.from("chart_ingest_runs").update({ status: "dry_run_complete", dry_run_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId); await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: user.email || null, action: "dry_run_complete", new_status: "dry_run_complete", payload_json: { pipelineStages: pss, totalDurationMs: td } }); return json(req, { ok: true, runId, status: "dry_run_complete", pipelineStages: pss, totalDurationMs: td }); }

// COMMIT (v26 — normalizeSlug safety-net ensures every entry gets hyphenated slugs)
async function handleCommitRun(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,user:{id:string;email?:string}) {
  const {runId,publishImmediately,notes}=params as {runId:string;publishImmediately?:boolean;notes?:string}; if(!runId)return json(req,{error:"runId_required"},400);
  const {error:gateError}=await db.rpc("chart_assert_committable_run",{p_run_id:runId}); if(gateError)return json(req,{error:"commit_blocked_chart_run_integrity",detail:gateError.message},400);
  const {data:run,error:runError}=await db.from("chart_ingest_runs").select("*").eq("id",runId).maybeSingle(); if(runError)return json(req,{error:"run_lookup_failed",detail:runError.message},500); if(!run)return json(req,{error:"run_not_found"},404);
  const now=new Date().toISOString(); const editionDate=String(run.edition_date||now.split("T")[0]); const chartSize=Number(run.chart_size||20); const programId=String(run.program_id||"unknown"); const actor=user.email||user.id;
  const {data:candidates,error:candidateError}=await db.from("chart_ingest_candidates").select("*").eq("run_id",runId).eq("status","eligible").order("created_at"); if(candidateError)return json(req,{error:"candidate_lookup_failed",detail:candidateError.message},500); if(!candidates?.length)return json(req,{error:"no_eligible_candidates"},400);
  const ids=candidates.map(c=>String(c.id)); const {data:scores,error:scoreError}=await db.from("chart_ingest_candidate_scores").select("*").in("candidate_id",ids); if(scoreError)return json(req,{error:"score_lookup_failed",detail:scoreError.message},500);
  const scoreMap=new Map<string,Record<string,unknown>>(); for(const s of scores||[])scoreMap.set(String(s.candidate_id),s);
  const top=[...candidates].sort((a,b)=>{const sa=Number(scoreMap.get(String(a.id))?.final_score??0);const sb=Number(scoreMap.get(String(b.id))?.final_score??0);return sb!==sa?sb-sa:String(a.normalized_key||"").localeCompare(String(b.normalized_key||""));}).slice(0,chartSize);
  const prevRanks=new Map<string,number>(); const prevKeys=new Set<string>();
  try{const {data:prev}=await db.from("wk_chart_editions_v2").select("id").eq("program_id",programId).in("status",["committed","published"]).lt("edition_date",editionDate).order("edition_date",{ascending:false}).limit(1).maybeSingle();if(prev){const {data:rows}=await db.from("wk_chart_entries_v2").select("normalized_key, rank").eq("edition_id",prev.id);for(const row of rows||[]){const key=String(row.normalized_key||"");if(key){prevRanks.set(key,Number(row.rank));prevKeys.add(key);}}}}catch{}
  const registryStats={tracks_found:0,tracks_created:0,artists_found:0,artists_created:0,links_created:0,previews_set:0,errors:0}; const materialized=new Map<string,ChartMaterializationResult>();
  for(const c of top){const candidateId=String(c.id);try{const result=await materializeChartCandidate(db,runId,candidateId);materialized.set(candidateId,result);if(result.track_created)registryStats.tracks_created++;else registryStats.tracks_found++;for(const a of result.artists){if(a.created)registryStats.artists_created++;else registryStats.artists_found++;}registryStats.links_created+=result.credits.filter(x=>x.created).length;}catch(error){registryStats.errors++;return json(req,{error:"registry_materialization_failed",candidateId,detail:error instanceof Error?error.message:String(error),registryStats},409);}}
  const editionId=crypto.randomUUID(); const {data:program}=await db.from("wk_chart_programs_v2").select("public_slug, public_label").eq("id",programId).maybeSingle(); const editionSlug=editionDate;
  const {error:editionError}=await db.from("wk_chart_editions_v2").insert({id:editionId,program_id:programId,edition_slug:editionSlug,edition_label:String(program?.public_label||"Chart Edition"),edition_date:editionDate,period_start:run.period_start||editionDate,period_end:run.period_end||editionDate,entry_count:top.length,status:publishImmediately?"published":"committed",methodology_version:String(run.methodology_version||"1.0.0"),rule_set_snapshot:(run.rule_snapshot_json as Record<string,unknown>)||{},chart_size:chartSize,ingest_run_id:runId,published_at:publishImmediately?now:null,published_by:publishImmediately?actor:null,created_at:now,updated_at:now}); if(editionError)return json(req,{error:"edition_create_failed",detail:editionError.message},500);
  const rows:Array<Record<string,unknown>>=[];
  for(let i=0;i<top.length;i++){const c=top[i];const candidateId=String(c.id);const result=materialized.get(candidateId);if(!result){await db.from("wk_chart_editions_v2").delete().eq("id",editionId);return json(req,{error:"materialization_result_missing",candidateId},500);}const rank=i+1;const key=String(c.normalized_key||"");const previous=prevRanks.get(key)??null;let movement:string|null=null;if(previous===null)movement=prevKeys.has(key)?"reentry":"new";else if(rank===previous)movement="same";else movement=rank<previous?"up":"down";rows.push({id:crypto.randomUUID(),edition_id:editionId,rank,previous_rank:previous,movement,track_title:String(c.title||""),artist_name:String(c.artist_display||""),artwork_url:c.artwork_url||null,normalized_key:key,lead_artist_key:String(c.lead_artist_key||""),track_slug:normalizeSlug(result.track_slug),artist_slug:normalizeSlug(result.primary_artist_slug),canonical_track_id:result.track_id,total_score:Number(scoreMap.get(candidateId)?.final_score??0),carry_forward_only:Boolean(c.carry_forward_only),release_date:sanitizeDate(c.release_date as string),source_count:Number(c.source_count||0),occurrence_count:Number(c.occurrence_count||0),created_at:now,updated_at:now});}
  const {error:entryError}=await db.from("wk_chart_entries_v2").insert(rows);if(entryError){await db.from("wk_chart_editions_v2").delete().eq("id",editionId);return json(req,{error:"entry_create_failed",detail:entryError.message},500);}
  const status=publishImmediately?"published":"committed"; const {error:updateError}=await db.from("chart_ingest_runs").update({status,committed_at:now,commit_edition_id:editionId,notes:notes??null,updated_at:now}).eq("id",runId);if(updateError)return json(req,{error:"run_commit_state_update_failed",detail:updateError.message},500);
  await db.from("chart_ingest_stage_events").update({status:"done",finished_at:now,message:`${top.length} entries committed.`}).eq("run_id",runId).eq("stage","commit_write"); await db.from("chart_ingest_audit_events").insert({run_id:runId,actor:user.id,actor_email:actor,action:"run_committed",new_status:status,payload_json:{editionId,editionSlug,entryCount:top.length}});
  return json(req,{runId,status,editionId,editionSlug,entryCount:top.length,publicUrl:`/charts/${String(program?.public_slug||programId)}/${editionSlug}`,registryStats,integrity:{ok:true,warnings:[],errors:[]}});
}

async function handleRunAirplayDetection(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { return json(req, { ok: false, error: "ACRCloud credentials not configured." }); }
async function handleResetPipeline(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const now = new Date().toISOString(); await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null }).eq("run_id", runId); await Promise.all([db.from("chart_ingest_raw_rows").delete().eq("run_id", runId), db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId), db.from("chart_ingest_candidates").delete().eq("run_id", runId), db.from("chart_ingest_exclusions").delete().eq("run_id", runId), db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId), db.from("chart_ingest_matches").delete().eq("run_id", runId), db.from("chart_ingest_review_issues").delete().eq("run_id", runId)]); await db.from("chart_ingest_runs").update({ status: "draft", dry_run_completed_at: null, updated_at: now }).eq("id", runId); return json(req, { ok: true, runId, status: "draft" }); }
async function handleCsvList(req: Request, db: ReturnType<typeof createClient>) { return json(req, { csvs: [] }); }
async function handleApplyRowDecision(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { return json(req, { ok: true }); }


async function handleGetOriginReviewQueue(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const { data, error } = await db.rpc("chart_get_run_origin_review_queue_v1", {
    p_run_id: runId,
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { rows: data || [] });
}

async function handleGetOriginCountryOptions(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { includeIso2 } = params as { includeIso2?: string };
  const include = typeof includeIso2 === "string" ? includeIso2.trim().toUpperCase() : "";

  const { data: artists, error: artistErr } = await db
    .from("registry_artists")
    .select("origin_iso2")
    .not("origin_iso2", "is", null);

  if (artistErr) return json(req, { error: artistErr.message }, 500);

  const codeCounts = new Map<string, number>();

  for (const artist of artists || []) {
    const code = String((artist as { origin_iso2?: string }).origin_iso2 || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
  }

  const marketLabels = new Map<string, string>();

  const { data: markets } = await db
    .from("chart_markets")
    .select("country_code,label")
    .not("country_code", "is", null);

  for (const market of markets || []) {
    const code = String((market as { country_code?: string }).country_code || "").trim().toUpperCase();
    const label = String((market as { label?: string }).label || "").trim();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    if (label) marketLabels.set(code, label);
    if (!codeCounts.has(code)) codeCounts.set(code, 0);
  }

  if (/^[A-Z]{2}$/.test(include) && !codeCounts.has(include)) {
    codeCounts.set(include, 0);
  }

  const options = [...codeCounts.entries()]
    .map(([originIso2, artistCount]) => ({
      originIso2,
      label: marketLabels.get(originIso2) || originIso2,
      artistCount,
    }))
    .sort((a, b) => {
      if (a.originIso2 === include) return -1;
      if (b.originIso2 === include) return 1;
      return a.originIso2.localeCompare(b.originIso2);
    });

  return json(req, { options });
}


async function handleSetArtistOriginForRun(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,_user:{id:string;email?:string}) {
  const {artistId,originIso2,runId,candidateId,note}=params as {artistId:string;originIso2:string;runId:string;candidateId:string;note?:string};
  if(!artistId)return json(req,{error:"artistId_required"},400);if(!originIso2)return json(req,{error:"originIso2_required"},400);if(!runId)return json(req,{error:"runId_required"},400);if(!candidateId)return json(req,{error:"candidateId_required"},400);
  const {data,error}=await db.rpc("chart_admit_artist_origin_v1",{p_artist_id:artistId,p_origin_iso2:originIso2,p_run_id:runId,p_candidate_id:candidateId,p_note:note||"Resolved from chart origin queue."});
  if(error)return json(req,{error:error.message},500);return json(req,{ok:true,result:data});
}

async function handleCreateOriginArtistShell(req:Request,db:ReturnType<typeof createClient>,params:Record<string,unknown>,_user:{id:string;email?:string}) {
  const {artistName,originIso2,runId,candidateId}=params as {artistName:string;originIso2:string;runId:string;candidateId:string};
  if(!artistName)return json(req,{error:"artistName_required"},400);if(!originIso2)return json(req,{error:"originIso2_required"},400);if(!runId)return json(req,{error:"runId_required"},400);if(!candidateId)return json(req,{error:"candidateId_required"},400);
  const {data,error}=await db.rpc("chart_create_artist_origin_shell_v1",{p_artist_name:artistName,p_origin_iso2:originIso2,p_run_id:runId,p_candidate_id:candidateId});
  if(error)return json(req,{error:error.message},500);return json(req,{ok:true,result:data});
}

async function handleResetAfterOriginResolution(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string };

  if (!runId) return json(req, { error: "runId_required" }, 400);

  const { data, error } = await db.rpc("chart_reset_run_after_origin_resolution_v1", {
    p_run_id: runId,
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { ok: true, result: data });
}


async function handleGetFamilyIngestPresets(req: Request, db: ReturnType<typeof createClient>) {
  const { data, error } = await db.rpc("chart_get_family_ingest_presets_v1");

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { presets: data || [] });
}

async function handleSaveFamilyIngestPreset(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { familyId, config } = params as {
    familyId: string;
    config: Record<string, unknown>;
  };

  if (!familyId) return json(req, { error: "familyId_required" }, 400);

  const { data, error } = await db.rpc("chart_upsert_family_ingest_preset_v1", {
    p_family_id: familyId,
    p_config_json: config || {},
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { ok: true, preset: data });
}

async function handleGetWeeklyBackfillPlan(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { familyId, startDate, endDate } = params as {
    familyId: string;
    startDate: string;
    endDate: string;
  };

  if (!familyId) return json(req, { error: "familyId_required" }, 400);
  if (!startDate) return json(req, { error: "startDate_required" }, 400);
  if (!endDate) return json(req, { error: "endDate_required" }, 400);

  const { data, error } = await db.rpc("chart_get_weekly_backfill_plan_v1", {
    p_family_id: familyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { plan: data || [] });
}

async function handleRunEligibilityWithReleaseWindow(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string };

  const baseResponse = await handleRunEligibility(req, db, params, user);

  if (!runId || baseResponse.status >= 400) {
    return baseResponse;
  }

  let basePayload: Record<string, unknown> = {};
  try {
    basePayload = await baseResponse.clone().json();
  } catch {
    basePayload = {};
  }

  const { data: run } = await db
    .from("chart_ingest_runs")
    .select("rule_snapshot_json")
    .eq("id", runId)
    .maybeSingle();

  const snapshot = (run?.rule_snapshot_json || {}) as Record<string, unknown>;
  const releaseWindowStart = String(
    snapshot.releaseWindowStart ||
    (snapshot.backfill as Record<string, unknown> | undefined)?.releaseWindowStart ||
    ""
  );
  const releaseWindowEnd = String(
    snapshot.releaseWindowEnd ||
    (snapshot.backfill as Record<string, unknown> | undefined)?.releaseWindowEnd ||
    ""
  );

  if (!releaseWindowStart || !releaseWindowEnd) {
    return json(req, basePayload);
  }

  const { data: candidates, error: candidateErr } = await db
    .from("chart_ingest_candidates")
    .select("id,title,artist_display,release_date,status")
    .eq("run_id", runId)
    .eq("status", "eligible");

  if (candidateErr) {
    return json(req, {
      ...basePayload,
      releaseWindowError: candidateErr.message,
    });
  }

  const outside = (candidates || []).filter((candidate) => {
    const releaseDate = String(candidate.release_date || "");
    if (!releaseDate) return true;
    return releaseDate < releaseWindowStart || releaseDate > releaseWindowEnd;
  });

  if (outside.length === 0) {
    return json(req, {
      ...basePayload,
      releaseWindowStart,
      releaseWindowEnd,
      releaseWindowExcludedCount: 0,
    });
  }

  const now = new Date().toISOString();
  const outsideIds = outside.map((candidate) => candidate.id as string);

  const CH = 200;
  for (let i = 0; i < outsideIds.length; i += CH) {
    await db
      .from("chart_ingest_candidates")
      .update({ status: "excluded", updated_at: now })
      .in("id", outsideIds.slice(i, i + CH))
      .eq("run_id", runId);
  }

  const exclusions = outside.map((candidate) => ({
    id: crypto.randomUUID(),
    run_id: runId,
    candidate_id: candidate.id as string,
    reason_code: "release_window_mismatch",
    reason_label: `Release date is outside ${releaseWindowStart} to ${releaseWindowEnd}.`,
    severity: "hard",
    source_stage: "eligibility",
    details_json: {
      title: candidate.title,
      artistDisplay: candidate.artist_display,
      releaseDate: candidate.release_date,
      releaseWindowStart,
      releaseWindowEnd,
    },
    created_at: now,
  }));

  for (let i = 0; i < exclusions.length; i += CH) {
    await db.from("chart_ingest_exclusions").insert(exclusions.slice(i, i + CH));
  }

  await db
    .from("chart_ingest_stage_events")
    .update({
      message: `Eligibility complete. ${outside.length} excluded by release window ${releaseWindowStart} to ${releaseWindowEnd}.`,
    })
    .eq("run_id", runId)
    .eq("stage", "eligibility_execution");

  return json(req, {
    ...basePayload,
    releaseWindowStart,
    releaseWindowEnd,
    releaseWindowExcludedCount: outside.length,
  });
}
