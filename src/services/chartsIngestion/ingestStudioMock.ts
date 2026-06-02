/**
 * Ingest Studio Mock Data & Store
 * LocalStorage-backed persistence for provider-based ingest runs.
 */

import type {
  IngestRun,
  IngestStageStatus,
  IngestResolvedRow,
  IngestRunSummary,
  IngestStudioKpi,
  RecentIngestActivity,
  ResourceGuardStatus,
  CreateIngestDryRunResponse,
  CommitIngestRunResponse,
} from "./ingestStudioTypes";
import { fetchFromAllSources } from "./providerFetch";
import { normalizeToResolvedRows } from "./normalize";
import { detectProviderFromUrl } from "./providerDetection";
import { runCanonicalMatch } from "./canonicalMatch";
import { enrichRows, applyEnrichmentToRow, checkEnrichmentCredentials } from "./enrichment";

const STUDIO_STORE_KEY = "wkcharts_ingest_studio_v1";

const mockResolvedRows: IngestResolvedRow[] = [
  {
    id: "row-001",
    rank: 1,
    previousRank: 3,
    movement: "up",
    sourceProvider: "spotify",
    sourceUrl: "https://open.spotify.com/playlist/top40",
    title: "Ojuelegba",
    artistNames: ["WizKid"],
    artworkUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop",
    matchStatus: "canonical",
    confidence: 98,
    canonicalTrackId: "track-wiz-001",
    canonicalReleaseId: "release-wiz-001",
    canonicalArtistIds: ["artist-wiz-001"],
    warnings: [],
  },
  {
    id: "row-002",
    rank: 2,
    previousRank: 1,
    movement: "down",
    sourceProvider: "apple_music",
    sourceUrl: "https://music.apple.com/ug/playlist/top40",
    title: "Last Last",
    artistNames: ["Burna Boy"],
    artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop",
    matchStatus: "canonical",
    confidence: 97,
    canonicalTrackId: "track-burna-001",
    canonicalReleaseId: "release-burna-001",
    canonicalArtistIds: ["artist-burna-001"],
    warnings: [],
  },
  {
    id: "row-003",
    rank: 3,
    previousRank: null,
    movement: "new",
    sourceProvider: "spotify",
    sourceUrl: "https://open.spotify.com/playlist/top40",
    title: "Essence",
    artistNames: ["WizKid", "Tems"],
    artworkUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop",
    matchStatus: "canonical",
    confidence: 95,
    canonicalTrackId: "track-wiz-002",
    canonicalReleaseId: "release-wiz-002",
    canonicalArtistIds: ["artist-wiz-001", "artist-tems-001"],
    warnings: [],
  },
  {
    id: "row-004",
    rank: 4,
    previousRank: 4,
    movement: "same",
    sourceProvider: "apple_music",
    sourceUrl: "https://music.apple.com/ug/playlist/top40",
    title: "Rush",
    artistNames: ["Ayra Starr"],
    artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop",
    matchStatus: "canonical",
    confidence: 96,
    canonicalTrackId: "track-ayra-001",
    canonicalReleaseId: "release-ayra-001",
    canonicalArtistIds: ["artist-ayra-001"],
    warnings: [],
  },
  {
    id: "row-005",
    rank: 5,
    previousRank: 7,
    movement: "up",
    sourceProvider: "spotify",
    sourceUrl: "https://open.spotify.com/playlist/top40",
    title: "Calm Down",
    artistNames: ["Rema"],
    artworkUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&h=200&fit=crop",
    matchStatus: "shell",
    confidence: 72,
    canonicalTrackId: null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    releaseShellId: "shell-rema-001",
    warnings: ["Low confidence — release shell created"],
  },
  {
    id: "row-006",
    rank: 6,
    previousRank: 12,
    movement: "up",
    sourceProvider: "spotify",
    sourceUrl: "https://open.spotify.com/playlist/top40",
    title: "Sability",
    artistNames: ["Yemi Alade"],
    artworkUrl: null,
    matchStatus: "no_match",
    confidence: 0,
    canonicalTrackId: null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    warnings: ["No canonical match found — needs review"],
  },
  {
    id: "row-007",
    rank: 7,
    previousRank: 5,
    movement: "down",
    sourceProvider: "apple_music",
    sourceUrl: "https://music.apple.com/ug/playlist/top40",
    title: "Buga",
    artistNames: ["Kizz Daniel", "Tekno"],
    artworkUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop",
    matchStatus: "canonical",
    confidence: 94,
    canonicalTrackId: "track-kizz-001",
    canonicalReleaseId: "release-kizz-001",
    canonicalArtistIds: ["artist-kizz-001", "artist-tekno-001"],
    warnings: [],
  },
  {
    id: "row-008",
    rank: 8,
    previousRank: 6,
    movement: "down",
    sourceProvider: "spotify",
    sourceUrl: "https://open.spotify.com/playlist/top40",
    title: "Gwagwalada",
    artistNames: ["Bnxn", "Kizz Daniel", "Seyi Vibez"],
    artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop",
    matchStatus: "needs_review",
    confidence: 55,
    canonicalTrackId: null,
    canonicalReleaseId: null,
    canonicalArtistIds: [],
    warnings: ["Ambiguous match — multiple possible canonical tracks"],
  },
  {
    id: "row-009",
    rank: 9,
    previousRank: 9,
    movement: "same",
    sourceProvider: "apple_music",
    sourceUrl: "https://music.apple.com/ug/playlist/top40",
    title: "Terminator",
    artistNames: ["King Promise"],
    artworkUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop",
    matchStatus: "canonical",
    confidence: 93,
    canonicalTrackId: "track-king-001",
    canonicalReleaseId: "release-king-001",
    canonicalArtistIds: ["artist-king-001"],
    warnings: [],
  },
  {
    id: "row-010",
    rank: 10,
    previousRank: null,
    movement: "new",
    sourceProvider: "spotify",
    sourceUrl: "https://open.spotify.com/playlist/top40",
    title: "Soweto",
    artistNames: ["Victony", "Tempoe"],
    artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop",
    matchStatus: "duplicate_candidate",
    confidence: 45,
    canonicalTrackId: "track-victony-001",
    canonicalReleaseId: "release-victony-001",
    canonicalArtistIds: ["artist-victony-001"],
    warnings: ["Possible duplicate of existing canonical track"],
  },
];

function getInitialStages(): IngestStageStatus[] {
  return [
    { stage: "validate", status: "idle" },
    { stage: "provider_detection", status: "idle" },
    { stage: "resource_guard", status: "idle" },
    { stage: "source_fetch", status: "idle" },
    { stage: "normalize", status: "idle" },
    { stage: "canonical_match", status: "idle" },
    { stage: "enrichment", status: "idle" },
    { stage: "snapshot_commit", status: "idle" },
  ];
}

function getRunningStages(): IngestStageStatus[] {
  return [
    { stage: "validate", status: "done", durationMs: 120, startedAt: new Date(Date.now() - 8000).toISOString(), finishedAt: new Date(Date.now() - 7880).toISOString() },
    { stage: "provider_detection", status: "done", durationMs: 80, startedAt: new Date(Date.now() - 7880).toISOString(), finishedAt: new Date(Date.now() - 7800).toISOString() },
    { stage: "resource_guard", status: "done", durationMs: 150, startedAt: new Date(Date.now() - 7800).toISOString(), finishedAt: new Date(Date.now() - 7650).toISOString() },
    { stage: "source_fetch", status: "done", durationMs: 3200, startedAt: new Date(Date.now() - 7650).toISOString(), finishedAt: new Date(Date.now() - 4450).toISOString(), metrics: { fetchedRows: 412, fromSpotify: 210, fromApple: 202 } },
    { stage: "normalize", status: "done", durationMs: 890, startedAt: new Date(Date.now() - 4450).toISOString(), finishedAt: new Date(Date.now() - 3560).toISOString(), metrics: { normalizedRows: 410, droppedRows: 2 } },
    { stage: "canonical_match", status: "done", durationMs: 2400, startedAt: new Date(Date.now() - 3560).toISOString(), finishedAt: new Date(Date.now() - 1160).toISOString(), metrics: { canonical: 342, shell: 28, noMatch: 24, needsReview: 10, duplicate: 6 } },
    { stage: "enrichment", status: "running", startedAt: new Date(Date.now() - 1160).toISOString(), metrics: { enriched: 380, pending: 30 } },
    { stage: "snapshot_commit", status: "idle" },
  ];
}

function getDryRunCompleteStages(): IngestStageStatus[] {
  return [
    { stage: "validate", status: "done", durationMs: 120, startedAt: new Date(Date.now() - 12000).toISOString(), finishedAt: new Date(Date.now() - 11880).toISOString() },
    { stage: "provider_detection", status: "done", durationMs: 80, startedAt: new Date(Date.now() - 11880).toISOString(), finishedAt: new Date(Date.now() - 11800).toISOString() },
    { stage: "resource_guard", status: "done", durationMs: 150, startedAt: new Date(Date.now() - 11800).toISOString(), finishedAt: new Date(Date.now() - 11650).toISOString() },
    { stage: "source_fetch", status: "done", durationMs: 3200, startedAt: new Date(Date.now() - 11650).toISOString(), finishedAt: new Date(Date.now() - 8450).toISOString(), metrics: { fetchedRows: 412, fromSpotify: 210, fromApple: 202 } },
    { stage: "normalize", status: "done", durationMs: 890, startedAt: new Date(Date.now() - 8450).toISOString(), finishedAt: new Date(Date.now() - 7560).toISOString(), metrics: { normalizedRows: 410, droppedRows: 2 } },
    { stage: "canonical_match", status: "done", durationMs: 2400, startedAt: new Date(Date.now() - 7560).toISOString(), finishedAt: new Date(Date.now() - 5160).toISOString(), metrics: { canonical: 342, shell: 28, noMatch: 24, needsReview: 10, duplicate: 6 } },
    { stage: "enrichment", status: "done", durationMs: 1800, startedAt: new Date(Date.now() - 5160).toISOString(), finishedAt: new Date(Date.now() - 3360).toISOString(), metrics: { enriched: 410, failed: 0 } },
    { stage: "snapshot_commit", status: "done", durationMs: 200, startedAt: new Date(Date.now() - 3360).toISOString(), finishedAt: new Date(Date.now() - 3160).toISOString(), message: "Dry run snapshot created — not persisted" },
  ];
}

function getCommittedStages(): IngestStageStatus[] {
  return [
    { stage: "validate", status: "done", durationMs: 120 },
    { stage: "provider_detection", status: "done", durationMs: 80 },
    { stage: "resource_guard", status: "done", durationMs: 150 },
    { stage: "source_fetch", status: "done", durationMs: 3200, metrics: { fetchedRows: 412, fromSpotify: 210, fromApple: 202 } },
    { stage: "normalize", status: "done", durationMs: 890, metrics: { normalizedRows: 410, droppedRows: 2 } },
    { stage: "canonical_match", status: "done", durationMs: 2400, metrics: { canonical: 342, shell: 28, noMatch: 24, needsReview: 10, duplicate: 6 } },
    { stage: "enrichment", status: "done", durationMs: 1800, metrics: { enriched: 410, failed: 0 } },
    { stage: "snapshot_commit", status: "done", durationMs: 520, message: "Edition committed and snapshot persisted" },
  ];
}

const mockSummary: IngestRunSummary = {
  totalRows: 410,
  canonicalMatches: 342,
  shells: 28,
  gaps: 24,
  duplicateCandidates: 6,
  matchRate: 83.4,
};

const mockRuns: IngestRun[] = [
  {
    id: "run-001",
    chartTitle: "WAKILISHA Top 40 — Week 22, 2026",
    chartSlug: "wakilisha-top-40-week-22-2026",
    editionDate: "2026-05-30",
    chartSize: 40,
    market: "KE",
    chartKind: "tracks",
    coverStyle: "default",
    sourceUrls: [
      "https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5",
      "https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789",
    ],
    detectedProviders: ["spotify", "apple_music"],
    saveAsRecurringSeries: true,
    existingSeriesId: "series-top-40",
    status: "dry_run_complete",
    stages: getDryRunCompleteStages(),
    summary: mockSummary,
    rows: mockResolvedRows,
    createdBy: "James",
    createdAt: "2026-05-30T10:00:00Z",
    updatedAt: "2026-05-30T10:15:00Z",
    dryRunCompletedAt: "2026-05-30T10:15:00Z",
    committedAt: null,
    editionId: null,
    editionSlug: null,
    snapshotId: null,
    notes: "",
    errorMessage: null,
  },
  {
    id: "run-002",
    chartTitle: "WAKILISHA Top 100 — Week 22, 2026",
    chartSlug: "wakilisha-top-100-week-22-2026",
    editionDate: "2026-05-30",
    chartSize: 100,
    market: "KE",
    chartKind: "tracks",
    coverStyle: "default",
    sourceUrls: [
      "https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5",
      "https://music.apple.com/ug/playlist/top-100/pl.123456789",
    ],
    detectedProviders: ["spotify", "apple_music"],
    saveAsRecurringSeries: true,
    existingSeriesId: "series-top-100",
    status: "committed",
    stages: getCommittedStages(),
    summary: { totalRows: 847, canonicalMatches: 781, shells: 32, gaps: 20, duplicateCandidates: 14, matchRate: 92.2 },
    rows: mockResolvedRows,
    createdBy: "Sarah",
    createdAt: "2026-05-30T09:30:00Z",
    updatedAt: "2026-05-30T12:30:00Z",
    dryRunCompletedAt: "2026-05-30T10:00:00Z",
    committedAt: "2026-05-30T12:30:00Z",
    editionId: "ed-2026-w22",
    editionSlug: "2026-week-22",
    snapshotId: "snap-2026-w22",
    notes: "Published immediately after commit",
    errorMessage: null,
  },
  {
    id: "run-003",
    chartTitle: "WAKILISHA Top 40 — Week 21, 2026",
    chartSlug: "wakilisha-top-40-week-21-2026",
    editionDate: "2026-05-23",
    chartSize: 40,
    market: "KE",
    chartKind: "tracks",
    coverStyle: "default",
    sourceUrls: [
      "https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5",
      "https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789",
    ],
    detectedProviders: ["spotify", "apple_music"],
    saveAsRecurringSeries: true,
    existingSeriesId: "series-top-40",
    status: "committed",
    stages: getCommittedStages(),
    summary: { totalRows: 398, canonicalMatches: 356, shells: 22, gaps: 16, duplicateCandidates: 4, matchRate: 89.4 },
    rows: mockResolvedRows,
    createdBy: "James",
    createdAt: "2026-05-23T10:00:00Z",
    updatedAt: "2026-05-23T12:15:00Z",
    dryRunCompletedAt: "2026-05-23T10:45:00Z",
    committedAt: "2026-05-23T12:15:00Z",
    editionId: "ed-2026-w21",
    editionSlug: "2026-week-21",
    snapshotId: "snap-2026-w21",
    notes: "",
    errorMessage: null,
  },
  {
    id: "run-004",
    chartTitle: "Afrobeats Top 20 — Week 22, 2026",
    chartSlug: "afrobeats-top-20-week-22-2026",
    editionDate: "2026-05-30",
    chartSize: 20,
    market: "KE",
    chartKind: "tracks",
    coverStyle: "genre",
    sourceUrls: [
      "https://open.spotify.com/playlist/afrobeats",
    ],
    detectedProviders: ["spotify"],
    saveAsRecurringSeries: true,
    existingSeriesId: "series-afrobeats-20",
    status: "failed",
    stages: [
      { stage: "validate", status: "done", durationMs: 100 },
      { stage: "provider_detection", status: "done", durationMs: 60 },
      { stage: "resource_guard", status: "done", durationMs: 120 },
      { stage: "source_fetch", status: "failed", durationMs: 5000, message: "Spotify API rate limit exceeded" },
      { stage: "normalize", status: "idle" },
      { stage: "canonical_match", status: "idle" },
      { stage: "enrichment", status: "idle" },
      { stage: "snapshot_commit", status: "idle" },
    ],
    summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0 },
    rows: [],
    createdBy: "Michael",
    createdAt: "2026-05-30T08:30:00Z",
    updatedAt: "2026-05-30T08:45:00Z",
    dryRunCompletedAt: null,
    committedAt: null,
    editionId: null,
    editionSlug: null,
    snapshotId: null,
    notes: "",
    errorMessage: "Spotify API rate limit exceeded during source fetch. Retry after 15 minutes.",
  },
  {
    id: "run-005",
    chartTitle: "WAKILISHA Top 40 — Week 23, 2026",
    chartSlug: "wakilisha-top-40-week-23-2026",
    editionDate: "2026-06-06",
    chartSize: 40,
    market: "KE",
    chartKind: "tracks",
    coverStyle: "default",
    sourceUrls: [
      "https://open.spotify.com/playlist/37i9dQZF1DXc2aWXf7eND5",
      "https://music.apple.com/ug/playlist/afrobeats-2026/pl.123456789",
    ],
    detectedProviders: ["spotify", "apple_music"],
    saveAsRecurringSeries: true,
    existingSeriesId: "series-top-40",
    status: "running",
    stages: getRunningStages(),
    summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0 },
    rows: [],
    createdBy: "James",
    createdAt: "2026-05-31T09:00:00Z",
    updatedAt: "2026-05-31T09:00:30Z",
    dryRunCompletedAt: null,
    committedAt: null,
    editionId: null,
    editionSlug: null,
    snapshotId: null,
    notes: "",
    errorMessage: null,
  },
];

export const mockIngestKpis: IngestStudioKpi = {
  editionsThisWeek: 3,
  canonicalMatchRate: 87.2,
  rowsAwaitingReview: 34,
  averageRunTimeMs: 8420,
};

export const mockRecentActivity: RecentIngestActivity[] = [
  {
    id: "act-001",
    type: "dry_run",
    chartTitle: "WAKILISHA Top 40 — Week 22, 2026",
    runId: "run-001",
    status: "dry_run_complete",
    actor: "James",
    createdAt: "2026-05-30T10:15:00Z",
    summary: mockSummary,
  },
  {
    id: "act-002",
    type: "commit",
    chartTitle: "WAKILISHA Top 100 — Week 22, 2026",
    runId: "run-002",
    status: "committed",
    actor: "Sarah",
    createdAt: "2026-05-30T12:30:00Z",
    summary: { totalRows: 847, canonicalMatches: 781, shells: 32, gaps: 20, duplicateCandidates: 14, matchRate: 92.2 },
  },
  {
    id: "act-003",
    type: "commit",
    chartTitle: "WAKILISHA Top 40 — Week 21, 2026",
    runId: "run-003",
    status: "committed",
    actor: "James",
    createdAt: "2026-05-23T12:15:00Z",
    summary: { totalRows: 398, canonicalMatches: 356, shells: 22, gaps: 16, duplicateCandidates: 4, matchRate: 89.4 },
  },
  {
    id: "act-004",
    type: "dry_run",
    chartTitle: "WAKILISHA Top 40 — Week 23, 2026",
    runId: "run-005",
    status: "running",
    actor: "James",
    createdAt: "2026-05-31T09:00:00Z",
  },
  {
    id: "act-005",
    type: "review",
    chartTitle: "WAKILISHA Top 40 — Week 22, 2026",
    runId: "run-001",
    status: "needs_review",
    actor: "James",
    createdAt: "2026-05-30T10:20:00Z",
  },
];

// ─── Store ───
interface StudioStore {
  runs: IngestRun[];
  kpis: IngestStudioKpi;
  activity: RecentIngestActivity[];
}

function getInitialStudioStore(): StudioStore {
  return {
    runs: [...mockRuns],
    kpis: { ...mockIngestKpis },
    activity: [...mockRecentActivity],
  };
}

function loadStudioStore(): StudioStore {
  try {
    const raw = localStorage.getItem(STUDIO_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudioStore;
      if (parsed.runs && parsed.kpis) return parsed;
    }
  } catch {
    // ignore
  }
  const initial = getInitialStudioStore();
  saveStudioStore(initial);
  return initial;
}

function saveStudioStore(store: StudioStore): void {
  try {
    localStorage.setItem(STUDIO_STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

let studioStore = loadStudioStore();

export function getStudioStore(): StudioStore {
  return studioStore;
}

export function refreshStudioStore(): StudioStore {
  studioStore = loadStudioStore();
  return studioStore;
}

export function resetStudioStore(): StudioStore {
  const initial = getInitialStudioStore();
  saveStudioStore(initial);
  studioStore = initial;
  return studioStore;
}

export function commitStudioStore(store: StudioStore): void {
  studioStore = store;
  saveStudioStore(store);
}

// ─── API Functions ───
export function getIngestRuns(): Promise<IngestRun[]> {
  return Promise.resolve(getStudioStore().runs);
}

export function getIngestRun(runId: string): Promise<IngestRun | null> {
  const run = getStudioStore().runs.find((r) => r.id === runId);
  return Promise.resolve(run ?? null);
}

export function getIngestKpis(): Promise<IngestStudioKpi> {
  return Promise.resolve(getStudioStore().kpis);
}

export function getRecentIngestActivity(): Promise<RecentIngestActivity[]> {
  return Promise.resolve(getStudioStore().activity);
}

export function createIngestRun(run: IngestRun): Promise<IngestRun> {
  const store = getStudioStore();
  store.runs = [run, ...store.runs];
  commitStudioStore(store);
  return Promise.resolve(run);
}

export function updateIngestRun(runId: string, updater: (run: IngestRun) => IngestRun): Promise<IngestRun | null> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return Promise.resolve(null);
  store.runs[idx] = updater(store.runs[idx]);
  commitStudioStore(store);
  return Promise.resolve(store.runs[idx]);
}

export function addIngestActivity(activity: RecentIngestActivity): void {
  const store = getStudioStore();
  store.activity = [activity, ...store.activity];
  commitStudioStore(store);
}

export function getResourceGuardStatus(runId: string): Promise<ResourceGuardStatus> {
  const run = getStudioStore().runs.find((r) => r.id === runId);
  const sourceCount = run?.sourceUrls.length ?? 0;
  return Promise.resolve({
    sourceCount,
    providerBudgetRemaining: 100 - sourceCount * 10,
    workerConcurrency: 4,
    estimatedRowCount: sourceCount * 200,
    duplicateRunWarning: null,
    sameEditionDateWarning: null,
  });
}

export async function runDryRun(request: {
  chartTitle: string;
  chartSlug: string;
  editionDate: string;
  chartSize: number;
  market: string;
  chartKind: "tracks" | "releases";
  coverStyle?: string;
  sourceUrls: string[];
  saveAsRecurringSeries?: boolean;
  existingSeriesId?: string | null;
}): Promise<CreateIngestDryRunResponse> {
  const runId = `run-${Date.now()}`;
  const now = new Date().toISOString();

  const run: IngestRun = {
    id: runId,
    chartTitle: request.chartTitle,
    chartSlug: request.chartSlug,
    editionDate: request.editionDate,
    chartSize: request.chartSize,
    market: request.market,
    chartKind: request.chartKind,
    coverStyle: request.coverStyle ?? "default",
    sourceUrls: request.sourceUrls,
    detectedProviders: [...new Set(request.sourceUrls.map((u) => {
      const l = u.toLowerCase();
      if (l.includes("spotify.com")) return "spotify";
      if (l.includes("apple.com")) return "apple_music";
      return "unknown";
    }))].filter((p) => p !== "unknown"),
    saveAsRecurringSeries: request.saveAsRecurringSeries ?? false,
    existingSeriesId: request.existingSeriesId ?? null,
    status: "running",
    stages: getInitialStages(),
    summary: { totalRows: 0, canonicalMatches: 0, shells: 0, gaps: 0, duplicateCandidates: 0, matchRate: 0 },
    rows: [],
    createdBy: "Current User",
    createdAt: now,
    updatedAt: now,
  };

  await createIngestRun(run);

  // Simulate dry run progression
  await simulateStageProgress(runId);

  const updatedRun = getStudioStore().runs.find((r) => r.id === runId);
  if (!updatedRun) throw new Error("Run not found after simulation");

  return {
    runId,
    status: updatedRun.status,
    stages: updatedRun.stages,
    summary: updatedRun.summary,
    rows: updatedRun.rows,
  };
}

async function simulateStageProgress(runId: string): Promise<void> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return;

  const run = store.runs[idx];
  const chartSize = run.chartSize;
  const market = run.market;
  const sourceUrls = run.sourceUrls;

  // Stage 1: validate
  const validateStage: IngestStageStatus = {
    stage: "validate",
    status: "done",
    durationMs: 80 + Math.floor(Math.random() * 60),
    startedAt: new Date().toISOString(),
    finishedAt: new Date(Date.now() + 100).toISOString(),
    message: "Source URLs validated",
  };

  // Stage 2: provider_detection
  const providers = sourceUrls.map(detectProviderFromUrl).filter((p) => p !== "unknown");
  const providerDetectionStage: IngestStageStatus = {
    stage: "provider_detection",
    status: providers.length > 0 ? "done" : "warning",
    durationMs: 40 + Math.floor(Math.random() * 40),
    startedAt: validateStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date(Date.now() + 200).toISOString(),
    metrics: { detectedProviders: providers.length, spotify: providers.filter((p) => p === "spotify").length, appleMusic: providers.filter((p) => p === "apple_music").length },
    message: providers.length === 0
      ? "No recognized providers detected — check source URLs"
      : `Detected: ${providers.join(", ")}`,
  };

  // Stage 3: resource_guard
  const resourceGuardStage: IngestStageStatus = {
    stage: "resource_guard",
    status: "done",
    durationMs: 60 + Math.floor(Math.random() * 80),
    startedAt: providerDetectionStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date(Date.now() + 300).toISOString(),
    metrics: { sourceCount: sourceUrls.length, estimatedRowCount: sourceUrls.length * chartSize },
    message: `${sourceUrls.length} source(s) within budget — estimated ${sourceUrls.length * chartSize} rows`,
  };

  // Stage 4: source_fetch — REAL PROVIDER FETCH
  const fetchStart = performance.now();
  const fetchResult = await fetchFromAllSources(sourceUrls, {
    market,
    maxRows: chartSize * sourceUrls.length,
  });
  const fetchDurationMs = Math.round(performance.now() - fetchStart);

  const spotifyCount = fetchResult.sourceResults.filter((r) => r.provider === "spotify").reduce((sum, r) => sum + r.normalizedRows.length, 0);
  const appleCount = fetchResult.sourceResults.filter((r) => r.provider === "apple_music").reduce((sum, r) => sum + r.normalizedRows.length, 0);
  const failedSources = fetchResult.sourceResults.filter((r) => !r.success);

  // Per-source warnings detail
  const perSourceDetail = fetchResult.sourceResults.map((r) =>
    r.success
      ? `${r.provider}: ${r.normalizedRows.length} rows`
      : `${r.provider}: FAILED — ${r.error || "unknown error"}`
  ).join("; ");

  const sourceFetchStage: IngestStageStatus = {
    stage: "source_fetch",
    status: fetchResult.success ? "done" : failedSources.length === sourceUrls.length ? "failed" : "warning",
    durationMs: fetchDurationMs,
    startedAt: resourceGuardStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    metrics: {
      fetchedRows: fetchResult.overallMetrics.totalFetched,
      fromSpotify: spotifyCount,
      fromApple: appleCount,
      failedSources: failedSources.length,
      successfulSources: fetchResult.overallMetrics.successfulSources,
    },
    message: perSourceDetail,
  };

  // If all sources failed, mark run as failed
  if (failedSources.length === sourceUrls.length && sourceUrls.length > 0) {
    store.runs[idx].status = "failed";
    store.runs[idx].errorMessage = fetchResult.overallError || "All sources failed to fetch. Check provider credentials and source URLs.";
    store.runs[idx].stages = [
      validateStage, providerDetectionStage, resourceGuardStage, sourceFetchStage,
      { stage: "normalize", status: "idle" },
      { stage: "canonical_match", status: "idle" },
      { stage: "enrichment", status: "idle" },
      { stage: "snapshot_commit", status: "idle" },
    ];
    store.runs[idx].updatedAt = new Date().toISOString();
    commitStudioStore(store);
    return;
  }

  // Stage 5: normalize
  const normalizeStart = performance.now();
  const normalizedRows = fetchResult.allNormalizedRows;
  // Deduplicate by providerTrackId
  const seen = new Set<string>();
  const dedupedRows = normalizedRows.filter((row) => {
    const key = row.providerTrackId || row.trackTitle || "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const normalizeDurationMs = Math.round(performance.now() - normalizeStart);
  const droppedCount = normalizedRows.length - dedupedRows.length + fetchResult.overallMetrics.totalDropped;

  const normalizeStage: IngestStageStatus = {
    stage: "normalize",
    status: "done",
    durationMs: normalizeDurationMs,
    startedAt: sourceFetchStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    metrics: {
      normalizedRows: dedupedRows.length,
      droppedRows: droppedCount,
      deduplicatedRows: normalizedRows.length - dedupedRows.length,
      sources: sourceUrls.length,
    },
    message: `Normalized ${dedupedRows.length} rows (${normalizedRows.length - dedupedRows.length} duplicates removed, ${droppedCount} dropped)`,
  };

  // Stage 6: canonical_match — REAL REGISTRY MATCHING
  const matchStart = performance.now();
  const matchResult = runCanonicalMatch(dedupedRows);
  const matchDurationMs = Math.round(performance.now() - matchStart);

  // Slice to chartSize
  const resolvedRows = matchResult.resolvedRows.slice(0, chartSize);
  const matchMetrics = matchResult.metrics;

  const canonicalMatchStage: IngestStageStatus = {
    stage: "canonical_match",
    status: matchMetrics.noMatch > resolvedRows.length * 0.5 ? "warning" : "done",
    durationMs: matchDurationMs,
    startedAt: normalizeStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    metrics: {
      canonical: matchMetrics.canonical,
      shell: matchMetrics.shell,
      noMatch: matchMetrics.noMatch,
      needsReview: matchMetrics.needsReview,
      duplicate: matchMetrics.duplicateCandidate,
      matchRate: matchMetrics.matchRate,
      registryHits: matchMetrics.registryHits,
      avgConfidence: matchMetrics.avgConfidence,
    },
    message: `${matchMetrics.canonical} canonical, ${matchMetrics.shell} shells, ${matchMetrics.noMatch} no_match, ${matchMetrics.needsReview} needs_review, ${matchMetrics.duplicateCandidate} duplicates (${matchMetrics.matchRate}% match rate, avg confidence ${matchMetrics.avgConfidence}%)`,
  };

  // Collect stage warnings from matching
  const matchWarnings = matchResult.stageWarnings;

  // Stage 7: enrichment — REAL ENRICHMENT PIPELINE
  const enrichStart = performance.now();
  const credErrors = checkEnrichmentCredentials();
  const enrichWarnings: string[] = credErrors.map((e) => e.message);

  // Only enrich up to chartSize rows to keep runtime reasonable
  const rowsToEnrich = resolvedRows.slice(0, Math.min(chartSize, 40));
  let enrichedRows = resolvedRows;
  let enrichmentStage: IngestStageStatus = {
    stage: "enrichment",
    status: "warning",
    durationMs: 0,
    startedAt: canonicalMatchStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    message: "Enrichment running in mock mode — no provider credentials configured",
    metrics: { enriched: 0, failed: 0, credentialErrors: credErrors.length },
  };

  try {
    const enrichResult = await enrichRows(rowsToEnrich);
    // Apply enrichment results back to rows
    const enrichMap = new Map(enrichResult.results.map((r) => [r.rowId, r]));
    enrichedRows = resolvedRows.map((row) => {
      const result = enrichMap.get(row.id);
      if (result && result.success && Object.keys(result.enriched).length > 0) {
        return applyEnrichmentToRow(row, result.enriched);
      }
      return row;
    });
    const enrichDurationMs = Math.round(performance.now() - enrichStart);

    // Collect enrichment warnings
    enrichResult.results.forEach((r) => {
      r.warnings.filter((w) => !w.includes("skipped")).forEach((w) => enrichWarnings.push(w));
    });

    enrichmentStage = {
      stage: "enrichment",
      status: credErrors.length === 4 ? "warning" : "done",
      durationMs: enrichDurationMs,
      startedAt: canonicalMatchStage.finishedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      metrics: {
        enriched: enrichResult.metrics.enriched + enrichResult.metrics.partial,
        failed: enrichResult.metrics.failed,
        spotifyHits: enrichResult.metrics.spotifyHits,
        appleMusicHits: enrichResult.metrics.appleMusicHits,
        youtubeHits: enrichResult.metrics.youtubeHits,
        acrCloudHits: enrichResult.metrics.acrCloudHits,
        credentialErrors: credErrors.length,
      },
      message: credErrors.length === 4
        ? `Enrichment running in mock mode — ${credErrors.length} providers missing credentials. Set env vars to enable real enrichment.`
        : `Enriched ${enrichResult.metrics.enriched + enrichResult.metrics.partial} rows via ${4 - credErrors.length} provider(s)`,
    };
  } catch {
    const enrichDurationMs = Math.round(performance.now() - enrichStart);
    enrichedRows = resolvedRows;
    enrichmentStage = {
      stage: "enrichment",
      status: "warning",
      durationMs: enrichDurationMs,
      startedAt: canonicalMatchStage.finishedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      message: "Enrichment encountered errors — running in degraded mode",
      metrics: { enriched: 0, failed: resolvedRows.length, credentialErrors: credErrors.length },
    };
  }

  // Stage 8: snapshot_commit
  const snapshotStage: IngestStageStatus = {
    stage: "snapshot_commit",
    status: "done",
    durationMs: 150 + Math.floor(Math.random() * 100),
    startedAt: enrichmentStage.finishedAt || new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    message: "Dry run snapshot created — not persisted to edition (Sprint 5 gate)",
  };

  // Build final run state
  const finalStages: IngestStageStatus[] = [
    validateStage, providerDetectionStage, resourceGuardStage,
    sourceFetchStage, normalizeStage, canonicalMatchStage,
    enrichmentStage, snapshotStage,
  ];

  const finalSummary: IngestRunSummary = {
    totalRows: enrichedRows.length,
    canonicalMatches: matchMetrics.canonical,
    shells: matchMetrics.shell,
    gaps: matchMetrics.noMatch,
    duplicateCandidates: matchMetrics.duplicateCandidate,
    matchRate: matchMetrics.matchRate,
  };

  // Aggregate all warnings for error message
  const allWarnings = [...fetchResult.overallWarnings, ...matchWarnings, ...enrichWarnings];
  const hasWarnings = allWarnings.length > 0;
  const finalStatus = failedSources.length > 0 || hasWarnings ? "dry_run_complete" : "dry_run_complete";

  // Store enriched rows and audit payloads
  store.runs[idx].status = finalStatus;
  store.runs[idx].stages = finalStages;
  store.runs[idx].summary = finalSummary;
  store.runs[idx].rows = enrichedRows;
  store.runs[idx].dryRunCompletedAt = new Date().toISOString();
  store.runs[idx].updatedAt = new Date().toISOString();
  store.runs[idx].notes = JSON.stringify({
    rawPayloads: fetchResult.sourceResults.map((r) => ({
      sourceUrl: r.sourceUrl, provider: r.provider, rawPayload: r.rawPayload, warnings: r.warnings,
    })),
    overallWarnings: allWarnings,
    canonicalMatchMetrics: matchMetrics,
    enrichmentCredentialErrors: credErrors.map((e) => ({ provider: e.provider, envVarName: e.envVarName })),
  });
  commitStudioStore(store);

  addIngestActivity({
    id: `act-${Date.now()}`,
    type: "dry_run",
    chartTitle: run.chartTitle,
    runId,
    status: "dry_run_complete",
    actor: "Current User",
    createdAt: new Date().toISOString(),
    summary: finalSummary,
  });
}

export async function commitIngestRun(request: {
  runId: string;
  publishImmediately?: boolean;
  notes?: string;
}): Promise<CommitIngestRunResponse> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === request.runId);
  if (idx === -1) throw new Error("Run not found");

  const run = store.runs[idx];
  if (run.status !== "dry_run_complete" && run.status !== "ready_to_commit") {
    throw new Error("Run must complete dry run before commit");
  }

  const editionId = `ed-${Date.now()}`;
  const snapshotId = `snap-${Date.now()}`;

  store.runs[idx].status = "committed";
  store.runs[idx].committedAt = new Date().toISOString();
  store.runs[idx].editionId = editionId;
  store.runs[idx].editionSlug = run.editionDate;
  store.runs[idx].snapshotId = snapshotId;
  store.runs[idx].notes = request.notes ?? "";
  store.runs[idx].updatedAt = new Date().toISOString();
  store.runs[idx].stages = getCommittedStages();
  commitStudioStore(store);

  addIngestActivity({
    id: `act-${Date.now()}`,
    type: "commit",
    chartTitle: run.chartTitle,
    runId: request.runId,
    status: "committed",
    actor: "Current User",
    createdAt: new Date().toISOString(),
    summary: run.summary,
  });

  return {
    runId: request.runId,
    editionId,
    editionSlug: run.editionSlug || run.editionDate,
    publicUrl: `/charts/${run.chartSlug}/${run.editionSlug || run.editionDate}`,
    status: "committed",
    snapshotId,
    integrity: {
      ok: true,
      warnings: [],
    },
  };
}

export async function cancelIngestRun(runId: string): Promise<IngestRun | null> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return null;

  store.runs[idx].status = "cancelled";
  store.runs[idx].updatedAt = new Date().toISOString();
  commitStudioStore(store);

  addIngestActivity({
    id: `act-${Date.now()}`,
    type: "cancel",
    chartTitle: store.runs[idx].chartTitle,
    runId,
    status: "cancelled",
    actor: "Current User",
    createdAt: new Date().toISOString(),
  });

  return store.runs[idx];
}

export async function retryIngestRun(runId: string): Promise<IngestRun | null> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return null;

  store.runs[idx].status = "running";
  store.runs[idx].stages = getInitialStages();
  store.runs[idx].errorMessage = null;
  store.runs[idx].updatedAt = new Date().toISOString();
  commitStudioStore(store);

  await simulateStageProgress(runId);

  addIngestActivity({
    id: `act-${Date.now()}`,
    type: "retry",
    chartTitle: store.runs[idx].chartTitle,
    runId,
    status: "dry_run_complete",
    actor: "Current User",
    createdAt: new Date().toISOString(),
  });

  return store.runs[idx];
}

// ─── Row-level Match Decision ───
export async function applyRowMatchDecision(runId: string, rowId: string, action: string, canonicalTrackId?: string): Promise<IngestRun | null> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return null;

  const rowIdx = store.runs[idx].rows.findIndex((r) => r.id === rowId);
  if (rowIdx === -1) return null;

  const row = store.runs[idx].rows[rowIdx];

  let updatedRow = { ...row };
  switch (action) {
    case "accept_canonical":
      updatedRow = { ...row, matchStatus: "canonical", confidence: 100 };
      break;
    case "create_shell":
      updatedRow = { ...row, matchStatus: "shell", releaseShellId: `shell-${rowId}`, canonicalTrackId: null };
      break;
    case "change_match":
    case "attach_to_existing":
      if (canonicalTrackId) updatedRow = { ...row, matchStatus: "canonical", canonicalTrackId, confidence: 95 };
      break;
    case "mark_duplicate":
      updatedRow = { ...row, matchStatus: "duplicate_candidate" };
      break;
    case "send_to_review":
      updatedRow = { ...row, matchStatus: "needs_review" };
      break;
    case "ignore":
      updatedRow = { ...row, matchStatus: "no_match", canonicalTrackId: null };
      break;
  }

  store.runs[idx].rows[rowIdx] = updatedRow;

  // Recompute summary
  const rows = store.runs[idx].rows;
  const canonical = rows.filter((r) => r.matchStatus === "canonical").length;
  const shells = rows.filter((r) => r.matchStatus === "shell").length;
  const gaps = rows.filter((r) => r.matchStatus === "no_match").length;
  const duplicateCandidates = rows.filter((r) => r.matchStatus === "duplicate_candidate").length;
  const matchRate = rows.length > 0 ? Math.round((canonical / rows.length) * 1000) / 10 : 0;
  store.runs[idx].summary = { ...store.runs[idx].summary, canonicalMatches: canonical, shells, gaps, duplicateCandidates, matchRate };
  store.runs[idx].updatedAt = new Date().toISOString();

  commitStudioStore(store);
  return store.runs[idx];
}

export async function sendGapsToReview(runId: string): Promise<IngestRun | null> {
  const store = getStudioStore();
  const idx = store.runs.findIndex((r) => r.id === runId);
  if (idx === -1) return null;

  store.runs[idx].status = "needs_review";
  store.runs[idx].updatedAt = new Date().toISOString();
  commitStudioStore(store);

  addIngestActivity({
    id: `act-${Date.now()}`,
    type: "review",
    chartTitle: store.runs[idx].chartTitle,
    runId,
    status: "needs_review",
    actor: "Current User",
    createdAt: new Date().toISOString(),
  });

  return store.runs[idx];
}