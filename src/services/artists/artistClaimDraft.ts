export const ARTIST_CLAIM_DRAFT_VERSION = 2;

export type ArtistClaimDraft = {
  version: typeof ARTIST_CLAIM_DRAFT_VERSION;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  claimantRole: string;
  phoneCountryIso2: string;
  phoneNumber: string;
  statement: string;
  proofLink: string;
  updatedAt: string;
};

const KEY_PREFIX =
  "wk-artist-claim-draft:v2:";
const LEGACY_KEY_PREFIX =
  "wk-artist-claim-draft:v1:";

function keyFor(
  artistId: string,
  prefix = KEY_PREFIX,
) {
  return `${prefix}${artistId}`;
}

function parseCurrentDraft(
  raw: string,
  artistId: string,
): ArtistClaimDraft | null {
  const parsed =
    JSON.parse(raw) as
      Partial<ArtistClaimDraft>;

  if (
    parsed.version !==
      ARTIST_CLAIM_DRAFT_VERSION ||
    parsed.artistId !== artistId ||
    typeof parsed.artistName !==
      "string" ||
    typeof parsed.claimantRole !==
      "string" ||
    typeof parsed.phoneCountryIso2 !==
      "string" ||
    typeof parsed.phoneNumber !==
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
    phoneCountryIso2:
      parsed.phoneCountryIso2,
    phoneNumber:
      parsed.phoneNumber,
    statement:
      parsed.statement,
    proofLink:
      parsed.proofLink,
    updatedAt:
      parsed.updatedAt,
  };
}

function parseLegacyDraft(
  raw: string,
  artistId: string,
): ArtistClaimDraft | null {
  const parsed =
    JSON.parse(raw) as
      Record<string, unknown>;

  if (
    parsed.version !== 1 ||
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
    phoneCountryIso2: "",
    phoneNumber: "",
    statement:
      parsed.statement,
    proofLink:
      parsed.proofLink,
    updatedAt:
      parsed.updatedAt,
  };
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
    const currentRaw =
      window.localStorage.getItem(
        keyFor(artistId),
      );

    if (currentRaw) {
      return parseCurrentDraft(
        currentRaw,
        artistId,
      );
    }

    const legacyRaw =
      window.localStorage.getItem(
        keyFor(
          artistId,
          LEGACY_KEY_PREFIX,
        ),
      );

    return legacyRaw
      ? parseLegacyDraft(
          legacyRaw,
          artistId,
        )
      : null;
  } catch {
    return null;
  }
}

export type ArtistClaimDraftSaveResult = {
  draft: ArtistClaimDraft;
  saved: boolean;
};

export function saveArtistClaimDraft(
  input: Omit<
    ArtistClaimDraft,
    "version" | "updatedAt"
  >,
): ArtistClaimDraftSaveResult {
  const draft: ArtistClaimDraft = {
    version:
      ARTIST_CLAIM_DRAFT_VERSION,
    ...input,
    updatedAt:
      new Date().toISOString(),
  };

  if (
    typeof window === "undefined"
  ) {
    return {
      draft,
      saved: false,
    };
  }

  try {
    window.localStorage.setItem(
      keyFor(input.artistId),
      JSON.stringify(draft),
    );
    window.localStorage.removeItem(
      keyFor(
        input.artistId,
        LEGACY_KEY_PREFIX,
      ),
    );

    return {
      draft,
      saved: true,
    };
  } catch {
    return {
      draft,
      saved: false,
    };
  }
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
    window.localStorage.removeItem(
      keyFor(
        artistId,
        LEGACY_KEY_PREFIX,
      ),
    );
  } catch {
    // No-op when local storage is unavailable.
  }
}
