/**
 * Unified Provider Credential Reader
 *
 * Single source of truth for reading provider API credentials across the
 * entire React frontend. Every service that needs Spotify, Apple Music,
 * ACRCloud, YouTube, or Airplay credentials MUST go through this reader.
 *
 * Priority chain (first match wins):
 *   1. localStorage (env_* keys)          — saved via Settings → Integrations
 *   2. import.meta.env (VITE_* keys)      — build-time .env.local
 *   3. null                               — no credential available
 *
 * The edge functions (chart-ingest-api, backfill-chart-artwork) have their
 * own `readCredential()` that checks Deno.env → admin_settings_secrets.
 * This reader is the FRONTEND counterpart.
 */

import { readEnvValue } from "./providerCredentialStore";

// ══════════════════════════════════════════════════════════════════════════
// Core credential lookup
// ══════════════════════════════════════════════════════════════════════════

/**
 * Read a single credential value.
 *
 * @param envVar - The canonical env var name (e.g. "SPOTIFY_CLIENT_ID")
 * @returns The credential value, or null if not configured anywhere
 */
export function readCredential(envVar: string): string | null {
  // 1. localStorage from Settings → Integrations page
  const localValue = readEnvValue(envVar);
  if (localValue) return localValue;

  // 2. Build-time VITE_* env from .env.local
  const viteKey = `VITE_${envVar}`;
  try {
    const envMap = (import.meta as unknown as { env: Record<string, string> }).env;
    const viteValue = envMap?.[viteKey];
    if (viteValue) return viteValue;
  } catch {
    // import.meta.env not available (e.g. SSR)
  }

  return null;
}

/**
 * Read a credential as a non-null string, returning an empty string if missing.
 */
export function readCredentialString(envVar: string): string {
  return readCredential(envVar) ?? "";
}

/**
 * Read a credential as a number, returning null if missing or unparseable.
 */
export function readCredentialNumber(envVar: string): number | null {
  const raw = readCredential(envVar);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Read a credential as a boolean toggle (truthy/falsy).
 */
export function readCredentialBoolean(envVar: string): boolean {
  const raw = readCredential(envVar);
  if (raw === null) return false;
  return raw.toLowerCase() === "true" || raw === "1";
}

// ══════════════════════════════════════════════════════════════════════════
// Provider credential bundles
// ══════════════════════════════════════════════════════════════════════════

export interface SpotifyCredentials {
  clientId: string | null;
  clientSecret: string | null;
  market: string;
  configured: boolean;
}

export function readSpotifyCredentials(): SpotifyCredentials {
  const clientId = readCredential("SPOTIFY_CLIENT_ID");
  const clientSecret = readCredential("SPOTIFY_CLIENT_SECRET");
  const market = readCredential("SPOTIFY_MARKET") || "KE";
  return {
    clientId,
    clientSecret,
    market,
    configured: !!(clientId && clientSecret),
  };
}

export interface AppleMusicCredentials {
  teamId: string | null;
  keyId: string | null;
  privateKey: string | null;
  developerToken: string | null;
  storefront: string;
  serviceId: string | null;
  tokenTtlHours: number;
  configured: boolean;
}

export function readAppleMusicCredentials(): AppleMusicCredentials {
  const teamId = readCredential("APPLE_MUSIC_TEAM_ID");
  const keyId = readCredential("APPLE_MUSIC_KEY_ID");
  const privateKey = readCredential("APPLE_MUSIC_PRIVATE_KEY");
  const developerToken = readCredential("APPLE_MUSIC_DEVELOPER_TOKEN");
  const storefront = readCredential("APPLE_MUSIC_STOREFRONT") || "ke";
  const serviceId = readCredential("APPLE_MUSIC_SERVICE_ID");
  const tokenTtlHours = readCredentialNumber("APPLE_MUSIC_TOKEN_TTL") ?? 24;

  return {
    teamId,
    keyId,
    privateKey,
    developerToken,
    storefront,
    serviceId,
    tokenTtlHours,
    configured: !!(teamId && keyId && (privateKey || developerToken)),
  };
}

export interface AcrCloudCredentials {
  host: string | null;
  accessKey: string | null;
  accessSecret: string | null;
  callbackSecret: string | null;
  configured: boolean;
}

export function readAcrCloudCredentials(): AcrCloudCredentials {
  const host = readCredential("ACR_HOST");
  const accessKey = readCredential("ACR_ACCESS_KEY");
  const accessSecret = readCredential("ACR_ACCESS_SECRET");
  const callbackSecret = readCredential("ACR_CALLBACK_SECRET");

  return {
    host,
    accessKey,
    accessSecret,
    callbackSecret,
    configured: !!(host && accessKey && accessSecret),
  };
}

export interface YouTubeCredentials {
  apiKey: string | null;
  configured: boolean;
}

export function readYouTubeCredentials(): YouTubeCredentials {
  const apiKey = readCredential("YOUTUBE_API_KEY");
  return {
    apiKey,
    configured: !!apiKey,
  };
}

export interface AirplayCredentials {
  apiBase: string | null;
  apiKey: string | null;
  configured: boolean;
}

export function readAirplayCredentials(): AirplayCredentials {
  const apiBase = readCredential("AIRPLAY_API_BASE");
  const apiKey = readCredential("AIRPLAY_API_KEY");
  return {
    apiBase,
    apiKey,
    configured: !!(apiBase && apiKey),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Provider health (for UI health panels)
// ══════════════════════════════════════════════════════════════════════════

export type ProviderCredentialHealth = {
  provider: string;
  status: "live" | "mocked" | "missing_credentials";
  message: string;
  envVars: string[];
};

/**
 * Returns the real credential health for all supported providers,
 * checking both localStorage (integrations page) and VITE_* env vars.
 */
export function getProviderCredentialHealth(): ProviderCredentialHealth[] {
  const spotify = readSpotifyCredentials();
  const apple = readAppleMusicCredentials();
  const acr = readAcrCloudCredentials();
  const youtube = readYouTubeCredentials();
  const airplay = readAirplayCredentials();

  return [
    {
      provider: "Spotify",
      status: spotify.configured ? "live" : "missing_credentials",
      message: spotify.configured
        ? "Credentials configured — real API calls will be made"
        : "Missing credentials — set in Settings → Integrations or .env.local",
      envVars: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    },
    {
      provider: "Apple Music",
      status: apple.configured ? "live" : "missing_credentials",
      message: apple.configured
        ? "Credentials configured — real API calls will be made"
        : "Missing credentials — set in Settings → Integrations or .env.local",
      envVars: ["APPLE_MUSIC_TEAM_ID", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_PRIVATE_KEY or APPLE_MUSIC_DEVELOPER_TOKEN"],
    },
    {
      provider: "ACRCloud",
      status: acr.configured ? "live" : "missing_credentials",
      message: acr.configured
        ? "ACRCloud configured — audio fingerprint enrichment available"
        : "Missing ACRCloud credentials — set in Settings → Integrations or .env.local",
      envVars: ["ACR_HOST", "ACR_ACCESS_KEY", "ACR_ACCESS_SECRET"],
    },
    {
      provider: "YouTube",
      status: youtube.configured ? "live" : "missing_credentials",
      message: youtube.configured
        ? "YouTube API key configured — video search enrichment active"
        : "Missing YouTube API key — set in Settings → Integrations or .env.local",
      envVars: ["YOUTUBE_API_KEY"],
    },
    {
      provider: "Airplay",
      status: airplay.configured ? "live" : "missing_credentials",
      message: airplay.configured
        ? "Airplay credentials configured"
        : "Missing Airplay credentials — set in Settings → Integrations or .env.local",
      envVars: ["AIRPLAY_API_BASE", "AIRPLAY_API_KEY"],
    },
  ];
}