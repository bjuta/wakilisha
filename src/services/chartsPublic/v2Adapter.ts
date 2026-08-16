import type {
  ChartEdition,
  ChartEditionEntry,
  ChartFamily,
  TrackChartHistory,
} from "./types";

export class PublicV2ApiError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, status: number, code?: string, retryable = false) {
    super(message);
    this.name = "PublicV2ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const RAW_BASE =
  import.meta.env.VITE_PUBLIC_API_BASE || "/api/v1";

const BASE_PATH = "/";
const normalizedBasePath = BASE_PATH.replace(/\/$/, "");
export const PUBLIC_V2_API_BASE = normalizedBasePath + RAW_BASE;

type ApiEnvelope<T> = {
  data: T;
  meta?: {
    apiVersion?: string;
    generatedAt?: string;
    source?: string;
    canonicalSlug?: string;
    legacySlug?: string;
    canonicalized?: boolean;
    warnings?: string[];
  };
};

type V2Program = {
  id: string;
  seriesSlug: string;
  seriesLabel: string;
  marketSlug: string;
  marketLabel: string;
  publicSlug: string;
  publicLabel: string;
  shortLabel?: string | null;
  sourceFamilySlug?: string | null;
  periodType?: "weekly" | "monthly" | "yearly" | "evergreen" | null;
  methodologyVersion?: string | null;
  eligibilityRulesVersion?: string | null;
  latestEdition?: V2EditionSummary | null;
  archive?: V2EditionSummary[];
};

type V2EditionSummary = {
  id: string;
  slug: string;
  label: string;
  date: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  entryCount?: number;
};

type V2Entry = {
  id: string;
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new" | "re_entry" | string;
  trackSlug: string | null;
  trackTitle: string;
  canonicalTrackId?: string | null;
  artistNames: string[];
  artistSlugs?: string[];
  artworkUrl: string | null;
  score?: number | null;
  sourceEntryId?: string | null;
};

type V2ProgramListData = { programs: V2Program[] };
type V2ProgramData = { program: V2Program } | V2Program;
type V2EditionData = {
  program?: V2Program;
  edition: V2EditionSummary;
  entries?: V2Entry[];
};
type V2EntriesData = { entries: V2Entry[] } | V2Entry[];
type V2TrackHistoryData = { history: TrackChartHistory } | TrackChartHistory;

type V2Health = {
  ok: boolean;
  plugin?: string;
  version?: string;
  charts_public?: boolean;
  charts_v2?: boolean;
  counts?: Record<string, number>;
};

const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL || "";

function buildAuthHeaders(): Record<string, string> {
  if (SUPABASE_ANON_KEY && PUBLIC_V2_API_BASE.includes(SUPABASE_URL)) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    };
  }
  return {};
}

async function v2Request<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${PUBLIC_V2_API_BASE}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", ...buildAuthHeaders() },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      let code = `http_${response.status}`;
      try {
        const body = (await response.json()) as { message?: string; error?: string; code?: string };
        message = body.message || body.error || message;
        code = body.code || code;
      } catch {
        const text = await response.text();
        if (text) message = text;
      }
      throw new PublicV2ApiError(
        message,
        response.status,
        code,
        response.status === 502 || response.status === 503 || response.status === 504
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof PublicV2ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new PublicV2ApiError("Public chart request timed out after 30 seconds", 504, "timeout", true);
    }
    if (err instanceof TypeError) {
      throw new PublicV2ApiError(
        "Network error: unable to reach WAKILISHA public API.",
        0,
        "network_error",
        true
      );
    }
    throw new PublicV2ApiError(err instanceof Error ? err.message : "Unknown public API error", 500, "unknown", false);
  }
}

async function v2Get<T>(path: string, retries = 3): Promise<T> {
  let lastErr: PublicV2ApiError | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await v2Request<T>(path);
    } catch (err) {
      lastErr = err instanceof PublicV2ApiError ? err : undefined;
      if (!lastErr?.retryable || i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr ?? new PublicV2ApiError("Unknown public API error after retries", 500, "unknown", false);
}

function unwrap<T>(envelope: ApiEnvelope<T> | T): T {
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return (envelope as ApiEnvelope<T>).data;
  }
  return envelope as T;
}

function chartPath(programSlug: string, _marketSlug?: string | null, tail?: string): string {
  const program = String(programSlug || "").trim().replace(/^\/+|\/+$/g, "");
  const suffix = tail ? `/${String(tail).replace(/^\/+|\/+$/g, "")}` : "";
  return `/charts/${program}${suffix}`;
}

async function v2GetWithLegacy<T>(primaryPath: string, legacyPath?: string): Promise<T> {
  try {
    return await v2Get<T>(primaryPath);
  } catch (err) {
    if (
      legacyPath &&
      legacyPath !== primaryPath &&
      err instanceof PublicV2ApiError &&
      err.status === 404
    ) {
      return await v2Get<T>(legacyPath);
    }
    throw err;
  }
}

function hasPublicEdition(program: V2Program): boolean {
  return (
    Boolean(program.latestEdition)
    || (program.archive?.length ?? 0) > 0
  );
}

function toFamily(program: V2Program): ChartFamily {
  const period = program.periodType ?? "weekly";
  return {
    id: program.id,
    familyKey: program.sourceFamilySlug ?? program.publicSlug,
    slug: program.publicSlug,
    label: program.publicLabel,
    description: `${program.publicLabel} chart program.`,
    defaultChartSize: program.latestEdition?.entryCount ?? 100,
    defaultRegion: program.marketSlug,
    editionFrequency: period === "monthly" ? "monthly" : "weekly",
    defaultRuleset: program.eligibilityRulesVersion ?? "unknown",
    defaultScoringModel: program.methodologyVersion ?? "unknown",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceFamilySlug: program.sourceFamilySlug ?? program.publicSlug,
    seriesSlug: program.seriesSlug,
    seriesLabel: program.seriesLabel,
    marketSlug: program.marketSlug,
    marketLabel: program.marketLabel,
    publicSlug: program.publicSlug,
    publicLabel: program.publicLabel,
    shortLabel: program.shortLabel ?? program.publicLabel,
    chartMode: "data",
    periodType: period,
    methodologyVersion: program.methodologyVersion ?? undefined,
    eligibilityRulesVersion: program.eligibilityRulesVersion ?? undefined,
    legacySlugs: program.sourceFamilySlug ? [program.sourceFamilySlug] : [],
  };
}

function toEdition(edition: V2EditionSummary, familyId: string): ChartEdition {
  return {
    id: edition.id,
    familyId,
    slug: edition.slug,
    label: edition.label,
    date: edition.date,
    periodStart: edition.periodStart ?? edition.date,
    periodEnd: edition.periodEnd ?? edition.date,
    status: "published",
    ingestJobId: null,
    publishedAt: null,
    publishedBy: null,
    entryCount: edition.entryCount ?? 0,
    newEntries: 0,
    reEntries: 0,
  };
}

function toEntry(entry: V2Entry, editionSlug: string): ChartEditionEntry {
  return {
    id: entry.id,
    editionId: editionSlug,
    rank: entry.rank,
    previousRank: entry.previousRank,
    movement: ["up", "down", "same", "new", "re_entry"].includes(entry.movement)
      ? (entry.movement as ChartEditionEntry["movement"])
      : "same",
    peakPosition: entry.rank,
    weeksOnChart: null,
    trackSlug: entry.trackSlug ?? entry.id,
    trackTitle: entry.trackTitle,
    canonicalTrackId: entry.canonicalTrackId ?? null,
    artistSlugs: entry.artistSlugs ?? [],
    artistNames: entry.artistNames ?? [],
    artworkUrl: entry.artworkUrl,
    score: typeof entry.score === "number" ? entry.score : 0,
    entryPayload: {
      source: "public-content-read",
      sourceEntryId: entry.sourceEntryId ?? entry.id,
    },
  };
}

export async function getV2ChartFamilies(): Promise<{ families: ChartFamily[]; editions: ChartEdition[] }> {
  const data = unwrap<V2ProgramListData>(await v2Get<ApiEnvelope<V2ProgramListData> | V2ProgramListData>("/charts"));
  const families: ChartFamily[] = [];
  const editions: ChartEdition[] = [];
  for (const program of (data.programs ?? []).filter(hasPublicEdition)) {
    const family = toFamily(program);
    families.push(family);
    if (program.archive) {
      for (const ed of program.archive) {
        editions.push(toEdition(ed, program.publicSlug));
      }
    }
  }
  return { families, editions };
}

export async function getV2ChartFamily(programSlug: string, marketSlug?: string | null): Promise<ChartFamily | null> {
  const data = unwrap<V2ProgramData>(
    await v2GetWithLegacy<ApiEnvelope<V2ProgramData> | V2ProgramData>(
      chartPath(programSlug, marketSlug),
      marketSlug ? chartPath(programSlug) : undefined
    )
  );
  const program = "program" in data ? data.program : data;
  return program ? toFamily(program) : null;
}

export async function getV2ChartEditionsForFamily(programSlug: string, marketSlug?: string | null): Promise<ChartEdition[]> {
  const data = unwrap<V2ProgramData>(
    await v2GetWithLegacy<ApiEnvelope<V2ProgramData> | V2ProgramData>(
      chartPath(programSlug, marketSlug),
      marketSlug ? chartPath(programSlug) : undefined
    )
  );
  const program = "program" in data ? data.program : data;
  return (program.archive ?? []).map((edition) => toEdition(edition, program.publicSlug));
}

export async function getV2LatestChartEdition(programSlug: string, marketSlug?: string | null): Promise<ChartEdition | null> {
  const data = unwrap<V2EditionData>(
    await v2GetWithLegacy<ApiEnvelope<V2EditionData> | V2EditionData>(
      chartPath(programSlug, marketSlug, "latest"),
      marketSlug ? chartPath(programSlug, null, "latest") : undefined
    )
  );
  const familyId = data.program?.publicSlug ?? programSlug;
  return data.edition ? toEdition(data.edition, familyId) : null;
}

export async function getV2LatestChartEditionWithEntries(programSlug: string, marketSlug?: string | null): Promise<{ edition: ChartEdition | null; entries: ChartEditionEntry[] }> {
  const data = unwrap<V2EditionData>(
    await v2GetWithLegacy<ApiEnvelope<V2EditionData> | V2EditionData>(
      chartPath(programSlug, marketSlug, "latest"),
      marketSlug ? chartPath(programSlug, null, "latest") : undefined
    )
  );
  const familyId = data.program?.publicSlug ?? programSlug;
  const edition = data.edition ? toEdition(data.edition, familyId) : null;
  const entries = (data.entries ?? []).map((entry) => toEntry(entry, data.edition?.slug ?? programSlug));
  return { edition, entries };
}

export async function getV2ChartEdition(programSlug: string, editionSlug: string, marketSlug?: string | null): Promise<ChartEdition | null> {
  const data = unwrap<V2EditionData>(
    await v2GetWithLegacy<ApiEnvelope<V2EditionData> | V2EditionData>(
      chartPath(programSlug, marketSlug, editionSlug),
      marketSlug ? chartPath(programSlug, null, editionSlug) : undefined
    )
  );
  const familyId = data.program?.publicSlug ?? programSlug;
  return data.edition ? toEdition(data.edition, familyId) : null;
}

export async function getV2ChartEditionEntries(programSlug: string, editionSlug: string, marketSlug?: string | null): Promise<ChartEditionEntry[]> {
  const data = unwrap<V2EntriesData>(
    await v2GetWithLegacy<ApiEnvelope<V2EntriesData> | V2EntriesData>(
      chartPath(programSlug, marketSlug, `${editionSlug}/entries`),
      marketSlug ? chartPath(programSlug, null, `${editionSlug}/entries`) : undefined
    )
  );
  const entries = Array.isArray(data) ? data : data.entries;
  return (entries ?? []).map((entry) => toEntry(entry, editionSlug));
}

export async function getV2TrackChartHistory(trackSlug: string): Promise<TrackChartHistory | null> {
  const data = unwrap<V2TrackHistoryData>(await v2Get<ApiEnvelope<V2TrackHistoryData> | V2TrackHistoryData>(`/tracks/${trackSlug}/chart-history`));
  return "history" in data ? data.history : data;
}

export async function testPublicV2Connection(): Promise<V2Health> {
  return unwrap<V2Health>(await v2Get<ApiEnvelope<V2Health> | V2Health>("/health"));
}
