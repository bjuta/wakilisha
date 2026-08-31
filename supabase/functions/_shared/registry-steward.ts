export const REGISTRY_STEWARD_RULE_VERSION = "1.0.0";

export type RegistryStewardDecision =
  | "auto_apply"
  | "noop"
  | "defer";

export interface CanonicalTrackIdentity {
  title: string;
  normalizedTitle: string;
  slug: string;
  sourceTitle: string;
  structuralFeaturedNames: string[];
  structuralCreditRemoved: boolean;
}

export interface TrackStewardProposal {
  decision: RegistryStewardDecision;
  ruleKey:
    | "track.structural_credit_clause.v1"
    | "track.slug_matches_title.v1"
    | "track.identity_clean.v1"
    | "track.structural_credit_unproven.v1";
  ruleVersion: string;
  currentTitle: string;
  currentSlug: string;
  proposedTitle: string;
  proposedNormalizedTitle: string;
  proposedSlug: string;
  structuralFeaturedNames: string[];
  evidence: {
    featuredCreditCoverage: boolean;
    currentSlugMatchesCanonical: boolean;
    titleChanged: boolean;
    slugChanged: boolean;
  };
}

export interface TrackFeaturedCredit {
  name?: string | null;
  slug?: string | null;
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function slugifyRegistryIdentity(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function normalizeRegistryIdentityText(value: string): string {
  return slugifyRegistryIdentity(value)
    .replace(/-/g, " ")
    .trim();
}

export function splitStructuralCreditNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const candidate of raw.split(
    /\s*,\s*|\s+&\s+|\s+and\s+|\s+x\s+|\s+\+\s+/i,
  )) {
    const clean = collapseWhitespace(candidate);
    const key = normalizeRegistryIdentityText(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    names.push(clean);
  }

  return names;
}

export function stripStructuralFeaturedCredits(
  sourceTitle: string,
): {
  title: string;
  featuredNames: string[];
  changed: boolean;
} {
  let title = collapseWhitespace(sourceTitle);
  const featuredNames: string[] = [];
  const seen = new Set<string>();

  const addNames = (raw: string) => {
    for (const name of splitStructuralCreditNames(raw)) {
      const key = normalizeRegistryIdentityText(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      featuredNames.push(name);
    }
  };

  const bracketed =
    /\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]/gi;

  title = title.replace(bracketed, (_match, names: string) => {
    addNames(names);
    return " ";
  });

  const trailingDash =
    /\s+[-\u2013\u2014]\s*(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
  const dashMatch = title.match(trailingDash);
  if (dashMatch?.[1]) {
    addNames(dashMatch[1]);
    title = title.replace(trailingDash, " ");
  }

  const trailingPlain =
    /\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
  const plainMatch = title.match(trailingPlain);
  if (plainMatch?.[1]) {
    addNames(plainMatch[1]);
    title = title.replace(trailingPlain, " ");
  }

  title = collapseWhitespace(
    title
      .replace(/\s+([\]\)])/g, "$1")
      .replace(/([\[\(])\s+/g, "$1"),
  );

  return {
    title: title || collapseWhitespace(sourceTitle),
    featuredNames,
    changed:
      featuredNames.length > 0 &&
      title !== collapseWhitespace(sourceTitle),
  };
}

export function canonicalizeIncomingTrackIdentity(
  sourceTitle: string,
): CanonicalTrackIdentity {
  const source = collapseWhitespace(sourceTitle || "Untitled");
  const structural = stripStructuralFeaturedCredits(source);
  const title = structural.changed
    ? structural.title
    : source;

  return {
    title,
    normalizedTitle: normalizeRegistryIdentityText(title),
    slug: slugifyRegistryIdentity(title),
    sourceTitle: source,
    structuralFeaturedNames: structural.featuredNames,
    structuralCreditRemoved: structural.changed,
  };
}

function normalizedCreditKeys(
  credits: TrackFeaturedCredit[],
): Set<string> {
  const keys = new Set<string>();

  for (const credit of credits) {
    for (const value of [credit.name, credit.slug]) {
      if (!value) continue;
      const key = normalizeRegistryIdentityText(String(value));
      if (key) keys.add(key);
    }
  }

  return keys;
}

export function proposeTrackStewardRepair(input: {
  title: string;
  slug: string;
  featuredCredits: TrackFeaturedCredit[];
}): TrackStewardProposal {
  const currentTitle = collapseWhitespace(input.title || "Untitled");
  const currentSlug = String(input.slug || "").trim();
  const structural =
    stripStructuralFeaturedCredits(currentTitle);
  const creditKeys = normalizedCreditKeys(
    input.featuredCredits,
  );

  const featuredCreditCoverage =
    structural.featuredNames.length > 0 &&
    structural.featuredNames.every((name) =>
      creditKeys.has(normalizeRegistryIdentityText(name))
    );

  if (
    structural.featuredNames.length > 0 &&
    !featuredCreditCoverage
  ) {
    return {
      decision: "defer",
      ruleKey: "track.structural_credit_unproven.v1",
      ruleVersion: REGISTRY_STEWARD_RULE_VERSION,
      currentTitle,
      currentSlug,
      proposedTitle: currentTitle,
      proposedNormalizedTitle:
        normalizeRegistryIdentityText(currentTitle),
      proposedSlug: currentSlug,
      structuralFeaturedNames: structural.featuredNames,
      evidence: {
        featuredCreditCoverage: false,
        currentSlugMatchesCanonical: true,
        titleChanged: false,
        slugChanged: false,
      },
    };
  }

  const proposedTitle =
    featuredCreditCoverage && structural.changed
      ? structural.title
      : currentTitle;
  const proposedNormalizedTitle =
    normalizeRegistryIdentityText(proposedTitle);
  const proposedSlug =
    slugifyRegistryIdentity(proposedTitle);
  const titleChanged =
    proposedTitle !== currentTitle;
  const slugChanged =
    proposedSlug !== currentSlug;

  if (!proposedSlug) {
    return {
      decision: "defer",
      ruleKey: "track.structural_credit_unproven.v1",
      ruleVersion: REGISTRY_STEWARD_RULE_VERSION,
      currentTitle,
      currentSlug,
      proposedTitle: currentTitle,
      proposedNormalizedTitle:
        normalizeRegistryIdentityText(currentTitle),
      proposedSlug: currentSlug,
      structuralFeaturedNames: structural.featuredNames,
      evidence: {
        featuredCreditCoverage,
        currentSlugMatchesCanonical: true,
        titleChanged: false,
        slugChanged: false,
      },
    };
  }

  if (!titleChanged && !slugChanged) {
    return {
      decision: "noop",
      ruleKey: "track.identity_clean.v1",
      ruleVersion: REGISTRY_STEWARD_RULE_VERSION,
      currentTitle,
      currentSlug,
      proposedTitle,
      proposedNormalizedTitle,
      proposedSlug,
      structuralFeaturedNames: structural.featuredNames,
      evidence: {
        featuredCreditCoverage,
        currentSlugMatchesCanonical: true,
        titleChanged: false,
        slugChanged: false,
      },
    };
  }

  return {
    decision: "auto_apply",
    ruleKey: titleChanged
      ? "track.structural_credit_clause.v1"
      : "track.slug_matches_title.v1",
    ruleVersion: REGISTRY_STEWARD_RULE_VERSION,
    currentTitle,
    currentSlug,
    proposedTitle,
    proposedNormalizedTitle,
    proposedSlug,
    structuralFeaturedNames: structural.featuredNames,
    evidence: {
      featuredCreditCoverage,
      currentSlugMatchesCanonical: !slugChanged,
      titleChanged,
      slugChanged,
    },
  };
}
