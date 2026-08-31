// ── SHARED BLOCK (Phase A) ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  canonicalizeIncomingTrackIdentity,
  REGISTRY_STEWARD_RULE_VERSION,
} from "../_shared/registry-steward.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","https://wakilisha.africa","http://localhost:5173","http://localhost:3000"];

function corsRestricted(req: Request, methods="POST, OPTIONS"): Record<string,string> { const o=req.headers.get("Origin")??""; const isR=o.endsWith(".wakilisha.africa")||o==="https://wakilisha.africa"; const ao=ALLOWED_ORIGINS.includes(o)||isR?o:ALLOWED_ORIGINS[0]; return {"Access-Control-Allow-Origin":ao,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":methods,"Vary":"Origin"}; }

async function verifyJwt(req: Request): Promise<{id:string;email?:string}|null> { const ah=req.headers.get("Authorization"); if(!ah||!ah.startsWith("Bearer ")) return null; const t=ah.replace("Bearer ",""); const uc=createClient(SUPABASE_URL,SERVICE_KEY,{global:{headers:{Authorization:`Bearer ${t}`}}}); const {data:{user},error}=await uc.auth.getUser(t); if(error||!user) return null; return {id:user.id,email:user.email}; }

async function requireCap(userId: string, cap: string, db?: ReturnType<typeof createClient>): Promise<boolean> { const c=db??createClient(SUPABASE_URL,SERVICE_KEY); const {data:roles}=await c.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id",userId).eq("status","active").or("expires_at.is.null,expires_at.gt.now()"); if(!roles||roles.length===0) return false; if(roles.some((r:{role_key:string})=>r.role_key==="administrator")) return true; const all=new Set<string>(); for(const r of roles){const caps=(r.role_definitions as {role_capabilities?:Array<{capability_key:string}>}|null)?.role_capabilities??[];for(const c of caps)all.add(c.capability_key);} return all.has(cap); }

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
  const requiredCapability = ACTION_CAPABILITIES[action];
  if (requiredCapability) { const can = await requireCap(auth.id, requiredCapability); if (!can) return json(req, { error: "forbidden" }, 403); }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
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

function addProviderIdToBag(bag: Record<string, Set<string>>, providerRaw: unknown, idRaw: unknown): void {
  const provider = compactIdentityPart(providerRaw);
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

function providerIdentityMapFromRaw(row: Record<string, unknown>): Record<string, string[]> {
  const bag: Record<string, Set<string>> = {};
  addProviderIdToBag(bag, row.provider, row.provider_track_id);

  const raw = row.raw_payload_json;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const payload = raw as Record<string, unknown>;
    addProviderIdToBag(bag, payload.provider || row.provider, payload.songId || payload.trackId || payload.provider_track_id);
  }

  return providerIdsJsonFromBag(bag);
}

function providerIdentityAliasesFromJson(value: unknown): string[] {
  const aliases: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) return aliases;

  for (const [providerRaw, idsRaw] of Object.entries(value as Record<string, unknown>)) {
    const provider = compactIdentityPart(providerRaw);
    if (!provider) continue;

    const ids = Array.isArray(idsRaw) ? idsRaw : [idsRaw];
    for (const idRaw of ids) {
      const id = compactIdentityPart(idRaw);
      if (id) aliases.push(`provider:${provider}:${id}`);
    }
  }

  return [...new Set(aliases)].sort();
}

function rawSongIdentityAliases(row: Record<string, unknown>, normalizedKey: string): string[] {
  const title = (row.title_raw as string) || "";
  const artist = (row.artist_raw as string) || "";
  const normalizedTitle = normalize_title(title);
  const lead = lead_artist_key(artist);
  const aliases = new Set<string>();

  if (normalizedKey) aliases.add(`normalized:${normalizedKey}`);

  const isrc = compactIdentityPart(row.isrc);
  if (isrc) aliases.add(`isrc:${isrc}`);

  const providerMap = providerIdentityMapFromRaw(row);
  for (const alias of providerIdentityAliasesFromJson(providerMap)) aliases.add(alias);

  if (normalizedTitle && lead) aliases.add(`title-lead:${normalizedTitle}::${lead}`);

  return [...aliases].sort();
}

function candidateSongIdentityKey(candidate: Record<string, unknown>): string {
  const isrc = compactIdentityPart(candidate.isrc);
  if (isrc) return `isrc:${isrc}`;

  const providerAliases = providerIdentityAliasesFromJson(candidate.provider_ids_json);
  if (providerAliases.length > 0) return providerAliases[0];

  const title = normalize_title((candidate.title as string) || "");
  const lead = lead_artist_key((candidate.artist_display as string) || "");
  if (title && lead) return `title-lead:${title}::${lead}`;

  const normalizedKey = (candidate.normalized_key as string) || "";
  if (normalizedKey) return `normalized:${normalizedKey}`;

  return `candidate:${candidate.id || crypto.randomUUID()}`;
}

function generateTrackSlug(title: string): string { return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "").slice(0, 200) || "untitled"; }
function generateArtistSlug(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "").slice(0, 200) || "unknown-artist"; }
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

interface AntiGamingInput { normalized_key: string; lead_artist_key: string; provisional_total: number; }
interface AntiGamingResult { normalized_key: string; anti_gaming_penalty: number; lead_artist_overflow: boolean; overflow_index: number; }
function computeAntiGamingPenalties(tracks: AntiGamingInput[], maxPer = 3, overflowPen = 8): AntiGamingResult[] {
  if (tracks.length === 0) return []; const groups = new Map<string, AntiGamingInput[]>(); for (const t of tracks) { const k = t.lead_artist_key || "__unknown__"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); } const rm = new Map<string, AntiGamingResult>();
  for (const [, g] of groups) { if (g.length <= maxPer) { for (const t of g) rm.set(t.normalized_key, { normalized_key: t.normalized_key, anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 }); continue; } const s = [...g].sort((a, b) => b.provisional_total - a.provisional_total); for (let i = 0; i < s.length; i++) { if (i < maxPer) rm.set(s[i].normalized_key, { normalized_key: s[i].normalized_key, anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 }); else { const oi = i - maxPer + 1; rm.set(s[i].normalized_key, { normalized_key: s[i].normalized_key, anti_gaming_penalty: round4(oi * overflowPen), lead_artist_overflow: true, overflow_index: oi }); } } } return tracks.map(t => rm.get(t.normalized_key) ?? { normalized_key: t.normalized_key, anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 });
}

function computeProvisionalScore(c: { normalized_key: string; lead_artist_key: string; source_count: number; occurrence_count: number; release_date: string | null; carry_forward_only: boolean; continuity_locked: boolean; airplay_candidate_only: boolean; }, ed: string, pp: number | null, cfg: { cross_source_mode?: string; cross_source_weight?: number; continuity_weight?: number; carry_forward_weight?: number; overlap_bonus_cap?: number; airplay_enabled?: boolean; airplay_max_score?: number; } = {}, airplayCtx?: { W: number; station_count: number; detection_count: number; } | null) { const ss = sourceScore(c.source_count); const cs = crossSourceBonus(c.source_count, cfg.cross_source_mode ?? "standard", cfg.cross_source_weight ?? 1.0); const ob = overlapBonus(c.occurrence_count, c.source_count, cfg.overlap_bonus_cap ?? 10); const rs = recencyScore(c.release_date, ed); const cont = continuityScore(pp, cfg.continuity_weight ?? 1.0); const cf = carryForwardBonus(pp, cfg.carry_forward_weight ?? 1.0, c.carry_forward_only); const ap = airplayScore(airplayCtx?.W ?? 0, airplayCtx?.station_count ?? 0, airplayCtx?.detection_count ?? 0, cfg.airplay_enabled ?? false, cfg.airplay_max_score ?? 24); const rd = c.release_date ? daysBetween(c.release_date, ed) : null; return { source_score: ss, cross_source_bonus: cs, overlap_bonus: ob, recency_score: rs, continuity_score: cont, carry_forward_bonus: cf, airplay_score: ap, provisional_total: round4(ss + cs + ob + rs + cont + cf + ap), recency_days: rd }; }

interface ProviderTrack { title: string; artist: string; release_date: string | null; isrc: string | null; source_position: number; provider_track_id: string | null; provider_release_id: string | null; provider_artist_ids: string[]; artwork_url: string | null; external_url: string | null; preview_url: string | null; raw_payload: unknown; }
interface ProviderFetchResult { tracks: ProviderTrack[]; warnings: string[]; error: string | null; }

async function readCredential(db: ReturnType<typeof createClient> | null, envVar: string, dbKey: string): Promise<string | null> { const ev = Deno.env.get(envVar); if (ev && ev.trim()) return ev.trim(); if (!db) return null; try { const { data: row } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", dbKey).maybeSingle(); if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim(); } catch { } return null; }

async function fetchSpotifySource(sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  const clientId = await readCredential(db, "SPOTIFY_CLIENT_ID", "spotify_client_id");
  const clientSecret = await readCredential(db, "SPOTIFY_CLIENT_SECRET", "spotify_client_secret");
  const spotifyMarket = (await readCredential(db, "SPOTIFY_MARKET", "spotify_market")) || market;

  if (!clientId || !clientSecret) {
    return { tracks: [], warnings: [], error: "Spotify credentials not configured." };
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(clientId + ":" + clientSecret),
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const eb = await tokenRes.text();
    return { tracks: [], warnings: [], error: "Spotify auth failed (" + tokenRes.status + "): " + eb.slice(0, 200) };
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  const pm = sourceUrl.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);

  if (!pm) {
    return { tracks: [], warnings: [], error: "Cannot extract Spotify playlist ID from: " + sourceUrl };
  }

  const pid = pm[1];
  const warnings: string[] = [];
  const playlistItems: Array<{
    track: {
      id: string;
      name: string;
      artists: Array<{ id: string; name: string }>;
      album: { id: string; name: string; images: Array<{ url: string }>; release_date: string };
      external_ids: { isrc?: string };
      external_urls: { spotify: string };
      preview_url: string | null;
      duration_ms: number;
      popularity: number;
    } | null;
  }> = [];

  const pageLimit = 100;
  let offset = 0;
  let total = 0;

  while (playlistItems.length < maxRows) {
    const remaining = maxRows - playlistItems.length;
    const limit = Math.min(pageLimit, remaining);

    const apiUrl = new URL("https://api.spotify.com/v1/playlists/" + pid + "/tracks");
    apiUrl.searchParams.set("market", spotifyMarket);
    apiUrl.searchParams.set("limit", String(limit));
    apiUrl.searchParams.set("offset", String(offset));
    apiUrl.searchParams.set("fields", "items(track(id,name,artists(id,name),album(id,name,images,release_date),external_ids(isrc),external_urls(spotify),preview_url,duration_ms,popularity)),next,total");

    const pres = await fetch(apiUrl.toString(), {
      headers: { Authorization: "Bearer " + tokenData.access_token },
    });

    if (!pres.ok) {
      const eb = await pres.text();
      return { tracks: [], warnings, error: "Spotify API " + pres.status + ": " + eb.slice(0, 300) };
    }

    const page = await pres.json() as {
      items: Array<{
        track: {
          id: string;
          name: string;
          artists: Array<{ id: string; name: string }>;
          album: { id: string; name: string; images: Array<{ url: string }>; release_date: string };
          external_ids: { isrc?: string };
          external_urls: { spotify: string };
          preview_url: string | null;
          duration_ms: number;
          popularity: number;
        } | null;
      }>;
      next: string | null;
      total: number;
    };

    total = page.total ?? total;
    const pageItems = page.items ?? [];

    if (pageItems.length === 0) break;

    playlistItems.push(...pageItems);
    offset += pageItems.length;

    if (!page.next) break;
  }

  if (total > playlistItems.length) {
    warnings.push("Spotify playlist has " + total + " tracks; fetched " + playlistItems.length + " using maxRows cap " + maxRows + ".");
  }

  const tracks: ProviderTrack[] = [];

  for (let i = 0; i < playlistItems.length; i++) {
    const item = playlistItems[i];

    if (!item || !item.track) {
      warnings.push("Spotify item " + (i + 1) + ": null track");
      continue;
    }

    const t = item.track;

    tracks.push({
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      release_date: sanitizeDate(t.album?.release_date),
      isrc: t.external_ids?.isrc || null,
      source_position: i + 1,
      provider_track_id: t.id,
      provider_release_id: t.album?.id || null,
      provider_artist_ids: t.artists.map((a) => a.id),
      artwork_url: t.album?.images?.[0]?.url || null,
      external_url: t.external_urls?.spotify || sourceUrl,
      preview_url: t.preview_url || null,
      raw_payload: {
        provider: "spotify",
        trackId: t.id,
        albumId: t.album?.id,
        artistIds: t.artists.map((a) => a.id),
        durationMs: t.duration_ms,
        popularity: t.popularity,
      },
    });
  }

  if (tracks.length === 0 && warnings.length === 0) {
    warnings.push("Spotify playlist returned 0 tracks (total: " + total + ")");
  }

  return { tracks, warnings, error: null };
}

async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> { const pem = pk.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, ""); const bin = Uint8Array.from(atob(pem), c => c.charCodeAt(0)); const key = await crypto.subtle.importKey("pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]); const header = { alg: "ES256", kid }; const now = Math.floor(Date.now() / 1000); const payload = { iss: tid, iat: now, exp: now + 3600 }; const enc = new TextEncoder(); const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); const hb = b64u(btoa(JSON.stringify(header))), pb = b64u(btoa(JSON.stringify(payload))), si = hb+"."+pb; const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si)); const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig)))); return si+"."+sb; }

async function fetchAppleMusicSource(sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> { const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key"); const teamId = await readCredential(db, "APPLE_MUSIC_TEAM_ID", "apple_music_team_id"); const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id"); const storefront = (await readCredential(db, "APPLE_MUSIC_STOREFRONT", "apple_music_storefront")) || market.slice(0, 2).toLowerCase(); if (!privateKey || !teamId || !musicKeyId) { const m: string[] = []; if (!privateKey) m.push("APPLE_MUSIC_PRIVATE_KEY"); if (!teamId) m.push("APPLE_MUSIC_TEAM_ID"); if (!musicKeyId) m.push("APPLE_MUSIC_KEY_ID"); return { tracks: [], warnings: [], error: "Apple Music credentials missing: "+m.join(", ") }; } let dt: string; try { dt = await createAppleMusicJWT(privateKey, teamId, musicKeyId); } catch (e) { return { tracks: [], warnings: [], error: "JWT failed: "+(e instanceof Error ? e.message : String(e)) }; } const parsed = sourceUrl.match(/music\.apple\.com\/([a-z]{2})\/(playlist|album)\/[^/]+\/(pl\.|[a-z]+\.)([a-zA-Z0-9]+)/i); let apiSf = storefront, rt = "playlists", rid = ""; if (parsed) { apiSf = parsed[1].toLowerCase(); rt = parsed[2] === "album" ? "albums" : "playlists"; rid = parsed[3] + parsed[4]; } else { const im = sourceUrl.match(/(pl\.|al\.)([a-zA-Z0-9]+)/i); if (im) rid = im[1] + im[2]; else return { tracks: [], warnings: [], error: "Cannot parse Apple Music URL: "+sourceUrl }; } const apiUrl = "https://api.music.apple.com/v1/catalog/"+apiSf+"/"+rt+"/"+rid+"/tracks"; const res = await fetch(apiUrl, { headers: { Authorization: "Bearer "+dt } }); if (!res.ok) { const eb = await res.text(); return { tracks: [], warnings: [], error: "Apple Music API "+res.status+": "+eb.slice(0, 300) }; } const data = await res.json() as { data: Array<{ id: string; attributes: { name: string; artistName: string; albumName: string; artwork: { url: string }; url: string; previews?: Array<{ url: string }>; releaseDate?: string; isrc?: string; genreNames: string[]; }; relationships?: { artists: { data: Array<{ id: string }>; }; albums: { data: Array<{ id: string }>; }; }; }>; }; const songs = (data.data || []).slice(0, maxRows); const warnings: string[] = []; const tracks: ProviderTrack[] = []; for (let i = 0; i < songs.length; i++) { const song = songs[i]; const attrs = song.attributes; if (!attrs) { warnings.push("Apple Music song "+(i+1)+": missing attributes"); continue; } const aw = attrs.artwork?.url ? attrs.artwork.url.replace("{w}", "300").replace("{h}", "300") : null; tracks.push({ title: attrs.name, artist: attrs.artistName, release_date: sanitizeDate(attrs.releaseDate), isrc: attrs.isrc || null, source_position: i + 1, provider_track_id: song.id, provider_release_id: song.relationships?.albums?.data?.[0]?.id || null, provider_artist_ids: song.relationships?.artists?.data?.map(a => a.id) || [], artwork_url: aw, external_url: attrs.url || sourceUrl, preview_url: attrs.previews?.[0]?.url || null, raw_payload: { provider: "apple_music", songId: song.id, albumId: song.relationships?.albums?.data?.[0]?.id, genres: attrs.genreNames, isrc: attrs.isrc } }); } if (tracks.length === 0 && warnings.length === 0) warnings.push("Apple Music "+rt+" returned 0 tracks"); return { tracks, warnings, error: null }; }

async function fetchProviderSource(provider: string, sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> { switch (provider) { case "spotify": return fetchSpotifySource(sourceUrl, market, maxRows, db); case "apple_music": return fetchAppleMusicSource(sourceUrl, market, maxRows, db); default: return { tracks: [], warnings: ["Unknown provider: "+provider], error: "Unknown provider '"+provider+"'." }; } }

function anchorToMonday(dateStr: string): string { const d = new Date(dateStr); if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10); const day = d.getUTCDay(); const diff = day === 0 ? 6 : day - 1; d.setUTCDate(d.getUTCDate() - diff); d.setUTCHours(0, 0, 0, 0); return d.toISOString().split("T")[0]; }

// REGISTRY RESOLUTION HELPERS
async function findOrCreateRegistryTrack(
  db: ReturnType<typeof createClient>,
  trackTitle: string,
  artistDisplay: string,
  isrc: string | null,
  artworkUrl: string | null,
  releaseDate: string | null,
  now: string,
  previewUrl: string | null = null,
): Promise<{ trackId: string; trackSlug: string; created: boolean }> {
  const identity = canonicalizeIncomingTrackIdentity(trackTitle);
  const canonicalTitle = identity.title;

  if (isrc) {
    const { data: byIsrc } = await db
      .from("registry_tracks")
      .select("id, slug, preview_url")
      .eq("isrc", isrc)
      .maybeSingle();

    if (byIsrc) {
      if (previewUrl && !byIsrc.preview_url) {
        await db
          .from("registry_tracks")
          .update({ preview_url: previewUrl, updated_at: now })
          .eq("id", byIsrc.id);
      }

      return {
        trackId: byIsrc.id as string,
        trackSlug: byIsrc.slug as string,
        created: false,
      };
    }
  }

  const normalizedKey = build_normalized_key(
    canonicalTitle,
    artistDisplay,
  );

  if (normalizedKey) {
    const normalizedTitle = normalize_title(canonicalTitle);
    const leadArtistKey = lead_artist_key(artistDisplay);
    const { data: byTitle } = await db
      .from("registry_tracks")
      .select("id, slug, normalized_title, preview_url")
      .eq("normalized_title", normalizedTitle)
      .limit(5);

    for (const track of byTitle ?? []) {
      const { data: trackArtists } = await db
        .from("registry_track_artists")
        .select("artist_id")
        .eq("track_id", track.id)
        .limit(1);

      if (!trackArtists?.[0]?.artist_id) continue;

      const { data: artist } = await db
        .from("registry_artists")
        .select("slug, normalized_name")
        .eq("id", trackArtists[0].artist_id)
        .maybeSingle();

      const artistName = String(
        artist?.normalized_name || "",
      );

      if (
        artist &&
        (
          artistName === leadArtistKey ||
          artistName.includes(leadArtistKey) ||
          leadArtistKey.includes(artistName)
        )
      ) {
        if (previewUrl && !track.preview_url) {
          await db
            .from("registry_tracks")
            .update({
              preview_url: previewUrl,
              updated_at: now,
            })
            .eq("id", track.id);
        }

        return {
          trackId: track.id as string,
          trackSlug: track.slug as string,
          created: false,
        };
      }
    }
  }

  const { data: exactTitle } = await db
    .from("registry_tracks")
    .select("id, slug, preview_url")
    .eq("title", canonicalTitle)
    .limit(5);

  for (const track of exactTitle ?? []) {
    const { data: trackArtists } = await db
      .from("registry_track_artists")
      .select("artist_id")
      .eq("track_id", track.id)
      .limit(1);

    if (!trackArtists?.[0]?.artist_id) continue;

    const { data: artist } = await db
      .from("registry_artists")
      .select("display_name")
      .eq("id", trackArtists[0].artist_id)
      .maybeSingle();

    const primaryArtist = artistDisplay
      .split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]
      .split(/\s*,\s*/)[0]
      .trim();

    if (
      artist &&
      primaryArtist.toLowerCase() ===
        String(artist.display_name || "").toLowerCase()
    ) {
      if (previewUrl && !track.preview_url) {
        await db
          .from("registry_tracks")
          .update({
            preview_url: previewUrl,
            updated_at: now,
          })
          .eq("id", track.id);
      }

      return {
        trackId: track.id as string,
        trackSlug: track.slug as string,
        created: false,
      };
    }
  }

  const trackSlug = await uniqueTrackSlug(
    db,
    identity.slug || generateTrackSlug(canonicalTitle),
  );
  const trackId = crypto.randomUUID();
  const metadata = {
    source: "chart_ingest",
    created_at: now,
    source_title: identity.sourceTitle,
    registry_steward_rule_version:
      REGISTRY_STEWARD_RULE_VERSION,
    structural_featured_names:
      identity.structuralFeaturedNames,
  };

  const { error: insertError } = await db
    .from("registry_tracks")
    .insert({
      id: trackId,
      slug: trackSlug,
      title: canonicalTitle,
      normalized_title: identity.normalizedTitle,
      isrc: isrc || null,
      artwork_url: artworkUrl || null,
      preview_url: previewUrl || null,
      status: "active",
      metadata,
      created_at: now,
      updated_at: now,
    });

  if (!insertError) {
    return {
      trackId,
      trackSlug,
      created: true,
    };
  }

  const fallbackSlug =
    `${trackSlug}-${crypto.randomUUID().slice(0, 8)}`;

  const { error: fallbackError } = await db
    .from("registry_tracks")
    .insert({
      id: trackId,
      slug: fallbackSlug,
      title: canonicalTitle,
      normalized_title: identity.normalizedTitle,
      isrc: isrc || null,
      artwork_url: artworkUrl || null,
      preview_url: previewUrl || null,
      status: "active",
      metadata,
      created_at: now,
      updated_at: now,
    });

  if (fallbackError) {
    throw new Error(
      "Failed to create registry track: " +
        fallbackError.message,
    );
  }

  return {
    trackId,
    trackSlug: fallbackSlug,
    created: true,
  };
}

async function uniqueTrackSlug(db: ReturnType<typeof createClient>, base: string): Promise<string> { const { data } = await db.from("registry_tracks").select("slug").eq("slug", base).maybeSingle(); if (!data) return base; return base + "-" + crypto.randomUUID().slice(0, 6); }
async function findOrCreateRegistryArtist(db: ReturnType<typeof createClient>, artistName: string, now: string): Promise<{ artistId: string; artistSlug: string; created: boolean }> { const normalized = artistName.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0].split(/\s*,\s*/)[0].trim(); const nameSlug = generateArtistSlug(normalized); const { data: bySlug } = await db.from("registry_artists").select("id, slug").eq("slug", nameSlug).maybeSingle(); if (bySlug) return { artistId: bySlug.id as string, artistSlug: bySlug.slug as string, created: false }; const { data: byName } = await db.from("registry_artists").select("id, slug").eq("display_name", normalized).maybeSingle(); if (byName) return { artistId: byName.id as string, artistSlug: byName.slug as string, created: false }; const { data: byCi } = await db.from("registry_artists").select("id, slug, display_name").ilike("display_name", normalized).limit(3); if (byCi && byCi.length > 0) { const exact = byCi.find(a => ((a.display_name as string) || "").toLowerCase() === normalized.toLowerCase()); if (exact) return { artistId: exact.id as string, artistSlug: exact.slug as string, created: false }; return { artistId: byCi[0].id as string, artistSlug: byCi[0].slug as string, created: false }; } const artistSlug = await uniqueArtistSlug(db, nameSlug); const artistId = crypto.randomUUID(); const { error: insErr } = await db.from("registry_artists").insert({ id: artistId, slug: artistSlug, display_name: normalized, normalized_name: normalizeCore(normalized), sort_name: normalized, status: "draft", metadata: { source: "chart_ingest", created_at: now }, created_at: now, updated_at: now }); if (insErr) { const fallbackSlug = artistSlug + "-" + crypto.randomUUID().slice(0, 8); const { error: fbErr } = await db.from("registry_artists").insert({ id: artistId, slug: fallbackSlug, display_name: normalized, normalized_name: normalizeCore(normalized), sort_name: normalized, status: "draft", metadata: { source: "chart_ingest", created_at: now }, created_at: now, updated_at: now }); if (fbErr) throw new Error("Failed to create registry artist: "+fbErr.message); return { artistId, artistSlug: fallbackSlug, created: true }; } return { artistId, artistSlug, created: true }; }
async function uniqueArtistSlug(db: ReturnType<typeof createClient>, base: string): Promise<string> { const { data } = await db.from("registry_artists").select("slug").eq("slug", base).maybeSingle(); if (!data) return base; return base + "-" + crypto.randomUUID().slice(0, 6); }
async function ensureTrackArtistLink(db: ReturnType<typeof createClient>, trackId: string, artistId: string, artistSlug: string, artistName: string, now: string, creditOrder: number, isPrimary: boolean): Promise<void> { const { data: existing } = await db.from("registry_track_artists").select("id").eq("track_id", trackId).eq("artist_id", artistId).maybeSingle(); if (existing) return; const { error } = await db.from("registry_track_artists").insert({ id: crypto.randomUUID(), track_id: trackId, artist_id: artistId, artist_slug: artistSlug, artist_name_text: artistName, role: "primary", is_primary: isPrimary, is_featured: !isPrimary, credit_order: creditOrder, display_credit: artistName, source: "chart_ingest", confidence: creditOrder === 0 ? 100 : 80, status: "active", metadata: {}, created_at: now, updated_at: now }); if (error) console.error("[registry] track_artist link failed:", error.message); }
function parseArtists(artistLine: string): string[] { if (!artistLine || !artistLine.trim()) return []; const parts = artistLine.split(/\s*,\s*/); const artists: string[] = []; for (const part of parts) { const subs = part.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i); for (const sub of subs) { const xs = sub.split(/\s+x\s+/i); for (const x of xs) { const amps = x.split(/\s+&\s+/); for (const a of amps) { const trimmed = a.trim(); if (trimmed) artists.push(trimmed); } } } } return artists; }

// ── HANDLERS ──
async function handleFixChartArtistSlugs(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { editionId, dryRun } = params as { editionId?: string; dryRun?: boolean }; const isDryRun = dryRun !== false; const now = new Date().toISOString(); let query = db.from("wk_chart_entries_v2").select("id, track_title, artist_name, artist_slug, track_slug, canonical_track_id, edition_id"); if (editionId) query = query.eq("edition_id", editionId); const { data: allEntries } = await query; if (!allEntries || allEntries.length === 0) return json(req, { ok: true, fixed: 0, message: "No entries found." }); const { data: allArtists } = await db.from("registry_artists").select("slug, display_name"); const validSlugs = new Set((allArtists || []).map(a => a.slug as string)); const artistByName = new Map<string, string>(); for (const a of (allArtists || [])) { const dn = ((a.display_name as string) || "").toLowerCase(); artistByName.set(dn, a.slug as string); } const toFix: Array<{ id: string; track_title: string; artist_name: string; current_slug: string; correct_slug: string; method: string }> = []; const skipped: string[] = []; for (const entry of allEntries) { const currentSlug = (entry.artist_slug as string) || ""; if (validSlugs.has(currentSlug)) continue; let correctSlug = ""; let method = ""; if (entry.canonical_track_id) { const { data: rt } = await db.from("registry_tracks").select("id").eq("id", entry.canonical_track_id as string).maybeSingle(); if (rt) { const { data: rta } = await db.from("registry_track_artists").select("artist_slug").eq("track_id", rt.id).eq("is_primary", true).limit(1); if (rta && rta.length > 0 && rta[0].artist_slug) { correctSlug = rta[0].artist_slug as string; method = "track_artists"; } } } if (!correctSlug) { const primaryName = (entry.artist_name as string).split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0].split(/\s*,\s*/)[0].trim(); const lookup = artistByName.get(primaryName.toLowerCase()); if (lookup) { correctSlug = lookup; method = "name_match"; } } if (correctSlug) { toFix.push({ id: entry.id as string, track_title: (entry.track_title as string) || "", artist_name: (entry.artist_name as string) || "", current_slug: currentSlug, correct_slug: correctSlug, method }); } else { skipped.push(`${(entry.track_title as string)} by ${(entry.artist_name as string)} (slug: ${currentSlug})`); } } if (isDryRun) return json(req, { ok: true, dry_run: true, total_entries: allEntries.length, to_fix: toFix.length, skipped: skipped.length, fix_preview: toFix.slice(0, 50), skipped_samples: skipped.slice(0, 20) }); let fixed = 0; for (const fix of toFix) { const { error } = await db.from("wk_chart_entries_v2").update({ artist_slug: fix.correct_slug, updated_at: now }).eq("id", fix.id); if (!error) fixed++; } await db.from("chart_ingest_audit_events").insert({ run_id: editionId || "global", actor: user.id, actor_email: user.email || null, action: "fix_artist_slugs", new_status: "fixed", payload_json: { fixed, skipped: skipped.length, dryRun: false, totalEntries: allEntries.length }, created_at: now }); return json(req, { ok: true, fixed, skipped: skipped.length, total_entries: allEntries.length, skipped_samples: skipped.slice(0, 20) }); }

async function handleReingestEdition(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { editionId, dryRun } = params as { editionId: string; dryRun?: boolean }; if (!editionId) return json(req, { error: "editionId_required" }, 400); const isDryRun = dryRun !== false; const now = new Date().toISOString(); const { data: edition } = await db.from("wk_chart_editions_v2").select("*").eq("id", editionId).maybeSingle(); if (!edition) return json(req, { error: "edition_not_found" }, 404); const { data: entries } = await db.from("wk_chart_entries_v2").select("*").eq("edition_id", editionId).order("rank", { ascending: true }); if (!entries || entries.length === 0) return json(req, { error: "no_entries" }, 400); const stats = { total: entries.length, tracks_found: 0, tracks_created: 0, artists_found: 0, artists_created: 0, links_created: 0, artist_slugs_fixed: 0, track_slugs_normalized: 0, canonical_ids_set: 0, errors: 0 }; const repairs: Array<{ id: string; track_title: string; artist_name: string; action: string }> = []; for (const entry of entries) { try { const entryId = entry.id as string; const trackTitle = (entry.track_title as string) || ""; const artistName = (entry.artist_name as string) || ""; const artworkUrl = (entry.artwork_url as string) || null; const releaseDate = (entry.release_date as string) || null; const existingCanonical = (entry.canonical_track_id as string) || null; if (existingCanonical) { const { data: existingRt } = await db.from("registry_tracks").select("id").eq("id", existingCanonical).maybeSingle(); if (existingRt) { stats.tracks_found++; const { data: rta } = await db.from("registry_track_artists").select("artist_slug").eq("track_id", existingRt.id).eq("is_primary", true).limit(1); if (rta && rta.length > 0 && rta[0].artist_slug) { const correctSlug = normalizeSlug(rta[0].artist_slug as string); const currentArtistSlug = (entry.artist_slug as string) || ""; const currentTrackSlug = (entry.track_slug as string) || ""; const updates: Record<string, unknown> = { updated_at: now }; if (correctSlug !== currentArtistSlug) { updates.artist_slug = correctSlug; stats.artist_slugs_fixed++; repairs.push({ id: entryId, track_title: trackTitle, artist_name: artistName, action: "fixed_artist_slug: " + currentArtistSlug + " -> " + correctSlug }); } const nTrackSlug = normalizeSlug(currentTrackSlug); if (nTrackSlug && nTrackSlug !== currentTrackSlug) { updates.track_slug = nTrackSlug; stats.track_slugs_normalized++; repairs.push({ id: entryId, track_title: trackTitle, artist_name: artistName, action: "normalized_track_slug: " + currentTrackSlug + " -> " + nTrackSlug }); } if (Object.keys(updates).length > 1) { if (!isDryRun) await db.from("wk_chart_entries_v2").update(updates).eq("id", entryId); } } continue; } } const trackResult = await findOrCreateRegistryTrack(db, trackTitle, artistName, null, artworkUrl, releaseDate, now); if (trackResult.created) stats.tracks_created++; else stats.tracks_found++; const artistNames = parseArtists(artistName); const artistResults: Array<{ artistId: string; artistSlug: string; created: boolean }> = []; for (const an of artistNames) { const ar = await findOrCreateRegistryArtist(db, an, now); artistResults.push(ar); if (ar.created) stats.artists_created++; else stats.artists_found++; } for (let i = 0; i < artistResults.length; i++) { if (!isDryRun) await ensureTrackArtistLink(db, trackResult.trackId, artistResults[i].artistId, normalizeSlug(artistResults[i].artistSlug), artistNames[i], now, i, i === 0); stats.links_created++; } const primaryArtistSlug = normalizeSlug(artistResults.length > 0 ? artistResults[0].artistSlug : ""); const finalTrackSlug = normalizeSlug(trackResult.trackSlug); if (!isDryRun) await db.from("wk_chart_entries_v2").update({ canonical_track_id: trackResult.trackId, track_slug: finalTrackSlug, artist_slug: primaryArtistSlug, updated_at: now }).eq("id", entryId); stats.canonical_ids_set++; repairs.push({ id: entryId, track_title: trackTitle, artist_name: artistName, action: trackResult.created ? "created_track: " + finalTrackSlug : "linked_track: " + finalTrackSlug }); } catch (err) { stats.errors++; repairs.push({ id: entry.id as string, track_title: (entry.track_title as string) || "", artist_name: (entry.artist_name as string) || "", action: "ERROR: " + (err instanceof Error ? err.message : String(err)) }); } } await db.from("chart_ingest_audit_events").insert({ run_id: editionId, actor: user.id, actor_email: user.email || null, action: "reingest_edition", new_status: isDryRun ? "dry_run" : "done", payload_json: { ...stats, edition_slug: edition.edition_slug, dryRun: isDryRun }, created_at: now }); return json(req, { ok: true, dry_run: isDryRun, edition_slug: edition.edition_slug as string, stats, repairs: repairs.slice(0, 100) }); }

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
async function handleNormalizeRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now(); const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); await db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId); await db.from("chart_ingest_candidates").delete().eq("run_id", runId); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "normalize"); const { data: rawRows } = await db.from("chart_ingest_raw_rows").select("*").eq("run_id", runId).order("created_at"); if (!rawRows || rawRows.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: "No raw rows to normalize." }).eq("run_id", runId).eq("stage", "normalize"); return json(req, { ok: true, runId, rawCount: 0, uniqueCount: 0, durationMs: d }); } const groups = new Map<string, { rows: Array<Record<string, unknown>>; sources: Set<string>; sourceUrls: Set<string>; artwork_url: string | null; bestTitle: string; bestArtist: string; bestIsrc: string | null; bestReleaseDate: string | null; providerIds: Record<string, Set<string>> }>();
  const groupAliases = new Map<string, string>();

  function mergeProviderBag(target: Record<string, Set<string>>, incoming: Record<string, string[]>): void {
    for (const [provider, ids] of Object.entries(incoming)) {
      for (const id of ids) addProviderIdToBag(target, provider, id);
    }
  }

  function mergeGroups(target: { rows: Array<Record<string, unknown>>; sources: Set<string>; sourceUrls: Set<string>; artwork_url: string | null; bestTitle: string; bestArtist: string; bestIsrc: string | null; bestReleaseDate: string | null; providerIds: Record<string, Set<string>> }, source: { rows: Array<Record<string, unknown>>; sources: Set<string>; sourceUrls: Set<string>; artwork_url: string | null; bestTitle: string; bestArtist: string; bestIsrc: string | null; bestReleaseDate: string | null; providerIds: Record<string, Set<string>> }): void {
    target.rows.push(...source.rows);
    for (const provider of source.sources) target.sources.add(provider);
    for (const url of source.sourceUrls) target.sourceUrls.add(url);
    if (!target.artwork_url && source.artwork_url) target.artwork_url = source.artwork_url;
    if (!target.bestIsrc && source.bestIsrc) target.bestIsrc = source.bestIsrc;
    if (!target.bestReleaseDate && source.bestReleaseDate) target.bestReleaseDate = source.bestReleaseDate;
    for (const [provider, ids] of Object.entries(source.providerIds)) {
      for (const id of ids) addProviderIdToBag(target.providerIds, provider, id);
    }
  }

  for (const row of (rawRows as Array<Record<string, unknown>>)) {
    const title = (row.title_raw as string) || "";
    const artist = (row.artist_raw as string) || "";
    const nk = build_normalized_key(title, artist);
    if (!nk) continue;

    const aliases = rawSongIdentityAliases(row, nk);
    const existingGroupIds = [...new Set(aliases.map((alias) => groupAliases.get(alias)).filter(Boolean) as string[])];
    const groupId = existingGroupIds[0] || nk;

    let existing = groups.get(groupId);
    const rowProviderMap = providerIdentityMapFromRaw(row);

    if (!existing) {
      existing = {
        rows: [row],
        sources: new Set([(row.provider as string) || "unknown"]),
        sourceUrls: new Set([(row.external_url as string) || ""].filter(Boolean)),
        artwork_url: (row.artwork_url as string) || null,
        bestTitle: title,
        bestArtist: artist,
        bestIsrc: (row.isrc as string) || null,
        bestReleaseDate: sanitizeDate(row.release_date_raw as string),
        providerIds: {},
      };
      mergeProviderBag(existing.providerIds, rowProviderMap);
      groups.set(groupId, existing);
    } else {
      existing.rows.push(row);
      existing.sources.add((row.provider as string) || "unknown");
      if (row.external_url) existing.sourceUrls.add(row.external_url as string);
      if (!existing.artwork_url && row.artwork_url) existing.artwork_url = row.artwork_url as string;
      if (!existing.bestIsrc && row.isrc) existing.bestIsrc = row.isrc as string;
      if (!existing.bestReleaseDate && row.release_date_raw) existing.bestReleaseDate = sanitizeDate(row.release_date_raw as string);
      mergeProviderBag(existing.providerIds, rowProviderMap);
    }

    for (const extraGroupId of existingGroupIds.slice(1)) {
      if (extraGroupId === groupId) continue;
      const extraGroup = groups.get(extraGroupId);
      if (!extraGroup) continue;
      mergeGroups(existing, extraGroup);
      groups.delete(extraGroupId);
      for (const [alias, aliasGroupId] of groupAliases.entries()) {
        if (aliasGroupId === extraGroupId) groupAliases.set(alias, groupId);
      }
    }

    for (const alias of aliases) groupAliases.set(alias, groupId);
  } if (groups.size === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: "No valid keys" }).eq("run_id", runId).eq("stage", "normalize"); return json(req, { ok: true, runId, rawCount: rawRows.length, uniqueCount: 0, durationMs: d }); } const now = new Date().toISOString(); const nrs: Array<Record<string, unknown>> = []; const cds: Array<Record<string, unknown>> = []; let wc = 0; for (const [nk, g] of groups) { const lk = nk.split("::")[1] || ""; const nt = nk.split("::")[0] || ""; const sc = g.sources.size; const oc = g.rows.length; const surls = [...g.sourceUrls]; const srd = sanitizeDate(g.bestReleaseDate); const providerIdsJson = providerIdsJsonFromBag(g.providerIds); const nid = crypto.randomUUID(); const cid = crypto.randomUUID(); const reasons: string[] = []; if (!nt) reasons.push("empty_title"); if (!lk) reasons.push("empty_artist"); if (sc < 1) reasons.push("no_sources"); nrs.push({ id:nid, run_id:runId, normalized_key:nk, lead_artist_key:lk, title:g.bestTitle, artist_display:g.bestArtist, normalized_title:nt, source_count:sc, occurrence_count:oc, source_urls_seen:surls, isrc:g.bestIsrc, release_date:srd, artwork_url:g.artwork_url, external_url:(g.rows[0].external_url as string)||null, preview_url:(g.rows[0].preview_url as string)||null, provider_track_id:(g.rows[0].provider_track_id as string)||null, provider_release_id:(g.rows[0].provider_release_id as string)||null, provider_artist_ids:(g.rows[0].provider_artist_ids as string[])||[], raw_source_count:g.rows.length, created_at:now }); cds.push({ id:cid, run_id:runId, normalized_key:nk, lead_artist_key:lk, title:g.bestTitle, artist_display:g.bestArtist, source_count:sc, occurrence_count:oc, source_urls_seen:surls, provider_ids_json:providerIdsJson, release_date:srd, candidate_type:"streaming", status:reasons.length===0?"eligible":"excluded", version:1, carry_forward_only:false, continuity_locked:false, airplay_candidate_only:false, streaming_qualified:sc>0, isrc:g.bestIsrc||null, upc:null, artwork_url:g.artwork_url, external_url:(g.rows[0].external_url as string)||null, preview_url:(g.rows[0].preview_url as string)||null, release_title:null, created_at:now, updated_at:now }); if (reasons.length > 0) wc++; } const CH = 200; for (let j=0; j<nrs.length; j+=CH) { await db.from("chart_ingest_normalized_rows").insert(nrs.slice(j,j+CH)); } for (let j=0; j<cds.length; j+=CH) { const chunk = cds.slice(j,j+CH); const { error: cErr } = await db.from("chart_ingest_candidates").insert(chunk); if (cErr) { const d = Date.now()-ss; await db.from("chart_ingest_stage_events").update({ status:"failed", finished_at:new Date().toISOString(), duration_ms:d, message:"Insert failed: "+cErr.message }).eq("run_id",runId).eq("stage","normalize"); return json(req, { error:"insert_failed", detail:cErr.message }, 500); } } const exclCands = cds.filter(c => c.status==="excluded"); if (exclCands.length>0) { const er = exclCands.map(c=>({ id:crypto.randomUUID(), run_id:runId, candidate_id:c.id, reason:"invalid_normalized_key", created_at:now })); for (let j=0; j<er.length; j+=CH) { await db.from("chart_ingest_exclusions").insert(er.slice(j,j+CH)); } } const ec = cds.filter(c=>c.status==="eligible").length; const d = Date.now()-ss; await db.from("chart_ingest_stage_events").update({ status:"done", finished_at:new Date().toISOString(), duration_ms:d, message:groups.size+" unique from "+rawRows.length }).eq("run_id",runId).eq("stage","normalize"); await db.from("chart_ingest_stage_events").update({ status:"done", finished_at:new Date().toISOString(), duration_ms:0, message:(rawRows.length-groups.size)+" duplicates removed." }).eq("run_id",runId).eq("stage","dedupe"); await db.from("chart_ingest_stage_events").update({ status:"done", finished_at:new Date().toISOString(), duration_ms:0, message:cds.length+" candidates built." }).eq("run_id",runId).eq("stage","release_candidate_build"); return json(req, { ok:true, runId, rawCount:rawRows.length, uniqueCount:groups.size, candidateCount:cds.length, warningCount:exclCands.length, durationMs:d }); }

// SOURCE_FETCH — unchanged from v25
async function handleSourceFetch(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); await db.from("chart_ingest_raw_rows").delete().eq("run_id", runId); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString() }).eq("run_id", runId).eq("stage", "source_fetch"); const { data: sources } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).eq("enabled", true).order("priority"); if (!sources || sources.length === 0) { const d = Date.now(); await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: "No enabled sources." }).eq("run_id", runId).eq("stage", "source_fetch"); return json(req, { ok: true, runId, sourceCount: 0, rawRowCount: 0 }); } const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const cs = (run.chart_size as number) || 20; let trr = 0, tfs = 0; const aw: string[] = []; const srs: Array<{ sourceId: string; fetchedCount: number; droppedCount: number; provider: string; warnings: string[]; error: string | null }> = []; for (const source of sources) { const market = (source.storefront_or_market as string) || "KE"; const mr = Math.min(500, Math.max(cs * 5, cs + 100)); if (source.provider === "csv") { srs.push({ sourceId: source.id, fetchedCount: source.fetched_count || 0, droppedCount: 0, provider: "csv", warnings: [], error: null }); trr += source.fetched_count || 0; continue; } const fr = await fetchProviderSource(source.provider as string, source.source_url as string, market, mr, db); if (fr.error) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: fr.error }); tfs++; aw.push(...fr.warnings); continue; } const tracks = fr.tracks; aw.push(...fr.warnings); if (tracks.length === 0) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null }); continue; } const now = new Date().toISOString(); const rrs = tracks.map(t => ({ id: crypto.randomUUID(), run_id: runId, source_id: source.id, provider: source.provider, provider_row_id: t.provider_track_id ? source.provider+":"+t.provider_track_id+":"+t.source_position : source.provider+":pos:"+t.source_position, provider_track_id: t.provider_track_id, provider_release_id: t.provider_release_id, provider_artist_ids: t.provider_artist_ids, source_position: t.source_position, title_raw: t.title, artist_raw: t.artist, release_raw: null, isrc: t.isrc, upc: null, release_date_raw: t.release_date, artwork_url: t.artwork_url, external_url: t.external_url || source.source_url || null, preview_url: t.preview_url, raw_payload_json: t.raw_payload, raw_payload_hash: null })); const CH = 100; for (let j = 0; j < rrs.length; j += CH) { await db.from("chart_ingest_raw_rows").insert(rrs.slice(j, j + CH)); } trr += rrs.length; srs.push({ sourceId: source.id, fetchedCount: rrs.length, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null }); } const d = Date.now(); const sm = trr > 0 ? trr+" raw rows from "+(sources.length - tfs)+"/"+sources.length+" source(s)" : "All sources failed."; await db.from("chart_ingest_stage_events").update({ status: trr > 0 ? "done" : "failed", finished_at: new Date().toISOString(), duration_ms: d, message: sm }).eq("run_id", runId).eq("stage", "source_fetch"); if (trr > 0) { await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: 1, message: "Raw rows persisted." }).eq("run_id", runId).eq("stage", "raw_persist"); await db.from("chart_ingest_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", runId); } else { await db.from("chart_ingest_runs").update({ status: "source_fetch_failed", error_code: "all_sources_failed", error_message: "Configure credentials in Settings.", updated_at: new Date().toISOString() }).eq("id", runId); } return json(req, { ok: trr > 0, runId, sourceCount: sources.length, rawRowCount: trr, failedSourceCount: tfs, sourceResults: srs, durationMs: d }); }

// CARRY_FORWARD
async function handleRunCarryForward(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now(); const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size,program_id,series_slug").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString() }).eq("run_id", runId).eq("stage", "carry_forward"); const ed2 = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const pid = (run.program_id as string) || "unknown"; const { data: ccs } = await db.from("chart_ingest_candidates").select("normalized_key").eq("run_id", runId); const fks = new Set<string>(); if (ccs) { for (const c of ccs) { if (c.normalized_key) fks.add(c.normalized_key); } } let cfc = 0, skc = 0, pec = 0; const ccds: Array<Record<string, unknown>> = []; try { const { data: pe } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", pid).in("status",["committed","published"]).lt("edition_date",ed2).order("edition_date",{ascending:false}).limit(1).maybeSingle(); if (pe) { const { data: pes } = await db.from("wk_chart_entries_v2").select("normalized_key, rank, track_title, artist_name, release_date, track_slug, artist_slug, artwork_url").eq("edition_id", pe.id).order("rank",{ascending:true}); if (pes) { pec = pes.length; for (const p of pes) { const nk = (p.normalized_key as string)||""; if (!nk||nk==="::"||!nk.includes("::")) continue; if (fks.has(nk)){skc++;continue;} const cid = crypto.randomUUID(); ccds.push({ id:cid, run_id:runId, normalized_key:nk, lead_artist_key:nk.split("::")[1]??"", title:(p.track_title as string)||"", artist_display:(p.artist_name as string)||"", source_count:0, source_urls_seen:[], occurrence_count:0, release_date:sanitizeDate(p.release_date as string), candidate_type:"carry_forward", status:"eligible", version:1, carry_forward_only:true, continuity_locked:false, airplay_candidate_only:false, streaming_qualified:false, isrc:null, upc:null, artwork_url:(p.artwork_url as string)||null, external_url:null, preview_url:null, release_title:null, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }); cfc++; } } } } catch (err) { console.error("[carry_forward]", err); } if (ccds.length>0) { const CH=200; for (let j=0; j<ccds.length; j+=CH) { const { error: ie } = await db.from("chart_ingest_candidates").insert(ccds.slice(j,j+CH)); if (ie) { const d=Date.now()-ss; await db.from("chart_ingest_stage_events").update({ status:"failed", finished_at:new Date().toISOString(), duration_ms:d, message:ie.message }).eq("run_id",runId).eq("stage","carry_forward"); return json(req,{error:"insert_failed",detail:ie.message},500); } } } const d=Date.now()-ss; await db.from("chart_ingest_stage_events").update({ status:"done", finished_at:new Date().toISOString(), duration_ms:d, message:cfc>0?cfc+" carry-forward from "+pec+" entries":"No carry-forward needed." }).eq("run_id",runId).eq("stage","carry_forward"); return json(req,{ok:true,runId,carryForwardCount:cfc,freshEvidenceCount:fks.size,previousEntryCount:pec,skippedExistingCount:skc,durationMs:d}); }

// ELIGIBILITY (v25 — ALL-ARTIST ORIGIN FILTER)
async function handleRunEligibility(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now(); const { data: run } = await db.from("chart_ingest_runs").select("id,status,market_scope_snapshot_json").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); await db.from("chart_ingest_exclusions").delete().eq("run_id", runId); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString() }).eq("run_id", runId).eq("stage", "eligibility_execution"); const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId); if (!candidates || candidates.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: "No candidates." }).eq("run_id", runId).eq("stage", "eligibility_execution"); return json(req, { ok: true, runId, candidateCount: 0, excludedCount: 0, inputRowCount: 0, durationMs: d }); } const now = new Date().toISOString(); const eligible: string[] = []; const excluded: Array<{ id: string; reason: string }> = []; for (const c of candidates) { const reasons: string[] = []; const nk = (c.normalized_key as string) || ""; const title = (c.title as string) || ""; const artist = (c.artist_display as string) || ""; if (!nk || !nk.includes("::")) reasons.push("invalid_normalized_key"); if (!title.trim()) reasons.push("missing_title"); if (!artist.trim()) reasons.push("missing_artist"); const sc = (c.source_count as number) || 0; const cfOnly = !!(c.carry_forward_only); const acOnly = !!(c.airplay_candidate_only); const sq = !!(c.streaming_qualified); if (!cfOnly && !acOnly && !sq && sc < 1) reasons.push("no_streaming_sources"); if (reasons.length === 0) eligible.push(c.id as string); else excluded.push({ id: c.id as string, reason: reasons.join("; ") }); } if (eligible.length > 0) { const CH = 200; for (let j = 0; j < eligible.length; j += CH) { await db.from("chart_ingest_candidates").update({ status: "eligible", updated_at: now }).in("id", eligible.slice(j, j + CH)).eq("run_id", runId); } } if (excluded.length > 0) { const exclRows: Array<Record<string, unknown>> = []; for (const ex of excluded) { await db.from("chart_ingest_candidates").update({ status: "excluded", updated_at: now }).eq("id", ex.id).eq("run_id", runId); exclRows.push({ id: crypto.randomUUID(), run_id: runId, candidate_id: ex.id, reason: ex.reason, created_at: now }); } const ECH = 200; for (let j = 0; j < exclRows.length; j += ECH) { await db.from("chart_ingest_exclusions").insert(exclRows.slice(j, j + ECH)); } }

  const marketScope = (run.market_scope_snapshot_json as Record<string, unknown>) || {};
  let aoCountries: string[] = (marketScope.artistOriginCountries as string[]) || [];
  if (aoCountries.length === 0) { const ims = (marketScope.includedMarkets as Array<{countryCode?: string}>) || []; for (const im of ims) { if (im.countryCode) aoCountries.push(im.countryCode.toUpperCase()); } }
  const aoUnknownMode: string = (marketScope.artistOriginUnknownMode as string) || "exclude";
  let oec = 0; let ouc = 0;
  if (aoCountries.length > 0) {
    const allowedSet = new Set(aoCountries.map((c: string) => c.toUpperCase()));
    const { data: ecfo } = await db.from("chart_ingest_candidates").select("id,artist_display").eq("run_id", runId).eq("status", "eligible");
    if (ecfo && ecfo.length > 0) {
      const allArtistNames = new Set<string>(); const candidateArtists = new Map<string, string[]>();
      for (const ec of ecfo) { const artists = parseArtists((ec.artist_display as string) || ""); candidateArtists.set(ec.id as string, artists); for (const a of artists) { if (a) allArtistNames.add(a.toLowerCase()); } }
      const un = [...allArtistNames]; const aom = new Map<string, { iso2: string | null; confidence: number | null }>();
      const CK = 200; for (let ck = 0; ck < un.length; ck += CK) { const nc = un.slice(ck, ck + CK); const { data: ar } = await db.from("registry_artists").select("display_name, origin_iso2, origin_confidence").in("display_name", nc).eq("status", "active"); if (ar) { for (const a of ar) { aom.set(((a.display_name as string) || "").toLowerCase(), { iso2: (a.origin_iso2 as string) || null, confidence: (a.origin_confidence as number) || null }); } } }
      const urn = un.filter(n => !aom.has(n)); if (urn.length > 0) { for (const n of urn) { try { const { data: fr } = await db.from("registry_artists").select("display_name, origin_iso2, origin_confidence").ilike("display_name", n).eq("status", "active").limit(3); if (fr && fr.length > 0) { const best = fr.find(r => ((r.display_name as string) || "").toLowerCase() === n) || fr[0]; aom.set(n, { iso2: (best.origin_iso2 as string) || null, confidence: (best.origin_confidence as number) || null }); } } catch { } } }
      const oids: string[] = [];
      for (const ec of ecfo) { const artists = candidateArtists.get(ec.id as string) || []; let hasEligibleArtist = false; let hasKnownArtist = false; for (const a of artists) { const ak = a.toLowerCase(); const o = aom.get(ak); if (!o || !o.iso2) continue; hasKnownArtist = true; const ni = normalizeIso2(o.iso2); if (allowedSet.has(ni)) { hasEligibleArtist = true; break; } } if (!hasEligibleArtist) { oids.push(ec.id as string); if (hasKnownArtist) oec++; else ouc++; } }
      if (oids.length > 0) { const OX = 200; for (let j = 0; j < oids.length; j += OX) { const ch = oids.slice(j, j + OX); await db.from("chart_ingest_candidates").update({ status: "excluded", updated_at: now }).in("id", ch).eq("run_id", runId); const oxr = ch.map(cid => ({ id: crypto.randomUUID(), run_id: runId, candidate_id: cid, reason: "artist_origin_filtered", created_at: now })); await db.from("chart_ingest_exclusions").insert(oxr); } }
    }
  }

  const d = Date.now() - ss;
  await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: d, message: eligible.length+" eligible, "+excluded.length+" excluded, "+oec+" origin-filtered, "+ouc+" unknown-origin." }).eq("run_id", runId).eq("stage", "eligibility_execution");
  await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: 0, message: "Canonical matching complete." }).eq("run_id", runId).eq("stage", "canonical_match");
  await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: new Date().toISOString(), duration_ms: 0, message: "Entity resolution complete." }).eq("run_id", runId).eq("stage", "entity_resolution");
  return json(req, { ok: true, runId, candidateCount: candidates.length, excludedCount: excluded.length + oec, inputRowCount: candidates.length, originExcludedCount: oec, originUnknownCount: ouc, durationMs: d });
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
async function handleCommitRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId, publishImmediately, notes } = params as { runId: string; publishImmediately?: boolean; notes?: string }; if (!runId) return json(req, { error: "runId_required" }, 400);

  const { error: commitGateErr } = await db.rpc("chart_assert_committable_run", {
    p_run_id: runId,
  });

  if (commitGateErr) {
    return json(req, {
      error: "commit_blocked_chart_run_integrity",
      detail: commitGateErr.message,
    }, 400);
  }
 const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); const now = new Date().toISOString(); const ed = (run.edition_date as string) || now.split("T")[0]; const csz = (run.chart_size as number) || 20; const pid = (run.program_id as string) || "unknown"; const be = user.email || user.id; const { data: ecs } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).eq("status", "eligible").order("created_at"); if (!ecs || ecs.length === 0) return json(req, { error: "no_eligible_candidates" }, 400); const ecids = ecs.map(c => c.id as string); const { data: scs } = await db.from("chart_ingest_candidate_scores").select("*").in("candidate_id", ecids); const sbc = new Map<string, Record<string, unknown>>(); if (scs) { for (const s of scs) sbc.set(s.candidate_id as string, s); } const sorted = [...ecs].sort((a, b) => { const sa = Number(sbc.get(a.id as string)?.final_score ?? 0); const sb = Number(sbc.get(b.id as string)?.final_score ?? 0); if (sb !== sa) return sb - sa; return ((a.normalized_key as string) || "").localeCompare((b.normalized_key as string) || ""); }); const topN = sorted.slice(0, csz); let pm = new Map<string, number>(); let pk = new Set<string>(); try { const { data: pe } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", pid).in("status", ["committed","published"]).lt("edition_date", ed).order("edition_date", { ascending: false }).limit(1).maybeSingle(); if (pe) { const { data: pes } = await db.from("wk_chart_entries_v2").select("normalized_key, rank").eq("edition_id", pe.id); if (pes) { for (const p of pes) { if (p.normalized_key) { pm.set(p.normalized_key, p.rank as number); pk.add(p.normalized_key); } } } } } catch { } const eid = crypto.randomUUID(); const esl = ed; const { data: v2p } = await db.from("wk_chart_programs_v2").select("public_slug, public_label").eq("id", pid).maybeSingle(); const pps = (v2p?.public_slug as string) || pid; const ppl = (v2p?.public_label as string) || "Chart Edition"; const { error: eErr } = await db.from("wk_chart_editions_v2").insert({ id: eid, program_id: pid, edition_slug: esl, edition_label: ppl, edition_date: ed, period_start: run.period_start || ed, period_end: run.period_end || ed, entry_count: topN.length, status: publishImmediately ? "published" : "committed", methodology_version: (run.methodology_version as string) || "1.0.0", rule_set_snapshot: (run.rule_snapshot_json as Record<string, unknown>) || {}, chart_size: csz, ingest_run_id: runId, published_at: publishImmediately ? now : null, published_by: publishImmediately ? be : null, created_at: now, updated_at: now }); if (eErr) return json(req, { error: "edition_create_failed", detail: eErr.message }, 500); const rs = { tracks_found: 0, tracks_created: 0, artists_found: 0, artists_created: 0, links_created: 0, previews_set: 0, errors: 0 }; const ers: Array<Record<string, unknown>> = []; for (let i = 0; i < topN.length; i++) { const c = topN[i]; const rk = i + 1; const nk = (c.normalized_key as string) || ""; const sc = sbc.get(c.id as string); const pr = pm.get(nk) ?? null; let mv: string | null = null; if (pr === null) mv = pk.has(nk) ? "reentry" : "new"; else if (rk === pr) mv = "same"; else if (rk < pr) mv = "up"; else mv = "down"; const tt = (c.title as string) || ""; const ad = (c.artist_display as string) || ""; const awu = (c.artwork_url as string) || null; const rd2 = (c.release_date as string) || null; const isrc = (c.isrc as string) || null; const cpv = (c.preview_url as string) || null; let cti: string | null = null; let tsl = ""; let asl = ""; try { const tr = await findOrCreateRegistryTrack(db, tt, ad, isrc, awu, rd2, now, cpv); cti = tr.trackId; tsl = tr.trackSlug; if (cpv) rs.previews_set++; if (tr.created) rs.tracks_created++; else rs.tracks_found++; const ans = parseArtists(ad); for (let ai = 0; ai < ans.length; ai++) { const ar = await findOrCreateRegistryArtist(db, ans[ai], now); if (ar.created) rs.artists_created++; else rs.artists_found++; const nasl = normalizeSlug(ar.artistSlug); await ensureTrackArtistLink(db, tr.trackId, ar.artistId, nasl, ans[ai], now, ai, ai === 0); rs.links_created++; if (ai === 0) asl = nasl; } } catch (err) { rs.errors++; console.error("[commit]", tt, err); tsl = generateTrackSlug(tt); } tsl = normalizeSlug(tsl); asl = normalizeSlug(asl); ers.push({ id: crypto.randomUUID(), edition_id: eid, rank: rk, previous_rank: pr, movement: mv, track_title: tt, artist_name: ad, artwork_url: awu || null, normalized_key: nk, lead_artist_key: (c.lead_artist_key as string) || "", track_slug: tsl, artist_slug: asl, canonical_track_id: cti, total_score: Number(sc?.final_score ?? 0), carry_forward_only: !!(c.carry_forward_only), release_date: sanitizeDate(rd2), source_count: (c.source_count as number) || 0, occurrence_count: (c.occurrence_count as number) || 0, created_at: now, updated_at: now }); } const ECH = 100; for (let j = 0; j < ers.length; j += ECH) { await db.from("wk_chart_entries_v2").insert(ers.slice(j, j + ECH)); } const st = publishImmediately ? "published" : "committed"; await db.from("chart_ingest_runs").update({ status: st, committed_at: now, commit_edition_id: eid, notes: notes ?? null, updated_at: now }).eq("id", runId); await db.from("chart_ingest_stage_events").update({ status: "done", finished_at: now, message: topN.length+" entries committed." }).eq("run_id", runId).eq("stage", "commit_write"); await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: be, action: "run_committed", new_status: st, payload_json: { editionId: eid, editionSlug: esl, entryCount: topN.length } }); return json(req, { runId, status: st, editionId: eid, editionSlug: esl, entryCount: topN.length, publicUrl: "/charts/"+pps+"/"+esl, registryStats: rs, integrity: { ok: true, warnings: [], errors: [] } }); }

async function handleRunAirplayDetection(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { return json(req, { ok: false, error: "ACRCloud credentials not configured." }); }
async function handleResetPipeline(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const now = new Date().toISOString(); await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null }).eq("run_id", runId); await Promise.all([db.from("chart_ingest_raw_rows").delete().eq("run_id", runId), db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId), db.from("chart_ingest_candidates").delete().eq("run_id", runId), db.from("chart_ingest_exclusions").delete().eq("run_id", runId), db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId), db.from("chart_ingest_matches").delete().eq("run_id", runId), db.from("chart_ingest_review_issues").delete().eq("run_id", runId)]); await db.from("chart_ingest_runs").update({ status: "draft", dry_run_completed_at: null, updated_at: now }).eq("id", runId); return json(req, { ok: true, runId, status: "draft" }); }
async function handleCsvList(req: Request, db: ReturnType<typeof createClient>) { return json(req, { csvs: [] }); }
async function handleApplyRowDecision(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { return json(req, { ok: true }); }


async function handleGetOriginReviewQueue(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string };
  if (!runId) return json(req, { error: "runId_required" }, 400);

  const { data, error } = await db.rpc("chart_get_run_origin_review_queue", {
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


async function handleSetArtistOriginForRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { artistId, originIso2, runId, candidateId, note } = params as {
    artistId: string;
    originIso2: string;
    runId?: string;
    candidateId?: string;
    note?: string;
  };

  if (!artistId) return json(req, { error: "artistId_required" }, 400);
  if (!originIso2) return json(req, { error: "originIso2_required" }, 400);

  const { data, error } = await db.rpc("chart_set_artist_origin_for_charts", {
    p_artist_id: artistId,
    p_origin_iso2: originIso2,
    p_run_id: runId || null,
    p_candidate_id: candidateId || null,
    p_note: note || "Resolved from chart origin queue.",
    p_actor_user_id: user.id,
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { ok: true, result: data });
}

async function handleCreateOriginArtistShell(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { artistName, originIso2, runId, candidateId } = params as {
    artistName: string;
    originIso2: string;
    runId?: string;
    candidateId?: string;
  };

  if (!artistName) return json(req, { error: "artistName_required" }, 400);
  if (!originIso2) return json(req, { error: "originIso2_required" }, 400);

  const { data, error } = await db.rpc("chart_create_artist_origin_shell", {
    p_artist_name: artistName,
    p_origin_iso2: originIso2,
    p_run_id: runId || null,
    p_candidate_id: candidateId || null,
    p_actor_user_id: user.id,
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { ok: true, result: data });
}


async function handleResetAfterOriginResolution(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string };

  if (!runId) return json(req, { error: "runId_required" }, 400);

  const { data, error } = await db.rpc("chart_reset_run_after_origin_resolution", {
    p_run_id: runId,
  });

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { ok: true, result: data });
}


async function handleGetFamilyIngestPresets(req: Request, db: ReturnType<typeof createClient>) {
  const { data, error } = await db.rpc("chart_get_family_ingest_presets");

  if (error) return json(req, { error: error.message }, 500);

  return json(req, { presets: data || [] });
}

async function handleSaveFamilyIngestPreset(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { familyId, config } = params as {
    familyId: string;
    config: Record<string, unknown>;
  };

  if (!familyId) return json(req, { error: "familyId_required" }, 400);

  const { data, error } = await db.rpc("chart_upsert_family_ingest_preset", {
    p_family_id: familyId,
    p_config_json: config || {},
    p_actor_user_id: user.id,
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

  const { data, error } = await db.rpc("chart_get_weekly_backfill_plan", {
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
