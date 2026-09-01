export type ArtistCreditRoleHint =
  | "featured"
  | "participant"
  | null;

export type ArtistCreditSeparatorKind =
  | "lead"
  | "feature"
  | "with"
  | "collaboration"
  | "list";

export type ParsedArtistCreditParticipant = {
  name: string;
  separatorKind: ArtistCreditSeparatorKind;
  separatorToken: string | null;
  roleHint: ArtistCreditRoleHint;
};

export type ParsedArtistCreditLine = {
  raw: string;
  participants: ParsedArtistCreditParticipant[];
  leadName: string;
};

const FEATURE_SEPARATOR =
  /\s+(feat\.?|ft\.?|featuring)\s+/i;
const WITH_SEPARATOR =
  /\s+(with|w\/)\s+/i;
const COLLAB_SEPARATOR =
  /\s+(x|&|and|\+)\s+/i;
const LIST_SEPARATOR =
  /\s*,\s*/;

function cleanParticipantName(value: string): string {
  return String(value || "")
    .replace(/^[-–—:;\s]+|[-–—:;\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findNextSeparator(
  value: string,
): {
  index: number;
  length: number;
  kind: Exclude<ArtistCreditSeparatorKind, "lead">;
  token: string;
} | null {
  const candidates: Array<{
    index: number;
    length: number;
    kind: Exclude<ArtistCreditSeparatorKind, "lead">;
    token: string;
  }> = [];

  for (const [pattern, kind] of [
    [FEATURE_SEPARATOR, "feature"],
    [WITH_SEPARATOR, "with"],
    [COLLAB_SEPARATOR, "collaboration"],
    [LIST_SEPARATOR, "list"],
  ] as const) {
    const match = pattern.exec(value);
    if (!match || match.index < 0) continue;

    candidates.push({
      index: match.index,
      length: match[0].length,
      kind,
      token: String(match[1] || match[0]).trim(),
    });
  }

  return candidates.sort((left, right) => {
    if (left.index !== right.index) {
      return left.index - right.index;
    }
    return right.length - left.length;
  })[0] || null;
}

export function parseArtistCreditLine(
  value: string,
): ParsedArtistCreditLine {
  const raw = String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) {
    return {
      raw,
      participants: [],
      leadName: "",
    };
  }

  const participants: ParsedArtistCreditParticipant[] = [];
  let remaining = raw;
  let pendingSeparator: ParsedArtistCreditParticipant["separatorKind"] =
    "lead";
  let pendingToken: string | null = null;

  while (remaining) {
    const separator = findNextSeparator(remaining);
    const segment = separator
      ? remaining.slice(0, separator.index)
      : remaining;
    const name = cleanParticipantName(segment);

    if (name) {
      participants.push({
        name,
        separatorKind: pendingSeparator,
        separatorToken: pendingToken,
        roleHint:
          pendingSeparator === "feature"
            ? "featured"
            : pendingSeparator === "lead"
              ? null
              : "participant",
      });
    }

    if (!separator) break;

    remaining = remaining.slice(
      separator.index + separator.length,
    );
    pendingSeparator = separator.kind;
    pendingToken = separator.token;
  }

  return {
    raw,
    participants,
    leadName: participants[0]?.name || "",
  };
}

export function extractLeadArtistName(value: string): string {
  return parseArtistCreditLine(value).leadName;
}

export function participantNamesFromArtistCreditLine(
  value: string,
): string[] {
  return parseArtistCreditLine(value)
    .participants
    .map((participant) => participant.name)
    .filter(Boolean);
}

export function explicitFeaturedNamesFromArtistCreditLine(
  value: string,
): string[] {
  return parseArtistCreditLine(value)
    .participants
    .filter((participant) => participant.roleHint === "featured")
    .map((participant) => participant.name)
    .filter(Boolean);
}

export function collaborationParticipantNamesFromArtistCreditLine(
  value: string,
): string[] {
  return parseArtistCreditLine(value)
    .participants
    .filter((participant) =>
      participant.separatorKind === "with" ||
      participant.separatorKind === "collaboration" ||
      participant.separatorKind === "list"
    )
    .map((participant) => participant.name)
    .filter(Boolean);
}

export const TITLE_CREDIT_MARKER =
  "(?:feat(?:uring)?|ft|with|w\\/|x)";

export function titleCreditFragmentPatterns(): RegExp[] {
  return [
    new RegExp(
      "\\([^)]*\\b" +
        TITLE_CREDIT_MARKER +
        "\\.?\\s+[^)]*\\)",
      "gi",
    ),
    new RegExp(
      "\\[[^\\]]*\\b" +
        TITLE_CREDIT_MARKER +
        "\\.?\\s+[^\\]]*\\]",
      "gi",
    ),
    new RegExp(
      "\\{[^}]*\\b" +
        TITLE_CREDIT_MARKER +
        "\\.?\\s+[^}]*\\}",
      "gi",
    ),
  ];
}

export function titleCreditSuffixPattern(): RegExp {
  return new RegExp(
    "\\s+(?:-|:)?\\s*\\b" +
      TITLE_CREDIT_MARKER +
      "\\.?\\s+(.+)$",
    "i",
  );
}
