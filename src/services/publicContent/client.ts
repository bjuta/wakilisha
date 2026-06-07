import { withPlaceholderImage } from "@/utils/imagePlaceholders";
import { rewriteWpImageUrl } from "@/services/wpImageRewrite";

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
  "/api/wakilisha/v1";

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

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function releaseUrl(release: { slug: string; artist: string }): string {
  return `/releases/${slugify(release.artist)}/${release.slug}`;
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
  const result = await safeApiGet<{ releases: PublicRelease[] }>("/releases?limit=500", { releases: [] });
  return result.releases.map((release) => ({
    ...release,
    artworkUrl: image(release.artworkUrl, { id: release.id, slug: release.slug, name: release.title, type: "release" }),
  }));
}

export async function getRelease(artistSlug: string, releaseSlug: string): Promise<PublicReleaseDetail | null> {
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
