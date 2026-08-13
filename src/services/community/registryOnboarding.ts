import { supabase } from "@/lib/supabase";

export type RegistryOnboardingStatus =
  | "not_started"
  | "completed"
  | "skipped";

export type RegistryOnboardingArtistSource =
  | "editorial"
  | "system_fallback";

export interface RegistryOnboardingArtist {
  targetType: "artist";
  targetId: string;
  targetSlug: string;
  canonicalPath: string;
  displayName: string;
  imageUrl: string;
  source: RegistryOnboardingArtistSource;
}

export interface RegistryOnboardingOpening {
  artists: RegistryOnboardingArtist[];
  fallbackEnabled: boolean;
  fallbackUsed: boolean;
  editorialConfiguredCount: number;
}

export interface RegistryOnboardingState {
  status: RegistryOnboardingStatus;
  completedAt: string | null;
  skippedAt: string | null;
}

export interface AdminRegistryOnboardingArtist {
  artistId: string;
  artistSlug: string;
  artistName: string;
  artistImage: string | null;
  artistStatus: string;
  displayOrder: number;
}

export interface AdminRegistryOnboardingConfig {
  artists: AdminRegistryOnboardingArtist[];
  fallbackEnabled: boolean;
}

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();

  return clean || null;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  return record[key] === true;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  return (
    typeof value === "number"
    && Number.isFinite(value)
  )
    ? value
    : 0;
}

function decodeOpeningArtist(
  value: unknown,
): RegistryOnboardingArtist | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const targetType = readString(
    record,
    "target_type",
  );
  const targetId = readString(
    record,
    "target_id",
  );
  const targetSlug = readString(
    record,
    "target_slug",
  );
  const canonicalPath = readString(
    record,
    "canonical_path",
  );
  const displayName = readString(
    record,
    "display_name",
  );
  const imageUrl = readString(
    record,
    "image_url",
  );
  const source = readString(
    record,
    "source",
  );

  if (
    targetType !== "artist"
    || !targetId
    || !targetSlug
    || !canonicalPath
    || !displayName
    || !imageUrl
    || (
      source !== "editorial"
      && source !== "system_fallback"
    )
  ) {
    return null;
  }

  return {
    targetType: "artist",
    targetId,
    targetSlug,
    canonicalPath,
    displayName,
    imageUrl,
    source,
  };
}

export async function getRegistryOnboardingArtists(
  limit: number = 16,
): Promise<RegistryOnboardingOpening> {
  const { data, error } = await supabase.rpc(
    "community_get_registry_onboarding_artists",
    {
      p_limit: Math.min(
        Math.max(
          Math.round(limit),
          1,
        ),
        24,
      ),
    },
  );

  if (error) {
    throw error;
  }

  const record = asRecord(data);

  if (!record) {
    throw new Error(
      "Onboarding returned an invalid opening field.",
    );
  }

  const artists = Array.isArray(
    record.artists,
  )
    ? record.artists
        .map(decodeOpeningArtist)
        .filter(
          (
            artist,
          ): artist is RegistryOnboardingArtist =>
            Boolean(artist),
        )
    : [];

  return {
    artists,
    fallbackEnabled:
      readBoolean(
        record,
        "fallback_enabled",
      ),
    fallbackUsed:
      readBoolean(
        record,
        "fallback_used",
      ),
    editorialConfiguredCount:
      readNumber(
        record,
        "editorial_configured_count",
      ),
  };
}

function decodeState(
  value: unknown,
): RegistryOnboardingState {
  const record = asRecord(value);

  if (!record) {
    throw new Error(
      "Onboarding returned an invalid state.",
    );
  }

  const status =
    readString(
      record,
      "status",
    );

  if (
    status !== "not_started"
    && status !== "completed"
    && status !== "skipped"
  ) {
    throw new Error(
      "Onboarding returned an unknown state.",
    );
  }

  return {
    status,
    completedAt:
      readString(
        record,
        "completed_at",
      ),
    skippedAt:
      readString(
        record,
        "skipped_at",
      ),
  };
}

export async function getRegistryOnboardingState():
Promise<RegistryOnboardingState> {
  const { data, error } = await supabase.rpc(
    "community_get_registry_onboarding_state",
  );

  if (error) {
    throw error;
  }

  return decodeState(data);
}

export async function setRegistryOnboardingState(
  status: Extract<
    RegistryOnboardingStatus,
    "completed" | "skipped"
  >,
): Promise<RegistryOnboardingState> {
  const { data, error } = await supabase.rpc(
    "community_set_registry_onboarding_state",
    {
      p_status: status,
    },
  );

  if (error) {
    throw error;
  }

  return decodeState(data);
}

export interface RegistryArtistStructuralProximity {
  relatedArtistId: string;
  relatedArtistSlug: string;
  relatedArtistName: string;
  relatedArtistImageUrl: string | null;
  sharedTrackCount: number;
  sharedReleaseCount: number;
  featuresThem: number;
  theyFeature: number;
  sharedTitles: string[];
  proximityScore: number;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodeStructuralProximity(
  value: unknown,
): RegistryArtistStructuralProximity | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const relatedArtistId = readString(record, "related_artist_id");
  const relatedArtistSlug = readString(record, "related_artist_slug");
  const relatedArtistName = readString(record, "related_artist_name");

  if (!relatedArtistId || !relatedArtistSlug || !relatedArtistName) {
    return null;
  }

  return {
    relatedArtistId,
    relatedArtistSlug,
    relatedArtistName,
    relatedArtistImageUrl: readString(record, "related_artist_image_url"),
    sharedTrackCount: readNumber(record, "shared_track_count"),
    sharedReleaseCount: readNumber(record, "shared_release_count"),
    featuresThem: readNumber(record, "features_them"),
    theyFeature: readNumber(record, "they_feature"),
    sharedTitles: readStringArray(record, "shared_titles"),
    proximityScore: readNumber(record, "proximity_score"),
  };
}

export async function getRegistryArtistStructuralProximity(
  artistId: string,
): Promise<RegistryArtistStructuralProximity[]> {
  const { data, error } = await supabase.rpc(
    "get_public_artist_structural_proximity",
    { p_artist_id: artistId },
  );
  if (error) {
    throw error;
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map(decodeStructuralProximity)
    .filter((relationship): relationship is RegistryArtistStructuralProximity => Boolean(relationship));
}

function decodeAdminArtist(
  value: unknown,
): AdminRegistryOnboardingArtist | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const artistId =
    readString(
      record,
      "artist_id",
    );
  const artistSlug =
    readString(
      record,
      "artist_slug",
    );
  const artistName =
    readString(
      record,
      "artist_name",
    );
  const artistStatus =
    readString(
      record,
      "artist_status",
    );

  if (
    !artistId
    || !artistSlug
    || !artistName
    || !artistStatus
  ) {
    return null;
  }

  return {
    artistId,
    artistSlug,
    artistName,
    artistImage:
      readString(
        record,
        "artist_image",
      ),
    artistStatus,
    displayOrder:
      readNumber(
        record,
        "display_order",
      ),
  };
}

export async function getAdminRegistryOnboardingConfig():
Promise<AdminRegistryOnboardingConfig> {
  const { data, error } = await supabase.rpc(
    "community_admin_get_registry_onboarding_artists",
  );

  if (error) {
    throw error;
  }

  const record = asRecord(data);

  if (!record) {
    throw new Error(
      "Onboarding settings returned an invalid response.",
    );
  }

  const artists =
    Array.isArray(
      record.artists,
    )
      ? record.artists
          .map(
            decodeAdminArtist,
          )
          .filter(
            (
              artist,
            ): artist is AdminRegistryOnboardingArtist =>
              Boolean(artist),
          )
          .sort(
            (left, right) =>
              left.displayOrder
              - right.displayOrder,
          )
      : [];

  return {
    artists,
    fallbackEnabled:
      readBoolean(
        record,
        "fallback_enabled",
      ),
  };
}

export async function setAdminRegistryOnboardingConfig(
  artistSlugs: string[],
  fallbackEnabled: boolean,
): Promise<void> {
  const { error } = await supabase.rpc(
    "community_admin_set_registry_onboarding_artists",
    {
      p_artist_slugs: artistSlugs,
      p_fallback_enabled: fallbackEnabled,
    },
  );

  if (error) {
    throw error;
  }
}
