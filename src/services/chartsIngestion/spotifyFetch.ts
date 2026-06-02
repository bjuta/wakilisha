/**
 * Spotify Provider Fetch Service
 * Fetches real playlist data from Spotify Web API when credentials are available.
 * Falls back to deterministic mock data when credentials are missing.
 */

import type { NormalizedChartRow } from "./ingestStudioTypes";
import { generateMockProviderRows, getMockProviderError } from "./mockTracks";

// ─── Spotify API Types ───
interface SpotifyPlaylistTrack {
  track: {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    album: {
      id: string;
      name: string;
      images: { url: string; height: number; width: number }[];
    };
    preview_url: string | null;
    external_urls: { spotify: string };
    duration_ms: number;
    explicit: boolean;
    popularity: number;
  } | null;
  added_at: string;
}

interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  tracks: {
    items: SpotifyPlaylistTrack[];
    total: number;
    next: string | null;
  };
}

// ─── Configuration ───
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET as string | undefined;

export type SpotifyFetchResult = {
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
export function parseSpotifyPlaylistUrl(url: string): { type: "playlist"; id: string } | null {
  const match = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/i);
  if (match) return { type: "playlist", id: match[1] };
  return null;
}

// ─── Client Credentials Token ───
async function getSpotifyAccessToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) return null;
    const data = await response.json() as { access_token: string; token_type: string; expires_in: number };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ─── Fetch Playlist Tracks ───
async function fetchSpotifyPlaylist(
  playlistId: string,
  accessToken: string,
  market?: string
): Promise<SpotifyPlaylistResponse> {
  const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}`);
  if (market) url.searchParams.set("market", market);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Spotify API ${response.status}: ${err}`);
  }
  return response.json() as Promise<SpotifyPlaylistResponse>;
}

// ─── Normalize Spotify Track ───
function normalizeSpotifyTrack(
  item: SpotifyPlaylistTrack,
  sourceUrl: string,
  rank: number
): NormalizedChartRow | null {
  if (!item.track) return null;
  const t = item.track;
  return {
    sourceProvider: "spotify",
    sourceUrl,
    sourceRowId: t.id,
    rank,
    previousRank: null,
    movement: "new",
    trackTitle: t.name,
    releaseTitle: t.album?.name,
    artistNames: t.artists.map((a) => a.name),
    providerTrackId: t.id,
    providerReleaseId: t.album?.id,
    providerArtistIds: t.artists.map((a) => a.id),
    artworkUrl: t.album?.images?.[0]?.url ?? null,
    previewUrl: t.preview_url,
    externalUrl: t.external_urls?.spotify ?? null,
    raw: {
      provider: "spotify",
      trackId: t.id,
      albumId: t.album?.id,
      artistIds: t.artists.map((a) => a.id),
      durationMs: t.duration_ms,
      explicit: t.explicit,
      popularity: t.popularity,
      addedAt: item.added_at,
    },
  };
}

// ─── Main Fetch ───
export async function fetchFromSpotify(
  sourceUrl: string,
  market: string,
  maxRows: number
): Promise<SpotifyFetchResult> {
  const start = performance.now();
  const warnings: string[] = [];

  // Check if credentials are available
  const token = await getSpotifyAccessToken();
  if (!token) {
    const mockError = getMockProviderError(sourceUrl, "spotify");
    if (mockError) {
      return {
        success: false,
        normalizedRows: [],
        error: `Spotify credentials not configured. Set VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET in .env.local. Also: ${mockError}`,
        rawPayload: { credentialError: true, sourceUrl },
        warnings: ["Spotify client credentials not available — mock data used"],
        metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs: Math.round(performance.now() - start) },
      };
    }
    // No credentials — use realistic mock
    const mockRows = generateMockProviderRows(sourceUrl, market, maxRows, "spotify");
    return {
      success: true,
      normalizedRows: mockRows,
      rawPayload: { mock: true, sourceUrl, count: mockRows.length },
      warnings: ["Spotify client credentials not available — mock data used for development. Set VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET to fetch real data."],
      metrics: { fetchedCount: mockRows.length, normalizedCount: mockRows.length, droppedCount: 0, durationMs: Math.round(performance.now() - start) },
    };
  }

  // Parse URL
  const parsed = parseSpotifyPlaylistUrl(sourceUrl);
  if (!parsed) {
    return {
      success: false,
      normalizedRows: [],
      error: `Unsupported Spotify URL: ${sourceUrl}. Expected format: https://open.spotify.com/playlist/{id}`,
      rawPayload: { parseError: true, sourceUrl },
      warnings,
      metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs: Math.round(performance.now() - start) },
    };
  }

  // Real API fetch
  try {
    const playlist = await fetchSpotifyPlaylist(parsed.id, token, market);
    const items = playlist.tracks.items.slice(0, maxRows);
    const normalized: NormalizedChartRow[] = [];
    let dropped = 0;

    for (let i = 0; i < items.length; i++) {
      const row = normalizeSpotifyTrack(items[i], sourceUrl, i + 1);
      if (row) {
        normalized.push(row);
      } else {
        dropped++;
        warnings.push(`Item ${i + 1} has no track data (may be a local file or unavailable track)`);
      }
    }

    const durationMs = Math.round(performance.now() - start);

    return {
      success: true,
      normalizedRows: normalized,
      rawPayload: {
        playlistId: parsed.id,
        playlistName: playlist.name,
        totalTracks: playlist.tracks.total,
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
    const message = err instanceof Error ? err.message : "Unknown Spotify API error";
    return {
      success: false,
      normalizedRows: [],
      error: message,
      rawPayload: { apiError: true, sourceUrl, error: message },
      warnings: [`Spotify API error: ${message}`],
      metrics: { fetchedCount: 0, normalizedCount: 0, droppedCount: 0, durationMs },
    };
  }
}

// ─── Export helpers ───
export { getSpotifyAccessToken };