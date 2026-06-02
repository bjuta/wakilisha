/**
 * Canonical Matching Engine — Sprint 4 Hardening
 * Deterministic confidence scoring and match status assignment.
 * Searches a registry of canonical tracks, artists, and releases.
 * Returns typed matchStatus: canonical | shell | no_match | needs_review | duplicate_candidate
 */

import type { NormalizedChartRow, IngestResolvedRow, MatchStatus } from "./ingestStudioTypes";

// ─── Registry Types ───
export interface CanonicalTrack {
  id: string;
  isrc?: string;
  title: string;
  artistNames: string[];
  releaseTitle?: string;
  providerIds: { spotify?: string; apple?: string; youtube?: string };
}

export interface CanonicalArtist {
  id: string;
  name: string;
  aliases: string[];
  providerIds: { spotify?: string; apple?: string };
}

export interface CanonicalRelease {
  id: string;
  title: string;
  artistIds: string[];
  releaseDate?: string;
  providerIds: { spotify?: string; apple?: string };
}

export interface CanonicalRegistry {
  tracks: CanonicalTrack[];
  artists: CanonicalArtist[];
  releases: CanonicalRelease[];
}

// ─── Mock Registry ───
// In production this would be fetched from the backend registry DB.
// For the hardening pass, use a realistic seeded registry.
const MOCK_CANONICAL_TRACKS: CanonicalTrack[] = [
  { id: "wk-track-001", isrc: "NGA0H2400001", title: "Love Me JeJe", artistNames: ["Tems"], providerIds: { spotify: "spotify:track:tems001", apple: "apple:track:tems001" } },
  { id: "wk-track-002", isrc: "USUM72012345", title: "Ojuelegba", artistNames: ["WizKid"], providerIds: { spotify: "spotify:track:wiz001", apple: "apple:track:wiz001" } },
  { id: "wk-track-003", isrc: "USUM72012346", title: "Last Last", artistNames: ["Burna Boy"], providerIds: { spotify: "spotify:track:ng002", apple: "apple:track:ng002" } },
  { id: "wk-track-004", title: "Essence", artistNames: ["WizKid", "Tems"], providerIds: { spotify: "spotify:track:ng001", apple: "apple:track:ng001" } },
  { id: "wk-track-005", title: "Rush", artistNames: ["Ayra Starr"], providerIds: { spotify: "spotify:track:ng004", apple: "apple:track:ng004" } },
  { id: "wk-track-006", title: "Calm Down", artistNames: ["Rema"], providerIds: { spotify: "spotify:track:ng005", apple: "apple:track:ng005" } },
  { id: "wk-track-007", title: "Soso", artistNames: ["Omah Lay"], providerIds: { spotify: "spotify:track:ng006", apple: "apple:track:ng006" } },
  { id: "wk-track-008", title: "Peru", artistNames: ["Fireboy DML"], providerIds: { spotify: "spotify:track:ng007", apple: "apple:track:ng007" } },
  { id: "wk-track-009", title: "Buga", artistNames: ["Kizz Daniel", "Tekno"], providerIds: { spotify: "spotify:track:ng009", apple: "apple:track:ng009" } },
  { id: "wk-track-010", title: "Terminator", artistNames: ["King Promise"], providerIds: { spotify: "spotify:track:pan006", apple: "apple:track:pan006" } },
  { id: "wk-track-011", title: "Ameno Amapiano", artistNames: ["Goya Menor", "Nektunez"], providerIds: { spotify: "spotify:track:pan007", apple: "apple:track:pan007" } },
  { id: "wk-track-012", title: "Water", artistNames: ["Tyla"], providerIds: { spotify: "spotify:track:za004", apple: "apple:track:za004" } },
  { id: "wk-track-013", title: "Jerusalema", artistNames: ["Master KG", "Nomcebo Zikode"], providerIds: { spotify: "spotify:track:za001", apple: "apple:track:za001" } },
  { id: "wk-track-014", title: "Gwagwalada", artistNames: ["Bnxn", "Kizz Daniel", "Seyi Vibez"], providerIds: { spotify: "spotify:track:pan005", apple: "apple:track:pan005" } },
  { id: "wk-track-015", title: "Soweto", artistNames: ["Victony", "Tempoe"], providerIds: { spotify: "spotify:track:pan004", apple: "apple:track:pan004" } },
  { id: "wk-track-016", title: "Suzanna", artistNames: ["Sauti Sol"], providerIds: { spotify: "spotify:track:ken001", apple: "apple:track:ken001" } },
  { id: "wk-track-017", title: "Finesse", artistNames: ["Pheelz", "Bnxn"], providerIds: { spotify: "spotify:track:pan009", apple: "apple:track:pan009" } },
  { id: "wk-track-018", title: "Joha", artistNames: ["Asake"], providerIds: { spotify: "spotify:track:ng008", apple: "apple:track:ng008" } },
  { id: "wk-track-019", title: "Unavailable", artistNames: ["Davido", "Musa Keys"], providerIds: { spotify: "spotify:track:ng003", apple: "apple:track:ng003" } },
  { id: "wk-track-020", title: "Touch It", artistNames: ["KiDi"], providerIds: { spotify: "spotify:track:gh004", apple: "apple:track:gh004" } },
  { id: "wk-track-021", title: "Forever", artistNames: ["Gyakie"], providerIds: { spotify: "spotify:track:gh006", apple: "apple:track:gh006" } },
  { id: "wk-track-022", title: "Sugarcane", artistNames: ["Camidoh"], providerIds: { spotify: "spotify:track:gh007", apple: "apple:track:gh007" } },
  { id: "wk-track-023", title: "Kainama", artistNames: ["Harmonize"], providerIds: { spotify: "spotify:track:tz003", apple: "apple:track:tz003" } },
  { id: "wk-track-024", title: "Yatapita", artistNames: ["Diamond Platnumz"], providerIds: { spotify: "spotify:track:tz001", apple: "apple:track:tz001" } },
  { id: "wk-track-025", title: "Good For That", artistNames: ["Cassper Nyovest"], providerIds: { spotify: "spotify:track:za005", apple: "apple:track:za005" } },
];

export function getCanonicalRegistry(): CanonicalRegistry {
  return {
    tracks: MOCK_CANONICAL_TRACKS,
    artists: [],
    releases: [],
  };
}

// ─── String Similarity (Jaro-Winkler Approximation) ───
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;

  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  tokensA.forEach((t) => { if (tokensB.has(t)) overlap++; });
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function artistSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const aNorm = a.map((x) => normalize(x));
  const bNorm = b.map((x) => normalize(x));
  let matched = 0;
  aNorm.forEach((an) => {
    if (bNorm.some((bn) => tokenSimilarity(an, bn) > 0.8)) matched++;
  });
  return matched / Math.max(aNorm.length, bNorm.length);
}

// ─── Match Scoring ───
export interface MatchCandidate {
  track: CanonicalTrack;
  confidence: number;
  method: "isrc" | "provider_id" | "title_artist" | "fuzzy" | "no_match";
  reasons: string[];
}

export function scoreMatch(row: NormalizedChartRow, track: CanonicalTrack): MatchCandidate {
  const reasons: string[] = [];
  let confidence = 0;
  let method: MatchCandidate["method"] = "fuzzy";

  // ISRC exact match — highest confidence
  const rowRaw = row.raw as Record<string, unknown> | undefined;
  const rowIsrc = rowRaw?.isrc as string | undefined;
  if (rowIsrc && track.isrc && normalize(rowIsrc) === normalize(track.isrc)) {
    confidence = 99;
    method = "isrc";
    reasons.push("ISRC exact match");
    return { track, confidence, method, reasons };
  }

  // Provider ID match — very high confidence
  const providerTrackId = row.providerTrackId || "";
  const providerIds = Object.values(track.providerIds).filter(Boolean) as string[];
  if (providerTrackId && providerIds.some((id) => id === providerTrackId || id.includes(providerTrackId) || providerTrackId.includes(id.split(":").pop() ?? ""))) {
    confidence = 97;
    method = "provider_id";
    reasons.push("Provider track ID match");
    return { track, confidence, method, reasons };
  }

  // Title + artist similarity
  const title = row.trackTitle || "";
  const artists = row.artistNames || [];
  const titleSim = tokenSimilarity(title, track.title);
  const artistSim = artistSimilarity(artists, track.artistNames);

  confidence = Math.round(titleSim * 65 + artistSim * 35);

  if (titleSim >= 0.9 && artistSim >= 0.9) {
    method = "title_artist";
    reasons.push("Strong title + artist match");
  } else if (titleSim >= 0.7 && artistSim >= 0.7) {
    method = "title_artist";
    reasons.push("Moderate title + artist match");
  } else if (titleSim >= 0.5) {
    reasons.push("Partial title similarity");
  } else {
    method = "fuzzy";
    reasons.push("Low similarity — fuzzy match");
  }

  return { track, confidence, method, reasons };
}

// ─── Registry Lookup ───
export function searchRegistry(row: NormalizedChartRow, registry: CanonicalRegistry): MatchCandidate[] {
  const scored = registry.tracks
    .map((track) => scoreMatch(row, track))
    .filter((m) => m.confidence >= 20);

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, 5); // Top 5 candidates
}

// ─── Assign Match Status ───
export function assignMatchStatus(candidates: MatchCandidate[], row: NormalizedChartRow): {
  status: MatchStatus;
  confidence: number;
  canonicalTrackId: string | null;
  releaseShellId: string | null;
  warnings: string[];
  candidateCount: number;
} {
  const warnings: string[] = [];

  if (!row.artworkUrl) warnings.push("Missing artwork URL from provider");
  if (!row.previewUrl) warnings.push("No preview URL available");
  if (!row.externalUrl) warnings.push("No external URL from provider");

  if (candidates.length === 0) {
    return {
      status: "no_match",
      confidence: 0,
      canonicalTrackId: null,
      releaseShellId: `shell-${row.providerTrackId || row.trackTitle?.replace(/\s+/g, "-").toLowerCase() || "unknown"}`,
      warnings: [...warnings, "No registry match found — manual intervention required"],
      candidateCount: 0,
    };
  }

  const best = candidates[0];
  const secondBest = candidates[1];

  // Duplicate candidate detection: two matches within 5 points of each other
  if (secondBest && best.confidence - secondBest.confidence <= 5 && best.confidence >= 70) {
    return {
      status: "duplicate_candidate",
      confidence: best.confidence,
      canonicalTrackId: best.track.id,
      releaseShellId: null,
      warnings: [...warnings, `Multiple candidate matches found (${best.confidence}% vs ${secondBest.confidence}%). Manual selection required.`],
      candidateCount: candidates.length,
    };
  }

  // High-confidence canonical match
  if (best.confidence >= 90) {
    return {
      status: "canonical",
      confidence: best.confidence,
      canonicalTrackId: best.track.id,
      releaseShellId: null,
      warnings,
      candidateCount: candidates.length,
    };
  }

  // Medium-confidence — needs review
  if (best.confidence >= 65) {
    return {
      status: "needs_review",
      confidence: best.confidence,
      canonicalTrackId: best.track.id,
      releaseShellId: null,
      warnings: [...warnings, `Match confidence is ${best.confidence}% (below threshold). ${best.reasons.join("; ")}`],
      candidateCount: candidates.length,
    };
  }

  // Low-confidence — shell
  if (best.confidence >= 40) {
    return {
      status: "shell",
      confidence: best.confidence,
      canonicalTrackId: null,
      releaseShellId: `shell-${row.providerTrackId || "unknown"}`,
      warnings: [...warnings, `Low confidence match (${best.confidence}%). Release shell created. ${best.reasons.join("; ")}`],
      candidateCount: candidates.length,
    };
  }

  return {
    status: "no_match",
    confidence: best.confidence,
    canonicalTrackId: null,
    releaseShellId: `shell-${row.providerTrackId || "unknown"}`,
    warnings: [...warnings, "Insufficient match confidence — no canonical entity assigned"],
    candidateCount: candidates.length,
  };
}

// ─── Full Canonical Match Pass ───
export function runCanonicalMatch(rows: NormalizedChartRow[], registry?: CanonicalRegistry): {
  resolvedRows: IngestResolvedRow[];
  metrics: {
    canonical: number;
    shell: number;
    noMatch: number;
    needsReview: number;
    duplicateCandidate: number;
    matchRate: number;
    registryHits: number;
    avgConfidence: number;
  };
  stageWarnings: string[];
} {
  const reg = registry ?? getCanonicalRegistry();
  const resolvedRows: IngestResolvedRow[] = [];
  const stageWarnings: string[] = [];

  let canonical = 0, shell = 0, noMatch = 0, needsReview = 0, duplicateCandidate = 0;
  let totalConfidence = 0;
  let registryHits = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const candidates = searchRegistry(row, reg);
    if (candidates.length > 0) registryHits++;

    const assignment = assignMatchStatus(candidates, row);
    totalConfidence += assignment.confidence;

    if (assignment.status === "canonical") canonical++;
    else if (assignment.status === "shell") shell++;
    else if (assignment.status === "no_match") noMatch++;
    else if (assignment.status === "needs_review") needsReview++;
    else if (assignment.status === "duplicate_candidate") duplicateCandidate++;

    // Collect global stage warnings
    const credErr = assignment.warnings.filter((w) => w.toLowerCase().includes("credentials") || w.toLowerCase().includes("missing token"));
    stageWarnings.push(...credErr);

    const resolved: IngestResolvedRow = {
      id: `row-${row.sourceProvider.substring(0, 2)}-${row.providerTrackId || i}`,
      rank: row.rank,
      previousRank: row.previousRank ?? null,
      movement: row.movement ?? null,
      sourceProvider: row.sourceProvider,
      sourceUrl: row.sourceUrl,
      title: row.trackTitle || row.releaseTitle || "Unknown",
      artistNames: row.artistNames,
      artworkUrl: row.artworkUrl ?? null,
      matchStatus: assignment.status,
      confidence: assignment.confidence,
      canonicalTrackId: assignment.canonicalTrackId,
      canonicalReleaseId: null,
      canonicalArtistIds: [],
      releaseShellId: assignment.releaseShellId,
      warnings: assignment.warnings.length > 0 ? assignment.warnings : undefined,
      raw: row.raw,
    };

    resolvedRows.push(resolved);
  }

  const total = resolvedRows.length;
  const matchRate = total > 0 ? Math.round((canonical / total) * 1000) / 10 : 0;
  const avgConfidence = total > 0 ? Math.round(totalConfidence / total) : 0;

  return {
    resolvedRows,
    metrics: { canonical, shell, noMatch, needsReview, duplicateCandidate, matchRate, registryHits, avgConfidence },
    stageWarnings: [...new Set(stageWarnings)],
  };
}

// ─── Match Decision API ───
export type MatchDecisionAction =
  | "accept_canonical"
  | "change_match"
  | "attach_to_existing"
  | "create_shell"
  | "merge_shell"
  | "mark_duplicate"
  | "ignore"
  | "send_to_review";

export interface MatchDecision {
  rowId: string;
  action: MatchDecisionAction;
  canonicalTrackId?: string;
  note?: string;
  actor: string;
  decidedAt: string;
}

export interface MatchDecisionResult {
  rowId: string;
  previousStatus: MatchStatus;
  newStatus: MatchStatus;
  confidence: number;
  canonicalTrackId: string | null;
  releaseShellId: string | null;
  action: MatchDecisionAction;
  note?: string;
}

export function applyMatchDecision(
  row: IngestResolvedRow,
  decision: MatchDecision,
  registry?: CanonicalRegistry
): MatchDecisionResult {
  const prev = row.matchStatus;
  const reg = registry ?? getCanonicalRegistry();

  switch (decision.action) {
    case "accept_canonical": {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "canonical",
        confidence: 100,
        canonicalTrackId: row.canonicalTrackId ?? decision.canonicalTrackId ?? null,
        releaseShellId: null,
        action: decision.action,
        note: decision.note ?? "Manually accepted canonical match",
      };
    }

    case "change_match":
    case "attach_to_existing": {
      const trackId = decision.canonicalTrackId;
      const track = trackId ? reg.tracks.find((t) => t.id === trackId) : null;
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "canonical",
        confidence: 95,
        canonicalTrackId: trackId ?? null,
        releaseShellId: null,
        action: decision.action,
        note: track ? `Attached to "${track.title}" by ${track.artistNames.join(", ")}` : decision.note,
      };
    }

    case "create_shell": {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "shell",
        confidence: 0,
        canonicalTrackId: null,
        releaseShellId: `shell-${row.id}`,
        action: "create_shell",
        note: decision.note ?? "Release shell created for manual canonicalization",
      };
    }

    case "merge_shell": {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "canonical",
        confidence: 90,
        canonicalTrackId: decision.canonicalTrackId ?? row.canonicalTrackId ?? null,
        releaseShellId: null,
        action: "merge_shell",
        note: decision.note ?? "Shell merged with existing canonical entity",
      };
    }

    case "mark_duplicate": {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "duplicate_candidate",
        confidence: row.confidence,
        canonicalTrackId: row.canonicalTrackId,
        releaseShellId: null,
        action: "mark_duplicate",
        note: decision.note ?? "Marked as duplicate candidate",
      };
    }

    case "ignore": {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "no_match",
        confidence: 0,
        canonicalTrackId: null,
        releaseShellId: null,
        action: "ignore",
        note: decision.note ?? "Row ignored — excluded from chart",
      };
    }

    case "send_to_review": {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: "needs_review",
        confidence: row.confidence,
        canonicalTrackId: row.canonicalTrackId,
        releaseShellId: row.releaseShellId ?? null,
        action: "send_to_review",
        note: decision.note ?? "Sent to review queue",
      };
    }

    default: {
      return {
        rowId: row.id,
        previousStatus: prev,
        newStatus: prev,
        confidence: row.confidence,
        canonicalTrackId: row.canonicalTrackId ?? null,
        releaseShellId: row.releaseShellId ?? null,
        action: decision.action,
      };
    }
  }
}

// ─── Search Registry by Query ───
export function searchRegistryByQuery(query: string, registry?: CanonicalRegistry): CanonicalTrack[] {
  const reg = registry ?? getCanonicalRegistry();
  if (!query.trim()) return [];
  const q = normalize(query);
  return reg.tracks
    .filter((t) => {
      const titleSim = tokenSimilarity(t.title, q);
      const artistSim = t.artistNames.some((a) => tokenSimilarity(a, q) > 0.5);
      return titleSim > 0.4 || artistSim;
    })
    .slice(0, 10);
}