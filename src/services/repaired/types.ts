export interface RepairedGenre {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface RepairedGenreArtist {
  slug: string;
  name: string;
  imageUrl: string;
}

export interface RepairedGenreTrack {
  slug: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  peakRank: number;
}

export interface RepairedRelatedGenre {
  slug: string;
  name: string;
}

export interface RepairedGenreDetail {
  genre: RepairedGenre;
  artists: RepairedGenreArtist[];
  topTracks: RepairedGenreTrack[];
  relatedGenres: RepairedRelatedGenre[];
}

export interface RepairedLabel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  countryCode: string | null;
}

export interface RepairedLabelArtist {
  slug: string;
  name: string;
  artworkUrl: string;
}

export interface RepairedLabelRelease {
  slug: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  artworkUrl: string;
  trackCount: number;
}

export interface RepairedRelatedLabel {
  slug: string;
  name: string;
}

export interface RepairedLabelDetail {
  label: RepairedLabel;
  roster: RepairedLabelArtist[];
  releases: RepairedLabelRelease[];
  relatedLabels: RepairedRelatedLabel[];
}

export interface RepairedTrackRecord {
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
}

export interface RepairedTrackArtist {
  slug: string;
  name: string;
  imageUrl: string;
}

export interface RepairedTrackArtistRole {
  name: string;
  slug: string;
  isPrimary: boolean;
  isFeatured: boolean;
  creditOrder: number;
  role: string;
}

// v28: enriched release with label and track count for NLG summaries
export interface RepairedTrackRelease {
  slug: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  artworkUrl: string;
  trackCount: number;
  labelName: string;
  labelSlug: string;
}

export interface RepairedTrackLabel {
  slug: string;
  name: string;
  countryCode: string | null;
}

export interface RepairedGenreRef {
  slug: string;
  name: string;
}

export interface RepairedTrackDetail {
  track: RepairedTrackRecord;
  // v28: structured per-role artist list (primary, featured, etc.)
  artists: RepairedTrackArtistRole[];
  artist: RepairedTrackArtist;
  release: RepairedTrackRelease | null;
  label: RepairedTrackLabel | null;
  genres: RepairedGenreRef[];
  chartHistory: number[];
  chartAppearances?: Array<{
    editionSlug: string;
    editionLabel: string;
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
  // v28: additional context for NLG
  firstChartedDate?: string;
  editionLabels?: string[];
  sourceProviders?: string[];
}