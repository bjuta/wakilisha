export type LegacyWordPressSourceKind =
  | "chart_program"
  | "chart_edition"
  | "chart_entry"
  | "artist"
  | "track"
  | "release"
  | "label"
  | "genre"
  | "article"
  | "guide"
  | "media_asset"
  | "registry_entity";

export type LegacyImportJobStatus =
  | "draft"
  | "dry_run"
  | "mapped"
  | "ready_to_import"
  | "importing"
  | "imported"
  | "failed"
  | "cancelled";

export type LegacyWordPressImportIssueSeverity = "info" | "warning" | "blocking";

export type LegacyWordPressImportIssue = {
  id: string;
  sourceKind: LegacyWordPressSourceKind;
  legacyId?: string | number | null;
  severity: LegacyWordPressImportIssueSeverity;
  code: string;
  message: string;
  suggestedAction?: string;
};

export type LegacyWordPressEntityRef = {
  legacyId: string | number;
  legacySlug?: string | null;
  legacyType: LegacyWordPressSourceKind;
  legacyUrl?: string | null;
  rawPayload: unknown;
};

export type LegacyWordPressChartProgram = LegacyWordPressEntityRef & {
  legacyType: "chart_program";
  title: string;
  publicSlug: string;
  seriesSlug?: string | null;
  marketSlug?: string | null;
  chartKind?: "tracks" | "releases" | "artists" | "videos" | string | null;
};

export type LegacyWordPressChartEdition = LegacyWordPressEntityRef & {
  legacyType: "chart_edition";
  programLegacyId?: string | number | null;
  publicSlug: string;
  editionSlug: string;
  editionDate?: string | null;
  label?: string | null;
  entryCount?: number | null;
};

export type LegacyWordPressChartEntry = LegacyWordPressEntityRef & {
  legacyType: "chart_entry";
  editionLegacyId?: string | number | null;
  rank: number;
  previousRank?: number | null;
  movement?: string | null;
  title: string;
  artistNames: string[];
  artworkUrl?: string | null;
  sourceEntryId?: string | null;
};

export type LegacyWordPressArtist = LegacyWordPressEntityRef & {
  legacyType: "artist";
  name: string;
  slug?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  originIso2?: string | null;
  providerUrls?: Record<string, string>;
};

export type LegacyWordPressTrack = LegacyWordPressEntityRef & {
  legacyType: "track";
  title: string;
  slug?: string | null;
  artistNames: string[];
  isrc?: string | null;
  releaseDate?: string | null;
  artworkUrl?: string | null;
  providerUrls?: Record<string, string>;
};

export type LegacyWordPressTaxonomyEntity = LegacyWordPressEntityRef & {
  legacyType: "label" | "genre";
  name: string;
  slug?: string | null;
  description?: string | null;
};

export type LegacyWordPressContent = LegacyWordPressEntityRef & {
  legacyType: "article" | "guide";
  title: string;
  slug?: string | null;
  status?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
};

export type LegacyWordPressMediaAsset = LegacyWordPressEntityRef & {
  legacyType: "media_asset";
  url: string;
  mimeType?: string | null;
  title?: string | null;
  altText?: string | null;
};

export type LegacyWordPressEntity =
  | LegacyWordPressChartProgram
  | LegacyWordPressChartEdition
  | LegacyWordPressChartEntry
  | LegacyWordPressArtist
  | LegacyWordPressTrack
  | LegacyWordPressTaxonomyEntity
  | LegacyWordPressContent
  | LegacyWordPressMediaAsset
  | LegacyWordPressEntityRef;

export type LegacyWordPressImportDryRun = {
  jobId: string;
  status: "dry_run";
  sourceBaseUrl: string;
  scannedAt: string;
  counts: Partial<Record<LegacyWordPressSourceKind, number>>;
  sampleEntities: LegacyWordPressEntity[];
  issues: LegacyWordPressImportIssue[];
};

export type LegacyWordPressImportJob = {
  id: string;
  status: LegacyImportJobStatus;
  sourceBaseUrl: string;
  createdAt: string;
  updatedAt: string;
  dryRun?: LegacyWordPressImportDryRun | null;
  issues: LegacyWordPressImportIssue[];
};

export type LegacyWordPressImportMapping = {
  sourceKind: LegacyWordPressSourceKind;
  legacyField: string;
  targetTable: string;
  targetField: string;
  transform?: string | null;
  required?: boolean;
};
