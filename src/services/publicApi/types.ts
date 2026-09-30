export interface PublicApiGenre {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface PublicApiGenreArtist {
  slug: string;
  name: string;
  imageUrl: string;
}

export interface PublicApiGenreTrack {
  slug: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  peakRank: number;
}

export interface PublicApiRelatedGenre {
  slug: string;
  name: string;
}

export interface PublicApiGenreRelease {
  slug: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  artworkUrl: string;
  trackCount: number;
  artistName: string;
}

export interface PublicGenreDetail {
  genre: PublicApiGenre;
  artists: PublicApiGenreArtist[];
  releases: PublicApiGenreRelease[];
  topTracks: PublicApiGenreTrack[];
  relatedGenres: PublicApiRelatedGenre[];
}

export interface PublicApiLabel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  countryCode: string | null;
}

export interface PublicApiLabelArtist {
  slug: string;
  name: string;
  artworkUrl: string;
}

export interface PublicApiLabelRelease {
  slug: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  artworkUrl: string;
  trackCount: number;
  artistName: string;
}

export interface PublicApiRelatedLabel {
  slug: string;
  name: string;
}

export interface PublicLabelDetail {
  label: PublicApiLabel;
  roster: PublicApiLabelArtist[];
  releases: PublicApiLabelRelease[];
  relatedLabels: PublicApiRelatedLabel[];
}

export interface PublicTrackRecord {
  id: string;
  slug: string;
  title: string;
  durationMs: number;
  artworkUrl: string;
  isrc: string | null;
  explicit: boolean;
  trackNumber: number;
  discNumber: number;
  metadata: Record<string, unknown>;
  status: string;
  previewUrl?: string | null;
  appleMusicId?: string | null;
  appleMusicCatalogId?: string | null;
}

export interface PublicTrackArtist {
  slug: string;
  name: string;
  imageUrl: string;
}

export interface PublicTrackArtistRole {
  artistId?: string;
  name: string;
  slug: string;
  isPrimary: boolean;
  isFeatured: boolean;
  creditOrder: number;
  role: string;
}

export interface PublicTrackRouteBinding {
  artistId: string;
  artistSlug: string;
  artistName: string;
  displaySequence: number;
  isCanonical: boolean;
  path: string;
}

export interface PublicContributionResolvedEntity {
  kind: "person" | "artist" | "organization";
  id: string;
  name: string;
  path: string | null;
}

export interface PublicMusicContribution {
  id: string;
  creditedName: string;
  roleKey: string;
  roleLabel: string;
  instrument: string | null;
  detail: string | null;
  creditOrder: number | null;
  resolvedEntity: PublicContributionResolvedEntity | null;
}

export interface PublicTrackWorkProvenance {
  id: string;
  title: string;
  relationshipKind: string;
  contributions: PublicMusicContribution[];
}

export interface PublicProvenanceReceipt {
  summary: string;
  lastCheckedAt: string | null;
}

// v28: enriched release with label and track count for NLG summaries
export interface PublicTrackRelease {
  slug: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  artworkUrl: string;
  trackCount: number;
  labelName: string;
  labelSlug: string;
  tracks?: Array<{
    id: string;
    slug: string;
    title: string;
    artist: string;
    duration: number;
    trackNumber: number;
    artworkUrl: string;
    previewUrl?: string;
    appleMusicId?: string | null;
    appleMusicCatalogId?: string | null;
  }>;
}

export interface PublicTrackLabel {
  slug: string;
  name: string;
  countryCode: string | null;
}

export interface PublicTrackGenreRef {
  slug: string;
  name: string;
}

export interface PublicTrackDetail {
  track: PublicTrackRecord;
  // v28: structured per-role artist list (primary, featured, etc.)
  artists: PublicTrackArtistRole[];
  artist: PublicTrackArtist;
  canonicalPath: string;
  routeBindings: PublicTrackRouteBinding[];
  recordingContributions: PublicMusicContribution[];
  works: PublicTrackWorkProvenance[];
  provenanceReceipt: PublicProvenanceReceipt | null;
  release: PublicTrackRelease | null;
  label: PublicTrackLabel | null;
  genres: PublicTrackGenreRef[];
  chartHistory: number[];
  chartAppearances?: Array<{
    editionSlug: string;
    editionLabel: string;
    familySlug?: string;
    date: string;
    rank: number;
    previousRank: number | null;
    movement: string;
  }>;
  chartAppearanceCount?: number;
  peakRank: number | null;
  weeksOnChart: number;
  currentRank: number | null;
  previousRank?: number | null;
  movement?: string;
  movementAmount?: number;
  previewUrl?: string | null;
  appleMusicId?: string | null;
  appleMusicCatalogId?: string | null;
  // v28: additional context for NLG
  firstChartedDate?: string;
  editionLabels?: string[];
  sourceProviders?: string[];
}