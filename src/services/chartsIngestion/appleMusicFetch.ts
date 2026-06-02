/**
 * Apple Music Provider Fetch Service
 * Fetches real chart/playlist data from Apple Music API when credentials are available.
 * Falls back to deterministic mock data when credentials are missing.
 */

import type { NormalizedChartRow } from "./ingestStudioTypes";
import { generateMockProviderRows, getMockProviderError } from "./mockTracks";

// ─── Apple Music API Types ───
interface AppleMusicSong {
  id: string;
  type: "songs";
  attributes: {
    name: string;
    artistName: string;
    composerName?: string;
    albumName: string;
    durationInMillis: number;
    trackNumber: number;
    artwork: {
      url: string;
      width: number;
      height: number;
    };
    url: string;
    previews?: { url: string }[];
    contentRating?: "explicit" | "clean";
    genreNames: string[];
    releaseDate?: string;
    isrc?: string;
  };
  relationships?: {
    artists: {
      data: { id: string; type: "artists"; attributes?: { name: string } }[];
    };
    albums: {
      data: { id: string; type: "albums"; attributes?: { name: string } }[];
    };
  };
}

interface AppleMusicChartResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      title: string;
      chart: string;
    };
    relationships: {
      data: {
        data: AppleMusicSong[];
      };
    };
  }[];
}

// ─── Configuration ───
const APPLE_MUSIC_DEV_TOKEN = import.meta.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN as string | undefined;

export type AppleMusicFetchResult = {
  success: boolean;
  normalizedRows: NormalizedChartRow[];
  error?: string;
  rawPayload: unknown;
  warnings: string[];
  metrics: {
    fetchedCount: number;
    normalizedCount: number;
    droppedCount: number;
    durationMs: number;
  };
};

// ─── URL Parsing ───
export function parseAppleMusicUrl(url: string): { storefront: string; type: string; id: string } | null {
  // Parse: https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789
  const match = url.match(/music\.apple\.com\/([a-z]{2})\/(playlist|album|song|artist)\/[^/]+\/(pl\.|al\.|s\.|a\.)([a-zA-Z0-9]+)/i);
  if (match) {
    return { storefront: match[1].toUpperCase(), type: match[2], id: match[3] + match[4] };
  }
  // Fallback: try to extract just the ID
  const idMatch = url.match(/(pl\.|al\.|s\.|a\.)([a-zA-Z0-9]+)/i);
  if (idMatch) {
    return { storefront: "KE", type: "playlist", id: idMatch[1] + idMatch[2] };
  }
  return null;
}

// ─── Fetch Apple Music Chart/Playlist ───
async function fetchAppleMusicPlaylist(
  storefront: string,
  playlistId: string,
  developerToken: string
): Promise<AppleMusicSong[]> {
  const url = `https://api.music.apple.com/v1/catalog/${storefront.toLowerCase()}/playlists/${playlistId}/tracks`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
    },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Apple Music API ${response.status}: ${err}`);
  }
  const data = await response.json() as { data: AppleMusicSong[] };
  return data.data || [];
}

async function fetchAppleMusicChart(
  storefront: string,
  chartType: string,
  developerToken: string
): Promise<AppleMusicSong[]> {
  // Apple Music charts endpoint: /v1/catalog/{storefront}/charts?types=songs&chart=most-played&limit=100
  const url = new URL(`https://api.music.apple.com/v1/catalog/${storefront.toLowerCase()}/charts`);
  url.searchParams.set("types", "songs");
  url.searchParams.set("chart", chartType);
  url.searchParams.set("limit", "100");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${developerToken}`,
    },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Apple Music API ${response.status}: ${err}`);
  }
  const data = await response.json() as AppleMusicChartResponse;
  const firstChart = data.data?.[0];
  if (!firstChart) return [];
  return firstChart.relationships?.data?.data || [];
}

// ─── Normalize Apple Music Song ───
function normalizeAppleMusicSong(
  song: AppleMusicSong,
  sourceUrl: string,
  rank: number
): NormalizedChartRow | null {
  const attrs = song.attributes;
  if (!attrs) return null;

  const artistNames = [attrs.artistName];
  if (attrs.composerName && attrs.composerName !== attrs.artistName) {
    artistNames.push(attrs.composerName);
  }

  const artistIds = song.relationships?.artists?.data?.map((a) => a.id) || [];
  const albumIds = song.relationships?.albums?.data?.map((a) => a.id) || [];

  const artworkUrl = attrs.artwork?.url
    ? attrs.artwork.url.replace("{w}", "300").replace("{h}", "300")
    : null;

  return {
    sourceProvider: "apple_music",
    sourceUrl,
    sourceRowId: song.id,
    rank,
    previousRank: null,
    movement: "new",
    trackTitle: attrs.name,
    releaseTitle: attrs.albumName,
    artistNames,
    providerTrackId: song.id,
    providerReleaseId: albumIds[0] || null,
    providerArtistIds: artistIds,
    artworkUrl,
    previewUrl: attrs.previews?.[0]?.url ?? null,
    externalUrl: attrs.url ?? null,
    raw: {
      provider: "apple_music",
      songId: song.id,
      albumId: albumIds[0],
      artistIds,
      durationMs: attrs.durationInMillis,
      explicit: attrs.contentRating === "explicit",
      genreNames: attrs.genreNames,
      releaseDate: attrs.releaseDate,
      isrc: attrs.isrc,
    },
  };
}

// ─── Main Fetch ───
export async function fetchFromAppleMusic(
  sourceUrl: string,
  market: string,
  maxRows: number
): Promise<AppleMusicFetchResult> {
  const start = performance.now();
  const warnings: string[] = [];

  // Check if developer token is available
  const devToken = APPLE_MUSIC_DEV_TOKEN;
  if (!devToken) {
    const mockError = getMockProviderError(sourceUrl, "apple_music");
    if (mockError) {
      return {
        success: false,
        normalizedRows: [],
        error: `Apple Music developer token not configured. Set VITE_APPLE_MUSIC_DEVELOPER_TOKEN in .env.local. Also: ${mockError}`,
        rawPayload: { credentialError: true, sourceUrl },
        warnings: ["Apple Music developer token not available — mock data used"],
        metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs: Math.round(performance.now() - start) },
      };
    }
    const mockRows = generateMockProviderRows(sourceUrl, market, maxRows, "apple_music");
    return {
      success: true,
      normalizedRows: mockRows,
      rawPayload: { mock: true, sourceUrl, count: mockRows.length },
      warnings: ["Apple Music developer token not available — mock data used for development. Set VITE_APPLE_MUSIC_DEVELOPER_TOKEN to fetch real data."],
      metrics: { fetchedCount: mockRows.length, normalizedCount: mockRows.length, droppedCount: 0, durationMs: Math.round(performance.now() - start) },
    };
  }

  // Parse URL
  const parsed = parseAppleMusicUrl(sourceUrl);
  if (!parsed) {
    return {
      success: false,
      normalizedRows: [],
      error: `Unsupported Apple Music URL: ${sourceUrl}. Expected format: https://music.apple.com/{storefront}/playlist/{name}/{id}`,
      rawPayload: { parseError: true, sourceUrl },
      warnings,
      metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs: Math.round(performance.now() - start) },
    };
  }

  // Real API fetch
  try {
    let songs: AppleMusicSong[] = [];
    if (parsed.type === "playlist") {
      songs = await fetchAppleMusicPlaylist(parsed.storefront, parsed.id, devToken);
    } else {
      // Try chart endpoint for other types
      songs = await fetchAppleMusicChart(parsed.storefront, "most-played", devToken);
    }

    const items = songs.slice(0, maxRows);
    const normalized: NormalizedChartRow[] = [];
    let dropped = 0;

    for (let i = 0; i < items.length; i++) {
      const row = normalizeAppleMusicSong(items[i], sourceUrl, i + 1);
      if (row) {
        normalized.push(row);
      } else {
        dropped++;
        warnings.push(`Song ${i + 1} has missing attributes (may be unavailable in this storefront)`);
      }
    }

    const durationMs = Math.round(performance.now() - start);

    return {
      success: true,
      normalizedRows: normalized,
      rawPayload: {
        storefront: parsed.storefront,
        type: parsed.type,
        id: parsed.id,
        totalSongs: songs.length,
        fetchedItems: items.length,
        market,
      },
      warnings,
      metrics: {
        fetchedCount: items.length,
        normalizedCount: normalized.length,
        droppedCount: dropped,
        durationMs,
      },
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "Unknown Apple Music API error";
    return {
      success: false,
      normalizedRows: [],
      error: message,
      rawPayload: { apiError: true, sourceUrl, error: message },
      warnings: [`Apple Music API error: ${message}`],
      metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs },
    };
  }
}

// ─── Export helpers ───
export { APPLE_MUSIC_DEV_TOKEN };