import type {
  LegacyWordPressChartEdition,
  LegacyWordPressChartEntry,
  LegacyWordPressChartProgram,
  LegacyWordPressImportDryRun,
  LegacyWordPressImportIssue,
  LegacyWordPressSourceKind,
} from "./types";

const DEFAULT_LEGACY_WP_V2_BASE = "/wp-json/wakilisha/v2";
const DEFAULT_LEGACY_WP_V1_BASE = "/wp-json/wakilisha/v1";

function readEnv(key: string): string | undefined {
  return (import.meta.env[key] as string | undefined) || undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getLegacyWordPressV2Base(): string {
  return stripTrailingSlash(readEnv("VITE_WAKILISHA_LEGACY_WP_V2_API_BASE") || readEnv("VITE_WAKILISHA_WP_V2_API_BASE") || DEFAULT_LEGACY_WP_V2_BASE);
}

export function getLegacyWordPressV1Base(): string {
  return stripTrailingSlash(readEnv("VITE_WAKILISHA_LEGACY_WP_API_BASE") || readEnv("VITE_WAKILISHA_WP_API_BASE") || DEFAULT_LEGACY_WP_V1_BASE);
}

export class LegacyWordPressImportError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status = 500, code = "legacy_wordpress_import_error", retryable = false) {
    super(message);
    this.name = "LegacyWordPressImportError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function legacyWpGet<T>(baseUrl: string, path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
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
      throw new LegacyWordPressImportError(message, response.status, code, [502, 503, 504].includes(response.status));
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof LegacyWordPressImportError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LegacyWordPressImportError("Legacy WordPress import request timed out after 30 seconds.", 504, "timeout", true);
    }
    if (error instanceof TypeError) {
      throw new LegacyWordPressImportError("Network error while reaching the legacy WordPress API.", 0, "network_error", true);
    }
    throw new LegacyWordPressImportError(error instanceof Error ? error.message : "Unknown legacy WordPress import error.");
  }
}

type V2Envelope<T> = { data: T; meta?: Record<string, unknown> } | T;
function unwrap<T>(value: V2Envelope<T>): T {
  return value && typeof value === "object" && "data" in value ? (value as { data: T }).data : (value as T);
}

type V2Program = {
  id: string;
  seriesSlug?: string;
  marketSlug?: string;
  publicSlug: string;
  publicLabel?: string;
  chartKind?: string | null;
};

type V2Edition = {
  id: string;
  slug: string;
  label?: string;
  date?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  entryCount?: number;
};

type V2Entry = {
  id: string;
  rank: number;
  previousRank?: number | null;
  movement?: string | null;
  trackTitle?: string;
  artistNames?: string[];
  artworkUrl?: string | null;
  sourceEntryId?: string | null;
};

export async function fetchLegacyChartPrograms(): Promise<LegacyWordPressChartProgram[]> {
  const envelope = await legacyWpGet<V2Envelope<{ programs: V2Program[] }>>(getLegacyWordPressV2Base(), "/charts/programs");
  const data = unwrap(envelope);
  return (data.programs || []).map((program) => ({
    legacyId: program.id,
    legacySlug: program.publicSlug,
    legacyType: "chart_program" as const,
    legacyUrl: `/charts/${program.publicSlug}`,
    title: program.publicLabel ?? program.publicSlug,
    publicSlug: program.publicSlug,
    seriesSlug: program.seriesSlug ?? null,
    marketSlug: program.marketSlug ?? null,
    chartKind: program.chartKind ?? null,
    rawPayload: program,
  }));
}

export async function fetchLegacyChartEditions(publicSlug: string): Promise<LegacyWordPressChartEdition[]> {
  const envelope = await legacyWpGet<V2Envelope<{ program?: V2Program; editions?: V2Edition[]; archive?: V2Edition[] }>>(getLegacyWordPressV2Base(), `/charts/programs/${publicSlug}`);
  const data = unwrap(envelope);
  const editions = data.editions || data.archive || [];
  return editions.map((edition) => ({
    legacyId: edition.id,
    legacySlug: edition.slug,
    legacyType: "chart_edition" as const,
    legacyUrl: `/charts/${publicSlug}/${edition.slug}`,
    programLegacyId: data.program?.id ?? publicSlug,
    publicSlug,
    editionSlug: edition.slug,
    editionDate: edition.date ?? null,
    label: edition.label ?? null,
    entryCount: edition.entryCount ?? null,
    rawPayload: edition,
  }));
}

export async function fetchLegacyChartEntries(publicSlug: string, editionSlug: string): Promise<LegacyWordPressChartEntry[]> {
  const envelope = await legacyWpGet<V2Envelope<{ entries: V2Entry[] } | V2Entry[]>>(getLegacyWordPressV2Base(), `/charts/${publicSlug}/${editionSlug}/entries`);
  const data = unwrap(envelope);
  const entries = Array.isArray(data) ? data : data.entries || [];
  return entries.map((entry) => ({
    legacyId: entry.id,
    legacySlug: entry.id,
    legacyType: "chart_entry" as const,
    legacyUrl: `/charts/${publicSlug}/${editionSlug}`,
    editionLegacyId: editionSlug,
    rank: entry.rank,
    previousRank: entry.previousRank ?? null,
    movement: entry.movement ?? null,
    title: entry.trackTitle ?? "Untitled legacy track",
    artistNames: entry.artistNames ?? [],
    artworkUrl: entry.artworkUrl ?? null,
    sourceEntryId: entry.sourceEntryId ?? null,
    rawPayload: entry,
  }));
}

export async function dryRunLegacyWordPressImport(sourceKinds: LegacyWordPressSourceKind[] = ["chart_program", "chart_edition", "chart_entry"]): Promise<LegacyWordPressImportDryRun> {
  const jobId = `legacy-wp-${Date.now()}`;
  const issues: LegacyWordPressImportIssue[] = [];
  const counts: LegacyWordPressImportDryRun["counts"] = {};
  const sampleEntities: LegacyWordPressImportDryRun["sampleEntities"] = [];

  if (sourceKinds.includes("chart_program")) {
    const programs = await fetchLegacyChartPrograms();
    counts.chart_program = programs.length;
    sampleEntities.push(...programs.slice(0, 5));

    if (sourceKinds.includes("chart_edition") || sourceKinds.includes("chart_entry")) {
      for (const program of programs.slice(0, 3)) {
        const editions = await fetchLegacyChartEditions(program.publicSlug);
        counts.chart_edition = (counts.chart_edition ?? 0) + editions.length;
        sampleEntities.push(...editions.slice(0, 3));

        if (sourceKinds.includes("chart_entry")) {
          for (const edition of editions.slice(0, 2)) {
            const entries = await fetchLegacyChartEntries(program.publicSlug, edition.editionSlug);
            counts.chart_entry = (counts.chart_entry ?? 0) + entries.length;
            sampleEntities.push(...entries.slice(0, 5));
          }
        }
      }
    }
  }

  for (const kind of sourceKinds) {
    if (!counts[kind]) {
      issues.push({
        id: `${jobId}:${kind}:empty`,
        sourceKind: kind,
        severity: kind === "chart_program" ? "blocking" : "warning",
        code: "no_legacy_entities_found",
        message: `No legacy ${kind} records were found during dry run.`,
        suggestedAction: "Confirm the legacy WordPress API base and source type mapping.",
      });
    }
  }

  return {
    jobId,
    status: "dry_run",
    sourceBaseUrl: getLegacyWordPressV2Base(),
    scannedAt: new Date().toISOString(),
    counts,
    sampleEntities,
    issues,
  };
}
