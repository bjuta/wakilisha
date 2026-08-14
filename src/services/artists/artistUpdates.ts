import { supabase } from "@/lib/supabase";

export type ArtistUpdateStatus =
  | "published"
  | "withdrawn";

export type ArtistUpdate = {
  id: string;
  artistId: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  status: ArtistUpdateStatus;
  publishedAt: string;
  withdrawnAt: string | null;
  updatedAt: string;
  canonicalPath: string;
};

export type PublicArtistUpdate =
  ArtistUpdate & {
    artist: {
      id: string;
      slug: string;
      displayName: string;
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
  if (!record) {
    return null;
  }

  const value =
    record[key];

  if (typeof value !== "string") {
    return null;
  }

  const clean =
    value.trim();

  return clean || null;
}

function mapUpdate(
  value: unknown,
): ArtistUpdate | null {
  const record =
    asRecord(value);

  const id =
    readString(record, "id");
  const artistId =
    readString(record, "artist_id");
  const body =
    readString(record, "body");
  const status =
    readString(record, "status");
  const publishedAt =
    readString(record, "published_at");
  const updatedAt =
    readString(record, "updated_at");
  const canonicalPath =
    readString(record, "canonical_path");

  if (
    !record ||
    !id ||
    !artistId ||
    !body ||
    (
      status !== "published" &&
      status !== "withdrawn"
    ) ||
    !publishedAt ||
    !updatedAt ||
    !canonicalPath
  ) {
    return null;
  }

  return {
    id,
    artistId,
    body,
    imageUrl:
      readString(
        record,
        "image_url",
      ),
    linkUrl:
      readString(
        record,
        "link_url",
      ),
    linkLabel:
      readString(
        record,
        "link_label",
      ),
    status,
    publishedAt,
    withdrawnAt:
      readString(
        record,
        "withdrawn_at",
      ),
    updatedAt,
    canonicalPath,
  };
}

async function rpc(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const invoke =
    supabase.rpc.bind(supabase) as unknown as (
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
    name,
    args,
  );

  if (error) {
    throw new Error(
      error.message ||
      `${name} failed`,
    );
  }

  return data;
}

export async function publishArtistUpdate(
  input: {
    artistId: string;
    body: string;
    imageUrl: string;
    linkUrl: string;
    linkLabel: string;
  },
): Promise<ArtistUpdate> {
  const data =
    await rpc(
      "community_publish_artist_update",
      {
        p_artist_id:
          input.artistId,
        p_body:
          input.body,
        p_image_url:
          input.imageUrl || null,
        p_link_url:
          input.linkUrl || null,
        p_link_label:
          input.linkLabel || null,
      },
    );

  const update =
    mapUpdate(data);

  if (!update) {
    throw new Error(
      "Artist Update returned an invalid response.",
    );
  }

  return update;
}

export async function editArtistUpdate(
  input: {
    updateId: string;
    body: string;
    imageUrl: string;
    linkUrl: string;
    linkLabel: string;
  },
): Promise<ArtistUpdate> {
  const data =
    await rpc(
      "community_edit_artist_update",
      {
        p_update_id:
          input.updateId,
        p_body:
          input.body,
        p_image_url:
          input.imageUrl || null,
        p_link_url:
          input.linkUrl || null,
        p_link_label:
          input.linkLabel || null,
      },
    );

  const update =
    mapUpdate(data);

  if (!update) {
    throw new Error(
      "Artist Update returned an invalid response.",
    );
  }

  return update;
}

export async function withdrawArtistUpdate(
  updateId: string,
  reason: string,
): Promise<void> {
  await rpc(
    "community_withdraw_artist_update",
    {
      p_update_id:
        updateId,
      p_reason:
        reason,
    },
  );
}

export async function listArtistManageUpdates(
  artistId: string,
  limit = 30,
): Promise<ArtistUpdate[]> {
  const data =
    await rpc(
      "community_get_artist_manage_updates",
      {
        p_artist_id:
          artistId,
        p_limit:
          Math.min(
            100,
            Math.max(
              1,
              Math.round(limit),
            ),
          ),
      },
    );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap(
    (value) => {
      const update =
        mapUpdate(value);

      return update
        ? [update]
        : [];
    },
  );
}

export async function getArtistUpdate(
  updateId: string,
): Promise<PublicArtistUpdate> {
  const data =
    await rpc(
      "community_get_artist_update",
      {
        p_update_id:
          updateId,
      },
    );

  const update =
    mapUpdate(data);
  const record =
    asRecord(data);
  const artist =
    asRecord(
      record?.artist,
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
  const displayName =
    readString(
      artist,
      "display_name",
    );

  if (
    !update ||
    !artistId ||
    !slug ||
    !displayName
  ) {
    throw new Error(
      "Artist Update returned an invalid public response.",
    );
  }

  return {
    ...update,
    artist: {
      id:
        artistId,
      slug,
      displayName,
      imageUrl:
        readString(
          artist,
          "image_url",
        ),
    },
  };
}
