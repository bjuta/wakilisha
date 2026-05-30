export type Relationship = {
  sourceEntityType: string;
  sourceEntityId: string;
  relationshipType: string;
  targetEntityType: string;
  targetEntityId: string;
  position?: number | null;
  role?: string | null;
  confidence: number;
  source?: string;
  sourceRef?: string;
  sourcePayload?: unknown;
  needsReview: boolean;
  reviewReason?: string | null;
};

export type ReviewItem = {
  entityType: string;
  entityId: string;
  label: string;
  issue: string;
  source: string;
  recommendation: string;
};

export type RouteCoverage = {
  totalOldSlugs: number;
  activeRoutes: number;
  redirects: number;
  retired: number;
  duplicates: number;
  flagged: number;
  unresolved: number;
  byEntityType: Record<string, number>;
};

export type PlaybackCoverage = {
  totalTracks: number;
  tracksWithPreview: number;
  tracksWithAppleId: number;
  tracksWithIsrc: number;
  tracksWithArtwork: number;
  tracksWithoutPlayable: number;
  byProvider: Record<string, number>;
};

export type ContentClassification = {
  total: number;
  articles: number;
  guides: number;
  surfacePages: number;
  appMounts: number;
  taxonomyShells: number;
  utilityPages: number;
  commercePages: number;
  retire: number;
  review: number;
};

export type GraphCoverage = {
  totalTracks: number;
  tracksWithArtists: number;
  tracksWithoutArtists: number;
  releasesWithTracklists: number;
  releasesWithoutTracklists: number;
  artistsWithGenres: number;
  chartEntriesLinked: number;
  mediaAssetsLinked: number;
  oldRoutesResolved: number;
  oldRoutesUnresolved: number;
};