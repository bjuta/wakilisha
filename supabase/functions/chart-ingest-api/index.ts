// chart-ingest-api v5 — ACRCloud airplay wired into scoring
// v5: handleRunScoring reads airplay_evidence_weekly, builds context map, passes real W/S/D to scoring.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALL_STAGES = [
  "validate","provider_detection","resource_guard","source_fetch","raw_persist",
  "normalize","dedupe","release_candidate_build","canonical_match","entity_resolution",
  "eligibility_execution","airplay_evidence","airplay_rescue","carry_forward",
  "methodology_scoring","anti_gaming","shortlist","review_gate",
  "commit_validate","commit_write","public_verify",
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function detectProvider(url: string): string {
  if (!url) return "manual";
  const u = url.toLowerCase();
  if (u.includes("spotify.com")) return "spotify";
  if (u.includes("apple.com") || u.includes("itunes.apple")) return "apple_music";
  if (u.endsWith(".csv") || u.includes("csv")) return "csv_legacy";
  return "manual";
}

// ═══════ Normalization (Bible §3) ═══════
function collapseWhitespace(text: string): string {
  return text.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ").replace(/\s+/g, " ").trim();
}
function stripBracketedContent(text: string): string {
  let result = text;
  result = result.replace(/\([^)]*\)/g, " ");
  result = result.replace(/\[[^\]]*\]/g, " ");
  result = result.replace(/\{[^}]*\}/g, " ");
  result = result.replace(/「[^」]*」/g, " ");
  result = result.replace(/〈[^〉]*〉/g, " ");
  return result;
}
const FEAT_PATTERNS: RegExp[] = [
  /\b(?:feat|featuring|ft)\s*\.?\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+(?:\s+(?:(?!\b(?:remix|edit|mix|version|radio|acoustic|instrumental|live|extended|original)\b)[^\s,;:&]+))*)/gi,
];
function stripFeaturing(text: string): string {
  let result = text;
  for (const pattern of FEAT_PATTERNS) result = result.replace(pattern, " ");
  result = result.replace(/\s+x\s+/gi, " ");
  result = result.replace(/\s+&\s+/g, " ");
  result = result.replace(/\bwith\s+(?!(?:the|a\s))(?:[A-Z][^\s,;]+(?:\s+[^\s,;]+)*)/g, " ");
  return result;
}
function normalizeCore(text: string): string {
  if (!text || !text.trim()) return "";
  let result = text;
  result = result.normalize("NFKD");
  result = result.toLowerCase();
  result = stripBracketedContent(result);
  result = stripFeaturing(result);
  result = result.replace(/[\u2010-\u2015\u2018\u2019\u201A\u201B\u2032\u2035\u2212\u2E3A\u2E3B]/g, " ");
  result = result.replace(/[-–—‒―•·‧]/g, " ");
  result = result.replace(/[\/\\|]/g, " ");
  result = result.replace(/[!"#$%&'()*+,./:;<=>?@\[\]^_`{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷]/g, " ");
  result = collapseWhitespace(result);
  return result;
}
function normalize_title(title: string): string { return normalizeCore(title); }
function normalize_artist(artist_line: string): string { return normalizeCore(artist_line); }
function lead_artist_key(full_artist_line: string): string {
  if (!full_artist_line || !full_artist_line.trim()) return "";
  let extracted = full_artist_line;
  const featSplit = extracted.split(/\s+(?:feat\.|ft\.|featuring)\s+/i);
  if (featSplit.length > 1) extracted = featSplit[0];
  const collabSplit = extracted.split(/\s+(?:x|&)\s+/i);
  if (collabSplit.length > 1) extracted = collabSplit[0];
  const commaSplit = extracted.split(/\s*,\s*/);
  extracted = commaSplit[0];
  return normalizeCore(extracted);
}
function build_normalized_key(title: string, full_artist_line: string): string {
  const nt = normalize_title(title);
  const lk = lead_artist_key(full_artist_line);
  if (!nt || !lk) return "";
  return `${nt}::${lk}`;
}

// ═══════ Scoring Engine (Bible §4–§7) ═══════
const LN = Math.log;
function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
function round4(v: number): number { if (!Number.isFinite(v)) return 0; return Math.round(v * 10000) / 10000; }
function daysBetween(a: string, b: string): number | null {
  const da = new Date(a), db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000));
}
function sourceScore(sc: number): number { return round4(Math.min(72, sc * 24)); }
const CROSS_SOURCE_PER_EXTRA: Record<string, number> = { off: 0, standard: 6, strong: 10 };
const CROSS_SOURCE_CAP: Record<string, number> = { off: 0, standard: 18, strong: 30 };
function crossSourceBonus(sc: number, mode = "standard", w = 1.0): number {
  if (sc <= 1) return 0;
  return round4(Math.min(CROSS_SOURCE_CAP[mode] ?? 18, (sc - 1) * (CROSS_SOURCE_PER_EXTRA[mode] ?? 6)) * w);
}
function overlapBonus(oc: number, sc: number, cap = 10): number {
  const ex = oc - sc; if (ex <= 0) return 0; return round4(Math.min(cap, ex * 2));
}
function recencyScore(rd: string | null, ed: string): number {
  if (!rd) return 0; const age = daysBetween(rd, ed); if (age === null) return 0;
  if (age <= 30) return 18; if (age <= 90) return 12; if (age <= 180) return 8; if (age <= 365) return 4; return 0;
}
function continuityScore(pp: number | null, w = 1.0): number {
  if (pp === null || pp <= 0) return 0; return round4(Math.max(4, 18 - Math.min(14, pp - 1)) * w);
}
function carryForwardBonus(pp: number | null, w = 1.0, cfOnly = false): number {
  if (!cfOnly || pp === null || pp <= 0) return 0; return round4(Math.max(8, 18 - Math.min(10, pp - 1)) * w);
}
function airplayScore(W: number, sCount: number, dCount: number, enabled = false, maxS = 24, minS = 1, minD = 1, w = 1.0): number {
  if (!enabled || sCount < minS || dCount < minD) return 0;
  return round4(clamp((LN(1 + W) * 4.25 + Math.min(6, (sCount - 1) * 1.5) + Math.min(4, Math.floor(dCount / 3))) * w, 0, maxS));
}

interface AntiGamingInput { normalized_key: string; lead_artist_key: string; provisional_total: number; }
interface AntiGamingResult { normalized_key: string; anti_gaming_penalty: number; lead_artist_overflow: boolean; overflow_index: number; }

function computeAntiGamingPenalties(tracks: AntiGamingInput[], maxPer = 3, overflowPen = 8): AntiGamingResult[] {
  if (tracks.length === 0) return [];
  const groups = new Map<string, AntiGamingInput[]>();
  for (const t of tracks) { const k = t.lead_artist_key || "__unknown__"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); }
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

// v5: airplayCtx param added — when provided, real airplay evidence (W/S/D) flows into scoring.
function computeCandidateProvisionalScore(
  c: { normalized_key: string; lead_artist_key: string; source_count: number; occurrence_count: number; release_date: string | null; carry_forward_only: boolean; continuity_locked: boolean; airplay_candidate_only: boolean; },
  ed: string, pp: number | null,
  cfg: { cross_source_mode?: string; cross_source_weight?: number; continuity_weight?: number; carry_forward_weight?: number; overlap_bonus_cap?: number; airplay_enabled?: boolean; airplay_max_score?: number; airplay_min_stations?: number; airplay_min_detections?: number; airplay_weight?: number; } = {},
  airplayCtx?: { W: number; station_count: number; detection_count: number; } | null,
): { source_score: number; cross_source_bonus: number; overlap_bonus: number; recency_score: number; continuity_score: number; carry_forward_bonus: number; airplay_score: number; provisional_total: number; recency_days: number | null; } {
  const ss = sourceScore(c.source_count);
  const cs = crossSourceBonus(c.source_count, cfg.cross_source_mode ?? "standard", cfg.cross_source_weight ?? 1.0);
  const ob = overlapBonus(c.occurrence_count, c.source_count, cfg.overlap_bonus_cap ?? 10);
  const rs = recencyScore(c.release_date, ed);
  const cont = continuityScore(pp, cfg.continuity_weight ?? 1.0);
  const cf = carryForwardBonus(pp, cfg.carry_forward_weight ?? 1.0, c.carry_forward_only);
  const ap = airplayScore(
    airplayCtx?.W ?? 0,
    airplayCtx?.station_count ?? 0,
    airplayCtx?.detection_count ?? 0,
    cfg.airplay_enabled ?? false,
    cfg.airplay_max_score ?? 24,
    cfg.airplay_min_stations ?? 1,
    cfg.airplay_min_detections ?? 1,
    cfg.airplay_weight ?? 1.0,
  );
  const rd = c.release_date ? daysBetween(c.release_date, ed) : null;
  return { source_score: ss, cross_source_bonus: cs, overlap_bonus: ob, recency_score: rs, continuity_score: cont, carry_forward_bonus: cf, airplay_score: ap, provisional_total: round4(ss + cs + ob + rs + cont + cf + ap), recency_days: rd };
}

// ═══════ Provider Fetch v3 (Deno.env → admin_settings_secrets) ═══════
interface ProviderTrack { title: string; artist: string; release_date: string | null; isrc: string | null; source_position: number; provider_track_id: string | null; provider_release_id: string | null; provider_artist_ids: string[]; artwork_url: string | null; external_url: string | null; preview_url: string | null; raw_payload: unknown; }
interface ProviderFetchResult { tracks: ProviderTrack[]; warnings: string[]; error: string | null; }

async function readCredential(db: ReturnType<typeof createClient> | null, envVar: string, dbKey: string): Promise<string | null> {
  const ev = Deno.env.get(envVar);
  if (ev && ev.trim()) return ev.trim();
  if (!db) return null;
  try {
    const { data: row } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", dbKey).maybeSingle();
    if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim();
  } catch { /* DB read failed */ }
  return null;
}

async function fetchSpotifySource(sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  const clientId = await readCredential(db, "SPOTIFY_CLIENT_ID", "spotify_client_id");
  const clientSecret = await readCredential(db, "SPOTIFY_CLIENT_SECRET", "spotify_client_secret");
  const spotifyMarket = (await readCredential(db, "SPOTIFY_MARKET", "spotify_market")) || market;
  if (!clientId || !clientSecret) {
    return { tracks: [], warnings: [], error: "Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in edge function secrets, or save them via Settings → Integrations." };
  }
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` }, body: "grant_type=client_credentials" });
  if (!tokenRes.ok) { const eb = await tokenRes.text(); return { tracks: [], warnings: [], error: `Spotify auth failed (${tokenRes.status}): ${eb.slice(0, 200)}` }; }
  const tokenData = await tokenRes.json() as { access_token: string };
  const pm = sourceUrl.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (!pm) return { tracks: [], warnings: [], error: `Cannot extract Spotify playlist ID from: ${sourceUrl}` };
  const pid = pm[1];
  const apiUrl = new URL(`https://api.spotify.com/v1/playlists/${pid}`);
  apiUrl.searchParams.set("market", spotifyMarket);
  apiUrl.searchParams.set("fields", "tracks.items(track(id,name,artists(id,name),album(id,name,images,release_date),external_ids(isrc),external_urls(spotify),preview_url,duration_ms,popularity)),tracks.total");
  const pres = await fetch(apiUrl.toString(), { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  if (!pres.ok) { const eb = await pres.text(); return { tracks: [], warnings: [], error: `Spotify API ${pres.status}: ${eb.slice(0, 300)}` }; }
  const playlist = await pres.json() as { tracks: { items: Array<{ track: { id: string; name: string; artists: Array<{ id: string; name: string }>; album: { id: string; name: string; images: Array<{ url: string }>; release_date: string }; external_ids: { isrc?: string }; external_urls: { spotify: string }; preview_url: string | null; duration_ms: number; popularity: number } | null }>; total: number }; };
  const items = playlist.tracks.items.slice(0, maxRows); const warnings: string[] = []; const tracks: ProviderTrack[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]; if (!item || !item.track) { warnings.push(`Spotify item ${i + 1}: null track`); continue; }
    const t = item.track;
    tracks.push({ title: t.name, artist: t.artists.map(a => a.name).join(", "), release_date: t.album?.release_date || null, isrc: t.external_ids?.isrc || null, source_position: i + 1, provider_track_id: t.id, provider_release_id: t.album?.id || null, provider_artist_ids: t.artists.map(a => a.id), artwork_url: t.album?.images?.[0]?.url || null, external_url: t.external_urls?.spotify || sourceUrl, preview_url: t.preview_url || null, raw_payload: { provider: "spotify", trackId: t.id, albumId: t.album?.id, artistIds: t.artists.map(a => a.id), durationMs: t.duration_ms, popularity: t.popularity } });
  }
  if (tracks.length === 0 && warnings.length === 0) warnings.push(`Spotify playlist returned 0 tracks (total: ${playlist.tracks.total})`);
  return { tracks, warnings, error: null };
}

async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
  const pem = pk.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const bin = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = { alg: "ES256", kid };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: tid, iat: now, exp: now + 3600 };
  const enc = new TextEncoder();
  const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const hb = b64u(btoa(JSON.stringify(header))), pb = b64u(btoa(JSON.stringify(payload))), si = `${hb}.${pb}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si));
  const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return `${si}.${sb}`;
}

async function fetchAppleMusicSource(sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  const privateKey = await readCredential(db, "APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key");
  const teamId = await readCredential(db, "APPLE_TEAM_ID", "apple_music_team_id");
  const musicKeyId = await readCredential(db, "APPLE_MUSIC_KEY_ID", "apple_music_key_id");
  const storefront = (await readCredential(db, "APPLE_MUSIC_STOREFRONT", "apple_music_storefront")) || market.slice(0, 2).toLowerCase();
  if (!privateKey || !teamId || !musicKeyId) {
    const m: string[] = [];
    if (!privateKey) m.push("APPLE_MUSIC_PRIVATE_KEY");
    if (!teamId) m.push("APPLE_TEAM_ID");
    if (!musicKeyId) m.push("APPLE_MUSIC_KEY_ID");
    return { tracks: [], warnings: [], error: `Apple Music credentials missing: ${m.join(", ")}. Set in edge function secrets or Settings → Integrations.` };
  }
  let dt: string;
  try { dt = await createAppleMusicJWT(privateKey, teamId, musicKeyId); }
  catch (e) { return { tracks: [], warnings: [], error: `JWT failed: ${e instanceof Error ? e.message : String(e)}` }; }
  const parsed = sourceUrl.match(/music\.apple\.com\/([a-z]{2})\/(playlist|album)\/[^/]+\/(pl\.|[a-z]+\.)([a-zA-Z0-9]+)/i);
  let apiSf = storefront, rt = "playlists", rid = "";
  if (parsed) { apiSf = parsed[1].toLowerCase(); rt = parsed[2] === "album" ? "albums" : "playlists"; rid = parsed[3] + parsed[4]; }
  else { const im = sourceUrl.match(/(pl\.|al\.)([a-zA-Z0-9]+)/i); if (im) rid = im[1] + im[2]; else return { tracks: [], warnings: [], error: `Cannot parse Apple Music URL: ${sourceUrl}` }; }
  const apiUrl = `https://api.music.apple.com/v1/catalog/${apiSf}/${rt}/${rid}/tracks`;
  const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${dt}` } });
  if (!res.ok) { const eb = await res.text(); return { tracks: [], warnings: [], error: `Apple Music API ${res.status}: ${eb.slice(0, 300)}` }; }
  const data = await res.json() as { data: Array<{ id: string; attributes: { name: string; artistName: string; albumName: string; artwork: { url: string }; url: string; previews?: Array<{ url: string }>; releaseDate?: string; isrc?: string; genreNames: string[]; }; relationships?: { artists: { data: Array<{ id: string }> }; albums: { data: Array<{ id: string }> }; }; }>; };
  const songs = (data.data || []).slice(0, maxRows); const warnings: string[] = []; const tracks: ProviderTrack[] = [];
  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]; const attrs = song.attributes;
    if (!attrs) { warnings.push(`Apple Music song ${i + 1}: missing attributes`); continue; }
    const aw = attrs.artwork?.url ? attrs.artwork.url.replace("{w}", "300").replace("{h}", "300") : null;
    tracks.push({ title: attrs.name, artist: attrs.artistName, release_date: attrs.releaseDate || null, isrc: attrs.isrc || null, source_position: i + 1, provider_track_id: song.id, provider_release_id: song.relationships?.albums?.data?.[0]?.id || null, provider_artist_ids: song.relationships?.artists?.data?.map(a => a.id) || [], artwork_url: aw, external_url: attrs.url || sourceUrl, preview_url: attrs.previews?.[0]?.url || null, raw_payload: { provider: "apple_music", songId: song.id, albumId: song.relationships?.albums?.data?.[0]?.id, artistIds: song.relationships?.artists?.data?.map(a => a.id) || [], genres: attrs.genreNames, isrc: attrs.isrc } });
  }
  if (tracks.length === 0 && warnings.length === 0) warnings.push(`Apple Music ${rt} returned 0 tracks`);
  return { tracks, warnings, error: null };
}

async function fetchProviderSource(provider: string, sourceUrl: string, market: string, maxRows: number, db: ReturnType<typeof createClient>): Promise<ProviderFetchResult> {
  switch (provider) {
    case "spotify": return fetchSpotifySource(sourceUrl, market, maxRows, db);
    case "apple_music": return fetchAppleMusicSource(sourceUrl, market, maxRows, db);
    case "csv_legacy": return { tracks: [], warnings: ["CSV source requires CSV upload, not provider fetch."], error: "CSV source type does not support API fetch." };
    case "manual": return { tracks: [], warnings: ["Manual source has no API."], error: "Manual sources need hand-entered data." };
    default: return { tracks: [], warnings: [`Unknown provider: ${provider}`], error: `Unknown provider '${provider}'. Supported: spotify, apple_music.` };
  }
}

// ═══════ ACRCloud HMAC-SHA1 signing ═══════
async function acrcloudSign(accessKey: string, accessSecret: string, method: string, host: string, uri: string): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureVersion = "1";
  const stringToSign = `${method}\n${host}\n${uri}\n${accessKey}\n${signatureVersion}\n${timestamp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(accessSecret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return { signature, timestamp };
}

function anchorToMonday(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

// ═══════ Deno.serve — main entry ═══════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const ah = req.headers.get("Authorization");
  if (!ah || !ah.startsWith("Bearer ")) return json({ error: "unauthorized", detail: "Missing Authorization" }, 401);
  const token = ah.replace("Bearer ", "");
  const uc = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: ae } = await uc.auth.getUser(token);
  if (ae || !user) return json({ error: "unauthorized", detail: ae?.message ?? "Invalid token" }, 401);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const { action, ...params } = body as { action: string; [k: string]: unknown };
  try {
    if (action === "create_dry_run") return handleCreateDryRun(db, params, user);
    if (action === "list_runs") return handleListRuns(db, params);
    if (action === "get_run") return handleGetRun(db, params);
    if (action === "get_stages") return handleGetStages(db, params);
    if (action === "get_sources") return handleGetSources(db, params);
    if (action === "get_candidates") return handleGetCandidates(db, params);
    if (action === "get_normalized") return handleGetNormalized(db, params);
    if (action === "normalize_run") return handleNormalizeRun(db, params, user);
    if (action === "source_fetch") return handleSourceFetch(db, params, user);
    if (action === "run_eligibility") return handleRunEligibility(db, params, user);
    if (action === "run_scoring") return handleRunScoring(db, params, user);
    if (action === "run_shortlist") return handleRunShortlist(db, params, user);
    if (action === "run_airplay_detection") return handleRunAirplayDetection(db, params, user);
    if (action === "cancel_run") return handleCancelRun(db, params, user);
    if (action === "retry_run") return handleRetryRun(db, params, user);
    if (action === "reset_pipeline") return handleResetPipeline(db, params, user);
    if (action === "preflight") return handlePreflight(db, params);
    if (action === "get_kpis") return handleGetKpis(db);
    if (action === "get_activity") return handleGetActivity(db);
    if (action === "get_resource_guard") return handleGetResourceGuard(db, params);
    if (action === "send_gaps_to_review") return handleSendGapsToReview(db, params, user);
    if (action === "apply_row_decision") return handleApplyRowDecision(db, params, user);
    if (action === "get_review_issues") return handleGetReviewIssues(db, params);
    if (action === "get_matches_for_run") return handleGetMatchesForRun(db, params);
    if (action === "validate_commit") return handleValidateCommit(db, params);
    if (action === "commit_run") return handleCommitRun(db, params, user);
    return json({ error: `unknown_action: ${action}` }, 400);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[chart-ingest-api] ${action} error:`, m);
    return json({ error: "internal_error", detail: m }, 500);
  }
});

// ═══════ Handlers ═══════
async function handleCreateDryRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const req = params.request as Record<string, unknown>; if (!req) return json({ error: "request_required" }, 400);
  const runId = crypto.randomUUID(); const ed = req.editionDate as string; const sUrls = (req.sourceUrls as string[]) || [];
  const { error: rErr } = await db.from("chart_ingest_runs").insert({ id: runId, program_id: (req.existingSeriesId as string) || "unknown", series_slug: (req.existingSeriesId as string) || null, market_slug: (req.market as string) || "KE", chart_kind: (req.chartKind as string) || "tracks", edition_date: ed, period_start: ed, period_end: ed, chart_size: (req.chartSize as number) || 20, status: "queued", rule_snapshot_json: { chartTitle: req.chartTitle, chartSlug: req.chartSlug, coverStyle: req.coverStyle || "default", saveAsRecurringSeries: req.saveAsRecurringSeries || false, methodologyVersion: req.methodologyVersion || "1.0.0" }, market_scope_snapshot_json: (req.marketScopeSnapshot as object) || {}, eligibility_profile_id: (req.eligibilityProfileId as string) || null, market_scope_id: (req.marketScopeId as string) || null, scoring_policy_version: "1.0.1", source_policy_version: "1.0.0", eligibility_policy_version: "1.0.0", methodology_version: (req.methodologyVersion as string) || "1.0.0", created_by: user.id, created_by_email: user.email || null });
  if (rErr) return json({ error: "run_create_failed", detail: rErr.message }, 500);
  if (sUrls.length > 0) { const srs = sUrls.map((url, i) => ({ run_id: runId, provider: detectProvider(url), source_type: url.endsWith(".csv") ? "csv" : "playlist", source_url: url, storefront_or_market: (req.market as string) || "KE", enabled: true, priority: i, fetch_status: "pending" })); await db.from("chart_ingest_run_sources").insert(srs); }
  const sgs = ALL_STAGES.map(s => ({ run_id: runId, stage: s, status: "idle", metrics_json: {} })); await db.from("chart_ingest_stage_events").insert(sgs);
  await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: user.email || null, action: "run_created", new_status: "queued", payload_json: { sourceCount: sUrls.length } });
  return json({ runId, status: "queued" });
}

async function handleListRuns(db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const limit = Math.min((params.limit as number) || 100, 200);
  const { data: runs, error } = await db.from("chart_ingest_runs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) return json({ error: error.message }, 500);
  const rl = runs || [];
  if (rl.length > 0) {
    const rids = rl.map((r: { id: string }) => r.id);
    const [sr, sg] = await Promise.all([db.from("chart_ingest_run_sources").select("*").in("run_id", rids).order("priority"), db.from("chart_ingest_stage_events").select("*").in("run_id", rids).order("created_at")]);
    const sbm = new Map<string, unknown[]>(); for (const s of (sr.data || [])) { const rid = s.run_id as string; if (!sbm.has(rid)) sbm.set(rid, []); sbm.get(rid)!.push(s); }
    const stm = new Map<string, unknown[]>(); for (const s of (sg.data || [])) { const rid = s.run_id as string; if (!stm.has(rid)) stm.set(rid, []); stm.get(rid)!.push(s); }
    return json({ runs: rl.map((r: { id: string }) => ({ ...r, chart_ingest_run_sources: sbm.get(r.id) || [], chart_ingest_stage_events: stm.get(r.id) || [] })) });
  }
  return json({ runs: [] });
}

async function handleGetRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const { data: run, error } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle();
  if (error) return json({ error: error.message }, 500); if (!run) return json({ error: "run_not_found" }, 404);
  const [sr, sg] = await Promise.all([db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).order("priority"), db.from("chart_ingest_stage_events").select("*").eq("run_id", runId).order("created_at")]);
  const [t1, t2, t3, t4] = await Promise.all([db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "eligible"), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "needs_review"), db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId).eq("status", "excluded")]);
  return json({ run: { ...run, chart_ingest_run_sources: sr.data || [], chart_ingest_stage_events: sg.data || [], candidateCounts: { total: t1.count || 0, eligible: t2.count || 0, needsReview: t3.count || 0, excluded: t4.count || 0 } } });
}

async function handleGetStages(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data, error } = await db.from("chart_ingest_stage_events").select("*").eq("run_id", runId).order("created_at"); if (error) return json({ error: error.message }, 500); return json({ stages: data || [] }); }
async function handleGetSources(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data, error } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).order("priority"); if (error) return json({ error: error.message }, 500); return json({ sources: data || [] }); }
async function handleGetCandidates(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, status, limit = 200 } = params as { runId: string; status?: string; limit?: number }; let q = db.from("chart_ingest_candidates").select("*").eq("run_id", runId).limit(Math.min(limit, 500)); if (status) q = q.eq("status", status); const { data, error } = await q; if (error) return json({ error: error.message }, 500); const cs = data || []; if (cs.length > 0) { const cids = cs.map((c: { id: string }) => c.id); const [sc, mc] = await Promise.all([db.from("chart_ingest_candidate_scores").select("*").in("candidate_id", cids), db.from("chart_ingest_matches").select("*").in("candidate_id", cids)]); const sbc = new Map<string, unknown[]>(); for (const s of (sc.data || [])) { const cid = s.candidate_id as string; if (!sbc.has(cid)) sbc.set(cid, []); sbc.get(cid)!.push(s); } const mbc = new Map<string, unknown[]>(); for (const m of (mc.data || [])) { const cid = m.candidate_id as string; if (!mbc.has(cid)) mbc.set(cid, []); mbc.get(cid)!.push(m); } return json({ candidates: cs.map((c: { id: string }) => ({ ...c, chart_ingest_candidate_scores: sbc.get(c.id) || [], chart_ingest_matches: mbc.get(c.id) || [] })) }); } return json({ candidates: [] }); }
async function handleGetReviewIssues(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, candidateId, status } = params as { runId?: string; candidateId?: string; status?: string }; let q = db.from("chart_ingest_review_issues").select("*").order("created_at", { ascending: false }); if (runId) q = q.eq("run_id", runId); if (candidateId) q = q.eq("candidate_id", candidateId); if (status) q = q.eq("status", status); const { data, error } = await q; if (error) return json({ error: error.message }, 500); return json({ review_issues: data || [] }); }
async function handleGetMatchesForRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId, candidateId } = params as { runId?: string; candidateId?: string }; let q = db.from("chart_ingest_matches").select("*").order("created_at", { ascending: false }); if (runId) q = q.eq("run_id", runId); if (candidateId) q = q.eq("candidate_id", candidateId); const { data, error } = await q; if (error) return json({ error: error.message }, 500); return json({ matches: data || [] }); }
async function handleGetNormalized(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400); const { data, error } = await db.from("chart_ingest_normalized_rows").select("*").eq("run_id", runId).order("created_at"); if (error) return json({ error: error.message }, 500); return json({ normalized_rows: data || [] }); }
async function handleGetKpis(db: ReturnType<typeof createClient>) { const wa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); const { count: etw } = await db.from("chart_ingest_runs").select("*", { count: "exact", head: true }).in("status", ["committed", "published"]).gte("committed_at", wa); const { count: rar } = await db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("status", "needs_review"); return json({ editionsThisWeek: etw || 0, canonicalMatchRate: 0, rowsAwaitingReview: rar || 0, averageRunTimeMs: 0 }); }
async function handleGetActivity(db: ReturnType<typeof createClient>) { const { data: events } = await db.from("chart_ingest_audit_events").select("*").in("action", ["run_created", "run_committed", "edition_published", "run_cancelled"]).order("created_at", { ascending: false }).limit(20); const activity = (events || []).map((e: Record<string, unknown>) => ({ id: e.id, type: e.action === "run_committed" ? "commit" : e.action === "run_cancelled" ? "cancel" : "dry_run", chartTitle: `Run ${(e.run_id as string).slice(0, 8)}`, runId: e.run_id, status: (e.new_status as string) || "unknown", actor: (e.actor_email as string) || (e.actor as string) || "Unknown", createdAt: e.created_at })); return json({ activity }); }
async function handleGetResourceGuard(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data: sources } = await db.from("chart_ingest_run_sources").select("provider").eq("run_id", runId).eq("enabled", true); const sc = sources?.length || 0; const { count: ar } = await db.from("chart_ingest_runs").select("*", { count: "exact", head: true }).eq("status", "running"); return json({ sourceCount: sc, providerBudgetRemaining: Math.max(0, 100 - sc * 10), workerConcurrency: 4, estimatedRowCount: sc * 100, duplicateRunWarning: (ar || 0) > 0 ? "Another run is currently active." : null, sameEditionDateWarning: null }); }
async function handleSendGapsToReview(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; await db.from("chart_ingest_runs").update({ status: "needs_review", updated_at: new Date().toISOString() }).eq("id", runId).in("status", ["dry_run_complete", "ready_to_commit"]); return json({ ok: true }); }
async function handleCancelRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; const { data: run, error: le } = await db.from("chart_ingest_runs").select("status").eq("id", runId).maybeSingle(); if (le) return json({ error: le.message }, 500); if (!run) return json({ error: "run_not_found" }, 404); if (!["draft", "queued", "running", "needs_review", "dry_run_complete"].includes(run.status)) return json({ error: "cannot_cancel" }, 400); await db.from("chart_ingest_runs").update({ status: "cancelled", error_message: "Cancelled by admin", updated_at: new Date().toISOString() }).eq("id", runId); return json({ ok: true, status: "cancelled" }); }
async function handleRetryRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) { const { runId } = params as { runId: string }; const { data: run, error: le } = await db.from("chart_ingest_runs").select("status").eq("id", runId).maybeSingle(); if (le) return json({ error: le.message }, 500); if (!run) return json({ error: "run_not_found" }, 404); if (!["failed", "cancelled", "source_fetch_failed"].includes(run.status)) return json({ error: "cannot_retry" }, 400); await db.from("chart_ingest_runs").update({ status: "queued", error_code: null, error_message: null, updated_at: new Date().toISOString() }).eq("id", runId); await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null, error_code: null, error_message: null }).eq("run_id", runId); return json({ ok: true, status: "queued" }); }
async function handlePreflight(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { programId, editionDate, sources } = params as { programId: string; editionDate: string; sources?: Array<{ provider: string; sourceUrl?: string }> }; const blockers: Array<{ code: string; message: string }> = []; const warnings: Array<{ code: string; message: string }> = []; const es = (sources || []).filter(s => s.sourceUrl); if (es.length === 0) blockers.push({ code: "no_enabled_sources", message: "At least one enabled source URL required." }); if (!programId) blockers.push({ code: "unknown_program", message: "program_id required." }); if (!editionDate) blockers.push({ code: "missing_edition_date", message: "edition_date required." }); if (es.length === 1) warnings.push({ code: "single_source_only", message: "Only one source." }); return json({ ok: blockers.length === 0, blockers, warnings, estimates: { sourceCount: es.length, expectedProviderRequests: es.length, expectedRowCap: es.length * 100 } }); }
async function handleValidateCommit(db: ReturnType<typeof createClient>, params: Record<string, unknown>) { const { runId } = params as { runId: string }; const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json({ canCommit: false, errors: [{ code: "run_not_found", message: "Run not found" }], warnings: [] }); const errors: Array<{ code: string; message: string }> = []; if (!["dry_run_complete", "ready_to_commit", "needs_review"].includes(run.status)) errors.push({ code: "commit_not_ready", message: `Run status '${run.status}' not committable.` }); const { count: cc } = await db.from("chart_ingest_candidates").select("*", { count: "exact", head: true }).eq("run_id", runId); if (!cc) errors.push({ code: "no_candidates", message: "No candidates exist." }); return json({ canCommit: errors.length === 0, errors, warnings: [] }); }

async function handleNormalizeRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  await db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "normalize");
  const { data: rawRows } = await db.from("chart_ingest_raw_rows").select("*").eq("run_id", runId).order("created_at");
  if (!rawRows || rawRows.length === 0) {
    const d = Date.now() - ss;
    await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No raw rows.", metrics_json: { rawCount: 0, uniqueCount: 0, dedupedCount: 0 } }).eq("run_id", runId).eq("stage", "normalize");
    return json({ ok: true, runId, stage: "normalize", rawCount: 0, uniqueCount: 0, dedupedCount: 0 });
  }
  const sids = [...new Set(rawRows.map((r: { source_id: string }) => r.source_id))];
  const { data: sources } = await db.from("chart_ingest_run_sources").select("id,source_url").in("id", sids);
  const sum = new Map<string, string>(); for (const s of (sources || [])) sum.set(s.id, s.source_url || `source:${s.id.slice(0, 8)}`);
  interface ER { raw_row: Record<string, unknown>; normalized_title: string; normalized_artist: string; lead_key: string; normalized_key: string; source_url: string; }
  const enriched: ER[] = []; const wr: Array<{ rawRowId: string; warning: string }> = [];
  for (const raw of rawRows) { const tr = (raw.title_raw as string) || "", ar = (raw.artist_raw as string) || ""; if (!tr && !ar) { wr.push({ rawRowId: raw.id as string, warning: "Empty title+artist" }); continue; } const nt = normalize_title(tr), na = normalize_artist(ar), lk = lead_artist_key(ar), nk = build_normalized_key(tr, ar); if (!nk) { wr.push({ rawRowId: raw.id as string, warning: `Cannot build key` }); continue; } enriched.push({ raw_row: raw, normalized_title: nt, normalized_artist: na, lead_key: lk, normalized_key: nk, source_url: sum.get(raw.source_id as string) || "unknown" }); }
  const seen = new Set<string>(); const deduped: Array<{ normalized_key: string; lead_artist_key: string; normalized_title: string; normalized_artist: string; first: ER; raw_row_ids: string[]; source_urls: string[]; provider_artist_ids: unknown[]; merged_isrc: string | null; merged_provider_track_id: string | null; merged_provider_release_id: string | null; merged_release_date: string | null; merged_artwork_url: string | null; merged_external_url: string | null; merged_preview_url: string | null; }> = [];
  for (const e of enriched) { if (seen.has(e.normalized_key)) continue; seen.add(e.normalized_key); const g = enriched.filter(x => x.normalized_key === e.normalized_key); const surls = [...new Set(g.map(x => x.source_url))]; const aids: unknown[] = []; for (const x of g) { const ids = x.raw_row.provider_artist_ids; if (Array.isArray(ids)) for (const id of ids) if (!aids.includes(id)) aids.push(id); } deduped.push({ normalized_key: e.normalized_key, lead_artist_key: e.lead_key, normalized_title: e.normalized_title, normalized_artist: e.normalized_artist, first: e, raw_row_ids: g.map(x => x.raw_row.id as string), source_urls: surls, provider_artist_ids: aids, merged_isrc: (e.raw_row.isrc as string) || null, merged_provider_track_id: (e.raw_row.provider_track_id as string) || null, merged_provider_release_id: (e.raw_row.provider_release_id as string) || null, merged_release_date: (e.raw_row.release_date_raw as string) || null, merged_artwork_url: (e.raw_row.artwork_url as string) || null, merged_external_url: (e.raw_row.external_url as string) || null, merged_preview_url: (e.raw_row.preview_url as string) || null }); }
  const now = new Date().toISOString(); const inserts = deduped.map(d => ({ id: crypto.randomUUID(), run_id: runId, raw_row_id: d.first.raw_row.id, normalized_title: d.normalized_title, normalized_artist: d.normalized_artist, normalized_key: d.normalized_key, lead_artist_key: d.lead_artist_key, isrc: d.merged_isrc, provider_track_id: d.merged_provider_track_id, provider_release_id: d.merged_provider_release_id, provider_artist_ids: d.provider_artist_ids, source_urls_seen: d.source_urls, occurrence_count: d.raw_row_ids.length, release_date: d.merged_release_date, artwork_url: d.merged_artwork_url, external_url: d.merged_external_url, preview_url: d.merged_preview_url, metadata_json: { raw_row_count: d.raw_row_ids.length, raw_row_ids: d.raw_row_ids, deduped_from: enriched.length }, normalization_warnings_json: wr.filter(w => d.raw_row_ids.includes(w.rawRowId)).map(w => w.warning) }));
  const CH = 200; for (let i = 0; i < inserts.length; i += CH) { const ck = inserts.slice(i, i + CH); const { error: ie } = await db.from("chart_ingest_normalized_rows").insert(ck); if (ie) return json({ error: "normalize_insert_failed", detail: ie.message }, 500); }
  const d = Date.now() - ss, dc = enriched.length - deduped.length;
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: `${deduped.length} unique from ${rawRows.length} raw (${dc} dupes)`, metrics_json: { rawCount: rawRows.length, uniqueCount: deduped.length, dedupedCount: dc, warningCount: wr.length } }).eq("run_id", runId).eq("stage", "normalize");
  return json({ ok: true, runId, stage: "normalize", rawCount: rawRows.length, uniqueCount: deduped.length, dedupedCount: dc, warningCount: wr.length, durationMs: d });
}

async function handleSourceFetch(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,chart_size").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  await db.from("chart_ingest_raw_rows").delete().eq("run_id", runId);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "source_fetch");
  const { data: sources } = await db.from("chart_ingest_run_sources").select("*").eq("run_id", runId).eq("enabled", true).order("priority");
  if (!sources || sources.length === 0) { const d = Date.now() - ss; await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No enabled sources.", metrics_json: { sourceCount: 0, rawRowCount: 0 } }).eq("run_id", runId).eq("stage", "source_fetch"); return json({ ok: true, runId, stage: "source_fetch", sourceCount: 0, rawRowCount: 0 }); }
  const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0]; const cs = (run.chart_size as number) || 20;
  let trr = 0, tfs = 0; const aw: string[] = []; const srs: Array<{ sourceId: string; fetchedCount: number; droppedCount: number; provider: string; warnings: string[]; error: string | null }> = [];
  for (const source of sources) {
    const market = (source.storefront_or_market as string) || "KE"; const mr = cs + 30;
    const fr = await fetchProviderSource(source.provider as string, source.source_url as string, market, mr, db);
    if (fr.error) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: fr.error }); tfs++; aw.push(...fr.warnings); continue; }
    const tracks = fr.tracks; aw.push(...fr.warnings);
    if (tracks.length === 0) { srs.push({ sourceId: source.id, fetchedCount: 0, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null }); continue; }
    const now = new Date().toISOString(); const rrs = tracks.map(t => ({ id: crypto.randomUUID(), run_id: runId, source_id: source.id, provider: source.provider, provider_row_id: t.provider_track_id ? `${source.provider}:${t.provider_track_id}:${t.source_position}` : `${source.provider}:pos:${t.source_position}`, provider_track_id: t.provider_track_id, provider_release_id: t.provider_release_id, provider_artist_ids: t.provider_artist_ids, source_position: t.source_position, title_raw: t.title, artist_raw: t.artist, release_raw: null, isrc: t.isrc, upc: null, release_date_raw: t.release_date, artwork_url: t.artwork_url, external_url: t.external_url || source.source_url || null, preview_url: t.preview_url, raw_payload_json: t.raw_payload, raw_payload_hash: null }));
    const CH = 100; for (let j = 0; j < rrs.length; j += CH) { const ck = rrs.slice(j, j + CH); await db.from("chart_ingest_raw_rows").insert(ck); }
    trr += rrs.length; srs.push({ sourceId: source.id, fetchedCount: rrs.length, droppedCount: 0, provider: source.provider, warnings: fr.warnings, error: null });
  }
  const d = Date.now() - ss; const sm = trr > 0 ? `${trr} raw rows from ${sources.length - tfs}/${sources.length} source(s)` : `All sources failed. Check credentials.`;
  await db.from("chart_ingest_stage_events").update({ status: trr > 0 ? "completed" : "failed", finished_at: new Date().toISOString(), duration_ms: d, message: sm, metrics_json: { sourceCount: sources.length, rawRowCount: trr, failedSourceCount: tfs, sourceResults: srs } }).eq("run_id", runId).eq("stage", "source_fetch");
  if (trr > 0) { await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 1, message: "Raw rows persisted.", metrics_json: { rawRowCount: trr } }).eq("run_id", runId).eq("stage", "raw_persist"); await db.from("chart_ingest_runs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", runId); }
  else { await db.from("chart_ingest_runs").update({ status: "source_fetch_failed", error_code: "all_sources_failed", error_message: "Configure credentials in Settings → Integrations.", updated_at: new Date().toISOString() }).eq("id", runId); }
  return json({ ok: trr > 0, runId, stage: "source_fetch", sourceCount: sources.length, rawRowCount: trr, failedSourceCount: tfs, sourceResults: srs, durationMs: d });
}

async function handleRunEligibility(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  await db.from("chart_ingest_candidates").delete().eq("run_id", runId); await db.from("chart_ingest_exclusions").delete().eq("run_id", runId);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "eligibility_execution");
  const { data: nr } = await db.from("chart_ingest_normalized_rows").select("*").eq("run_id", runId).order("created_at");
  if (!nr || nr.length === 0) { await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "No rows.", metrics_json: { candidateCount: 0, excludedCount: 0 } }).eq("run_id", runId).eq("stage", "eligibility_execution"); return json({ ok: true, runId, candidateCount: 0, excludedCount: 0 }); }
  const sms = 1; let cc = 0, ec = 0; const CH = 200;
  for (let i = 0; i < nr.length; i += CH) { const ck = nr.slice(i, i + CH); const cs: Array<Record<string, unknown>> = []; const es: Array<Record<string, unknown>> = []; for (const row of ck) { const sc = Array.isArray(row.source_urls_seen) ? (row.source_urls_seen as string[]).length : 0; if (sc < sms) { es.push({ run_id: runId, candidate_id: null, reason_code: "below_min_sources", severity: "hard", source_stage: "eligibility_execution" }); ec++; continue; } const cid = crypto.randomUUID(); cs.push({ id: cid, run_id: runId, normalized_key: row.normalized_key, title: row.normalized_title, artist_display: row.normalized_artist, lead_artist_key: row.lead_artist_key, source_count: sc, source_urls_seen: row.source_urls_seen || [], occurrence_count: row.occurrence_count || 0, candidate_type: "streaming", status: "pending", version: 1 }); cc++; } if (cs.length > 0) await db.from("chart_ingest_candidates").insert(cs); if (es.length > 0) await db.from("chart_ingest_exclusions").insert(es); }
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: Date.now(), message: `${cc} candidates, ${ec} excluded`, metrics_json: { candidateCount: cc, excludedCount: ec } }).eq("run_id", runId).eq("stage", "eligibility_execution");
  return json({ ok: true, runId, candidateCount: cc, excludedCount: ec, inputRowCount: nr.length });
}

// v5: Reads program airplay config + airplay_evidence_weekly, builds context map, passes real W/S/D to scoring.
async function handleRunScoring(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,edition_date,rule_snapshot_json,methodology_version,program_id").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0];
  const rs = (run.rule_snapshot_json as Record<string, unknown>) || {};

  // ── Read program airplay config ──
  let apEnabled = false, apMaxScore = 24, apMinStations = 1, apMinDetections = 1, apWeight = 1.0;
  if (run.program_id) {
    const { data: program } = await db.from("wk_chart_programs_v2").select("airplay_enabled,airplay_max_score,airplay_min_stations,airplay_min_detections,airplay_weight").eq("id", run.program_id).maybeSingle();
    if (program) {
      apEnabled = program.airplay_enabled ?? false;
      apMaxScore = Number(program.airplay_max_score ?? 24);
      apMinStations = Number(program.airplay_min_stations ?? 1);
      apMinDetections = Number(program.airplay_min_detections ?? 1);
      apWeight = Number(program.airplay_weight ?? 1);
    }
  }

  // ── Fetch airplay evidence from airplay_evidence_weekly ──
  const airplayCtxMap = new Map<string, { W: number; station_count: number; detection_count: number }>();
  if (apEnabled) {
    const { data: evidenceRows } = await db.from("airplay_evidence_weekly").select("normalized_key,detection_count,total_played_duration_seconds,station_weight,weighted_score,source_id").eq("edition_date", ed);
    if (evidenceRows && evidenceRows.length > 0) {
      const keyGroups = new Map<string, { W: number; stations: Set<string>; detections: number }>();
      for (const row of evidenceRows) {
        const nk = String(row.normalized_key ?? "");
        if (!nk) continue;
        if (!keyGroups.has(nk)) keyGroups.set(nk, { W: 0, stations: new Set(), detections: 0 });
        const g = keyGroups.get(nk)!;
        g.W += Number(row.weighted_score ?? 0);
        g.stations.add(String(row.source_id ?? ""));
        g.detections += Number(row.detection_count ?? 0);
      }
      for (const [nk, g] of keyGroups) {
        airplayCtxMap.set(nk, { W: g.W, station_count: g.stations.size, detection_count: g.detections });
      }
    }
  }

  const scfg = {
    cross_source_mode: (rs.cross_source_mode as string) || "standard",
    cross_source_weight: 1.0,
    continuity_weight: 1.0,
    carry_forward_weight: 1.0,
    overlap_bonus_cap: 10,
    airplay_enabled: apEnabled,
    airplay_max_score: apMaxScore,
    airplay_min_stations: apMinStations,
    airplay_min_detections: apMinDetections,
    airplay_weight: apWeight,
  };

  await db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "methodology_scoring");
  const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).order("created_at");
  if (!candidates || candidates.length === 0) { await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "No candidates.", metrics_json: { scoredCount: 0 } }).eq("run_id", runId).eq("stage", "methodology_scoring"); return json({ ok: true, runId, stage: "methodology_scoring", scoredCount: 0 }); }

  const provs: Array<{ candidateId: string; normalized_key: string; lead_artist_key: string; source_score: number; cross_source_bonus: number; overlap_bonus: number; recency_score: number; continuity_score: number; carry_forward_bonus: number; airplay_score: number; provisional_total: number; }> = [];
  for (const c of candidates) {
    const nk = (c.normalized_key as string) || "";
    const actx = airplayCtxMap.get(nk) ?? null;
    const s = computeCandidateProvisionalScore({
      normalized_key: nk,
      lead_artist_key: (c.lead_artist_key as string) || "",
      source_count: (c.source_count as number) || 0,
      occurrence_count: (c.occurrence_count as number) || 0,
      release_date: (c.release_date as string) || null,
      carry_forward_only: !!(c.carry_forward_only as boolean),
      continuity_locked: !!(c.continuity_locked as boolean),
      airplay_candidate_only: !!(c.airplay_candidate_only as boolean),
    }, ed, null, scfg, actx);
    provs.push({ candidateId: c.id as string, normalized_key: nk, lead_artist_key: (c.lead_artist_key as string) || "", ...s });
  }

  const agi = provs.map(p => ({ normalized_key: p.normalized_key, lead_artist_key: p.lead_artist_key, provisional_total: p.provisional_total }));
  const agr = computeAntiGamingPenalties(agi, 3, 8); const pm2 = new Map<string, AntiGamingResult>(); for (const ag of agr) pm2.set(ag.normalized_key, ag);

  const totalAirplayScore = provs.reduce((sum, p) => sum + p.airplay_score, 0);

  const srs = provs.map(p => {
    const ag = pm2.get(p.normalized_key) ?? { anti_gaming_penalty: 0, lead_artist_overflow: false, overflow_index: 0 };
    const fs = round4(p.provisional_total - ag.anti_gaming_penalty);
    const actx = airplayCtxMap.get(p.normalized_key);
    return {
      run_id: runId, candidate_id: p.candidateId, normalized_key: p.normalized_key,
      source_score: p.source_score, cross_source_bonus: p.cross_source_bonus, overlap_bonus: p.overlap_bonus,
      recency_score: p.recency_score, continuity_score: p.continuity_score, carry_forward_bonus: p.carry_forward_bonus,
      airplay_score: p.airplay_score, anti_gaming_penalty: ag.anti_gaming_penalty, final_score: fs,
      source_count: 0, occurrence_count: 0, recency_days: null, previous_position: null,
      score_payload_json: { scoring_policy_version: "1.0.1", edition_date: ed },
      anti_gaming_json: { anti_gaming_penalty: ag.anti_gaming_penalty, lead_artist_overflow: ag.lead_artist_overflow },
      airplay_json: actx ? { W: actx.W, station_count: actx.station_count, detection_count: actx.detection_count } : {},
      score_integrity_ok: true, score_integrity_delta: null,
    };
  });

  const CH = 200; for (let i = 0; i < srs.length; i += CH) { const ck = srs.slice(i, i + CH); await db.from("chart_ingest_candidate_scores").insert(ck); }
  const d = Date.now() - ss, oc = agr.filter(a => a.lead_artist_overflow).length;
  const airplayMsg = apEnabled && airplayCtxMap.size > 0 ? `, airplay: ${airplayCtxMap.size} tracks, Σ=${totalAirplayScore.toFixed(2)}` : "";
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: `${srs.length} scored, ${oc} overflow(s)${airplayMsg}`, metrics_json: { scoredCount: srs.length, overflowCount: oc, airplayTrackCount: airplayCtxMap.size, airplayTotalScore: round4(totalAirplayScore) } }).eq("run_id", runId).eq("stage", "methodology_scoring");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: `${oc} penalized`, metrics_json: { overflowCount: oc } }).eq("run_id", runId).eq("stage", "anti_gaming");
  return json({ ok: true, runId, stage: "methodology_scoring", scoredCount: srs.length, overflowCount: oc, airplayTrackCount: airplayCtxMap.size, durationMs: d });
}

async function handleRunShortlist(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const { data: run } = await db.from("chart_ingest_runs").select("id,chart_size").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  const chartSize = (run.chart_size as number) || 20;
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "shortlist");
  const { data: srs } = await db.from("chart_ingest_candidate_scores").select("*, chart_ingest_candidates!inner(status, carry_forward_only)").eq("run_id", runId).order("final_score", { ascending: false });
  if (!srs || srs.length === 0) { await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "No scored candidates.", metrics_json: { shortlistedCount: 0, totalScored: 0 } }).eq("run_id", runId).eq("stage", "shortlist"); return json({ ok: true, runId, stage: "shortlist", shortlistedCount: 0, totalScored: 0 }); }
  const now = new Date().toISOString(); let sc = 0;
  for (let i = 0; i < srs.length; i++) { const cid = srs[i].candidate_id as string; if (i < chartSize) { await db.from("chart_ingest_candidates").update({ status: "eligible", updated_at: now }).eq("id", cid).eq("run_id", runId); sc++; } else { await db.from("chart_ingest_candidates").update({ status: "excluded", updated_at: now }).eq("id", cid).eq("run_id", runId); } }
  await db.from("chart_ingest_runs").update({ status: "dry_run_complete", dry_run_completed_at: now, updated_at: now }).eq("id", runId);
  const d = Date.now(); await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: `${sc} shortlisted (top ${chartSize})`, metrics_json: { shortlistedCount: sc, totalScored: srs.length, chartSize } }).eq("run_id", runId).eq("stage", "shortlist");
  return json({ ok: true, runId, stage: "shortlist", shortlistedCount: sc, totalScored: srs.length, excludedCount: srs.length - sc, chartSize });
}

async function handleResetPipeline(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string }; if (!runId) return json({ error: "runId_required" }, 400);
  const { data: run } = await db.from("chart_ingest_runs").select("id,status").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  if (!["draft", "queued", "running", "dry_run_complete", "needs_review"].includes(run.status)) return json({ error: "cannot_reset_pipeline" }, 400);
  const now = new Date().toISOString();
  await db.from("chart_ingest_stage_events").update({ status: "idle", started_at: null, finished_at: null, duration_ms: null, message: null, error_code: null, error_message: null, metrics_json: {} }).eq("run_id", runId);
  await Promise.all([db.from("chart_ingest_raw_rows").delete().eq("run_id", runId), db.from("chart_ingest_normalized_rows").delete().eq("run_id", runId), db.from("chart_ingest_candidates").delete().eq("run_id", runId), db.from("chart_ingest_exclusions").delete().eq("run_id", runId), db.from("chart_ingest_candidate_scores").delete().eq("run_id", runId), db.from("chart_ingest_matches").delete().eq("run_id", runId), db.from("chart_ingest_review_issues").delete().eq("run_id", runId)]);
  await db.from("chart_ingest_run_sources").update({ fetch_status: "pending", fetched_count: 0, normalized_count: 0, dropped_count: 0, warnings_json: [], error_code: null, error_message: null, started_at: null, finished_at: null }).eq("run_id", runId);
  await db.from("chart_ingest_runs").update({ status: "draft", dry_run_completed_at: null, updated_at: now, error_code: null, error_message: null }).eq("id", runId);
  return json({ ok: true, runId, status: "draft", previousStatus: run.status });
}

async function handleApplyRowDecision(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId, candidateId, action, canonicalEntityId, note } = params as { runId: string; candidateId: string; action: string; canonicalEntityId?: string; note?: string };
  if (!runId || !candidateId || !action) return json({ error: "runId, candidateId, and action required" }, 400);
  const va = ["accept_canonical", "change_match", "attach_to_existing", "create_shell", "merge_shell", "mark_duplicate", "send_to_review", "ignore", "exclude"];
  if (!va.includes(action)) return json({ error: `invalid_action: ${action}` }, 400);
  const now = new Date().toISOString(), an = user.email || user.id;
  const ns = ["accept_canonical", "change_match", "attach_to_existing", "merge_shell"].includes(action) ? "eligible" : action === "ignore" ? "ignored" : action === "mark_duplicate" || action === "exclude" ? "excluded" : "needs_review";
  await db.from("chart_ingest_candidates").update({ status: ns, updated_at: now }).eq("id", candidateId).eq("run_id", runId);
  if (canonicalEntityId && ["accept_canonical", "change_match", "attach_to_existing", "merge_shell"].includes(action)) { await db.from("chart_ingest_matches").upsert({ run_id: runId, candidate_id: candidateId, entity_type: "track", canonical_entity_id: canonicalEntityId, match_method: "manual", confidence: 100, status: "accepted", reasons_json: [{ reason: action, note: note || null, decided_by: an, decided_at: now }], decided_by: an, decided_at: now, decision_note: note || null, updated_at: now }, { onConflict: "run_id,candidate_id" }); }
  return json({ ok: true, candidateId, runId, action, newStatus: ns });
}

async function handleCommitRun(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId, publishImmediately, notes, acknowledgedWarnings } = params as { runId: string; publishImmediately?: boolean; notes?: string; acknowledgedWarnings?: string[] };
  const { data: run } = await db.from("chart_ingest_runs").select("*").eq("id", runId).maybeSingle(); if (!run) return json({ error: "run_not_found" }, 404);
  if (!["dry_run_complete", "ready_to_commit", "needs_review"].includes(run.status)) return json({ error: "commit_not_ready" }, 400);
  const { data: candidates } = await db.from("chart_ingest_candidates").select("*").eq("run_id", runId).in("status", ["eligible", "committed"]).order("created_at");
  if (!candidates || candidates.length === 0) return json({ error: "no_candidates" }, 400);
  const { data: program } = await db.from("wk_chart_programs_v2").select("id,public_slug").eq("id", run.program_id).maybeSingle();
  const pid = program?.id || run.program_id, psl = program?.public_slug || run.series_slug || run.program_id;
  const { data: de } = await db.from("wk_chart_editions_v2").select("id").eq("program_id", pid).eq("edition_date", run.edition_date).maybeSingle(); if (de) return json({ error: "duplicate_edition" }, 409);
  const eid = crypto.randomUUID(), esl = `${run.edition_date}`;
  const now = new Date().toISOString();
  const rss = { ...run.rule_snapshot_json, scoringPolicyVersion: run.scoring_policy_version, eligibilityPolicyVersion: run.eligibility_policy_version, sourcePolicyVersion: run.source_policy_version, methodologyVersion: run.methodology_version, chartSize: run.chart_size, committedAt: now, ingestRunId: runId };
  const { error: ee } = await db.from("wk_chart_editions_v2").insert({ id: eid, program_id: pid, edition_slug: esl, edition_label: `Edition ${run.edition_date}`, edition_date: run.edition_date, period_start: run.period_start, period_end: run.period_end, status: publishImmediately ? "published" : "staged", entry_count: candidates.length, methodology_version: run.methodology_version, source_policy_version: run.source_policy_version, eligibility_policy_version: run.eligibility_policy_version, scoring_policy_version: run.scoring_policy_version, rule_set_snapshot: rss, chart_size: run.chart_size, market_slug: run.market_slug, ingest_run_id: runId, published_at: publishImmediately ? now : null, published_by: publishImmediately ? (user.email || user.id) : null, carry_forward_count: 0, new_entries_count: candidates.length, re_entries_count: 0, exclusion_summary: {} });
  if (ee) return json({ error: "edition_write_failed", detail: ee.message }, 500);
  await db.from("chart_ingest_runs").update({ status: publishImmediately ? "published" : "committed", commit_edition_id: eid, committed_at: now, updated_at: now, notes: notes || run.notes }).eq("id", runId);
  const aid = crypto.randomUUID(); await db.from("chart_ingest_audit_events").insert({ id: aid, run_id: runId, actor: user.id, actor_email: user.email || null, action: "run_committed", previous_status: run.status, new_status: publishImmediately ? "published" : "committed", payload_json: { editionId: eid, editionSlug: esl, entryCount: candidates.length } });
  return json({ runId, status: publishImmediately ? "published" : "committed", programId: pid, publicSlug: psl, editionId: eid, editionSlug: esl, editionDate: run.edition_date, entryCount: candidates.length, snapshotId: eid, publicUrl: `/charts/${psl}/${esl}`, apiUrl: `/api/v1/charts/${psl}/${esl}`, integrity: { ok: true, warnings: [], errors: [] }, auditEventId: aid, committedAt: now, committedBy: user.email || user.id });
}

// ═══════ §5 ACRCloud Airplay Detection Pipeline ═══════
async function handleRunAirplayDetection(db: ReturnType<typeof createClient>, params: Record<string, unknown>, user: { id: string; email?: string }) {
  const { runId } = params as { runId: string };
  if (!runId) return json({ error: "runId_required" }, 400);
  const ss = Date.now();
  const { data: run } = await db.from("chart_ingest_runs").select("id,status,edition_date,market_slug").eq("id", runId).maybeSingle();
  if (!run) return json({ error: "run_not_found" }, 404);
  await db.from("chart_ingest_stage_events").update({ status: "running", started_at: new Date().toISOString(), message: null, error_code: null, error_message: null }).eq("run_id", runId).eq("stage", "airplay_evidence");
  const acrHost = await readCredential(db, "ACR_HOST", "acr_host");
  const acrAccessKey = await readCredential(db, "ACR_ACCESS_KEY", "acr_access_key");
  const acrAccessSecret = await readCredential(db, "ACR_ACCESS_SECRET", "acr_access_secret");
  if (!acrHost || !acrAccessKey || !acrAccessSecret) {
    const missing: string[] = [];
    if (!acrHost) missing.push("ACR_HOST");
    if (!acrAccessKey) missing.push("ACR_ACCESS_KEY");
    if (!acrAccessSecret) missing.push("ACR_ACCESS_SECRET");
    const msg = `ACRCloud credentials missing: ${missing.join(", ")}. Save them via Settings → Integrations.`;
    const d = Date.now() - ss;
    await db.from("chart_ingest_stage_events").update({ status: "failed", finished_at: new Date().toISOString(), duration_ms: d, message: msg, error_code: "acr_credentials_missing", error_message: msg }).eq("run_id", runId).eq("stage", "airplay_evidence");
    return json({ ok: false, runId, stage: "airplay_evidence", error: msg, sourceCount: 0, detectionCount: 0, durationMs: d });
  }
  const { data: sources } = await db.from("airplay_sources").select("*").eq("enabled", true);
  if (!sources || sources.length === 0) {
    const d = Date.now() - ss;
    await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: "No enabled airplay stations configured.", metrics_json: { sourceCount: 0, detectionCount: 0, evidenceBucketCount: 0 } }).eq("run_id", runId).eq("stage", "airplay_evidence");
    await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: "No airplay evidence to rescue.", metrics_json: { rescueCandidateCount: 0 } }).eq("run_id", runId).eq("stage", "airplay_rescue");
    return json({ ok: true, runId, stage: "airplay_evidence", sourceCount: 0, detectionCount: 0, evidenceBucketCount: 0, durationMs: d });
  }
  const apiHost = acrHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiBase = `https://${apiHost}`;
  const ed = (run.edition_date as string) || new Date().toISOString().split("T")[0];
  const dateParam = ed.replace(/-/g, "");
  const now = new Date().toISOString();
  let totalDetections = 0;
  const sourceResults: Array<{ sourceId: string; stationName: string; detectionCount: number; error: string | null }> = [];
  for (const source of sources) {
    const meta = (source.metadata_json as Record<string, unknown>) || {};
    const streamId = (meta.acr_stream_id as string) || source.station_slug;
    if (!streamId) { sourceResults.push({ sourceId: source.id, stationName: source.station_name, detectionCount: 0, error: "No ACRCloud stream_id configured in metadata_json" }); continue; }
    const uri = "/v1/acrcloud/results";
    let signature: string, timestamp: number;
    try { const sigResult = await acrcloudSign(acrAccessKey, acrAccessSecret, "GET", apiHost, uri); signature = sigResult.signature; timestamp = sigResult.timestamp; }
    catch (e) { sourceResults.push({ sourceId: source.id, stationName: source.station_name, detectionCount: 0, error: `Signature generation failed: ${e instanceof Error ? e.message : String(e)}` }); continue; }
    const queryUrl = `${apiBase}${uri}?access_key=${encodeURIComponent(acrAccessKey)}&signature=${encodeURIComponent(signature)}&signature_version=1&timestamp=${timestamp}&stream_id=${encodeURIComponent(streamId)}&date=${dateParam}`;
    let res: Response;
    try { res = await fetch(queryUrl, { method: "GET", headers: { Accept: "application/json" } }); }
    catch (e) { sourceResults.push({ sourceId: source.id, stationName: source.station_name, detectionCount: 0, error: `ACRCloud unreachable at ${apiHost}: ${e instanceof Error ? e.message : String(e)}` }); continue; }
    if (!res.ok) { const bodyText = await res.text(); sourceResults.push({ sourceId: source.id, stationName: source.station_name, detectionCount: 0, error: `ACRCloud ${res.status}: ${bodyText.slice(0, 300)}` }); continue; }
    const data = await res.json() as { results?: Array<{ acr_id?: string; title?: string; artists?: Array<{ name: string }>; album?: { name: string }; duration?: number; play_time?: string; score?: number; label?: string; isrc?: string }>; status?: { msg: string; code: number } };
    const acrResults = data.results || [];
    if (acrResults.length === 0) { sourceResults.push({ sourceId: source.id, stationName: source.station_name, detectionCount: 0, error: null }); continue; }
    const detections = acrResults.map((r) => {
      const artistName = (r.artists || []).map((a) => a.name).join(", ") || "Unknown";
      return { id: crypto.randomUUID(), source_id: source.id, detected_at: r.play_time || now, played_duration_seconds: typeof r.duration === "number" ? r.duration : 0, acr_track_id: r.acr_id || null, canonical_track_id: null, normalized_key: build_normalized_key(r.title || "", artistName), title: r.title || "Unknown", artist: artistName, confidence: typeof r.score === "number" ? Math.round(r.score * 100) : 0, raw_payload_json: r, created_at: now };
    });
    const CH = 100; for (let j = 0; j < detections.length; j += CH) { await db.from("airplay_detections").insert(detections.slice(j, j + CH)); }
    totalDetections += detections.length;
    sourceResults.push({ sourceId: source.id, stationName: source.station_name, detectionCount: detections.length, error: null });
  }
  let evidenceBucketCount = 0;
  if (totalDetections > 0) {
    const { data: allDetections } = await db.from("airplay_detections").select("*, airplay_sources!inner(station_weight)").in("source_id", sources.map((s: { id: string }) => s.id)).gte("detected_at", ed).lt("detected_at", new Date(new Date(ed).getTime() + 7 * 86400000).toISOString()).order("detected_at");
    if (allDetections && allDetections.length > 0) {
      const bucketMap = new Map<string, { detectionIds: string[]; totalDuration: number; lastDetected: string; stationWeight: number; sourceId: string; normalizedKey: string; canonicalTrackId: string | null }>();
      for (const det of allDetections) {
        const weekStart = anchorToMonday(det.detected_at as string);
        const nk = (det.normalized_key as string) || `__unmatched_${det.id}`;
        const bucketKey = `${weekStart}::${det.source_id}::${nk}`;
        const existing = bucketMap.get(bucketKey);
        const sw = det.airplay_sources && typeof det.airplay_sources === "object" && !Array.isArray(det.airplay_sources) ? ((det.airplay_sources as Record<string, unknown>).station_weight as number) || 1.0 : 1.0;
        if (existing) { existing.detectionIds.push(det.id as string); existing.totalDuration += (det.played_duration_seconds as number) || 0; if ((det.detected_at as string) > existing.lastDetected) existing.lastDetected = det.detected_at as string; }
        else { bucketMap.set(bucketKey, { detectionIds: [det.id as string], totalDuration: (det.played_duration_seconds as number) || 0, lastDetected: det.detected_at as string, stationWeight: sw, sourceId: det.source_id as string, normalizedKey: nk, canonicalTrackId: (det.canonical_track_id as string) || null }); }
      }
      const evidenceRows = Array.from(bucketMap.values()).map((b) => {
        const dc = b.detectionIds.length;
        const ws = dc * b.stationWeight + b.totalDuration / 60;
        return { id: crypto.randomUUID(), week_start: anchorToMonday(b.lastDetected), edition_date: ed, canonical_track_id: b.canonicalTrackId, normalized_key: b.normalizedKey, source_id: b.sourceId, detection_count: dc, total_played_duration_seconds: Math.round(b.totalDuration), station_weight: b.stationWeight, weighted_score: Math.round(ws * 10000) / 10000, last_detected_at: b.lastDetected, created_at: now };
      });
      for (const row of evidenceRows) { await db.from("airplay_evidence_weekly").upsert(row, { onConflict: "week_start,source_id,normalized_key" }); }
      evidenceBucketCount = evidenceRows.length;
    }
  }
  const d = Date.now() - ss;
  const msg = totalDetections > 0 ? `${totalDetections} detections → ${evidenceBucketCount} evidence buckets from ${sources.length} station(s)` : "No ACRCloud detections found for any station.";
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: d, message: msg, metrics_json: { sourceCount: sources.length, detectionCount: totalDetections, evidenceBucketCount, sourceResults } }).eq("run_id", runId).eq("stage", "airplay_evidence");
  await db.from("chart_ingest_stage_events").update({ status: "completed", finished_at: new Date().toISOString(), duration_ms: 0, message: evidenceBucketCount > 0 ? `Airplay rescue ready (${evidenceBucketCount} buckets).` : "No airplay evidence to rescue.", metrics_json: { rescueCandidateCount: 0, evidenceBucketCount } }).eq("run_id", runId).eq("stage", "airplay_rescue");
  await db.from("chart_ingest_audit_events").insert({ run_id: runId, actor: user.id, actor_email: user.email || null, action: "airplay_detection_run", new_status: null, payload_json: { sourceCount: sources.length, detectionCount: totalDetections, evidenceBucketCount, durationMs: d } });
  return json({ ok: true, runId, stage: "airplay_evidence", sourceCount: sources.length, detectionCount: totalDetections, evidenceBucketCount, sourceResults, durationMs: d });
}
