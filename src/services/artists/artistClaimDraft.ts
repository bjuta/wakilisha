export const ARTIST_CLAIM_DRAFT_VERSION = 1;

export type ArtistClaimDraft = {
  version: typeof ARTIST_CLAIM_DRAFT_VERSION;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  claimantRole: string;
  statement: string;
  proofLink: string;
  updatedAt: string;
};

const KEY_PREFIX =
  "wk-artist-claim-draft:v1:";

function keyFor(artistId: string) {
  return `${KEY_PREFIX}${artistId}`;
}

export function readArtistClaimDraft(
  artistId: string,
): ArtistClaimDraft | null {
  if (
    typeof window === "undefined" ||
    !artistId
  ) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        keyFor(artistId),
      );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as
      Partial<ArtistClaimDraft>;

    if (
      parsed.version !==
        ARTIST_CLAIM_DRAFT_VERSION ||
      parsed.artistId !== artistId ||
      typeof parsed.artistName !==
        "string" ||
      typeof parsed.claimantRole !==
        "string" ||
      typeof parsed.statement !==
        "string" ||
      typeof parsed.proofLink !==
        "string" ||
      typeof parsed.updatedAt !==
        "string"
    ) {
      return null;
    }

    return {
      version:
        ARTIST_CLAIM_DRAFT_VERSION,
      artistId,
      artistName:
        parsed.artistName,
      artistSlug:
        typeof parsed.artistSlug ===
        "string"
          ? parsed.artistSlug
          : null,
      claimantRole:
        parsed.claimantRole,
      statement:
        parsed.statement,
      proofLink:
        parsed.proofLink,
      updatedAt:
        parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveArtistClaimDraft(
  input: Omit<
    ArtistClaimDraft,
    "version" | "updatedAt"
  >,
): ArtistClaimDraft {
  const draft: ArtistClaimDraft = {
    version:
      ARTIST_CLAIM_DRAFT_VERSION,
    ...input,
    updatedAt:
      new Date().toISOString(),
  };

  if (
    typeof window !== "undefined"
  ) {
    try {
      window.localStorage.setItem(
        keyFor(input.artistId),
        JSON.stringify(draft),
      );
    } catch {
      // The form still works when local storage is unavailable.
    }
  }

  return draft;
}

export function clearArtistClaimDraft(
  artistId: string,
) {
  if (
    typeof window === "undefined" ||
    !artistId
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      keyFor(artistId),
    );
  } catch {
    // No-op when local storage is unavailable.
  }
}
