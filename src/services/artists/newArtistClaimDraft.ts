export const NEW_ARTIST_CLAIM_DRAFT_VERSION = 3;

export type NewArtistClaimDraft = {
  version:
    typeof NEW_ARTIST_CLAIM_DRAFT_VERSION;
  flowId: string;
  displayName: string;
  artistType: string;
  originIso2: string;
  alternateNames: string;
  claimantRole: string;
  claimantRoleOther: string;
  phoneCountryIso2: string;
  phoneNumber: string;
  statement: string;
  updatedAt: string;
};

const KEY_PREFIX =
  "wk-new-artist-claim-draft:v3:";
const PREVIOUS_KEY_PREFIX =
  "wk-new-artist-claim-draft:v2:";
const LEGACY_KEY_PREFIX =
  "wk-new-artist-claim-draft:v1:";

function keyFor(
  flowId: string,
  prefix = KEY_PREFIX,
) {
  return `${prefix}${flowId}`;
}

export function createNewArtistClaimFlowId() {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `artist-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function parseCurrentDraft(
  raw: string,
  flowId: string,
): NewArtistClaimDraft | null {
  const parsed =
    JSON.parse(raw) as
      Partial<NewArtistClaimDraft>;

  if (
    parsed.version !==
      NEW_ARTIST_CLAIM_DRAFT_VERSION ||
    parsed.flowId !== flowId ||
    typeof parsed.displayName !==
      "string" ||
    typeof parsed.artistType !==
      "string" ||
    typeof parsed.originIso2 !==
      "string" ||
    typeof parsed.alternateNames !==
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
      NEW_ARTIST_CLAIM_DRAFT_VERSION,
    flowId,
    displayName:
      parsed.displayName,
    artistType:
      parsed.artistType,
    originIso2:
      parsed.originIso2,
    alternateNames:
      parsed.alternateNames,
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
  flowId: string,
  expectedVersion: 1 | 2,
): NewArtistClaimDraft | null {
  const parsed =
    JSON.parse(raw) as
      Record<string, unknown>;

  if (
    parsed.version !==
      expectedVersion ||
    parsed.flowId !== flowId ||
    typeof parsed.displayName !==
      "string" ||
    typeof parsed.artistType !==
      "string" ||
    typeof parsed.originIso2 !==
      "string" ||
    typeof parsed.alternateNames !==
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
      NEW_ARTIST_CLAIM_DRAFT_VERSION,
    flowId,
    displayName:
      parsed.displayName,
    artistType:
      parsed.artistType,
    originIso2:
      parsed.originIso2,
    alternateNames:
      parsed.alternateNames,
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

export function readNewArtistClaimDraft(
  flowId: string,
): NewArtistClaimDraft | null {
  if (
    typeof window === "undefined" ||
    !flowId
  ) {
    return null;
  }

  try {
    const currentRaw =
      window.localStorage.getItem(
        keyFor(flowId),
      );

    if (currentRaw) {
      return parseCurrentDraft(
        currentRaw,
        flowId,
      );
    }

    const previousRaw =
      window.localStorage.getItem(
        keyFor(
          flowId,
          PREVIOUS_KEY_PREFIX,
        ),
      );

    if (previousRaw) {
      return parseOlderDraft(
        previousRaw,
        flowId,
        2,
      );
    }

    const legacyRaw =
      window.localStorage.getItem(
        keyFor(
          flowId,
          LEGACY_KEY_PREFIX,
        ),
      );

    return legacyRaw
      ? parseOlderDraft(
          legacyRaw,
          flowId,
          1,
        )
      : null;
  } catch {
    return null;
  }
}

export type NewArtistClaimDraftSaveResult = {
  draft: NewArtistClaimDraft;
  saved: boolean;
};

export function saveNewArtistClaimDraft(
  input: Omit<
    NewArtistClaimDraft,
    "version" | "updatedAt"
  >,
): NewArtistClaimDraftSaveResult {
  const draft: NewArtistClaimDraft = {
    version:
      NEW_ARTIST_CLAIM_DRAFT_VERSION,
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
      keyFor(input.flowId),
      JSON.stringify(draft),
    );
    window.localStorage.removeItem(
      keyFor(
        input.flowId,
        PREVIOUS_KEY_PREFIX,
      ),
    );
    window.localStorage.removeItem(
      keyFor(
        input.flowId,
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

export function clearNewArtistClaimDraft(
  flowId: string,
) {
  if (
    typeof window === "undefined" ||
    !flowId
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
          flowId,
          prefix,
        ),
      );
    }
  } catch {
    // No-op when local storage is unavailable.
  }
}
