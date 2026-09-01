export function normalizeIdentityText(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyIdentity(value: string): string {
  return normalizeIdentityText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

const FEATURE_TOKEN = "(?:feat(?:uring)?|ft)";

function stripFeatureBracketSegments(
  value: string,
): { value: string; removed: string[] } {
  let next = value;
  const removed: string[] = [];
  const patterns = [
    new RegExp(
      "\\(([^)]*\\b" +
        FEATURE_TOKEN +
        "\\.?\\s+[^)]*)\\)",
      "gi",
    ),
    new RegExp(
      "\\[([^\\]]*\\b" +
        FEATURE_TOKEN +
        "\\.?\\s+[^\\]]*)\\]",
      "gi",
    ),
    new RegExp(
      "\\{([^}]*\\b" +
        FEATURE_TOKEN +
        "\\.?\\s+[^}]*)\\}",
      "gi",
    ),
  ];

  for (const pattern of patterns) {
    next = next.replace(
      pattern,
      (match) => {
        removed.push(match.trim());
        return " ";
      },
    );
  }

  return {
    value: next,
    removed,
  };
}

export function stripFeatureCreditNoise(
  value: string,
): {
  coreTitle: string;
  removedFragments: string[];
} {
  const normalized =
    normalizeIdentityText(value);
  const bracketed =
    stripFeatureBracketSegments(
      normalized,
    );
  let core = bracketed.value;
  const removed = [
    ...bracketed.removed,
  ];
  const suffix = new RegExp(
    "\\s+(?:-|:)?\\s*\\b" +
      FEATURE_TOKEN +
      "\\.?\\s+(.+)$",
    "i",
  );
  const suffixMatch =
    core.match(suffix);

  if (suffixMatch) {
    const index =
      suffixMatch.index ??
      core.length;
    removed.push(
      core.slice(index).trim(),
    );
    core = core.slice(
      0,
      index,
    );
  }

  return {
    coreTitle: core
      .replace(/\s+/g, " ")
      .replace(
        /\s+([,;:])/g,
        "$1",
      )
      .trim(),
    removedFragments:
      removed.filter(Boolean),
  };
}

export function canonicalTrackSlugCandidate(
  title: string,
): string {
  const coreTitle =
    stripFeatureCreditNoise(
      title,
    ).coreTitle;

  return (
    slugifyIdentity(coreTitle) ||
    "untitled"
  );
}
