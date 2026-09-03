import {
  supabase,
} from "@/lib/supabase";
import {
  normalizeCountry,
} from "@/services/cultureContext/formatters";

export type ArtistStudioRegistryState =
  | "active"
  | "draft"
  | "needs_review";

export type ArtistStudioMatchTier =
  | "exact"
  | "strong"
  | "possible";

export type ArtistStudioRegistryCandidate = {
  artistId: string;
  slug: string;
  displayName: string;
  artistType: string | null;
  country: string | null;
  registryState:
    ArtistStudioRegistryState;
  publicPath: string | null;
  imageUrl: string | null;
  matchTier:
    ArtistStudioMatchTier;
  matchScore: number;
};

type JsonRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown,
): JsonRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonRecord;
}

function readString(
  record: JsonRecord | null,
  key: string,
): string | null {
  const value = record?.[key];

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length
    ? trimmed
    : null;
}

function readNumber(
  record: JsonRecord | null,
  key: string,
): number {
  const value = record?.[key];

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return 0;
}

export async function searchArtistStudioRegistry(
  query: string,
  limit = 8,
): Promise<
  ArtistStudioRegistryCandidate[]
> {
  const cleanQuery =
    query.trim();

  if (
    cleanQuery.length < 2
  ) {
    return [];
  }

  const invoke =
    supabase.rpc.bind(
      supabase,
    ) as unknown as (
      functionName: string,
      parameters?: Record<
        string,
        unknown
      >,
    ) => Promise<{
      data: unknown;
      error: {
        message?: string;
      } | null;
    }>;

  const {
    data,
    error,
  } = await invoke(
    "get_artist_studio_registry_candidates",
    {
      p_query:
        cleanQuery,
      p_limit:
        Math.max(
          1,
          Math.min(
            limit,
            8,
          ),
        ),
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        "Could not search the Registry.",
    );
  }

  if (
    !Array.isArray(data)
  ) {
    return [];
  }

  return data.flatMap(
    (item) => {
      const record =
        asRecord(item);
      const artistId =
        readString(
          record,
          "artist_id",
        );
      const slug =
        readString(
          record,
          "slug",
        );
      const displayName =
        readString(
          record,
          "display_name",
        );
      const registryState =
        readString(
          record,
          "registry_state",
        );
      const matchTier =
        readString(
          record,
          "match_tier",
        );

      if (
        !artistId ||
        !slug ||
        !displayName ||
        (
          registryState !==
            "active" &&
          registryState !==
            "draft" &&
          registryState !==
            "needs_review"
        ) ||
        (
          matchTier !==
            "exact" &&
          matchTier !==
            "strong" &&
          matchTier !==
            "possible"
        )
      ) {
        return [];
      }

      return [{
        artistId,
        slug,
        displayName,
        artistType:
          readString(
            record,
            "artist_type",
          ),
        country:
          normalizeCountry(
            readString(
              record,
              "origin_iso2",
            ),
          ) ?? null,
        registryState,
        publicPath:
          readString(
            record,
            "public_path",
          ),
        imageUrl:
          readString(
            record,
            "image_url",
          ),
        matchTier,
        matchScore:
          readNumber(
            record,
            "match_score",
          ),
      }];
    },
  );
}
