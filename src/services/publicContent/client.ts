import { deepDecode } from "@/utils/decodeHtmlEntities";
import { withPlaceholderImage } from "@/utils/imagePlaceholders";
import { rewriteWpImageUrl } from "@/services/wpImageRewrite";
import { supabase } from "@/lib/supabase";
import { releaseUrl, slugify } from "@/utils/releaseUrl";

export type PublicStory = {
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  authorSlug?: string;
  date: string;
  readingTime: number;
  heroUrl: string;
};

export type PublicArtist = {
  id: string;
  slug: string;
  name: string;
  country?: string | null;
  imageUrl?: string | null;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  isChartArtist: boolean;
  isRising?: boolean;
  topChartPosition?: number | null;
};

export type PublicRelease = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  year: string;
  releaseType: string;
  labelName: string;
  artworkUrl: string;
  trackCount: number;
  description?: string;
};

export type PublicGenre = {
  id: string;
  slug: string;
  name: string;
  artistCount: number;
  trackCount: number;
  representativeArtists: string[];
};

export type PublicLabel = {
  id: string;
  slug: string;
  name: string;
  country?: string | null;
  logoUrl?: string | null;
  artistCount: number;
  releaseCount: number;
  featuredArtists: string[];
  isFeatured: boolean;
  description?: string | null;
};

export type PublicReleaseDetail = PublicRelease & {
  releaseDate: string;
  labelSlug: string;
  totalDuration: number;
  tracks: Array<{
    id: string;
    slug: string;
    title: string;
    artist: string;
    duration: number;
    trackNumber: number;
    artworkUrl: string;
    previewUrl?: string;
  }>;
  metadata: Record<string, unknown>;
  featuredArtists: Array<{ name: string; slug: string }>;
  chartStats?: {
    totalChartAppearances: number;
    topPeakPosition: number | null;
    totalWeeksOnChart: number;
  } | null;
};

export type PublicArticleDetail = PublicStory & {
  contentHtml: string;
  tags: string[];
  seo?: Record<string, unknown>;
  categories: string[];
};

export type PublicArtistVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  platform: string;
};

export type PublicArtistDetail = PublicArtist & {
  country: string;
  imageUrl: string;
  profileImageUrl?: string;
  isRising: boolean;
  topChartPosition: number | null;
  bio: string;
  fullBio: string;
  artistType: string | null;
  followerCount: number;
  popularity: number;
  spotifyUrl: string;
  instagram: string;
  chartEntries: Array<{
    rank: number;
    title: string;
    artist: string;
    slug: string;
    movement: "up" | "down" | "new" | "same";
    movementAmount: number;
    peakPosition: number;
    weeksOnChart: number;
    artworkUrl: string;
  }>;
  releases: Array<{
    slug: string;
    title: string;
    releaseType: string;
    year: string;
    releaseDate: string;
    trackCount: number;
    artworkUrl: string;
    labelName?: string;
    genres?: string[];
    tracks: Array<{ title: string; duration: string; previewUrl?: string }>;
  }>;
  topSongs: Array<{
    title: string;
    artists: string;
    image: string;
    duration: string;
    songUrl: string;
  }>;
  relatedArtists: Array<{
    slug: string;
    name: string;
    imageUrl: string;
    score?: number;
    sharedTracksAll?: number;
    sharedChartTracks?: number;
    featuresThem?: number;
    theyFeature?: number;
    sharedTitles?: string[];
  }>;
  videos?: PublicArtistVideo[];
};

export type RepairedStory = PublicStory;
export type RepairedArtist = PublicArtist;
export type RepairedRelease = PublicRelease;
export type RepairedGenre = PublicGenre;
export type RepairedLabel = PublicLabel;
export type RepairedReleaseDetail = PublicReleaseDetail;
export type RepairedArticleDetail = PublicArticleDetail;
export type RepairedArtistVideo = PublicArtistVideo;
export type RepairedArtistDetail = PublicArtistDetail;

/* ─── Registry Discography (authoritative source) ─── */

export interface RegistryDiscographyRelease {
  slug: string;
  title: string;
  releaseType: string;
  year: string;
  releaseDate: string;
  trackCount: number;
  artworkUrl: string;
  tracks: Array<{ title: string; duration: string; artists?: string; previewUrl?: string }>;
}

export interface RegistryAppearsOnRelease extends RegistryDiscographyRelease {
  artist: string; // the primary artist of this release (not the page artist)
}

/* ─── Shared cache for edge function response ─── */

const discographyCache = new Map<string, { releases: RegistryDiscographyRelease[]; appearsOn: RegistryAppearsOnRelease[] }>();

async function fetchDiscographyFromEdge(
  artistSlug: string
): Promise<{ releases: RegistryDiscographyRelease[]; appearsOn: RegistryAppearsOnRelease[] }> {
  const cached = discographyCache.get(artistSlug);
  if (cached) return cached;

  const supabaseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "";
  const t = Date.now();
  const resp = await fetch(
    `${supabaseUrl}/functions/v1/public-content-read/artists/${encodeURIComponent(artistSlug)}/discography?t=${t}`,
    {
      headers: {
        Accept: "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    }
  );
  if (!resp.ok) {
    console.warn(`fetchDiscographyFromEdge failed: ${resp.status} ${resp.statusText}`);
    const empty = { releases: [], appearsOn: [] };
    return empty;
  }
  const payload = await resp.json();
  const result = {
    releases: (payload?.releases || []) as RegistryDiscographyRelease[],
    appearsOn: (payload?.appearsOn || []) as RegistryAppearsOnRelease[],
  };
  // Only cache when there's actual data, not empty responses — prevents
  // stale-empty caches from hiding newly ingested discography data.
  if (result.releases.length > 0 || result.appearsOn.length > 0) {
    discographyCache.set(artistSlug, result);
  }
  return result;
}

/** Clear the in-memory discography cache so the public artist page re-fetches
 *  fresh data from the registry edge function. Call this after running the
 *  Apple Music intake to ensure the public profile picks up new releases. */
export function clearDiscographyCache(artistSlug?: string): void {
  if (artistSlug) {
    discographyCache.delete(artistSlug);
  } else {
    discographyCache.clear();
  }
}

export async function getArtistDiscographyFromRegistry(
  artistSlug: string
): Promise<RegistryDiscographyRelease[]> {
  try {
    const data = await fetchDiscographyFromEdge(artistSlug);
    return data.releases;
  } catch {
    return [];
  }
}

export async function getArtistAppearsOn(
  artistSlug: string
): Promise<RegistryAppearsOnRelease[]> {
  try {
    const data = await fetchDiscographyFromEdge(artistSlug);
    return data.appearsOn;
  } catch {
    return [];
  }
}

const API_BASE =
  (import.meta.env.VITE_PUBLIC_API_BASE as string | undefined) ||
  "/api/v1";

type Envelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

type MediaIdentity = {
  id?: string;
  slug?: string;
  name?: string;
  type: "article" | "artist" | "track" | "release" | "label" | "genre";
};

type GenericRow = Record<string, unknown>;

type ReleaseShellRow = {
  id: string;
  release_id: string;
  slug: string;
  title: string;
  primary_artist_name: string | null;
  primary_artist_slug: string | null;
  release_date: string | null;
  track_count: number;
  has_artwork: boolean;
  readiness: string;
  missing: string[] | null;
  shell_route: string | null;
  source_provenance: Record<string, unknown> | null;
  status: string;
  updated_at: string | null;
};

type RegistryMediaAsset = {
  id: string;
  slug: string;
  title: string | null;
  url: string;
  mime_type: string | null;
  media_kind: string | null;
  status: string | null;
  source_kind: string | null;
  source_entity: string | null;
  metadata: Record<string, unknown> | null;
};

async function apiGet<T>(path: string): Promise<T> {
  const base = API_BASE.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WAKILISHA public API ${response.status}: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as Envelope<T> | T;
  const raw = payload && typeof payload === "object" && "data" in payload ? (payload as Envelope<T>).data : (payload as T);
  return deepDecode(raw);
}

async function safeApiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (err) {
    console.warn(err instanceof Error ? err.message : "WAKILISHA public API request failed.");
    return fallback;
  }
}

function textValue(row: GenericRow | null | undefined, keys: string[], fallback = ""): string {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined || typeof value === "object") continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function numberValue(row: GenericRow | null | undefined, keys: string[], fallback = 0): number {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return fallback;
}

function uuidFromRow(row: GenericRow, keys: string[]): string {
  return textValue(row, keys);
}

function image(url: string | null | undefined, identity: MediaIdentity): string {
  const rewritten = rewriteWpImageUrl(url || "");
  return rewritten || withPlaceholderImage(url || "", identity);
}

function generatedReleaseArtwork(title: string, artist: string): string {
  const safeTitle = title.replace(/[<&>]/g, "");
  const safeArtist = artist.replace(/[<&>]/g, "");
  const initials = safeTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("") || "WK";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9f1"/><stop offset="0.55" stop-color="#dfe8d6"/><stop offset="1" stop-color="#7fa64a"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><circle cx="640" cy="160" r="220" fill="#ffffff" opacity="0.24"/><circle cx="160" cy="690" r="260" fill="#000000" opacity="0.1"/><text x="64" y="96" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="800" letter-spacing="10" fill="#30451f">WAKILISHA</text><text x="64" y="402" font-family="Inter,Arial,sans-serif" font-size="150" font-weight="900" fill="#101510">${initials}</text><text x="64" y="610" font-family="Inter,Arial,sans-serif" font-size="46" font-weight="900" fill="#101510">${safeTitle}</text><text x="64" y="674" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="700" fill="#30451f">${safeArtist}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export { releaseUrl, slugify };

function yearFromDate(value: string | null | undefined): string {
  if (!value) return "Unknown year";
  const year = String(value).match(/\d{4}/)?.[0];
  return year || "Unknown year";
}

function releaseTypeFromTrackCount(trackCount: number): string {
  if (trackCount <= 1) return "Single";
  if (trackCount <= 6) return "EP";
  return "Album";
}

function mediaCandidates(slug: string, title: string): string[] {
  const normalizedSlug = slugify(slug || title);
  const normalizedTitle = slugify(title || slug);
  return Array.from(new Set([normalizedSlug, normalizedTitle].filter(Boolean)));
}

function preferMediaAsset(rows: RegistryMediaAsset[]): RegistryMediaAsset | null {
  const activeImages = rows.filter((asset) => asset.status === "active" && asset.media_kind === "image" && asset.url);
  if (!activeImages.length) return null;
  return activeImages.find((asset) => asset.source_kind === "wordpress_database") || activeImages[0];
}

async function getRegistryMediaBySlugs(slugs: string[]): Promise<Map<string, RegistryMediaAsset>> {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (!uniqueSlugs.length) return new Map();

  const { data, error } = await supabase
    .from("registry_media_assets")
    .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, metadata")
    .eq("status", "active")
    .eq("media_kind", "image")
    .in("slug", uniqueSlugs);

  if (error) {
    console.warn(`WAKILISHA registry media lookup failed: ${error.message}`);
    return new Map();
  }

  const decoded = deepDecode((data || []) as RegistryMediaAsset[]);

  const grouped = new Map<string, RegistryMediaAsset[]>();
  for (const asset of decoded) {
    const list = grouped.get(asset.slug) || [];
    list.push(asset);
    grouped.set(asset.slug, list);
  }

  const selected = new Map<string, RegistryMediaAsset>();
  for (const [slug, assets] of grouped) {
    const preferred = preferMediaAsset(assets);
    if (preferred) selected.set(slug, preferred);
  }
  return selected;
}

function mediaUrlFor(candidates: string[], mediaBySlug: Map<string, RegistryMediaAsset>): string {
  for (const candidate of candidates) {
    const asset = mediaBySlug.get(candidate);
    if (asset?.url) return asset.url;
  }
  return "";
}

async function getRegistryTracklist(releaseId: string, fallbackArtist: string): Promise<PublicReleaseDetail["tracks"]> {
  const { data: relationshipRows, error: relationshipError } = await supabase
    .from("registry_release_tracks")
    .select("*")
    .eq("release_id", releaseId);

  if (relationshipError) {
    console.warn(`WAKILISHA registry release track lookup failed: ${relationshipError.message}`);
    return [];
  }

  const relationships = deepDecode(((relationshipRows || []) as GenericRow[]))
    .map((row, index) => ({
      row,
      index,
      trackId: uuidFromRow(row, ["track_id", "registry_track_id"]),
      position: numberValue(row, ["track_number", "position", "sort_order", "display_order", "sequence"], index + 1),
    }))
    .filter((item) => item.trackId);

  if (!relationships.length) return [];

  const trackIds = Array.from(new Set(relationships.map((item) => item.trackId)));
  const { data: trackRows, error: trackError } = await supabase
    .from("registry_tracks")
    .select("*")
    .in("id", trackIds);

  if (trackError) {
    console.warn(`WAKILISHA registry track lookup failed: ${trackError.message}`);
    return [];
  }

  const tracksById = new Map(deepDecode(((trackRows || []) as GenericRow[])).map((track) => [textValue(track, ["id"]), track]));

  // Fetch track artists for featured artist display
  const { data: trackArtistRows } = await supabase
    .from("registry_track_artists")
    .select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order")
    .in("track_id", trackIds)
    .eq("status", "active")
    .order("credit_order", { ascending: true });

  const artistsByTrack = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean }>>();
  for (const ta of (trackArtistRows || [])) {
    if (!artistsByTrack.has(ta.track_id)) artistsByTrack.set(ta.track_id, []);
    artistsByTrack.get(ta.track_id)!.push({
      name: ta.artist_name_text || ta.artist_slug,
      slug: ta.artist_slug || "",
      isPrimary: ta.is_primary,
      isFeatured: ta.is_featured,
    });
  }

  const mediaSlugs: string[] = [];
  for (const relationship of relationships) {
    const track = tracksById.get(relationship.trackId) || {};
    const title = textValue(track, ["title", "name", "display_title", "normalized_title", "slug"], "");
    const slug = textValue(track, ["slug", "normalized_slug"], relationship.trackId);
    mediaSlugs.push(...mediaCandidates(slug, title));
  }
  const mediaBySlug = await getRegistryMediaBySlugs(mediaSlugs);

  return relationships
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((relationship, index) => {
      const track = tracksById.get(relationship.trackId) || {};
      const title = textValue(track, ["title", "name", "display_title", "normalized_title", "slug"], "");
      const slug = textValue(track, ["slug", "normalized_slug"], relationship.trackId);
      const mediaUrl = mediaUrlFor(mediaCandidates(slug, title), mediaBySlug);
      const directArtwork = textValue(track, ["artwork_url", "cover_image_url", "image_url", "thumbnail_url"]);

      // Build artist string with featured artists
      const trackArtists = artistsByTrack.get(relationship.trackId) || [];
      const primaryArtist = trackArtists.find((a) => a.isPrimary) || trackArtists[0];
      const featuredArtists = trackArtists
        .filter((a) => a.slug !== (primaryArtist?.slug || ""))
        .map((a) => a.name)
        .filter(Boolean);
      const artistStr = featuredArtists.length > 0
        ? `${primaryArtist?.name || fallbackArtist} (feat. ${featuredArtists.join(", ")})`
        : (primaryArtist?.name || textValue(track, ["artist", "artist_name", "primary_artist_name", "artists"], fallbackArtist));

      return {
        id: relationship.trackId,
        slug,
        title,
        artist: artistStr,
        duration: numberValue(track, ["duration", "duration_seconds", "length_seconds"], 0),
        trackNumber: relationship.position || index + 1,
        artworkUrl: mediaUrl || image(directArtwork, {
          id: relationship.trackId,
          slug,
          name: title,
          type: "track",
        }) || generatedReleaseArtwork(title, artistStr),
        previewUrl: textValue(track, ["preview_url"]) || undefined,
      };
    })
    .filter((track) => track.title);
}

function mapShellToRelease(
  shell: ReleaseShellRow,
  tracks: PublicReleaseDetail["tracks"] = [],
  releaseArtworkUrl = "",
  featuredArtists: Array<{ name: string; slug: string }> = [],
  labelNameOverride?: string,
  labelSlugOverride?: string,
): PublicReleaseDetail {
  const artist = shell.primary_artist_name || "Unknown artist";
  const trackCount = tracks.length || Number(shell.track_count || 0);
  const releaseType = releaseTypeFromTrackCount(trackCount);
  const artworkUrl = releaseArtworkUrl || tracks.find((track) => !track.artworkUrl.startsWith("data:image/svg+xml"))?.artworkUrl || generatedReleaseArtwork(shell.title, artist);
  const totalDuration = tracks.reduce((sum, track) => sum + Number(track.duration || 0), 0) || trackCount * 180;

  return {
    id: shell.release_id,
    slug: shell.slug,
    title: shell.title,
    artist,
    year: yearFromDate(shell.release_date),
    releaseType,
    labelName: labelNameOverride || "WAKILISHA Registry",
    artworkUrl,
    trackCount,
    description: `${shell.title} is a ${releaseType.toLowerCase()} by ${artist}, surfaced from the WAKILISHA canonical registry.`,
    releaseDate: shell.release_date || "",
    labelSlug: labelSlugOverride || "wakilisha-registry",
    totalDuration,
    tracks,
    metadata: {
      source: "registry_release_shells",
      releaseId: shell.release_id,
      readiness: shell.readiness,
      missing: shell.missing || [],
      shellRoute: shell.shell_route,
      sourceProvenance: shell.source_provenance || {},
      updatedAt: shell.updated_at,
      tracklistSource: tracks.length ? "registry_release_tracks" : "shell_only",
      artworkSource: releaseArtworkUrl ? "registry_media_assets" : tracks.some((track) => !track.artworkUrl.startsWith("data:image/svg+xml")) ? "track_registry_media_assets" : "generated_placeholder",
    },
    featuredArtists,
  };
}

async function getReleaseFromShell(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
  // The shell slug may be stored as the combined "artistSlug--releaseSlug"
  // (e.g. "bensoul--the-lion-of-sudah") or just the plain release slug.
  const combinedSlug = `${artistSlug}--${releaseSlug}`;
  const slugCandidates = releaseSlug !== combinedSlug ? [releaseSlug, combinedSlug] : [releaseSlug];

  for (const candidateSlug of slugCandidates) {
    const { data, error } = await supabase
      .from("registry_release_shells")
      .select("id, release_id, slug, title, primary_artist_name, primary_artist_slug, release_date, track_count, has_artwork, readiness, missing, shell_route, source_provenance, status, updated_at")
      .in("status", ["ready", "canonicalized"])
      .eq("slug", candidateSlug)
      .eq("primary_artist_slug", artistSlug)
      .maybeSingle();

    if (error) {
      console.warn(`WAKILISHA release shell lookup failed: ${error.message}`);
      continue;
    }

    if (data) {
      const shell = deepDecode(data as ReleaseShellRow);
      const tracks = await getRegistryTracklist(shell.release_id, shell.primary_artist_name || "Unknown artist");
      const releaseMedia = await getRegistryMediaBySlugs(mediaCandidates(shell.slug, shell.title));
      const releaseArtworkUrl = mediaUrlFor(mediaCandidates(shell.slug, shell.title), releaseMedia);

      // Resolve label from registry_releases via the shell's release_id
      let resolvedLabelName: string | undefined;
      let resolvedLabelSlug: string | undefined;
      if (shell.release_id) {
        const { data: releaseRow } = await supabase
          .from("registry_releases")
          .select("label_id, metadata")
          .eq("id", shell.release_id)
          .maybeSingle();
        if (releaseRow?.label_id) {
          const { data: labelRow } = await supabase
            .from("registry_labels")
            .select("slug, name")
            .eq("id", String(releaseRow.label_id))
            .maybeSingle();
          if (labelRow) {
            resolvedLabelName = String(labelRow.name);
            resolvedLabelSlug = String(labelRow.slug);
          }
        }
        // Fallback: use metadata.record_label when label_id is null
        if (!resolvedLabelName && releaseRow?.metadata) {
          const shellMeta = releaseRow.metadata as Record<string, unknown>;
          if (shellMeta.record_label) {
            resolvedLabelName = String(shellMeta.record_label);
            resolvedLabelSlug = slugify(resolvedLabelName);
          }
        }
      }

      // Aggregate featured artists from track-level data
      const featuredArtists = await aggregateFeaturedArtists(shell.release_id);

      return mapShellToRelease(shell, tracks, releaseArtworkUrl, featuredArtists, resolvedLabelName, resolvedLabelSlug);
    }
  }

  return null;
}

/** Collect unique featured artists across all tracks of a release. */
async function aggregateFeaturedArtists(
  releaseId: string
): Promise<Array<{ name: string; slug: string }>> {
  const seen = new Map<string, { name: string; slug: string }>();

  // 1. Check release-level featured artists first (explicitly flagged)
  const { data: releaseArtists } = await supabase
    .from("registry_release_artists")
    .select("artist_name_text, artist_slug, is_featured, is_primary")
    .eq("release_id", releaseId)
    .eq("status", "active");

  // Get the primary artist slug to exclude from featured list
  const primaryReleaseArtist = (releaseArtists || []).find((ra) => ra.is_primary);
  const primarySlug = primaryReleaseArtist?.artist_slug || "";

  // Collect all non-primary release artists
  for (const ra of (releaseArtists || [])) {
    if (ra.is_primary) continue;
    const key = ra.artist_slug || ra.artist_name_text;
    if (key && key !== primarySlug && !seen.has(key)) {
      seen.set(key, { name: ra.artist_name_text || ra.artist_slug, slug: ra.artist_slug || "" });
    }
  }

  // 2. Aggregate explicitly is_featured=true track-level artists
  const { data: trackRelations } = await supabase
    .from("registry_release_tracks")
    .select("track_id")
    .eq("release_id", releaseId);

  const trackIds = (trackRelations || []).map((rt) => rt.track_id);
  if (trackIds.length > 0) {
    const { data: trackArtists } = await supabase
      .from("registry_track_artists")
      .select("artist_name_text, artist_slug, is_primary, is_featured")
      .in("track_id", trackIds)
      .eq("status", "active")
      .eq("is_featured", true);

    for (const ta of (trackArtists || [])) {
      if (!ta.artist_slug || ta.artist_slug === primarySlug) continue;
      const key = ta.artist_slug || ta.artist_name_text;
      if (key && !seen.has(key)) {
        seen.set(key, { name: ta.artist_name_text || ta.artist_slug, slug: ta.artist_slug || "" });
      }
    }
  }

  return Array.from(seen.values());
}

/** Extract unique featured artists from track artist rows (in-memory aggregation). */
function aggregateFeaturedFromTrackArtists(
  trackArtistRows: GenericRow[] | null,
  primaryArtistSlug: string
): Array<{ name: string; slug: string }> {
  const seen = new Map<string, { name: string; slug: string }>();
  for (const ta of (trackArtistRows || [])) {
    // Only include artists explicitly flagged as is_featured=true
    if (!ta.is_featured) continue;
    if (!ta.artist_slug || ta.artist_slug === primaryArtistSlug) continue;
    const key = ta.artist_slug || ta.artist_name_text;
    if (key && !seen.has(key)) {
      seen.set(key, {
        name: ta.artist_name_text || ta.artist_slug,
        slug: ta.artist_slug || "",
      });
    }
  }
  return Array.from(seen.values());
}

async function listReleasesFromShells(): Promise<PublicRelease[]> {
  const { data, error } = await supabase
    .from("registry_release_shells")
    .select("id, release_id, slug, title, primary_artist_name, primary_artist_slug, release_date, track_count, has_artwork, readiness, missing, shell_route, source_provenance, status, updated_at")
    .in("status", ["ready", "canonicalized"])
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn(`WAKILISHA release shell list failed: ${error.message}`);
    return [];
  }

  const shells = deepDecode((data || []) as ReleaseShellRow[]);
  const mediaBySlug = await getRegistryMediaBySlugs(shells.flatMap((shell) => mediaCandidates(shell.slug, shell.title)));

  return shells.map((shell) => {
    const release = mapShellToRelease(shell, [], mediaUrlFor(mediaCandidates(shell.slug, shell.title), mediaBySlug));
    return {
      id: release.id,
      slug: release.slug,
      title: release.title,
      artist: release.artist,
      year: release.year,
      releaseType: release.releaseType,
      labelName: release.labelName,
      artworkUrl: release.artworkUrl,
      trackCount: release.trackCount,
      description: release.description,
    };
  });
}

export interface PaginatedReleasesResult {
  releases: PublicRelease[];
  totalCount: number;
}

export interface ReleasePaginatedParams {
  page: number;
  pageSize: number;
  typeFilter?: string;   // "Album" | "EP" | "Single" | undefined (All)
  yearFilter?: string;
  artistFilter?: string;
  search?: string;
  sortKey?: string;      // "newest" | "updated" | "artist" | "title"
}

export async function listReleasesPaginated(params: ReleasePaginatedParams): Promise<PaginatedReleasesResult> {
  const { page, pageSize, typeFilter, yearFilter, artistFilter, search, sortKey } = params;

  // Check if shells table has any data (cheap head query)
  const { count: shellCount } = await supabase
    .from("registry_release_shells")
    .select("id", { count: "exact", head: true })
    .in("status", ["ready", "canonicalized"]);

  const hasShells = (shellCount ?? 0) > 0;

  if (!hasShells) {
    // Fallback: load from API and paginate client-side
    const allReleases = await listReleases();
    let filtered = allReleases;

    if (typeFilter === "Single") {
      filtered = filtered.filter((r) => r.trackCount <= 1);
    } else if (typeFilter === "EP") {
      filtered = filtered.filter((r) => r.trackCount >= 2 && r.trackCount <= 6);
    } else if (typeFilter === "Album") {
      filtered = filtered.filter((r) => r.trackCount >= 7);
    }

    if (yearFilter && yearFilter !== "All") {
      filtered = filtered.filter((r) => r.year === yearFilter || r.year.includes(yearFilter));
    }

    if (artistFilter && artistFilter !== "All") {
      filtered = filtered.filter((r) => r.artist === artistFilter);
    }

    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter((r) =>
        r.title.toLowerCase().includes(term) ||
        r.artist.toLowerCase().includes(term) ||
        r.labelName?.toLowerCase().includes(term)
      );
    }

    if (sortKey === "artist") {
      filtered.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortKey === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // newest / updated — sort by year descending
      filtered.sort((a, b) => {
        const ay = parseInt(a.year, 10) || 0;
        const by = parseInt(b.year, 10) || 0;
        return by - ay;
      });
    }

    const totalCount = filtered.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const releases = filtered.slice(from, to);

    return { releases, totalCount };
  }

  // Shells exist — use DB-level pagination
  let query = supabase
    .from("registry_release_shells")
    .select("id, release_id, slug, title, primary_artist_name, primary_artist_slug, release_date, track_count, has_artwork, readiness, missing, shell_route, source_provenance, status, updated_at", { count: "exact" })
    .in("status", ["ready", "canonicalized"]);

  // Type filter via track_count
  if (typeFilter === "Single") {
    query = query.lte("track_count", 1);
  } else if (typeFilter === "EP") {
    query = query.gte("track_count", 2).lte("track_count", 6);
  } else if (typeFilter === "Album") {
    query = query.gte("track_count", 7);
  }

  // Year filter
  if (yearFilter && yearFilter !== "All") {
    const y = parseInt(yearFilter, 10);
    if (!isNaN(y)) {
      query = query.gte("release_date", `${y}-01-01`).lt("release_date", `${y + 1}-01-01`);
    }
  }

  // Artist filter
  if (artistFilter && artistFilter !== "All") {
    query = query.eq("primary_artist_name", artistFilter);
  }

  // Search
  if (search) {
    const term = search.replace(/%/g, "").trim();
    if (term) {
      query = query.or(`title.ilike.%${term}%,primary_artist_name.ilike.%${term}%`);
    }
  }

  // Sort
  const sortColumn =
    sortKey === "updated" ? "updated_at" :
    sortKey === "artist" ? "primary_artist_name" :
    sortKey === "title" ? "title" :
    "release_date";
  const sortDir = (sortKey === "artist" || sortKey === "title") ? "asc" : "desc";
  query = query.order(sortColumn, { ascending: sortDir === "asc" });

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.warn(`WAKILISHA paginated release list failed: ${error.message}`);
    return { releases: [], totalCount: 0 };
  }

  const shells = deepDecode((data || []) as ReleaseShellRow[]);
  const mediaBySlug = await getRegistryMediaBySlugs(
    shells.flatMap((shell) => mediaCandidates(shell.slug, shell.title))
  );

  const totalCount = count ?? 0;

  const releases = shells.map((shell) => {
    const release = mapShellToRelease(shell, [], mediaUrlFor(mediaCandidates(shell.slug, shell.title), mediaBySlug));
    return {
      id: release.id,
      slug: release.slug,
      title: release.title,
      artist: release.artist,
      year: release.year,
      releaseType: release.releaseType,
      labelName: release.labelName,
      artworkUrl: release.artworkUrl,
      trackCount: release.trackCount,
      description: release.description,
    };
  });

  return { releases, totalCount };
}

export interface ReleaseCatalogStats {
  total: number;
  albums: number;
  eps: number;
  singles: number;
}

export async function getReleaseCatalogStats(): Promise<ReleaseCatalogStats> {
  // Check if shells table has data
  const { count: shellCount } = await supabase
    .from("registry_release_shells")
    .select("id", { count: "exact", head: true })
    .in("status", ["ready", "canonicalized"]);

  const hasShells = (shellCount ?? 0) > 0;

  if (!hasShells) {
    // Fallback: compute stats from API data
    const allReleases = await listReleases();
    const total = allReleases.length;
    const singles = allReleases.filter((r) => r.trackCount <= 1).length;
    const eps = allReleases.filter((r) => r.trackCount >= 2 && r.trackCount <= 6).length;
    const albums = allReleases.filter((r) => r.trackCount >= 7).length;
    return { total, albums, eps, singles };
  }

  const { data, error } = await supabase
    .from("registry_release_shells")
    .select("track_count")
    .in("status", ["ready", "canonicalized"]);

  if (error) {
    console.warn(`WAKILISHA release stats failed: ${error.message}`);
    return { total: 0, albums: 0, eps: 0, singles: 0 };
  }

  const rows = (data || []) as Array<{ track_count: number }>;
  const total = rows.length;
  const singles = rows.filter((r) => r.track_count <= 1).length;
  const eps = rows.filter((r) => r.track_count >= 2 && r.track_count <= 6).length;
  const albums = rows.filter((r) => r.track_count >= 7).length;

  return { total, albums, eps, singles };
}

export async function getReleaseFilterArtists(limit = 30): Promise<string[]> {
  // Check if shells table has data
  const { count: shellCount } = await supabase
    .from("registry_release_shells")
    .select("id", { count: "exact", head: true })
    .in("status", ["ready", "canonicalized"]);

  const hasShells = (shellCount ?? 0) > 0;

  if (!hasShells) {
    // Fallback: extract artists from API data
    const allReleases = await listReleases();
    const seen = new Set<string>();
    const artists: string[] = [];
    for (const release of allReleases) {
      if (!release.artist) continue;
      if (!seen.has(release.artist)) {
        seen.add(release.artist);
        artists.push(release.artist);
        if (artists.length >= limit) break;
      }
    }
    return artists.sort((a, b) => a.localeCompare(b));
  }

  const { data, error } = await supabase
    .from("registry_release_shells")
    .select("primary_artist_name")
    .in("status", ["ready", "canonicalized"])
    .not("primary_artist_name", "is", null)
    .order("primary_artist_name", { ascending: true });

  if (error) {
    console.warn(`WAKILISHA release artists filter failed: ${error.message}`);
    return [];
  }

  const seen = new Set<string>();
  const artists: string[] = [];
  for (const row of (data || []) as Array<{ primary_artist_name: string }>) {
    if (!row.primary_artist_name) continue;
    if (!seen.has(row.primary_artist_name)) {
      seen.add(row.primary_artist_name);
      artists.push(row.primary_artist_name);
      if (artists.length >= limit) break;
    }
  }
  return artists;
}

export async function getReleaseFilterYears(): Promise<string[]> {
  // Check if shells table has data
  const { count: shellCount } = await supabase
    .from("registry_release_shells")
    .select("id", { count: "exact", head: true })
    .in("status", ["ready", "canonicalized"]);

  const hasShells = (shellCount ?? 0) > 0;

  if (!hasShells) {
    // Fallback: extract years from API data
    const allReleases = await listReleases();
    const years = new Set<string>();
    for (const release of allReleases) {
      const y = (release.year || "").match(/\d{4}/)?.[0];
      if (y) years.add(y);
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }

  const { data, error } = await supabase
    .from("registry_release_shells")
    .select("release_date")
    .in("status", ["ready", "canonicalized"])
    .not("release_date", "is", null);

  if (error) {
    console.warn(`WAKILISHA release years filter failed: ${error.message}`);
    return [];
  }

  const years = new Set<string>();
  for (const row of (data || []) as Array<{ release_date: string }>) {
    const y = (row.release_date || "").match(/\d{4}/)?.[0];
    if (y) years.add(y);
  }
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

export async function listMagazineStories(): Promise<PublicStory[]> {
  const result = await safeApiGet<{ stories: PublicStory[] }>("/magazine?limit=500", { stories: [] });
  return result.stories.map((story) => ({
    ...story,
    heroUrl: image(story.heroUrl, { id: story.id, slug: story.slug, name: story.title, type: "article" }),
  }));
}

export async function getArticle(slug: string): Promise<PublicArticleDetail | null> {
  const result = await safeApiGet<{ article: PublicArticleDetail | null }>(`/magazine/${slug}`, { article: null });
  if (!result.article) return null;
  return {
    ...result.article,
    heroUrl: image(result.article.heroUrl, { id: result.article.id, slug: result.article.slug, name: result.article.title, type: "article" }),
  };
}

export async function listArtists(): Promise<PublicArtist[]> {
  const result = await safeApiGet<{ artists: PublicArtist[] }>("/artists?limit=500", { artists: [] });
  return result.artists.map((artist) => ({
    ...artist,
    imageUrl: image(artist.imageUrl, { id: artist.id, slug: artist.slug, name: artist.name, type: "artist" }),
  }));
}

export async function getArtist(slug: string): Promise<PublicArtistDetail | null> {
  const result = await safeApiGet<{ artist: PublicArtistDetail | null }>(`/artists/${slug}`, { artist: null });
  if (!result.artist) return null;
  const artist = result.artist;
  return {
    ...artist,
    imageUrl: image(artist.imageUrl, { id: artist.id, slug: artist.slug, name: artist.name, type: "artist" }),
    profileImageUrl: image(artist.profileImageUrl ?? artist.imageUrl, { id: artist.id, slug: artist.slug, name: artist.name, type: "artist" }),
    chartEntries: (artist.chartEntries || []).map((entry) => ({
      ...entry,
      artworkUrl: image(entry.artworkUrl, { slug: entry.slug, name: entry.title, type: "track" }),
    })),
    releases: (artist.releases || []).map((release) => ({
      ...release,
      artworkUrl: image(release.artworkUrl, { slug: release.slug, name: release.title, type: "release" }),
    })),
    topSongs: (artist.topSongs || []).map((song) => ({
      ...song,
      image: image(song.image, { slug: song.songUrl, name: song.title, type: "track" }),
    })),
    relatedArtists: (artist.relatedArtists || []).map((related) => ({
      ...related,
      imageUrl: image(related.imageUrl, { slug: related.slug, name: related.name, type: "artist" }),
    })),
    videos: artist.videos?.map((video) => ({
      ...video,
      thumbnail: image(video.thumbnail, { id: video.id, slug: video.url, name: video.title, type: "track" }),
    })),
  };
}

export async function listReleases(): Promise<PublicRelease[]> {
  const shellReleases = await listReleasesFromShells();
  if (shellReleases.length) return shellReleases;

  const result = await safeApiGet<{ releases: PublicRelease[] }>("/releases?limit=500", { releases: [] });
  return result.releases.map((release) => ({
    ...release,
    artworkUrl: image(release.artworkUrl, { id: release.id, slug: release.slug, name: release.title, type: "release" }),
  }));
}

async function getReleaseFromRegistry(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
  const combinedSlug = `${artistSlug}--${releaseSlug}`;
  const slugCandidates = releaseSlug !== combinedSlug ? [releaseSlug, combinedSlug] : [releaseSlug];

  let releaseRow: GenericRow | null = null;
  for (const candidateSlug of slugCandidates) {
    const { data } = await supabase
      .from("registry_releases")
      .select("id, slug, title, release_type, release_date, artwork_url, label_id, description, metadata")
      .eq("slug", candidateSlug)
      .eq("status", "active")
      .maybeSingle();
    if (data) { releaseRow = data; break; }
  }

  if (!releaseRow) return null;

  const releaseId = releaseRow.id;

  const { data: releaseArtistRows } = await supabase
    .from("registry_release_artists")
    .select("artist_name_text, artist_slug, is_primary, is_featured")
    .eq("release_id", releaseId)
    .eq("status", "active");

  const primaryReleaseArtist = (releaseArtistRows || []).find((ra) => ra.is_primary);
  const fallbackArtist = primaryReleaseArtist?.artist_name_text || "";
  const fallbackArtistSlug = primaryReleaseArtist?.artist_slug || artistSlug;

  const { data: releaseTrackRows } = await supabase
    .from("registry_release_tracks")
    .select("track_id, track_number, disc_number")
    .eq("release_id", releaseId)
    .order("track_number", { ascending: true });

  const trackIds = (releaseTrackRows || []).map((rt) => rt.track_id);

  if (trackIds.length === 0) return null;

  const { data: trackRows } = await supabase
    .from("registry_tracks")
    .select("id, slug, title, duration_ms, artwork_url, preview_url")
    .in("id", trackIds)
    .eq("status", "active");

  const tracksById = new Map((trackRows || []).map((t) => [t.id, t]));

  const { data: trackArtistRows } = await supabase
    .from("registry_track_artists")
    .select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order")
    .in("track_id", trackIds)
    .eq("status", "active")
    .order("credit_order", { ascending: true });

  const artistsByTrack = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean }>>();
  for (const ta of (trackArtistRows || [])) {
    if (!artistsByTrack.has(ta.track_id)) artistsByTrack.set(ta.track_id, []);
    artistsByTrack.get(ta.track_id)!.push({
      name: ta.artist_name_text || ta.artist_slug,
      slug: ta.artist_slug || "",
      isPrimary: ta.is_primary,
      isFeatured: ta.is_featured,
    });
  }

  const tracks: PublicReleaseDetail["tracks"] = (releaseTrackRows || [])
    .map((rt, index) => {
      const track = tracksById.get(rt.track_id);
      if (!track) return null;

      const trackArtists = artistsByTrack.get(rt.track_id) || [];

      const releasePrimaryArtist = trackArtists.find(
        (a) => a.slug === fallbackArtistSlug && a.isPrimary
      );
      const firstPrimaryArtist = trackArtists.find((a) => a.isPrimary);
      const firstArtist = trackArtists[0];
      const primaryArtist = releasePrimaryArtist || firstPrimaryArtist || firstArtist;

      const featuredArtists = trackArtists
        .filter((a) => a.slug !== (primaryArtist?.slug || ""))
        .map((a) => a.name)
        .filter(Boolean);

      const artistStr = featuredArtists.length > 0
        ? `${primaryArtist?.name || fallbackArtist || "Unknown"} (feat. ${featuredArtists.join(", ")})`
        : (primaryArtist?.name || fallbackArtist || "Unknown");

      const durationSeconds = track.duration_ms ? Math.round(track.duration_ms / 1000) : 0;

      return {
        id: track.id,
        slug: track.slug || rt.track_id,
        title: track.title,
        artist: artistStr,
        duration: durationSeconds,
        trackNumber: rt.track_number || index + 1,
        artworkUrl: track.artwork_url || "",
        previewUrl: track.preview_url || undefined,
      };
    })
    .filter(Boolean) as PublicReleaseDetail["tracks"];

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const trackCount = tracks.length;
  const releaseType = releaseTypeFromTrackCount(trackCount);

  const releaseDate = releaseRow.release_date || "";
  const year = yearFromDate(releaseDate);

  // Resolve the actual label name + slug from registry_labels
  let resolvedLabelName = "Independent";
  let resolvedLabelSlug = "";
  const releaseMeta = (releaseRow.metadata || {}) as Record<string, unknown>;
  if (releaseRow.label_id) {
    const { data: labelRow } = await supabase
      .from("registry_labels")
      .select("slug, name")
      .eq("id", String(releaseRow.label_id))
      .maybeSingle();
    if (labelRow) {
      resolvedLabelName = String(labelRow.name || "Independent");
      resolvedLabelSlug = String(labelRow.slug || "");
    }
  }
  // Fallback: use metadata.record_label when label_id is null
  if (resolvedLabelName === "Independent" && releaseMeta.record_label) {
    resolvedLabelName = String(releaseMeta.record_label);
    resolvedLabelSlug = slugify(resolvedLabelName);
  }

  return {
    id: releaseRow.id,
    slug: releaseRow.slug,
    title: releaseRow.title,
    artist: fallbackArtist || "Unknown artist",
    year,
    releaseType,
    labelName: resolvedLabelName,
    artworkUrl: releaseRow.artwork_url || "",
    trackCount,
    description: releaseRow.description || `${releaseRow.title} is a ${releaseType.toLowerCase()} by ${fallbackArtist || "Unknown artist"}, from the WAKILISHA canonical registry.`,
    releaseDate,
    labelSlug: resolvedLabelSlug,
    totalDuration,
    tracks,
    metadata: {
      source: "registry_releases",
      releaseId: releaseRow.id,
      tracklistSource: "registry_release_tracks",
      artworkSource: releaseRow.artwork_url ? "registry_releases" : "generated",
    },
    featuredArtists: aggregateFeaturedFromTrackArtists(trackArtistRows, fallbackArtistSlug),
  };
}

export async function getRelease(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
  // Try registry first (most authoritative) — even without tracks, use it
  const registryRelease = await getReleaseFromRegistry(artistSlug, releaseSlug);
  if (registryRelease && registryRelease.tracks.length > 0) return registryRelease;

  // Try shell as authoritative fallback
  const shellRelease = await getReleaseFromShell(artistSlug, releaseSlug);
  if (shellRelease && shellRelease.tracks.length > 0) return shellRelease;

  // If registry or shell returned data but without tracks, still use it
  if (registryRelease) return registryRelease;
  if (shellRelease) return shellRelease;

  // Last resort: fall back to public API
  const result = await safeApiGet<{ release: PublicReleaseDetail | null }>(`/releases/${artistSlug}/${releaseSlug}`, { release: null });
  if (!result.release) return null;
  return {
    ...result.release,
    artworkUrl: image(result.release.artworkUrl, { id: result.release.id, slug: result.release.slug, name: result.release.title, type: "release" }),
    tracks: (result.release.tracks || []).map((track) => ({
      ...track,
      artworkUrl: image(track.artworkUrl, { id: track.id, slug: track.slug, name: track.title, type: "track" }),
    })),
    featuredArtists: result.release.featuredArtists || [],
    chartStats: (result.release as any).chartStats || null,
  };
}

export async function listGenres(): Promise<PublicGenre[]> {
  const result = await safeApiGet<{ genres: PublicGenre[] }>("/genres?limit=500", { genres: [] });
  return result.genres;
}

export async function listLabels(): Promise<PublicLabel[]> {
  const result = await safeApiGet<{ labels: PublicLabel[] }>("/labels?limit=500", { labels: [] });
  return result.labels.map((label) => ({
    ...label,
    logoUrl: image(label.logoUrl, { id: label.id, slug: label.slug, name: label.name, type: "label" }),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   LABELS  ·  Server-side paginated (orphan-free)
   ═══════════════════════════════════════════════════════════════ */

export interface LabelPaginatedParams {
  page: number;
  pageSize: number;
  countryFilter?: string;
  search?: string;
}

export interface PaginatedLabelsResult {
  labels: PublicLabel[];
  totalCount: number;
}

export interface LabelCatalogStats {
  total: number;
  totalArtists: number;
  totalReleases: number;
  featuredCount: number;
  countries: string[];
}

export async function listLabelsPaginated(
  params: LabelPaginatedParams,
): Promise<PaginatedLabelsResult> {
  const { page, pageSize, countryFilter, search } = params;

  // 1. Get all active releases with label info (metadata->record_label)
  const { data: releaseRows, error: relErr } = await supabase
    .from("registry_releases")
    .select("id, metadata, label_id")
    .eq("status", "active")
    .not("metadata", "is", null);

  if (relErr) {
    console.warn(`Label paginated release lookup failed: ${relErr.message}`);
    return { labels: [], totalCount: 0 };
  }

  // Build label-name -> release-ids map
  const releaseIdsByLabelName = new Map<string, string[]>();
  const activeLabelIds = new Set<string>();

  for (const r of (releaseRows || []) as Array<{
    id: string;
    metadata: Record<string, unknown> | null;
    label_id: string | null;
  }>) {
    if (r.label_id) activeLabelIds.add(r.label_id);
    const meta = r.metadata || {};
    const labelName = (meta.record_label || meta.wp_label || "") as string;
    if (labelName?.trim()) {
      const key = labelName.trim().toLowerCase();
      const ids = releaseIdsByLabelName.get(key) || [];
      ids.push(r.id);
      releaseIdsByLabelName.set(key, ids);
    }
  }

  if (releaseIdsByLabelName.size === 0 && activeLabelIds.size === 0) {
    return { labels: [], totalCount: 0 };
  }

  // 2. Get all active labels
  const { data: allLabels, error: labelErr } = await supabase
    .from("registry_labels")
    .select("id, slug, name, country_code, description, normalized_name, status")
    .eq("status", "active");

  if (labelErr) {
    console.warn(`Label paginated label lookup failed: ${labelErr.message}`);
    return { labels: [], totalCount: 0 };
  }

  // 3. Filter to labels with active releases (by name or label_id)
  const activeLabelNames = Array.from(releaseIdsByLabelName.keys());
  let activeLabels = (allLabels || []).filter((l) => {
    if (activeLabelIds.has(l.id)) return true;
    const key = (l.name || "").trim().toLowerCase();
    const normKey = (l.normalized_name || "").trim().toLowerCase();
    return activeLabelNames.some(
      (n) => n === key || n === normKey,
    );
  });

  // 4. Apply search filter
  if (search) {
    const term = search.toLowerCase().trim();
    activeLabels = activeLabels.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(term) ||
        (l.country_code || "").toLowerCase().includes(term),
    );
  }

  // 5. Apply country filter
  if (countryFilter && countryFilter !== "All") {
    activeLabels = activeLabels.filter((l) => l.country_code === countryFilter);
  }

  // 6. Collect all release IDs for batch artist lookup
  const allReleaseIds = Array.from(releaseIdsByLabelName.values()).flat();

  let releaseArtistsMap = new Map<string, Array<{ name: string; slug: string }>>();
  if (allReleaseIds.length > 0) {
    const { data: releaseArtists } = await supabase
      .from("registry_release_artists")
      .select("release_id, artist_name_text, artist_slug")
      .in("release_id", [...new Set(allReleaseIds)])
      .eq("status", "active")
      .eq("is_primary", true);

    for (const ra of (releaseArtists || []) as Array<{
      release_id: string;
      artist_name_text: string | null;
      artist_slug: string | null;
    }>) {
      const list = releaseArtistsMap.get(ra.release_id) || [];
      list.push({
        name: ra.artist_name_text || ra.artist_slug || "",
        slug: ra.artist_slug || "",
      });
      releaseArtistsMap.set(ra.release_id, list);
    }
  }

  // 7. Build enriched label objects
  const labelsWithCounts: PublicLabel[] = activeLabels.map((l) => {
    const key = (l.name || "").trim().toLowerCase();
    const releaseIds = releaseIdsByLabelName.get(key) || [];
    const releaseCount = releaseIds.length;

    const seenArtists = new Set<string>();
    const featuredArtists: string[] = [];
    for (const rid of releaseIds) {
      const artists = releaseArtistsMap.get(rid) || [];
      for (const a of artists) {
        if (a.name && !seenArtists.has(a.name)) {
          seenArtists.add(a.name);
          featuredArtists.push(a.name);
        }
      }
    }

    return {
      id: l.id,
      slug: l.slug,
      name: l.name,
      country: l.country_code,
      logoUrl: null,
      artistCount: seenArtists.size,
      releaseCount,
      featuredArtists: featuredArtists.slice(0, 5),
      isFeatured: false,
      description: l.description,
    };
  });

  // 8. Sort by prominence
  labelsWithCounts.sort(
    (a, b) => b.artistCount + b.releaseCount - (a.artistCount + a.releaseCount),
  );

  const totalCount = labelsWithCounts.length;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginated = labelsWithCounts.slice(from, to);

  return { labels: paginated, totalCount };
}

export async function getLabelCatalogStats(): Promise<LabelCatalogStats> {
  const { data: releaseRows } = await supabase
    .from("registry_releases")
    .select("metadata, label_id")
    .eq("status", "active")
    .not("metadata", "is", null);

  const releaseIdsByLabelName = new Map<string, string[]>();
  const activeLabelIds = new Set<string>();

  for (const r of (releaseRows || []) as Array<{
    metadata: Record<string, unknown> | null;
    label_id: string | null;
  }>) {
    if (r.label_id) activeLabelIds.add(r.label_id);
    const meta = r.metadata || {};
    const labelName = (meta.record_label || meta.wp_label || "") as string;
    if (labelName?.trim()) {
      const key = labelName.trim().toLowerCase();
      const ids = releaseIdsByLabelName.get(key) || [];
      ids.push("");
      releaseIdsByLabelName.set(key, ids);
    }
  }

  const { data: allLabels } = await supabase
    .from("registry_labels")
    .select("name, country_code, normalized_name, id")
    .eq("status", "active");

  const activeNames = Array.from(releaseIdsByLabelName.keys());
  const activeLabels = (allLabels || []).filter((l) => {
    if (activeLabelIds.has(l.id)) return true;
    const key = (l.name || "").trim().toLowerCase();
    const normKey = (l.normalized_name || "").trim().toLowerCase();
    return activeNames.some((n) => n === key || n === normKey);
  });

  const total = activeLabels.length;
  const countries = [
    ...new Set(activeLabels.map((l) => l.country_code).filter(Boolean)),
  ].sort((a, b) => String(a).localeCompare(String(b)));

  let totalReleases = 0;
  let totalArtists = 0;
  const allReleaseIds = Array.from(releaseIdsByLabelName.values()).flat();

  if (allReleaseIds.length > 0) {
    const { data: releaseArtists } = await supabase
      .from("registry_release_artists")
      .select("release_id, artist_name_text")
      .in(
        "release_id",
        [...new Set(allReleaseIds)],
      )
      .eq("status", "active")
      .eq("is_primary", true);

    const artistSet = new Set<string>();
    for (const ra of (releaseArtists || []) as Array<{
      release_id: string;
      artist_name_text: string | null;
    }>) {
      if (ra.artist_name_text) artistSet.add(ra.artist_name_text);
    }
    totalArtists = artistSet.size;
    totalReleases = allReleaseIds.length;
  }

  return {
    total,
    totalArtists,
    totalReleases,
    featuredCount: 0,
    countries,
  };
}

/* ═══════════════════════════════════════════════════════════════
   GENRES  ·  Server-side paginated
   ═══════════════════════════════════════════════════════════════ */

export interface GenrePaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  activityFilter?: string; // "All" | "High activity" | "Artist-rich" | "Track-rich" | "Recently updated"
}

export interface PaginatedGenresResult {
  genres: PublicGenre[];
  totalCount: number;
}

export interface GenreCatalogStats {
  total: number;
  totalArtists: number;
  totalTracks: number;
}

export async function listGenresPaginated(
  params: GenrePaginatedParams,
): Promise<PaginatedGenresResult> {
  const { page, pageSize, search, activityFilter } = params;

  // 1. Get all active genres
  const { data: genreRows, error: genreErr } = await supabase
    .from("registry_genres")
    .select("id, slug, name, description")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (genreErr) {
    console.warn(`Genre paginated lookup failed: ${genreErr.message}`);
    return { genres: [], totalCount: 0 };
  }

  // 2. Get artist counts from staging records
  const { data: stagingRecords } = await supabase
    .from("wk_import_staging_records")
    .select("mapped_record")
    .eq("target_entity", "artist_genres")
    .eq("target_status", "ready");

  const genreArtistCounts = new Map<string, number>();
  const genreRepresentatives = new Map<string, string[]>();

  for (const r of (stagingRecords || []) as Array<{
    mapped_record: Record<string, unknown> | null;
  }>) {
    const mr = (r.mapped_record || {}) as Record<string, unknown>;
    const gSlug = String(mr.genre_slug || "");
    const artistSlug = String(mr.artist_slug || "");
    const artistName = artistSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (gSlug) {
      genreArtistCounts.set(gSlug, (genreArtistCounts.get(gSlug) || 0) + 1);
      const existing = genreRepresentatives.get(gSlug) || [];
      if (existing.length < 4 && artistName) existing.push(artistName);
      genreRepresentatives.set(gSlug, existing);
    }
  }

  // 3. Build genre objects
  const allGenres: PublicGenre[] = (genreRows || []).map((g) => {
    const slug = String(g.slug);
    return {
      id: String(g.id),
      slug,
      name: String(g.name),
      artistCount: genreArtistCounts.get(slug) || 0,
      trackCount: 0,
      representativeArtists: genreRepresentatives.get(slug) || [],
    };
  });

  // 4. Apply search filter
  let filtered = allGenres;
  if (search) {
    const term = search.toLowerCase().trim();
    filtered = allGenres.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.representativeArtists.some((a) =>
          a.toLowerCase().includes(term),
        ),
    );
  }

  // 5. Apply activity filter
  if (activityFilter && activityFilter !== "All") {
    if (activityFilter === "High activity") {
      filtered = filtered.filter((g) => g.artistCount >= 10);
    } else if (activityFilter === "Artist-rich") {
      filtered = filtered.filter((g) => g.artistCount >= 5);
    } else if (activityFilter === "Track-rich") {
      filtered = filtered.filter((g) => g.artistCount >= 3);
    }
    // "Recently updated" — no data available, keep all
  }

  // 6. Sort by activity (artistCount descending)
  filtered.sort((a, b) => b.artistCount - a.artistCount);

  const totalCount = filtered.length;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginated = filtered.slice(from, to);

  return { genres: paginated, totalCount };
}

export async function getGenreCatalogStats(): Promise<GenreCatalogStats> {
  const { data: genreRows } = await supabase
    .from("registry_genres")
    .select("id")
    .eq("status", "active");

  const { data: stagingRecords } = await supabase
    .from("wk_import_staging_records")
    .select("mapped_record")
    .eq("target_entity", "artist_genres")
    .eq("target_status", "ready");

  let totalArtists = 0;
  for (const r of (stagingRecords || []) as Array<{
    mapped_record: Record<string, unknown> | null;
  }>) {
    const mr = (r.mapped_record || {}) as Record<string, unknown>;
    if (mr.artist_slug) totalArtists++;
  }

  return {
    total: (genreRows || []).length,
    totalArtists,
    totalTracks: 0,
  };
}