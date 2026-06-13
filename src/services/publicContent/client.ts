import { deepDecode } from "@/utils/decodeHtmlEntities";
import { withPlaceholderImage } from "@/utils/imagePlaceholders";
import { rewriteWpImageUrl } from "@/services/wpImageRewrite";
import { supabase } from "@/lib/supabase";

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
  }>;
  metadata: Record<string, unknown>;
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
    tracks: Array<{ title: string; duration: string }>;
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
  tracks: Array<{ title: string; duration: string }>;
}

export async function getArtistDiscographyFromRegistry(
  artistSlug: string
): Promise<RegistryDiscographyRelease[]> {
  /* 1. Get artist-release links */
  const { data: links, error: linkErr } = await supabase
    .from("registry_release_artists")
    .select("release_id, is_primary")
    .eq("artist_slug", artistSlug)
    .eq("is_primary", true)
    .order("created_at", { ascending: false });

  if (linkErr || !links || links.length === 0) return [];

  const releaseIds = [...new Set(links.map((l) => l.release_id))];

  /* 2. Get release metadata */
  const { data: releaseRows, error: releaseErr } = await supabase
    .from("registry_releases")
    .select("id, slug, title, release_type, release_date, artwork_url")
    .in("id", releaseIds);

  if (releaseErr || !releaseRows) return [];

  const releaseById = new Map(releaseRows.map((r) => [r.id, r]));

  /* 3. Get track count per release */
  const { data: trackLinks } = await supabase
    .from("registry_release_tracks")
    .select("release_id, track_id, track_number")
    .in("release_id", releaseIds);

  const trackCountByRelease = new Map<string, number>();
  const trackIdsByRelease = new Map<string, { trackId: string; trackNumber: number }[]>();

  for (const tl of (trackLinks || [])) {
    const rid = tl.release_id;
    trackCountByRelease.set(rid, (trackCountByRelease.get(rid) || 0) + 1);
    if (!trackIdsByRelease.has(rid)) trackIdsByRelease.set(rid, []);
    trackIdsByRelease.get(rid)!.push({ trackId: tl.track_id, trackNumber: tl.track_number || 0 });
  }

  /* 4. Get track details for releases with ≤20 tracks */
  const allTrackIds = [...new Set((trackLinks || []).map((tl) => tl.track_id))];
  const trackById = new Map<string, { title: string; duration_ms: number | null }>();

  if (allTrackIds.length > 0 && allTrackIds.length <= 500) {
    const { data: trackRows } = await supabase
      .from("registry_tracks")
      .select("id, title, duration_ms")
      .in("id", allTrackIds);

    for (const t of (trackRows || [])) {
      trackById.set(t.id, { title: t.title, duration_ms: t.duration_ms });
    }
  }

  /* 5. Build release list */
  const releases: RegistryDiscographyRelease[] = (links as { release_id: string }[])
    .filter((l) => releaseById.has(l.release_id))
    .map((l) => {
      const r = releaseById.get(l.release_id)!;
      const releaseDate = r.release_date || "";
      const year = releaseDate ? String(releaseDate).match(/\d{4}/)?.[0] || "" : "";
      const trackInfos = trackIdsByRelease.get(r.id) || [];

      const tracks = trackInfos
        .sort((a, b) => a.trackNumber - b.trackNumber)
        .map((ti) => {
          const t = trackById.get(ti.trackId);
          const durationMs = t?.duration_ms;
          const duration = durationMs
            ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0")}`
            : "";
          return {
            title: t?.title || `Track ${ti.trackNumber || "?"}`,
            duration,
          };
        });

      return {
        slug: r.slug,
        title: r.title,
        releaseType: r.release_type || "album",
        year,
        releaseDate,
        trackCount: trackCountByRelease.get(r.id) || tracks.length,
        artworkUrl: r.artwork_url || "",
        tracks: tracks.slice(0, 20),
      };
    });

  // Sort by date descending
  releases.sort((a, b) => {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return b.releaseDate.localeCompare(a.releaseDate);
  });

  return releases;
}

const API_BASE =
  (import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE as string | undefined) ||
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
  const response = await fetch(url, { headers: { Accept: "application/json" } });

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

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function releaseUrl(release: { slug: string; artist: string }): string {
  return `/releases/${slugify(release.artist)}/${release.slug}`;
}

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
      const title = textValue(track, ["title", "name", "display_title", "normalized_title", "slug"], `Track ${index + 1}`);
      const slug = textValue(track, ["slug", "normalized_slug"], relationship.trackId);
      const artist = textValue(track, ["artist", "artist_name", "primary_artist_name", "artists"], fallbackArtist);
      const mediaUrl = mediaUrlFor(mediaCandidates(slug, title), mediaBySlug);
      const directArtwork = textValue(track, ["artwork_url", "cover_image_url", "image_url", "thumbnail_url"]);
      const artwork = mediaUrl || image(directArtwork, {
        id: relationship.trackId,
        slug,
        name: title,
        type: "track",
      });

      return {
        id: relationship.trackId,
        slug,
        title,
        artist,
        duration: numberValue(track, ["duration", "duration_seconds", "length_seconds"], 0),
        trackNumber: relationship.position || index + 1,
        artworkUrl: artwork || generatedReleaseArtwork(title, artist),
      };
    });
}

function mapShellToRelease(shell: ReleaseShellRow, tracks: PublicReleaseDetail["tracks"] = [], releaseArtworkUrl = ""): PublicReleaseDetail {
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
    labelName: "WAKILISHA Registry",
    artworkUrl,
    trackCount,
    description: `${shell.title} is a ${releaseType.toLowerCase()} by ${artist}, surfaced from the WAKILISHA canonical registry.`,
    releaseDate: shell.release_date || "",
    labelSlug: "wakilisha-registry",
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
  };
}

async function getReleaseFromShell(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
  const { data, error } = await supabase
    .from("registry_release_shells")
    .select("id, release_id, slug, title, primary_artist_name, primary_artist_slug, release_date, track_count, has_artwork, readiness, missing, shell_route, source_provenance, status, updated_at")
    .eq("status", "ready")
    .eq("slug", releaseSlug)
    .eq("primary_artist_slug", artistSlug)
    .maybeSingle();

  if (error) {
    console.warn(`WAKILISHA release shell lookup failed: ${error.message}`);
    return null;
  }

  if (!data) return null;
  const shell = deepDecode(data as ReleaseShellRow);
  const tracks = await getRegistryTracklist(shell.release_id, shell.primary_artist_name || "Unknown artist");
  const releaseMedia = await getRegistryMediaBySlugs(mediaCandidates(shell.slug, shell.title));
  const releaseArtworkUrl = mediaUrlFor(mediaCandidates(shell.slug, shell.title), releaseMedia);
  return mapShellToRelease(shell, tracks, releaseArtworkUrl);
}

async function listReleasesFromShells(): Promise<PublicRelease[]> {
  const { data, error } = await supabase
    .from("registry_release_shells")
    .select("id, release_id, slug, title, primary_artist_name, primary_artist_slug, release_date, track_count, has_artwork, readiness, missing, shell_route, source_provenance, status, updated_at")
    .eq("status", "ready")
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

export async function getRelease(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
  const shellRelease = await getReleaseFromShell(artistSlug, releaseSlug);
  if (shellRelease) return shellRelease;

  const result = await safeApiGet<{ release: PublicReleaseDetail | null }>(`/releases/${artistSlug}/${releaseSlug}`, { release: null });
  if (!result.release) return null;
  return {
    ...result.release,
    artworkUrl: image(result.release.artworkUrl, { id: result.release.id, slug: result.release.slug, name: result.release.title, type: "release" }),
    tracks: (result.release.tracks || []).map((track) => ({
      ...track,
      artworkUrl: image(track.artworkUrl, { id: track.id, slug: track.slug, name: track.title, type: "track" }),
    })),
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
