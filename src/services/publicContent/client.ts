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

async function apiGet<T>(path: string): Promise<T> {
  const base = API_BASE.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WAKILISHA public API ${response.status}: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as Envelope<T> | T;
  return payload && typeof payload === "object" && "data" in payload ? (payload as Envelope<T>).data : (payload as T);
}

async function safeApiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (err) {
    console.warn(err instanceof Error ? err.message : "WAKILISHA public API request failed.");
    return fallback;
  }
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

function mapShellToRelease(shell: ReleaseShellRow): PublicReleaseDetail {
  const artist = shell.primary_artist_name || "Unknown artist";
  const releaseType = releaseTypeFromTrackCount(Number(shell.track_count || 0));
  const artworkUrl = generatedReleaseArtwork(shell.title, artist);

  return {
    id: shell.release_id,
    slug: shell.slug,
    title: shell.title,
    artist,
    year: yearFromDate(shell.release_date),
    releaseType,
    labelName: "WAKILISHA Registry",
    artworkUrl,
    trackCount: Number(shell.track_count || 0),
    description: `${shell.title} is a ${releaseType.toLowerCase()} by ${artist}, surfaced from the WAKILISHA canonical registry.`,
    releaseDate: shell.release_date || "",
    labelSlug: "wakilisha-registry",
    totalDuration: Number(shell.track_count || 0) * 180,
    tracks: [],
    metadata: {
      source: "registry_release_shells",
      releaseId: shell.release_id,
      readiness: shell.readiness,
      missing: shell.missing || [],
      shellRoute: shell.shell_route,
      sourceProvenance: shell.source_provenance || {},
      updatedAt: shell.updated_at,
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

  return data ? mapShellToRelease(data as ReleaseShellRow) : null;
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

  return ((data || []) as ReleaseShellRow[]).map((shell) => {
    const release = mapShellToRelease(shell);
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
