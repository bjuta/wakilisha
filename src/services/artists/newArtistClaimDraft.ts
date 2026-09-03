export const NEW_ARTIST_CLAIM_DRAFT_VERSION = 1;

export type NewArtistClaimDraft = {
  version:
    typeof NEW_ARTIST_CLAIM_DRAFT_VERSION;
  flowId: string;
  displayName: string;
  artistType: string;
  originIso2: string;
  alternateNames: string;
  claimantRole: string;
  statement: string;
  proofLink: string;
  updatedAt: string;
};

const KEY_PREFIX =
  "wk-new-artist-claim-draft:v1:";

function keyFor(
  flowId: string,
) {
  return `${KEY_PREFIX}${flowId}`;
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
    const raw =
      window.localStorage.getItem(
        keyFor(flowId),
      );

    if (!raw) return null;

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

export function saveNewArtistClaimDraft(
  input: Omit<
    NewArtistClaimDraft,
    "version" | "updatedAt"
  >,
): NewArtistClaimDraft {
  const draft: NewArtistClaimDraft = {
    version:
      NEW_ARTIST_CLAIM_DRAFT_VERSION,
    ...input,
    updatedAt:
      new Date().toISOString(),
  };

  if (
    typeof window !== "undefined"
  ) {
    try {
      window.localStorage.setItem(
        keyFor(input.flowId),
        JSON.stringify(draft),
      );
    } catch {
      // The form still works when local storage is unavailable.
    }
  }

  return draft;
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
  } catch {
    // No-op when local storage is unavailable.
  }
}
