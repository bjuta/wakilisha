import { listMagazineArticles, toRepairedStory } from '@/services/magazineArticles';

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
  const url = `${API_BASE.replace(/\/$/, "")}/repaired${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WAKILISHA entity API ${response.status}: ${text || response.statusText}`);
  }
  const payload = (await response.json()) as Envelope<T> | T;
  return payload && typeof payload === "object" && "data" in payload ? (payload as Envelope<T>).data : (payload as T);
}

export async function listMagazineStories(): Promise<RepairedStory[]> {
  const articles = await listMagazineArticles();
  return articles.map(toRepairedStory);
}

export async function listArtists(): Promise<RepairedArtist[]> {
  const result = await repairedGet<{ artists: RepairedArtist[] }>("/artists");
  return result.artists;
}

export async function listReleases(): Promise<RepairedRelease[]> {
  const result = await repairedGet<{ releases: RepairedRelease[] }>("/releases");
  return result.releases;
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
  const result = await repairedGet<{ release: RepairedReleaseDetail | null }>(`/releases/${artistSlug}/${releaseSlug}`);
  return result.release || null;
}

export async function listGenres(): Promise<RepairedGenre[]> {
  const result = await repairedGet<{ genres: RepairedGenre[] }>("/genres");
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
  const result = await repairedGet<{ artist: RepairedArtistDetail | null }>(`/artists/${slug}`);
  return result.artist || null;
}

export async function listLabels(): Promise<RepairedLabel[]> {
  const result = await repairedGet<{ labels: RepairedLabel[] }>("/labels");
  return result.labels;
}