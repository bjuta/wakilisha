export type ChartArtistCreditRole =
  | "primary_artist"
  | "featured_artist";

export type ChartArtistCredit = {
  displayName: string;
  displayCredit: string;
  role: ChartArtistCreditRole;
  creditOrder: number;
};

export type ChartArtistCreditParseResult =
  | {
      status: "resolved";
      credits: ChartArtistCredit[];
      reason: null;
    }
  | {
      status: "ambiguous";
      credits: [];
      reason: string;
    };

const FEATURE_MARKER =
  /\s+(?:feat\.?|ft\.?|featuring)\s+/gi;

const COLLABORATOR_SEPARATOR =
  /\s*,\s*|\s+&\s+|\s+and\s+|\s+x\s+|\s+\+\s+/i;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function comparisonKey(value: string): string {
  return compactWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitArtistNames(value: string): string[] {
  return value
    .split(COLLABORATOR_SEPARATOR)
    .map(compactWhitespace)
    .filter(Boolean);
}

export function parseChartArtistCredits(
  rawArtistDisplay: string,
): ChartArtistCreditParseResult {
  const raw = compactWhitespace(rawArtistDisplay);
  if (!raw) {
    return {
      status: "ambiguous",
      credits: [],
      reason: "artist_display_empty",
    };
  }

  const featureMatches = [...raw.matchAll(FEATURE_MARKER)];
  FEATURE_MARKER.lastIndex = 0;

  if (featureMatches.length > 1) {
    return {
      status: "ambiguous",
      credits: [],
      reason: "multiple_feature_markers",
    };
  }

  let primarySegment = raw;
  let featuredSegment = "";

  if (featureMatches.length === 1) {
    const match = featureMatches[0];
    const markerIndex = match.index ?? -1;

    if (markerIndex < 0) {
      return {
        status: "ambiguous",
        credits: [],
        reason: "feature_marker_position_unknown",
      };
    }

    primarySegment = raw.slice(0, markerIndex);
    featuredSegment = raw.slice(
      markerIndex + match[0].length,
    );
  }

  const primary = splitArtistNames(primarySegment);
  const featured = featuredSegment
    ? splitArtistNames(featuredSegment)
    : [];

  if (primary.length === 0) {
    return {
      status: "ambiguous",
      credits: [],
      reason: "primary_artist_missing",
    };
  }

  if (featureMatches.length === 1 && featured.length === 0) {
    return {
      status: "ambiguous",
      credits: [],
      reason: "featured_artist_missing",
    };
  }

  const seen = new Map<string, ChartArtistCreditRole>();
  const ordered: Array<{
    name: string;
    role: ChartArtistCreditRole;
  }> = [];

  for (const [role, names] of [
    ["primary_artist", primary],
    ["featured_artist", featured],
  ] as const) {
    for (const name of names) {
      const key = comparisonKey(name);
      if (!key) {
        return {
          status: "ambiguous",
          credits: [],
          reason: "artist_name_normalizes_empty",
        };
      }

      const priorRole = seen.get(key);
      if (priorRole && priorRole !== role) {
        return {
          status: "ambiguous",
          credits: [],
          reason: "artist_role_conflict",
        };
      }

      if (priorRole) continue;
      seen.set(key, role);
      ordered.push({ name, role });
    }
  }

  return {
    status: "resolved",
    reason: null,
    credits: ordered.map((credit, index) => ({
      displayName: credit.name,
      displayCredit: credit.name,
      role: credit.role,
      creditOrder: index + 1,
    })),
  };
}
