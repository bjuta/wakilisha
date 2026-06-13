import { deepDecode } from "@/utils/decodeHtmlEntities";
import { apiGet, type Envelope } from "./backendContract/backendClient";

export type SiteContentItem = MagazineSiteArticle | MagazineSiteArtist | MagazineSiteRelease | MagazineSiteChartEntry;

export type MagazineSiteArticle = {
  contentType: "article";
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
  tags: string[];
};

export type MagazineSiteArtist = {
  contentType: "artist";
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
  tags: string[];
  originIso2: string | null;
};

export type MagazineSiteRelease = {
  contentType: "release";
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
  tags: string[];
  releaseType: string;
};

export type MagazineSiteChartEntry = {
  contentType: "chart_entry";
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
  tags: string[];
  rank: number;
  artistName: string;
};

export type SiteContentResponse = {
  articles: MagazineSiteArticle[];
  artists: MagazineSiteArtist[];
  releases: MagazineSiteRelease[];
  chartHighlights: MagazineSiteChartEntry[];
};

const API_BASE =
  (import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE as string | undefined) ||
  "/api/v1";

async function fetchSiteContent(limit = 200): Promise<SiteContentResponse> {
  const base = API_BASE.replace(/\/$/, "");
  const url = `${base}/magazine/site-content?limit=${limit}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Site content API ${response.status}: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as Envelope<SiteContentResponse> | SiteContentResponse;
  const data = payload && typeof payload === "object" && "data" in payload
    ? (payload as Envelope<SiteContentResponse>).data
    : (payload as SiteContentResponse);

  return deepDecode({
    articles: data.articles ?? [],
    artists: data.artists ?? [],
    releases: data.releases ?? [],
    chartHighlights: data.chartHighlights ?? [],
  });
}

export async function fetchAllSiteContent(): Promise<SiteContentResponse> {
  try {
    return await fetchSiteContent(200);
  } catch (err) {
    console.warn("Site content aggregation failed:", err instanceof Error ? err.message : err);
    return { articles: [], artists: [], releases: [], chartHighlights: [] };
  }
}

export function groupSiteContentBySection(content: SiteContentResponse) {
  const sections = new Map<string, SiteContentItem[]>();

  for (const article of content.articles) {
    const section = article.section || "Music";
    const list = sections.get(section) || [];
    list.push(article);
    sections.set(section, list);
  }

  return sections;
}

export function getTopArtists(content: SiteContentResponse, limit = 6): MagazineSiteArtist[] {
  return content.artists.slice(0, limit);
}

export function getLatestReleases(content: SiteContentResponse, limit = 4): MagazineSiteRelease[] {
  return content.releases.slice(0, limit);
}

export function getChartHighlights(content: SiteContentResponse, limit = 10): MagazineSiteChartEntry[] {
  return content.chartHighlights.slice(0, limit);
}