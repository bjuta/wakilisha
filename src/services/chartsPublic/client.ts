import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
  TrackChartHistory,
} from "./types";

import {
  getCachedChart,
  setCachedChart,
  clearChartCache,
  DEFAULT_CACHE_TTL,
  type PublicChartCacheSource,
} from "./cache";

import { supabase } from "@/lib/supabase";

import {
  MOCK_FAMILIES,
  MOCK_TRACK_HISTORY,
  getMockEntriesForEdition,
  getMockLatestEdition,
  getMockEdition,
  getMockFamily,
  getMockEditionsForFamily,
} from "./mockData";

import {
  hasCsvPublicChartData,
  getCsvEntriesForEdition,
  getCsvLatestEdition,
  getCsvEdition,
  getCsvFamily,
  getCsvFamilies,
  getCsvEditionsForFamily,
  getCsvTrackHistory,
} from "./csvData";

export const PUBLIC_API_BASE = import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/__wakilisha-v2-api/wp-json/wakilisha/v2";
export const PUBLIC_MODE = "api-first" as const;
export const PUBLIC_API_VERSION = "runtime" as const;

export class PublicChartsApiError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, status = 500, code = "public_charts_error", retryable = false) {
    super(message);
    this.name = "PublicChartsApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ChartFetchMeta {
  source: PublicChartCacheSource | "cache";
  fetchedAt: string;
  isStale: boolean;
}

export interface ChartResult<T> {
  data: T;
  meta: ChartFetchMeta;
}

function now(): string {
  return new Date().toISOString();
}

function localMeta(): ChartFetchMeta {
  return { source: "local", fetchedAt: now(), isStale: false };
}

function apiMeta(): ChartFetchMeta {
  return { source: "api", fetchedAt: now(), isStale: false };
}

function cacheMeta(entry: {
  source: PublicChartCacheSource;
  fetchedAt: number;
  isStale: boolean;
}): ChartFetchMeta {
  return {
    source: "cache",
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    isStale: entry.isStale,
  };
}

async function withCache<T>(
  key: string,
  fetchFn: () => Promise<{ data: T; source: PublicChartCacheSource }>,
  ttlMs = DEFAULT_CACHE_TTL
): Promise<ChartResult<T>> {
  const cached = getCachedChart<T>(key);
  if (cached && !cached.isStale) {
    return { data: cached.data, meta: cacheMeta(cached) };
  }

  try {
    const { data, source } = await fetchFn();
    setCachedChart(key, data, source, ttlMs);
    return { data, meta: source === "local" ? localMeta() : { source, fetchedAt: now(), isStale: false } };
  } catch (err) {
    if (cached) {
      return {
        data: cached.data,
        meta: { ...cacheMeta(cached), isStale: true },
      };
    }
    throw err;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const next = Number(value ?? fallback);
  return Number.isFinite(next) ? next : fallback;
}

function asPeriodType(value: unknown): ChartFamily["periodType"] {
  return value === "daily" || value === "monthly" || value === "yearly" || value === "evergreen" ? value : "weekly";
}

function asEditionFrequency(value: unknown): ChartFamily["editionFrequency"] {
  return value === "daily" || value === "monthly" ? value : "weekly";
}

function asMovement(value: unknown): ChartEditionEntry["movement"] {
  return value === "up" || value === "down" || value === "same" || value === "new" || value === "re_entry" ? value : "same";
}

// ─── Movement Enrichment ────────────────────────────────────────────
// Computes real movement data by comparing current entries against the
// chronologically prior edition. This runs inside getChartEditionEntries
// so every surface (edition page, directory, home, mobile, artist detail,
// search, track detail, shared components) gets correct movement automatically.

async function enrichMovementFromPriorEdition(
  entries: ChartEditionEntry[],
  programId: string,
  currentEditionSlug: string
): Promise<ChartEditionEntry[]> {
  if (entries.length === 0) return entries;

  try {
    // Get all published editions for this program, ordered by date desc
    const { data: allEditions } = await supabase
      .from("chart_editions")
      .select("id, edition_slug, edition_date")
      .eq("program_id", programId)
      .eq("status", "published")
      .order("edition_date", { ascending: false });

    if (!allEditions || allEditions.length < 2) return entries;

    // Find the chronologically prior edition (the one with an earlier date)
    const currentIdx = allEditions.findIndex(
      (e) => e.edition_slug === currentEditionSlug
    );
    if (currentIdx < 0 || currentIdx >= allEditions.length - 1) return entries;

    const priorEdition = allEditions[currentIdx + 1];

    // Get prior edition's track ranks
    const { data: priorEntries } = await supabase
      .from("chart_entries")
      .select("rank, track_slug")
      .eq("edition_id", priorEdition.id)
      .order("rank", { ascending: true });

    if (!priorEntries || priorEntries.length === 0) return entries;

    // Build rank lookup by track slug
    const priorRankMap = new Map<string, number>();
    for (const pe of priorEntries) {
      if (pe.track_slug) priorRankMap.set(pe.track_slug, pe.rank);
    }

    // Compute movement for each entry
    return entries.map((entry) => {
      const prevRank = priorRankMap.get(entry.trackSlug) ?? null;
      let movement: ChartEditionEntry["movement"];
      let movementAmount: number | undefined;

      if (prevRank === null) {
        movement = "new";
        movementAmount = 0;
      } else if (prevRank > entry.rank) {
        movement = "up";
        movementAmount = prevRank - entry.rank;
      } else if (prevRank < entry.rank) {
        movement = "down";
        movementAmount = entry.rank - prevRank;
      } else {
        movement = "same";
        movementAmount = 0;
      }

      return {
        ...entry,
        previousRank: prevRank,
        movement,
        movementAmount,
      };
    });
  } catch {
    // Silently fall back to raw entries if enrichment fails
    return entries;
  }
}

function resolveSeriesLabel(slug: string | null | undefined): string {
  if (!slug) return "Series";
  switch (slug) {
    case "weekly": return "Weekly";
    case "monthly": return "Monthly";
    case "yearly": return "Yearly";
    case "decade": return "Decade";
    case "all-time": return "All-Time";
    case "event": return "Event";
    default: return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function resolveMarketLabel(slug: string | null | undefined): string {
  if (!slug) return "Kenya";
  switch (slug) {
    case "ke": return "Kenya";
    case "ng": return "Nigeria";
    case "gh": return "Ghana";
    case "sa": return "South Africa";
    case "tz": return "Tanzania";
    case "ug": return "Uganda";
    default: return slug.toUpperCase();
  }
}

function dbProgramToChartFamily(p: Record<string, unknown>): ChartFamily {
  const publicSlug = asString(p.public_slug, asString(p.id, "chart"));
  const publicLabel = asString(p.label, publicSlug);
  const periodType = asPeriodType(p.default_period_type);
  const seriesSlug = asString(p.series_slug, publicSlug);
  const marketSlug = asString(p.market_slug, "kenya");

  return {
    id: asString(p.id, publicSlug),
    familyKey: publicSlug,
    label: publicLabel,
    description: "",
    defaultChartSize: asNumber(p.default_chart_size, 100),
    defaultRegion: resolveMarketLabel(marketSlug),
    editionFrequency: asEditionFrequency(p.default_period_type),
    defaultRuleset: "legacy-import-v1",
    defaultScoringModel: asString(p.default_methodology_version, "legacy-import-v1"),
    createdAt: "",
    updatedAt: "",
    slug: publicSlug,
    sourceFamilySlug: publicSlug,
    seriesSlug,
    seriesLabel: resolveSeriesLabel(seriesSlug),
    marketSlug,
    marketLabel: resolveMarketLabel(marketSlug),
    publicSlug,
    publicLabel,
    shortLabel: publicLabel,
    chartMode: "data",
    periodType,
    methodologyVersion: asString(p.default_methodology_version, "legacy-import-v1"),
    eligibilityRulesVersion: "legacy-import-v1",
    legacySlugs: [],
  };
}

function dbEditionToChartEdition(e: Record<string, unknown>, familyId: string): ChartEdition {
  const slug = asString(e.edition_slug, asString(e.id, "edition"));
  const date = asString(e.edition_date);
  return {
    id: asString(e.id, slug),
    familyId,
    slug,
    label: asString(e.edition_label, slug),
    date,
    periodStart: asString(e.period_start, date),
    periodEnd: asString(e.period_end, date),
    status: "published",
    ingestJobId: null,
    publishedAt: null,
    publishedBy: null,
    entryCount: asNumber(e.entry_count),
    newEntries: 0,
    reEntries: 0,
  };
}

function dbEntryToChartEditionEntry(e: Record<string, unknown>, editionId: string): ChartEditionEntry {
  const trackSlug = asString(e.track_slug);
  const artistName = asString(e.artist_name);
  const artistSlug = asString(e.artist_slug);
  return {
    id: asString(e.id, `${editionId}-${e.rank ?? "entry"}`),
    editionId,
    rank: asNumber(e.rank),
    previousRank: e.previous_rank === null || e.previous_rank === undefined ? null : asNumber(e.previous_rank),
    movement: asMovement(e.movement),
    peakPosition: null,
    weeksOnChart: null,
    trackSlug,
    trackTitle: asString(e.track_title, trackSlug),
    artistSlugs: artistSlug ? [artistSlug] : artistName ? [artistName.toLowerCase().replace(/\s+/g, "-")] : [],
    artistNames: artistName ? [artistName] : [],
    artworkUrl: asString(e.artwork_url) || null,
    score: e.score === null || e.score === undefined ? 0 : asNumber(e.score),
    entryPayload: e,
  };
}

async function csvPublicDataAvailable(): Promise<boolean> {
  return hasCsvPublicChartData();
}

async function fallbackFamilies(): Promise<ChartFamily[]> {
  const csvData = await csvPublicDataAvailable();
  return csvData ? await getCsvFamilies() : [...MOCK_FAMILIES];
}

async function fallbackFamily(familySlug: string): Promise<ChartFamily | null> {
  const csvData = await csvPublicDataAvailable();
  return csvData ? await getCsvFamily(familySlug) : getMockFamily(familySlug);
}

async function fallbackEditionsForFamily(familySlug: string): Promise<ChartEdition[]> {
  const csvData = await csvPublicDataAvailable();
  return csvData ? await getCsvEditionsForFamily(familySlug) : getMockEditionsForFamily(familySlug);
}

async function fallbackLatestEdition(familySlug: string): Promise<ChartEdition | null> {
  const csvData = await csvPublicDataAvailable();
  return csvData ? await getCsvLatestEdition(familySlug) : getMockLatestEdition(familySlug);
}

async function fallbackEdition(familySlug: string, editionSlug: string): Promise<ChartEdition | null> {
  const csvData = await csvPublicDataAvailable();
  return csvData ? await getCsvEdition(familySlug, editionSlug) : getMockEdition(familySlug, editionSlug);
}

async function fallbackEntries(familySlug: string, editionSlug: string): Promise<ChartEditionEntry[]> {
  const csvData = await csvPublicDataAvailable();
  return csvData ? await getCsvEntriesForEdition(familySlug, editionSlug) : getMockEntriesForEdition(familySlug, editionSlug);
}

export function getChartFamilies(): Promise<ChartResult<ChartFamily[]>> {
  return withCache("chart_families_runtime", async () => {
    try {
      const { data: programs, error } = await supabase
        .from("chart_programs")
        .select("id, public_slug, label, series_slug, market_slug, default_chart_size, default_period_type, default_methodology_version, status")
        .eq("status", "active")
        .order("label", { ascending: true });

      if (error) throw new PublicChartsApiError(error.message, 500, "supabase_error");
      return { data: (programs ?? []).map(dbProgramToChartFamily), source: "api" };
    } catch {
      return { data: await fallbackFamilies(), source: "local" };
    }
  });
}

export function getChartFamily(familySlug: string): Promise<ChartResult<ChartFamily | null>> {
  return withCache(`chart_family_runtime_${familySlug}`, async () => {
    try {
      const { data: program, error } = await supabase
        .from("chart_programs")
        .select("id, public_slug, label, series_slug, market_slug, default_chart_size, default_period_type, default_methodology_version, status")
        .eq("public_slug", familySlug)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw new PublicChartsApiError(error.message, 500, "supabase_error");
      return { data: program ? dbProgramToChartFamily(program) : null, source: "api" };
    } catch {
      const family = await fallbackFamily(familySlug);
      return { data: family ? { ...family } : null, source: "local" };
    }
  });
}

export function getChartEditionsForFamily(familySlug: string): Promise<ChartResult<ChartEdition[]>> {
  return withCache(`chart_family_editions_runtime_${familySlug}`, async () => {
    try {
      const { data: program, error: progError } = await supabase
        .from("chart_programs")
        .select("id, public_slug")
        .eq("public_slug", familySlug)
        .eq("status", "active")
        .maybeSingle();

      if (progError) throw new PublicChartsApiError(progError.message, 500, "supabase_error");
      if (!program) return { data: [], source: "api" };

      const { data: editions, error: edError } = await supabase
        .from("chart_editions")
        .select("id, edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
        .eq("program_id", program.id)
        .eq("status", "published")
        .order("edition_date", { ascending: false });

      if (edError) throw new PublicChartsApiError(edError.message, 500, "supabase_error");
      return { data: (editions ?? []).map((e) => dbEditionToChartEdition(e, familySlug)), source: "api" };
    } catch {
      return { data: await fallbackEditionsForFamily(familySlug), source: "local" };
    }
  });
}

export function getLatestChartEdition(familySlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_latest_runtime_${familySlug}`, async () => {
    try {
      const { data: program, error: progError } = await supabase
        .from("chart_programs")
        .select("id, public_slug")
        .eq("public_slug", familySlug)
        .eq("status", "active")
        .maybeSingle();

      if (progError) throw new PublicChartsApiError(progError.message, 500, "supabase_error");
      if (!program) return { data: null, source: "api" };

      const { data: edition, error: edError } = await supabase
        .from("chart_editions")
        .select("id, edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
        .eq("program_id", program.id)
        .eq("status", "published")
        .order("edition_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (edError) throw new PublicChartsApiError(edError.message, 500, "supabase_error");
      return { data: edition ? dbEditionToChartEdition(edition, familySlug) : null, source: "api" };
    } catch {
      const edition = await fallbackLatestEdition(familySlug);
      return { data: edition ? { ...edition } : null, source: "local" };
    }
  });
}

export function getChartEdition(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEdition | null>> {
  return withCache(`chart_edition_runtime_${familySlug}_${editionSlug}`, async () => {
    try {
      const { data: program, error: progError } = await supabase
        .from("chart_programs")
        .select("id, public_slug")
        .eq("public_slug", familySlug)
        .eq("status", "active")
        .maybeSingle();

      if (progError) throw new PublicChartsApiError(progError.message, 500, "supabase_error");
      if (!program) return { data: null, source: "api" };

      const { data: edition, error: edError } = await supabase
        .from("chart_editions")
        .select("id, edition_slug, edition_label, edition_date, period_start, period_end, entry_count, status")
        .eq("program_id", program.id)
        .eq("edition_slug", editionSlug)
        .eq("status", "published")
        .maybeSingle();

      if (edError) throw new PublicChartsApiError(edError.message, 500, "supabase_error");
      return { data: edition ? dbEditionToChartEdition(edition, familySlug) : null, source: "api" };
    } catch {
      const edition = await fallbackEdition(familySlug, editionSlug);
      return { data: edition ? { ...edition } : null, source: "local" };
    }
  });
}

export function getChartEditionEntries(familySlug: string, editionSlug: string): Promise<ChartResult<ChartEditionEntry[]>> {
  return withCache(`chart_entries_runtime_${familySlug}_${editionSlug}`, async () => {
    try {
      const { data: program, error: progError } = await supabase
        .from("chart_programs")
        .select("id, public_slug")
        .eq("public_slug", familySlug)
        .eq("status", "active")
        .maybeSingle();

      if (progError) throw new PublicChartsApiError(progError.message, 500, "supabase_error");
      if (!program) return { data: [], source: "api" };

      const { data: edition, error: edError } = await supabase
        .from("chart_editions")
        .select("id")
        .eq("program_id", program.id)
        .eq("edition_slug", editionSlug)
        .eq("status", "published")
        .maybeSingle();

      if (edError) throw new PublicChartsApiError(edError.message, 500, "supabase_error");
      if (!edition) return { data: [], source: "api" };

      const { data: entries, error: entError } = await supabase
        .from("chart_entries")
        .select("id, rank, previous_rank, movement, track_slug, track_title, artist_name, artist_slug, artwork_url, score, source_entry_id")
        .eq("edition_id", edition.id)
        .order("rank", { ascending: true });

      if (entError) throw new PublicChartsApiError(entError.message, 500, "supabase_error");
      const mappedEntries = (entries ?? []).map((e) => dbEntryToChartEditionEntry(e, editionSlug));
      const enriched = await enrichMovementFromPriorEdition(mappedEntries, program.id, editionSlug);
      return { data: enriched, source: "api" };
    } catch {
      return { data: await fallbackEntries(familySlug, editionSlug), source: "local" };
    }
  });
}

export function getTrackChartHistory(trackSlug: string): Promise<ChartResult<TrackChartHistory | null>> {
  return withCache(`track_history_runtime_${trackSlug}`, async () => {
    try {
      const { data: entries, error } = await supabase
        .from("chart_entries")
        .select("rank, movement, track_title, artist_name, edition_id")
        .eq("track_slug", trackSlug)
        .order("rank", { ascending: true });

      if (error) throw new PublicChartsApiError(error.message, 500, "supabase_error");
      if (!entries || entries.length === 0) return { data: null, source: "api" };

      const editionIds = [...new Set(entries.map((e) => e.edition_id).filter(Boolean))];
      const { data: editions, error: edError } = await supabase
        .from("chart_editions")
        .select("id, edition_slug, edition_label, edition_date")
        .in("id", editionIds)
        .eq("status", "published")
        .order("edition_date", { ascending: true });

      if (edError) throw new PublicChartsApiError(edError.message, 500, "supabase_error");

      const editionMap = new Map((editions ?? []).map((e) => [e.id, e]));
      const appearances = entries.map((e) => {
        const ed = editionMap.get(e.edition_id);
        return {
          editionSlug: asString(ed?.edition_slug, ""),
          editionLabel: asString(ed?.edition_label, ""),
          rank: asNumber(e.rank),
          weeksOnChart: 1,
          movement: asMovement(e.movement),
          date: asString(ed?.edition_date, ""),
        };
      }).filter((a) => a.editionSlug);

      const trackTitle = asString(entries[0]?.track_title, "Unknown Track");
      const artistName = asString(entries[0]?.artist_name, "");
      const ranks = appearances.map((a) => a.rank);
      const peak = ranks.length > 0 ? Math.min(...ranks) : 0;

      const history: TrackChartHistory = {
        trackSlug,
        trackTitle,
        artistNames: artistName ? [artistName] : [],
        appearances,
        peakPosition: peak,
        totalWeeksOnChart: appearances.length,
        firstAppearance: appearances[0]?.date ?? null,
        latestAppearance: appearances[appearances.length - 1]?.date ?? null,
      };

      return { data: history, source: "api" };
    } catch {
      const csvData = await csvPublicDataAvailable();
      const csvHistory = csvData ? await getCsvTrackHistory(trackSlug) : null;
      if (csvHistory) return { data: csvHistory, source: "local" };
      if (trackSlug === "midnight-dreams") return { data: { ...MOCK_TRACK_HISTORY }, source: "local" };
      return {
        data: {
          trackSlug,
          trackTitle: "Unknown Track",
          artistNames: [],
          appearances: [],
          peakPosition: 0,
          totalWeeksOnChart: 0,
          firstAppearance: null,
          latestAppearance: null,
        },
        source: "local",
      };
    }
  });
}

export { clearChartCache };
export type { ChartFamily, ChartEdition, ChartEditionEntry, TrackChartHistory };
export {
  getMockEntriesForEdition,
  getMockLatestEdition,
  getMockEdition,
  getMockFamily,
  getMockEditionsForFamily,
} from "./mockData";
export {
  hasCsvPublicChartData,
  getCsvEntriesForEdition,
  getCsvLatestEdition,
  getCsvEdition,
  getCsvFamily,
  getCsvFamilies,
  getCsvEditionsForFamily,
} from "./csvData";
export {
  toChartDirectoryViewModel,
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  toChartTrackPlayerModels,
  toChartFamilyViewModel,
  toChartArchiveViewModel,
} from "./viewModels";