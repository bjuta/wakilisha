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

export async function listMagazineStories(): Promise<RepairedStory[]> {
  const result = await repairedGet<{ stories: RepairedStory[] }>("/magazine");
  return result.stories;
}

export async function listArtists(): Promise<RepairedArtist[]> {
  const result = await repairedGet<{ artists: RepairedArtist[] }>("/artists");
  return result.artists;
}

export async function listReleases(): Promise<RepairedRelease[]> {
  const result = await repairedGet<{ releases: RepairedRelease[] }>("/releases");
  return result.releases;
}

export async function listGenres(): Promise<RepairedGenre[]> {
  const result = await repairedGet<{ genres: RepairedGenre[] }>("/genres");
  return result.genres;
}

export async function listLabels(): Promise<RepairedLabel[]> {
  const result = await repairedGet<{ labels: RepairedLabel[] }>("/labels");
  return result.labels;
}
