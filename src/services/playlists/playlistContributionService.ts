import {
  supabase,
} from "@/lib/supabase";

export interface PublicTrackMetadata {
  providerKey: string;
  providerObjectId: string;
  canonicalUrl: string;
  title: string | null;
  artistNames: string[];
  releaseTitle: string | null;
  artworkUrl: string | null;
}

export interface SubmitPublicMissingTrackInput {
  playlistId: string;
  playlistSlug: string;
  trackTitle: string;
  artistNames: string[];
  details?: string;
  trackUrl?: string;
  idempotencyKey: string;
}

export interface SubmitPublicMissingTrackResult {
  contributionId: string;
  registrySuggestionId: string | null;
  registryQueued: boolean;
  created: boolean;
}

function messageFromInvokeError(
  error: unknown,
  fallback: string,
): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

export async function resolvePublicTrackMetadata(
  trackUrl: string,
): Promise<PublicTrackMetadata> {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "playlist-product-api",
      {
        body: {
          action:
            "resolve_public_track",
          url:
            trackUrl,
        },
      },
    );

  if (
    error
  ) {
    throw new Error(
      messageFromInvokeError(
        error,
        "Track details could not be read from that link.",
      ),
    );
  }

  if (
    data?.error
  ) {
    throw new Error(
      String(
        data.error,
      ),
    );
  }

  return {
    providerKey:
      String(
        data?.provider_key ??
        "",
      ),
    providerObjectId:
      String(
        data?.provider_object_id ??
        "",
      ),
    canonicalUrl:
      String(
        data?.canonical_url ??
        trackUrl,
      ),
    title:
      typeof data?.title === "string"
        ? data.title
        : null,
    artistNames:
      Array.isArray(
        data?.artist_names,
      )
        ? data.artist_names
            .map(
              (
                value: unknown,
              ) =>
                String(
                  value ??
                  "",
                ).trim(),
            )
            .filter(
              Boolean,
            )
        : [],
    releaseTitle:
      typeof data?.release_title ===
      "string"
        ? data.release_title
        : null,
    artworkUrl:
      typeof data?.artwork_url ===
      "string"
        ? data.artwork_url
        : null,
  };
}

export async function submitPublicMissingTrack(
  input: SubmitPublicMissingTrackInput,
): Promise<SubmitPublicMissingTrackResult> {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "playlist-product-api",
      {
        body: {
          action:
            "submit_public_missing_track",
          playlist_id:
            input.playlistId,
          playlist_slug:
            input.playlistSlug,
          track_title:
            input.trackTitle,
          artist_names:
            input.artistNames,
          details:
            input.details?.trim() ||
            null,
          url:
            input.trackUrl?.trim() ||
            null,
          idempotency_key:
            input.idempotencyKey,
        },
      },
    );

  if (
    error
  ) {
    throw new Error(
      messageFromInvokeError(
        error,
        "Missing track suggestion could not be submitted.",
      ),
    );
  }

  if (
    data?.error
  ) {
    throw new Error(
      String(
        data.error,
      ),
    );
  }

  return {
    contributionId:
      String(
        data?.contribution_id ??
        "",
      ),
    registrySuggestionId:
      data?.registry_suggestion_id
        ? String(
            data.registry_suggestion_id,
          )
        : null,
    registryQueued:
      data?.registry_queued ===
      true,
    created:
      data?.created ===
      true,
  };
}
