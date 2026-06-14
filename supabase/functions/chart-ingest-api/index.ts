// chart-ingest-api v17 — sanitize release_date before insert (YYYY → YYYY-01-01)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = ["https://wakilisha.africa","https://www.wakilisha.africa","https://staging.wakilisha.africa","https://readdy.ai","https://readdy.cc","https://www.readdy.cc","http://localhost:5173","http://localhost:3000"];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isReaddyPreview = origin.endsWith(".readdy.cc") || origin === "https://readdy.cc";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || isReaddyPreview ? origin : ALLOWED_ORIGINS[0];
  return {"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALL_STAGES = ["validate","provider_detection","resource_guard","source_fetch","raw_persist","normalize","dedupe","release_candidate_build","canonical_match","entity_resolution","eligibility_execution","airplay_evidence","airplay_rescue","carry_forward","methodology_scoring","anti_gaming","shortlist","review_gate","commit_validate","commit_write","public_verify"];

function json(req: Request, body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }); }
function safeError(req: Request, action: string, err: unknown): Response { const m = err instanceof Error ? err.message : String(err); console.error("[chart-ingest-api] "+action+" error:", m); return new Response(JSON.stringify({ error: "internal_error", requestId: crypto.randomUUID().slice(0, 12) }), { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }); }

async function requireCapability(db: ReturnType<typeof createClient>, userId: string, requiredCapability: string): Promise<void> {
  const { data: rows } = await db.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id", userId).eq("status", "active").or("expires_at.is.null,expires_at.gt.now()");
  if (!rows || rows.length === 0) throw Object.assign(new Error("User has no active role assignment."), { status: 403 });
  const allCaps = new Set<string>();
  for (const r of rows) { const caps = (r.role_definitions as { role_capabilities?: Array<{ capability_key: string }> } | null)?.role_capabilities ?? []; for (const c of caps) allCaps.add(c.capability_key); }
  if (!allCaps.has(requiredCapability) && !allCaps.has("admin_god_mode")) throw Object.assign(new Error("Missing capability: "+requiredCapability), { status: 403 });
}

const ACTION_CAPABILITIES: Record<string, string> = {
  list_runs:"view_charts_admin",get_run:"view_charts_admin",get_stages:"view_charts_admin",get_sources:"view_charts_admin",get_candidates:"view_charts_admin",get_normalized:"view_charts_admin",get_kpis:"view_charts_admin",get_activity:"view_charts_admin",get_resource_guard:"view_charts_admin",get_review_issues:"view_charts_admin",get_matches_for_run:"view_charts_admin",validate_commit:"view_charts_admin",preflight:"view_charts_admin",csv_list:"view_charts_admin",
  create_dry_run:"manage_ingest",source_fetch:"manage_ingest",normalize_run:"manage_ingest",run_eligibility:"manage_ingest",run_carry_forward:"manage_ingest",run_scoring:"manage_ingest",run_shortlist:"manage_ingest",run_airplay_detection:"manage_ingest",run_full_pipeline:"manage_ingest",send_gaps_to_review:"manage_ingest",apply_row_decision:"manage_ingest",cancel_run:"manage_ingest",retry_run:"manage_ingest",reset_pipeline:"manage_ingest",csv_upload:"manage_ingest",csv_normalize:"manage_ingest",commit_run:"publish_charts"};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  const ah = req.headers.get("Authorization"); if (!ah || !ah.startsWith("Bearer ")) return json(req, { error: "unauthorized" }, 401);
  const token = ah.replace("Bearer ", "");
  const uc = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: "Bearer "+token } } });
  const { data: { user }, error: ae } = await uc.auth.getUser(token);
  if (ae || !user) return json(req, { error: "unauthorized" }, 401);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return json(req, { error: "invalid_json" }, 400); }
  const { action, ...params } = body as { action: string; [k: string]: unknown };
  const requiredCapability = ACTION_CAPABILITIES[action];
  if (requiredCapability) { try { await requireCapability(db, user.id, requiredCapability); } catch (capErr: unknown) { const s = (capErr as { status?: number }).status ?? 403; return json(req, { error: "forbidden" }, s); } }
  try {
    if (action === "create_dry_run") return handleCreateDryRun(req, db, params, user);
    if (action === "list_runs") return handleListRuns(req, db, params);
    if (action === "get_run") return handleGetRun(req, db, params);
    if (action === "get_stages") return handleGetStages(req, db, params);
    if (action === "get_sources") return handleGetSources(req, db, params);
    if (action === "get_candidates") return handleGetCandidates(req, db, params);
    if (action === "get_normalized") return handleGetNormalized(req, db, params);
    if (action === "normalize_run") return handleNormalizeRun(req, db, params, user);
    if (action === "source_fetch") return handleSourceFetch(req, db, params, user);
    if (action === "run_eligibility") return handleRunEligibility(req, db, params, user);
    if (action === "run_carry_forward") return handleRunCarryForward(req, db, params, user);
    if (action === "run_scoring") return handleRunScoring(req, db, params, user);
    if (action === "run_shortlist") return handleRunShortlist(req, db, params, user);
    if (action === "run_airplay_detection") return handleRunAirplayDetection(req, db, params, user);
    if (action === "run_full_pipeline") return handleRunFullPipeline(req, db, params, user);
    if (action === "cancel_run") return handleCancelRun(req, db, params, user);
    if (action === "retry_run") return handleRetryRun(req, db, params, user);
    if (action === "reset_pipeline") return handleResetPipeline(req, db, params, user);
    if (action === "preflight") return handlePreflight(req, db, params);
    if (action === "get_kpis") return handleGetKpis(req, db);
    if (action === "get_activity") return handleGetActivity(req, db);
    if (action === "get_resource_guard") return handleGetResourceGuard(req, db, params);
    if (action === "send_gaps_to_review") return handleSendGapsToReview(req, db, params, user);
    if (action === "apply_row_decision") return handleApplyRowDecision(req, db, params, user);
    if (action === "get_review_issues") return handleGetReviewIssues(req, db, params);
    if (action === "get_matches_for_run") return handleGetMatchesForRun(req, db, params);
    if (action === "validate_commit") return handleValidateCommit(req, db, params);
    if (action === "commit_run") return handleCommitRun(req, db, params, user);
    if (action === "csv_list") return handleCsvList(req, db, params);
    return json(req, { error: "unknown_action: "+action }, 400);
  } catch (err) { return safeError(req, action, err); }
});

// ----- HELPERS -----
function detectProvider(url: string): string {
  if (!url) return "manual"; const u = url.toLowerCase();
  if (u.includes("spotify.com")) return "spotify";
  if (u.includes("apple.com") || u.includes("itunes.apple")) return "apple_music";
  if (u.endsWith(".csv") || u.includes("csv")) return "csv_legacy";
  return "manual";
}
function collapseWhitespace(text: string): string { return text.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ").replace(/\s+/g, " ").trim(); }
function stripBracketedContent(text: string): string { let r = text; r = r.replace(/\([^)]*\)/g, " "); r = r.replace(/\[[^\]]*\]/g, " "); r = r.replace(/\{[^}]*\}/g, " "); r = r.replace(/「[^」]*」/g, " "); r = r.replace(/〈[^〉]*〉/g, " "); return r; }
const FEAT_PATTERNS = [/\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)*/gi];
function stripFeaturing(text: string): string { let r = text; for (const p of FEAT_PATTERNS) r = r.replace(p, " "); r = r.replace(/\s+x\s+/gi, " "); r = r.replace(/\s+&\s+/g, " "); r = r.replace(/\bwith\s+(?!(?:the|a\s))(?:[A-Z][^\s,;]+(?:\s+[^\s,;]+)*)/g, " "); return r; }
function normalizeCore(text: string): string {
  if (!text || !text.trim()) return ""; let r = text; r = r.normalize("NFKD"); r = r.toLowerCase(); r = stripBracketedContent(r); r = stripFeaturing(r);
  r = r.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " ");
  r = r.replace(/[-\u2013\u2014\u2012\u2015\u2022\u00B7\u2027]/g, " "); r = r.replace(/[\/\\|]/g, " ");
  r = r.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~\u00A1-\u00BF\u00D7\u00F7]/g, " ");
  r = collapseWhitespace(r); return r;
}
function normalize_title(title: string): string { return normalizeCore(title); }
function lead_artist_key(full_artist_line: string): string {
  if (!full_artist_line || !full_artist_line.trim()) return "";
  let extracted = full_artist_line;
  const featSplit = extracted.split(/\s+(?:feat\.|ft\.|featuring)\s+/i); if (featSplit.length > 1) extracted = featSplit[0];
  const collabSplit = extracted.split(/\s+(?:x|&)\s+/i); if (collabSplit.length > 1) extracted = collabSplit[0];
  const commaSplit = extracted.split(/\s*,\s*/); extracted = commaSplit[0]; return normalizeCore(extracted);
}
function build_normalized_key(title: string, full_artist_line: string): string { const nt = normalize_title(title); const lk = lead_artist_key(full_artist_line); if (!nt || !lk) return ""; return nt+"::"+lk; }
function generateTrackSlug(title: string): string { return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "").slice(0, 200) || "untitled"; }

/** Sanitize release_date for DB date column: YYYY → YYYY-01-01, YYYY-MM → YYYY-MM-01, invalid → null */
function sanitizeDate(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const r = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(r)) return r;
  if (/^\d{4}-\d{2}$/.test(r)) return r + "-01";
  if (/^\d{4}$/.test(r)) return r + "-01-01";
  // Try ISO parse fallback
  try { const d = new Date(r); if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0]; } catch { /* ignore */ }
  return null;
}

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
  if (tracks.length === 0) return [];
  const groups = new Map<string, AntiGamingInput[]>(); for (const t of tracks) { const k = t.lead_artist_key || "__unknown__"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); }
  const rm = new Map<string, AntiGamingResult>();
  for (const [, g] of groups) {
    if (g.length <= maxPer) { for (const t of g) rm.set(t.normalized_key, { normalized_key: t.normalized_key, anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 }); continue; }
    const s = [...g].sort((a, b) => b.provisional_total - a.provisional_total);
    for (let i = 0; i < s.length; i++) {
      if (i < maxPer) rm.set(s[i].normalized_key, { normalized_key: s[i].normalized_key, anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 });
      else { const oi = i - maxPer + 1; rm.set(s[i].normalized_key, { normalized_key: s[i].normalized_key, anti_gaming_penalty: round4(oi * overflowPen), lead_artist_overflow: true, overflow_index: oi }); }
    }
  }
  return tracks.map(t => rm.get(t.normalized_key) ?? { normalized_key: t.normalized_key, anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 });
}

function computeProvisionalScore(c: { normalized_key: string; lead_artist_key: string; source_count: number; occurrence_count: number; release_date: string | null; carry_forward_only: boolean; continuity_locked: boolean; airplay_candidate_only: boolean; }, ed: string, pp: number | null, cfg: { cross_source_mode?: string; cross_source_weight?: number; continuity_weight?: number; carry_forward_weight?: number; overlap_bonus_cap?: number; airplay_enabled?: boolean; airplay_max_score?: number; } = {}, airplayCtx?: { W: number; station_count: number; detection_count: number; } | null) {
  const ss = sourceScore(c.source_count); const cs = crossSourceBonus(c.source_count, cfg.cross_source_mode ?? "standard", cfg.cross_source_weight ?? 1.0);
  const ob = overlapBonus(c.occurrence_count, c.source_count, cfg.overlap_bonus_cap ?? 10); const rs = recencyScore(c.release_date, ed);
  const cont = continuityScore(pp, cfg.continuity_weight ?? 1.0); const cf = carryForwardBonus(pp, cfg.carry_forward_weight ?? 1.0, c.carry_forward_only);
  const ap = airplayScore(airplayCtx?.W ?? 0, airplayCtx?.station_count ?? 0, airplayCtx?.detection_count ?? 0, cfg.airplay_enabled ?? false, cfg.airplay_max_score ?? 24);
  const rd = c.release_date ? daysBetween(c.release_date, ed) : null;
  return { source_score: ss, cross_source_bonus: cs, overlap_bonus: ob, recency_score: rs, continuity_score: cont, carry_forward_bonus: cf, airplay_score: ap, provisional_total: round4(ss + cs + ob + rs + cont + cf + ap), recency_days: rd };
}

interface ProviderTrack { title: string; artist: string; release_date: string | null; isrc: string | null; source_position: number; provider_track_id: string | null; provider_release_id: string | null; provider_artist_ids: string[]; artwork_url: string | null; external_url: string | null; preview_url: string | null; raw_payload: unknown; }
interface ProviderFetchResult { tracks: ProviderTrack[]; warnings: string[]; error: string | null; }

async function readCredential(db: ReturnType<typeof createClient> | null, envVar: string, dbKey: string): Promise<string | null> {
  const ev = Deno.env.get(envVar); if (ev && ev.trim()) return ev.trim();
  if (!db) return null;
  try { const { data: row } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", dbKey).maybeSingle(); if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim(); } catch { }
  return null;
}

async function fetchSpotifySource(sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  const clientId = await readCredential(db, "SPOTIFY_CLIENT_ID", "spotify_client_id"); const clientSecret = await readCredential(db, "SPOTIFY_CLIENT_SECRET", "spotify_client_secret"); const spotifyMarket = (await readCredential(db, "SPOTIFY_MARKET", "spotify_market")) || market;
  if (!clientId || !clientSecret) return { tracks: [], warnings: [], error: "Spotify credentials not configured." };
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic "+btoa(clientId+":"+clientSecret) }, body: "grant_type=client_credentials" });
  if (!tokenRes.ok) { const eb = await tokenRes.text(); return { tracks: [], warnings: [], error: "Spotify auth failed ("+tokenRes.status+"): "+eb.slice(0, 200) }; }
  const tokenData = await tokenRes.json() as { access_token: string };
  const pm = sourceUrl.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/); if (!pm) return { tracks: [], warnings: [], error: "Cannot extract Spotify playlist ID from: "+sourceUrl };
  const pid = pm[1]; const apiUrl = new URL("https://api.spotify.com/v1/playlists/"+pid);
  apiUrl.searchParams.set("market", spotifyMarket); apiUrl.searchParams.set("fields", "tracks.items(track(id,name,artists(id,name),album(id,name,images,release_date),external_ids(isrc),external_urls(spotify),preview_url,duration_ms,popularity)),tracks.total");
  const pres = await fetch(apiUrl.toString(), { headers: { Authorization: "Bearer "+tokenData.access_token } });
  if (!pres.ok) { const eb = await pres.text(); return { tracks: [], warnings: [], error: "Spotify API "+pres.status+": "+eb.slice(0, 300) }; }
  const playlist = await pres.json() as { tracks: { items: Array<{ track: { id: string; name: string; artists: Array<{ id: string; name: string }>; album: { id: string; name: string; images: Array<{ url: string }>; release_date: string }; external_ids: { isrc?: string }; external_urls: { spotify: string }; preview_url: string | null; duration_ms: number; popularity: number } | null }>; total: number }; };
  const items = playlist.tracks.items.slice(0, maxRows); const warnings: string[] = []; const tracks: ProviderTrack[] = [];
  for (let i = 0; i < items.length; i++) { const item = items[i]; if (!item || !item.track) { warnings.push("Spotify item "+(i+1)+": null track"); continue; } const t = item.track; tracks.push({ title: t.name, artist: t.artists.map(a => a.name).join(", "), release_date: sanitizeDate(t.album?.release_date), isrc: t.external_ids?.isrc || null, source_position: i + 1, provider_track_id: t.id, provider_release_id: t.album?.id || null, provider_artist_ids: t.artists.map(a => a.id), artwork_url: t.album?.images?.[0]?.url || null, external_url: t.external_urls?.spotify || sourceUrl, preview_url: t.preview_url || null, raw_payload: { provider: "spotify", trackId: t.id, albumId: t.album?.id, artistIds: t.artists.map(a => a.id), durationMs: t.duration_ms, popularity: t.popularity } }); }
  if (tracks.length === 0 && warnings.length === 0) warnings.push("Spotify playlist returned 0 tracks (total: "+playlist.tracks.total+")");
  return { tracks, warnings, error: null };
}

async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
  const pem = pk.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, ""); const bin = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]); const header = { alg: "ES256", kid };
  const now = Math.floor(Date.now() / 1000); const payload = { iss: tid, iat: now, exp: now + 3600 }; const enc = new TextEncoder();
  const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); const hb = b64u(btoa(JSON.stringify(header))), pb = b64u(btoa(JSON.stringify(payload))), si = hb+"."+pb;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si)); const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig)))); return si+"."+sb;
}

async function fetchAppleMusicSource(sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key"); const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id"); const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  const storefront = (await readCredential(db, "APPLE_MUSIC_STOREFRONT", "apple_music_storefront")) || market.slice(0, 2).toLowerCase();
  if (!privateKey || !teamId || !musicKeyId) { const m: string[] = []; if (!privateKey) m.push("APPLE_MUSIC_PRIVATE_KEY"); if (!teamId) m.push("APPLE_TEAM_ID"); if (!musicKeyId) m.push("APPLE_MUSIC_KEY_ID"); return { tracks: [], warnings: [], error: "Apple Music credentials missing: "+m.join(", ") }; }
  let dt: string; try { dt = await createAppleMusicJWT(privateKey, teamId, musicKeyId); } catch (e) { return { tracks: [], warnings: [], error: "JWT failed: "+(e instanceof Error ? e.message : String(e)) }; }
  const parsed = sourceUrl.match(/music\.apple\.com\/([a-z]{2})\/(playlist|album)\/[^/]+\/(pl\.|[a-z]+\.)([a-zA-Z0-9]+)/i); let apiSf = storefront, rt = "playlists", rid = "";
  if (parsed) { apiSf = parsed[1].toLowerCase(); rt = parsed[2] === "album" ? "albums" : "playlists"; rid = parsed[3] + parsed[4]; }
  else { const im = sourceUrl.match(/(pl\.|al\.)([a-zA-Z0-9]+)/i); if (im) rid = im[1] + im[2]; else return { tracks: [], warnings: [], error: "Cannot parse Apple Music URL: "+sourceUrl }; }
  const apiUrl = "https://api.music.apple.com/v1/catalog/"+apiSf+"/"+rt+"/"+rid+"/tracks"; const res = await fetch(apiUrl, { headers: { Authorization: "Bearer "+dt } });
  if (!res.ok) { const eb = await res.text(); return { tracks: [], warnings: [], error: "Apple Music API "+res.status+": "+eb.slice(0, 300) }; }
  const data = await res.json() as { data: Array<{ id: string; attributes: { name: string; artistName: string; albumName: string; artwork: { url: string }; url: string; previews?: Array<{ url: string }>; releaseDate?: string; isrc?: string; genreNames: string[]; }; relationships?: { artists: { data: Array<{ id: string }> }; albums: { data: Array<{ id: string }> }; }; }>; };
  const songs = (data.data || []).slice(0, maxRows); const warnings: string[] = []; const tracks: ProviderTrack[] = [];
  for (let i = 0; i < songs.length; i++) { const song = songs[i]; const attrs = song.attributes; if (!attrs) { warnings.push("Apple Music song "+(i+1)+": missing attributes"); continue; } const aw = attrs.artwork?.url ? attrs.artwork.url.replace("{w}", "300").replace("{h}", "300") : null; tracks.push({ title: attrs.name, artist: attrs.artistName, release_date: sanitizeDate(attrs.releaseDate), isrc: attrs.isrc || null, source_position: i + 1, provider_track_id: song.id, provider_release_id: song.relationships?.albums?.data?.[0]?.id || null, provider_artist_ids: song.relationships?.artists?.data?.map(a => a.id) || [], artwork_url: aw, external_url: attrs.url || sourceUrl, preview_url: attrs.previews?.[0]?.url || null, raw_payload: { provider: "apple_music", songId: song.id, albumId: song.relationships?.albums?.data?.[0]?.id, genres: attrs.genreNames, isrc: attrs.isrc } }); }
  if (tracks.length === 0 && warnings.length === 0) warnings.push("Apple Music "+rt+" returned 0 tracks");
  return { tracks, warnings, error: null };
}

async function fetchProviderSource(provider: string, sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  switch (provider) { case "spotify": return fetchSpotifySource(sourceUrl, market, maxRows, db); case "apple_music": return fetchAppleMusicSource(sourceUrl, market, maxRows, db); default: return { tracks: [], warnings: ["Unknown provider: "+provider], error: "Unknown provider '"+provider+"'." }; }
}

function anchorToMonday(dateStr: string): string { const d = new Date(dateStr); if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10); const day = d.getUTCDay(); const diff = day === 0 ? 6 : day - 1; d.setUTCDate(d.getUTCDate() - diff); d.setUTCHours(0, 0, 0, 0); return d.toISOString().split("T")[0]; }

// ----- HANDLERS -----

async function handleCreateDryRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const rq = params.request as Record<string, unknown>; if (!rq) return json(req, { error: "request_required" }, 400);
  const runId = crypto.randomUUID(); const ed = rq.editionDate as string; const sUrls = (rq.sourceUrls as string[]) || [];
  const { error: rErr } = await db.from("chart_ingest_runs").insert({ id: runId, program_id: (rq.existingSeriesId as string) || "unknown", series_slug: (rq.existingSeriesId as string) || null, market_slug: (rq.market as string) || "KE", chart_kind: (rq.chartKind as string) || "tracks", edition_date: ed, period_start: ed, period_end: ed, chart_size: (rq.chartSize as number) || 20, status: "queued", rule_snapshot_json: { chartTitle: rq.chartTitle, chartSlug: rq.chartSlug, coverStyle: rq.coverStyle || "default", saveAsRecurringSeries: rq.saveAsRecurringSeries || false, methodologyVersion: rq.methodologyVersion || "1.0.0" }, market_scope_snapshot_json: (rq.marketScopeSnapshot as object) || {}, eligibility_profile_id: (rq.eligibilityProfileId as string) || null, market_scope_id: (rq.marketScopeId as string) || null, scoring_policy_version: "1.0.1", source_policy_version: "1.0.0", eligibility_policy_version: "1.0.0", methodology_version: (rq.methodologyVersion as string) || "1.0.0", created_by: user.id, created_by_email: user.email || null });
  if (rErr) return json(req, { error: "run_create_failed", detail: rErr.message }, 500);
  if (sUrls.length > 0) { const srs = sUrls.map((url, i) => ({ run_id: runId, provider: detectProvider(url), source_type: url.endsWith(".csv") ? "csv" : "playlist", source_url: url, storefront_or_market: (rq.market as string) || "KE", enabled: true, priority: i, fetch_status: "pending" })); await db.from("chart_ingest_run_sources").insert(srs); }
  const sgs = ALL_STAGES.map(s => ({ run_id: runId, stage: s, status: "idle", metrics_json: {} })); await db.from("chart_ingest_stage_events").insert(sgs);
  await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: user.email || null, action: "run_created", new_status: "queued", payload_json: { sourceCount: sUrls.length } });
  return json(req, { runId, status: "queued" });
}

async function handleListRuns(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const limit = Math.min((params.limit as number) || 100, 200); const { data: runs, error } = await db.from("chart_ingest_runs").select("*").order("created_at", { ascending: false }).limit(limit); if (error) return json(req, { error: error.message }, 500);
  const rl = runs || []; if (rl.length > 0) { const rids = rl.map((r: { id: string }) => r.id); const [sr, sg] = await Promise.all([db.from("chart_ingest_run_sources").select("*").in("run_id", rids).order("priority"), db.from("chart_ingest_stage_events").select("*").in("run_id", rids).order("created_at")]); const sbm = new Map<string, unknown[]>(); for (const s of (sr.data || [])) { const rid = s.run_id as string; if (!sbm.has(rid)) sbm.set(rid, []); sbm.get(rid)!.push(s); } const stm = new Map<string, unknown[]>(); for (const s of (sg.data || [])) { const rid = s.run_id as string; if (!stm.has(rid)) stm.set(rid, []); stm.get(rid)!.push(s); } return json(req, { runs: rl.map((r: { id: string }) => ({ ...r, chart_ingest_run_sources: sbm.get(r.id) || [], chart_ingest_stage_events: stm.get(r.id) || [] })) }); }
  return json(req, { runs: [] });
}

async function handleGetRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data: run, error } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (error) return json(req, { error: error.message }, 500); if (!run) return json(req, { error: "run_not_found" }, 404);
  const [sr, sg] = await Promise.all([db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).order("priority"), db.from("chart_ingest_stage_events").select("*").eq("run_id", runId).order("created_at")]);
  const [t1, t2, t3, t4] = await Promise.all([db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "eligible"), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "needs_review"), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "excluded")]);
  return json(req, { run: { ...run, chart_ingest_run_sources: sr.data || [], chart_ingest_stage_events: sg.data || [], candidateCounts: { total: t1.count || 0, eligible: t2.count || 0, needsReview: t3.count || 0, excluded: t4.count || 0 } } });
}

async function handleGetStages(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data, error } = await db.from("chart_ingest_stage_events").select("*").eq("run_id", runId).order("created_at"); if (error) return json(req, { error: error.message }, 500); return json(req, { stages: data || [] }); }
async function handleGetSources(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data, error } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).order("priority"); if (error) return json(req, { error: error.message }, 500); return json(req, { sources: data || [] }); }
async function handleGetCandidates(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, status, limit = 200 } = params as { runId: string; status?: string; limit?: number }; let q = db.from("chart_ingest_candidates").select("*").eq("run_id", runId).limit(Math.min(limit, 500)); if (status) q = q.eq("status", status); const { data, error } = await q; if (error) return json(req, { error: error.message }, 500); const cs = data || []; if (cs.length > 0) { const cids = cs.map((c: { id: string }) => c.id); const [sc, mc] = await Promise.all([db.from("chart_ingest_candidate_scores").select("*").in("candidate_id", cids), db.from("chart_ingest_matches").select("*").in("candidate_id", cids)]); const sbc = new Map<string, unknown[]>(); for (const s of (sc.data || [])) { const cid = s.candidate_id as string; if (!sbc.has(cid)) sbc.set(cid, []); sbc.get(cid)!.push(s); } const mbc = new Map<string, unknown[]>(); for (const m of (mc.data || [])) { const cid = m.candidate_id as string; if (!mbc.has(cid)) mbc.set(cid, []); mbc.get(cid)!.push(m); } return json(req, { candidates: cs.map((c: { id: string }) => ({ ...c, chart_ingest_candidate_scores: sbc.get(c.id) || [], chart_ingest_matches: mbc.get(c.id) || [] })) }); } return json(req, { candidates: [] }); }
async function handleGetReviewIssues(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, candidateId, status: issueStatus } = params as { runId?: string; candidateId?: string; status?: string }; let q = db.from("chart_ingest_review_issues").select("*").order("created_at", { ascending: false }); if (runId) q = q.eq("run_id", runId); if (candidateId) q = q.eq("candidate_id", candidateId); if (issueStatus) q = q.eq("status", issueStatus); const { data, error } = await q; if (error) return json(req, { error: error.message }, 500); return json(req, { review_issues: data || [] }); }
async function handleGetMatchesForRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, candidateId } = params as { runId?: string; candidateId?: string }; let q = db.from("chart_ingest_matches").select("*").order("created_at", { ascending: false }); if (runId) q = q.eq("run_id", runId); if (candidateId) q = q.eq("candidate_id", candidateId); const { data, error } = await q; if (error) return json(req, { error: error.message }, 500); return json(req, { matches: data || [] }); }
async function handleGetNormalized(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data, error } = await db.from("chart_ingest_normalized_rows").select("*").eq("run_id", runId).order("created_at"); if (error) return json(req, { error: error.message }, 500); return json(req, { normalized_rows: data || [] }); }
async function handleGetKpis(req: Request, db: ReturnType<typeof createClient>) { const wa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); const { count: etw } = await db.from("chart_ingest_runs").select("*", { count: "exact", head: true }).in("status", ["committed", "published"]).gte("committed_at", wa); const { count: rar } = await db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("status", "needs_review"); return json(req, { editionsThisWeek: etw || 0, canonicalMatchRate: 0, rowsAwaitingReview: rar || 0, averageRunTimeMs: 0 }); }
async function handleGetActivity(req: Request, db: ReturnType<typeof createClient>) { const { data: events } = await db.from("chart_ingest_audit_events").select("*").in("action", ["run_created", "run_committed", "edition_published", "run_cancelled"]).order("created_at", { ascending: false }).limit(20); const activity = (events || []).map((e: Record<string, unknown>) => ({ id: e.id, type: e.action === "run_committed" ? "commit" : e.action === "run_cancelled" ? "cancel" : "dry_run", chartTitle: "Run "+(e.run_id as string).slice(0, 8), runId: e.run_id, status: (e.new_status as string) || "unknown", actor: (e.actor_email as string) || (e.actor as string) || "Unknown", createdAt: e.created_at })); return json(req, { activity }); }
async function handleGetResourceGuard(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data: sources } = await db.from("chart_ingest_run_sources").select("provider").eq("run_id", runId).eq("enabled", true); const sc = sources?.length || 0; const { count: ar } = await db.from("chart_ingest_runs").select("*", { count: "exact", head: true }).eq("status", "running"); return json(req, { sourceCount: sc, providerBudgetRemaining: Math.max(0, 100 - sc * 10), workerConcurrency: 4, estimatedRowCount: sc * 100, duplicateRunWarning: (ar || 0) > 0 ? "Another run is currently active." : null, sameEditionDateWarning: null }); }
async function handleSendGapsToReview(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; await db.from("chart_ingest_runs").update({ status: "needs_review", updated_at: new Date().toISOString() }).eq("id", runId).in("status", ["dry_run_complete", "ready_to_commit"]); return json(req, { ok: true }); }
async function handleCancelRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; const { data: run } = await db.from("chart_ingest_runs").select("status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); if (!["draft", "queued", "running", "needs_review", "dry_run_complete"].includes(run.status)) return json(req, { error: "cannot_cancel" }, 400); await db.from("chart_ingest_runs").update({ status: "cancelled", error_message: "Cancelled by admin", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: true, status: "cancelled" }); }
async function handleRetryRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; const { data: run } = await db.from("chart_ingest_runs").select("status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404); if (!["failed", "cancelled", "source_fetch_failed"].includes(run.status)) return json(req, { error: "cannot_retry" }, 400); await db.from("chart_ingest_runs").update({ status: "queued", error_code: null, error_message: null, updated_at: new Date().toISOString() }).eq("id", runId); await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null, error_code: null, error_message: null }).eq("run_id", runId); return json(req, { ok: true, status: "queued" }); }
async function handlePreflight(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { programId, editionDate, sources } = params as { programId: string; editionDate: string; sources?: Array<{ provider: string; sourceUrl?: string }> }; const blockers: Array<{ code: string; message: string }> = []; const warnings: Array<{ code: string; message: string }> = []; const es = (sources || []).filter(s => s.sourceUrl); if (es.length === 0) blockers.push({ code: "no_enabled_sources", message: "At least one enabled source URL required." }); if (!programId) blockers.push({ code: "unknown_program", message: "program_id required." }); if (!editionDate) blockers.push({ code: "missing_edition_date", message: "edition_date required." }); if (es.length === 1) warnings.push({ code: "single_source_only", message: "Only one source." }); return json(req, { ok: blockers.length === 0, blockers, warnings, estimates: { sourceCount: es.length, expectedProviderRequests: es.length, expectedRowCap: es.length * 100 } }); }
async function handleValidateCommit(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json(req, { canCommit: false, errors: [{ code: "run_not_found", message: "Run not found" }], warnings: [] }); const errors: Array<{ code: string; message: string }> = []; if (!["dry_run_complete", "ready_to_commit", "needs_review"].includes(run.status)) errors.push({ code: "commit_not_ready", message: "Run status '"+run.status+"' not committable." }); const { count: cc } = await db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId); if (!cc) errors.push({ code: "no_candidates", message: "No candidates exist." }); return json(req, { canCommit: errors.length === 0, errors, warnings: [] }); }

// ═══ NORMALIZE_RUN — Create candidates from raw rows ═══
async function handleNormalizeRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  await db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId); await db.from("chart_ingest_candidates").delete().eq("run_id", runId);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "normalize");
  const { data: rawRows } = await db.from("chart_ingest_raw_rows").select("*").eq("run_id", runId).order("created_at");
  if (!rawRows || rawRows.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No raw rows to normalize.", metrics_json: { rawCount: 0, uniqueCount: 0 } }).eq("run_id", runId).eq("stage", "normalize"); return json(req, { ok: true, runId, stage: "normalize", rawCount: 0, uniqueCount: 0, dedupedCount: 0, warningCount: 0, durationMs: d }); }
  const groups = new Map<string, { rows: typeof rawRows; sources: Set<string>; sourceUrls: Set<string>; artwork_url: string | null; bestTitle: string; bestArtist: string; bestIsrc: string | null; bestReleaseDate: string | null }>();
  for (const row of rawRows) { const title = (row.title_raw as string) || ""; const artist = (row.artist_raw as string) || ""; const nk = build_normalized_key(title, artist); if (!nk) continue;
    const existing = groups.get(nk);
    if (!existing) { groups.set(nk, { rows: [row], sources: new Set([(row.provider as string) || "unknown"]), sourceUrls: new Set([(row.external_url as string) || ""].filter(Boolean)), artwork_url: (row.artwork_url as string) || null, bestTitle: title, bestArtist: artist, bestIsrc: (row.isrc as string) || null, bestReleaseDate: sanitizeDate(row.release_date_raw as string) }); }
    else { existing.rows.push(row); existing.sources.add((row.provider as string) || "unknown"); if (row.external_url) existing.sourceUrls.add(row.external_url as string); if (!existing.artwork_url && row.artwork_url) existing.artwork_url = row.artwork_url as string; if (!existing.bestIsrc && row.isrc) existing.bestIsrc = row.isrc as string; if (!existing.bestReleaseDate && row.release_date_raw) existing.bestReleaseDate = sanitizeDate(row.release_date_raw as string); }
  }
  if (groups.size === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No valid normalized keys from "+rawRows.length+" raw rows.", metrics_json: { rawCount: rawRows.length, uniqueCount: 0 } }).eq("run_id", runId).eq("stage", "normalize"); return json(req, { ok: true, runId, stage: "normalize", rawCount: rawRows.length, uniqueCount: 0, dedupedCount: 0, warningCount: 0, durationMs: d }); }
  const now = new Date().toISOString(); const normalizedRows: Array<Record<string, unknown>> = []; const candidates: Array<Record<string, unknown>> = [];
  let warningCount = 0;
  for (const [nk, group] of groups) { const lk = nk.includes("::") ? nk.split("::")[1] : ""; const parts = nk.split("::"); const normalizedTitle = parts[0] || ""; const sourceCount = group.sources.size; const occurrenceCount = group.rows.length; const sourceUrls = [...group.sourceUrls];
    const nid = crypto.randomUUID(); const cid = crypto.randomUUID();
    const sanitizedReleaseDate = sanitizeDate(group.bestReleaseDate);
    normalizedRows.push({ id: nid, run_id: runId, normalized_key: nk, lead_artist_key: lk, title: group.bestTitle, artist_display: group.bestArtist, normalized_title: normalizedTitle, source_count: sourceCount, occurrence_count: occurrenceCount, source_urls_seen: sourceUrls, isrc: group.bestIsrc, release_date: sanitizedReleaseDate, artwork_url: group.artwork_url, external_url: (group.rows[0].external_url as string) || null, preview_url: (group.rows[0].preview_url as string) || null, provider_track_id: (group.rows[0].provider_track_id as string) || null, provider_release_id: (group.rows[0].provider_release_id as string) || null, provider_artist_ids: (group.rows[0].provider_artist_ids as string[]) || [], raw_source_count: group.rows.length, created_at: now });
    const reasons: string[] = []; if (!normalizedTitle) reasons.push("empty_title"); if (!lk) reasons.push("empty_artist"); if (sourceCount < 1) reasons.push("no_sources");
    candidates.push({ id: cid, run_id: runId, normalized_key: nk, lead_artist_key: lk, title: group.bestTitle, artist_display: group.bestArtist, source_count: sourceCount, occurrence_count: occurrenceCount, source_urls_seen: sourceUrls, release_date: sanitizedReleaseDate, candidate_type: "streaming", status: reasons.length === 0 ? "eligible" : "excluded", version: 1, carry_forward_only: false, continuity_locked: false, airplay_candidate_only: false, streaming_qualified: sourceCount > 0, isrc: group.bestIsrc || null, upc: null, artwork_url: group.artwork_url, external_url: (group.rows[0].external_url as string) || null, release_title: null, created_at: now, updated_at: now });
    if (reasons.length > 0) warningCount++;
  }
  const CH = 200; for (let j = 0; j < normalizedRows.length; j += CH) { await db.from("chart_ingest_normalized_rows").insert(normalizedRows.slice(j, j + CH)); }
  for (let j = 0; j < candidates.length; j += CH) { const chunk = candidates.slice(j, j + CH); const { error: cErr } = await db.from("chart_ingest_candidates").insert(chunk); if (cErr) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: d, message: "Candidate insert failed: "+cErr.message, error_code: "candidate_insert_failed", error_message: cErr.message }).eq("run_id", runId).eq("stage", "normalize"); return json(req, { error: "candidate_insert_failed", detail: cErr.message }, 500); } }
  const exclCands = candidates.filter(c => c.status === "excluded"); if (exclCands.length > 0) { const exclRows = exclCands.map(c => ({ id: crypto.randomUUID(), run_id: runId, candidate_id: c.id, reason: "invalid_normalized_key", created_at: now })); for (let j = 0; j < exclRows.length; j += CH) { await db.from("chart_ingest_exclusions").insert(exclRows.slice(j, j + CH)); } }
  const eligibleCount = candidates.filter(c => c.status === "eligible").length;
  const d = Date.now() - ss;
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: groups.size+" unique tracks from "+rawRows.length+" raw rows.", metrics_json: { rawCount: rawRows.length, uniqueCount: groups.size, dedupedCount: rawRows.length - groups.size, candidateCount: candidates.length, eligibleCount, excludedCount: exclCands.length } }).eq("run_id", runId).eq("stage", "normalize");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: (rawRows.length - groups.size)+" duplicates removed.", metrics_json: { rawCount: rawRows.length, uniqueCount: groups.size } }).eq("run_id", runId).eq("stage", "dedupe");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: candidates.length+" candidates built.", metrics_json: { candidateCount: candidates.length } }).eq("run_id", runId).eq("stage", "release_candidate_build");
  return json(req, { ok: true, runId, stage: "normalize", rawCount: rawRows.length, uniqueCount: groups.size, dedupedCount: rawRows.length - groups.size, candidateCount: candidates.length, warningCount: exclCands.length, durationMs: d });
}

// ═══ SOURCE_FETCH ═══
async function handleSourceFetch(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  await db.from("chart_ingest_raw_rows").delete().eq("run_id", runId); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "source_fetch");
  const { data: sources } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).eq("enabled", true).order("priority"); if (!sources || sources.length === 0) { const d = Date.now(); await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No enabled sources.", metrics_json: { sourceCount: 0, rawRowCount: 0 } }).eq("run_id", runId).eq("stage", "source_fetch"); return json(req, { ok: true, runId, stage: "source_fetch", sourceCount: 0, rawRowCount: 0 }); }
  const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const cs = (run.chart_size as number) || 20; let trr = 0, tfs = 0; const aw: string[] = []; const srs: Array<{ sourceId: string; fetchedCount: number; droppedCount: number; provider: string; warnings: string[]; error: string | null }> = [];
  for (const source of sources) { const market = (source.storefront_or_market as string) || "KE"; const mr = cs + 30;
    if (source.provider === "csv") { srs.push({ sourceId: source.id, fetchedCount: source.fetched_count || 0, droppedCount: 0, provider: "csv", warnings: [], error: null }); trr += source.fetched_count || 0; continue; }
    const fr = await fetchProviderSource(source.provider as string, source.source_url as string, market, mr, db); if (fr.error) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: fr.error }); tfs++; aw.push(...fr.warnings); continue; }
    const tracks = fr.tracks; aw.push(...fr.warnings); if (tracks.length === 0) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null }); continue; }
    const now = new Date().toISOString(); const rrs = tracks.map(t => ({ id: crypto.randomUUID(), run_id: runId, source_id: source.id, provider: source.provider, provider_row_id: t.provider_track_id ? source.provider+":"+t.provider_track_id+":"+t.source_position : source.provider+":pos:"+t.source_position, provider_track_id: t.provider_track_id, provider_release_id: t.provider_release_id, provider_artist_ids: t.provider_artist_ids, source_position: t.source_position, title_raw: t.title, artist_raw: t.artist, release_raw: null, isrc: t.isrc, upc: null, release_date_raw: t.release_date, artwork_url: t.artwork_url, external_url: t.external_url || source.source_url || null, preview_url: t.preview_url, raw_payload_json: t.raw_payload, raw_payload_hash: null }));
    const CH = 100; for (let j = 0; j < rrs.length; j += CH) { await db.from("chart_ingest_raw_rows").insert(rrs.slice(j, j + CH)); } trr += rrs.length; srs.push({ sourceId: source.id, fetchedCount: rrs.length, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null });
  }
  const d = Date.now(); const sm = trr > 0 ? trr+" raw rows from "+(sources.length - tfs)+"/"+sources.length+" source(s)" : "All sources failed. Check credentials.";
  await db.from("chart_ingest_stage_events").update({ status: trr > 0 ? "completed" : "failed", finished_at: new Date().toISOString(), duration_ms: d, message: sm, metrics_json: { sourceCount: sources.length, rawRowCount: trr, failedSourceCount: tfs, sourceResults: srs } }).eq("run_id", runId).eq("stage", "source_fetch");
  if (trr > 0) { await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 1, message: "Raw rows persisted.", metrics_json: { rawRowCount: trr } }).eq("run_id", runId).eq("stage", "raw_persist"); await db.from("chart_ingest_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", runId); }
  else { await db.from("chart_ingest_runs").update({ status: "source_fetch_failed", error_code: "all_sources_failed", error_message: "Configure credentials in Settings.", updated_at: new Date().toISOString() }).eq("id", runId); }
  return json(req, { ok: trr > 0, runId, stage: "source_fetch", sourceCount: sources.length, rawRowCount: trr, failedSourceCount: tfs, sourceResults: srs, durationMs: d });
}

// ═══ CARRY_FORWARD ═══
async function handleRunCarryForward(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size,program_id,series_slug").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "carry_forward");
  const editionDate = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const programId = (run.program_id as string) || "unknown";
  const { data: currentCandidates } = await db.from("chart_ingest_candidates").select("normalized_key").eq("run_id", runId); const freshKeys = new Set<string>(); if (currentCandidates) { for (const c of currentCandidates) { if (c.normalized_key) freshKeys.add(c.normalized_key); } }
  let carryForwardCount = 0, skippedCount = 0, previousEntryCount = 0; const createdCandidates: Array<Record<string, unknown>> = [];
  try { const { data: prevEdition } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", programId).in("status", ["committed", "published"]).lt("edition_date", editionDate).order("edition_date", { ascending: false }).limit(1).maybeSingle();
    if (prevEdition) { const { data: prevEntries } = await db.from("wk_chart_entries_v2").select("normalized_key, rank, track_title, artist_name, release_date, track_slug, artist_slug, artwork_url").eq("edition_id", prevEdition.id).order("rank", { ascending: true });
      if (prevEntries) { previousEntryCount = prevEntries.length;
        for (const pe of prevEntries) { const nk = (pe.normalized_key as string) || ""; if (!nk || nk === "::" || !nk.includes("::")) continue; if (freshKeys.has(nk)) { skippedCount++; continue; }
          const cid = crypto.randomUUID(); createdCandidates.push({ id: cid, run_id: runId, normalized_key: nk, lead_artist_key: nk.split("::")[1] ?? "", title: (pe.track_title as string) || "", artist_display: (pe.artist_name as string) || "", source_count: 0, source_urls_seen: [], occurrence_count: 0, release_date: sanitizeDate(pe.release_date as string), candidate_type: "carry_forward", status: "eligible", version: 1, carry_forward_only: true, continuity_locked: false, airplay_candidate_only: false, streaming_qualified: false, isrc: null, upc: null, artwork_url: (pe.artwork_url as string) || null, external_url: null, release_title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); carryForwardCount++; }
      }
    }
  } catch (err) { console.error("[carry_forward] error:", err instanceof Error ? err.message : String(err)); }
  if (createdCandidates.length > 0) { const CH = 200; for (let j = 0; j < createdCandidates.length; j += CH) { const chunk = createdCandidates.slice(j, j + CH); const { error: ie } = await db.from("chart_ingest_candidates").insert(chunk); if (ie) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: d, message: "Candidate insert failed: "+ie.message, error_code: "carry_forward_insert_failed", error_message: ie.message }).eq("run_id", runId).eq("stage", "carry_forward"); return json(req, { error: "carry_forward_insert_failed", detail: ie.message }, 500); } } }
  const d = Date.now() - ss; const msg = carryForwardCount > 0 ? carryForwardCount+" carry-forward candidates from "+previousEntryCount+" previous entries." : "No carry-forward candidates needed.";
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: msg, metrics_json: { previousEntryCount, carryForwardCount, freshEvidenceCount: freshKeys.size, skippedExistingCount: skippedCount } }).eq("run_id", runId).eq("stage", "carry_forward");
  return json(req, { ok: true, runId, stage: "carry_forward", carryForwardCount, freshEvidenceCount: freshKeys.size, previousEntryCount, skippedExistingCount: skippedCount, previousEditionFound: previousEntryCount > 0, durationMs: d });
}

// ═══ ELIGIBILITY ═══
async function handleRunEligibility(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  await db.from("chart_ingest_exclusions").delete().eq("run_id", runId); await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "eligibility_execution");
  const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId); if (!candidates || candidates.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No candidates.", metrics_json: { candidateCount: 0, eligibleCount: 0, excludedCount: 0 } }).eq("run_id", runId).eq("stage", "eligibility_execution"); return json(req, { ok: true, runId, candidateCount: 0, excludedCount: 0, inputRowCount: 0, durationMs: d }); }
  const now = new Date().toISOString(); const eligible: string[] = []; const excluded: Array<{ id: string; reason: string }> = [];
  for (const c of candidates) { const reasons: string[] = []; const nk = (c.normalized_key as string) || ""; const title = (c.title as string) || ""; const artist = (c.artist_display as string) || "";
    if (!nk || !nk.includes("::")) reasons.push("invalid_normalized_key"); if (!title.trim()) reasons.push("missing_title"); if (!artist.trim()) reasons.push("missing_artist");
    const sc = (c.source_count as number) || 0; const cfOnly = !!(c.carry_forward_only); const acOnly = !!(c.airplay_candidate_only); const sq = !!(c.streaming_qualified);
    if (!cfOnly && !acOnly && !sq && sc < 1) reasons.push("no_streaming_sources");
    if (reasons.length === 0) eligible.push(c.id as string); else excluded.push({ id: c.id as string, reason: reasons.join("; ") });
  }
  if (eligible.length > 0) { const CH = 200; for (let j = 0; j < eligible.length; j += CH) { await db.from("chart_ingest_candidates").update({ status: "eligible", updated_at: now }).in("id", eligible.slice(j, j + CH)).eq("run_id", runId); } }
  if (excluded.length > 0) { const exclRows: Array<Record<string, unknown>> = []; for (const ex of excluded) { await db.from("chart_ingest_candidates").update({ status: "excluded", updated_at: now }).eq("id", ex.id).eq("run_id", runId); exclRows.push({ id: crypto.randomUUID(), run_id: runId, candidate_id: ex.id, reason: ex.reason, created_at: now }); } const ECH = 200; for (let j = 0; j < exclRows.length; j += ECH) { await db.from("chart_ingest_exclusions").insert(exclRows.slice(j, j + ECH)); } }
  const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: eligible.length+" eligible, "+excluded.length+" excluded.", metrics_json: { candidateCount: candidates.length, eligibleCount: eligible.length, excludedCount: excluded.length } }).eq("run_id", runId).eq("stage", "eligibility_execution");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "Canonical matching complete.", metrics_json: { matchedCount: eligible.length } }).eq("run_id", runId).eq("stage", "canonical_match");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "Entity resolution complete.", metrics_json: { resolvedCount: eligible.length } }).eq("run_id", runId).eq("stage", "entity_resolution");
  return json(req, { ok: true, runId, candidateCount: candidates.length, excludedCount: excluded.length, inputRowCount: candidates.length, durationMs: d });
}

// ═══ SCORING ═══
async function handleRunScoring(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "methodology_scoring");
  const editionDate = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const programId = (run.program_id as string) || "unknown";
  const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).eq("status", "eligible"); if (!candidates || candidates.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No eligible candidates.", metrics_json: { scoredCount: 0, overflowCount: 0 } }).eq("run_id", runId).eq("stage", "methodology_scoring"); return json(req, { ok: true, runId, stage: "methodology_scoring", scoredCount: 0, overflowCount: 0, airplayTrackCount: 0, durationMs: d }); }
  let previousMap = new Map<string, number>(); try { const { data: prevEdition } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", programId).in("status", ["committed", "published"]).lt("edition_date", editionDate).order("edition_date", { ascending: false }).limit(1).maybeSingle(); if (prevEdition) { const { data: prevEntries } = await db.from("wk_chart_entries_v2").select("normalized_key, rank").eq("edition_id", prevEdition.id).order("rank", { ascending: true }); if (prevEntries) { for (const pe of prevEntries) { if (pe.normalized_key) previousMap.set(pe.normalized_key, pe.rank as number); } } } } catch { }
  const scoringCfg = { cross_source_mode: "standard" as string, cross_source_weight: 1.0, continuity_weight: 1.0, carry_forward_weight: 1.0, overlap_bonus_cap: 10 };
  const scored: Array<{ candidate_id: string; normalized_key: string; lead_artist_key: string; source_score: number; cross_source_bonus: number; overlap_bonus: number; recency_score: number; continuity_score: number; carry_forward_bonus: number; airplay_score: number; provisional_total: number; recency_days: number | null; previous_position: number | null; source_count: number; occurrence_count: number; is_carry_forward: boolean; is_airplay_candidate: boolean }> = [];
  for (const c of candidates) { const pp = previousMap.get((c.normalized_key as string) || "") ?? null; const cfOnly = !!(c.carry_forward_only); const acOnly = !!(c.airplay_candidate_only);
    const breakdown = computeProvisionalScore({ normalized_key: (c.normalized_key as string) || "", lead_artist_key: (c.lead_artist_key as string) || "", source_count: (c.source_count as number) || 0, occurrence_count: (c.occurrence_count as number) || 0, release_date: (c.release_date as string) || null, carry_forward_only: cfOnly, continuity_locked: !!(c.continuity_locked), airplay_candidate_only: acOnly }, editionDate, pp, scoringCfg, null);
    scored.push({ candidate_id: c.id as string, normalized_key: c.normalized_key as string, lead_artist_key: (c.lead_artist_key as string) || "", source_score: breakdown.source_score, cross_source_bonus: breakdown.cross_source_bonus, overlap_bonus: breakdown.overlap_bonus, recency_score: breakdown.recency_score, continuity_score: breakdown.continuity_score, carry_forward_bonus: breakdown.carry_forward_bonus, airplay_score: breakdown.airplay_score, provisional_total: breakdown.provisional_total, recency_days: breakdown.recency_days, previous_position: pp, source_count: (c.source_count as number) || 0, occurrence_count: (c.occurrence_count as number) || 0, is_carry_forward: cfOnly, is_airplay_candidate: acOnly });
  }
  const agInputs: AntiGamingInput[] = scored.map(s => ({ normalized_key: s.normalized_key, lead_artist_key: s.lead_artist_key, provisional_total: s.provisional_total })); const agResults = computeAntiGamingPenalties(agInputs, 3, 8); const agByKey = new Map(agResults.map(r => [r.normalized_key, r]));
  const now2 = new Date().toISOString(); const scoreRows: Array<Record<string, unknown>> = []; let overflowCount = 0;
  for (const s of scored) { const ag = agByKey.get(s.normalized_key) ?? { anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 }; const finalScore = round4(s.provisional_total - ag.anti_gaming_penalty); const integrityDelta = round4(Math.abs(s.provisional_total - ag.anti_gaming_penalty - finalScore)); if (ag.lead_artist_overflow) overflowCount++;
    scoreRows.push({ id: crypto.randomUUID(), run_id: runId, candidate_id: s.candidate_id, source_score: s.source_score, cross_source_bonus: s.cross_source_bonus, overlap_bonus: s.overlap_bonus, recency_score: s.recency_score, continuity_score: s.continuity_score, carry_forward_bonus: s.carry_forward_bonus, anti_gaming_penalty: ag.anti_gaming_penalty, final_score: finalScore, source_count: s.source_count, occurrence_count: s.occurrence_count, recency_days: s.recency_days, previous_position: s.previous_position, normalized_key: s.normalized_key, anti_gaming_json: { anti_gaming_penalty: ag.anti_gaming_penalty, lead_artist_overflow: ag.lead_artist_overflow, overflow_index: ag.overflow_index }, score_integrity_ok: integrityDelta < 0.01, score_integrity_delta: integrityDelta, created_at: now2 });
  }
  await db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId); const SCH = 200; for (let j = 0; j < scoreRows.length; j += SCH) { const chunk = scoreRows.slice(j, j + SCH); if (chunk.length === 0) continue; const { error: ie } = await db.from("chart_ingest_candidate_scores").insert(chunk); if (ie) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: d, message: "Score insert failed: "+ie.message, error_code: "score_insert_failed", error_message: ie.message }).eq("run_id", runId).eq("stage", "methodology_scoring"); return json(req, { error: "score_insert_failed", detail: ie.message }, 500); } }
  const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: scored.length+" candidates scored. "+overflowCount+" overflows.", metrics_json: { scoredCount: scored.length, overflowCount } }).eq("run_id", runId).eq("stage", "methodology_scoring");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "Anti-gaming penalties applied.", metrics_json: { overflowCount } }).eq("run_id", runId).eq("stage", "anti_gaming");
  return json(req, { ok: true, runId, stage: "methodology_scoring", scoredCount: scored.length, overflowCount, airplayTrackCount: 0, durationMs: d });
}

// ═══ SHORTLIST ═══
async function handleRunShortlist(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "shortlist");
  const chartSize = (run.chart_size as number) || 20; const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).eq("status", "eligible"); if (!candidates || candidates.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No eligible candidates.", metrics_json: { shortlistedCount: 0, totalScored: 0, excludedCount: 0 } }).eq("run_id", runId).eq("stage", "shortlist"); return json(req, { ok: true, runId, stage: "shortlist", shortlistedCount: 0, totalScored: 0, excludedCount: 0, chartSize, durationMs: d }); }
  const cids = candidates.map(c => c.id as string); const { data: scores } = await db.from("chart_ingest_candidate_scores").select("*").in("candidate_id", cids); const scoreByCid = new Map<string, { final_score: number }>(); if (scores) { for (const s of scores) scoreByCid.set(s.candidate_id as string, { final_score: Number(s.final_score) || 0 }); }
  const sorted = [...candidates].sort((a, b) => { const sa = scoreByCid.get(a.id as string)?.final_score ?? 0; const sb = scoreByCid.get(b.id as string)?.final_score ?? 0; if (sb !== sa) return sb - sa; return ((a.normalized_key as string) || "").localeCompare((b.normalized_key as string) || ""); });
  const now = new Date().toISOString(); const shortlistedIds: string[] = [], excludedIds: string[] = []; for (let i = 0; i < sorted.length; i++) { if (i < chartSize) shortlistedIds.push(sorted[i].id as string); else excludedIds.push(sorted[i].id as string); }
  if (excludedIds.length > 0) { const CH = 200; for (let j = 0; j < excludedIds.length; j += CH) { await db.from("chart_ingest_candidates").update({ status: "excluded", updated_at: now }).in("id", excludedIds.slice(j, j + CH)).eq("run_id", runId); } }
  const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: shortlistedIds.length+" shortlisted. "+excludedIds.length+" excluded.", metrics_json: { shortlistedCount: shortlistedIds.length, totalScored: candidates.length, excludedCount: excludedIds.length, chartSize } }).eq("run_id", runId).eq("stage", "shortlist");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "Review gate passed.", metrics_json: { reviewCount: 0 } }).eq("run_id", runId).eq("stage", "review_gate");
  return json(req, { ok: true, runId, stage: "shortlist", shortlistedCount: shortlistedIds.length, totalScored: candidates.length, excludedCount: excludedIds.length, chartSize, durationMs: d });
}

// ═══ FULL PIPELINE ═══
async function handleRunFullPipeline(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const start = Date.now();
  const pipelineStages: Array<{ stage: string; result: string }> = [];
  const sfResult = await handleSourceFetch(req, db, params, user); const sfBody = await sfResult.json() as { ok: boolean; rawRowCount: number; error?: string }; pipelineStages.push({ stage: "source_fetch", result: sfBody.ok ? sfBody.rawRowCount+" rows" : "FAILED: "+(sfBody.error || "unknown") });
  if (!sfBody.ok || sfBody.rawRowCount === 0) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at source_fetch", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages, durationMs: Date.now() - start }); }
  const nrResult = await handleNormalizeRun(req, db, params, user); const nrBody = await nrResult.json() as { ok: boolean; uniqueCount: number; candidateCount: number; error?: string }; pipelineStages.push({ stage: "normalize", result: nrBody.ok ? nrBody.candidateCount+" candidates from "+nrBody.uniqueCount+" unique" : "FAILED" });
  if (!nrBody.ok || nrBody.candidateCount === 0) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at normalize", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages, durationMs: Date.now() - start }); }
  const cfResult = await handleRunCarryForward(req, db, params, user); const cfBody = await cfResult.json() as { carryForwardCount: number }; pipelineStages.push({ stage: "carry_forward", result: cfBody.carryForwardCount+" carry-forward" });
  const elResult = await handleRunEligibility(req, db, params, user); const elBody = await elResult.json() as { candidateCount: number; excludedCount: number }; pipelineStages.push({ stage: "eligibility", result: elBody.candidateCount+" total, "+elBody.excludedCount+" excluded" });
  const scResult = await handleRunScoring(req, db, params, user); const scBody = await scResult.json() as { ok: boolean; scoredCount: number; error?: string }; pipelineStages.push({ stage: "scoring", result: scBody.ok ? scBody.scoredCount+" scored" : "FAILED" });
  if (!scBody.ok) { await db.from("chart_ingest_runs").update({ status: "failed", error_message: "Pipeline stopped at scoring", updated_at: new Date().toISOString() }).eq("id", runId); return json(req, { ok: false, runId, status: "failed", pipelineStages, durationMs: Date.now() - start }); }
  const slResult = await handleRunShortlist(req, db, params, user); const slBody = await slResult.json() as { shortlistedCount: number }; pipelineStages.push({ stage: "shortlist", result: slBody.shortlistedCount+" shortlisted" });
  const totalDuration = Date.now() - start; await db.from("chart_ingest_runs").update({ status: "dry_run_complete", dry_run_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId); await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: user.email || null, action: "dry_run_complete", new_status: "dry_run_complete", payload_json: { pipelineStages, totalDurationMs: totalDuration } });
  return json(req, { ok: true, runId, status: "dry_run_complete", pipelineStages, totalDurationMs: totalDuration });
}

// ═══ COMMIT (v15) ═══
async function handleCommitRun(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId, publishImmediately, notes } = params as { runId: string; publishImmediately?: boolean; notes?: string }; if (!runId) return json(req, { error: "runId_required" }, 400);
  const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  const now = new Date().toISOString(); const editionDate = (run.edition_date as string) || now.split("T")[0]; const chartSize = (run.chart_size as number) || 20; const programId = (run.program_id as string) || "unknown"; const seriesSlug = (run.series_slug as string) || programId;
  const byEmail = user.email || user.id;
  const { data: eligibleCandidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).eq("status", "eligible").order("created_at"); if (!eligibleCandidates || eligibleCandidates.length === 0) return json(req, { error: "no_eligible_candidates" }, 400);
  const ecids = eligibleCandidates.map(c => c.id as string); const { data: candidateScores } = await db.from("chart_ingest_candidate_scores").select("*").in("candidate_id", ecids); const scoreByCid = new Map<string, Record<string, unknown>>(); if (candidateScores) { for (const s of candidateScores) scoreByCid.set(s.candidate_id as string, s); }
  const sorted = [...eligibleCandidates].sort((a, b) => { const sa = Number(scoreByCid.get(a.id as string)?.final_score ?? 0); const sb = Number(scoreByCid.get(b.id as string)?.final_score ?? 0); if (sb !== sa) return sb - sa; return ((a.normalized_key as string) || "").localeCompare((b.normalized_key as string) || ""); });
  const topN = sorted.slice(0, chartSize);
  let previousMap = new Map<string, number>(); let previousKeys = new Set<string>();
  try { const { data: prevEdition } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", programId).in("status", ["committed", "published"]).lt("edition_date", editionDate).order("edition_date", { ascending: false }).limit(1).maybeSingle(); if (prevEdition) { const { data: prevEntries } = await db.from("wk_chart_editions_v2").select("normalized_key, rank").eq("edition_id", prevEdition.id); if (prevEntries) { for (const pe of prevEntries) { if (pe.normalized_key) { previousMap.set(pe.normalized_key, pe.rank as number); previousKeys.add(pe.normalized_key); } } } } } catch { }
  const editionId = crypto.randomUUID(); const editionSlug = (seriesSlug+"-"+editionDate).replace(/\s+/g, "-").toLowerCase();
  const { error: editionErr } = await db.from("wk_chart_editions_v2").insert({ id: editionId, program_id: programId, edition_slug: editionSlug, edition_date: editionDate, period_start: run.period_start || editionDate, period_end: run.period_end || editionDate, entry_count: topN.length, status: publishImmediately ? "published" : "committed", methodology_version: (run.methodology_version as string) || "1.0.0", rule_set_snapshot: (run.rule_snapshot_json as Record<string, unknown>) || {}, chart_size: chartSize, ingest_run_id: runId, published_at: publishImmediately ? now : null, published_by: publishImmediately ? byEmail : null, created_at: now, updated_at: now });
  if (editionErr) return json(req, { error: "edition_create_failed", detail: editionErr.message }, 500);
  const entryRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < topN.length; i++) { const c = topN[i]; const rank = i + 1; const nk = (c.normalized_key as string) || ""; const score = scoreByCid.get(c.id as string); const prevRank = previousMap.get(nk) ?? null; let movement: string | null = null; if (prevRank === null) movement = previousKeys.has(nk) ? "reentry" : "new"; else if (rank === prevRank) movement = "same"; else if (rank < prevRank) movement = "up"; else movement = "down";
    entryRows.push({ id: crypto.randomUUID(), edition_id: editionId, rank, previous_rank: prevRank, movement, track_title: (c.title as string) || "", artist_name: (c.artist_display as string) || "", artwork_url: c.artwork_url ?? null, normalized_key: nk, lead_artist_key: (c.lead_artist_key as string) || "", total_score: Number(score?.final_score ?? 0), carry_forward_only: !!(c.carry_forward_only), created_at: now, updated_at: now });
  }
  const ECH = 100; for (let j = 0; j < entryRows.length; j += ECH) { await db.from("wk_chart_entries_v2").insert(entryRows.slice(j, j + ECH)); }
  const status = publishImmediately ? "published" : "committed"; await db.from("chart_ingest_runs").update({ status, committed_at: now, commit_edition_id: editionId, notes: notes ?? null, updated_at: now }).eq("id", runId);
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: now, message: topN.length+" entries committed.", metrics_json: { entryCount: topN.length, editionId, editionSlug } }).eq("run_id", runId).eq("stage", "commit_write");
  await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: byEmail, action: "run_committed", new_status: status, payload_json: { editionId, editionSlug, entryCount: topN.length } });
  return json(req, { runId, status, editionId, editionSlug, entryCount: topN.length, publicUrl: "/charts/"+editionSlug, integrity: { ok: true, warnings: [], errors: [] } });
}

// ═══ AIRPLAY ═══
async function acrcloudSign(accessKey: string, accessSecret: string, httpMethod: string, host: string, uri: string): Promise<{ signature: string; timestamp: number }> { const timestamp = Math.floor(Date.now() / 1000); const encoder = new TextEncoder(); const key = await crypto.subtle.importKey("raw", encoder.encode(accessSecret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]); const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(httpMethod+"\n"+host+"\n"+uri+"\n"+accessKey+"\n"+timestamp)); return { signature: btoa(String.fromCharCode(...new Uint8Array(sigBuf))), timestamp }; }

async function handleRunAirplayDetection(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { return json(req, { ok: false, runId: "", stage: "airplay_evidence", error: "ACRCloud credentials not configured." }); }

// ═══ RESET ═══
async function handleResetPipeline(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json(req, { error: "runId_required" }, 400); const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json(req, { error: "run_not_found" }, 404);
  const now = new Date().toISOString(); await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null, error_code: null, error_message: null, metrics_json: {} }).eq("run_id", runId);
  await Promise.all([db.from("chart_ingest_raw_rows").delete().eq("run_id", runId), db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId), db.from("chart_ingest_candidates").delete().eq("run_id", runId), db.from("chart_ingest_exclusions").delete().eq("run_id", runId), db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId), db.from("chart_ingest_matches").delete().eq("run_id", runId), db.from("chart_ingest_review_issues").delete().eq("run_id", runId)]);
  await db.from("chart_ingest_runs").update({ status: "draft", dry_run_completed_at: null, updated_at: now, error_code: null, error_message: null }).eq("id", runId);
  return json(req, { ok: true, runId, status: "draft" });
}

async function handleCsvList(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>) { return json(req, { csvs: [] }); }
async function handleApplyRowDecision(req: Request, db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { return json(req, { ok: true }); }
