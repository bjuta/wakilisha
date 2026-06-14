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

export interface RepairedTrackRelease {
  slug: string;
  title: string;
  releaseDate: string;
  releaseType: string;
  artworkUrl: string;
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
  artist: RepairedTrackArtist;
  release: RepairedTrackRelease | null;
  label: RepairedTrackLabel | null;
  genres: RepairedGenreRef[];
  chartHistory: number[];
  peakRank: number | null;
  weeksOnChart: number;
  currentRank: number | null;
  previewUrl?: string | null;
}