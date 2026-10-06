// WAKILISHA Provider Identity Control Plane — candidate evidence primitives.
// Candidate generation is explicitly non-canonical. Canonical resolution belongs
// to the shared resolver + governed Registry operation boundary.

import { normalizeIsrc } from "./provider-identity.ts";

export const PROVIDER_CANDIDATE_CONTRACT_VERSION =
  "provider-candidate-evidence-v1" as const;

export type ProviderCandidateEvidenceClassV1 =
  | "strong_identifier"
  | "metadata_similarity";

export type ProviderCandidateMethodV1 =
  | "isrc"
  | "exact_title_artist"
  | "fuzzy_title_artist";

export type ProviderCandidateDispositionV1 =
  | "auto_accept_candidate"
  | "review_candidate"
  | "reject_candidate";

export type AppleMusicCandidateInputV1 = {
  trackTitle: string;
  artistName?: string | null;
  isrc?: string | null;
};

export type AppleMusicCandidateSongV1 = {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    isrc?: string;
  };
};

export type ProviderCandidateEvidenceV1 = {
  contractVersion: typeof PROVIDER_CANDIDATE_CONTRACT_VERSION;
  providerKey: "apple_music";
  providerObjectType: "track";
  providerObjectId: string;
  confidence: number;
  method: ProviderCandidateMethodV1;
  evidenceClass: ProviderCandidateEvidenceClassV1;
  disposition: ProviderCandidateDispositionV1;
  reasons: string[];
};

function normalizeCandidateText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*(feat|ft|with)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(feat|ft|with)[^\]]*\]/gi, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitArtistNames(value: string): string[] {
  return value
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b/gi)
    .map((part) => normalizeCandidateText(part))
    .filter(Boolean);
}

function scoreArtistMatch(
  entryArtistRaw: string,
  candidateArtistRaw: string,
): number {
  const entryArtist = normalizeCandidateText(entryArtistRaw);
  const candidateArtist = normalizeCandidateText(candidateArtistRaw);
  const entryArtists = splitArtistNames(entryArtistRaw);
  const candidateArtists = splitArtistNames(candidateArtistRaw);

  if (!entryArtist || !candidateArtist) return 0;
  if (entryArtist === candidateArtist) return 0.35;

  for (const entryPart of entryArtists) {
    for (const candidatePart of candidateArtists) {
      if (entryPart === candidatePart) return 0.35;
      if (
        entryPart.includes(candidatePart) ||
        candidatePart.includes(entryPart)
      ) {
        return 0.30;
      }
    }
  }

  if (
    entryArtist.includes(candidateArtist) ||
    candidateArtist.includes(entryArtist)
  ) {
    return 0.24;
  }

  return 0;
}

function strippedVersionTitle(title: string): string {
  const normalized = title.trim();
  const stripped = normalized
    .replace(
      /\s[-–—:]\s*(home\s+session|live\s+session|acoustic\s+session|session|home\s+version|live|acoustic)$/i,
      "",
    )
    .replace(
      /\s+\((home\s+session|live\s+session|acoustic\s+session|session|home\s+version|live|acoustic)\)$/i,
      "",
    )
    .replace(
      /\s+\[(home\s+session|live\s+session|acoustic\s+session|session|home\s+version|live|acoustic)\]$/i,
      "",
    )
    .trim();

  return stripped && stripped !== normalized ? stripped : normalized;
}

export function appleMusicSearchTermsV1(
  input: AppleMusicCandidateInputV1,
): string[] {
  const terms = new Set<string>();
  const title = input.trackTitle.trim();
  const artist = input.artistName?.trim() ?? "";
  const full = `${title} ${artist}`.trim();
  const strippedTitle = strippedVersionTitle(title);
  const stripped = `${strippedTitle} ${artist}`.trim();

  if (full) terms.add(full);
  if (stripped && stripped !== full) terms.add(stripped);

  return [...terms];
}

export function scoreAppleMusicCandidateV1(
  input: AppleMusicCandidateInputV1,
  song: AppleMusicCandidateSongV1,
): number {
  const itemTitle = normalizeCandidateText(input.trackTitle);
  const songTitle = normalizeCandidateText(song.attributes?.name ?? "");
  let score = 0;

  if (itemTitle && songTitle && itemTitle === songTitle) {
    score += 0.58;
  } else if (
    itemTitle &&
    songTitle &&
    (itemTitle.includes(songTitle) || songTitle.includes(itemTitle))
  ) {
    score += 0.42;
  }

  score += scoreArtistMatch(
    input.artistName ?? "",
    song.attributes?.artistName ?? "",
  );

  const itemIsrc = normalizeIsrc(input.isrc);
  const songIsrc = normalizeIsrc(song.attributes?.isrc);
  if (itemIsrc && songIsrc && itemIsrc === songIsrc) {
    score = Math.max(score, 0.99);
  }

  return Math.min(Number(score.toFixed(4)), 1);
}

export function classifyAppleMusicCandidateV1(args: {
  input: AppleMusicCandidateInputV1;
  song: AppleMusicCandidateSongV1;
  confidence: number;
  searchTerm: string;
  minAutoAccept: number;
  minimumReviewConfidence?: number;
}): ProviderCandidateEvidenceV1 {
  const minimumReviewConfidence = args.minimumReviewConfidence ?? 0.72;
  const confidence = Math.min(
    1,
    Math.max(0, Number(args.confidence.toFixed(4))),
  );

  const itemIsrc = normalizeIsrc(args.input.isrc);
  const songIsrc = normalizeIsrc(args.song.attributes?.isrc);
  const exactIsrc = Boolean(
    itemIsrc && songIsrc && itemIsrc === songIsrc,
  );

  let method: ProviderCandidateMethodV1;
  let evidenceClass: ProviderCandidateEvidenceClassV1;

  if (exactIsrc) {
    method = "isrc";
    evidenceClass = "strong_identifier";
  } else if (confidence >= 0.9) {
    method = "exact_title_artist";
    evidenceClass = "metadata_similarity";
  } else {
    method = "fuzzy_title_artist";
    evidenceClass = "metadata_similarity";
  }

  let disposition: ProviderCandidateDispositionV1;
  if (confidence < minimumReviewConfidence) {
    disposition = "reject_candidate";
  } else if (
    evidenceClass === "strong_identifier" &&
    confidence >= args.minAutoAccept
  ) {
    disposition = "auto_accept_candidate";
  } else {
    // Similarity evidence is candidate-only regardless of confidence.
    disposition = "review_candidate";
  }

  return {
    contractVersion: PROVIDER_CANDIDATE_CONTRACT_VERSION,
    providerKey: "apple_music",
    providerObjectType: "track",
    providerObjectId: args.song.id,
    confidence,
    method,
    evidenceClass,
    disposition,
    reasons: [
      `apple_search_term:${args.searchTerm}`,
      `candidate_confidence:${confidence.toFixed(4)}`,
      `evidence_class:${evidenceClass}`,
      exactIsrc
        ? `isrc_match:${itemIsrc}`
        : "similarity_only_no_strong_identifier",
    ],
  };
}
