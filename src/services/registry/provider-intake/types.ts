export type ProviderEntityType = "artist" | "release" | "track" | "label";

export type ProviderSearchResult = {
  provider: "apple_music" | "spotify" | "manual" | string;
  providerEntityType: ProviderEntityType;
  providerEntityId: string;
  providerUrl: string | null;
  title: string;
  subtitle: string | null;
  artistDisplayName: string | null;
  artworkUrl: string | null;
  confidenceScore: number;
  source: {
    searchQuery: string;
    storefrontOrMarket: string | null;
    fetchedAt: string;
    rawKind: string;
  };
  summaryFields: Array<{
    key: string;
    label: string;
    value: string | number | null;
  }>;
  relatedEntities: {
    artists: ProviderRelatedEntity[];
    releases: ProviderRelatedEntity[];
    tracks: ProviderRelatedEntity[];
    labels: ProviderRelatedEntity[];
  };
};

export type ProviderRelatedEntity = {
  providerEntityType: ProviderEntityType;
  providerEntityId: string;
  name: string;
  role?: string | null;
  providerUrl?: string | null;
  artworkUrl?: string | null;
  confidenceScore?: number | null;
};

export type ProviderSearchResponse = {
  provider: string;
  query: string;
  storefrontOrMarket: string | null;
  groups: {
    artists: ProviderSearchResult[];
    releases: ProviderSearchResult[];
    tracks: ProviderSearchResult[];
    labels: ProviderRelatedEntity[];
  };
  rawResultCount: number;
  normalizedResultCount: number;
  error?: string;
};

export type RegistryMatchCandidate = {
  registryEntityId: string;
  entityType: ProviderEntityType;
  title: string;
  matchReason: string;
  matchScore: number;
};

export type ExistingShellMatch = {
  shellKey: string;
  registryEntityId: string;
  status: string;
  title: string;
  providerEntityId: string;
};

export type ProviderInspectResponse = {
  result: ProviderSearchResult;
  detail: {
    release: ProviderSearchResult | null;
    artists: ProviderSearchResult[];
    tracks: ProviderSearchResult[];
    labels: ProviderRelatedEntity[];
    providerLinks: Array<{
      entityType: ProviderEntityType;
      providerEntityId: string;
      providerUrl: string | null;
    }>;
    sourceFields: Array<{
      key: string;
      label: string;
      value: string | number | null;
    }>;
  };
  possibleRegistryMatches: {
    artists: RegistryMatchCandidate[];
    releases: RegistryMatchCandidate[];
    tracks: RegistryMatchCandidate[];
  };
  existingShellMatches: ExistingShellMatch[];
};

export type CreateReleaseShellResult = {
  shell: {
    shellKey: string;
    registryEntityId: string;
    status: string;
  };
  writes: {
    providerFieldObservations: number;
    registryEnrichmentSuggestions: number;
    providerEntityLinks: number;
    lifecycleEvents: number;
  };
  skipped: Array<{
    entityType: string;
    providerEntityId: string;
    reason: string;
  }>;
  mode?: "create" | "refresh" | "attach" | "backfill";
  slug?: {
    pattern: string;
    scoped: string;
    artistSlug: string;
    artistName: string;
  };
  release?: {
    id: string;
    slug: string;
    createdNew: boolean;
  };
};

export type IntakeSearchInput = {
  provider: "apple_music" | "spotify";
  storefront: string;
  entityType: "all" | ProviderEntityType;
  query: string;
  limit?: number;
};

export type ProviderIntakeMode = "create_shell" | "attach_to_shell" | "backfill_existing_release" | "refresh_shell";

export type IntakeCreateInput = {
  provider: string;
  providerEntityType: ProviderEntityType;
  providerEntityId: string;
  storefrontOrMarket: string | null;
  mode: ProviderIntakeMode;
  targetRegistryEntityId?: string;
  idempotencyKey: string;
  selectedTrackIds?: string[];
};