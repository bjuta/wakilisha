export const ARTIST_CLAIM_DRAFT_VERSION = 3;

export type ArtistClaimDraft = {
  version:
    typeof ARTIST_CLAIM_DRAFT_VERSION;
  artistId: string;
  artistName: string;
  artistSlug: string | null;
  claimantRole: string;
  claimantRoleOther: string;
  phoneCountryIso2: string;
  phoneNumber: string;
  statement: string;
  updatedAt: string;
};

const KEY_PREFIX =
  "wk-artist-claim-draft:v3:";
const PREVIOUS_KEY_PREFIX =
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
    typeof parsed.claimantRoleOther !==
      "string" ||
    typeof parsed.phoneCountryIso2 !==
      "string" ||
    typeof parsed.phoneNumber !==
      "string" ||
    typeof parsed.statement !==
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
    claimantRoleOther:
      parsed.claimantRoleOther,
    phoneCountryIso2:
      parsed.phoneCountryIso2,
    phoneNumber:
      parsed.phoneNumber,
    statement:
      parsed.statement,
    updatedAt:
      parsed.updatedAt,
  };
}

function parseOlderDraft(
  raw: string,
  artistId: string,
  expectedVersion: 1 | 2,
): ArtistClaimDraft | null {
  const parsed =
    JSON.parse(raw) as
      Record<string, unknown>;

  if (
    parsed.version !==
      expectedVersion ||
    parsed.artistId !== artistId ||
    typeof parsed.artistName !==
      "string" ||
    typeof parsed.claimantRole !==
      "string" ||
    typeof parsed.statement !==
      "string" ||
    typeof parsed.updatedAt !==
      "string"
  ) {
    return null;
  }

  const phoneCountryIso2 =
    expectedVersion === 2 &&
    typeof parsed.phoneCountryIso2 ===
      "string"
      ? parsed.phoneCountryIso2
      : "";
  const phoneNumber =
    expectedVersion === 2 &&
    typeof parsed.phoneNumber ===
      "string"
      ? parsed.phoneNumber
      : "";

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
    claimantRoleOther: "",
    phoneCountryIso2,
    phoneNumber,
    statement:
      parsed.statement,
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

    const previousRaw =
      window.localStorage.getItem(
        keyFor(
          artistId,
          PREVIOUS_KEY_PREFIX,
        ),
      );

    if (previousRaw) {
      return parseOlderDraft(
        previousRaw,
        artistId,
        2,
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
      ? parseOlderDraft(
          legacyRaw,
          artistId,
          1,
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
        PREVIOUS_KEY_PREFIX,
      ),
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
    for (const prefix of [
      KEY_PREFIX,
      PREVIOUS_KEY_PREFIX,
      LEGACY_KEY_PREFIX,
    ]) {
      window.localStorage.removeItem(
        keyFor(
          artistId,
          prefix,
        ),
      );
    }
  } catch {
    // No-op when local storage is unavailable.
  }
}
