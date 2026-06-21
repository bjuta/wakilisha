import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function parseReleaseTypeFromApple(attrs: Record<string, unknown>): string {
  const isSingle = attrs.isSingle === true;
  const isComplete = attrs.isComplete === true;
  const trackCount = Number(attrs.trackCount ?? 0);
  const name = String(attrs.name ?? "").toLowerCase();
  if (name.includes("ep") || (trackCount >= 2 && trackCount <= 8 && !isComplete)) return "ep";
  if (isSingle || trackCount === 1) return "single";
  return "album";
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "0000-00-00") return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function dedupeSlug(base: string, seen: Set<string>): string {
  if (!seen.has(base)) { seen.add(base); return base; }
  let i = 2;
  while (seen.has(`${base}-${i}`)) i++;
  const s = `${base}-${i}`;
  seen.add(s);
  return s;
}

function artworkUrl(urlTemplate: string, width: number): string {
  return urlTemplate.replace("{w}", String(width)).replace("{h}", String(width));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function splitArtistNames(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/\s*,\s*|\s+&\s+|\s+and\s+|\s+x\s+|\s+\+\s+/i).map((s) => s.trim()).filter(Boolean);
}

function parseFeaturedFromTitle(title: string): string[] {
  if (!title) return [];
  const featured: string[] = [];
  const seen = new Set<string>();

  function addNames(inner: string) {
    const names = splitArtistNames(inner);
    for (const n of names) {
      const key = n.toLowerCase();
      if (!seen.has(key)) { seen.add(key); featured.push(n); }
    }
  }

  const parenMatch = title.match(/\((?:feat\.?|ft\.?|featuring|with|w\/)\s+([^)]+)\)/i);
  if (parenMatch) addNames(parenMatch[1]);

  const bracketMatch = title.match(/\[(?:feat\.?|ft\.?|featuring|with|w\/)\s+([^\]]+)\]/i);
  if (bracketMatch) addNames(bracketMatch[1]);

  const dashMatch = title.match(/\s[-\u2013\u2014]\s*(?:feat\.?|ft\.?|featuring|with|w\/)\s+(.+)$/i);
  if (dashMatch) addNames(dashMatch[1]);

  const xMatch = title.match(/\s+x\s+([A-Z][^,\(\[]+?)(?:\s*[,&]\s*[A-Z][^,\(\[]+?)*\s*$/i);
  if (!xMatch) {
    const xMatch2 = title.match(/\s+x\s+([A-Z][^,\(\[]+)$/i);
    if (xMatch2) addNames(xMatch2[1]);
  } else addNames(xMatch[1]);

  const plusMatch = title.match(/\s+\+\s+([A-Z][^,\(\[]+?)(?:\s*[,&]\s*[A-Z][^,\(\[]+?)*\s*$/i);
  if (!plusMatch) {
    const plusMatch2 = title.match(/\s+\+\s+([A-Z][^,\(\[]+)$/i);
    if (plusMatch2) addNames(plusMatch2[1]);
  } else addNames(plusMatch[1]);

  return featured;
}

async function createAppleMusicToken(teamId: string, keyId: string, privateKeyRaw: string): Promise<string> {
  let key = privateKeyRaw;
  if (key.includes("-----BEGIN PRIVATE KEY-----")) key = key.replace(/-----BEGIN PRIVATE KEY-----/, "");
  if (key.includes("-----END PRIVATE KEY-----")) key = key.replace(/-----END PRIVATE KEY-----/, "");
  key = key.replace(/[\s\n\r\t]/g, "");
  let binaryKey: Uint8Array;
  try { binaryKey = base64ToBytes(key); }
  catch (e) { throw new Error(`Base64 decode failed: ${e instanceof Error ? e.message : String(e)}`); }
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  } catch (e) { throw new Error(`Crypto key import failed: ${e instanceof Error ? e.message : String(e)}`); }
  const token = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: keyId }).setIssuer(teamId).setIssuedAt().setExpirationTime("30m").sign(cryptoKey);
  return token;
}

async function readCredential(db: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data, error } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", key).maybeSingle();
  if (error) throw new Error(`Failed to read credential "${key}": ${error.message}`);
  if (data?.setting_value?.trim()) return data.setting_value.trim();
  const envVal = Deno.env.get(key.toUpperCase());
  return envVal?.trim() || null;
}

interface AppleAlbumSearchResult {
  id: string; type: string;
  attributes: { name: string; artistName: string; artwork?: { url: string; width: number; height: number }; releaseDate?: string; trackCount?: number; isSingle?: boolean; isComplete?: boolean; upc?: string; genreNames?: string[]; url?: string; recordLabel?: string; };
}

interface AppleTrackAttributes {
  name: string; artistName: string; durationInMillis?: number; trackNumber?: number; discNumber?: number; isrc?: string; artwork?: { url: string; width: number; height: number }; contentRating?: string; previews?: Array<{ url: string }>; genreNames?: string[];
}

interface AppleAlbumDetail {
  id: string; type: string;
  attributes: { name: string; artistName: string; artwork?: { url: string; width: number; height: number }; releaseDate?: string; trackCount?: number; isSingle?: boolean; isComplete?: boolean; upc?: string; genreNames?: string[]; url?: string; recordLabel?: string; };
  relationships?: { tracks?: { data: Array<{ id: string; type: string; attributes: AppleTrackAttributes; }>; }; artists?: { data: Array<{ id: string; type: string; attributes: { name: string; url?: string; }; }>; }; };
}

async function searchAlbums(token: string, storefront: string, artistName: string, limit = 50): Promise<AppleAlbumSearchResult[]> {
  const allAlbums: AppleAlbumSearchResult[] = [];
  let offset = 0;
  const pageSize = 25;
  while (offset < limit) {
    const fetchLimit = Math.min(pageSize, limit - offset);
    const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(artistName)}&types=albums&limit=${fetchLimit}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Apple Music search returned ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const albums = data?.results?.albums?.data ?? [];
    if (albums.length === 0) break;
    allAlbums.push(...albums);
    offset += fetchLimit;
    if (albums.length < fetchLimit) break;
  }
  return allAlbums;
}

async function fetchAlbumDetail(token: string, storefront: string, albumId: string): Promise<AppleAlbumDetail | null> {
  const url = `https://api.music.apple.com/v1/catalog/${storefront}/albums/${albumId}?include=tracks,artists`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.[0] ?? json?.data ?? null;
}

async function fetchAlbumsInParallel(token: string, storefront: string, albumIds: string[], concurrency = 8): Promise<{ detail: AppleAlbumDetail; id: string }[]> {
  const results: { detail: AppleAlbumDetail; id: string }[] = [];
  const queue = [...albumIds];
  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      const detail = await fetchAlbumDetail(token, storefront, id);
      if (detail) results.push({ detail, id });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

interface PreviewTrack {
  apple_music_id: string; title: string; track_number: number | null; disc_number: number | null; duration_ms: number | null; duration_display: string; isrc: string | null; artist_name: string; explicit: boolean; preview_url: string | null;
}

interface PreviewAlbum {
  apple_music_id: string; title: string; slug: string; release_type: string; release_date: string | null; upc: string | null; record_label: string | null; genre_names: string[]; artwork_url: string | null; apple_music_url: string | null; track_count: number; tracks: PreviewTrack[]; match_status: "existing" | "new"; existing_release: { id: string; slug: string; title: string; source: string; } | null;
}

interface AdditionalPrimaryArtist {
  artist_id: string;
  artist_slug: string;
  artist_name: string;
}

interface ApplySelection {
  apple_music_id: string;
  action: "merge" | "canonicalize" | "ignore";
  additional_primary_artists?: AdditionalPrimaryArtist[];
}

function isArtistPrimaryForAlbum(albumArtistName: string, currentArtistName: string): boolean {
  const albumArtist = albumArtistName.toLowerCase().trim();
  const currentArtist = currentArtistName.toLowerCase().trim();
  return albumArtist.includes(currentArtist) || currentArtist.includes(albumArtist);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const start = Date.now();
  let stage = "init";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) return new Response(JSON.stringify({ ok: false, error: "Supabase service role key missing. This function requires SERVICE_ROLE_KEY to write registry data." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const db = createClient(supabaseUrl, supabaseKey);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const artistSlug = String(body.artistSlug ?? "").trim();
    if (!artistSlug) return new Response(JSON.stringify({ ok: false, error: "Missing artistSlug" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const mode = String(body.mode ?? "preview").trim();

    stage = "credentials";
    const [teamId, keyId, privateKey, storefrontRaw] = await Promise.all([
      readCredential(db, "apple_music_team_id"), readCredential(db, "apple_music_key_id"),
      readCredential(db, "apple_music_private_key"), readCredential(db, "apple_music_storefront"),
    ]);
    const storefront = storefrontRaw || "ke";
    if (!teamId || !keyId || !privateKey) return new Response(JSON.stringify({ ok: false, error: "Apple Music credentials not configured." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    stage = "artist_lookup";
    const { data: artistRow, error: artistErr } = await db.from("registry_artists").select("id, slug, display_name, metadata").eq("slug", artistSlug).maybeSingle();
    if (artistErr || !artistRow) return new Response(JSON.stringify({ ok: false, error: artistErr ? artistErr.message : `Artist not found: ${artistSlug}` }), { status: artistErr ? 500 : 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const artistId = artistRow.id as string;
    const artistName = artistRow.display_name as string;
    const artistMeta = (artistRow.metadata ?? {}) as Record<string, unknown>;

    stage = "jwt";
    let token: string;
    try { token = await createAppleMusicToken(teamId, keyId, privateKey); }
    catch (err) { return new Response(JSON.stringify({ ok: false, error: "apple_music_jwt_failed", detail: err instanceof Error ? err.message : String(err), stage: "jwt" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    stage = "load_existing";
    const [existingReleasesRes, existingTracksRes, artistReleaseIdsRes] = await Promise.all([
      db.from("registry_releases").select("id, slug, title, metadata").eq("status", "active"),
      db.from("registry_tracks").select("id, slug, isrc"),
      db.from("registry_release_artists").select("release_id").eq("artist_id", artistId).eq("status", "active"),
    ]);
    if (existingReleasesRes.error || existingTracksRes.error || artistReleaseIdsRes.error) return new Response(JSON.stringify({ ok: false, error: "Failed to load existing registry data." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allActiveReleases = existingReleasesRes.data ?? [];

    const existingTrackBySlug = new Map<string, string>();
    const existingTrackByIsrc = new Map<string, string>();
    const existingTrackIdToSlug = new Map<string, string>();
    for (const t of existingTracksRes.data ?? []) {
      const tid = t.id as string;
      existingTrackBySlug.set(t.slug as string, tid);
      existingTrackIdToSlug.set(tid, t.slug as string);
      if (t.isrc && (t.isrc as string).trim()) {
        const normalized = (t.isrc as string).trim().toUpperCase();
        if (!existingTrackByIsrc.has(normalized)) existingTrackByIsrc.set(normalized, tid);
      }
    }

    const { data: existingTrackArtists } = await db.from("registry_track_artists")
      .select("track_id, artist_slug").eq("status", "active");
    const existingTrackArtistSet = new Set<string>(
      (existingTrackArtists ?? []).map((r: { track_id: string; artist_slug: string }) =>
        `${r.track_id}:${r.artist_slug}`
      )
    );

    const artistReleaseIdList = (artistReleaseIdsRes.data ?? []).map((r: { release_id: string }) => r.release_id);
    let existingArtistReleases: Array<{ id: string; slug: string; title: string; metadata: Record<string, unknown> | null }> = [];
    if (artistReleaseIdList.length > 0) existingArtistReleases = allActiveReleases.filter((r) => artistReleaseIdList.includes(r.id));
    const existingArtistReleaseBySlug = new Map(existingArtistReleases.map((r) => [r.slug, r]));

    const existingReleaseByTitle = new Map<string, typeof allActiveReleases[0]>();
    for (const r of allActiveReleases) {
      const key = (r.title as string).toLowerCase().trim();
      if (!existingReleaseByTitle.has(key)) existingReleaseByTitle.set(key, r);
    }

    const existingReleaseSlugs = new Set(allActiveReleases.map((r: { slug: string }) => r.slug));

    if (mode === "preview") {
      stage = "search";
      let searchResults: AppleAlbumSearchResult[];
      try { searchResults = await searchAlbums(token, storefront, artistName, 50); }
      catch (err) { return new Response(JSON.stringify({ ok: false, error: "apple_music_search_failed", detail: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      if (searchResults.length === 0) return new Response(JSON.stringify({ ok: true, mode: "preview", artist: { id: artistId, slug: artistSlug, name: artistName }, storefront, albums_searched: 0, albums_fetched: 0, albums: [], duration_ms: Date.now() - start }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const artistNameLower = artistName.toLowerCase();
      const matchingAlbums = searchResults.filter((a) => {
        const albumArtist = (a.attributes?.artistName ?? "").toLowerCase();
        return albumArtist.includes(artistNameLower) || artistNameLower.includes(albumArtist);
      });

      stage = "fetch_albums";
      const albumIds = matchingAlbums.map((a) => a.id);
      let fetchedResults: { detail: AppleAlbumDetail; id: string }[];
      try { fetchedResults = await fetchAlbumsInParallel(token, storefront, albumIds, 8); }
      catch (err) { return new Response(JSON.stringify({ ok: false, error: "album_fetch_failed", detail: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

      const albumDetails = fetchedResults.map((r) => r.detail);
      const failedIds = albumIds.filter((id) => !fetchedResults.find((r) => r.id === id));

      const previewAlbums: PreviewAlbum[] = albumDetails.map((album) => {
        const attrs = album.attributes ?? {};
        const rawTitle = attrs.name ?? "Unknown Album";
        const rawSlug = slugify(rawTitle);
        const releaseType = parseReleaseTypeFromApple(attrs);
        const releaseDate = parseDate(attrs.releaseDate ?? null);
        const upc = attrs.upc ? String(attrs.upc) : null;
        const recordLabel = attrs.recordLabel ?? null;
        const genreNames = attrs.genreNames ?? [];
        let awUrl: string | null = null;
        if (attrs.artwork?.url) awUrl = artworkUrl(attrs.artwork.url, 800);

        let existingMatch = existingArtistReleaseBySlug.get(rawSlug);
        if (!existingMatch) existingMatch = existingReleaseByTitle.get(rawTitle.toLowerCase().trim());

        const tracksData = album.relationships?.tracks?.data ?? [];
        const previewTracks: PreviewTrack[] = tracksData.map((track) => {
          const tAttrs = track.attributes ?? {};
          return {
            apple_music_id: track.id, title: tAttrs.name ?? "Untitled",
            track_number: tAttrs.trackNumber ?? null, disc_number: tAttrs.discNumber ?? null,
            duration_ms: tAttrs.durationInMillis ?? null, duration_display: formatDuration(tAttrs.durationInMillis ?? 0),
            isrc: tAttrs.isrc ? String(tAttrs.isrc).trim().toUpperCase() : null,
            artist_name: tAttrs.artistName ?? artistName,
            explicit: (tAttrs.contentRating ?? "") === "explicit",
            preview_url: tAttrs.previews?.[0]?.url ?? null,
          };
        });

        return {
          apple_music_id: album.id, title: rawTitle, slug: rawSlug, release_type: releaseType,
          release_date: releaseDate, upc, record_label: recordLabel, genre_names: genreNames,
          artwork_url: awUrl, apple_music_url: attrs.url ?? null, track_count: tracksData.length,
          tracks: previewTracks,
          match_status: existingMatch ? "existing" : "new",
          existing_release: existingMatch ? { id: existingMatch.id, slug: existingMatch.slug, title: existingMatch.title, source: existingMatch.metadata?.source ? String(existingMatch.metadata.source) : "registry" } : null,
        };
      });

      previewAlbums.sort((a, b) => {
        if (a.match_status !== b.match_status) return a.match_status === "existing" ? -1 : 1;
        if (!a.release_date && !b.release_date) return 0;
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return b.release_date.localeCompare(a.release_date);
      });

      return new Response(JSON.stringify({ ok: true, mode: "preview", artist: { id: artistId, slug: artistSlug, name: artistName }, storefront, albums_searched: matchingAlbums.length, albums_fetched: albumDetails.length, albums_failed: failedIds, albums: previewAlbums, duration_ms: Date.now() - start }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "apply") {
      const rawSelected = body.selected_albums;
      if (!Array.isArray(rawSelected) || rawSelected.length === 0) return new Response(JSON.stringify({ ok: false, error: "Missing or empty selected_albums array." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const selections: ApplySelection[] = rawSelected.map((s: unknown) => {
        const item = s as Record<string, unknown>;
        const action = String(item.action ?? "ignore") as ApplySelection["action"];
        const rawAdditional = item.additional_primary_artists;
        const additionalPrimaryArtists: AdditionalPrimaryArtist[] | undefined = Array.isArray(rawAdditional)
          ? rawAdditional.map((a: unknown) => {
            const r = a as Record<string, unknown>;
            return {
              artist_id: String(r.artist_id ?? ""),
              artist_slug: String(r.artist_slug ?? ""),
              artist_name: String(r.artist_name ?? ""),
            };
          }).filter((a) => a.artist_id && a.artist_slug && a.artist_name)
          : undefined;
        return {
          apple_music_id: String(item.apple_music_id ?? ""),
          action,
          additional_primary_artists: additionalPrimaryArtists,
        };
      }).filter((s) => s.apple_music_id && ["merge", "canonicalize", "ignore"].includes(s.action));

      const toProcess = selections.filter((s) => s.action !== "ignore");
      if (toProcess.length === 0) return new Response(JSON.stringify({ ok: true, mode: "apply", summary: { merged: 0, canonicalized: 0, ignored: selections.length, tracks_created: 0, featured_artist_links: 0, errors: [] }, duration_ms: Date.now() - start }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      stage = "fetch_selected";
      const selectedIds = toProcess.map((s) => s.apple_music_id);
      let fetchedResults: { detail: AppleAlbumDetail; id: string }[];
      try { fetchedResults = await fetchAlbumsInParallel(token, storefront, selectedIds, 8); }
      catch (err) { return new Response(JSON.stringify({ ok: false, error: "album_fetch_failed", detail: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

      stage = "load_artists_for_featured";
      const { data: allRegistryArtists } = await db.from("registry_artists")
        .select("id, slug, display_name")
        .eq("status", "active");
      const artistByName = new Map<string, { id: string; slug: string; display_name: string }>();
      const artistBySlug = new Map<string, { id: string; slug: string; display_name: string }>();
      for (const a of (allRegistryArtists ?? [])) {
        const nameKey = ((a.display_name as string) || "").toLowerCase().trim();
        if (nameKey && !artistByName.has(nameKey)) artistByName.set(nameKey, a as { id: string; slug: string; display_name: string });
        artistBySlug.set(a.slug as string, a as { id: string; slug: string; display_name: string });
      }

      const albumById = new Map(fetchedResults.map((r) => [r.id, r.detail]));
      const actionById = new Map(toProcess.map((s) => [s.apple_music_id, s.action]));
      const additionalPrimaryById = new Map<string, AdditionalPrimaryArtist[]>();
      for (const s of toProcess) {
        if (s.additional_primary_artists && s.additional_primary_artists.length > 0) {
          additionalPrimaryById.set(s.apple_music_id, s.additional_primary_artists);
        }
      }

      const seenReleaseSlugs = new Set(existingReleaseSlugs);
      const seenTrackSlugs = new Set(existingTrackBySlug.keys());

      const releaseRows: Record<string, unknown>[] = [];
      const releaseArtistRows: Record<string, unknown>[] = [];
      const trackRows: Record<string, unknown>[] = [];
      const releaseTrackRows: Record<string, unknown>[] = [];
      const trackArtistRows: Record<string, unknown>[] = [];
      const processedReleaseIds = new Set<string>();
      const processedTrackIds = new Set<string>();
      const seenTrackIds = new Set<string>();
      let mergeCount = 0;
      let canonicalizeCount = 0;
      let trackCount = 0;
      let featLinksCreated = 0;

      const artistNameLower = artistName.toLowerCase();

      for (const sel of toProcess) {
        const album = albumById.get(sel.apple_music_id);
        if (!album) continue;
        const action = actionById.get(sel.apple_music_id) || "ignore";
        const attrs = album.attributes ?? {};
        const rawTitle = attrs.name ?? "Unknown Album";
        const rawSlug = slugify(rawTitle);
        const releaseType = parseReleaseTypeFromApple(attrs);
        const releaseDate = parseDate(attrs.releaseDate ?? null);
        const upc = attrs.upc ? String(attrs.upc) : null;

        const albumArtistName = (attrs.artistName ?? "").trim();
        const artistIsAlbumPrimary = isArtistPrimaryForAlbum(albumArtistName, artistName);

        let releaseId: string;
        let releaseSlug: string;
        let releaseAlreadyExists = false;

        const existingBySlug = existingArtistReleaseBySlug.get(rawSlug);
        const existingByTitle = existingReleaseByTitle.get(rawTitle.toLowerCase().trim());
        const existingMatch = existingBySlug || existingByTitle;

        if (action === "merge" || (action === "canonicalize" && existingMatch)) {
          if (existingMatch) {
            releaseId = existingMatch.id;
            releaseSlug = existingMatch.slug;
            mergeCount++;
            releaseAlreadyExists = true;
          } else {
            releaseId = crypto.randomUUID();
            releaseSlug = dedupeSlug(rawSlug, seenReleaseSlugs);
            canonicalizeCount++;
          }
        } else {
          releaseId = crypto.randomUUID();
          releaseSlug = dedupeSlug(rawSlug, seenReleaseSlugs);
          canonicalizeCount++;
        }

        seenReleaseSlugs.add(releaseSlug);
        processedReleaseIds.add(releaseId);

        let awUrl: string | null = null;
        if (attrs.artwork?.url) awUrl = artworkUrl(attrs.artwork.url, 800);

        if (!releaseAlreadyExists) {
          releaseRows.push({
            id: releaseId, slug: releaseSlug, title: rawTitle,
            normalized_title: slugify(rawTitle).replace(/-/g, " "),
            release_type: releaseType, upc, release_date: releaseDate, artwork_url: awUrl, status: "active",
            metadata: { apple_music_album_id: album.id, apple_music_url: attrs.url ?? null, genre_names: attrs.genreNames ?? [], record_label: attrs.recordLabel ?? null, source: "apple_music_ingest", ingested_at: new Date().toISOString() },
          });
        }

        const addedReleaseArtistIds = new Set<string>();

        if (artistIsAlbumPrimary) {
          releaseArtistRows.push({
            release_id: releaseId, artist_id: artistId, artist_slug: artistSlug, artist_name_text: artistName,
            role: "primary_artist", is_primary: true, is_featured: false, credit_order: 1,
            source: "apple_music_ingest", confidence: 90, status: "active",
            metadata: { apple_music_album_id: album.id },
          });
          addedReleaseArtistIds.add(artistId);
        } else {
          releaseArtistRows.push({
            release_id: releaseId, artist_id: artistId, artist_slug: artistSlug, artist_name_text: artistName,
            role: "featured_artist", is_primary: false, is_featured: true, credit_order: 98,
            source: "apple_music_ingest", confidence: 70, status: "active",
            metadata: { apple_music_album_id: album.id, ingested_artist_is_featured: true },
          });
          addedReleaseArtistIds.add(artistId);
        }

        const additionalPrimary = additionalPrimaryById.get(sel.apple_music_id);
        if (additionalPrimary) {
          let order = 2;
          for (const ap of additionalPrimary) {
            releaseArtistRows.push({
              release_id: releaseId,
              artist_id: ap.artist_id,
              artist_slug: ap.artist_slug,
              artist_name_text: ap.artist_name,
              role: "primary_artist",
              is_primary: true,
              is_featured: false,
              credit_order: order,
              source: "apple_music_ingest",
              confidence: 90,
              status: "active",
              metadata: { apple_music_album_id: album.id, admin_selected: true },
            });
            addedReleaseArtistIds.add(ap.artist_id);
            order++;
          }
        }

        const albumArtistsFromApi = album.relationships?.artists?.data ?? [];
        for (let ai = 0; ai < albumArtistsFromApi.length; ai++) {
          const amArtist = albumArtistsFromApi[ai];
          const amName = (amArtist.attributes?.name ?? "").trim();
          if (!amName) continue;
          const amNameKey = amName.toLowerCase().trim();
          const amSlug = slugify(amName);
          const matchedReg = artistByName.get(amNameKey) || artistBySlug.get(amSlug);
          if (amNameKey === artistNameLower || amSlug === artistSlug) continue;
          if (matchedReg && addedReleaseArtistIds.has(matchedReg.id)) continue;
          if (matchedReg) addedReleaseArtistIds.add(matchedReg.id);

          const isAlbumPrimary = isArtistPrimaryForAlbum(albumArtistName, amName);

          releaseArtistRows.push({
            release_id: releaseId,
            artist_id: matchedReg?.id ?? null,
            artist_slug: matchedReg?.slug ?? amSlug,
            artist_name_text: matchedReg?.display_name ?? amName,
            role: isAlbumPrimary ? "primary_artist" : "featured_artist",
            is_primary: isAlbumPrimary,
            is_featured: !isAlbumPrimary,
            credit_order: isAlbumPrimary ? 2 : 99 + ai,
            source: "apple_music_ingest",
            confidence: matchedReg ? 85 : 50,
            status: "active",
            metadata: { apple_music_album_id: album.id, resolved_by: matchedReg ? "name_match" : "text_only" },
          });
        }

        const tracksData = album.relationships?.tracks?.data ?? [];
        for (const track of tracksData) {
          const tAttrs = track.attributes ?? {};
          const trackTitle = tAttrs.name ?? "Untitled";
          const trackIsrc = tAttrs.isrc ? String(tAttrs.isrc).trim().toUpperCase() : null;
          const rawTrackSlug = slugify(trackTitle);
          const discNum = tAttrs.discNumber ?? 1;
          const trackNum = tAttrs.trackNumber ?? null;
          const durationMs = tAttrs.durationInMillis ?? null;
          const explicit = (tAttrs.contentRating ?? "") === "explicit";
          let trackId: string | undefined;
          let trackSlug: string;

          if (trackIsrc) trackId = existingTrackByIsrc.get(trackIsrc);

          if (!trackId) {
            const slugMatchId = existingTrackBySlug.get(rawTrackSlug);
            if (slugMatchId && existingTrackArtistSet.has(`${slugMatchId}:${artistSlug}`)) {
              trackId = slugMatchId;
            }
          }

          if (!trackId) {
            trackId = crypto.randomUUID();
            trackSlug = dedupeSlug(rawTrackSlug, seenTrackSlugs);
            existingTrackBySlug.set(trackSlug, trackId);
            existingTrackIdToSlug.set(trackId, trackSlug);
            if (trackIsrc) existingTrackByIsrc.set(trackIsrc, trackId);
            seenTrackSlugs.add(trackSlug);
          } else {
            trackSlug = existingTrackIdToSlug.get(trackId) ?? rawTrackSlug;
          }
          processedTrackIds.add(trackId);
          trackCount++;
          let trackAwUrl: string | null = null;
          if (tAttrs.artwork?.url) trackAwUrl = artworkUrl(tAttrs.artwork.url, 800);
          else trackAwUrl = awUrl;
          const previewUrl = tAttrs.previews?.[0]?.url ?? null;
          if (!seenTrackIds.has(trackId)) {
            seenTrackIds.add(trackId);
            trackRows.push({
              id: trackId, slug: trackSlug, title: trackTitle,
              normalized_title: slugify(trackTitle).replace(/-/g, " "),
              isrc: trackIsrc, release_id: null, duration_ms: durationMs, explicit,
              track_number: trackNum, disc_number: discNum, artwork_url: trackAwUrl, preview_url: previewUrl, status: "active",
              metadata: { apple_music_track_id: track.id, apple_music_album_id: album.id, source: "apple_music_ingest" },
            });
          }
          releaseTrackRows.push({
            release_id: releaseId, track_id: trackId, disc_number: discNum, track_number: trackNum,
            source: "apple_music_ingest", confidence: 90, status: "active",
            metadata: { apple_music_track_id: track.id, apple_music_album_id: album.id },
          });

          const rawTrackArtistName = (tAttrs.artistName ?? "").trim();
          const trackArtistNames = splitArtistNames(rawTrackArtistName || artistName);
          const seenOnThisTrack = new Set<string>();

          for (const tArtist of trackArtistNames) {
            const taKey = tArtist.toLowerCase().trim();
            const taSlug = slugify(tArtist);

            if (taKey === artistNameLower || taSlug === artistSlug) {
              trackArtistRows.push({
                track_id: trackId, artist_id: artistId, artist_slug: artistSlug, artist_name_text: artistName,
                role: "primary_artist", is_primary: true, is_featured: false, credit_order: 1,
                source: "apple_music_ingest", confidence: 90, status: "active",
                metadata: { apple_music_track_id: track.id, apple_music_album_id: album.id },
              });
              seenOnThisTrack.add(artistSlug);
              continue;
            }

            const matchedArtist = artistByName.get(taKey) || artistBySlug.get(taSlug);
            const resolvedSlug = matchedArtist?.slug ?? taSlug;
            if (seenOnThisTrack.has(resolvedSlug)) continue;
            seenOnThisTrack.add(resolvedSlug);

            trackArtistRows.push({
              track_id: trackId,
              artist_id: matchedArtist?.id ?? null,
              artist_slug: resolvedSlug,
              artist_name_text: matchedArtist?.display_name ?? tArtist,
              role: "featured_artist",
              is_primary: false,
              is_featured: true,
              credit_order: 2 + seenOnThisTrack.size,
              source: "apple_music_ingest",
              confidence: matchedArtist ? 85 : 50,
              status: "active",
              metadata: { apple_music_track_id: track.id, apple_music_album_id: album.id, resolved_by: matchedArtist ? "name_match" : "text_only" },
            });
            featLinksCreated++;
          }

          const featNames = parseFeaturedFromTitle(trackTitle);
          for (let fi = 0; fi < featNames.length; fi++) {
            const featName = featNames[fi];
            const featNameKey = featName.toLowerCase().trim();
            const featSlug = slugify(featName);

            if (featNameKey === artistNameLower || featSlug === artistSlug) continue;
            if (seenOnThisTrack.has(featSlug)) continue;
            seenOnThisTrack.add(featSlug);

            const matchedArtist = artistByName.get(featNameKey) || artistBySlug.get(featSlug);

            trackArtistRows.push({
              track_id: trackId,
              artist_id: matchedArtist?.id ?? null,
              artist_slug: matchedArtist?.slug ?? featSlug,
              artist_name_text: matchedArtist?.display_name ?? featName,
              role: "featured_artist",
              is_primary: false,
              is_featured: true,
              credit_order: 2 + seenOnThisTrack.size,
              source: "apple_music_ingest",
              confidence: matchedArtist ? 85 : 50,
              status: "active",
              metadata: { apple_music_track_id: track.id, apple_music_album_id: album.id, resolved_by: matchedArtist ? "name_match" : "text_only" },
            });
            featLinksCreated++;
          }
        }
      }

      stage = "commit";
      const BATCH = 200;
      const summary = { merged: mergeCount, canonicalized: canonicalizeCount, ignored: selections.filter((s) => s.action === "ignore").length, tracks_created: trackCount, featured_artist_links: featLinksCreated, errors: [] as string[] };

      function chunk<T>(arr: T[], size: number): T[][] { const chunks: T[][] = []; for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size)); return chunks; }

      if (releaseRows.length > 0) {
        for (const batch of chunk(releaseRows, BATCH)) {
          const { error } = await db.from("registry_releases").upsert(batch, { onConflict: "slug", ignoreDuplicates: false });
          if (error) summary.errors.push(`releases: ${error.message}`);
        }
      }

      if (trackRows.length > 0) {
        for (const batch of chunk(trackRows, BATCH)) {
          const { error } = await db.from("registry_tracks").upsert(batch, { onConflict: "id", ignoreDuplicates: false });
          if (error) summary.errors.push(`tracks: ${error.message}`);
        }
      }

      if (releaseArtistRows.length > 0) {
        const releaseArtistDedupeKey = (r: Record<string, unknown>) => {
          if (r.artist_id === null || r.artist_id === undefined) return `${r.release_id}:${r.artist_slug}:${r.role}:${r.credit_order}`;
          return `${r.release_id}:${r.artist_id}:${r.role}:${r.credit_order}`;
        };
        const seenReleaseArtists = new Set<string>();
        const dedupedReleaseArtists = releaseArtistRows.filter((r) => {
          const key = releaseArtistDedupeKey(r);
          if (seenReleaseArtists.has(key)) return false;
          seenReleaseArtists.add(key);
          return true;
        });

        const rIds = [...processedReleaseIds];
        for (const idChunk of chunk(rIds, 100)) {
          await db.from("registry_release_artists").delete().in("release_id", idChunk);
        }
        for (const batch of chunk(dedupedReleaseArtists, BATCH)) {
          const { error } = await db.from("registry_release_artists").insert(batch, { ignoreDuplicates: true });
          if (error) summary.errors.push(`release_artists: ${error.message}`);
        }
      }

      if (releaseTrackRows.length > 0) {
        const releaseTrackDedupeKey = (r: Record<string, unknown>) => `${r.release_id}:${r.track_id}`;
        const seenReleaseTracks = new Set<string>();
        const dedupedReleaseTracks = releaseTrackRows.filter((r) => {
          const key = releaseTrackDedupeKey(r);
          if (seenReleaseTracks.has(key)) return false;
          seenReleaseTracks.add(key);
          return true;
        });

        const rIds = [...processedReleaseIds];
        for (const idChunk of chunk(rIds, 100)) {
          await db.from("registry_release_tracks").delete().in("release_id", idChunk);
        }
        for (const batch of chunk(dedupedReleaseTracks, BATCH)) {
          const { error } = await db.from("registry_release_tracks").insert(batch, { ignoreDuplicates: true });
          if (error) summary.errors.push(`release_tracks: ${error.message}`);
        }
      }

      if (trackArtistRows.length > 0) {
        const trackArtistPrimaryKey = (r: Record<string, unknown>) => {
          if (r.artist_id === null || r.artist_id === undefined) return `null:${r.track_id}:${r.artist_slug}:${r.role}:${r.credit_order}`;
          return `id:${r.track_id}:${r.artist_id}:${r.role}:${r.credit_order}`;
        };
        const seenPrimary = new Set<string>();
        const firstPassDeduped = trackArtistRows.filter((r) => {
          const key = trackArtistPrimaryKey(r);
          if (seenPrimary.has(key)) return false;
          seenPrimary.add(key);
          return true;
        });

        const trackSlugMap = new Map<string, Record<string, unknown>>();
        for (const r of firstPassDeduped) {
          const key = `${r.track_id}:${r.artist_slug}`;
          const existing = trackSlugMap.get(key);
          if (!existing) { trackSlugMap.set(key, r); } else {
            const existingIsPrimary = existing.role === "primary_artist";
            const newIsPrimary = r.role === "primary_artist";
            const existingOrder = Number(existing.credit_order ?? 99);
            const newOrder = Number(r.credit_order ?? 99);
            if ((!existingIsPrimary && newIsPrimary) || (existingIsPrimary === newIsPrimary && newOrder < existingOrder)) {
              trackSlugMap.set(key, r);
            }
          }
        }
        const dedupedTrackArtists = [...trackSlugMap.values()];

        const tIds = [...new Set(dedupedTrackArtists.map((r) => String(r.track_id)))];
        for (const idChunk of chunk(tIds, 100)) {
          const { error: delError } = await db.from("registry_track_artists").delete().in("track_id", idChunk);
          if (delError) summary.errors.push(`track_artists_delete: ${delError.message}`);
        }

        for (const batch of chunk(dedupedTrackArtists, BATCH)) {
          const { error } = await db.from("registry_track_artists").insert(batch);
          if (error) summary.errors.push(`track_artists: ${error.message}`);
        }
      }

      const appleAlbumIds = selections.map((s) => s.apple_music_id);
      await db.from("registry_artists").update({ metadata: { ...artistMeta, apple_music_album_ids: appleAlbumIds, apple_music_discography_ingested_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq("id", artistId);

      return new Response(JSON.stringify({ ok: true, mode: "apply", summary, duration_ms: Date.now() - start }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: `Unknown mode: "${mode}". Use "preview" or "apply".` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: "internal_error", detail: `[${stage}] ${msg.slice(0, 300)}`, stage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});