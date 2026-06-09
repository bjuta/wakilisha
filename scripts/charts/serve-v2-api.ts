import http from "node:http";
import { URL } from "node:url";
import {
  createV2Repository,
  type V2Repository,
} from "./v2-api-repository";
import { repairedResponse as publicIndexResponse } from "./repaired-content-api";
import { repairedDetailResponse as publicDetailResponse } from "./repaired-content-details-api";
import {
  applyApprovedReleaseShellSuggestions,
  buildReleaseShellEnrichmentContexts,
  createRegistryEnrichmentPool,
  getReleaseShellCanonicalWriteEvents,
  listReleaseShellEnrichmentContexts,
  updateReleaseShellLifecycleStatus,
  type ReleaseShellLookupInput,
} from "../registry/enrichment-review-runtime-api";

type Row = Record<string, unknown>;
type Entry = {
  id: string;
  rank: number;
  previousRank: number | null;
  movement: string;
  trackSlug: string | null;
  trackTitle: string;
  artistSlugs?: string[];
  artistNames: string[];
  artworkUrl: string | null;
  score?: number;
};

const port = Number(process.env.WAKILISHA_V2_API_PORT ?? 4176);
const host = process.env.WAKILISHA_V2_API_HOST;
const repo = createV2Repository();
let enrichmentPool: ReturnType<typeof createRegistryEnrichmentPool> | null = null;

function str(row: Row | undefined | null, key: string): string {
  return String(row?.[key] ?? "");
}

function nullable(row: Row | undefined | null, key: string): string | null {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? null : String(value);
}

function numberValue(row: Row | undefined | null, key: string): number {
  const value = Number(row?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function embeddedArchive(program: Row): Row[] | null {
  const value = program.archive_json;
  if (!value) return null;
  if (Array.isArray(value)) return value as Row[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as Row[] : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function toEditionSummary(edition: Row) {
  return {
    id: str(edition, "id"),
    slug: str(edition, "edition_slug"),
    label: str(edition, "edition_label"),
    date: str(edition, "edition_date"),
    periodStart: nullable(edition, "period_start"),
    periodEnd: nullable(edition, "period_end"),
    entryCount: numberValue(edition, "entry_count"),
  };
}

async function toProgram(repository: V2Repository, program: Row) {
  const archive = embeddedArchive(program) ?? (await repository.listEditionsForProgram(program)).filter((edition) => numberValue(edition, "entry_count") > 0);
  const series = str(program, "series_label") ? program : await repository.getSeries(str(program, "series_slug"));
  const market = str(program, "market_label") ? program : await repository.getMarket(str(program, "market_slug"));
  return {
    id: str(program, "id"),
    seriesSlug: str(program, "series_slug"),
    seriesLabel: str(series, "series_label"),
    marketSlug: str(program, "market_slug"),
    marketLabel: str(market, "market_label"),
    publicSlug: str(program, "public_slug"),
    publicLabel: str(program, "public_label"),
    shortLabel: nullable(program, "short_label"),
    sourceFamilySlug: nullable(program, "source_family_slug"),
    periodType: nullable(program, "default_period_type"),
    methodologyVersion: nullable(program, "default_methodology_version"),
    eligibilityRulesVersion: nullable(program, "default_eligibility_rules_version"),
    latestEdition: archive[0] ? await toEditionSummary(archive[0]) : null,
    archive: await Promise.all(archive.slice(0, 6).map(toEditionSummary)),
  };
}

function toEntry(entry: Entry) {
  return {
    id: entry.id,
    rank: entry.rank,
    previousRank: entry.previousRank,
    movement: entry.movement,
    trackSlug: entry.trackSlug,
    trackTitle: entry.trackTitle,
    artistNames: entry.artistNames ?? [],
    artistSlugs: entry.artistSlugs ?? [],
    artworkUrl: entry.artworkUrl,
    score: typeof entry.score === "number" ? entry.score : null,
    sourceEntryId: entry.id,
  };
}

function envelope(data: unknown, meta: Record<string, unknown> = {}) {
  return {
    data,
    meta: {
      apiVersion: "v1",
      generatedAt: new Date().toISOString(),
      source: `wakilisha-public-${repo.kind}`,
      repository: repo.kind,
      ...meta,
    },
  };
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Accept",
  });
  res.end(JSON.stringify(body, null, 2));
}

function error(res: http.ServerResponse, status: number, code: string, message: string, meta: Record<string, unknown> = {}) {
  json(res, status, { code, message, status, meta });
}

function getEnrichmentPool(): ReturnType<typeof createRegistryEnrichmentPool> {
  enrichmentPool ??= createRegistryEnrichmentPool();
  return enrichmentPool;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function isReleaseShellLookupInput(value: unknown): value is ReleaseShellLookupInput {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.shellKey === "string";
}


async function route(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.method === "OPTIONS") return json(res, 200, {});
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const prefix = "/api/v1";
    if (!url.pathname.startsWith(prefix)) return error(res, 404, "not_found", "Route not found.");
    const parts = url.pathname.slice(prefix.length).split("/").filter(Boolean).map(decodeURIComponent);





    if (
      parts.length === 5 &&
      parts[0] === "registry" &&
      parts[1] === "enrichment-review" &&
      parts[2] === "release-shells" &&
      parts[4] === "lifecycle"
    ) {
      if (req.method !== "POST") {
        return error(res, 405, "method_not_allowed", "Only POST is supported for release shell lifecycle updates.");
      }

      const registryEntityId = parts[3];
      const body = await readJsonBody(req);
      const status = String((body as { status?: unknown }).status ?? "").trim();
      const reason = String((body as { reason?: unknown }).reason ?? "").trim();

      if (status !== "resolved" && status !== "reopened") {
        return error(res, 400, "invalid_request", "Expected lifecycle status to be resolved or reopened.");
      }

      const lifecycle = await updateReleaseShellLifecycleStatus(getEnrichmentPool(), registryEntityId, status, reason);

      return json(res, 200, envelope({ lifecycle }, {
        resource: "registry-enrichment-review",
        action: "release-shell-lifecycle",
        registryEntityId,
      }));
    }

    if (
      parts.length === 5 &&
      parts[0] === "registry" &&
      parts[1] === "enrichment-review" &&
      parts[2] === "release-shells" &&
      parts[4] === "audit"
    ) {
      if (req.method !== "GET") {
        return error(res, 405, "method_not_allowed", "Only GET is supported for canonical write audit.");
      }

      const registryEntityId = parts[3];
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);
      const events = await getReleaseShellCanonicalWriteEvents(getEnrichmentPool(), registryEntityId, limit);

      return json(res, 200, envelope({ events }, {
        resource: "registry-enrichment-review",
        action: "canonical-write-audit",
        registryEntityId,
        count: events.length,
      }));
    }

    if (parts.join("/") === "registry/enrichment-review/release-shells/apply-approved") {
      if (req.method !== "POST") {
        return error(res, 405, "method_not_allowed", "Only POST is supported for canonical application.");
      }

      const body = await readJsonBody(req);
      const registryEntityId = String((body as { registryEntityId?: unknown }).registryEntityId ?? "").trim();

      if (!registryEntityId) {
        return error(res, 400, "invalid_request", "Expected JSON body with registryEntityId.");
      }

      const result = await applyApprovedReleaseShellSuggestions(getEnrichmentPool(), registryEntityId);
      const status = result.failed.length > 0 ? 409 : 200;

      return json(res, status, envelope(result, {
        resource: "registry-enrichment-review",
        action: "apply-approved-release-shell-suggestions",
      }));
    }

    if (parts.join("/") === "registry/enrichment-review/release-shells") {
      if (req.method === "GET") {
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);
        const includeResolved = url.searchParams.get("includeResolved") === "1";
        const contexts = await listReleaseShellEnrichmentContexts(getEnrichmentPool(), limit, includeResolved);
        return json(res, 200, envelope({ contexts }, { resource: "registry-enrichment-review", count: contexts.length }));
      }

      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const shells = (body as { shells?: unknown }).shells;
        if (!Array.isArray(shells) || !shells.every(isReleaseShellLookupInput)) {
          return error(res, 400, "invalid_request", "Expected JSON body with shells: ReleaseShellLookupInput[].");
        }

        const contexts = await buildReleaseShellEnrichmentContexts(getEnrichmentPool(), shells);
        return json(res, 200, envelope({ contexts }, { resource: "registry-enrichment-review", count: contexts.length }));
      }

      return error(res, 405, "method_not_allowed", "Only GET and POST are supported for registry enrichment review.");
    }

    if (req.method !== "GET") return error(res, 405, "method_not_allowed", "Only GET is supported.");

    if (parts.length === 0 || parts.join("/") === "health") {
      return json(res, 200, envelope({
        ok: true,
        service: "wakilisha-public-api",
        version: "v1",
        repository: repo.kind,
        counts: await repo.getCounts(),
        migrationReadiness: await repo.getMigrationReadiness(),
      }));
    }

    if (["magazine", "artists", "releases", "genres", "labels", "tracks", "search"].includes(parts[0])) {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 120) || 120, 500);
      if (parts.length > 1) {
        const data = await publicDetailResponse(parts[0], parts.slice(1));
        return json(res, 200, envelope(data, { resource: parts[0], detailPath: parts.slice(1).join("/") }));
      }
      const data = await publicIndexResponse(parts[0], limit);
      return json(res, 200, envelope(data, { resource: parts[0], count: limit }));
    }

    if (parts.length === 1 && parts[0] === "charts") {
      const programs = await repo.listPrograms();
      return json(res, 200, envelope({ programs: await Promise.all(programs.map((program) => toProgram(repo, program))) }, { count: programs.length }));
    }

    if (parts.length === 3 && parts[0] === "charts" && parts[1] === "resolve") {
      const resolved = await repo.resolveProgramSlug(parts[2]);
      const program = await repo.getProgram(parts[2]);
      if (!program) return error(res, 404, "chart_alias_not_found", "Chart alias not found.", { requestedSlug: parts[2] });
      return json(res, 200, envelope({ ...resolved, program: await toProgram(repo, program) }, resolved));
    }

    if (parts.length >= 2 && parts[0] === "charts") {
      const chartParts = parts.slice(1);
      const isEditionSlug = (value: string) => /-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]+)?$/.test(value);
      const toCanonicalProgramSlug = (rawParts: string[], editionSlug?: string) => {
        const raw = rawParts.join("/");
        if (raw === "charts" || raw === "charts-kenya") {
          const seriesSlug = editionSlug ? editionSlug.replace(/-[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]+)?$/, "") : "kenya";
          return `top-songs/kenya/${seriesSlug}`;
        }
        if (rawParts.length === 1 && rawParts[0] !== "top-songs") {
          return `top-songs/kenya/${rawParts[0]}`;
        }
        return raw;
      };

      const last = chartParts[chartParts.length - 1];

      if (last === "latest") {
        const programSlug = toCanonicalProgramSlug(chartParts.slice(0, -1));
        const resolved = await repo.resolveProgramSlug(programSlug);
        const program = await repo.getProgram(programSlug);
        if (!program) return error(res, 404, "chart_program_not_found", "Chart program not found.", { requestedSlug: programSlug });

        const edition = await repo.getLatestNonEmptyEdition(program);
        if (!edition) return error(res, 404, "chart_edition_not_found", "No non-empty latest edition found.", resolved);
        const entries = await repo.listEntries(program, str(edition, "edition_slug"));
        return json(res, 200, envelope({ program: await toProgram(repo, program), edition: await toEditionSummary(edition), entries: entries.map(toEntry) }, resolved));
      }

      const hasEntriesSuffix = last === "entries";
      const candidateParts = hasEntriesSuffix ? chartParts.slice(0, -1) : chartParts;
      const candidateLast = candidateParts[candidateParts.length - 1];
      const hasEdition = candidateParts.length >= 2 && isEditionSlug(candidateLast);

      const editionSlug = hasEdition ? candidateLast : "";
      const programSlug = toCanonicalProgramSlug(hasEdition ? candidateParts.slice(0, -1) : candidateParts, editionSlug || undefined);

      const resolved = await repo.resolveProgramSlug(programSlug);
      const program = await repo.getProgram(programSlug);
      if (!program) return error(res, 404, "chart_program_not_found", "Chart program not found.", { requestedSlug: programSlug });

      if (!hasEdition) {
        return json(res, 200, envelope({ program: await toProgram(repo, program) }, resolved));
      }

      const edition = await repo.getEdition(program, editionSlug);
      if (!edition) return error(res, 404, "chart_edition_not_found", "Chart edition not found.", { ...resolved, editionSlug });
      const entries = await repo.listEntries(program, editionSlug);

      if (hasEntriesSuffix) {
        const limit = Math.min(Number(url.searchParams.get("limit") ?? entries.length) || entries.length, 200);
        const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
        return json(res, 200, envelope({ entries: entries.slice(offset, offset + limit).map(toEntry) }, { ...resolved, editionSlug, count: entries.length, limit, offset }));
      }

      const methodology = await repo.getMethodology(str(program, "default_methodology_version"));
      const eligibilityRules = await repo.getEligibilityRules(str(program, "default_eligibility_rules_version"));
      const sourceCoverage = await repo.listSourceCoverage(str(edition, "id"));
      const warnings = entries.length === 0 ? ["This edition has no chart entries and is marked for content QA review."] : [];
      return json(res, 200, envelope({
        program: await toProgram(repo, program),
        edition: await toEditionSummary(edition),
        entries: entries.map(toEntry),
        methodology,
        eligibilityRules,
        sourceCoverage,
      }, { ...resolved, editionSlug, warnings }));
    }

    if (parts.length === 3 && parts[0] === "tracks" && parts[2] === "chart-history") {
      const history = await repo.getTrackHistory(parts[1]);
      return json(res, 200, envelope({ history }, { trackSlug: parts[1] }));
    }

    return error(res, 404, "not_found", "Route not found.");
  } catch (err) {
    return error(res, 500, "wakilisha_public_api_error", err instanceof Error ? err.message : "Unknown public API server error.");
  }
}

async function startServer(): Promise<void> {
  if (repo.kind === "database") {
    const dbOk = await repo.testConnection();
    if (!dbOk) {
      console.error("[WAKILISHA API] Database connection failed. Cannot start.");
      console.error(`[WAKILISHA API] DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "not set"}`);
      process.exit(1);
    }
    console.log("[WAKILISHA API] Database connection verified.");
  }

  const server = http.createServer((req, res) => {
    void route(req, res);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[WAKILISHA API] Port ${port} is already in use.`);
      process.exitCode = 1;
      return;
    }
    console.error("[WAKILISHA API] Server failed to start:", err.message);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    const addr = `http://${host ?? "localhost"}:${port}`;
    console.log(`[WAKILISHA API] Listening on ${addr}/api/v1`);
    console.log(`[WAKILISHA API] Repository mode: ${repo.kind}`);
  });
}

startServer().catch((err) => {
  console.error("[WAKILISHA API] Fatal startup error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
