/**
 * Provider Detection
 * Detects chart data providers from source URLs.
 */

import type { ProviderName } from "./ingestStudioTypes";

export function detectProviderFromUrl(url: string): ProviderName {
  const lower = url.trim().toLowerCase();
  if (lower.includes("spotify.com") || lower.includes("open.spotify.com")) {
    return "spotify";
  }
  if (lower.includes("music.apple.com") || lower.includes("itunes.apple.com")) {
    return "apple_music";
  }
  return "unknown";
}

export function detectProvidersFromUrls(urls: string[]): ProviderName[] {
  const providers = urls.map((url) => detectProviderFromUrl(url));
  return [...new Set(providers)];
}

export function getProviderLabel(provider: ProviderName): string {
  switch (provider) {
    case "spotify": return "Spotify";
    case "apple_music": return "Apple Music";
    case "unknown": return "Unrecognized";
  }
}

export function getProviderColorClass(provider: ProviderName): string {
  switch (provider) {
    case "spotify": return "bg-[#1DB954]/15 text-[#1DB954] border-[#1DB954]/30";
    case "apple_music": return "bg-[#FA233B]/15 text-[#FA233B] border-[#FA233B]/30";
    case "unknown": return "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)] border-[var(--wk-warning)]/30";
  }
}

export function getProviderIcon(provider: ProviderName): string {
  switch (provider) {
    case "spotify": return "ri-spotify-fill";
    case "apple_music": return "ri-apple-fill";
    case "unknown": return "ri-question-line";
  }
}

export function getProviderBgColor(provider: ProviderName): string {
  switch (provider) {
    case "spotify": return "#1DB954";
    case "apple_music": return "#FA233B";
    case "unknown": return "var(--wk-warning)";
  }
}

export function isValidProviderUrl(url: string): boolean {
  return detectProviderFromUrl(url) !== "unknown";
}