import { withPlaceholderImage } from '@/utils/imagePlaceholders';

export type RepairedStory = {
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

export type RepairedArtist = {
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

export type RepairedRelease = {
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

export type RepairedGenre = {
  id: string;
  slug: string;
  name: string;
  artistCount: number;
  trackCount: number;
  representativeArtists: string[];
};

export type RepairedLabel = {
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

const API_BASE =
  (import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE as string | undefined) ||
  (import.meta.env.VITE_WAKILISHA_V2_API_BASE as string | undefined) ||
  (import.meta.env.VITE_WAKILISHA_WP_V2_API_BASE as string | undefined) ||
  "/__wakilisha-v2-api/wp-json/wakilisha/v2";

type Envelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

async function repairedGet<T>(path: string): Promise<T> {
  const normalizedBase = API_BASE.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${normalizedBase}/repaired${normalizedPath}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WAKILISHA public API ${response.status}: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as Envelope<T> | T;
  return payload && typeof payload === "object" && "data" in payload ? (payload as Envelope<T>).data : (payload as T);
}

async function safeRepairedGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await repairedGet<T>(path);
  } catch (err) {
    console.warn(err instanceof Error ? err.message : "WAKILISHA public API request failed.");
    return fallback;
  }
}

export async function listMagazineStories(): Promise<RepairedStory[]> {
  const result = await safeRepairedGet<{ stories: RepairedStory[] }>("/magazine?limit=500", { stories: [] });
  return result.stories.map((story) => ({
    ...story,
    heroUrl: withPlaceholderImage(story.heroUrl, {
      id: story.id,
      slug: story.slug,
      name: story.title,
      type: "article",
    }),
  }));
}

export async function listArtists(): Promise<RepairedArtist[]> {
  const result = await safeRepairedGet<{ artists: RepairedArtist[] }>("/artists?limit=500", { artists: [] });
  return result.artists.map((artist) => ({
    ...artist,
    imageUrl: withPlaceholderImage(artist.imageUrl, {
      id: artist.id,
      slug: artist.slug,
      name: artist.name,
      type: "artist",
    }),
  }));
}

export async function listReleases(): Promise<RepairedRelease[]> {
  const result = await safeRepairedGet<{ releases: RepairedRelease[] }>("/releases?limit=500", { releases: [] });
  return result.releases.map((release) => ({
    ...release,
    artworkUrl: withPlaceholderImage(release.artworkUrl, {
      id: release.id,
      slug: release.slug,
      name: release.title,
      type: "release",
    }),
  }));
}

export type RepairedReleaseDetail = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  year: string;
  releaseDate: string;
  releaseType: string;
  labelName: string;
  labelSlug: string;
  artworkUrl: string;
  trackCount: number;
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
  description?: string;
  metadata: Record<string, unknown>;
};

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function releaseUrl(release: { slug: string; artist: string }): string {
  return `/releases/${slugify(release.artist)}/${release.slug}`;
}

export async function getRelease(artistSlug: string, releaseSlug: string): Promise<RepairedReleaseDetail | null> {
  const result = await safeRepairedGet<{ release: RepairedReleaseDetail | null }>(`/releases/${artistSlug}/${releaseSlug}`, { release: null });
  if (!result.release) return null;

  return {
    ...result.release,
    artworkUrl: withPlaceholderImage(result.release.artworkUrl, {
      id: result.release.id,
      slug: result.release.slug,
      name: result.release.title,
      type: "release",
    }),
    tracks: result.release.tracks.map((track) => ({
      ...track,
      artworkUrl: withPlaceholderImage(track.artworkUrl, {
        id: track.id,
        slug: track.slug,
        name: track.title,
        type: "track",
      }),
    })),
  };
}

export async function listGenres(): Promise<RepairedGenre[]> {
  const result = await safeRepairedGet<{ genres: RepairedGenre[] }>("/genres?limit=500", { genres: [] });
  return result.genres;
}

export type RepairedArtistVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  platform: string;
};

export type RepairedArtistDetail = {
  id: string;
  slug: string;
  name: string;
  country: string;
  imageUrl: string;
  profileImageUrl?: string;
  genres: string[];
  trackCount: number;
  releaseCount: number;
  isChartArtist: boolean;
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
  }>;
  videos?: RepairedArtistVideo[];
};

export async function getArtist(slug: string): Promise<RepairedArtistDetail | null> {
  const result = await safeRepairedGet<{ artist: RepairedArtistDetail | null }>(`/artists/${slug}`, { artist: null });
  if (!result.artist) return null;

  const artist = result.artist;
  const artistImage = withPlaceholderImage(artist.imageUrl, {
    id: artist.id,
    slug: artist.slug,
    name: artist.name,
    type: "artist",
  });

  return {
    ...artist,
    imageUrl: artistImage,
    profileImageUrl: withPlaceholderImage(artist.profileImageUrl ?? artist.imageUrl, {
      id: artist.id,
      slug: artist.slug,
      name: artist.name,
      type: "artist",
    }),
    chartEntries: artist.chartEntries.map((entry) => ({
      ...entry,
      artworkUrl: withPlaceholderImage(entry.artworkUrl, {
        slug: entry.slug,
        name: entry.title,
        type: "track",
      }),
    })),
    releases: artist.releases.map((release) => ({
      ...release,
      artworkUrl: withPlaceholderImage(release.artworkUrl, {
        slug: release.slug,
        name: release.title,
        type: "release",
      }),
    })),
    topSongs: artist.topSongs.map((song) => ({
      ...song,
      image: withPlaceholderImage(song.image, {
        slug: song.songUrl,
        name: song.title,
        type: "track",
      }),
    })),
    relatedArtists: artist.relatedArtists.map((related) => ({
      ...related,
      imageUrl: withPlaceholderImage(related.imageUrl, {
        slug: related.slug,
        name: related.name,
        type: "artist",
      }),
    })),
    videos: artist.videos?.map((video) => ({
      ...video,
      thumbnail: withPlaceholderImage(video.thumbnail, {
        id: video.id,
        slug: video.url,
        name: video.title,
        type: "track",
      }),
    })),
  };
}

export async function listLabels(): Promise<RepairedLabel[]> {
  const result = await safeRepairedGet<{ labels: RepairedLabel[] }>("/labels?limit=500", { labels: [] });
  return result.labels.map((label) => ({
    ...label,
    logoUrl: withPlaceholderImage(label.logoUrl, {
      id: label.id,
      slug: label.slug,
      name: label.name,
      type: "label",
    }),
  }));
}
