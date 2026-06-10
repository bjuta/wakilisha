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
  rawProviderPayloadRef?: string;
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

export type ProviderSearchInput = {
  provider: "apple_music" | "spotify" | string;
  query: string;
  entityType: "all" | ProviderEntityType;
  storefrontOrMarket: string | null;
  limit: number;
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
};

export type ProviderInspectInput = {
  provider: string;
  providerEntityType: ProviderEntityType;
  providerEntityId: string;
  storefrontOrMarket: string | null;
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
  existingShellMatches: Array<{
    shellKey: string;
    registryEntityId: string;
    status: string;
    title: string;
    providerEntityId: string;
  }>;
};

export type RegistryMatchCandidate = {
  registryEntityId: string;
  entityType: ProviderEntityType;
  title: string;
  matchReason: string;
  matchScore: number;
};

export type CreateReleaseShellInput = {
  provider: string;
  providerEntityType: ProviderEntityType;
  providerEntityId: string;
  storefrontOrMarket: string | null;
  selectedEntities: {
    release: boolean;
    artists: string[];
    tracks: string[];
  };
  mode: "create_shell" | "attach";
  targetRegistryEntityId?: string;
  idempotencyKey: string;
  actor?: string;
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
};

export interface ProviderAdapter {
  provider: string;
  search(input: ProviderSearchInput): Promise<ProviderSearchResponse>;
  inspect(input: ProviderInspectInput): Promise<ProviderInspectResponse>;
}