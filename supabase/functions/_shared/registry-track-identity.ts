import {
  titleCreditFragmentPatterns,
  titleCreditSuffixPattern,
} from "./registry-artist-credit-grammar.ts";

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

export function stripArtistCreditPresentationNoise(
  value: string,
): {
  coreTitle: string;
  removedFragments: string[];
} {
  let core = normalizeIdentityText(value);
  const removed: string[] = [];

  for (const pattern of titleCreditFragmentPatterns()) {
    core = core.replace(
      pattern,
      (fragment) => {
        removed.push(String(fragment).trim());
        return " ";
      },
    );
  }

  const suffix = titleCreditSuffixPattern();
  const suffixMatch = core.match(suffix);

  if (suffixMatch) {
    const index = suffixMatch.index ?? core.length;
    removed.push(core.slice(index).trim());
    core = core.slice(0, index);
  }

  return {
    coreTitle: core
      .replace(/\s+/g, " ")
      .replace(/\s+([,;:])/g, "$1")
      .trim(),
    removedFragments: removed.filter(Boolean),
  };
}

export function stripFeatureCreditNoise(
  value: string,
): {
  coreTitle: string;
  removedFragments: string[];
} {
  return stripArtistCreditPresentationNoise(value);
}

export type CanonicalTrackSlugOptions = {
  featuredArtistNames?: string[];
  creditArtistNames?: string[];
};

function fragmentHasStructuredCreditArtist(
  fragment: string,
  creditArtistNames: string[],
): boolean {
  const fragmentSlug =
    slugifyIdentity(fragment);

  return creditArtistNames.some(
    (name) => {
      const artistSlug =
        slugifyIdentity(name);
      if (!artistSlug) {
        return false;
      }

      return (
        fragmentSlug === artistSlug ||
        fragmentSlug.includes(
          "-" + artistSlug + "-",
        ) ||
        fragmentSlug.endsWith(
          "-" + artistSlug,
        )
      );
    },
  );
}

function stripStructurallyProvenArtistCredits(
  value: string,
  creditArtistNames: string[],
): string {
  let next =
    normalizeIdentityText(value);

  if (
    creditArtistNames.length === 0
  ) {
    return next;
  }

  const bracketPatterns =
    titleCreditFragmentPatterns();

  for (
    const pattern of bracketPatterns
  ) {
    next = next.replace(
      pattern,
      (fragment) =>
        fragmentHasStructuredCreditArtist(
          fragment,
          creditArtistNames,
        )
          ? " "
          : fragment,
    );
  }

  const suffix =
    titleCreditSuffixPattern();
  const suffixMatch =
    next.match(suffix);

  if (
    suffixMatch &&
    !/[()[\]{}]/.test(suffixMatch[0]) &&
    fragmentHasStructuredCreditArtist(
      suffixMatch[0],
      creditArtistNames,
    )
  ) {
    const index =
      suffixMatch.index ??
      next.length;
    next = next.slice(
      0,
      index,
    );
  }

  return next
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalTrackSlugCandidate(
  title: string,
  options: CanonicalTrackSlugOptions = {},
): string {
  const creditArtistNames = [
    ...(options.featuredArtistNames || []),
    ...(options.creditArtistNames || []),
  ].filter(Boolean);

  const identityTitle =
    stripStructurallyProvenArtistCredits(
      title,
      [...new Set(creditArtistNames)],
    );

  return (
    slugifyIdentity(identityTitle) ||
    "untitled"
  );
}
