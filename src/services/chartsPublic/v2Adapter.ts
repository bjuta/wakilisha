import type {
  ChartEdition,
  ChartEditionEntry,
  ChartFamily,
  TrackChartHistory,
} from "./types";
import { PublicWpApiError } from "./wpAdapter";

const RAW_PUBLIC_V2_API_BASE =
  import.meta.env.VITE_WAKILISHA_WP_V2_API_BASE || "/wp-json/wakilisha/v2";

function resolvePublicV2ApiBase(base: string): string {
  if (typeof window === "undefined") return base;
  if (!window.location.hostname.endsWith(".app.github.dev")) return base;

  try {
    const url = new URL(base);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return base;

    const forwardedHost = window.location.hostname.replace(/-(\d+)\.app\.github\.dev$/, `-${url.port}.app.github.dev`);
    url.protocol = window.location.protocol;
    url.hostname = forwardedHost;
    url.port = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

export const PUBLIC_V2_API_BASE = resolvePublicV2ApiBase(RAW_PUBLIC_V2_API_BASE);

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

async function v2Request<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${PUBLIC_V2_API_BASE}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      credentials: "same-origin",
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
      throw new PublicWpApiError(
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
    if (err instanceof PublicWpApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new PublicWpApiError("V2 request timed out after 30 seconds", 504, "timeout", true);
    }
    if (err instanceof TypeError) {
      throw new PublicWpApiError(
        "Network error: unable to reach WAKILISHA Charts V2 API.",
        0,
        "network_error",
        true
      );
    }
    throw new PublicWpApiError(err instanceof Error ? err.message : "Unknown V2 API error", 500, "unknown", false);
  }
}

async function v2Get<T>(path: string, retries = 3): Promise<T> {
  let lastErr: PublicWpApiError | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await v2Request<T>(path);
    } catch (err) {
      lastErr = err instanceof PublicWpApiError ? err : undefined;
      if (!lastErr?.retryable || i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr ?? new PublicWpApiError("Unknown V2 error after retries", 500, "unknown", false);
}

function unwrap<T>(envelope: ApiEnvelope<T> | T): T {
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return (envelope as ApiEnvelope<T>).data;
  }
  return envelope as T;
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
    artistSlugs: entry.artistSlugs ?? [],
    artistNames: entry.artistNames ?? [],
    artworkUrl: entry.artworkUrl,
    score: typeof entry.score === "number" ? entry.score : 0,
    entryPayload: {
      source: "wakilisha-v2-api",
      sourceEntryId: entry.sourceEntryId ?? entry.id,
    },
  };
}

export async function getV2ChartFamilies(): Promise<ChartFamily[]> {
  const data = unwrap<V2ProgramListData>(await v2Get<ApiEnvelope<V2ProgramListData> | V2ProgramListData>("/charts"));
  return (data.programs ?? []).map(toFamily);
}

export async function getV2ChartFamily(programSlug: string): Promise<ChartFamily | null> {
  const data = unwrap<V2ProgramData>(await v2Get<ApiEnvelope<V2ProgramData> | V2ProgramData>(`/charts/${programSlug}`));
  const program = "program" in data ? data.program : data;
  return program ? toFamily(program) : null;
}

export async function getV2ChartEditionsForFamily(programSlug: string): Promise<ChartEdition[]> {
  const data = unwrap<V2ProgramData>(await v2Get<ApiEnvelope<V2ProgramData> | V2ProgramData>(`/charts/${programSlug}`));
  const program = "program" in data ? data.program : data;
  return (program.archive ?? []).map((edition) => toEdition(edition, program.publicSlug));
}

export async function getV2LatestChartEdition(programSlug: string): Promise<ChartEdition | null> {
  const data = unwrap<V2EditionData>(await v2Get<ApiEnvelope<V2EditionData> | V2EditionData>(`/charts/${programSlug}/latest`));
  const familyId = data.program?.publicSlug ?? programSlug;
  return data.edition ? toEdition(data.edition, familyId) : null;
}

export async function getV2ChartEdition(programSlug: string, editionSlug: string): Promise<ChartEdition | null> {
  const data = unwrap<V2EditionData>(await v2Get<ApiEnvelope<V2EditionData> | V2EditionData>(`/charts/${programSlug}/${editionSlug}`));
  const familyId = data.program?.publicSlug ?? programSlug;
  return data.edition ? toEdition(data.edition, familyId) : null;
}

export async function getV2ChartEditionEntries(programSlug: string, editionSlug: string): Promise<ChartEditionEntry[]> {
  const data = unwrap<V2EntriesData>(await v2Get<ApiEnvelope<V2EntriesData> | V2EntriesData>(`/charts/${programSlug}/${editionSlug}/entries`));
  const entries = Array.isArray(data) ? data : data.entries;
  return (entries ?? []).map((entry) => toEntry(entry, editionSlug));
}

export async function getV2TrackChartHistory(trackSlug: string): Promise<TrackChartHistory | null> {
  const data = unwrap<V2TrackHistoryData>(await v2Get<ApiEnvelope<V2TrackHistoryData> | V2TrackHistoryData>(`/tracks/${trackSlug}/chart-history`));
  return "history" in data ? data.history : data;
}

export async function testPublicV2Connection(): Promise<V2Health> {
  return unwrap<V2Health>(await v2Get<ApiEnvelope<V2Health> | V2Health>("/charts/health"));
}
