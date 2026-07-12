import { deepDecode } from "@/utils/decodeHtmlEntities";
import { withPlaceholderImage } from "@/utils/imagePlaceholders";
import { rewriteWpImageUrl } from "@/services/wpImageRewrite";
import { supabase } from "@/lib/supabase";
import { releaseUrl, slugify } from "@/utils/releaseUrl";
import { normalizeGenres } from "@/services/publicContent/genreNormalization";
import {
  enrichArtistMedia,
  enrichArtistsMedia,
  enrichReleaseMedia,
  enrichReleasesMedia,
  enrichArticleMedia,
  enrichArticlesMedia,
  enrichLabelMedia,
} from "@/services/entityMediaEnrichment";

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
  artistImageUrl?: string | null;
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
  artistImageUrl?: string | null;
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
    appleMusicId?: string | null;
    appleMusicCatalogId?: string | null;
  }>;
  metadata: Record<string, unknown>;
  featuredArtists: Array<{ name: string; slug: string; imageUrl?: string | null }>;
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
    id: string;
    slug: string;
    artistSlug: string;
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
  } catch (err) {
    console.warn("getArtistAppearsOn edge fetch failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

const SUPABASE_URL = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string) || "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string) || "";

const API_BASE =
  (import.meta.env.VITE_PUBLIC_API_BASE as string | undefined) ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/public-content-read` : "/api/v1");

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
  const isSupabaseFunction = url.includes(SUPABASE_URL);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(isSupabaseFunction && SUPABASE_ANON_KEY
        ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        : {}),
    },
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

function getInlineMagazineFallbackPayload(): { stories: PublicStory[] } {
  if (typeof document === "undefined") return { stories: [] };

  const node = document.getElementById("wk-magazine-fallback");
  const text = node?.textContent?.trim();

  if (!text) return { stories: [] };

  try {
    const payload = JSON.parse(text) as { stories?: PublicStory[] };
    return {
      stories: Array.isArray(payload.stories) ? payload.stories : [],
    };
  } catch {
    return { stories: [] };
  }
}

export function getInlineMagazineFallbackStories(): PublicStory[] {
  return getInlineMagazineFallbackPayload().stories;
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
  if (rewritten && rewritten.startsWith("http")) return rewritten;
  // Guard against non-URL values (like genre names injected by bad CSV data)
  const cleaned = String(url || "").trim();
  if (cleaned.length > 0 && cleaned.startsWith("http")) return cleaned;
  return withPlaceholderImage(url || "", identity);
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

type ResolvedReleaseArtist = { name: string; slug: string };

const UNKNOWN_ARTIST_NAME = "Unknown artist";

function chunkArray<T>(items: T[], size = 250): T[][] {
  const uniqueItems = Array.from(new Set(items.filter(Boolean)));
  const chunks: T[][] = [];
  for (let i = 0; i < uniqueItems.length; i += size) {
    chunks.push(uniqueItems.slice(i, i + size));
  }
  return chunks;
}

function hasKnownArtistName(value: string | null | undefined): boolean {
  const text = String(value || "").trim();
  return Boolean(text) && !/^unknown(?: artist)?$/i.test(text);
}

function artistNameFromReleaseMetadata(meta: Record<string, unknown> | null | undefined): string {
  if (!meta) return "";
  const keys = [
    "artist",
    "artists",
    "artist_name",
    "artistName",
    "primary_artist",
    "primaryArtist",
    "primary_artist_name",
    "primaryArtistName",
  ];

  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && hasKnownArtistName(value)) return value.trim();

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && hasKnownArtistName(item)) return item.trim();
        if (item && typeof item === "object") {
          const name = (item as Record<string, unknown>).name || (item as Record<string, unknown>).artist_name;
          if (typeof name === "string" && hasKnownArtistName(name)) return name.trim();
        }
      }
    }
  }

  return "";
}

function trackArtistCreditOrder(row: { creditOrder?: number | null }): number {
  const n = Number(row.creditOrder);
  return Number.isFinite(n) ? n : 999;
}

function releaseTrackPosition(row: GenericRow): number {
  const n = Number(row.track_number);
  return Number.isFinite(n) ? n : 999;
}

function firstPrimaryArtistFromTrackRows(
  releaseTrackRows: GenericRow[] | null | undefined,
  artistsByTrack: Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured?: boolean; creditOrder?: number | null }>>,
): ResolvedReleaseArtist | null {
  const orderedTracks = [...(releaseTrackRows || [])].sort(
    (a, b) => releaseTrackPosition(a) - releaseTrackPosition(b),
  );

  for (const trackRow of orderedTracks) {
    const trackId = textValue(trackRow, ["track_id", "id"]);
    const artists = [...(artistsByTrack.get(trackId) || [])].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? 1 : -1;
      return trackArtistCreditOrder(a) - trackArtistCreditOrder(b);
    });

    const primary = artists.find((artist) => artist.isPrimary && hasKnownArtistName(artist.name))
      || artists.find((artist) => hasKnownArtistName(artist.name));

    if (primary) return { name: primary.name, slug: primary.slug };
  }

  return null;
}

async function resolvePrimaryArtistsForReleases(
  releaseIds: string[],
  releaseMetadataById = new Map<string, Record<string, unknown>>(),
): Promise<Map<string, ResolvedReleaseArtist>> {
  const uniqueReleaseIds = Array.from(new Set(releaseIds.filter(Boolean)));
  const artistsByRelease = new Map<string, ResolvedReleaseArtist>();

  if (!uniqueReleaseIds.length) return artistsByRelease;

  for (const ids of chunkArray(uniqueReleaseIds)) {
    const { data: releaseArtistRows, error } = await supabase
      .from("registry_release_artists")
      .select("release_id, artist_name_text, artist_slug, is_primary, credit_order")
      .in("release_id", ids)
      .eq("status", "active")
      .order("credit_order", { ascending: true });

    if (error) {
      console.warn(`Release artist lookup failed: ${error.message}`);
      continue;
    }

    for (const row of (releaseArtistRows || []) as Array<{
      release_id: string;
      artist_name_text: string | null;
      artist_slug: string | null;
      is_primary: boolean | null;
      credit_order: number | null;
    }>) {
      if (!hasKnownArtistName(row.artist_name_text)) continue;

      const current = artistsByRelease.get(row.release_id);
      if (!current || row.is_primary) {
        artistsByRelease.set(row.release_id, {
          name: String(row.artist_name_text).trim(),
          slug: row.artist_slug || "",
        });
      }
    }
  }

  for (const releaseId of uniqueReleaseIds) {
    if (artistsByRelease.has(releaseId)) continue;
    const metadataArtist = artistNameFromReleaseMetadata(releaseMetadataById.get(releaseId));
    if (metadataArtist) {
      artistsByRelease.set(releaseId, {
        name: metadataArtist,
        slug: slugify(metadataArtist),
      });
    }
  }

  const missingReleaseIds = uniqueReleaseIds.filter((releaseId) => !artistsByRelease.has(releaseId));
  if (!missingReleaseIds.length) return artistsByRelease;

  const releaseTrackRows: GenericRow[] = [];
  for (const ids of chunkArray(missingReleaseIds)) {
    const { data, error } = await supabase
      .from("registry_release_tracks")
      .select("release_id, track_id, track_number")
      .in("release_id", ids)
      .eq("status", "active");

    if (error) {
      console.warn(`Release track artist fallback lookup failed: ${error.message}`);
      continue;
    }

    releaseTrackRows.push(...deepDecode((data || []) as GenericRow[]));
  }

  const trackIds = Array.from(new Set(releaseTrackRows.map((row) => textValue(row, ["track_id"])).filter(Boolean)));
  const artistsByTrack = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean; creditOrder: number | null }>>();

  for (const ids of chunkArray(trackIds)) {
    const { data, error } = await supabase
      .from("registry_track_artists")
      .select("track_id, artist_name_text, artist_slug, is_primary, is_featured, credit_order")
      .in("track_id", ids)
      .eq("status", "active")
      .order("credit_order", { ascending: true });

    if (error) {
      console.warn(`Track artist fallback lookup failed: ${error.message}`);
      continue;
    }

    for (const row of (data || []) as Array<{
      track_id: string;
      artist_name_text: string | null;
      artist_slug: string | null;
      is_primary: boolean | null;
      is_featured: boolean | null;
      credit_order: number | null;
    }>) {
      if (!hasKnownArtistName(row.artist_name_text)) continue;
      const list = artistsByTrack.get(row.track_id) || [];
      list.push({
        name: String(row.artist_name_text).trim(),
        slug: row.artist_slug || "",
        isPrimary: Boolean(row.is_primary),
        isFeatured: Boolean(row.is_featured),
        creditOrder: row.credit_order,
      });
      artistsByTrack.set(row.track_id, list);
    }
  }

  const tracksByRelease = new Map<string, GenericRow[]>();
  for (const row of releaseTrackRows) {
    const releaseId = textValue(row, ["release_id"]);
    if (!releaseId) continue;
    const list = tracksByRelease.get(releaseId) || [];
    list.push(row);
    tracksByRelease.set(releaseId, list);
  }

  for (const releaseId of missingReleaseIds) {
    const resolved = firstPrimaryArtistFromTrackRows(tracksByRelease.get(releaseId), artistsByTrack);
    if (resolved) artistsByRelease.set(releaseId, resolved);
  }

  return artistsByRelease;
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

  const artistsByTrack = new Map<string, Array<{ name: string; slug: string; isPrimary: boolean; isFeatured: boolean; creditOrder: number | null }>>();
  for (const ta of (trackArtistRows || [])) {
    if (!artistsByTrack.has(ta.track_id)) artistsByTrack.set(ta.track_id, []);
    artistsByTrack.get(ta.track_id)!.push({
      name: ta.artist_name_text || ta.artist_slug,
      slug: ta.artist_slug || "",
      isPrimary: ta.is_primary,
      isFeatured: ta.is_featured,
      creditOrder: ta.credit_order ?? null,
    });
  }

  if (!hasKnownArtistName(fallbackArtist)) {
    const resolvedFromTracks = firstPrimaryArtistFromTrackRows(
      relationships.map((relationship) => relationship.row),
      artistsByTrack,
    );
    if (resolvedFromTracks) {
      fallbackArtist = resolvedFromTracks.name;
    }
  }

  if (!hasKnownArtistName(fallbackArtist)) {
    fallbackArtist = UNKNOWN_ARTIST_NAME;
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

  // 2. Aggregate is_featured=true AND co-primary track-level artists
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
      .eq("status", "active");

    for (const ta of (trackArtists || [])) {
      if (!ta.artist_slug || ta.artist_slug === primarySlug) continue;
      // Include featured artists AND co-primary artists (duos/collabs)
      if (!ta.is_primary && !ta.is_featured) continue;
      const key = ta.artist_slug || ta.artist_name_text;
      if (key && !seen.has(key)) {
        seen.set(key, { name: ta.artist_name_text || ta.artist_slug, slug: ta.artist_slug || "" });
      }
    }
  }

  return Array.from(seen.values());
}

/** Batch-resolve artist images from registry_artists.public_image_url */
async function batchResolveArtistImages(
  artists: Array<{ name: string; slug: string }>
): Promise<Array<{ name: string; slug: string; imageUrl?: string | null }>> {
  const slugs = artists.map((a) => a.slug).filter(Boolean);
  if (slugs.length === 0) {
    return artists.map((a) => ({ ...a, imageUrl: null }));
  }

  const { data, error } = await supabase
    .from("registry_artists")
    .select("slug, public_image_url")
    .eq("status", "active")
    .in("slug", slugs);

  if (error) {
    console.warn(`batchResolveArtistImages failed: ${error.message}`);
    return artists.map((a) => ({ ...a, imageUrl: null }));
  }

  const imageBySlug = new Map<string, string>();
  for (const row of (data || []) as Array<{ slug: string; public_image_url: string | null }>) {
    if (row.public_image_url) imageBySlug.set(row.slug, row.public_image_url);
  }

  return artists.map((a) => ({
    ...a,
    imageUrl: a.slug ? imageBySlug.get(a.slug) || null : null,
  }));
}

/** Extract unique featured + co-primary artists from track artist rows (in-memory aggregation). */
function aggregateFeaturedFromTrackArtists(
  trackArtistRows: GenericRow[] | null,
  primaryArtistSlug: string
): Array<{ name: string; slug: string }> {
  const seen = new Map<string, { name: string; slug: string }>();
  for (const ta of (trackArtistRows || [])) {
    // Skip the release-level primary — they already own the page
    if (!ta.artist_slug || ta.artist_slug === primaryArtistSlug) continue;
    // Collect track-level primaries (co-primary artists like duos/collabs)
    // as well as explicitly flagged featured artists
    if (!ta.is_primary && !ta.is_featured) continue;
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

async function listReleasesFromRegistry(): Promise<PublicRelease[]> {
  // 1. Fetch all active releases
  const { data: releaseRows, error: releaseError } = await supabase
    .from("registry_releases")
    .select("id, slug, title, release_date, release_type, artwork_url, label_id, metadata, description")
    .eq("status", "active")
    .order("release_date", { ascending: false });

  if (releaseError || !releaseRows?.length) {
    console.warn(`WAKILISHA registry release list failed: ${releaseError?.message || "No releases"}`);
    return [];
  }

  const releases = deepDecode(releaseRows as GenericRow[]);
  const releaseIds = releases.map((r) => textValue(r, ["id"])).filter(Boolean);

  if (releaseIds.length === 0) return [];

  // 2. Resolve primary artists for all releases.
  // Prefer release-level credits, then release metadata, then first-track credits.
  const releaseMetadataById = new Map<string, Record<string, unknown>>();
  for (const row of releases) {
    const id = textValue(row, ["id"]);
    if (id) releaseMetadataById.set(id, (row.metadata || {}) as Record<string, unknown>);
  }
  const artistsByRelease = await resolvePrimaryArtistsForReleases(releaseIds, releaseMetadataById);

  // 3. Fetch track counts for all releases, chunked to avoid oversized Supabase REST URLs.
  const trackRows: Array<{ release_id: string }> = [];
  for (const ids of chunkArray(releaseIds)) {
    const { data, error } = await supabase
      .from("registry_release_tracks")
      .select("release_id")
      .in("release_id", ids)
      .eq("status", "active");

    if (error) {
      console.warn(`WAKILISHA release track batch lookup failed: ${error.message}`);
      continue;
    }

    trackRows.push(...((data || []) as Array<{ release_id: string }>));
  }

  const trackCountByRelease = new Map<string, number>();
  for (const row of trackRows) {
    const rid = row.release_id;
    trackCountByRelease.set(rid, (trackCountByRelease.get(rid) || 0) + 1);
  }

  // 4. Fetch label names for label_id references
  const labelIds = Array.from(
    new Set(releases.map((r) => textValue(r, ["label_id"])).filter(Boolean))
  );

  const labelNameMap = new Map<string, string>();
  if (labelIds.length > 0) {
    const { data: labelRows } = await supabase
      .from("registry_labels")
      .select("id, name")
      .in("id", labelIds);
    for (const row of (labelRows || [])) {
      labelNameMap.set(row.id, String(row.name || ""));
    }
  }

  // 5. Build PublicRelease objects
  return releases.map((row) => {
    const id = textValue(row, ["id"]);
    const slug = textValue(row, ["slug"]);
    const title = textValue(row, ["title"]);
    const releaseDate = textValue(row, ["release_date"]);
    const releaseType = textValue(row, ["release_type"]);
    const artworkUrl = textValue(row, ["artwork_url"]);
    const labelId = textValue(row, ["label_id"]);
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const trackCount = trackCountByRelease.get(id) || 0;

    const artist = artistsByRelease.get(id) || { name: "Unknown artist", slug: "" };
    const year = yearFromDate(releaseDate);

    // Resolve label: registry_labels > metadata.record_label > Independent
    let labelName = labelNameMap.get(labelId) || "";
    if (!labelName && meta.record_label) {
      labelName = String(meta.record_label);
    }
    if (!labelName) labelName = "Independent";

    // Determine release type from track count if not set
    const resolvedType = releaseType || releaseTypeFromTrackCount(trackCount);

    return {
      id,
      slug,
      title,
      artist: artist.name,
      year,
      releaseType: resolvedType,
      labelName,
      artworkUrl: artworkUrl || generatedReleaseArtwork(title, artist.name),
      trackCount,
      description: textValue(row, ["description"]),
    };
  });
}

export interface PaginatedReleasesResult {
  releases: PublicRelease[];
  totalCount: number;
}

export interface ReleasePaginatedParams {
  offset: number;
  limit: number;
  typeFilter?: string;   // "Album" | "EP" | "Single" | undefined (All)
  yearFilter?: string;
  artistFilter?: string;
  search?: string;
  sortKey?: string;      // "newest" | "updated" | "artist" | "title"
}

export async function listReleasesPaginated(params: ReleasePaginatedParams): Promise<PaginatedReleasesResult> {
  const { offset, limit, typeFilter, yearFilter, artistFilter, search, sortKey } = params;

  const allReleases = await listReleasesFromRegistry();
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
    filtered.sort((a, b) => {
      const ay = parseInt(a.year, 10) || 0;
      const by = parseInt(b.year, 10) || 0;
      return by - ay;
    });
  }

  const totalCount = filtered.length;
  const releases = filtered.slice(offset, offset + limit);

  return { releases, totalCount };
}

export interface ReleaseCatalogStats {
  total: number;
  albums: number;
  eps: number;
  singles: number;
}

export async function getReleaseCatalogStats(): Promise<ReleaseCatalogStats> {
  const allReleases = await listReleasesFromRegistry();
  const total = allReleases.length;
  const singles = allReleases.filter((r) => r.trackCount <= 1).length;
  const eps = allReleases.filter((r) => r.trackCount >= 2 && r.trackCount <= 6).length;
  const albums = allReleases.filter((r) => r.trackCount >= 7).length;
  return { total, albums, eps, singles };
}

export async function getReleaseFilterArtists(limit = 30): Promise<string[]> {
  const allReleases = await listReleasesFromRegistry();
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

export async function getReleaseFilterYears(): Promise<string[]> {
  const allReleases = await listReleasesFromRegistry();
  const years = new Set<string>();
  for (const release of allReleases) {
    const y = (release.year || "").match(/\d{4}/)?.[0];
    if (y) years.add(y);
  }
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

export async function listMagazineStories(limit = 500): Promise<PublicStory[]> {
  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : 500;
  const safeLimit = Math.min(500, Math.max(1, requestedLimit));

  const result = await safeApiGet<{ stories: PublicStory[] }>(
    `/magazine?limit=${safeLimit}`,
    { stories: [] },
  );

  const apiStories = Array.isArray(result.stories) ? result.stories : [];
  const fallbackStories = getInlineMagazineFallbackStories();
  const sourceStories =
    apiStories.length > 0
      ? apiStories
      : fallbackStories.slice(0, safeLimit);

  const mapped = sourceStories.map((story) => ({
    ...story,
    heroUrl: image(story.heroUrl, {
      id: story.id,
      slug: story.slug,
      name: story.title,
      type: "article",
    }),
  }));

  return await enrichArticlesMedia(mapped) as PublicStory[];
}

export async function getArticle(slug: string, previewNonce?: string | null): Promise<PublicArticleDetail | null> {
  const path = previewNonce ? `/preview/${previewNonce}` : `/magazine/${slug}`;
  const result = await safeApiGet<{ article: PublicArticleDetail | null }>(path, { article: null });
  if (!result.article) return null;
  const mapped = {
    ...result.article,
    heroUrl: image(result.article.heroUrl, { id: result.article.id, slug: result.article.slug, name: result.article.title, type: "article" }),
  };
  return await enrichArticleMedia(mapped) as PublicArticleDetail;
}

export async function listArtists(): Promise<PublicArtist[]> {
  const result = await safeApiGet<{ artists: PublicArtist[] }>("/artists", { artists: [] });
  const mapped = result.artists.map((artist) => ({
    ...artist,
    genres: normalizeGenres(artist.genres),
    imageUrl: image(artist.imageUrl, { id: artist.id, slug: artist.slug, name: artist.name, type: "artist" }),
  }));
  return await enrichArtistsMedia(mapped) as PublicArtist[];
}

export async function getArtist(slug: string): Promise<PublicArtistDetail | null> {
  const result = await safeApiGet<{ artist: PublicArtistDetail | null }>(`/artists/${slug}`, { artist: null });
  if (!result.artist) return null;
  const artist = result.artist;
  const mapped = {
    ...artist,
    genres: normalizeGenres(artist.genres),
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
  return await enrichArtistMedia(mapped) as PublicArtistDetail;
}

export async function listReleases(): Promise<PublicRelease[]> {
  const registryReleases = await listReleasesFromRegistry();
  if (registryReleases.length) return await enrichReleasesMedia(registryReleases) as PublicRelease[];

  // Last resort: fall back to public API
  const result = await safeApiGet<{ releases: PublicRelease[] }>("/releases?limit=500", { releases: [] });
  const mapped = result.releases.map((release) => ({
    ...release,
    artworkUrl: image(release.artworkUrl, { id: release.id, slug: release.slug, name: release.title, type: "release" }),
  }));
  return await enrichReleasesMedia(mapped) as PublicRelease[];
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
  const releaseMetaForArtist = (releaseRow.metadata || {}) as Record<string, unknown>;
  const metadataArtist = artistNameFromReleaseMetadata(releaseMetaForArtist);
  let fallbackArtist = primaryReleaseArtist?.artist_name_text || metadataArtist || "";
  let fallbackArtistSlug = primaryReleaseArtist?.artist_slug || (metadataArtist ? slugify(metadataArtist) : artistSlug);

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

  // Aggregate featured artists from release-level AND track-level data.
  // The ingest now writes featured artists into both tables, so we merge
  // both sources to get the complete picture.
  const rawFeaturedFromTracks = aggregateFeaturedFromTrackArtists(trackArtistRows, fallbackArtistSlug);
  const rawFeaturedFromRelease: Array<{ name: string; slug: string }> = [];
  for (const ra of (releaseArtistRows || [])) {
    if (ra.is_primary) continue;
    if (!ra.artist_slug || ra.artist_slug === fallbackArtistSlug) continue;
    if (!ra.artist_name_text) continue;
    rawFeaturedFromRelease.push({ name: ra.artist_name_text, slug: ra.artist_slug });
  }

  // Merge both sources, deduplicating by slug
  const seenFeaturedSlugs = new Set<string>();
  const allRawFeatured: Array<{ name: string; slug: string }> = [];
  for (const fa of [...rawFeaturedFromRelease, ...rawFeaturedFromTracks]) {
    const key = fa.slug || slugify(fa.name);
    if (seenFeaturedSlugs.has(key)) continue;
    seenFeaturedSlugs.add(key);
    allRawFeatured.push(fa);
  }

  const rawFeaturedArtists = allRawFeatured;
  const featuredArtists = await batchResolveArtistImages(rawFeaturedArtists);

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
    featuredArtists,
  };
}

export async function getRelease(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
  const registryRelease = await getReleaseFromRegistry(artistSlug, releaseSlug);
  if (registryRelease) return await enrichReleaseMedia(registryRelease) as PublicReleaseDetail;

  // Last resort: fall back to public API
  const result = await safeApiGet<{ release: PublicReleaseDetail | null }>(`/releases/${artistSlug}/${releaseSlug}`, { release: null });
  if (!result.release) return null;
  const mapped = {
    ...result.release,
    artworkUrl: image(result.release.artworkUrl, { id: result.release.id, slug: result.release.slug, name: result.release.title, type: "release" }),
    tracks: (result.release.tracks || []).map((track) => ({
      ...track,
      artworkUrl: image(track.artworkUrl, { id: track.id, slug: track.slug, name: track.title, type: "track" }),
    })),
    featuredArtists: result.release.featuredArtists || [],
    chartStats: (result.release as any).chartStats || null,
  };
  return await enrichReleaseMedia(mapped) as PublicReleaseDetail;
}

export async function listGenres(): Promise<PublicGenre[]> {
  const result = await safeApiGet<{ genres: PublicGenre[] }>("/genres?limit=500", { genres: [] });
  return result.genres;
}

export async function listLabels(): Promise<PublicLabel[]> {
  const result = await safeApiGet<{ labels: PublicLabel[] }>("/labels?limit=500", { labels: [] });
  const mapped = result.labels.map((label) => ({
    ...label,
    logoUrl: image(label.logoUrl, { id: label.id, slug: label.slug, name: label.name, type: "label" }),
  }));
  return await Promise.all(mapped.map((l) => enrichLabelMedia(l))) as PublicLabel[];
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

type ArtistOriginRow = {
  slug: string;
  origin_iso2?: string | null;
  metadata?: Record<string, unknown> | null;
};

function artistOriginCountry(row: ArtistOriginRow): string {
  const meta = row.metadata || {};
  const country =
    row.origin_iso2 ||
    (typeof meta.country_code === "string" ? meta.country_code : "") ||
    (typeof meta.country === "string" ? meta.country : "") ||
    (typeof meta.origin_country === "string" ? meta.origin_country : "") ||
    (typeof meta.originCountry === "string" ? meta.originCountry : "");

  return String(country || "").trim();
}

async function resolveArtistOriginsBySlug(artistSlugs: string[]): Promise<Map<string, string>> {
  const origins = new Map<string, string>();

  for (const slugs of chunkArray(artistSlugs)) {
    const { data, error } = await supabase
      .from("registry_artists")
      .select("slug, origin_iso2, metadata")
      .eq("status", "active")
      .in("slug", slugs);

    if (error) {
      console.warn(`WAKILISHA artist origin lookup failed: ${error.message}`);
      continue;
    }

    for (const artist of (data || []) as ArtistOriginRow[]) {
      const country = artistOriginCountry(artist);
      if (artist.slug && country) origins.set(artist.slug, country);
    }
  }

  return origins;
}

export async function listLabelsPaginated(
  params: LabelPaginatedParams,
): Promise<PaginatedLabelsResult> {
  const { page, pageSize, countryFilter, search } = params;

  const { data: releaseRows, error: relErr } = await supabase
    .from("registry_releases")
    .select("id, metadata, label_id")
    .eq("status", "active");

  if (relErr) {
    console.warn(`Label paginated release lookup failed: ${relErr.message}`);
    return { labels: [], totalCount: 0 };
  }

  const releaseIdsByLabelName = new Map<string, string[]>();
  const releaseIdsByLabelId = new Map<string, string[]>();
  const activeLabelIds = new Set<string>();

  for (const r of (releaseRows || []) as Array<{
    id: string;
    metadata: Record<string, unknown> | null;
    label_id: string | null;
  }>) {
    if (r.label_id) {
      activeLabelIds.add(r.label_id);
      const ids = releaseIdsByLabelId.get(r.label_id) || [];
      ids.push(r.id);
      releaseIdsByLabelId.set(r.label_id, ids);
    }

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

  const { data: allLabels, error: labelErr } = await supabase
    .from("registry_labels")
    .select("id, slug, name, country_code, description, normalized_name, status")
    .eq("status", "active");

  if (labelErr) {
    console.warn(`Label paginated label lookup failed: ${labelErr.message}`);
    return { labels: [], totalCount: 0 };
  }

  const activeLabelNames = Array.from(releaseIdsByLabelName.keys());
  let activeLabels = (allLabels || []).filter((label) => {
    if (activeLabelIds.has(label.id)) return true;

    const key = (label.name || "").trim().toLowerCase();
    const normKey = (label.normalized_name || "").trim().toLowerCase();

    return activeLabelNames.some((name) => name === key || name === normKey);
  });

  if (search) {
    const term = search.toLowerCase().trim();
    activeLabels = activeLabels.filter(
      (label) =>
        (label.name || "").toLowerCase().includes(term) ||
        (label.country_code || "").toLowerCase().includes(term),
    );
  }

  const allReleaseIds = Array.from(new Set([
    ...Array.from(releaseIdsByLabelName.values()).flat(),
    ...Array.from(releaseIdsByLabelId.values()).flat(),
  ]));

  const releaseArtistMap = await resolvePrimaryArtistsForReleases(allReleaseIds);
  const allArtistSlugs = Array.from(new Set(
    Array.from(releaseArtistMap.values())
      .map((artist) => artist.slug)
      .filter(Boolean),
  ));
  const artistOriginBySlug = await resolveArtistOriginsBySlug(allArtistSlugs);

  const labelArtistSlugs = new Map<string, string[]>();
  let labelsWithCounts: PublicLabel[] = activeLabels.map((label) => {
    const key = (label.name || "").trim().toLowerCase();
    const normKey = (label.normalized_name || "").trim().toLowerCase();
    const releaseIds = Array.from(new Set([
      ...(releaseIdsByLabelId.get(label.id) || []),
      ...(releaseIdsByLabelName.get(key) || []),
      ...(normKey && normKey !== key ? (releaseIdsByLabelName.get(normKey) || []) : []),
    ]));

    const seenArtists = new Set<string>();
    const featuredArtists: string[] = [];
    const slugs: string[] = [];
    const originCountries = new Set<string>();

    for (const rid of releaseIds) {
      const artist = releaseArtistMap.get(rid);
      if (!artist || !hasKnownArtistName(artist.name)) continue;

      const artistKey = artist.slug || artist.name.toLowerCase();
      if (seenArtists.has(artistKey)) continue;

      seenArtists.add(artistKey);
      featuredArtists.push(artist.name);

      if (artist.slug) {
        slugs.push(artist.slug);
        const originCountry = artistOriginBySlug.get(artist.slug);
        if (originCountry) originCountries.add(originCountry);
      }
    }

    labelArtistSlugs.set(label.slug, slugs);

    return {
      id: label.id,
      slug: label.slug,
      name: label.name,
      country: Array.from(originCountries)[0] || label.country_code,
      logoUrl: null,
      artistCount: seenArtists.size,
      releaseCount: releaseIds.length,
      featuredArtists: featuredArtists.slice(0, 5),
      isFeatured: false,
      description: label.description,
    };
  });

  if (countryFilter && countryFilter !== "All") {
    labelsWithCounts = labelsWithCounts.filter((label) => {
      const slugs = labelArtistSlugs.get(label.slug) || [];
      return slugs.some((slug) => artistOriginBySlug.get(slug) === countryFilter);
    });
  }

  const artistImageBySlug = new Map<string, string>();
  if (allArtistSlugs.length > 0) {
    for (const slugs of chunkArray(allArtistSlugs)) {
      const { data: artistRows } = await supabase
        .from("registry_artists")
        .select("slug, public_image_url")
        .eq("status", "active")
        .in("slug", slugs);

      for (const artist of (artistRows || []) as Array<{ slug: string; public_image_url: string | null }>) {
        if (artist.public_image_url && !artistImageBySlug.has(artist.slug)) {
          artistImageBySlug.set(artist.slug, artist.public_image_url);
        }
      }
    }
  }

  for (const label of labelsWithCounts) {
    const slugs = labelArtistSlugs.get(label.slug) || [];
    for (const slug of slugs) {
      const imageUrl = artistImageBySlug.get(slug);
      if (imageUrl) {
        label.artistImageUrl = imageUrl;
        break;
      }
    }
  }

  labelsWithCounts.sort(
    (a, b) => b.artistCount + b.releaseCount - (a.artistCount + a.releaseCount),
  );

  const totalCount = labelsWithCounts.length;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  return {
    labels: labelsWithCounts.slice(from, to),
    totalCount,
  };
}

export async function getLabelCatalogStats(): Promise<LabelCatalogStats> {
  const { data: releaseRows, error: releaseErr } = await supabase
    .from("registry_releases")
    .select("id, metadata, label_id")
    .eq("status", "active");

  if (releaseErr) {
    console.warn(`Label catalog stats release lookup failed: ${releaseErr.message}`);
    return {
      total: 0,
      totalArtists: 0,
      totalReleases: 0,
      featuredCount: 0,
      countries: [],
    };
  }

  const releaseIdsByLabelName = new Map<string, string[]>();
  const releaseIdsByLabelId = new Map<string, string[]>();
  const activeLabelIds = new Set<string>();

  for (const r of (releaseRows || []) as Array<{
    id: string;
    metadata: Record<string, unknown> | null;
    label_id: string | null;
  }>) {
    if (r.label_id) {
      activeLabelIds.add(r.label_id);
      const ids = releaseIdsByLabelId.get(r.label_id) || [];
      ids.push(r.id);
      releaseIdsByLabelId.set(r.label_id, ids);
    }

    const meta = r.metadata || {};
    const labelName = (meta.record_label || meta.wp_label || "") as string;
    if (labelName?.trim()) {
      const key = labelName.trim().toLowerCase();
      const ids = releaseIdsByLabelName.get(key) || [];
      ids.push(r.id);
      releaseIdsByLabelName.set(key, ids);
    }
  }

  const { data: allLabels, error: labelErr } = await supabase
    .from("registry_labels")
    .select("id, name, normalized_name, country_code")
    .eq("status", "active");

  if (labelErr) {
    console.warn(`Label catalog stats label lookup failed: ${labelErr.message}`);
  }

  const activeLabelNames = Array.from(releaseIdsByLabelName.keys());
  const activeLabels = (allLabels || []).filter((label) => {
    if (activeLabelIds.has(label.id)) return true;

    const key = (label.name || "").trim().toLowerCase();
    const normKey = (label.normalized_name || "").trim().toLowerCase();

    return activeLabelNames.some((name) => name === key || name === normKey);
  });

  const allReleaseIds = Array.from(new Set([
    ...Array.from(releaseIdsByLabelName.values()).flat(),
    ...Array.from(releaseIdsByLabelId.values()).flat(),
  ]));

  const releaseArtistMap = await resolvePrimaryArtistsForReleases(allReleaseIds);

  const artistSet = new Set<string>();
  const artistSlugs = new Set<string>();

  for (const artist of releaseArtistMap.values()) {
    if (!hasKnownArtistName(artist.name)) continue;

    const key = artist.slug || artist.name.toLowerCase();
    artistSet.add(key);

    if (artist.slug) artistSlugs.add(artist.slug);
  }

  const artistOriginBySlug = await resolveArtistOriginsBySlug(Array.from(artistSlugs));
  const originCountries = Array.from(new Set(artistOriginBySlug.values()))
    .sort((a, b) => a.localeCompare(b));

  return {
    total: activeLabels.length,
    totalArtists: artistSet.size,
    totalReleases: allReleaseIds.length,
    featuredCount: 0,
    countries: originCountries,
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

/** Normalize a genre name for matching: lowercase, collapse whitespace, strip punctuation. */
function normalizeGenreKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listGenresPaginated(
  params: GenrePaginatedParams,
): Promise<PaginatedGenresResult> {
  const { page, pageSize, search, activityFilter } = params;

  // 1. Get all active artists with curated genre data from metadata
  const { data: artistRows, error: artistErr } = await supabase
    .from("registry_artists")
    .select("slug, display_name, public_image_url, metadata")
    .eq("status", "active");

  if (artistErr) {
    console.warn(`Genre paginated artist lookup failed: ${artistErr.message}`);
    return { genres: [], totalCount: 0 };
  }

  // 2. Get all active registry_genres for name/slug matching
  const { data: registryGenreRows, error: regGenreErr } = await supabase
    .from("registry_genres")
    .select("id, slug, name")
    .eq("status", "active");

  if (regGenreErr) {
    console.warn(`Genre paginated registry_genres lookup failed: ${regGenreErr.message}`);
    return { genres: [], totalCount: 0 };
  }

  // Build normalized-key → registry_genre map
  const registryGenreByKey = new Map<string, { id: string; slug: string; name: string }>();
  for (const rg of (registryGenreRows || [])) {
    const key = normalizeGenreKey(rg.name || rg.slug);
    if (key && !registryGenreByKey.has(key)) {
      registryGenreByKey.set(key, { id: String(rg.id), slug: String(rg.slug), name: String(rg.name || rg.slug) });
    }
    // Also index by slug
    const slugKey = normalizeGenreKey(rg.slug);
    if (slugKey && slugKey !== key && !registryGenreByKey.has(slugKey)) {
      registryGenreByKey.set(slugKey, { id: String(rg.id), slug: String(rg.slug), name: String(rg.name || rg.slug) });
    }
  }

  // 3. Walk artists and aggregate genre data from metadata.genres
  const genreMap = new Map<string, {
    registryId: string;
    slug: string;
    name: string;
    artistCount: number;
    artistSlugs: string[];
    artistNames: string[];
    artistImageUrl?: string;
  }>();

  for (const artist of (artistRows || []) as Array<{
    slug: string;
    display_name: string | null;
    public_image_url: string | null;
    metadata: Record<string, unknown> | null;
  }>) {
    const genres: unknown[] = (artist.metadata?.genres as unknown[]) || [];
    if (!genres.length) continue;

    const artistName = artist.display_name || artist.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    for (const g of genres) {
      const rawName = String(g).trim();
      if (!rawName) continue;

      const key = normalizeGenreKey(rawName);
      const match = registryGenreByKey.get(key);

      // Use registry_genres match when available, otherwise use raw name as fallback
      const genreSlug = match?.slug || key.replace(/\s+/g, "-");
      const genreName = match?.name || rawName;
      const genreId = match?.id || genreSlug;

      const existing = genreMap.get(genreSlug);
      if (existing) {
        existing.artistCount++;
        if (existing.artistSlugs.length < 5) existing.artistSlugs.push(artist.slug);
        if (existing.artistNames.length < 5) existing.artistNames.push(artistName);
        if (!existing.artistImageUrl && artist.public_image_url) {
          existing.artistImageUrl = artist.public_image_url;
        }
      } else {
        genreMap.set(genreSlug, {
          registryId: genreId,
          slug: genreSlug,
          name: genreName,
          artistCount: 1,
          artistSlugs: [artist.slug],
          artistNames: [artistName],
          artistImageUrl: artist.public_image_url || undefined,
        });
      }
    }
  }

  // 4. Batch query track counts from registry_track_artists
  const allSlugs = Array.from(genreMap.values()).flatMap((g) => g.artistSlugs);
  const uniqueSlugs = [...new Set(allSlugs)];
  const trackCountBySlug = new Map<string, number>();

  if (uniqueSlugs.length > 0) {
    const { data: trackArtistRows } = await supabase
      .from("registry_track_artists")
      .select("artist_slug, track_id")
      .in("artist_slug", uniqueSlugs)
      .eq("status", "active");

    // Count distinct tracks per artist
    const tracksBySlug = new Map<string, Set<string>>();
    for (const row of (trackArtistRows || []) as Array<{ artist_slug: string; track_id: string }>) {
      const set = tracksBySlug.get(row.artist_slug) || new Set();
      set.add(row.track_id);
      tracksBySlug.set(row.artist_slug, set);
    }
    for (const [slug, trackSet] of tracksBySlug) {
      trackCountBySlug.set(slug, trackSet.size);
    }
  }

  // 5. Build PublicGenre array with track counts
  let allGenres: PublicGenre[] = Array.from(genreMap.values()).map((g) => {
    let totalTracks = 0;
    for (const s of g.artistSlugs) {
      totalTracks += trackCountBySlug.get(s) || 0;
    }
    return {
      id: g.registryId,
      slug: g.slug,
      name: g.name,
      artistCount: g.artistCount,
      trackCount: totalTracks,
      representativeArtists: g.artistNames.slice(0, 4),
      artistImageUrl: g.artistImageUrl,
    };
  });

  // 6. Apply search filter
  if (search) {
    const term = search.toLowerCase().trim();
    allGenres = allGenres.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.representativeArtists.some((a) =>
          a.toLowerCase().includes(term),
        ),
    );
  }

  // 7. Apply activity filter
  if (activityFilter && activityFilter !== "All") {
    if (activityFilter === "High activity") {
      allGenres = allGenres.filter((g) => g.artistCount >= 10);
    } else if (activityFilter === "Artist-rich") {
      allGenres = allGenres.filter((g) => g.artistCount >= 5);
    } else if (activityFilter === "Track-rich") {
      allGenres = allGenres.filter((g) => g.artistCount >= 3);
    }
  }

  // 8. Sort by activity (artistCount descending)
  allGenres.sort((a, b) => b.artistCount - a.artistCount);

  const totalCount = allGenres.length;
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const paginated = allGenres.slice(from, to);

  return { genres: paginated, totalCount };
}

export async function getGenreCatalogStats(): Promise<GenreCatalogStats> {
  // Count distinct genres from artist metadata.genres
  const { data: artistRows, error: artistErr } = await supabase
    .from("registry_artists")
    .select("slug, metadata")
    .eq("status", "active");

  if (artistErr) {
    console.warn(`Genre catalog stats failed: ${artistErr.message}`);
    return { total: 0, totalArtists: 0, totalTracks: 0 };
  }

  const seenGenres = new Set<string>();
  let totalArtists = 0;
  const genreArtistSlugs: string[] = [];

  for (const artist of (artistRows || []) as Array<{
    slug: string;
    metadata: Record<string, unknown> | null;
  }>) {
    const genres: unknown[] = (artist.metadata?.genres as unknown[]) || [];
    if (!genres.length) continue;
    totalArtists++;
    genreArtistSlugs.push(artist.slug);
    for (const g of genres) {
      const raw = String(g).trim();
      if (raw) seenGenres.add(raw.toLowerCase());
    }
  }

  // Count distinct tracks across all genre-tagged artists
  let totalTracks = 0;
  if (genreArtistSlugs.length > 0) {
    const { data: trackArtistRows, error: trackErr } = await supabase
      .from("registry_track_artists")
      .select("track_id")
      .in("artist_slug", genreArtistSlugs)
      .eq("status", "active");

    if (!trackErr && trackArtistRows) {
      const distinctTracks = new Set(trackArtistRows.map((r: any) => r.track_id));
      totalTracks = distinctTracks.size;
    }
  }

  return {
    total: seenGenres.size,
    totalArtists,
    totalTracks,
  };
}