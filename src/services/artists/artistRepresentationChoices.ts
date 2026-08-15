import { supabase } from "@/lib/supabase";
import type {
  ArtistPermissionSet,
} from "@/services/artists/claimedArtist";

export type MyArtistRepresentation = {
  representationId: string;
  role: string;
  status: string;
  permissions: ArtistPermissionSet;
  artist: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
  };
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
  const value =
    record?.[key];

  if (typeof value !== "string") {
    return null;
  }

  const clean =
    value.trim();

  return clean || null;
}

function readBoolean(
  record: JsonRecord | null,
  key: string,
): boolean {
  return record?.[key] === true;
}

export async function listMyArtistRepresentations():
  Promise<MyArtistRepresentation[]> {
  const invoke =
    supabase.rpc.bind(
      supabase,
    ) as unknown as (
      functionName: string,
      parameters?: Record<string, unknown>,
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
    "community_get_my_artist_representations",
  );

  if (error) {
    throw new Error(
      error.message ||
      "We could not load your Artists.",
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap(
    (value) => {
      const record =
        asRecord(value);
      const artist =
        asRecord(
          record?.artist,
        );
      const permissions =
        asRecord(
          record?.permissions,
        );

      const representationId =
        readString(
          record,
          "representation_id",
        );
      const artistId =
        readString(
          artist,
          "id",
        );
      const slug =
        readString(
          artist,
          "slug",
        );
      const name =
        readString(
          artist,
          "name",
        );

      if (
        !record ||
        !artist ||
        !representationId ||
        !artistId ||
        !slug ||
        !name
      ) {
        return [];
      }

      return [{
        representationId,
        role:
          readString(
            record,
            "role",
          ) ?? "other",
        status:
          readString(
            record,
            "status",
          ) ?? "pending",
        permissions: {
          profile:
            readBoolean(
              permissions,
              "profile",
            ),
          releases:
            readBoolean(
              permissions,
              "releases",
            ),
          updates:
            readBoolean(
              permissions,
              "updates",
            ),
          team:
            readBoolean(
              permissions,
              "team",
            ),
        },
        artist: {
          id: artistId,
          slug,
          name,
          imageUrl:
            readString(
              artist,
              "image_url",
            ),
        },
      }];
    },
  );
}
