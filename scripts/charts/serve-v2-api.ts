import http from "node:http";
import { URL } from "node:url";
import {
  createV2Repository,
  programId,
  type V2Repository,
} from "./v2-api-repository";

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

const port = Number(process.env.WAKILISHA_V2_API_PORT ?? 4175);
const repo = createV2Repository();

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
  const series = await repository.getSeries(str(program, "series_slug"));
  const market = await repository.getMarket(str(program, "market_slug"));
  const archive = (await repository.listEditionsForProgram(program)).filter((edition) => numberValue(edition, "entry_count") > 0);
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
      apiVersion: "v2",
      generatedAt: new Date().toISOString(),
      source: `chart-v2-${repo.kind}-repository`,
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
  });
  res.end(JSON.stringify(body, null, 2));
}

function error(res: http.ServerResponse, status: number, code: string, message: string, meta: Record<string, unknown> = {}) {
  json(res, status, { code, message, status, meta });
}

async function route(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    if (req.method !== "GET") return error(res, 405, "method_not_allowed", "Only GET is supported.");
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const prefix = "/wp-json/wakilisha/v2";
    if (!url.pathname.startsWith(prefix)) return error(res, 404, "not_found", "Route not found.");
    const parts = url.pathname.slice(prefix.length).split("/").filter(Boolean).map(decodeURIComponent);

    if (parts.join("/") === "charts/health") {
      return json(res, 200, envelope({
        ok: true,
        plugin: "wakilisha-react-local-v2-api",
        version: "0.1.0",
        charts_public: true,
        charts_v2: true,
        repository: repo.kind,
        counts: repo.getCounts(),
        migrationReadiness: repo.getMigrationReadiness(),
      }));
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
      const resolved = await repo.resolveProgramSlug(parts[1]);
      const program = await repo.getProgram(parts[1]);
      if (!program) return error(res, 404, "chart_program_not_found", "Chart program not found.", { requestedSlug: parts[1] });

      if (parts.length === 2) {
        return json(res, 200, envelope({ program: await toProgram(repo, program) }, resolved));
      }

      if (parts.length === 3 && parts[2] === "latest") {
        const edition = await repo.getLatestNonEmptyEdition(program);
        if (!edition) return error(res, 404, "chart_edition_not_found", "No non-empty latest edition found.", resolved);
        const entries = await repo.listEntries(program, str(edition, "edition_slug"));
        return json(res, 200, envelope({ program: await toProgram(repo, program), edition: await toEditionSummary(edition), entries: entries.map(toEntry) }, resolved));
      }

      const editionSlug = parts[2];
      const edition = await repo.getEdition(program, editionSlug);
      if (!edition) return error(res, 404, "chart_edition_not_found", "Chart edition not found.", { ...resolved, editionSlug });
      const entries = await repo.listEntries(program, editionSlug);

      if (parts.length === 4 && parts[3] === "entries") {
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

    if (parts.length === 4 && parts[0] === "tracks" && parts[2] === "chart-history") {
      const history = await repo.getTrackHistory(parts[1]);
      return json(res, 200, envelope({ history }, { trackSlug: parts[1] }));
    }

    return error(res, 404, "not_found", "Route not found.");
  } catch (err) {
    return error(res, 500, "chart_v2_server_error", err instanceof Error ? err.message : "Unknown V2 API server error.");
  }
}

const server = http.createServer((req, res) => {
  void route(req, res);
});

server.listen(port, () => {
  console.log(`WAKILISHA Chart V2 local read-only API listening on http://localhost:${port}/wp-json/wakilisha/v2`);
  console.log(`Repository mode: ${repo.kind}`);
  console.log("No database writes. No public JSON mutation.");
});
