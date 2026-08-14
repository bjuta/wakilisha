import { supabase } from "@/lib/supabase";

export type ArtistMusicProviderKey =
  | "apple_music"
  | "spotify";

export type ArtistMusicProviderHit = {
  provider: ArtistMusicProviderKey;
  providerEntityId: string;
  title: string;
  artistDisplayName: string | null;
  artworkUrl: string | null;
  confidenceScore: number;
};

export type ArtistMusicInspection = {
  validationId: string;
  provider: ArtistMusicProviderKey;
  providerEntityId: string;
  title: string;
  artistDisplayName: string | null;
  artworkUrl: string | null;
  providerUrl: string;
  releaseTitle: string | null;
};

export type ArtistMusicCreditInput = {
  role: "primary" | "featured";
  name: string;
};

export type ArtistMusicSubmission = {
  id: string;
  artistId: string;
  status: string;
  trackTitle: string;
  releaseTitle: string | null;
  providerKey: ArtistMusicProviderKey;
  providerUrl: string;
  artworkUrl: string | null;
  createdAt: string;
  reviewDueAt: string;
  reviewedAt: string | null;
  slaStatus:
    | "on_time"
    | "overdue"
    | "reviewed_on_time"
    | "reviewed_late";
  canonicalTrackId: string | null;
  canonicalTrackTitle: string | null;
};

type JsonRecord = Record<string, unknown>;

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
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean || null;
}

function mapHit(
  value: unknown,
): ArtistMusicProviderHit | null {
  const record = asRecord(value);
  const provider = readString(record, "provider");
  const providerEntityId =
    readString(record, "providerEntityId");
  const title = readString(record, "title");

  if (
    !record ||
    (
      provider !== "apple_music" &&
      provider !== "spotify"
    ) ||
    !providerEntityId ||
    !title
  ) {
    return null;
  }

  return {
    provider,
    providerEntityId,
    title,
    artistDisplayName:
      readString(record, "artistDisplayName"),
    artworkUrl:
      readString(record, "artworkUrl"),
    confidenceScore:
      Number(record.confidenceScore ?? 0),
  };
}

function mapSubmission(
  value: unknown,
): ArtistMusicSubmission | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const artistId = readString(record, "artist_id");
  const status = readString(record, "status");
  const trackTitle = readString(record, "track_title");
  const providerKey = readString(record, "provider_key");
  const providerUrl = readString(record, "provider_url");
  const createdAt = readString(record, "created_at");
  const reviewDueAt = readString(record, "review_due_at");
  const slaStatus = readString(record, "sla_status") ?? "on_time";

  if (
    !record ||
    !id ||
    !artistId ||
    !status ||
    !trackTitle ||
    (
      providerKey !== "apple_music" &&
      providerKey !== "spotify"
    ) ||
    !providerUrl ||
    !createdAt ||
    !reviewDueAt ||
    ![
      "on_time",
      "overdue",
      "reviewed_on_time",
      "reviewed_late",
    ].includes(slaStatus)
  ) {
    return null;
  }

  return {
    id,
    artistId,
    status,
    trackTitle,
    releaseTitle:
      readString(record, "release_title"),
    providerKey,
    providerUrl,
    artworkUrl:
      readString(record, "artwork_url"),
    createdAt,
    reviewDueAt,
    reviewedAt:
      readString(record, "reviewed_at"),
    slaStatus:
      slaStatus as ArtistMusicSubmission["slaStatus"],
    canonicalTrackId:
      readString(record, "canonical_track_id"),
    canonicalTrackTitle:
      readString(record, "canonical_track_title"),
  };
}

async function rpc(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const invoke =
    supabase.rpc as unknown as (
      functionName: string,
      parameters?: Record<string, unknown>,
    ) => Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;

  const { data, error } =
    await invoke(name, args);

  if (error) {
    throw new Error(
      error.message || `${name} failed`,
    );
  }

  return data;
}

export async function searchArtistMusicProvider(
  input: {
    artistId: string;
    provider: ArtistMusicProviderKey;
    query: string;
  },
): Promise<ArtistMusicProviderHit[]> {
  const { data, error } =
    await supabase.functions.invoke(
      "provider-intake-api",
      {
        body: {
          route:
            "artist-submission-search",
          artistId:
            input.artistId,
          provider:
            input.provider,
          entityType:
            "track",
          query:
            input.query,
          limit:
            12,
          storefront:
            "ke",
        },
      },
    );

  if (error) throw error;

  const record = asRecord(data);
  const message = readString(record, "error");
  if (message) throw new Error(message);

  const groups =
    asRecord(record?.groups);
  const rawHits =
    Array.isArray(groups?.tracks)
      ? groups.tracks
      : [];

  return rawHits.flatMap((value) => {
    const hit = mapHit(value);
    return hit ? [hit] : [];
  });
}

export async function inspectArtistMusicProvider(
  input: {
    artistId: string;
    hit: ArtistMusicProviderHit;
  },
): Promise<ArtistMusicInspection> {
  const { data, error } =
    await supabase.functions.invoke(
      "provider-intake-api",
      {
        body: {
          route:
            "artist-submission-inspect",
          artistId:
            input.artistId,
          provider:
            input.hit.provider,
          providerEntityType:
            "track",
          providerEntityId:
            input.hit.providerEntityId,
          storefront:
            "ke",
        },
      },
    );

  if (error) throw error;

  const envelope = asRecord(data);
  const message = readString(envelope, "error");
  if (message) throw new Error(message);

  const validationId =
    readString(envelope, "validationId");
  const result =
    asRecord(envelope?.result);
  const enrichment =
    asRecord(result?.enrichment);

  const provider =
    readString(result, "provider");
  const providerEntityId =
    readString(result, "providerEntityId");
  const title =
    readString(result, "title");
  const providerUrl =
    readString(result, "providerUrl");

  if (
    !validationId ||
    (
      provider !== "apple_music" &&
      provider !== "spotify"
    ) ||
    !providerEntityId ||
    !title ||
    !providerUrl
  ) {
    throw new Error(
      "Provider validation returned an incomplete track.",
    );
  }

  return {
    validationId,
    provider,
    providerEntityId,
    title,
    artistDisplayName:
      readString(result, "artistDisplayName"),
    artworkUrl:
      readString(result, "artworkUrl"),
    providerUrl,
    releaseTitle:
      readString(enrichment, "release_title"),
  };
}

export async function submitArtistMusic(
  input: {
    artistId: string;
    validationId: string;
    credits: ArtistMusicCreditInput[];
    submissionKey: string;
  },
): Promise<ArtistMusicSubmission> {
  const data =
    await rpc(
      "community_submit_artist_music",
      {
        p_artist_id:
          input.artistId,
        p_validation_id:
          input.validationId,
        p_artist_credits:
          input.credits.map((credit) => ({
            credit_role:
              credit.role,
            observed_name:
              credit.name,
          })),
        p_submission_key:
          input.submissionKey,
      },
    );

  const record = asRecord(data);

  const provisional = mapSubmission({
    ...record,
    sla_status: "on_time",
    canonical_track_id: null,
    canonical_track_title: null,
  });

  if (!provisional) {
    throw new Error(
      "Artist music submission returned an invalid response.",
    );
  }

  return provisional;
}

export async function listArtistMusicSubmissions(
  artistId: string,
  limit = 30,
): Promise<ArtistMusicSubmission[]> {
  const data =
    await rpc(
      "community_get_artist_music_submissions",
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

  return data.flatMap((value) => {
    const submission =
      mapSubmission(value);
    return submission
      ? [submission]
      : [];
  });
}
