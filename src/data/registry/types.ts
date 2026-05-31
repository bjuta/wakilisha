export type Nullable<T> = T | null;

export type ImportedArtist = {
  id: string;
  slug: string;
  name: string;
  imageUrl: Nullable<string>;
  genres: string[];
  country: Nullable<string>;
  bio: Nullable<string>;
  labels: string[];
  trackIds: string[];
  releaseIds: string[];
  chartEntryIds: string[];
};

export type ImportedTrack = {
  id: string;
  slug: string;
  title: string;
  artistNames: string[];
  artistSlugs: string[];
  artistIds: string[];
  releaseId: Nullable<string>;
  labelIds: string[];
  genres: string[];
  artworkUrl: Nullable<string>;
  source: Nullable<string>;
  sourceUrl: Nullable<string>;
  chartEntryIds: string[];
};

export type ImportedRelease = {
  id: string;
  slug: string;
  title: string;
  artistNames: string[];
  artistSlugs: string[];
  artistIds: string[];
  labelIds: string[];
  trackIds: string[];
  artworkUrl: Nullable<string>;
  releaseDate: Nullable<string>;
  year: Nullable<number>;
};

export type ImportedLabel = {
  id: string;
  slug: string;
  name: string;
  country: Nullable<string>;
  logoUrl: Nullable<string>;
  artistIds: string[];
  releaseIds: string[];
  trackIds: string[];
};

export type ImportedGenre = {
  id: string;
  slug: string;
  name: string;
  artistIds: string[];
  trackIds: string[];
};

export type ImportedChartSeries = {
  id: string;
  slug: string;
  label: string;
  description: Nullable<string>;
  status: Nullable<string>;
};

export type ImportedChartEdition = {
  id: string;
  slug: string;
  seriesId: string;
  label: string;
  date: Nullable<string>;
  period: Nullable<string>;
  methodology: Nullable<string>;
};

export type ImportedChartEntry = {
  id: string;
  editionId: string;
  seriesId: string;
  trackId: Nullable<string>;
  rank: number;
  previousRank: Nullable<number>;
  weeksOnChart: Nullable<number>;
  peakPosition: Nullable<number>;
};

export type ImportedMediaAsset = {
  id: string;
  entityId: Nullable<string>;
  entityType: Nullable<string>;
  url: string;
  kind: Nullable<string>;
};

export type ImportedRegistry = {
  artists: ImportedArtist[];
  tracks: ImportedTrack[];
  releases: ImportedRelease[];
  labels: ImportedLabel[];
  genres: ImportedGenre[];
  chartSeries: ImportedChartSeries[];
  chartEditions: ImportedChartEdition[];
  chartEntries: ImportedChartEntry[];
  mediaAssets: ImportedMediaAsset[];
  generatedAt: string;
};
