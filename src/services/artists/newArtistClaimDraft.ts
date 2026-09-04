export const NEW_ARTIST_CLAIM_DRAFT_VERSION = 2;

export type NewArtistClaimDraft = {
  version:
    typeof NEW_ARTIST_CLAIM_DRAFT_VERSION;
  flowId: string;
  displayName: string;
  artistType: string;
  originIso2: string;
  alternateNames: string;
  claimantRole: string;
  phoneCountryIso2: string;
  phoneNumber: string;
  statement: string;
  proofLink: string;
  updatedAt: string;
};

const KEY_PREFIX =
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
  flowId: string,
): NewArtistClaimDraft | null {
  const parsed =
    JSON.parse(raw) as
      Record<string, unknown>;

  if (
    parsed.version !== 1 ||
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
    typeof parsed.proofLink !==
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

    const legacyRaw =
      window.localStorage.getItem(
        keyFor(
          flowId,
          LEGACY_KEY_PREFIX,
        ),
      );

    return legacyRaw
      ? parseLegacyDraft(
          legacyRaw,
          flowId,
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
    window.localStorage.removeItem(
      keyFor(flowId),
    );
    window.localStorage.removeItem(
      keyFor(
        flowId,
        LEGACY_KEY_PREFIX,
      ),
    );
  } catch {
    // No-op when local storage is unavailable.
  }
}
