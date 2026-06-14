export type ChartEligibilityVisibility = "public" | "admin_only";
export type ChartProgramVisibility = "public" | "private" | "internal_only";
export type ChartKind = "tracks" | "releases" | "artists" | "videos";

export type ArtistGenderEligibilityMode =
  | "any"
  | "female_only"
  | "male_only"
  | "mixed_gender_only"
  | "non_binary_inclusive"
  | "custom";

export type ArtistTypeEligibilityMode =
  | "any"
  | "solo_artists_only"
  | "groups_collectives_only"
  | "bands_only"
  | "duos_only"
  | "labels_only"
  | "custom";

export type ArtistOriginEligibilityMode =
  | "any"
  | "country_only"
  | "multi_country"
  | "region_only"
  | "diaspora_only"
  | "custom";

export type ReleaseTypeEligibility = "single" | "ep" | "album" | "mixtape" | "compilation" | "video" | "live";
export type EligibilityProvider = "spotify" | "apple_music" | "youtube" | "airplay" | "manual" | "registry";

export type ChartEligibilityProfile = {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: ChartEligibilityVisibility;
  publicLabel?: string;
  internalNotes?: string;

  artistGenderEligibility?: {
    mode: ArtistGenderEligibilityMode;
    publicLabel?: string;
    internalNotes?: string;
  };

  artistTypeEligibility?: {
    mode: ArtistTypeEligibilityMode;
  };

  artistOriginEligibility?: {
    mode: ArtistOriginEligibilityMode;
    countries: string[];
    regions: string[];
    cities?: string[];
    diasporaMarkets?: string[];
  };

  releaseEligibility?: {
    releaseTypes: ReleaseTypeEligibility[];
    releaseWindowFrom?: string;
    releaseWindowTo?: string;
    includeReissues: boolean;
    includeRemixes: boolean;
    includeAcousticVersions: boolean;
    includeInstrumentals: boolean;
  };

  trackEligibility?: {
    explicitAllowed: boolean;
    minDurationMs?: number;
    maxDurationMs?: number;
    requireIsrc: boolean;
    requirePreview: boolean;
    allowedLanguages?: string[];
    allowedGenres?: string[];
    excludedGenres?: string[];
  };

  collaborationRules?: {
    allowFeaturedArtists: boolean;
    countFeaturedArtistNationality: boolean;
    primaryArtistMustMatchEligibility: boolean;
    allArtistsMustMatchEligibility: boolean;
    minEligibleArtistsRequired?: number;
  };

  sourceRules?: {
    allowedProviders: EligibilityProvider[];
    requireAtLeastOneProviderId: boolean;
    requireProviderAvailabilityInMarket: boolean;
  };

  reviewRules?: {
    requireManualReviewForUnknownGender: boolean;
    requireManualReviewForUnknownNationality: boolean;
    requireManualReviewForUnknownArtistType: boolean;
    requireManualReviewForGroups: boolean;
    allowUnknownMetadataWithWarning: boolean;
  };

  createdAt: string;
  updatedAt: string;
};

export type CreateChartEligibilityProfileRequest = Omit<ChartEligibilityProfile, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export type UpdateChartEligibilityProfileRequest = Partial<CreateChartEligibilityProfileRequest> & {
  id: string;
};

export type ChartEligibilityDecision = {
  eligible: boolean;
  profileId: string;
  reasonCodes: string[];
  reasonMessages: string[];
  warnings: string[];
  requiresReview: boolean;
};

export type ChartProgramPresentation = {
  publicTitle: string;
  publicSubtitle?: string;
  publicDescription?: string;
  showEligibilityRulesPublicly: boolean;
  publicEligibilityLabel?: string;
  showMarketBreakdown: boolean;
  showSourceBreakdown: boolean;
  showMethodologyPublicly: boolean;
  heroStyle: string;
  coverArtworkMode: "top_entry" | "collage" | "custom" | "series_default";
};

export type ChartMarketScope = {
  id?: string;
  primaryMarketSlug: string;
  includedMarkets: Array<{
    marketSlug: string;
    countryCode: string;
    weight?: number;
  }>;
  aggregationMode: "combined" | "separate_then_combined" | "weighted" | "minimum_presence" | "editorial";
};
