import type {
  EntityResolutionBundle,
  EntityResolutionCandidate,
  EntityResolutionDecision,
  EntityResolutionKind,
  EntityResolutionStatus,
  ProviderIdentifierSet,
  RelationalArtistCredit,
  RichTrackMetadata,
} from "../chartsIntelligence/intelligenceTypes";
import type { IngestResolvedRow } from "../chartsIngestion/ingestStudioTypes";
import { normalize_title, normalize_artist } from "@/services/chartsScoring/normalize";

export type CanonicalArtistEntity = {
  id: string;
  displayName: string;
  normalizedName: string;
  aliases: string[];
  providerIds: ProviderIdentifierSet[];
  originIso2?: string | null;
  imageUrl?: string | null;
};

export type CanonicalTrackEntity = {
  id: string;
  title: string;
  normalizedTitle: string;
  artistNames: string[];
  isrc?: string | null;
  providerIds: ProviderIdentifierSet[];
};

export type CanonicalReleaseEntity = {
  id: string;
  title: string;
  normalizedTitle: string;
  upc?: string | null;
  providerIds: ProviderIdentifierSet[];
};

export type CanonicalLabelEntity = {
  id: string;
  name: string;
  normalizedName: string;
  aliases: string[];
};

export type EntityResolutionRegistry = {
  artists: CanonicalArtistEntity[];
  tracks: CanonicalTrackEntity[];
  releases: CanonicalReleaseEntity[];
  labels: CanonicalLabelEntity[];
  doNotMergePairs?: Array<{ left: string; right: string; reason?: string }>;
};

function tokenSimilarity(a: string, b: string): number {
  const na = normalize_title(a);
  const nb = normalize_title(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const aTokens = new Set(na.split(" ").filter(Boolean));
  const bTokens = new Set(nb.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => { if (bTokens.has(token)) overlap++; });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function providerOverlap(a: ProviderIdentifierSet[] = [], b: ProviderIdentifierSet[] = []): ProviderIdentifierSet[] {
  const overlaps: ProviderIdentifierSet[] = [];
  for (const left of a) {
    for (const right of b) {
      if (left.provider !== right.provider) continue;
      const trackMatch = left.trackId && right.trackId && left.trackId === right.trackId;
      const releaseMatch = left.releaseId && right.releaseId && left.releaseId === right.releaseId;
      const isrcMatch = left.isrc && right.isrc && normalize_title(left.isrc) === normalize_title(right.isrc);
      const upcMatch = left.upc && right.upc && normalize_title(left.upc) === normalize_title(right.upc);
      const artistMatch = (left.artistIds ?? []).some((id) => (right.artistIds ?? []).includes(id));
      if (trackMatch || releaseMatch || isrcMatch || upcMatch || artistMatch) overlaps.push(left);
    }
  }
  return overlaps;
}

function rawObject(row: IngestResolvedRow): Record<string, unknown> {
  return row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : {};
}

function getRichMetadata(row: IngestResolvedRow): RichTrackMetadata | null {
  const raw = rawObject(row);
  return raw.richMetadata && typeof raw.richMetadata === "object" ? raw.richMetadata as RichTrackMetadata : null;
}

function getArtistCredits(row: IngestResolvedRow): RelationalArtistCredit[] {
  const raw = rawObject(row);
  return Array.isArray(raw.artistCredits) ? raw.artistCredits as RelationalArtistCredit[] : [];
}

function isBlocked(registry: EntityResolutionRegistry, sourceId: string, candidateId: string): boolean {
  return (registry.doNotMergePairs ?? []).some((pair) =>
    (pair.left === sourceId && pair.right === candidateId) || (pair.left === candidateId && pair.right === sourceId)
  );
}

function candidateStatus(candidates: EntityResolutionCandidate[], shellId: string): Pick<EntityResolutionDecision, "status" | "canonicalEntityId" | "shellEntityId" | "confidence" | "reviewRequired" | "warnings"> {
  if (!candidates.length) {
    return { status: "shell_created", canonicalEntityId: null, shellEntityId: shellId, confidence: 0, reviewRequired: true, warnings: ["No canonical entity match found; shell created for review."] };
  }
  const best = candidates[0];
  const second = candidates[1];
  if (second && best.confidence - second.confidence <= 5 && best.confidence >= 70) {
    return { status: "duplicate_candidate", canonicalEntityId: best.entityId, shellEntityId: null, confidence: best.confidence, reviewRequired: true, warnings: [`Multiple close candidates found (${best.confidence}% vs ${second.confidence}%).`] };
  }
  if (best.confidence >= 92) {
    return { status: "resolved", canonicalEntityId: best.entityId, shellEntityId: null, confidence: best.confidence, reviewRequired: false, warnings: [] };
  }
  if (best.confidence >= 70) {
    return { status: "needs_review", canonicalEntityId: best.entityId, shellEntityId: null, confidence: best.confidence, reviewRequired: true, warnings: [`Candidate found below auto-resolve threshold (${best.confidence}%).`] };
  }
  return { status: "shell_created", canonicalEntityId: null, shellEntityId: shellId, confidence: best.confidence, reviewRequired: true, warnings: [`Low-confidence candidate only (${best.confidence}%). Shell created instead of auto-merging.`] };
}

function buildDecision(params: {
  entityKind: EntityResolutionKind;
  sourceId: string;
  sourceLabel: string;
  candidates: EntityResolutionCandidate[];
  shellId: string;
}): EntityResolutionDecision {
  const status = candidateStatus(params.candidates, params.shellId);
  return {
    entityKind: params.entityKind,
    sourceId: params.sourceId,
    sourceLabel: params.sourceLabel,
    candidates: params.candidates,
    decidedAt: new Date().toISOString(),
    ...status,
  };
}

function scoreArtist(credit: RelationalArtistCredit, artist: CanonicalArtistEntity, registry: EntityResolutionRegistry): EntityResolutionCandidate | null {
  if (isBlocked(registry, credit.id, artist.id)) return null;
  const overlaps = providerOverlap(credit.providerArtistIds ?? [], artist.providerIds);
  const reasons: string[] = [];
  let confidence = 0;
  let method: EntityResolutionCandidate["method"] = "fuzzy";
  if (overlaps.length) {
    confidence = 97;
    method = "provider_id";
    reasons.push("Provider artist ID overlap");
  } else if (artist.aliases.map(normalize_title).includes(normalize_title(credit.displayName))) {
    confidence = 94;
    method = "alias";
    reasons.push("Known alias match");
  } else if (normalize_title(credit.displayName) === artist.normalizedName) {
    confidence = 93;
    method = "exact_name";
    reasons.push("Exact normalized artist name match");
  } else {
    confidence = Math.round(tokenSimilarity(credit.displayName, artist.displayName) * 100);
    reasons.push("Name token similarity");
  }
  if (confidence < 35) return null;
  return { entityKind: "artist", entityId: artist.id, displayName: artist.displayName, confidence, method, reasons, providerOverlap: overlaps };
}

function scoreTrack(metadata: RichTrackMetadata, row: IngestResolvedRow, track: CanonicalTrackEntity, registry: EntityResolutionRegistry): EntityResolutionCandidate | null {
  if (isBlocked(registry, row.id, track.id)) return null;
  const overlaps = providerOverlap(metadata.providerIds, track.providerIds);
  const reasons: string[] = [];
  let confidence = 0;
  let method: EntityResolutionCandidate["method"] = "fuzzy";
  if (metadata.isrc && track.isrc && normalize_title(metadata.isrc) === normalize_title(track.isrc)) {
    confidence = 99;
    method = "isrc";
    reasons.push("ISRC exact match");
  } else if (overlaps.length) {
    confidence = 97;
    method = "provider_id";
    reasons.push("Provider track ID overlap");
  } else {
    const titleScore = tokenSimilarity(metadata.title, track.title);
    const artistScore = tokenSimilarity(row.artistNames.join(" "), track.artistNames.join(" "));
    confidence = Math.round((titleScore * 0.65 + artistScore * 0.35) * 100);
    method = confidence >= 75 ? "title_artist" : "fuzzy";
    reasons.push("Title and artist similarity");
  }
  if (confidence < 35) return null;
  return { entityKind: "track", entityId: track.id, displayName: track.title, confidence, method, reasons, providerOverlap: overlaps };
}

function scoreRelease(metadata: RichTrackMetadata, release: CanonicalReleaseEntity, registry: EntityResolutionRegistry): EntityResolutionCandidate | null {
  const sourceId = metadata.providerIds.map((id) => id.releaseId).filter(Boolean).join(":") || metadata.releaseTitle || metadata.title;
  if (isBlocked(registry, sourceId ?? metadata.title, release.id)) return null;
  const overlaps = providerOverlap(metadata.providerIds, release.providerIds);
  const reasons: string[] = [];
  let confidence = 0;
  let method: EntityResolutionCandidate["method"] = "fuzzy";
  if (metadata.upc && release.upc && normalize_title(metadata.upc) === normalize_title(release.upc)) {
    confidence = 98;
    method = "provider_id";
    reasons.push("UPC exact match");
  } else if (overlaps.length) {
    confidence = 96;
    method = "provider_id";
    reasons.push("Provider release ID overlap");
  } else if (metadata.releaseTitle) {
    confidence = Math.round(tokenSimilarity(metadata.releaseTitle, release.title) * 100);
    method = confidence >= 85 ? "exact_name" : "fuzzy";
    reasons.push("Release title similarity");
  }
  if (confidence < 35) return null;
  return { entityKind: "release", entityId: release.id, displayName: release.title, confidence, method, reasons, providerOverlap: overlaps };
}

function scoreLabel(metadata: RichTrackMetadata, label: CanonicalLabelEntity, registry: EntityResolutionRegistry): EntityResolutionCandidate | null {
  if (!metadata.labelName) return null;
  if (isBlocked(registry, metadata.labelName, label.id)) return null;
  const aliases = label.aliases.map(normalize_title);
  const labelName = normalize_title(metadata.labelName);
  const reasons: string[] = [];
  let confidence = 0;
  let method: EntityResolutionCandidate["method"] = "fuzzy";
  if (labelName === label.normalizedName) {
    confidence = 94;
    method = "exact_name";
    reasons.push("Exact normalized label name match");
  } else if (aliases.includes(labelName)) {
    confidence = 93;
    method = "alias";
    reasons.push("Known label alias match");
  } else {
    confidence = Math.round(tokenSimilarity(metadata.labelName, label.name) * 100);
    reasons.push("Label name similarity");
  }
  if (confidence < 45) return null;
  return { entityKind: "label", entityId: label.id, displayName: label.name, confidence, method, reasons };
}

function sortCandidates(candidates: Array<EntityResolutionCandidate | null>): EntityResolutionCandidate[] {
  return candidates.filter((candidate): candidate is EntityResolutionCandidate => Boolean(candidate)).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function overallStatus(decisions: EntityResolutionDecision[]): EntityResolutionStatus {
  if (decisions.some((decision) => decision.status === "duplicate_candidate")) return "duplicate_candidate";
  if (decisions.some((decision) => decision.status === "needs_review")) return "needs_review";
  if (decisions.some((decision) => decision.status === "shell_created")) return "shell_created";
  if (decisions.some((decision) => decision.status === "blocked")) return "blocked";
  return "resolved";
}

export function resolveRowEntities(row: IngestResolvedRow, registry: EntityResolutionRegistry): EntityResolutionBundle {
  const metadata = getRichMetadata(row) ?? {
    title: row.title,
    normalizedTitle: normalize_title(row.title),
    providerIds: [],
    providerUrls: [],
  } as RichTrackMetadata;
  const credits = getArtistCredits(row);
  const trackCandidates = sortCandidates(registry.tracks.map((track) => scoreTrack(metadata, row, track, registry)));
  const trackDecision = buildDecision({ entityKind: "track", sourceId: row.id, sourceLabel: row.title, candidates: trackCandidates, shellId: row.releaseShellId ?? `track_shell_${row.id}` });

  const releaseCandidates = metadata.releaseTitle ? sortCandidates(registry.releases.map((release) => scoreRelease(metadata, release, registry))) : [];
  const releaseDecision = metadata.releaseTitle ? buildDecision({ entityKind: "release", sourceId: `${row.id}:release`, sourceLabel: metadata.releaseTitle, candidates: releaseCandidates, shellId: `release_shell_${row.id}` }) : null;

  const artistDecisions = credits.map((credit) => {
    const candidates = sortCandidates(registry.artists.map((artist) => scoreArtist(credit, artist, registry)));
    return buildDecision({ entityKind: "artist", sourceId: credit.id, sourceLabel: credit.displayName, candidates, shellId: `artist_shell_${normalize_title(credit.displayName).replace(/\s+/g, "_")}` });
  });

  const labelCandidates = metadata.labelName ? sortCandidates(registry.labels.map((label) => scoreLabel(metadata, label, registry))) : [];
  const labelDecision = metadata.labelName ? buildDecision({ entityKind: "label", sourceId: `${row.id}:label`, sourceLabel: metadata.labelName, candidates: labelCandidates, shellId: `label_shell_${normalize_title(metadata.labelName).replace(/\s+/g, "_")}` }) : null;

  const decisions = [trackDecision, releaseDecision, labelDecision, ...artistDecisions].filter((decision): decision is EntityResolutionDecision => Boolean(decision));
  const status = overallStatus(decisions);
  const warnings = decisions.flatMap((decision) => decision.warnings);

  return {
    rowId: row.id,
    trackDecision,
    releaseDecision,
    artistDecisions,
    labelDecision,
    overallStatus: status,
    reviewRequired: decisions.some((decision) => decision.reviewRequired),
    warnings,
  };
}

export function applyEntityResolutionToRows(rows: IngestResolvedRow[], registry: EntityResolutionRegistry): { rows: IngestResolvedRow[]; bundles: Record<string, EntityResolutionBundle>; metrics: { resolved: number; needsReview: number; shellCreated: number; duplicateCandidate: number; total: number } } {
  const bundles: Record<string, EntityResolutionBundle> = {};
  let resolved = 0;
  let needsReview = 0;
  let shellCreated = 0;
  let duplicateCandidate = 0;

  const nextRows = rows.map((row) => {
    const bundle = resolveRowEntities(row, registry);
    bundles[row.id] = bundle;
    if (bundle.overallStatus === "resolved") resolved++;
    if (bundle.overallStatus === "needs_review") needsReview++;
    if (bundle.overallStatus === "shell_created") shellCreated++;
    if (bundle.overallStatus === "duplicate_candidate") duplicateCandidate++;

    const canonicalArtistIds = bundle.artistDecisions.map((decision) => decision.canonicalEntityId).filter((id): id is string => Boolean(id));
    return {
      ...row,
      matchStatus: bundle.reviewRequired ? "needs_review" as const : row.matchStatus,
      canonicalTrackId: bundle.trackDecision.canonicalEntityId ?? row.canonicalTrackId,
      canonicalReleaseId: bundle.releaseDecision?.canonicalEntityId ?? row.canonicalReleaseId,
      canonicalArtistIds: canonicalArtistIds.length ? canonicalArtistIds : row.canonicalArtistIds,
      warnings: [...(row.warnings ?? []), ...bundle.warnings],
      raw: {
        ...rawObject(row),
        entityResolution: bundle,
      },
    };
  });

  return { rows: nextRows, bundles, metrics: { resolved, needsReview, shellCreated, duplicateCandidate, total: rows.length } };
}

export function createSeedEntityResolutionRegistry(rows: IngestResolvedRow[]): EntityResolutionRegistry {
  const artists = new Map<string, CanonicalArtistEntity>();
  const tracks = new Map<string, CanonicalTrackEntity>();
  const releases = new Map<string, CanonicalReleaseEntity>();
  const labels = new Map<string, CanonicalLabelEntity>();

  for (const row of rows) {
    const metadata = getRichMetadata(row);
    if (row.canonicalTrackId) {
      tracks.set(row.canonicalTrackId, {
        id: row.canonicalTrackId,
        title: row.title,
        normalizedTitle: normalize_title(row.title),
        artistNames: row.artistNames,
        isrc: metadata?.isrc ?? null,
        providerIds: metadata?.providerIds ?? [],
      });
    }
    if (row.canonicalReleaseId) {
      releases.set(row.canonicalReleaseId, {
        id: row.canonicalReleaseId,
        title: metadata?.releaseTitle ?? row.title,
        normalizedTitle: normalize_title(metadata?.releaseTitle ?? row.title),
        upc: metadata?.upc ?? null,
        providerIds: metadata?.providerIds ?? [],
      });
    }
    const credits = getArtistCredits(row);
    credits.forEach((credit, index) => {
      const canonicalId = row.canonicalArtistIds?.[index] ?? credit.canonicalArtistId ?? `artist_seed_${normalize_title(credit.displayName).replace(/\s+/g, "_")}`;
      artists.set(canonicalId, {
        id: canonicalId,
        displayName: credit.displayName,
        normalizedName: normalize_title(credit.displayName),
        aliases: [credit.displayName],
        providerIds: credit.providerArtistIds ?? [],
      });
    });
    if (metadata?.labelName) {
      const id = `label_seed_${normalize_title(metadata.labelName).replace(/\s+/g, "_")}`;
      labels.set(id, { id, name: metadata.labelName, normalizedName: normalize_title(metadata.labelName), aliases: [metadata.labelName] });
    }
  }

  return { artists: [...artists.values()], tracks: [...tracks.values()], releases: [...releases.values()], labels: [...labels.values()], doNotMergePairs: [] };
}
