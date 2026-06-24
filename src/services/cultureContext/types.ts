export type CultureEntityType =
  | "track"
  | "artist"
  | "release"
  | "label"
  | "genre"
  | "chart"
  | "searchResult";

export type CultureContextSurface =
  | "heroIntro"
  | "cardBlurb"
  | "searchSnippet"
  | "seoDescription"
  | "chartNote"
  | "whyItMatters"
  | "startHere"
  | "adminQualityNote";

export type CultureContextTone = "public" | "admin";
export type CultureContextLength = "short" | "medium" | "long";
export type CultureContextConfidence = "high" | "medium" | "low";

export type CultureContextOptions = {
  tone?: CultureContextTone;
  maxLength?: CultureContextLength;
  includeStats?: boolean;
};

export type CultureContextInput = {
  entityType: CultureEntityType;
  surface: CultureContextSurface;
  data: unknown;
  options?: CultureContextOptions;
};

export type CultureContextOutput = {
  text: string;
  confidence: CultureContextConfidence;
  factsUsed: string[];
  warnings: string[];
  recipe: string;
  version: string;
};

export type ReleaseType =
  | "album"
  | "ep"
  | "single"
  | "mixtape"
  | "compilation"
  | "soundtrack"
  | "live"
  | "deluxe"
  | "unknown";

export type TrackFacts = {
  title: string;
  primaryArtists: string[];
  featuredArtists: string[];
  releaseTitle?: string;
  releaseType?: ReleaseType;
  releaseYear?: string;
  releaseMonth?: string;
  releaseDate?: string;
  trackNumber?: number;
  trackCount?: number;
  genres: string[];
  country?: string;
  labelName?: string;
  peakRank?: number;
  weeksOnChart?: number;
  latestRank?: number;
  isNewEntry?: boolean;
  isLongRunner?: boolean;
  isRising?: boolean;
  previewAvailable?: boolean;
};

export type ArtistFacts = {
  name: string;
  country?: string;
  genres: string[];
  releaseCount?: number;
  trackCount?: number;
  chartEntryCount?: number;
  peakChartPosition?: number;
  collaborations: Array<{ name: string; count?: number }>;
  labels: string[];
  yearsActive?: string;
};

export type ReleaseFacts = {
  title: string;
  releaseType: ReleaseType;
  artistNames: string[];
  featuredArtistNames: string[];
  releaseYear?: string;
  releaseMonth?: string;
  releaseDate?: string;
  trackCount?: number;
  totalDuration?: string;
  labelName?: string;
  genres: string[];
  chartEntryCount?: number;
  topChartPeak?: number;
  hasMultipleArtists?: boolean;
  isCompilation?: boolean;
  country?: string;
  standoutTracks: Array<{
    title: string;
    artistNames: string[];
    peakRank?: number;
  }>;
};

export type LabelFacts = {
  name: string;
  country?: string;
  artistCount?: number;
  releaseCount?: number;
  trackCount?: number;
  chartEntryCount?: number;
  genres: string[];
  topArtists: string[];
  yearsActive?: string;
};

export type GenreFacts = {
  name: string;
  artistCount?: number;
  trackCount?: number;
  releaseCount?: number;
  countries: string[];
  topArtists: string[];
  topTracks: string[];
};

export type ChartFacts = {
  title: string;
  country?: string;
  periodLabel?: string;
  totalEntries?: number;
  newEntries?: number;
  biggestClimbers: string[];
  longestRunners: string[];
  numberOne?: string;
  numberOneArtists: string[];
};

export type SearchResultFacts = {
  title: string;
  entityType: CultureEntityType;
  artists?: string[];
  subtitle?: string;
  country?: string;
  genres: string[];
  releaseType?: ReleaseType;
  hasChartContext?: boolean;
};

export type CultureFacts =
  | TrackFacts
  | ArtistFacts
  | ReleaseFacts
  | LabelFacts
  | GenreFacts
  | ChartFacts
  | SearchResultFacts;

export type CultureRecipeContext<TFacts extends CultureFacts> = {
  facts: TFacts;
  surface: CultureContextSurface;
  options: Required<CultureContextOptions>;
};

export type CultureRecipeResult = Omit<CultureContextOutput, "version" | "warnings"> & {
  warnings?: string[];
};
