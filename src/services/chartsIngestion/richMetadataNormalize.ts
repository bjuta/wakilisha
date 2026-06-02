import type {
  ProviderIdentifierSet,
  ProviderKey,
  ProviderPayloadSnapshot,
  RelationalArtistCredit,
  RichTrackMetadata,
} from "../chartsIntelligence/intelligenceTypes";
import type { NormalizedChartRow } from "./ingestStudioTypes";

function rawObject(row: NormalizedChartRow): Record<string, unknown> {
  return row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    if (["true", "yes", "1", "explicit"].includes(clean)) return true;
    if (["false", "no", "0", "clean"].includes(clean)) return false;
  }
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeProvider(provider: NormalizedChartRow["sourceProvider"]): ProviderKey {
  return provider === "apple_music" ? "apple_music" : "spotify";
}

function releaseDatePrecision(date: string | null): RichTrackMetadata["releaseDatePrecision"] {
  if (!date) return "unknown";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return "day";
  if (/^\d{4}-\d{2}$/.test(date)) return "month";
  if (/^\d{4}$/.test(date)) return "year";
  return "unknown";
}

function buildPayloadHash(row: NormalizedChartRow): string {
  const source = JSON.stringify({ provider: row.sourceProvider, sourceRowId: row.sourceRowId, raw: row.raw });
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return `payload_${Math.abs(hash).toString(16)}`;
}

function providerIdentifiers(row: NormalizedChartRow): ProviderIdentifierSet[] {
  const raw = rawObject(row);
  const provider = normalizeProvider(row.sourceProvider);
  return [{
    provider,
    trackId: row.providerTrackId ?? stringValue(raw.trackId) ?? stringValue(raw.songId) ?? null,
    releaseId: row.providerReleaseId ?? stringValue(raw.albumId) ?? null,
    artistIds: row.providerArtistIds ?? stringArray(raw.artistIds),
    isrc: stringValue(raw.isrc) ?? stringValue(raw.ISRC),
    upc: stringValue(raw.upc) ?? stringValue(raw.UPC),
    externalUrl: row.externalUrl ?? stringValue(raw.externalUrl) ?? null,
    payloadHash: buildPayloadHash(row),
  }];
}

function providerPayload(row: NormalizedChartRow): ProviderPayloadSnapshot {
  return {
    provider: normalizeProvider(row.sourceProvider),
    capturedAt: new Date().toISOString(),
    payloadHash: buildPayloadHash(row),
    rawPayload: row.raw,
  };
}

function inferReleaseType(row: NormalizedChartRow): RichTrackMetadata["releaseType"] {
  const raw = rawObject(row);
  const releaseType = stringValue(raw.releaseType) ?? stringValue(raw.albumType) ?? stringValue(raw.release_type) ?? stringValue(raw.album_type);
  if (!releaseType) return "unknown";
  const clean = releaseType.toLowerCase();
  if (["single", "ep", "album", "mixtape", "compilation", "video", "live"].includes(clean)) return clean as RichTrackMetadata["releaseType"];
  return "unknown";
}

function extractProviderUrls(row: NormalizedChartRow): RichTrackMetadata["providerUrls"] {
  const raw = rawObject(row);
  const urls: RichTrackMetadata["providerUrls"] = [];
  const externalUrl = row.externalUrl ?? stringValue(raw.externalUrl);
  if (externalUrl) urls.push({ provider: normalizeProvider(row.sourceProvider), url: externalUrl });
  return urls;
}

function splitArtistNames(row: NormalizedChartRow): string[] {
  const names = row.artistNames.length ? row.artistNames : [];
  return names.flatMap((name) => {
    if (/\s+(feat\.|ft\.|featuring)\s+/i.test(name)) {
      return name.split(/\s+(?:feat\.|ft\.|featuring)\s+/i);
    }
    return [name];
  }).flatMap((name) => name.split(/\s*,\s*|\s+&\s+|\s+x\s+/i)).map((name) => name.trim()).filter(Boolean);
}

export function normalizeRichTrackMetadata(row: NormalizedChartRow): RichTrackMetadata {
  const raw = rawObject(row);
  const title = row.trackTitle ?? row.releaseTitle ?? "Unknown";
  const releaseDate = stringValue(raw.releaseDate) ?? stringValue(raw.release_date);
  const artwork = row.artworkUrl ?? stringValue(raw.albumArtworkUrl) ?? stringValue(raw.trackArtworkUrl);
  const providerIds = providerIdentifiers(row);

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    canonicalTrackId: null,
    canonicalReleaseId: null,
    isrc: stringValue(raw.isrc) ?? stringValue(raw.ISRC),
    upc: stringValue(raw.upc) ?? stringValue(raw.UPC),
    durationMs: numberValue(raw.durationMs) ?? numberValue(raw.duration_ms),
    explicit: booleanValue(raw.explicit),
    trackNumber: numberValue(raw.trackNumber) ?? numberValue(raw.track_number),
    discNumber: numberValue(raw.discNumber) ?? numberValue(raw.disc_number),
    releaseDate,
    releaseDatePrecision: releaseDatePrecision(releaseDate),
    releaseTitle: row.releaseTitle ?? stringValue(raw.albumName) ?? stringValue(raw.releaseTitle),
    releaseType: inferReleaseType(row),
    labelName: stringValue(raw.label) ?? stringValue(raw.labelName),
    albumArtworkUrl: artwork,
    trackArtworkUrl: artwork,
    previewUrl: row.previewUrl ?? stringValue(raw.previewUrl) ?? stringValue(raw.preview_url),
    providerIds,
    providerUrls: extractProviderUrls(row),
    availableMarkets: stringArray(raw.availableMarkets),
    restrictedMarkets: stringArray(raw.restrictedMarkets),
    providerPayloads: [providerPayload(row)],
  };
}

export function normalizeArtistCredits(row: NormalizedChartRow): RelationalArtistCredit[] {
  const names = splitArtistNames(row);
  const providerArtistIds = row.providerArtistIds ?? stringArray(rawObject(row).artistIds);
  return names.map((displayName, index) => ({
    id: `${row.sourceProvider}_${row.sourceRowId ?? row.providerTrackId ?? row.rank}_artist_${index + 1}`,
    displayName,
    normalizedName: normalizeTitle(displayName),
    role: index === 0 ? "primary_artist" : "featured_artist",
    creditOrder: index + 1,
    canonicalArtistId: null,
    providerArtistIds: providerArtistIds[index]
      ? [{ provider: normalizeProvider(row.sourceProvider), artistIds: [providerArtistIds[index]], externalUrl: null }]
      : [],
    confidence: providerArtistIds[index] ? 0.85 : 0.65,
    reviewStatus: names.length !== row.artistNames.length ? "split_required" : "resolved",
    sourceProvider: normalizeProvider(row.sourceProvider),
    sourceText: row.artistNames.join(", "),
    warnings: names.length !== row.artistNames.length ? ["Artist credit was split from a compound provider string."] : [],
  }));
}

export function enrichRawWithRichMetadata(row: NormalizedChartRow): Record<string, unknown> {
  const raw = rawObject(row);
  const richMetadata = normalizeRichTrackMetadata(row);
  const artistCredits = normalizeArtistCredits(row);
  return {
    ...raw,
    richMetadata,
    artistCredits,
    isrc: richMetadata.isrc ?? raw.isrc,
    upc: richMetadata.upc ?? raw.upc,
    durationMs: richMetadata.durationMs ?? raw.durationMs,
    explicit: richMetadata.explicit ?? raw.explicit,
    releaseDate: richMetadata.releaseDate ?? raw.releaseDate,
    releaseDatePrecision: richMetadata.releaseDatePrecision,
    releaseTitle: richMetadata.releaseTitle ?? raw.releaseTitle,
    releaseType: richMetadata.releaseType ?? raw.releaseType,
    labelName: richMetadata.labelName ?? raw.labelName,
    previewUrl: richMetadata.previewUrl ?? raw.previewUrl,
    availableMarkets: richMetadata.availableMarkets ?? raw.availableMarkets,
    restrictedMarkets: richMetadata.restrictedMarkets ?? raw.restrictedMarkets,
    providerIds: richMetadata.providerIds,
    providerUrls: richMetadata.providerUrls,
    providerPayloads: richMetadata.providerPayloads,
  };
}
