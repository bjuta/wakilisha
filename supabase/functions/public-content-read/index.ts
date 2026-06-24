// ── Public Content Read Gateway v17 — public API, no JWT required ──
// v17: Track detail release-context enrichment without registry_releases.track_count assumption
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "https://wakilisha.africa",
  "https://wakilisha.africa",
  "https://wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Vary": "Origin",
  };
}

const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "1; mode=block",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};

function fullHeaders(origin: string): Record<string, string> {
  return { ...getCorsHeaders(origin), ...securityHeaders, "Content-Type": "application/json", "Cache-Control": "no-cache, no-store, must-revalidate" };
}

const iso = () => new Date().toISOString();

function jsonResponse(data: unknown, origin: string, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: fullHeaders(origin) });
}

// ── Rate Limiter ──
const RATE_LIMIT_MAX = 1000;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function checkRateLimit(supabase: ReturnType<typeof createClient>, key: string): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  try {
    const { count, error } = await supabase.from("rate_limit_log").select("*", { count: "exact", head: true }).eq("bucket_key", key).gte("created_at", windowStart);
    if (error) return { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: "" };
    const current = count ?? 0;
    const remaining = Math.max(0, RATE_LIMIT_MAX - current - 1);
    const resetAt = new Date(Date.now() + RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
    supabase.from("rate_limit_log").insert({ bucket_key: key, created_at: iso() }).then(() => {});
    return { allowed: current < RATE_LIMIT_MAX, remaining, resetAt };
  } catch {
    return { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: "" };
  }
}

// ── Utility functions ──
function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min + ":" + String(sec).padStart(2, "0");
}
function slugify(text: string): string { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-$/g, "").slice(0, 200); }
function extractYear(dateStr: string): string { if (!dateStr) return ""; const cleaned = String(dateStr).trim(); if (cleaned.includes("-")) return cleaned.split("-")[0]; const spaceParts = cleaned.split(" "); const last = spaceParts[spaceParts.length - 1]; if (/^\d{4}$/.test(last)) return last; return cleaned; }
function releaseTypeLabel(type: string): string { const t = type.toLowerCase(); if (t === "album" || t === "studio album") return "studio album"; if (t === "ep" || t === "extended play") return "extended play"; if (t === "single") return "single"; if (t === "compilation" || t === "mixtape") return t; return t; }
function articleize(word: string): string { const first = word.charAt(0).toLowerCase(); if ("aeiou".includes(first)) return `an ${word}`; return `a ${word}`; }
function formatDateNicely(dateStr: string): string { if (!dateStr) return ""; try { const d = new Date(dateStr); if (isNaN(d.getTime())) return dateStr; return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch { return dateStr; } }
function extractFirstImgSrc(html: string): string { const m = html.match(/<img[^>]+src="([^"]+)"/); return m ? m[1] : ""; }
function stripHtml(html: string): string { return String(html || "").replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, "").trim(); }
function generateSmartExcerpt(html: string | null | undefined, maxChars = 280): string { if (!html) return ""; const withoutHeadings = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " "); let plain = withoutHeadings.replace(/<[^>]*>/g, ""); plain = plain.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, ""); plain = plain.replace(/\s+/g, " ").trim(); if (!plain) return ""; if (plain.length <= maxChars) return plain; const chopped = plain.slice(0, maxChars); const lastSpace = chopped.lastIndexOf(" "); if (lastSpace > maxChars * 0.6) return chopped.slice(0, lastSpace).replace(/[,\s]+$/, "") + "\u2026"; return chopped.replace(/[,\s]+$/, "") + "\u2026"; }
function resolveDek(article: Record<string, unknown>, maxChars = 280): string { const manualExcerpt = String(article.excerpt || "").trim(); if (manualExcerpt) return manualExcerpt; return generateSmartExcerpt(String(article.content_html || ""), maxChars); }
function parseCategoryNames(categories: any): string[] { if (!Array.isArray(categories)) return []; return categories.map((c: any) => { if (typeof c === "string") return c; if (c && typeof c === "object" && c.name) return String(c.name); return ""; }).filter(Boolean); }
function parseTagNames(tags: any): string[] { if (!Array.isArray(tags)) return []; return tags.map((t: any) => { if (typeof t === "string") return t; if (t && typeof t === "object" && t.name) return String(t.name); return ""; }).filter(Boolean); }
function normalizeTitleForDedup(title: string): string { return title.toLowerCase().replace(/[^a-z0-9]/g, "").trim(); }

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readAppleMusicCatalogId(row: any): string | null {
  const meta = (row?.metadata || {}) as Record<string, any>;

  return firstString(
    row?.apple_music_id,
    row?.appleMusicId,
    row?.apple_music_catalog_id,
    row?.appleMusicCatalogId,
    row?.apple_music_provider_id,
    meta.apple_music_id,
    meta.appleMusicId,
    meta.apple_music_catalog_id,
    meta.appleMusicCatalogId,
    meta.apple_music_provider_id,
    meta.appleMusicProviderId,
    meta.apple_music_track_id,
    meta.appleMusicTrackId,
    meta.apple_music?.id,
    meta.apple_music?.catalog_id,
    meta.appleMusic?.id,
    meta.appleMusic?.catalogId,
    meta.providers?.apple_music?.id,
    meta.providers?.apple_music?.catalog_id,
    meta.provider_ids?.apple_music,
    meta.source_ids?.apple_music
  );
}

function normalizePath(raw: string): string { const withoutPrefix = raw.replace(/^(\/functions\/v1)?\/public-content-read/, ""); return withoutPrefix.replace(/\/$/, "") || "/"; }

const WP_AUTHOR_MAP: Record<string, string> = { "1": "Wakilisha Staff", "37": "Muiruri Beautah", "38": "Shalom Kendi Mbae", "39": "Michael Mburu", "40": "Kambura Matiri", "41": "Kiuta Faith", "42": "gatwiri_c", "43": "Mary Gathoni", "44": "Timothy Muiruri", "47": "Sarah Wambi", "48": "Frank Njugi", "52": "Victor Muia", "54": "Hafare Segelan", "179": "Wangari Karume" };
function resolveAuthor(article: Record<string, unknown>): string { const storedAuthor = String(article.author || "").trim(); if (storedAuthor && storedAuthor !== "Wakilisha") return storedAuthor; const rawMeta = (article.raw_meta || {}) as Record<string, unknown>; const wpAuthorId = rawMeta.post_author ? String(rawMeta.post_author) : ""; if (wpAuthorId && WP_AUTHOR_MAP[wpAuthorId]) return WP_AUTHOR_MAP[wpAuthorId]; return "Wakilisha Staff"; }
function authorSlugFromName(name: string): string { return name.trim().toLowerCase().replace(/[\s_-]+/g, "-").replace(/[^a-z0-9-]/g, ""); }
function buildArticleResponse(a: any) { const catNames = parseCategoryNames(a.categories); const section = catNames.length > 0 ? catNames[0] : "Music"; const contentText = stripHtml(String(a.content_html || "")); const tagNames = parseTagNames(a.tags); const dek = resolveDek(a, 280); let heroUrl = String(a.hero_image_url || ""); if (!heroUrl && a.content_html) heroUrl = extractFirstImgSrc(String(a.content_html)); const authorName = resolveAuthor(a); return { id: String(a.id), slug: String(a.slug), title: String(a.title), section, dek, author: authorName, authorSlug: authorSlugFromName(authorName), date: a.published_at ? String(a.published_at).split("T")[0] : "", readingTime: Math.max(1, Math.ceil(contentText.length / 1500)), heroUrl, tags: tagNames }; }

type ReleaseEntry = { slug: string; title: string; releaseType: string; year: string; releaseDate: string; trackCount: number; artworkUrl: string; labelName?: string; genres?: string[]; tracks: Array<{ title: string; duration: string; previewUrl?: string }> };
interface TrackOut { title: string; duration: string; artists?: string; previewUrl?: string; }
interface ReleaseOut { slug: string; title: string; releaseType: string; year: string; releaseDate: string; trackCount: number; artworkUrl: string; artist?: string; labelName?: string; genres?: string[]; tracks: TrackOut[]; }

async function getArtistDiscography(supabase: ReturnType<typeof createClient>, artistId: string, artistName: string, metadataAlbums: any[], metadataEps: any[]): Promise<ReleaseEntry[]> {
  const releases: ReleaseEntry[] = []; const seenTitles = new Set<string>();
  const { data: releaseArtistRows } = await supabase.from("registry_release_artists").select("release_id, is_primary, role").eq("artist_id", artistId).eq("status", "active").order("credit_order", { ascending: true });
  if (releaseArtistRows && releaseArtistRows.length > 0) {
    const releaseIds = [...new Set(releaseArtistRows.map((r: any) => String(r.release_id)))];
    const { data: relRows } = await supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, label_id, metadata").in("id", releaseIds).in("status", ["active", "draft"]).order("release_date", { ascending: false });
    if (relRows && relRows.length > 0) {
      const { data: releaseTracks } = await supabase.from("registry_release_tracks").select("release_id, track_id, track_number").in("release_id", releaseIds).order("track_number", { ascending: true });
      const tracksByRelease = new Map<string, Array<{ track_id: string; track_number: number }>>();
      for (const rt of (releaseTracks ?? [])) { const rid = String(rt.release_id); if (!tracksByRelease.has(rid)) tracksByRelease.set(rid, []); tracksByRelease.get(rid)!.push({ track_id: String(rt.track_id), track_number: Number(rt.track_number || 0) }); }
      const trackIds = (releaseTracks ?? []).map((rt: any) => String(rt.track_id));
      const { data: trackRows } = trackIds.length > 0 ? await supabase.from("registry_tracks").select("id, title, duration_ms, preview_url").in("id", trackIds) : { data: [] };
      const trackById = new Map((trackRows ?? []).map((t: any) => [String(t.id), t]));
      const labelIds = [...new Set((relRows ?? []).map((r: any) => r.label_id).filter(Boolean).map(String))];
      const { data: labels } = labelIds.length > 0 ? await supabase.from("registry_labels").select("id, name").in("id", [...new Set(labelIds)]) : { data: [] };
      const labelById = new Map((labels ?? []).map((l: any) => [String(l.id), String(l.name)]));
      for (const r of relRows as any[]) {
        const releaseTrackList = tracksByRelease.get(String(r.id)) ?? [];
        const tracks = releaseTrackList.sort((a, b) => (a.track_number || 0) - (b.track_number || 0)).map((rt) => { const t = trackById.get(rt.track_id); if (!t) return null; const dms = Number(t.duration_ms || 0); const minutes = Math.floor(dms / 60000); const seconds = Math.floor((dms % 60000) / 1000); return { title: String(t.title || ""), duration: dms > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : "", previewUrl: t.preview_url || undefined }; }).filter(Boolean) as Array<{ title: string; duration: string; previewUrl?: string }>;
        const trackCount = tracks.length || releaseTrackList.length;
        const releaseMeta = (r.metadata || {}) as Record<string, unknown>;
        const labelName = r.label_id ? (labelById.get(String(r.label_id)) || String(releaseMeta.record_label || "") || "Independent") : (String(releaseMeta.record_label || "") || "Independent");
        const genres = Array.isArray(releaseMeta.genre_names) ? (releaseMeta.genre_names as string[]).map(String) : [];
        seenTitles.add(normalizeTitleForDedup(String(r.title)));
        releases.push({ slug: String(r.slug), title: String(r.title), releaseType: String(r.release_type || "album"), year: r.release_date ? String(r.release_date).split("-")[0] : "", releaseDate: r.release_date || "", trackCount, artworkUrl: String(r.artwork_url || ""), labelName, genres, tracks });
      }
    }
  }
  for (const al of metadataAlbums) { const title = String(al.title || ""); if (!title) continue; const trackCount = Number(al.track_count || al.trackCount || 0); if (trackCount === 0) continue; const key = normalizeTitleForDedup(title); if (seenTitles.has(key)) continue; seenTitles.add(key); releases.push({ slug: slugify(title), title, releaseType: "Album", year: extractYear(String(al.release_date || al.year || "")), releaseDate: String(al.release_date || al.year || ""), trackCount, artworkUrl: String(al.image || al.artwork || al.artworkUrl || al.artwork_url || ""), tracks: Array.isArray(al.tracks) ? al.tracks.map((tr: any) => ({ title: String(tr.title || ""), duration: String(tr.duration || "") })) : [] }); }
  for (const ep of metadataEps) { const title = String(ep.title || ""); if (!title) continue; const trackCount = Number(ep.track_count || ep.trackCount || 0); if (trackCount === 0) continue; const key = normalizeTitleForDedup(title); if (seenTitles.has(key)) continue; seenTitles.add(key); releases.push({ slug: slugify(title), title, releaseType: "EP", year: extractYear(String(ep.release_date || ep.year || "")), releaseDate: String(ep.release_date || ep.year || ""), trackCount, artworkUrl: String(ep.image || ep.artwork || ep.artworkUrl || ep.artwork_url || ""), tracks: Array.isArray(ep.tracks) ? ep.tracks.map((tr: any) => ({ title: String(tr.title || ""), duration: String(tr.duration || "") })) : [] }); }
  return releases;
}

async function getTopSongsFromRelationships(supabase: ReturnType<typeof createClient>, artistSlug: string): Promise<Array<{ title: string; artists: string; image: string; duration: string; songUrl: string }>> {
  const { data: relRows } = await supabase.from("registry_entity_relationships").select("target_slug, sort_order").eq("source_entity_type", "artist").eq("source_slug", artistSlug).eq("target_entity_type", "track").eq("relationship_type", "popular_track").eq("relationship_role", "top_song").eq("relationship_status", "active").order("sort_order", { ascending: true });
  if (!relRows || relRows.length === 0) return [];
  const seen = new Set<string>(); const uniqueRels: Array<{ target_slug: string; sort_order: number }> = [];
  for (const r of relRows as any[]) { const slug = String(r.target_slug); if (!seen.has(slug)) { seen.add(slug); uniqueRels.push({ target_slug: slug, sort_order: Number(r.sort_order || 0) }); } }
  const trackSlugs = uniqueRels.map(r => r.target_slug);
  const { data: trackRows } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, preview_url").in("slug", trackSlugs).eq("status", "active");
  if (!trackRows || trackRows.length === 0) return [];
  const trackBySlug = new Map<string, any>(); for (const t of trackRows as any[]) { trackBySlug.set(String(t.slug), t); }
  const trackIds = trackRows.map((t: any) => String(t.id)); let artistsByTrackId = new Map<string, string>();
  if (trackIds.length > 0) { const { data: trackArtistRows } = await supabase.from("registry_track_artists").select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order").in("track_id", trackIds).eq("status", "active").order("credit_order", { ascending: true }); if (trackArtistRows && trackArtistRows.length > 0) { const groups = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean }>>(); for (const ta of trackArtistRows as any[]) { const tid = String(ta.track_id); if (!groups.has(tid)) groups.set(tid, []); groups.get(tid)!.push({ name: String(ta.artist_name_text || ta.artist_slug || ""), slug: String(ta.artist_slug || ""), isPrimary: Boolean(ta.is_primary), isFeatured: Boolean(ta.is_featured) }); } for (const [tid, artists] of groups) { const primary = artists.find(a => a.isPrimary) || artists[0]; const featured = artists.filter(a => a !== primary && a.name).map(a => a.name); artistsByTrackId.set(tid, featured.length > 0 ? `${primary?.name || ""} (feat. ${featured.join(", ")})` : (primary?.name || "")); } } }
  return uniqueRels.map(rel => { const track = trackBySlug.get(rel.target_slug); if (!track) return null; const dms = Number(track.duration_ms || 0); const duration = dms > 0 ? `${Math.floor(dms / 60000)}:${String(Math.floor((dms % 60000) / 1000)).padStart(2, "0")}` : ""; return { title: String(track.title || ""), artists: artistsByTrackId.get(String(track.id)) || "", image: String(track.artwork_url || ""), duration, songUrl: String(track.preview_url || "") }; }).filter(Boolean) as Array<{ title: string; artists: string; image: string; duration: string; songUrl: string }>;
}

function buildProgramSummary(p: any) { return { id: String(p.id), publicSlug: String(p.public_slug), publicLabel: String(p.public_label), shortLabel: String(p.public_label), sourceFamilySlug: String(p.source_family_slug || p.public_slug), seriesSlug: String(p.series_slug || ""), seriesLabel: String(p.series_slug || ""), marketSlug: String(p.market_slug || ""), marketLabel: String(p.market_slug || ""), periodType: String(p.default_period_type || "weekly"), methodologyVersion: String(p.default_methodology_version || "legacy-import-v1"), eligibilityRulesVersion: "legacy-import-v1" }; }
function buildEditionSummary(e: any) { return { id: String(e.edition_slug), slug: String(e.edition_slug), label: String(e.edition_label), date: String(e.edition_date), periodStart: e.period_start || null, periodEnd: e.period_end || null, entryCount: e.entry_count || 0 }; }
function buildEntryItem(e: any) { return { id: String(e.id), rank: Number(e.rank || 0), previousRank: e.previous_rank != null ? Number(e.previous_rank) : null, movement: String(e.movement || "same"), trackSlug: String(e.track_slug || ""), trackTitle: String(e.track_title || ""), artistNames: String(e.artist_name || "").split(",").map((s: string) => s.trim()).filter(Boolean), artistSlugs: String(e.artist_name || "").split(",").map((s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/g, "")).filter(Boolean), artworkUrl: e.artwork_url || null, score: e.total_score != null ? Number(e.total_score) : null, sourceEntryId: String(e.id) }; }

function extractLabelAndGenres(releaseRow: Record<string, unknown>, labelById: Map<string, string>): { labelName: string; genres: string[] } {
  const releaseMeta = (releaseRow.metadata || {}) as Record<string, unknown>;
  const labelName = releaseRow.label_id ? (labelById.get(String(releaseRow.label_id)) || String(releaseMeta.record_label || "") || "Independent") : (String(releaseMeta.record_label || "") || "Independent");
  const genres = Array.isArray(releaseMeta.genre_names) ? (releaseMeta.genre_names as string[]).map(String) : [];
  return { labelName, genres };
}

async function fetchLabelMapForReleases(supabase: ReturnType<typeof createClient>, releases: Array<{ label_id?: string | null }>): Promise<Map<string, string>> {
  const labelIds = [...new Set(releases.map((r) => r.label_id).filter(Boolean).map(String))];
  if (!labelIds.length) return new Map();
  const { data: labels } = await supabase.from("registry_labels").select("id, name").in("id", labelIds);
  return new Map((labels ?? []).map((l: any) => [String(l.id), String(l.name)]));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsHeaders, ...securityHeaders } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const rateLimitKey = `public:${clientIp}`;
  const rl = await checkRateLimit(supabase, rateLimitKey);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests", retryAfter: rl.resetAt }), { status: 429, headers: { ...fullHeaders(origin), "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS), "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": rl.resetAt } });
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  try {
    let data: unknown;

    if (path === "/health" || path === "/health/") {
      data = { ok: true, service: "public-content-read", version: "15.0.0", timestamp: iso() };
    }

    else if (path.endsWith("/discography") && path.includes("/artists/")) {
      const artistSlug = path.replace(/^\/artists\//, "").replace(/\/discography\/?$/, "");
      if (!artistSlug) return jsonResponse({ error: "Missing artist slug" }, origin, 400);
      const { data: artist, error: artistErr } = await supabase.from("registry_artists").select("id, slug, display_name").eq("slug", artistSlug).eq("status", "active").maybeSingle();
      if (artistErr || !artist) return jsonResponse({ error: artistErr?.message || "Artist not found" }, origin, 404);
      const artistId = String(artist.id);
      const displayName = String(artist.display_name);
      const { data: primaryLinks } = await supabase.from("registry_release_artists").select("release_id").eq("artist_id", artistId).eq("is_primary", true).eq("status", "active");
      const primaryReleaseIds = (primaryLinks ?? []).map((r: any) => String(r.release_id));
      let ownReleases: ReleaseOut[] = [];
      if (primaryReleaseIds.length > 0) {
        const { data: releases } = await supabase.from("registry_releases").select("id, title, slug, release_type, release_date, artwork_url, label_id, metadata").in("id", primaryReleaseIds).in("status", ["active", "draft"]).order("release_date", { ascending: false });
        const labelMap = await fetchLabelMapForReleases(supabase, releases ?? []);
        if (releases) {
          for (const rel of releases as any[]) {
            const { data: relTracks } = await supabase.from("registry_release_tracks").select("track_id, track_number, disc_number").eq("release_id", rel.id).order("disc_number").order("track_number");
            const trackIds = (relTracks ?? []).map((rt: any) => rt.track_id);
            let tracks: TrackOut[] = [];
            if (trackIds.length > 0) {
              const { data: trackRows } = await supabase.from("registry_tracks").select("id, title, slug, duration_ms, preview_url").in("id", trackIds);
              const { data: trackArtists } = await supabase.from("registry_track_artists").select("track_id, artist_slug, artist_name_text, is_primary, credit_order").in("track_id", trackIds).eq("status", "active").order("credit_order");
              const artistsByTrack = new Map<string, string[]>();
              for (const ta of (trackArtists ?? [])) { const list = artistsByTrack.get(ta.track_id) || []; list.push(ta.artist_name_text); artistsByTrack.set(ta.track_id, list); }
              const trackMetaMap = new Map<string, { durationMs: number | null; previewUrl: string | null }>();
              for (const tr of (trackRows ?? [])) { trackMetaMap.set(tr.id, { durationMs: tr.duration_ms ?? null, previewUrl: tr.preview_url ?? null }); }
              tracks = (relTracks ?? []).map((rt: any) => { const t = (trackRows ?? []).find((tr: any) => tr.id === rt.track_id); if (!t) return null; const meta = trackMetaMap.get(t.id); const trackArtistsList = artistsByTrack.get(t.id) || []; const nonPageArtist = trackArtistsList.filter((a) => a !== displayName); const artistsStr = nonPageArtist.length > 0 ? nonPageArtist.join(", ") : undefined; return { title: t.title || "", duration: formatDuration(meta?.durationMs ?? null), artists: artistsStr, previewUrl: meta?.previewUrl || undefined }; }).filter(Boolean) as TrackOut[];
            }
            const { labelName, genres } = extractLabelAndGenres(rel, labelMap);
            ownReleases.push({ slug: rel.slug, title: rel.title, releaseType: rel.release_type || "album", year: extractYear(rel.release_date), releaseDate: rel.release_date || "", trackCount: tracks.length, artworkUrl: rel.artwork_url || "", labelName, genres, tracks });
          }
        }
      }

      const featuredReleaseIdsFromBoth = new Set<string>();
      const { data: featuredReleaseArtists } = await supabase.from("registry_release_artists").select("release_id").eq("artist_slug", artistSlug).eq("is_featured", true).eq("status", "active");
      if (featuredReleaseArtists) { for (const fra of featuredReleaseArtists) { const rid = String(fra.release_id); if (!primaryReleaseIds.includes(rid)) featuredReleaseIdsFromBoth.add(rid); } }
      const { data: featuredTrackArtists } = await supabase.from("registry_track_artists").select("track_id").eq("artist_slug", artistSlug).eq("is_primary", false).eq("status", "active");
      if (featuredTrackArtists && featuredTrackArtists.length > 0) {
        const featuredTrackIds = featuredTrackArtists.map((t: any) => t.track_id);
        const { data: featuredReleaseTracks } = await supabase.from("registry_release_tracks").select("release_id").in("track_id", featuredTrackIds);
        for (const frt of (featuredReleaseTracks ?? [])) { const rid = String(frt.release_id); if (!primaryReleaseIds.includes(rid)) featuredReleaseIdsFromBoth.add(rid); }
      }

      let appearsOn: ReleaseOut[] = [];
      if (featuredReleaseIdsFromBoth.size > 0) {
        const featuredReleaseIds = [...featuredReleaseIdsFromBoth];
        const { data: featuredReleases } = await supabase.from("registry_releases").select("id, title, slug, release_type, release_date, artwork_url, label_id, metadata").in("id", featuredReleaseIds).in("status", ["active", "draft"]).order("release_date", { ascending: false });
        const featLabelMap = await fetchLabelMapForReleases(supabase, featuredReleases ?? []);
        if (featuredReleases) {
          const seenTitles2 = new Set<string>();
          for (const rel of featuredReleases as any[]) {
            const titleKey = rel.title.toLowerCase().trim();
            if (seenTitles2.has(titleKey)) continue;
            seenTitles2.add(titleKey);
            const { data: primaryArtistLink } = await supabase.from("registry_release_artists").select("artist_name_text, artist_slug").eq("release_id", rel.id).eq("is_primary", true).eq("status", "active").maybeSingle();
            const { data: relTrackData } = await supabase.from("registry_release_tracks").select("track_id").eq("release_id", rel.id);
            const releaseTrackIds = (relTrackData ?? []).map((rt: any) => rt.track_id);
            let tracks: TrackOut[] = [];
            if (releaseTrackIds.length > 0) {
              const { data: tRows } = await supabase.from("registry_tracks").select("id, title, slug, duration_ms, preview_url").in("id", releaseTrackIds);
              const { data: allTrackArtists } = await supabase.from("registry_track_artists").select("track_id, artist_name_text, credit_order").in("track_id", releaseTrackIds).eq("status", "active").order("credit_order");
              const abt = new Map<string, string[]>();
              for (const ta of (allTrackArtists ?? [])) { const list = abt.get(ta.track_id) || []; list.push(ta.artist_name_text); abt.set(ta.track_id, list); }
              const tmm = new Map<string, { durationMs: number | null; previewUrl: string | null }>();
              for (const tr of (tRows ?? [])) { tmm.set(tr.id, { durationMs: tr.duration_ms ?? null, previewUrl: tr.preview_url ?? null }); }
              tracks = (tRows ?? []).map((t: any) => { const meta2 = tmm.get(t.id); const tal = abt.get(t.id) || []; const npa = tal.filter((a) => a !== displayName); const as2 = npa.length > 0 ? npa.join(", ") : undefined; return { title: t.title || "", duration: formatDuration(meta2?.durationMs ?? null), artists: as2, previewUrl: meta2?.previewUrl || undefined }; });
            }
            const { labelName, genres } = extractLabelAndGenres(rel, featLabelMap);
            appearsOn.push({ slug: rel.slug, title: rel.title, releaseType: rel.release_type || "album", year: extractYear(rel.release_date), releaseDate: rel.release_date || "", trackCount: tracks.length, artworkUrl: rel.artwork_url || "", artist: primaryArtistLink?.artist_name_text || "Various Artists", labelName, genres, tracks });
          }
        }
      }
      return jsonResponse({ artist: { id: artistId, slug: artistSlug, name: displayName }, releases: ownReleases, appearsOn }, origin);
    }

    else if (path === "/authors" || path === "/authors/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 50;
      const { data: authors } = await supabase.from("registry_authors").select("id, slug, name, bio, role, location, avatar_url, cover_url, social_links, joined_date").order("name", { ascending: true }).limit(limit);
      data = { authors: (authors ?? []).map((a: any) => ({ id: String(a.id), slug: String(a.slug), name: String(a.name), bio: a.bio || null, role: a.role || "Contributor", location: a.location || null, avatarUrl: a.avatar_url || null, coverUrl: a.cover_url || null, socialLinks: a.social_links || [], joinedDate: a.joined_date || null })) };
    }
    else if (path.startsWith("/authors/")) {
      const authorSlug = path.replace(/^\/authors\//, "").replace(/\/$/, "");
      if (!authorSlug) return jsonResponse({ data: null }, origin, 404);
      const { data: author } = await supabase.from("registry_authors").select("id, slug, name, bio, role, location, avatar_url, cover_url, social_links, joined_date").eq("slug", authorSlug).maybeSingle();
      if (!author) return jsonResponse({ data: null }, origin, 404);
      const authorName = String(author.name);
      const asn = authorSlugFromName(authorName);
      const { data: allArticles } = await supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo, raw_meta").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(500);
      const matchedArticles = (allArticles ?? []).filter((a: any) => authorSlugFromName(resolveAuthor(a)) === asn);
      const articleList = matchedArticles.map((a: any) => buildArticleResponse(a));
      data = { author: { id: String(author.id), slug: String(author.slug), name: String(author.name), bio: author.bio || null, role: author.role || "Contributor", location: author.location || null, avatarUrl: author.avatar_url || null, coverUrl: author.cover_url || null, socialLinks: author.social_links || [], joinedDate: author.joined_date || null }, articles: articleList, articleCount: articleList.length };
    }

    else if (path.startsWith("/preview/")) {
      const nonce = path.replace(/^\/preview\//, "").replace(/\/$/, "");
      const now = new Date().toISOString();
      const { data: article } = await supabase.from("wk_articles").select("id, slug, title, excerpt, content_html, author, published_at, categories, tags, hero_image_url, seo, wp_status, raw_meta").eq("preview_nonce", nonce).gt("preview_nonce_expires_at", now).maybeSingle();
      if (!article) return jsonResponse({ data: null, meta: { reason: "expired_or_invalid" } }, origin, 404);
      data = { article: { ...buildArticleResponse(article), contentHtml: String(article.content_html || ""), seo: (article.seo || {}) as Record<string, unknown>, categories: parseCategoryNames(article.categories), wpStatus: String(article.wp_status || "draft") } };
    }

    else if (path === "/magazine/site-content" || path === "/magazine/site-content/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 200;
      const [articleResult, artistResult, releaseResult, chartResult] = await Promise.all([
        supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo, raw_meta").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(limit),
        supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, metadata, status").eq("status", "active").order("display_name", { ascending: true }).limit(50),
        supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, description, status").in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(30),
        supabase.from("wk_chart_entries_v2").select("rank, track_title, track_slug, artist_name, artwork_url, edition_id").order("rank", { ascending: true }).limit(20)
      ]);
      const articles = (articleResult.data ?? []).map((a: any) => ({ contentType: "article" as const, ...buildArticleResponse(a) }));
      const artists = (artistResult.data ?? []).map((a: any) => { const meta = (a.metadata || {}) as Record<string, unknown>; const ag: string[] = Array.isArray(meta.genres) ? (meta.genres as string[]).map(String) : []; return { contentType: "artist" as const, id: String(a.id), slug: String(a.slug), title: String(a.display_name), section: ag[0] || "Artist", dek: ag.slice(0, 3).join(" / ") || "Artist in the registry", author: "", authorSlug: "", date: "", readingTime: 0, heroUrl: String(a.public_image_url || ""), tags: ag, originIso2: a.origin_iso2 || null }; });
      const releases = (releaseResult.data ?? []).map((r: any) => ({ contentType: "release" as const, id: String(r.id), slug: String(r.slug), title: String(r.title), section: String(r.release_type || "Release"), dek: r.description || "", author: "", authorSlug: "", date: r.release_date ? String(r.release_date).split("T")[0] : "", readingTime: 0, heroUrl: String(r.artwork_url || ""), tags: [], releaseType: String(r.release_type || "album") }));
      const chartHighlights = (chartResult.data ?? []).map((c: any) => ({ contentType: "chart_entry" as const, id: String(c.track_slug || c.edition_id), slug: String(c.track_slug || ""), title: String(c.track_title || ""), section: "Chart Entry", dek: `#${c.rank} \u00B7 ${c.artist_name || ""}`, author: String(c.artist_name || ""), authorSlug: "", date: "", readingTime: 0, heroUrl: String(c.artwork_url || ""), tags: [], rank: Number(c.rank), artistName: String(c.artist_name || "") }));
      data = { articles, artists, releases, chartHighlights };
    }

    else if (path.startsWith("/magazine/public/issues/")) {
      const issueSlug = path.replace(/^\/magazine\/public\/issues\//, "").replace(/\/$/, "");
      const { data: issue } = await supabase.from("wk_magazine_issues").select("*").eq("slug", issueSlug).eq("status", "published").maybeSingle();
      if (!issue) return jsonResponse({ data: null, meta: { reason: "not_found_or_not_published" } }, origin, 404);
      const { data: sections } = await supabase.from("wk_magazine_issue_sections").select("*").eq("issue_id", String(issue.id)).order("sort_order", { ascending: true });
      const { data: entities } = await supabase.from("wk_magazine_issue_entities").select("*").eq("issue_id", String(issue.id)).order("sort_order", { ascending: true });
      const visualAssetIds = (sections ?? []).map((s: any) => s.visual_asset_id).filter(Boolean) as string[];
      let visualAssets: any[] = [];
      if (visualAssetIds.length > 0) { const { data: visuals } = await supabase.from("wk_magazine_visual_assets").select("*").in("id", visualAssetIds).in("status", ["approved", "locked"]); visualAssets = visuals ?? []; }
      data = { issue: { id: String(issue.id), slug: String(issue.slug), title: String(issue.title), dek: issue.dek || null, status: String(issue.status), timeframeStart: issue.timeframe_start || null, timeframeEnd: issue.timeframe_end || null, issueType: String(issue.issue_type), visualFamily: issue.visual_family || null, treatment: issue.treatment || null, palette: issue.palette || null, contrastMode: issue.contrast_mode || null, createdBy: String(issue.created_by), publishedAt: issue.published_at || null }, sections: (sections ?? []).map((s: any) => ({ id: String(s.id), spreadId: String(s.spread_id), sectionType: String(s.section_type), title: String(s.title), deck: s.deck || null, body: s.body || null, layout: String(s.layout), sortOrder: Number(s.sort_order), status: String(s.status), visualAssetId: s.visual_asset_id || null })), entities: (entities ?? []).map((e: any) => ({ id: String(e.id), sectionId: e.section_id || null, entityType: String(e.entity_type), entityId: String(e.entity_id), role: String(e.role), selectionState: String(e.selection_state), sortOrder: Number(e.sort_order), sourceReason: e.source_reason || null })), visualAssets: visualAssets.map((v: any) => ({ id: String(v.id), spreadId: String(v.spread_id), visualFamily: String(v.visual_family), visualType: String(v.visual_type), editorialIntent: String(v.editorial_intent), treatment: String(v.treatment), palette: String(v.palette), contrastMode: String(v.contrast_mode), status: String(v.status) })) };
    }

    else if (path.startsWith("/magazine/") && path !== "/magazine" && path !== "/magazine/") {
      const artSlug = path.replace(/^\/magazine\//, "").replace(/\/$/, "");
      const now = new Date().toISOString();
      const { data: article } = await supabase.from("wk_articles").select("id, slug, title, excerpt, content_html, author, published_at, modified_at, categories, tags, hero_image_url, seo, wp_status, raw_meta").eq("slug", artSlug).maybeSingle();
      if (!article) return jsonResponse({ data: null }, origin, 404);
      if (article.wp_status === "future" && article.published_at && article.published_at <= now) { const { error: updateError } = await supabase.from("wk_articles").update({ wp_status: "publish", updated_at: now }).eq("id", article.id); if (!updateError) article.wp_status = "publish"; }
      if (article.wp_status !== "publish") return jsonResponse({ data: null }, origin, 404);
      data = { article: { ...buildArticleResponse(article), contentHtml: String(article.content_html || ""), seo: (article.seo || {}) as Record<string, unknown>, categories: parseCategoryNames(article.categories) } };
    }

    else if (path === "/magazine" || path === "/magazine/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 500) : 500;
      const now = new Date().toISOString();
      await supabase.from("wk_articles").update({ wp_status: "publish", updated_at: now }).eq("wp_status", "future").lte("published_at", now);
      const { data: articles } = await supabase.from("wk_articles").select("id, slug, title, excerpt, author, published_at, content_html, categories, tags, hero_image_url, seo, raw_meta").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(limit);
      data = { stories: (articles ?? []).map((a: any) => buildArticleResponse(a)) };
    }

    else if (path.startsWith("/artists/")) {
      const slug = path.replace(/^\/artists\//, "").replace(/\/$/, "");
      const { data: artist } = await supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, bio, status, metadata").eq("slug", slug).eq("status", "active").maybeSingle();
      if (!artist) return jsonResponse({ data: null }, origin, 404);
      const meta = (artist.metadata || {}) as Record<string, unknown>;
      const displayName = String(artist.display_name || "");
      const socialInstagram = String(meta.social_instagram || meta.instagram_url || "");
      const socialSpotify = String(meta.social_spotify || "");
      const youtubeChannel = String(meta.youtube_channel || "");
      const spotifyImage = String(meta.spotify_image || meta.portrait_image || "");
      const genresArr = meta.genres; const genres: string[] = [];
      if (Array.isArray(genresArr)) { for (const g of genresArr as string[]) genres.push(String(g)); }
      if (meta.country) genres.push(String(meta.country));
      const topSongs = await getTopSongsFromRelationships(supabase, slug);
      const wpBio = String(artist.bio || "");
      const tagline = String(meta.tagline || "");
      const shortBio = tagline || stripHtml(wpBio).split(".")[0] + "." || "";
      const fullBio = wpBio || (tagline ? `<p>${tagline}</p>` : "");
      const videos: any[] = []; const youtubeVideos = meta.youtube_videos;
      if (Array.isArray(youtubeVideos)) { for (const item of youtubeVideos) { let videoId = ""; let title = ""; if (typeof item === "string") { const ytMatch = item.match(/youtube\.com\/watch\?v=([^&]+)/) || item.match(/youtu\.be\/([^?&]+)/); if (ytMatch) videoId = ytMatch[1]; } else if (item && typeof item === "object") { videoId = String((item as any).youtubeId || ""); title = String((item as any).title || ""); } if (videoId) videos.push({ id: videoId, title, url: "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1", thumbnail: "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg", platform: "youtube" }); } }
      if (videos.length === 0) { const videoUrlsRaw = meta.video_urls; if (typeof videoUrlsRaw === "string" && videoUrlsRaw) { try { const parsed = JSON.parse(videoUrlsRaw); const urls = Array.isArray(parsed) ? parsed : []; for (const vid of urls) { const videoUrl = String(vid.url || vid || ""); const ytMatch = videoUrl.match(/youtube\.com\/watch\?v=([^&]+)/) || videoUrl.match(/youtu\.be\/([^?&]+)/); if (ytMatch) { const videoId = ytMatch[1]; videos.push({ id: videoId, title: String(vid.title || ""), url: "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1", thumbnail: "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg", platform: "youtube" }); } } } catch { /* ignore */ } } }
      if (videos.length > 0) {
        const untitled = videos.filter((v: any) => !v.title);
        if (untitled.length > 0) {
          await Promise.all(untitled.map(async (v: any) => {
            try { const resp = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.id}&format=json`); if (resp.ok) { const j = await resp.json(); v.title = String(j.title || "YouTube Video"); } else { v.title = "YouTube Video"; } } catch { v.title = "YouTube Video"; }
          }));
        }
      }
      const metaAlbums = Array.isArray(meta.studio_albums) ? meta.studio_albums as any[] : [];
      const metaEps = Array.isArray(meta.eps_compilations) ? meta.eps_compilations as any[] : [];
      const releases = await getArtistDiscography(supabase, String(artist.id), displayName, metaAlbums, metaEps);
      const aggregatedGenres = new Set<string>();
      for (const r of releases) { if (r.genres) { for (const g of r.genres) { aggregatedGenres.add(g); } } }
      if (Array.isArray(genresArr)) { for (const g of genresArr as string[]) { aggregatedGenres.add(String(g)); } }
      if (meta.country) aggregatedGenres.add(String(meta.country));
      const allGenres = [...aggregatedGenres];
      const { data: chartEntriesBySlug } = await supabase.from("wk_chart_entries_v2").select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name").eq("artist_slug", slug).order("rank", { ascending: true }).limit(50);
      let chartEntries = chartEntriesBySlug ?? [];
      if (chartEntries.length === 0 && displayName) { const { data: chartEntriesByName } = await supabase.from("wk_chart_entries_v2").select("rank, track_title, track_slug, movement, previous_rank, artwork_url, edition_id, artist_name").ilike("artist_name", displayName).order("rank", { ascending: true }).limit(50); chartEntries = chartEntriesByName ?? []; }
      const chartEntryList = chartEntries.map((e: any) => { const prev = Number(e.previous_rank || 0); const curr = Number(e.rank || 0); let movement: string = String(e.movement || "same"); let movementAmount = 0; if (prev > 0 && curr > 0) { if (curr < prev) { movement = "up"; movementAmount = prev - curr; } else if (curr > prev) { movement = "down"; movementAmount = curr - prev; } } return { rank: curr, title: String(e.track_title || ""), artist: String(e.artist_name || ""), slug: String(e.track_slug || ""), movement, movementAmount, peakPosition: curr, weeksOnChart: 1, artworkUrl: e.artwork_url || "" }; });
      const relatedArtistsMap = new Map<string, any>();
      const { data: entityArtistRels } = await supabase.from("registry_entity_relationships").select("source_slug, target_slug, relationship_type, relationship_role, confidence, metadata").or(`source_slug.eq.${slug},target_slug.eq.${slug}`).eq("source_entity_type", "artist").eq("target_entity_type", "artist").eq("relationship_status", "active");
      for (const rel of (entityArtistRels ?? [])) { const isSource = String(rel.source_slug) === slug; const relatedSlug = isSource ? String(rel.target_slug) : String(rel.source_slug); if (relatedSlug === slug) continue; const confidence = Number(rel.confidence || 1); const relMeta = (rel.metadata || {}) as Record<string, unknown>; const relType = String(rel.relationship_type || ""); if (!relatedArtistsMap.has(relatedSlug)) { relatedArtistsMap.set(relatedSlug, { slug: relatedSlug, name: "", imageUrl: "", score: 0, sharedTracksAll: 0, sharedChartTracks: 0, featuresThem: 0, theyFeature: 0, sharedTitles: [] }); } const entry = relatedArtistsMap.get(relatedSlug)!; entry.score += confidence; if (relType === "featured_on" || relType === "features") { if (isSource) entry.featuresThem++; else entry.theyFeature++; } if (relMeta.shared_track_count) entry.sharedTracksAll += Number(relMeta.shared_track_count); if (relMeta.shared_chart_count) entry.sharedChartTracks += Number(relMeta.shared_chart_count); if (Array.isArray(relMeta.shared_titles)) { for (const t of relMeta.shared_titles as string[]) { if (!entry.sharedTitles.includes(String(t))) entry.sharedTitles.push(String(t)); } } }
      const { data: artistPairs } = await supabase.from("registry_artist_relationships").select("artist_a_slug, artist_b_slug, relationship_type, confidence, metadata").or(`artist_a_slug.eq.${slug},artist_b_slug.eq.${slug}`).eq("relationship_status", "active");
      for (const pair of (artistPairs ?? [])) { const relatedSlug = String(pair.artist_a_slug) === slug ? String(pair.artist_b_slug) : String(pair.artist_a_slug); if (relatedSlug === slug) continue; const confidence = Number(pair.confidence || 1); const pairMeta = (pair.metadata || {}) as Record<string, unknown>; if (!relatedArtistsMap.has(relatedSlug)) { relatedArtistsMap.set(relatedSlug, { slug: relatedSlug, name: "", imageUrl: "", score: 0, sharedTracksAll: 0, sharedChartTracks: 0, featuresThem: 0, theyFeature: 0, sharedTitles: [] }); } const entry = relatedArtistsMap.get(relatedSlug)!; entry.score += confidence; if (pairMeta.shared_track_count) entry.sharedTracksAll += Number(pairMeta.shared_track_count); if (pairMeta.shared_chart_count) entry.sharedChartTracks += Number(pairMeta.shared_chart_count); }
      const relatedSlugs = Array.from(relatedArtistsMap.keys());
      let relatedArtists: any[] = [];
      if (relatedSlugs.length > 0) { const { data: relatedRows } = await supabase.from("registry_artists").select("slug, display_name, public_image_url").in("slug", relatedSlugs).eq("status", "active"); const artistLookup2 = new Map((relatedRows ?? []).map((r: any) => [String(r.slug), r])); relatedArtists = Array.from(relatedArtistsMap.values()).map((entry) => { const row = artistLookup2.get(entry.slug); return { slug: entry.slug, name: row ? String(row.display_name) : entry.slug, imageUrl: row?.public_image_url || "", score: Math.round(entry.score * 10), sharedTracksAll: entry.sharedTracksAll, sharedChartTracks: entry.sharedChartTracks, featuresThem: entry.featuresThem, theyFeature: entry.theyFeature, sharedTitles: entry.sharedTitles.slice(0, 5) }; }).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 8); }
      const followerCount = meta.spotify_followers ? Number(meta.spotify_followers) : 0;
      const popularity = meta.spotify_popularity ? Number(meta.spotify_popularity) : 0;
      const country = String(meta.country || artist.origin_iso2 || "");
      const heroImage = String(meta.portrait_image || artist.public_image_url || spotifyImage || "");
      const trackCount = releases.reduce((sum: number, r: any) => sum + (Number(r.trackCount) || 0), 0);
      const isChartArtist = chartEntryList.length > 0;
      const topChartPosition = isChartArtist ? Math.min(...chartEntryList.map((e: any) => Number(e.rank))) : null;
      data = { artist: { id: String(artist.id), slug: String(artist.slug), name: displayName, country, imageUrl: heroImage || artist.public_image_url || "", profileImageUrl: heroImage || artist.public_image_url || "", genres: allGenres, trackCount, releaseCount: releases.length, isChartArtist, isRising: popularity > 0 && popularity < 40, topChartPosition, bio: shortBio || displayName + " is an artist in the WAKILISHA registry.", fullBio: fullBio || wpBio || "", artistType: String(artist.gender || meta.gender || ""), followerCount, popularity, spotifyUrl: meta.spotify_artist_id ? "https://open.spotify.com/artist/" + meta.spotify_artist_id : socialSpotify || "", instagram: socialInstagram, youtubeChannel, chartEntries: chartEntryList, releases, topSongs, relatedArtists, videos, discographySource: "live_registry" } };
    }

    else if (path === "/artists" || path === "/artists/") {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 500, 500) : 500;
      const { data: artists } = await supabase.from("registry_artists").select("id, slug, display_name, origin_iso2, public_image_url, status, metadata").eq("status", "active").order("display_name", { ascending: true }).limit(limit);
      if (!artists || artists.length === 0) { data = { artists: [] }; }
      else {
        const artistIds = artists.map((a: any) => String(a.id));
        const slugs = artists.map((a: any) => String(a.slug));
        const { data: releaseArtistRows } = await supabase.from("registry_release_artists").select("artist_id, release_id").in("artist_id", artistIds).eq("status", "active");
        const trackCountByArtist = new Map<string, number>();
        const releaseCountByArtist = new Map<string, number>();
        if (releaseArtistRows && releaseArtistRows.length > 0) {
          const releaseIds = [...new Set(releaseArtistRows.map((r: any) => String(r.release_id)))];
          const { data: releaseTracks } = await supabase.from("registry_release_tracks").select("release_id, track_id").in("release_id", releaseIds);
          const trackCountByRelease = new Map<string, number>();
          for (const rt of (releaseTracks ?? [])) { const rid = String(rt.release_id); trackCountByRelease.set(rid, (trackCountByRelease.get(rid) || 0) + 1); }
          for (const ra of releaseArtistRows) { const aid = String(ra.artist_id); const rid = String(ra.release_id); trackCountByArtist.set(aid, (trackCountByArtist.get(aid) || 0) + (trackCountByRelease.get(rid) || 0)); releaseCountByArtist.set(aid, (releaseCountByArtist.get(aid) || 0) + 1); }
        }
        const { data: chartArtistSlugs } = await supabase.from("wk_chart_entries_v2").select("artist_slug").in("artist_slug", slugs).limit(1000);
        const chartArtistSet = new Set((chartArtistSlugs ?? []).map((e: any) => String(e.artist_slug)));
        data = { artists: artists.map((a: any) => { const meta = (a.metadata || {}) as Record<string, unknown>; const ag: string[] = Array.isArray(meta.genres) ? (meta.genres as string[]).map(String) : []; const aid = String(a.id); const aSlug = String(a.slug); return { id: aid, slug: aSlug, name: String(a.display_name), country: a.origin_iso2 || null, imageUrl: a.public_image_url || null, genres: ag, trackCount: trackCountByArtist.get(aid) || 0, releaseCount: releaseCountByArtist.get(aid) || 0, isChartArtist: chartArtistSet.has(aSlug), isRising: false, topChartPosition: null }; }) };
      }
    }

    else if (path.startsWith("/releases/")) {
      const relSegments = path.replace(/^\/releases\//, "").split("/").filter(Boolean);
      const releaseSlug = relSegments[relSegments.length - 1] || "";
      const urlArtistSlug = relSegments.length > 1 ? relSegments[0] : null;
      const { data: release } = await supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata, status, description").eq("slug", releaseSlug).in("status", ["active", "draft"]).maybeSingle();
      if (!release) return jsonResponse({ data: null }, origin, 404);
      if (urlArtistSlug) { const { data: releaseArtist } = await supabase.from("registry_release_artists").select("artist_slug").eq("release_id", String(release.id)).eq("artist_slug", urlArtistSlug).eq("status", "active").maybeSingle(); if (!releaseArtist) return jsonResponse({ data: null, meta: { reason: "release_not_found_for_artist" } }, origin, 404); }
      const releaseId = String(release.id);
      const releaseMeta = (release.metadata || {}) as Record<string, unknown>;
      const { data: releaseTracks } = await supabase.from("registry_release_tracks").select("track_id, track_number, disc_number").eq("release_id", releaseId).order("track_number", { ascending: true });
      const { data: releaseArtists } = await supabase.from("registry_release_artists").select("artist_id, artist_name_text, is_primary, is_featured, artist_slug").eq("release_id", releaseId).eq("status", "active").order("credit_order", { ascending: true }).limit(20);
      const primaryArtistRow = (releaseArtists ?? []).find((ra: any) => ra.is_primary) || (releaseArtists ?? [])[0];
      const artistName = primaryArtistRow ? String(primaryArtistRow.artist_name_text || primaryArtistRow.artist_slug || "Unknown") : "Unknown";
      const primaryArtistSlug = primaryArtistRow ? String(primaryArtistRow.artist_slug || "") : "";
      const releaseFeaturedSeen = new Map<string, { name: string; slug: string }>();
      for (const ra of (releaseArtists ?? [])) { if (ra.is_featured && ra.artist_slug && ra.artist_slug !== primaryArtistSlug) { const key = String(ra.artist_slug || ra.artist_name_text || ""); if (key && !releaseFeaturedSeen.has(key)) { releaseFeaturedSeen.set(key, { name: String(ra.artist_name_text || ra.artist_slug || ""), slug: String(ra.artist_slug || "") }); } } }
      let trackList: any[] = [];
      if (releaseTracks && releaseTracks.length > 0) {
        const trackIds = releaseTracks.map((rt: any) => String(rt.track_id));
        const { data: tracks } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, track_number, artwork_url, preview_url, metadata").in("id", trackIds);
        const trackById = new Map((tracks ?? []).map((t: any) => [String(t.id), t]));
        const { data: trackArtistRows } = await supabase.from("registry_track_artists").select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order").in("track_id", trackIds).eq("status", "active").order("credit_order", { ascending: true });
        const artistsByTrackId = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean }>>();
        for (const ta of (trackArtistRows ?? [])) { const tid = String(ta.track_id); if (!artistsByTrackId.has(tid)) artistsByTrackId.set(tid, []); artistsByTrackId.get(tid)!.push({ name: String(ta.artist_name_text || ta.artist_slug || ""), slug: String(ta.artist_slug || ""), isPrimary: Boolean(ta.is_primary), isFeatured: Boolean(ta.is_featured) }); }
        for (const ta of (trackArtistRows ?? [])) { if (ta.is_featured && ta.artist_slug && ta.artist_slug !== primaryArtistSlug) { const key = String(ta.artist_slug || ta.artist_name_text || ""); if (key && !releaseFeaturedSeen.has(key)) { releaseFeaturedSeen.set(key, { name: String(ta.artist_name_text || ta.artist_slug || ""), slug: String(ta.artist_slug || "") }); } } }
        trackList = releaseTracks.map((rt: any) => { const t = trackById.get(String(rt.track_id)); if (!t) return null; const tArtists = artistsByTrackId.get(String(t.id)) || []; const tPrimary = tArtists.find((a) => a.isPrimary) || tArtists[0]; const tFeatured = tArtists.filter((a) => !a.isPrimary && a.name).map((a) => a.name); const artistStr = tFeatured.length > 0 ? `${tPrimary?.name || artistName} (feat. ${tFeatured.join(", ")})` : (tPrimary?.name || artistName); return { id: String(t.id), slug: String(t.slug || t.id), title: String(t.title), artist: artistStr, duration: Number(t.duration_ms || 0) / 1000, trackNumber: Number(rt.track_number || t.track_number || 0), artworkUrl: t.artwork_url || "", previewUrl: t.preview_url || null, appleMusicId: readAppleMusicCatalogId(t), appleMusicCatalogId: readAppleMusicCatalogId(t) }; }).filter(Boolean);
      } else {
        const { data: tracks } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, track_number, artwork_url, preview_url, metadata").eq("release_id", releaseId).order("track_number", { ascending: true });
        trackList = (tracks ?? []).map((t: any) => ({ id: String(t.id), slug: String(t.slug || t.id), title: String(t.title), artist: artistName, duration: Number(t.duration_ms || 0) / 1000, trackNumber: t.track_number || 0, artworkUrl: t.artwork_url || "", previewUrl: t.preview_url || null }));
      }
      let releaseChartStats = null;
      if (trackList.length > 0) {
        const releaseTrackIds = trackList.map((t: any) => String(t.id));
        const { data: releaseChartEntries } = await supabase.from("wk_chart_entries_v2").select("canonical_track_id, rank").in("canonical_track_id", releaseTrackIds);
        if (releaseChartEntries && releaseChartEntries.length > 0) {
          const allRanks = releaseChartEntries.map((e: any) => Number(e.rank || 0)).filter((r: number) => r > 0);
          const entriesByTrack = new Map<string, number>();
          for (const e of releaseChartEntries) { const tid = String(e.canonical_track_id); entriesByTrack.set(tid, (entriesByTrack.get(tid) || 0) + 1); }
          releaseChartStats = { totalChartAppearances: releaseChartEntries.length, topPeakPosition: allRanks.length > 0 ? Math.min(...allRanks) : null, totalWeeksOnChart: Math.max(...Array.from(entriesByTrack.values()), 0) };
        }
      }
      const allFeaturedArtists = [...releaseFeaturedSeen.values()].filter(a => a.name);
      const { data: label } = release.label_id ? await supabase.from("registry_labels").select("id, slug, name, country_code").eq("id", String(release.label_id)).maybeSingle() : { data: null };
      const totalDuration = trackList.reduce((sum: number, tr: any) => sum + (Number(tr.duration) || 0), 0);
      const labelName = label?.name || String(releaseMeta.record_label || releaseMeta.wp_label || "Independent");
      let description = release.description || "";
      if (!description || description.trim().length === 0) { const rType = releaseTypeLabel(String(release.release_type || "album")); const niceDate = formatDateNicely(String(release.release_date || "")); const yearOnly = release.release_date ? String(release.release_date).split("-")[0] : ""; let desc = release.title + " is " + articleize(rType) + " by " + artistName; if (niceDate && niceDate !== yearOnly) desc += ", released on " + niceDate; else if (yearOnly) desc += ", released in " + yearOnly; if (labelName && labelName !== "Independent" && labelName !== "Unknown") desc += " through " + labelName; desc += "."; description = desc; try { await supabase.from("registry_releases").update({ description }).eq("id", releaseId); } catch { /* ignore */ } }
      data = { release: { id: releaseId, slug: String(release.slug), title: String(release.title), artist: artistName, year: release.release_date ? String(release.release_date).split("-")[0] : "", releaseDate: release.release_date || "", releaseType: String(release.release_type || "album"), labelName, labelSlug: label?.slug || "", artworkUrl: release.artwork_url || "", trackCount: trackList.length, tracks: trackList, totalDuration, description, featuredArtists: allFeaturedArtists, chartStats: releaseChartStats, metadata: { ...releaseMeta, wpLabel: releaseMeta.wp_label || null, wpDistributor: releaseMeta.wp_distributor || null, wpWriters: releaseMeta.wp_writers || null, wpProducers: releaseMeta.wp_producers || null } } };
    }

    else if (path === "/releases" || path === "/releases/") {
      const { data: releases } = await supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, status, description").in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(200);
      const labelIds = (releases ?? []).map((r: any) => r.label_id).filter(Boolean).map(String);
      const { data: labels } = labelIds.length > 0 ? await supabase.from("registry_labels").select("id, name").in("id", [...new Set(labelIds)]) : { data: [] };
      const labelMap = new Map((labels ?? []).map((l: any) => [String(l.id), String(l.name)]));
      data = { releases: (releases ?? []).map((r: any) => ({ id: String(r.id), slug: String(r.slug), title: String(r.title), artist: labelMap.get(String(r.label_id)) || "Independent", year: r.release_date ? String(r.release_date).split("-")[0] : "", releaseType: String(r.release_type || "album"), labelName: labelMap.get(String(r.label_id)) || "Independent", artworkUrl: r.artwork_url || "", trackCount: 0, description: r.description || "" })) };
    }

    else if (path.startsWith("/genres/")) { const gSlug = path.replace(/^\/genres\//, "").replace(/\/$/, ""); const { data: genre } = await supabase.from("registry_genres").select("id, slug, name, description, status").eq("slug", gSlug).eq("status", "active").maybeSingle(); if (!genre) return jsonResponse({ data: null }, origin, 404); const { data: artistGenreRows } = await supabase.from("wk_import_staging_records").select("mapped_record").eq("target_entity", "artist_genres").eq("target_status", "ready").filter("mapped_record->>genre_slug", "eq", gSlug); const artistSlugsFromStaging = [...new Set((artistGenreRows ?? []).map((r: any) => { const mr = (r.mapped_record || {}) as Record<string, unknown>; return String(mr.artist_slug || ""); }).filter(Boolean))]; let registryArtists: any[] = []; if (artistSlugsFromStaging.length > 0) { const { data: regArtists } = await supabase.from("registry_artists").select("slug, display_name, public_image_url").in("slug", artistSlugsFromStaging).eq("status", "active").limit(18); registryArtists = regArtists ?? []; } let topTracks: any[] = []; if (artistSlugsFromStaging.length > 0) { const { data: entries } = await supabase.from("wk_chart_entries_v2").select("track_slug, track_title, artist_name, artwork_url, rank").in("artist_slug", artistSlugsFromStaging).order("rank", { ascending: true }).limit(24); topTracks = entries ?? []; } const { data: relatedGenres } = await supabase.from("registry_genres").select("slug, name").eq("status", "active").neq("slug", gSlug).limit(8); data = { genre: { id: String(genre.id), slug: String(genre.slug), name: String(genre.name), description: genre.description || null }, artists: registryArtists.map((a: any) => ({ slug: String(a.slug), name: String(a.display_name), imageUrl: a.public_image_url || "" })), topTracks: topTracks.map((t: any) => ({ slug: String(t.track_slug), title: String(t.track_title), artistName: String(t.artist_name), artworkUrl: t.artwork_url || "", peakRank: Number(t.rank) })), relatedGenres: (relatedGenres ?? []).map((g: any) => ({ slug: String(g.slug), name: String(g.name) })) }; }

    else if (path === "/genres" || path === "/genres/") { const { data: genres } = await supabase.from("registry_genres").select("id, slug, name, description, status").eq("status", "active").order("name", { ascending: true }); const { data: artistGenreAll } = await supabase.from("wk_import_staging_records").select("mapped_record").eq("target_entity", "artist_genres").eq("target_status", "ready"); const genreArtistCounts = new Map(); const genreRepresentatives = new Map(); for (const r of (artistGenreAll ?? [])) { const mr = (r.mapped_record || {}) as Record<string, unknown>; const gs = String(mr.genre_slug || ""); const artistName2 = String(mr.artist_slug || "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()); if (gs) { genreArtistCounts.set(gs, (genreArtistCounts.get(gs) || 0) + 1); const existing = genreRepresentatives.get(gs) || []; if (existing.length < 4) existing.push(artistName2); genreRepresentatives.set(gs, existing); } } data = { genres: (genres ?? []).map((g: any) => { const gs = String(g.slug); return { id: String(g.id), slug: gs, name: String(g.name), artistCount: genreArtistCounts.get(gs) || 0, trackCount: 0, representativeArtists: genreRepresentatives.get(gs) || [] }; }) }; }

    else if (path.startsWith("/labels/")) { const lSlug = path.replace(/^\/labels\//, "").replace(/\/$/, ""); const { data: label } = await supabase.from("registry_labels").select("id, slug, name, description, country_code, status").eq("slug", lSlug).eq("status", "active").maybeSingle(); if (!label) return jsonResponse({ data: null }, origin, 404); const labelId = String(label.id); const labelName = String(label.name); const [byLabelId, byMeta] = await Promise.all([supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata").eq("label_id", labelId).in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(50), supabase.from("registry_releases").select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata").filter("metadata->>record_label", "eq", labelName).in("status", ["active", "draft"]).order("release_date", { ascending: false }).limit(50)]); const seen = new Set<string>(); const releases: any[] = []; for (const row of [...(byLabelId.data ?? []), ...(byMeta.data ?? [])]) { const id = String(row.id); if (!seen.has(id)) { seen.add(id); releases.push(row); } } const releaseIds = releases.map((r: any) => String(r.id)); const { data: tracks } = releaseIds.length > 0 ? await supabase.from("registry_tracks").select("id, release_id, title, slug").in("release_id", releaseIds) : { data: [] }; const releaseTrackCount = new Map<string, number>(); for (const t of (tracks ?? [])) { const rid = String(t.release_id); releaseTrackCount.set(rid, (releaseTrackCount.get(rid) || 0) + 1); } const artistForRelease = new Map<string, string>(); if (releaseIds.length > 0) { const { data: relArtists } = await supabase.from("registry_release_artists").select("release_id, artist_name_text, is_primary").in("release_id", releaseIds).eq("status", "active").eq("is_primary", true); for (const ra of (relArtists ?? [])) { artistForRelease.set(String(ra.release_id), String(ra.artist_name_text || "")); } } const rosterMap = new Map<string, { slug: string; name: string; artworkUrl: string }>(); if (releaseIds.length > 0) { const { data: allReleaseArtists } = await supabase.from("registry_release_artists").select("artist_slug, artist_name_text, artist_id, release_id").in("release_id", releaseIds).eq("status", "active"); for (const ra of (allReleaseArtists ?? [])) { const aSlug = String(ra.artist_slug || ""); if (aSlug && !rosterMap.has(aSlug)) { rosterMap.set(aSlug, { slug: aSlug, name: String(ra.artist_name_text || aSlug), artworkUrl: "" }); } } } const rosterSlugs = [...rosterMap.keys()]; if (rosterSlugs.length > 0) { const { data: rosterArtists } = await supabase.from("registry_artists").select("slug, public_image_url").in("slug", rosterSlugs).eq("status", "active"); for (const ra of (rosterArtists ?? [])) { const entry = rosterMap.get(String(ra.slug)); if (entry) entry.artworkUrl = ra.public_image_url || ""; } } const { data: relatedLabels } = await supabase.from("registry_labels").select("slug, name").eq("status", "active").neq("slug", lSlug).limit(8); data = { label: { id: String(label.id), slug: String(label.slug), name: String(label.name), description: label.description || null, countryCode: label.country_code || null }, roster: [...rosterMap.values()], releases: releases.map((r: any) => ({ slug: String(r.slug), title: String(r.title), releaseDate: r.release_date || "", releaseType: String(r.release_type || "album"), artworkUrl: r.artwork_url || "", trackCount: releaseTrackCount.get(String(r.id)) || 0, artistName: artistForRelease.get(String(r.id)) || "" })), relatedLabels: (relatedLabels ?? []).map((g: any) => ({ slug: String(g.slug), name: String(g.name) })) }; }

    else if (path === "/labels" || path === "/labels/") { const { data: labels } = await supabase.from("registry_labels").select("id, slug, name, country_code, description, status").eq("status", "active").order("name", { ascending: true }).limit(500); data = { labels: (labels ?? []).map((l: any) => ({ id: String(l.id), slug: String(l.slug), name: String(l.name), country: l.country_code || null, logoUrl: null, artistCount: 0, releaseCount: 0, featuredArtists: [], isFeatured: false, description: l.description || null })) }; }

    else if (path.startsWith("/tracks/")) {
      const tSegments = path.replace(/^\/tracks\//, "").split("/").filter(Boolean);
      const trackSlug = tSegments[tSegments.length - 1] || "";
      const urlArtistSlug = tSegments.length > 1 ? tSegments[0] : null;
      let track: any = null;
      const isIsrcLookup = trackSlug.toLowerCase().startsWith("isrc:");
      if (isIsrcLookup) { const isrc = trackSlug.slice(5); const { data: byIsrc } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, isrc, explicit, track_number, disc_number, release_id, metadata, status, preview_url").eq("isrc", isrc).eq("status", "active").order("slug", { ascending: true }).limit(1); track = byIsrc && byIsrc.length > 0 ? byIsrc[0] : null; }
      else { const { data: bySlug } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, isrc, explicit, track_number, disc_number, release_id, metadata, status, preview_url").eq("slug", trackSlug).maybeSingle(); track = bySlug; }

      // v15: Chart-entry fallback — tracks not yet in registry can still have pages
      // The chart pipeline stores slugs with spaces (e.g. "baddies need love"), 
      // but the URL arrives with hyphens ("baddies-need-love"). We need to match both.
      if (!track && !isIsrcLookup) {
        const withSpaces = trackSlug.replace(/-/g, " ");
        const { data: chartEntries } = await supabase.from("wk_chart_entries_v2")
          .select("track_title, track_slug, artist_name, artist_slug, artwork_url, rank, previous_rank, movement, edition_id, total_score, release_date")
          .or(`track_slug.eq.${trackSlug},track_slug.eq.${withSpaces}`)
          .order("rank", { ascending: true })
          .limit(50);
        if (chartEntries && chartEntries.length > 0) {
          const firstEntry = chartEntries[0] as any;
          const allRanks = chartEntries.map((e: any) => Number(e.rank || 0)).filter((r: number) => r > 0);
          const peakRankChart = allRanks.length > 0 ? Math.min(...allRanks) : null;
          const chartHistoryNorm = allRanks.filter((r: number, i: number) => allRanks.indexOf(r) === i).slice(0, 52);
          const artistNames = String(firstEntry.artist_name || "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const artistSlugsArr = String(firstEntry.artist_slug || "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const primaryArtistName = artistNames[0] || "Unknown";
          const primaryArtistSlug = artistSlugsArr[0] || "";
          const artistsWithRolesChart = artistNames.map((name: string, index: number) => ({
            name,
            slug: artistSlugsArr[index] || "",
            isPrimary: index === 0,
            isFeatured: index > 0,
            creditOrder: index,
            role: index === 0 ? "primary" : "featured",
          }));
          const bestEntry = chartEntries[0] as any;
          const prevRankChart = bestEntry?.previous_rank != null ? Number(bestEntry.previous_rank) : null;
          const rawMovementChart = String(bestEntry?.movement || "").toLowerCase();
          let movementChart = ["up", "down", "new", "same"].includes(rawMovementChart) ? rawMovementChart : "same";
          let movementAmountChart = 0;
          const currRank = Number(bestEntry?.rank || 0);
          if (bestEntry) {
            if (!rawMovementChart) {
              if (!prevRankChart || prevRankChart <= 0) movementChart = "new";
              else if (currRank > 0 && currRank < prevRankChart) { movementChart = "up"; movementAmountChart = prevRankChart - currRank; }
              else if (currRank > 0 && currRank > prevRankChart) { movementChart = "down"; movementAmountChart = currRank - prevRankChart; }
            } else if (prevRankChart && currRank > 0) {
              movementAmountChart = Math.abs(prevRankChart - currRank);
            }
          }
          const editionIds = [...new Set((chartEntries as any[]).map((e: any) => String(e.edition_id)).filter(Boolean))];
          let editionMetaBySlug = new Map<string, { editionLabel: string; familySlug: string }>();
          let editionLabelsAll: string[] = [];
          if (editionIds.length > 0) {
            const { data: editionRows } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, program_id").in("edition_slug", editionIds);
            const programIds = [...new Set((editionRows ?? []).map((e: any) => String(e.program_id)).filter(Boolean))];
            if (programIds.length > 0) {
              const { data: programRows } = await supabase.from("wk_chart_programs_v2").select("id, public_slug").in("id", programIds);
              const publicSlugByProgram = new Map((programRows ?? []).map((p: any) => [String(p.id), String(p.public_slug)]));
              for (const ed of (editionRows ?? [])) {
                editionMetaBySlug.set(String(ed.edition_slug), { editionLabel: String(ed.edition_label || ed.edition_slug || ""), familySlug: publicSlugByProgram.get(String(ed.program_id)) || "" });
              }
            }
            const { data: editionRowsRaw } = await supabase.from("wk_chart_editions_v2").select("id, edition_label").in("id", editionIds);
            const elm2 = new Map((editionRowsRaw ?? []).map((e: any) => [String(e.id), String(e.edition_label || "")]));
            editionLabelsAll = [...new Set((chartEntries as any[]).map((e: any) => elm2.get(String(e.edition_id)) || "").filter(Boolean))];
          }
          const chartAppearancesData = (chartEntries as any[]).map((e: any) => {
            const m = editionMetaBySlug.get(String(e.edition_id));
            return { editionSlug: String(e.edition_id || ""), editionLabel: m?.editionLabel || String(e.edition_id || ""), familySlug: m?.familySlug || "", date: "", rank: Number(e.rank || 0), previousRank: e.previous_rank != null ? Number(e.previous_rank) : null, movement: String(e.movement || "same") };
          });
          const firstChartedDate = chartEntries.length > 0 ? (chartEntries[0] as any).release_date || "" : "";
          return jsonResponse({
            data: {
              track: { id: `chart-${trackSlug}`, slug: trackSlug, title: String(firstEntry.track_title || ""), durationMs: 0, artworkUrl: firstEntry.artwork_url || "", isrc: null, explicit: false, trackNumber: 0, discNumber: 0, metadata: {}, status: "active", previewUrl: null },
              artists: artistsWithRolesChart,
              artist: { slug: primaryArtistSlug, name: primaryArtistName, imageUrl: firstEntry.artwork_url || "" },
              release: null,
              label: null,
              genres: [],
              chartHistory: chartHistoryNorm,
              chartAppearances: chartAppearancesData,
              chartAppearanceCount: chartAppearancesData.length,
              peakRank: peakRankChart,
              weeksOnChart: chartEntries.length,
              currentRank: bestEntry ? Number(bestEntry.rank) : null,
              previousRank: prevRankChart,
              movement: movementChart,
              movementAmount: movementAmountChart,
              previewUrl: null,
              firstChartedDate,
              editionLabels: editionLabelsAll,
              sourceProviders: [],
            }
          }, origin);
        }
      }

      if (!track) return jsonResponse({ data: null }, origin, 404);
      if (urlArtistSlug && !isIsrcLookup) { const { data: trackArtist } = await supabase.from("registry_track_artists").select("artist_slug").eq("track_id", String(track.id)).eq("artist_slug", urlArtistSlug).eq("status", "active").maybeSingle(); if (!trackArtist) return jsonResponse({ data: null, meta: { reason: "track_not_found_for_artist" } }, origin, 404); }
      const trackId = String(track.id);

      let releaseMembership: any = track.release_id
        ? {
            release_id: String(track.release_id),
            track_number: Number(track.track_number || 0),
            disc_number: Number(track.disc_number || 1),
          }
        : null;

      if (!releaseMembership) {
        const { data: membershipRows } = await supabase
          .from("registry_release_tracks")
          .select("release_id, track_number, disc_number")
          .eq("track_id", trackId)
          .order("disc_number", { ascending: true })
          .order("track_number", { ascending: true })
          .limit(20);

        if (membershipRows && membershipRows.length > 0) {
          const candidateReleaseIds = [...new Set(membershipRows.map((row: any) => String(row.release_id)).filter(Boolean))];
          const { data: candidateReleases } = candidateReleaseIds.length > 0
            ? await supabase
                .from("registry_releases")
                .select("id, release_type, release_date, status")
                .in("id", candidateReleaseIds)
                .in("status", ["active", "draft"])
            : { data: [] };

          const releaseById = new Map((candidateReleases ?? []).map((releaseRow: any) => [String(releaseRow.id), releaseRow]));
          const longFormTypes = new Set(["album", "ep", "compilation", "mixtape", "soundtrack", "deluxe"]);

          const rankedMemberships = membershipRows
            .map((row: any) => ({
              row,
              release: releaseById.get(String(row.release_id)),
            }))
            .filter((item: any) => item.release)
            .sort((a: any, b: any) => {
              const aType = String(a.release.release_type || "").toLowerCase();
              const bType = String(b.release.release_type || "").toLowerCase();
              const aLongForm = longFormTypes.has(aType) ? 0 : 1;
              const bLongForm = longFormTypes.has(bType) ? 0 : 1;
              if (aLongForm !== bLongForm) return aLongForm - bLongForm;

              const aDate = new Date(String(a.release.release_date || "1900-01-01")).getTime();
              const bDate = new Date(String(b.release.release_date || "1900-01-01")).getTime();
              return bDate - aDate;
            });

          releaseMembership = rankedMemberships[0]?.row || membershipRows[0] || null;
        }
      }

      const releaseIdFromMembership = releaseMembership?.release_id ? String(releaseMembership.release_id) : "";
      const { data: release } = releaseIdFromMembership
        ? await supabase
            .from("registry_releases")
            .select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata")
            .eq("id", releaseIdFromMembership)
            .maybeSingle()
        : { data: null };
      const { data: label } = release && release.label_id ? await supabase.from("registry_labels").select("slug, name, country_code").eq("id", String(release.label_id)).maybeSingle() : { data: null };
      const { data: trackArtists } = await supabase.from("registry_track_artists").select("artist_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order, role").eq("track_id", trackId).eq("status", "active").order("credit_order", { ascending: true });
      const releaseTrackCountResult = releaseIdFromMembership ? await supabase.from("registry_release_tracks").select("id", { count: "exact", head: true }).eq("release_id", releaseIdFromMembership) : { count: 0 };

      let releaseTracks: any[] = [];
      if (release) {
        const releaseId = String(release.id);
        const { data: relTrackRows } = await supabase.from("registry_release_tracks").select("track_id, track_number, disc_number").eq("release_id", releaseId).order("track_number", { ascending: true });
        if (relTrackRows && relTrackRows.length > 0) {
          const relTrackIds = relTrackRows.map((rt: any) => String(rt.track_id));
          const { data: relTracks } = await supabase.from("registry_tracks").select("id, slug, title, duration_ms, artwork_url, preview_url").in("id", relTrackIds).eq("status", "active");
          const trackLookup = new Map((relTracks ?? []).map((t: any) => [String(t.id), t]));
          const { data: relTrackArtists } = await supabase.from("registry_track_artists").select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order").in("track_id", relTrackIds).eq("status", "active").order("credit_order", { ascending: true });
          const artistsByTrack = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean }>>();
          for (const ta of (relTrackArtists ?? [])) { const tid = String(ta.track_id); if (!artistsByTrack.has(tid)) artistsByTrack.set(tid, []); artistsByTrack.get(tid)!.push({ name: String(ta.artist_name_text || ta.artist_slug || ""), slug: String(ta.artist_slug || ""), isPrimary: Boolean(ta.is_primary), isFeatured: Boolean(ta.is_featured) }); }
          const { data: relPrimaryArtist } = await supabase.from("registry_release_artists").select("artist_name_text, artist_slug").eq("release_id", releaseId).eq("is_primary", true).eq("status", "active").maybeSingle();
          const fallbackArtistName = relPrimaryArtist?.artist_name_text || "";
          const fallbackArtistSlug = relPrimaryArtist?.artist_slug || "";
          releaseTracks = relTrackRows.map((rt: any) => {
            const t = trackLookup.get(String(rt.track_id));
            if (!t) return null;
            const tArtists = artistsByTrack.get(String(t.id)) || [];
            const releasePrimary = tArtists.find((a: any) => a.slug === fallbackArtistSlug && a.isPrimary);
            const firstPrimary = tArtists.find((a: any) => a.isPrimary);
            const firstArtist = tArtists[0];
            const primaryArtist = releasePrimary || firstPrimary || firstArtist;
            const featuredArtists = tArtists.filter((a: any) => a.slug !== (primaryArtist?.slug || "")).map((a: any) => a.name).filter(Boolean);
            const artistStr = featuredArtists.length > 0 ? `${primaryArtist?.name || fallbackArtistName || "Unknown"} (feat. ${featuredArtists.join(", ")})` : (primaryArtist?.name || fallbackArtistName || "Unknown");
            const durationSeconds = t.duration_ms ? Math.round(Number(t.duration_ms) / 1000) : 0;
            return { id: String(t.id), slug: String(t.slug || t.id), title: String(t.title || ""), artist: artistStr, duration: durationSeconds, trackNumber: Number(rt.track_number || 0), artworkUrl: t.artwork_url || "", previewUrl: t.preview_url || undefined };
          }).filter(Boolean);
        }
      }

      const trackMeta = (track.metadata || {}) as Record<string, unknown>;
      const genres2: string[] = Array.isArray(trackMeta.genres) ? (trackMeta.genres as string[]).map(String) : [];
      const { data: chartEntriesList } = await supabase.from("wk_chart_entries_v2").select("edition_id, rank, previous_rank, movement, track_title, artist_name, artwork_url").eq("canonical_track_id", trackId).order("rank", { ascending: true });
      const editionIds = [...new Set((chartEntriesList ?? []).map((e: any) => String(e.edition_id)).filter(Boolean))];
      let editionMetaBySlug = new Map<string, { editionLabel: string; familySlug: string }>();
      if (editionIds.length > 0) { const { data: editionRows } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, program_id").in("edition_slug", editionIds); const programIds = [...new Set((editionRows ?? []).map((e: any) => String(e.program_id)).filter(Boolean))]; if (programIds.length > 0) { const { data: programRows } = await supabase.from("wk_chart_programs_v2").select("id, public_slug").in("id", programIds); const publicSlugByProgram = new Map((programRows ?? []).map((p: any) => [String(p.id), String(p.public_slug)])); for (const ed of (editionRows ?? [])) { editionMetaBySlug.set(String(ed.edition_slug), { editionLabel: String(ed.edition_label || ed.edition_slug || ""), familySlug: publicSlugByProgram.get(String(ed.program_id)) || "" }); } } }
      let editionLabelsAll: string[] = [];
      if (chartEntriesList && chartEntriesList.length > 0) { const editionIdsArr = [...new Set((chartEntriesList as any[]).map((e: any) => String(e.edition_id)).filter(Boolean))]; if (editionIdsArr.length > 0) { const { data: editionRowsRaw } = await supabase.from("wk_chart_editions_v2").select("id, edition_label").in("id", editionIdsArr); const elm2 = new Map((editionRowsRaw ?? []).map((e: any) => [String(e.id), String(e.edition_label || "")])); editionLabelsAll = [...new Set((chartEntriesList as any[]).map((e: any) => elm2.get(String(e.edition_id)) || "").filter(Boolean))]; } }
      const { data: historyEntries } = await supabase.from("wk_chart_entries_v2").select("rank, edition_id, movement, release_date").eq("canonical_track_id", trackId).order("rank", { ascending: true });
      let peakRank: number | null = null; if (historyEntries && historyEntries.length > 0) peakRank = Math.min(...historyEntries.map((e: any) => Number(e.rank || 0)).filter((r: number) => r > 0));
      const bestEntry = chartEntriesList && chartEntriesList.length > 0 ? chartEntriesList[0] : null;
      const chartHistory = (historyEntries ?? []).map((e: any) => Number(e.rank || 0));
      const chartHistoryUnique = chartHistory.filter((r: number, i: number) => chartHistory.indexOf(r) === i).slice(0, 52);
      const allChartAppearances = (chartEntriesList ?? []).map((e: any) => { const meta = editionMetaBySlug.get(String(e.edition_id)); return { editionSlug: String(e.edition_id || ""), editionLabel: meta?.editionLabel || String(e.edition_id || ""), familySlug: meta?.familySlug || "", date: "", rank: Number(e.rank || 0), previousRank: e.previous_rank != null ? Number(e.previous_rank) : null, movement: String(e.movement || "same") }; });
      const prevRank = bestEntry && bestEntry.previous_rank != null ? Number(bestEntry.previous_rank) : null;
      const rawMovement = String(bestEntry?.movement || "").toLowerCase();
      let movement: string = ["up", "down", "new", "same"].includes(rawMovement) ? rawMovement : "same";
      let movementAmount = 0; if (bestEntry) { const curr = Number(bestEntry.rank || 0); if (!rawMovement) { if (!prevRank || prevRank <= 0) movement = "new"; else if (curr > 0 && curr < prevRank) { movement = "up"; movementAmount = prevRank - curr; } else if (curr > 0 && curr > prevRank) { movement = "down"; movementAmount = curr - prevRank; } } else if (prevRank && curr > 0) movementAmount = Math.abs(prevRank - curr); }
      const firstChartedDate = (historyEntries ?? []).length > 0 ? (historyEntries as any[])[0].release_date || "" : "";
      const sourceProviders: string[] = Array.isArray(trackMeta.source_providers) ? (trackMeta.source_providers as string[]) : [];
      const artistsWithRoles = (trackArtists ?? []).map((ta: any) => ({ name: String(ta.artist_name_text || ta.artist_slug || ""), slug: String(ta.artist_slug || ""), isPrimary: Boolean(ta.is_primary), isFeatured: Boolean(ta.is_featured), creditOrder: Number(ta.credit_order || 0), role: String(ta.role || "primary") }));
      data = { track: { id: String(track.id), slug: String(track.slug), title: String(track.title), durationMs: track.duration_ms || 0, artworkUrl: track.artwork_url || "", isrc: track.isrc || null, explicit: track.explicit || false, trackNumber: Number(releaseMembership?.track_number || track.track_number || 0), discNumber: Number(releaseMembership?.disc_number || track.disc_number || 0), metadata: track.metadata || {}, status: track.status || "active", previewUrl: track.preview_url || null, appleMusicId: readAppleMusicCatalogId(track), appleMusicCatalogId: readAppleMusicCatalogId(track) }, artists: artistsWithRoles, artist: artistsWithRoles.length > 0 ? { slug: artistsWithRoles[0].slug, name: artistsWithRoles[0].name, imageUrl: bestEntry?.artwork_url || "" } : { slug: "", name: "Unknown", imageUrl: "" }, release: release ? { id: String(release.id), slug: String(release.slug), title: String(release.title), releaseDate: release.release_date || "", releaseType: String(release.release_type || "single"), artworkUrl: release.artwork_url || "", trackCount: releaseTrackCountResult.count || releaseTracks.length || 0, labelName: label?.name || "", labelSlug: label?.slug || "", tracks: releaseTracks } : null, label: label ? { slug: String(label.slug), name: String(label.name), countryCode: label.country_code || null } : null, genres: genres2, chartHistory: chartHistoryUnique, chartAppearances: allChartAppearances, chartAppearanceCount: allChartAppearances.length, peakRank, weeksOnChart: historyEntries ? historyEntries.length : 0, currentRank: bestEntry ? Number(bestEntry.rank) : null, previousRank: prevRank, movement, movementAmount, previewUrl: track.preview_url || null, appleMusicId: readAppleMusicCatalogId(track), appleMusicCatalogId: readAppleMusicCatalogId(track), firstChartedDate, editionLabels: editionLabelsAll, sourceProviders };
    }

    else if (path === "/charts" || path === "/charts/") { const { data: programs } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, source_family_slug, series_slug, market_slug, chart_size, default_period_type, default_methodology_version").order("public_label", { ascending: true }); const programsWithEditions = await Promise.all((programs ?? []).map(async (p: any) => { const { data: editions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", p.id).eq("status", "published").order("edition_date", { ascending: false }); const latestEdition = editions && editions.length > 0 ? { id: String(editions[0].edition_slug), slug: String(editions[0].edition_slug), label: String(editions[0].edition_label), date: String(editions[0].edition_date), periodStart: editions[0].period_start || null, periodEnd: editions[0].period_end || null, entryCount: editions[0].entry_count || 0 } : null; return { id: String(p.id), publicSlug: String(p.public_slug), publicLabel: String(p.public_label), shortLabel: String(p.public_label), sourceFamilySlug: String(p.source_family_slug || p.public_slug), seriesSlug: String(p.series_slug || ""), seriesLabel: String(p.series_slug || ""), marketSlug: String(p.market_slug || ""), marketLabel: String(p.market_slug || ""), periodType: String(p.default_period_type || "weekly"), methodologyVersion: String(p.default_methodology_version || "legacy-import-v1"), eligibilityRulesVersion: "legacy-import-v1", latestEdition, archive: (editions ?? []).map((e: any) => ({ id: String(e.edition_slug), slug: String(e.edition_slug), label: String(e.edition_label), date: String(e.edition_date), periodStart: e.period_start || null, periodEnd: e.period_end || null, entryCount: e.entry_count || 0 })) }; })); data = { programs: programsWithEditions }; }

    else if (path.startsWith("/charts/")) {
      const chartPath = path.replace(/^\/charts\//, ""); const segments = chartPath.split("/").filter(Boolean);
      if (segments.length === 1) { const cslug = segments[0]; const { data: program } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, source_family_slug, series_slug, market_slug, chart_size, default_period_type, default_methodology_version").eq("public_slug", cslug).maybeSingle(); if (!program) return jsonResponse({ error: "Not found" }, origin, 404); const { data: editions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", program.id).eq("status", "published").order("edition_date", { ascending: false }); const latestEdition = editions && editions.length > 0 ? buildEditionSummary(editions[0]) : null; data = { program: { ...buildProgramSummary(program), latestEdition, archive: (editions ?? []).map((e: any) => buildEditionSummary(e)) } }; }
      else if (segments.length === 2) { const [cslug, target] = segments; const { data: program } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, source_family_slug, series_slug, market_slug, chart_size, default_period_type, default_methodology_version").eq("public_slug", cslug).maybeSingle(); if (!program) return jsonResponse({ error: "Not found" }, origin, 404); if (target === "latest") { const { data: editions } = await supabase.from("wk_chart_editions_v2").select("id, edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", program.id).eq("status", "published").order("edition_date", { ascending: false }).limit(1); if (!editions || editions.length === 0) return jsonResponse({ error: "No editions found" }, origin, 404); const edition = editions[0]; const { data: entries } = await supabase.from("wk_chart_entries_v2").select("id, rank, previous_rank, movement, track_slug, track_title, artist_name, artwork_url, total_score").eq("edition_id", edition.id).order("rank", { ascending: true }).limit(150); data = { program: buildProgramSummary(program), edition: buildEditionSummary(edition), entries: (entries ?? []).map(buildEntryItem) }; } else { const { data: edition } = await supabase.from("wk_chart_editions_v2").select("id, edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status").eq("program_id", program.id).eq("edition_slug", target).maybeSingle(); if (!edition) return jsonResponse({ error: "Edition not found" }, origin, 404); data = { program: buildProgramSummary(program), edition: buildEditionSummary(edition) }; } }
      else if (segments.length === 3 && segments[2] === "entries") { const [cslug, editionSlug] = segments; const { data: program } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, series_slug, market_slug, source_family_slug").eq("public_slug", cslug).maybeSingle(); if (!program) return jsonResponse({ error: "Not found" }, origin, 404); const { data: edition } = await supabase.from("wk_chart_editions_v2").select("id, edition_slug, edition_label, edition_date, entry_count, status").eq("program_id", program.id).eq("edition_slug", editionSlug).maybeSingle(); if (!edition) return jsonResponse({ error: "Edition not found" }, origin, 404); const { data: entries } = await supabase.from("wk_chart_entries_v2").select("id, rank, previous_rank, movement, track_slug, track_title, artist_name, artwork_url, total_score").eq("edition_id", edition.id).order("rank", { ascending: true }).limit(150); data = { entries: (entries ?? []).map(buildEntryItem) }; }
      else { return jsonResponse({ error: "Not found" }, origin, 404); }
    }

    else { return jsonResponse({ error: "Not found" }, origin, 404); }

    return jsonResponse({ data }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, origin, 500);
  }
});
