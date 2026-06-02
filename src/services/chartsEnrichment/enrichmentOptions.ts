export type PreviewProvider = "apple_music" | "spotify" | "youtube" | "acrcloud";

export type IngestEnrichmentOptions = {
  ingestWithPreviewData: boolean;
  previewProviderPriority: PreviewProvider[];
  allowYouTubeFallback: boolean;
  allowAcrCloudRecovery: boolean;
  requirePreview: boolean;
  enrichArtists: boolean;
  enrichLabels: boolean;
  enrichReleaseMetadata: boolean;
  enrichMarketAvailability: boolean;
  preserveRawProviderPayloads: boolean;
};

export const DEFAULT_INGEST_ENRICHMENT_OPTIONS: IngestEnrichmentOptions = {
  ingestWithPreviewData: false,
  previewProviderPriority: ["apple_music", "spotify", "youtube", "acrcloud"],
  allowYouTubeFallback: true,
  allowAcrCloudRecovery: false,
  requirePreview: false,
  enrichArtists: true,
  enrichLabels: true,
  enrichReleaseMetadata: true,
  enrichMarketAvailability: true,
  preserveRawProviderPayloads: true,
};

export function normalizeIngestEnrichmentOptions(input?: Partial<IngestEnrichmentOptions> | null): IngestEnrichmentOptions {
  return {
    ...DEFAULT_INGEST_ENRICHMENT_OPTIONS,
    ...(input ?? {}),
    previewProviderPriority: input?.previewProviderPriority?.length
      ? input.previewProviderPriority
      : DEFAULT_INGEST_ENRICHMENT_OPTIONS.previewProviderPriority,
  };
}

export function summarizeEnrichmentOptions(options: IngestEnrichmentOptions): string[] {
  const out: string[] = [];
  out.push(options.ingestWithPreviewData ? "Preview data enabled" : "Preview data disabled");
  if (options.ingestWithPreviewData) {
    out.push(`Preview priority: ${options.previewProviderPriority.join(" → ").replace(/_/g, " ")}`);
    if (options.allowYouTubeFallback) out.push("YouTube fallback allowed");
    if (options.allowAcrCloudRecovery) out.push("ACRCloud recovery allowed");
    if (options.requirePreview) out.push("Preview required for eligibility");
  }
  if (options.enrichArtists) out.push("Artist enrichment enabled");
  if (options.enrichLabels) out.push("Label enrichment enabled");
  if (options.enrichReleaseMetadata) out.push("Release metadata enrichment enabled");
  if (options.enrichMarketAvailability) out.push("Market availability enrichment enabled");
  if (options.preserveRawProviderPayloads) out.push("Raw provider payloads preserved");
  return out;
}
