// WAKILISHA Provider Identity Control Plane — pure resolver kernel.
// Architecture authority: #1163 / #1164.
// This module is intentionally read-only: no Supabase client, no Registry DML.

export const PROVIDER_IDENTITY_CONTRACT_VERSION = "provider-identity-v1" as const;

export const PROVIDER_KEYS_V1 = [
  "apple_music",
  "spotify",
  "youtube",
  "audiomack",
  "boomplay",
  "mdundo",
  "soundcloud",
  "deezer",
  "tidal",
  "amazon_music",
  "shazam",
  "tiktok",
  "meta_music",
] as const;

export type ProviderKeyV1 = (typeof PROVIDER_KEYS_V1)[number];

export const PROVIDER_OBJECT_TYPES_V1 = [
  "track",
  "release",
  "artist",
  "playlist",
  "chart",
  "video",
  "channel",
  "work",
  "other_reviewed",
] as const;

export type ProviderObjectTypeV1 = (typeof PROVIDER_OBJECT_TYPES_V1)[number];

export const PROVIDER_IDENTIFIER_SCHEMES_V1 = [
  "isrc",
  "upc",
  "ean",
  "iswc",
  "ipi",
  "cae",
  "isni",
  "musicbrainz",
] as const;

export type ProviderIdentifierSchemeV1 =
  (typeof PROVIDER_IDENTIFIER_SCHEMES_V1)[number];

export const PROVIDER_CAPABILITY_KEYS_V1 = [
  "exact_object_lookup",
  "object_search",
  "stable_track_id",
  "stable_release_id",
  "stable_artist_id",
  "canonical_url",
  "isrc_observation",
  "upc_observation",
  "artist_credit_observation",
  "release_relationship_observation",
  "chart_observation",
  "rank_observation",
  "historical_period_lookup",
  "current_only_observation",
  "territory_specific_chart",
  "cardinal_count_observation",
  "playback",
  "preview_audio",
  "video_playback",
  "artwork",
  "work_identifier_observation",
  "contributor_observation",
  "label_observation",
  "rights_claim_observation",
  "provenance_observation",
  "requires_credentials",
  "public_fetch",
  "rate_limited",
  "webhook_or_push",
  "pagination",
] as const;

export type ProviderCapabilityKeyV1 =
  (typeof PROVIDER_CAPABILITY_KEYS_V1)[number];

export type ProviderCapabilityStatusV1 =
  | "implemented"
  | "partial"
  | "architecture_ready";

export type ProviderCapabilityProfileV1 = {
  status: ProviderCapabilityStatusV1;
  observedCapabilities: readonly ProviderCapabilityKeyV1[];
};

// This profile records capabilities already evidenced in current WAKILISHA
// surfaces. Empty capability arrays mean vocabulary-ready, not implemented.
export const PROVIDER_CAPABILITY_PROFILE_V1: Record<
  ProviderKeyV1,
  ProviderCapabilityProfileV1
> = {
  apple_music: {
    status: "implemented",
    observedCapabilities: [
      "exact_object_lookup",
      "object_search",
      "stable_track_id",
      "stable_release_id",
      "stable_artist_id",
      "canonical_url",
      "isrc_observation",
      "artist_credit_observation",
      "release_relationship_observation",
      "chart_observation",
      "rank_observation",
      "current_only_observation",
      "territory_specific_chart",
      "playback",
      "preview_audio",
      "artwork",
      "requires_credentials",
      "rate_limited",
    ],
  },
  spotify: {
    status: "implemented",
    observedCapabilities: [
      "exact_object_lookup",
      "object_search",
      "stable_track_id",
      "stable_release_id",
      "stable_artist_id",
      "canonical_url",
      "isrc_observation",
      "artist_credit_observation",
      "release_relationship_observation",
      "chart_observation",
      "playback",
      "preview_audio",
      "artwork",
      "requires_credentials",
      "pagination",
      "rate_limited",
    ],
  },
  youtube: {
    status: "partial",
    observedCapabilities: [
      "stable_track_id",
      "canonical_url",
      "chart_observation",
      "rank_observation",
      "territory_specific_chart",
      "video_playback",
      "public_fetch",
    ],
  },
  audiomack: {
    status: "partial",
    observedCapabilities: [
      "stable_track_id",
      "canonical_url",
      "chart_observation",
      "rank_observation",
      "territory_specific_chart",
      "public_fetch",
    ],
  },
  boomplay: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  mdundo: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  soundcloud: {
    status: "partial",
    observedCapabilities: [
      "stable_track_id",
      "canonical_url",
      "playback",
      "public_fetch",
    ],
  },
  deezer: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  tidal: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  amazon_music: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  shazam: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  tiktok: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
  meta_music: {
    status: "architecture_ready",
    observedCapabilities: [],
  },
};

const PROVIDER_KEY_SET = new Set<string>(PROVIDER_KEYS_V1);

const PROVIDER_KEY_ALIASES_V1: Readonly<Record<string, ProviderKeyV1>> = {
  applemusic: "apple_music",
  apple_music: "apple_music",
  spotify: "spotify",
  youtube: "youtube",
  youtube_music: "youtube",
  youtubemusic: "youtube",
  yt_music: "youtube",
  audiomack: "audiomack",
  boomplay: "boomplay",
  mdundo: "mdundo",
  soundcloud: "soundcloud",
  deezer: "deezer",
  tidal: "tidal",
  amazon_music: "amazon_music",
  amazonmusic: "amazon_music",
  shazam: "shazam",
  tiktok: "tiktok",
  tiktok_music: "tiktok",
  meta_music: "meta_music",
};

function scalarText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function normalizeProviderKey(value: unknown): string {
  const normalized = scalarText(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return PROVIDER_KEY_ALIASES_V1[normalized] ?? normalized;
}

export function isKnownProviderKey(value: unknown): value is ProviderKeyV1 {
  return PROVIDER_KEY_SET.has(normalizeProviderKey(value));
}

// Provider object IDs can be case/punctuation sensitive. This general primitive
// therefore trims surrounding whitespace only.
export function normalizeProviderObjectId(value: unknown): string {
  return scalarText(value).trim();
}

// Compatibility normalizer for identity aliases already used by chart ingest.
// This is not the canonical storage representation of a provider object ID.
export function compactProviderIdentityPart(value: unknown): string {
  return scalarText(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Preserve current chart-ingest behavior: normalize formatting without
// deciding validity or canonical ownership.
export function normalizeIsrc(value: unknown): string {
  return scalarText(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function providerBindingLookupKey(
  providerRaw: unknown,
  providerObjectIdRaw: unknown,
): string {
  const provider = normalizeProviderKey(providerRaw);
  const providerObjectId = compactProviderIdentityPart(providerObjectIdRaw);
  return provider && providerObjectId
    ? `${provider}:${providerObjectId}`
    : "";
}

export function providerIdentityAlias(
  providerRaw: unknown,
  providerObjectIdRaw: unknown,
): string {
  const lookupKey = providerBindingLookupKey(
    providerRaw,
    providerObjectIdRaw,
  );
  return lookupKey ? `provider:${lookupKey}` : "";
}

export function normalizedProviderIdsFromJson(
  value: unknown,
): Record<string, string[]> {
  const bag: Record<string, Set<string>> = {};

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  for (
    const [providerRaw, idsRaw] of
    Object.entries(value as Record<string, unknown>)
  ) {
    const provider = normalizeProviderKey(providerRaw);
    if (!provider) continue;

    for (const idRaw of Array.isArray(idsRaw) ? idsRaw : [idsRaw]) {
      const id = compactProviderIdentityPart(idRaw);
      if (!id) continue;
      if (!bag[provider]) bag[provider] = new Set<string>();
      bag[provider].add(id);
    }
  }

  return Object.fromEntries(
    Object.entries(bag)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([provider, ids]) => [provider, [...ids].sort()]),
  );
}

export function providerIdentityAliasesFromJson(value: unknown): string[] {
  const normalized = normalizedProviderIdsFromJson(value);
  const aliases: string[] = [];

  for (const [provider, ids] of Object.entries(normalized)) {
    for (const id of ids) {
      aliases.push(`provider:${provider}:${id}`);
    }
  }

  return aliases.sort();
}

export type TrackResolutionStateV1 =
  | "resolved_existing_authority"
  | "deterministic_candidate"
  | "review_required"
  | "unresolved"
  | "quarantined_conflict"
  | "superseded_external_reference";

export type TrackProviderBindingEvidenceV1 = {
  trackId: string;
  confidence?: number;
  method?: string;
};

export type TrackLineageResolutionV1 = {
  status:
    | "current"
    | "successor"
    | "split"
    | "retired"
    | "missing"
    | "cycle"
    | "ambiguous"
    | string;
  currentTrackIds?: readonly string[];
};

type TrackIdBucketV1 = readonly string[] | ReadonlySet<string>;

export type TrackIdIndexV1 =
  | ReadonlyMap<string, TrackIdBucketV1>
  | Readonly<Record<string, TrackIdBucketV1>>;

export type ProviderBindingIndexV1 =
  | ReadonlyMap<string, TrackProviderBindingEvidenceV1>
  | Readonly<Record<string, TrackProviderBindingEvidenceV1>>;

export type TrackLineageIndexV1 =
  | ReadonlyMap<string, TrackLineageResolutionV1>
  | Readonly<Record<string, TrackLineageResolutionV1>>;

export type ResolveTrackIdentityInputV1 = {
  isrc?: unknown;
  providerIdsJson?: unknown;
  trackIdsByIsrc?: TrackIdIndexV1;
  providerBindingsByKey?: ProviderBindingIndexV1;
  lineageByTrackId?: TrackLineageIndexV1;
};

export type TrackIdentityResolutionV1 = {
  contractVersion: typeof PROVIDER_IDENTITY_CONTRACT_VERSION;
  state: TrackResolutionStateV1;
  canonicalTrackId: string | null;
  sourceTrackIds: string[];
  candidateTrackIds: string[];
  matchMethod: "isrc" | "provider_id" | "no_match";
  confidence: number;
  reasons: string[];
  authorityClasses: Array<"provider_binding" | "isrc">;
};

function indexGet<T>(
  index: ReadonlyMap<string, T> | Readonly<Record<string, T>> | undefined,
  key: string,
): T | undefined {
  if (!index || !key) return undefined;
  return index instanceof Map
    ? index.get(key)
    : index[key];
}

function bucketValues(bucket: TrackIdBucketV1 | undefined): string[] {
  if (!bucket) return [];
  const values = bucket instanceof Set ? [...bucket] : [...bucket];
  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ].sort();
}

function clampConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const asPercent = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(asPercent)));
}

function lineageResult(
  sourceTrackId: string,
  lineageByTrackId: TrackLineageIndexV1 | undefined,
): {
  kind: "current" | "retired" | "review" | "conflict";
  currentTrackIds: string[];
  reason?: string;
} {
  const lineage = indexGet(lineageByTrackId, sourceTrackId);
  if (!lineage) {
    return {
      kind: "current",
      currentTrackIds: [sourceTrackId],
    };
  }

  const currentTrackIds = [
    ...new Set(
      (lineage.currentTrackIds ?? [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ].sort();

  if (
    (lineage.status === "current" || lineage.status === "successor") &&
    currentTrackIds.length === 1
  ) {
    return {
      kind: "current",
      currentTrackIds,
      reason:
        currentTrackIds[0] === sourceTrackId
          ? undefined
          : `lineage:${sourceTrackId}->${currentTrackIds[0]}`,
    };
  }

  if (lineage.status === "current" && currentTrackIds.length === 0) {
    return {
      kind: "current",
      currentTrackIds: [sourceTrackId],
    };
  }

  if (lineage.status === "retired" && currentTrackIds.length === 0) {
    return {
      kind: "retired",
      currentTrackIds: [],
      reason: `lineage:${sourceTrackId}:retired`,
    };
  }

  if (lineage.status === "missing") {
    return {
      kind: "review",
      currentTrackIds: [],
      reason: `lineage:${sourceTrackId}:missing`,
    };
  }

  return {
    kind: "conflict",
    currentTrackIds,
    reason: `lineage:${sourceTrackId}:${lineage.status || "ambiguous"}`,
  };
}

export function resolveTrackIdentityV1(
  input: ResolveTrackIdentityInputV1,
): TrackIdentityResolutionV1 {
  const sourceTrackIds = new Set<string>();
  const reasons: string[] = [];
  const authorityClasses = new Set<"provider_binding" | "isrc">();
  let matchMethod: "isrc" | "provider_id" | "no_match" = "no_match";
  let confidence = 0;

  const isrc = normalizeIsrc(input.isrc);
  if (isrc) {
    const isrcTrackIds = bucketValues(
      indexGet(input.trackIdsByIsrc, isrc),
    );
    if (isrcTrackIds.length > 0) {
      matchMethod = "isrc";
      confidence = 100;
      authorityClasses.add("isrc");
      reasons.push(`evidence:isrc:${isrc}`);
      for (const trackId of isrcTrackIds) sourceTrackIds.add(trackId);
    }
  }

  const providerIds = normalizedProviderIdsFromJson(input.providerIdsJson);
  for (const [provider, ids] of Object.entries(providerIds)) {
    for (const id of ids) {
      const bindingKey = providerBindingLookupKey(provider, id);
      const binding = indexGet(input.providerBindingsByKey, bindingKey);
      if (!binding) continue;

      const trackId = String(binding.trackId || "").trim();
      if (!trackId) continue;

      if (matchMethod === "no_match") matchMethod = "provider_id";
      confidence = Math.max(
        confidence,
        clampConfidence(binding.confidence),
      );
      authorityClasses.add("provider_binding");
      reasons.push(`evidence:provider:${provider}:${id}`);
      sourceTrackIds.add(trackId);
    }
  }

  const sortedSourceTrackIds = [...sourceTrackIds].sort();

  if (sortedSourceTrackIds.length === 0) {
    return {
      contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
      state: "unresolved",
      canonicalTrackId: null,
      sourceTrackIds: [],
      candidateTrackIds: [],
      matchMethod: "no_match",
      confidence: 0,
      reasons: [
        "No exact Registry Track match from ISRC or matched provider identity.",
      ],
      authorityClasses: [],
    };
  }

  const candidateTrackIds = new Set<string>();
  let retiredCount = 0;
  let reviewCount = 0;
  let conflictCount = 0;

  for (const sourceTrackId of sortedSourceTrackIds) {
    const lineage = lineageResult(
      sourceTrackId,
      input.lineageByTrackId,
    );

    if (lineage.reason) reasons.push(lineage.reason);

    if (lineage.kind === "retired") {
      retiredCount++;
      continue;
    }
    if (lineage.kind === "review") {
      reviewCount++;
      continue;
    }
    if (lineage.kind === "conflict") {
      conflictCount++;
      continue;
    }

    for (const currentTrackId of lineage.currentTrackIds) {
      candidateTrackIds.add(currentTrackId);
    }
  }

  const sortedCandidateTrackIds = [...candidateTrackIds].sort();
  for (const trackId of sortedCandidateTrackIds) {
    reasons.push(`candidate_track:${trackId}`);
  }

  if (conflictCount > 0) {
    return {
      contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
      state: "quarantined_conflict",
      canonicalTrackId: null,
      sourceTrackIds: sortedSourceTrackIds,
      candidateTrackIds: sortedCandidateTrackIds,
      matchMethod,
      confidence,
      reasons,
      authorityClasses: [...authorityClasses].sort(),
    };
  }

  if (
    retiredCount > 0 &&
    (sortedCandidateTrackIds.length > 0 || reviewCount > 0)
  ) {
    return {
      contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
      state: "quarantined_conflict",
      canonicalTrackId: null,
      sourceTrackIds: sortedSourceTrackIds,
      candidateTrackIds: sortedCandidateTrackIds,
      matchMethod,
      confidence,
      reasons,
      authorityClasses: [...authorityClasses].sort(),
    };
  }

  if (
    retiredCount === sortedSourceTrackIds.length &&
    sortedCandidateTrackIds.length === 0
  ) {
    return {
      contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
      state: "superseded_external_reference",
      canonicalTrackId: null,
      sourceTrackIds: sortedSourceTrackIds,
      candidateTrackIds: [],
      matchMethod,
      confidence,
      reasons,
      authorityClasses: [...authorityClasses].sort(),
    };
  }

  if (reviewCount > 0) {
    return {
      contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
      state: "review_required",
      canonicalTrackId: null,
      sourceTrackIds: sortedSourceTrackIds,
      candidateTrackIds: sortedCandidateTrackIds,
      matchMethod,
      confidence,
      reasons,
      authorityClasses: [...authorityClasses].sort(),
    };
  }

  if (sortedCandidateTrackIds.length !== 1) {
    return {
      contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
      state: "quarantined_conflict",
      canonicalTrackId: null,
      sourceTrackIds: sortedSourceTrackIds,
      candidateTrackIds: sortedCandidateTrackIds,
      matchMethod,
      confidence,
      reasons,
      authorityClasses: [...authorityClasses].sort(),
    };
  }

  const hasProviderAuthority = authorityClasses.has("provider_binding");

  return {
    contractVersion: PROVIDER_IDENTITY_CONTRACT_VERSION,
    state: hasProviderAuthority
      ? "resolved_existing_authority"
      : "deterministic_candidate",
    canonicalTrackId: sortedCandidateTrackIds[0],
    sourceTrackIds: sortedSourceTrackIds,
    candidateTrackIds: sortedCandidateTrackIds,
    matchMethod,
    confidence,
    reasons,
    authorityClasses: [...authorityClasses].sort(),
  };
}
