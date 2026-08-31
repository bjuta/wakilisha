export const MLINZI_ACTOR = "mlinzi";

export type MlinziDisposition =
  | "auto_repair"
  | "leave"
  | "defer"
  | "human_required";

export type MlinziTrackCredit = {
  artistId?: string | null;
  artistSlug?: string | null;
  displayName?: string | null;
  isPrimary: boolean;
  isFeatured?: boolean;
};

export type MlinziSlugAssessmentInput = {
  trackId: string;
  title: string;
  currentSlug: string;
  credits: MlinziTrackCredit[];
  routeCollisionCount?: number;
  redirectConflict?: boolean;
  retryCount?: number;
  publicBreakage?: boolean;
};

export type MlinziSlugAssessment = {
  disposition: MlinziDisposition;
  rule:
    | "track_slug_clean"
    | "track_slug_structural_credit_noise"
    | "track_slug_legacy_artist_prefix"
    | "track_slug_ambiguous_difference"
    | "track_slug_collision"
    | "track_slug_redirect_conflict";
  candidateSlug: string;
  cleanedTitle: string;
  removedCreditClauses: string[];
  primaryArtistSlugs: string[];
  reasons: string[];
};

const FEATURE_CLAUSE =
  /([\(\[]\s*(?:feat(?:uring)?\.?|ft\.?)\s+([^\)\]]+)[\)\]])/gi;
const TRAILING_FEATURE_CLAUSE =
  /(\s+(?:feat(?:uring)?\.?|ft\.?)\s+(.+))$/i;

export function slugifyCulturalRouteValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCreditValue(value: string): string {
  return slugifyCulturalRouteValue(value);
}

function splitCreditParticipants(value: string): string[] {
  return value
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function nonPrimaryCreditKeys(
  credits: MlinziTrackCredit[],
): Set<string> {
  const keys = new Set<string>();

  for (const credit of credits) {
    if (credit.isPrimary) continue;

    const slug = normalizeCreditValue(
      String(credit.artistSlug || ""),
    );
    const name = normalizeCreditValue(
      String(credit.displayName || ""),
    );

    if (slug) keys.add(slug);
    if (name) keys.add(name);
  }

  return keys;
}

function participantsMatchCanonicalCredits(
  participants: string[],
  credits: MlinziTrackCredit[],
): boolean {
  if (participants.length === 0) return false;

  const creditKeys = nonPrimaryCreditKeys(credits);
  if (creditKeys.size === 0) return false;

  return participants.every((participant) => {
    const key = normalizeCreditValue(participant);
    return Boolean(key && creditKeys.has(key));
  });
}

export function stripProvenStructuralCreditNoise(
  title: string,
  credits: MlinziTrackCredit[],
): {
  cleanedTitle: string;
  removedCreditClauses: string[];
} {
  let cleanedTitle = title;
  const removedCreditClauses: string[] = [];

  cleanedTitle = cleanedTitle.replace(
    FEATURE_CLAUSE,
    (fullMatch: string, _whole: string, participants: string) => {
      const parsed = splitCreditParticipants(participants);
      if (!participantsMatchCanonicalCredits(parsed, credits)) {
        return fullMatch;
      }

      removedCreditClauses.push(fullMatch.trim());
      return "";
    },
  );

  const trailingMatch = cleanedTitle.match(TRAILING_FEATURE_CLAUSE);
  if (trailingMatch?.[2]) {
    const parsed = splitCreditParticipants(trailingMatch[2]);
    if (participantsMatchCanonicalCredits(parsed, credits)) {
      removedCreditClauses.push(trailingMatch[1].trim());
      cleanedTitle = cleanedTitle.replace(
        TRAILING_FEATURE_CLAUSE,
        "",
      );
    }
  }

  cleanedTitle = cleanedTitle
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([\]\)])/g, "$1")
    .trim();

  return {
    cleanedTitle,
    removedCreditClauses,
  };
}

function primaryArtistSlugs(
  credits: MlinziTrackCredit[],
): string[] {
  return [
    ...new Set(
      credits
        .filter((credit) => credit.isPrimary)
        .map((credit) =>
          normalizeCreditValue(
            String(credit.artistSlug || ""),
          ),
        )
        .filter(Boolean),
    ),
  ];
}

function hasLegacyArtistPrefix(
  currentSlug: string,
  primarySlugs: string[],
  candidateSlug: string,
  fullTitleSlug: string,
): boolean {
  for (const artistSlug of primarySlugs) {
    const prefix = `${artistSlug}--`;
    if (!currentSlug.startsWith(prefix)) continue;

    const remainder = currentSlug.slice(prefix.length);
    if (
      remainder === candidateSlug ||
      remainder === fullTitleSlug
    ) {
      return true;
    }
  }

  return false;
}

function hasFeatureToken(value: string): boolean {
  return /(^|-)feat(?:uring)?(-|$)|(^|-)ft(-|$)/i.test(value);
}

export function shouldEscalateMlinziFinding(input: {
  retryCount: number;
  publicBreakage: boolean;
  conflictKind:
    | "identity_collision"
    | "redirect_conflict"
    | "provider_disagreement";
}): boolean {
  if (!input.publicBreakage) return false;
  if (input.retryCount < 3) return false;

  return (
    input.conflictKind === "identity_collision" ||
    input.conflictKind === "redirect_conflict" ||
    input.conflictKind === "provider_disagreement"
  );
}

export function assessTrackSlug(
  input: MlinziSlugAssessmentInput,
): MlinziSlugAssessment {
  const currentSlug = normalizeCreditValue(input.currentSlug);
  const primarySlugs = primaryArtistSlugs(input.credits);
  const {
    cleanedTitle,
    removedCreditClauses,
  } = stripProvenStructuralCreditNoise(
    input.title,
    input.credits,
  );
  const candidateSlug = slugifyCulturalRouteValue(cleanedTitle);
  const fullTitleSlug = slugifyCulturalRouteValue(input.title);
  const reasons: string[] = [];

  if (!candidateSlug || candidateSlug === currentSlug) {
    return {
      disposition: "leave",
      rule: "track_slug_clean",
      candidateSlug: candidateSlug || currentSlug,
      cleanedTitle,
      removedCreditClauses,
      primaryArtistSlugs: primarySlugs,
      reasons: ["Current slug already matches the deterministic public route slug."],
    };
  }

  if ((input.routeCollisionCount || 0) > 0) {
    const humanRequired = shouldEscalateMlinziFinding({
      retryCount: input.retryCount || 0,
      publicBreakage: Boolean(input.publicBreakage),
      conflictKind: "identity_collision",
    });

    return {
      disposition: humanRequired
        ? "human_required"
        : "defer",
      rule: "track_slug_collision",
      candidateSlug,
      cleanedTitle,
      removedCreditClauses,
      primaryArtistSlugs: primarySlugs,
      reasons: [
        "A canonical Track already occupies the proposed route scope.",
        humanRequired
          ? "The collision is persistent and materially public, so human judgment is justified."
          : "Mlinzi will retry automatically instead of creating review work.",
      ],
    };
  }

  if (input.redirectConflict) {
    const humanRequired = shouldEscalateMlinziFinding({
      retryCount: input.retryCount || 0,
      publicBreakage: Boolean(input.publicBreakage),
      conflictKind: "redirect_conflict",
    });

    return {
      disposition: humanRequired
        ? "human_required"
        : "defer",
      rule: "track_slug_redirect_conflict",
      candidateSlug,
      cleanedTitle,
      removedCreditClauses,
      primaryArtistSlugs: primarySlugs,
      reasons: [
        "An existing permanent redirect disagrees with the proposed route.",
        humanRequired
          ? "The redirect conflict is persistent and materially public."
          : "Mlinzi will retry automatically without creating an admin task.",
      ],
    };
  }

  const legacyPrefix = hasLegacyArtistPrefix(
    currentSlug,
    primarySlugs,
    candidateSlug,
    fullTitleSlug,
  );

  if (legacyPrefix) {
    reasons.push(
      "The slug duplicates a canonical primary Artist already present in the route scope.",
    );
  }

  const featureNoise =
    removedCreditClauses.length > 0 &&
    (
      hasFeatureToken(currentSlug) ||
      currentSlug === fullTitleSlug ||
      legacyPrefix
    );

  if (featureNoise) {
    reasons.push(
      "Featured Artist text is proven by canonical credits and belongs in the credit graph, not the route slug.",
    );
  }

  if (legacyPrefix || featureNoise) {
    return {
      disposition: "auto_repair",
      rule: legacyPrefix
        ? "track_slug_legacy_artist_prefix"
        : "track_slug_structural_credit_noise",
      candidateSlug,
      cleanedTitle,
      removedCreditClauses,
      primaryArtistSlugs: primarySlugs,
      reasons,
    };
  }

  return {
    disposition: "defer",
    rule: "track_slug_ambiguous_difference",
    candidateSlug,
    cleanedTitle,
    removedCreditClauses,
    primaryArtistSlugs: primarySlugs,
    reasons: [
      "The slug differs from the deterministic title route, but the difference is not proven structural noise.",
      "Mlinzi leaves canonical data untouched and retries when stronger evidence appears.",
    ],
  };
}

export type OneTrackReleaseParityInput = {
  activeTrackCount: number;
  missingArtistLinkCount: number;
};

export function classifyOneTrackReleaseArtistParity(
  input: OneTrackReleaseParityInput,
): MlinziDisposition {
  if (input.missingArtistLinkCount <= 0) return "leave";
  if (input.activeTrackCount === 1) return "auto_repair";
  return "defer";
}
