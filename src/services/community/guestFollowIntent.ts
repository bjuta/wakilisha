import { supabase } from "@/lib/supabase";

const DRAFT_KEY = "wk_guest_following_draft_v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();
  return clean || null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

export type GuestFollowIntent = {
  token: string;
  artistCount: number;
  expiresAt: string | null;
};

export type GuestFollowClaim = {
  claimed: boolean;
  alreadyClaimed: boolean;
  followedCount: number;
};

export async function createGuestFollowIntent(
  artistIds: string[],
): Promise<GuestFollowIntent> {
  const uniqueIds = Array.from(
    new Set(
      artistIds
        .map((artistId) => artistId.trim())
        .filter(Boolean),
    ),
  );

  if (
    uniqueIds.length < 1
    || uniqueIds.length > 24
  ) {
    throw new Error(
      "Choose between 1 and 24 Artists.",
    );
  }

  const { data, error } =
    await supabase.rpc(
      "community_create_guest_follow_intent" as never,
      {
        p_artist_ids: uniqueIds,
      } as never,
    );

  if (error) {
    throw error;
  }

  const record = asRecord(data);
  const token = record
    ? readString(record, "token")
    : null;

  if (!record || !token) {
    throw new Error(
      "WAKILISHA could not keep those Artists yet.",
    );
  }

  return {
    token,
    artistCount:
      readNumber(
        record,
        "artist_count",
      ),
    expiresAt:
      readString(
        record,
        "expires_at",
      ),
  };
}

export async function claimGuestFollowIntent(
  token: string,
): Promise<GuestFollowClaim> {
  const cleanToken = token.trim();

  if (!cleanToken) {
    throw new Error(
      "Your Artist choices could not be found.",
    );
  }

  const { data, error } =
    await supabase.rpc(
      "community_claim_guest_follow_intent" as never,
      {
        p_intent_token: cleanToken,
      } as never,
    );

  if (error) {
    throw error;
  }

  const record = asRecord(data);

  if (!record) {
    throw new Error(
      "WAKILISHA could not keep your Artists yet.",
    );
  }

  return {
    claimed:
      record.claimed === true,
    alreadyClaimed:
      record.already_claimed === true,
    followedCount:
      readNumber(
        record,
        "followed_count",
      ),
  };
}

export function buildGuestFollowSignupUrl(
  token: string,
): string {
  if (typeof window === "undefined") {
    return "/auth?mode=signup";
  }

  const returnUrl =
    new URL(
      "/following",
      window.location.origin,
    );
  returnUrl.searchParams.set(
    "followIntent",
    token,
  );

  const authUrl =
    new URL(
      "/auth",
      window.location.origin,
    );
  authUrl.searchParams.set(
    "mode",
    "signup",
  );
  authUrl.searchParams.set(
    "returnTo",
    `${returnUrl.pathname}${returnUrl.search}`,
  );

  return `${authUrl.pathname}${authUrl.search}`;
}

export function readGuestFollowingDraft(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(DRAFT_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as {
      artistIds?: unknown;
      updatedAt?: unknown;
    };

    if (
      typeof parsed.updatedAt !== "number"
      || Date.now() - parsed.updatedAt > DRAFT_MAX_AGE_MS
      || !Array.isArray(parsed.artistIds)
    ) {
      localStorage.removeItem(DRAFT_KEY);
      return [];
    }

    return Array.from(
      new Set(
        parsed.artistIds
          .filter(
            (artistId): artistId is string =>
              typeof artistId === "string"
              && Boolean(artistId.trim()),
          )
          .map((artistId) => artistId.trim()),
      ),
    ).slice(0, 24);
  } catch {
    return [];
  }
}

export function writeGuestFollowingDraft(
  artistIds: string[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        artistIds:
          Array.from(
            new Set(artistIds),
          ).slice(0, 24),
        updatedAt:
          Date.now(),
      }),
    );
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function clearGuestFollowingDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // No action is needed when storage is unavailable.
  }
}
