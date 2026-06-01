import fs from "node:fs";
import path from "node:path";

type FixtureProgram = {
  publicSlug: string;
  publicLabel: string;
  sourceFamilySlug?: string | null;
  latestEdition?: { slug: string; entryCount: number } | null;
};

type Fixtures = {
  generatedAt: string;
  endpoints: Record<string, string>;
  counts: { programs: number; editions: number; entries: number; aliases: number };
  responses: {
    listPrograms: { data: { programs?: FixtureProgram[] } | FixtureProgram[]; meta?: Record<string, unknown> };
    latestExamples: { endpoint: string; program: FixtureProgram; edition: { slug: string; entryCount: number } | null; entries: unknown[] }[];
    aliasExamples: { legacySlug?: string; canonicalSlug?: string; entityType?: string; redirectStatus?: string }[];
  };
};

type Check = {
  id: string;
  status: "pass" | "fail" | "warning" | "skipped";
  title: string;
  detail: string;
  endpoint?: string;
  durationMs?: number;
};

const root = process.cwd();
const reportsDir = path.join(root, "reports");
const fixturesPath = path.join(reportsDir, "chart-v2-api-fixtures.json");
const jsonReportPath = path.join(reportsDir, "chart-v2-live-api-smoke.json");
const mdReportPath = path.join(reportsDir, "chart-v2-live-api-smoke.md");

const liveBase = (process.env.WAKILISHA_V2_LIVE_API_BASE ?? "").replace(/\/+$/, "");
const shouldRunLive = process.env.WAKILISHA_V2_LIVE_API_SMOKE === "1" && Boolean(liveBase);
const timeoutMs = Number(process.env.WAKILISHA_V2_LIVE_API_TIMEOUT_MS ?? 30000);

function readJsonFile<T>(filepath: string): T {
  if (!fs.existsSync(filepath)) throw new Error(`Missing required file: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function fixturePrograms(fixtures: Fixtures): FixtureProgram[] {
  const data = fixtures.responses.listPrograms.data;
  return Array.isArray(data) ? data : data.programs ?? [];
}

function add(checks: Check[], check: Check) {
  checks.push(check);
}

function endpointUrl(endpoint: string): string {
  return `${liveBase}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

function normalizeEnvelope(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) return (body as { data: unknown }).data;
  return body;
}

function getProgramsFromLive(body: unknown): unknown[] {
  const data = normalizeEnvelope(body);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { programs?: unknown[] }).programs)) {
    return (data as { programs: unknown[] }).programs;
  }
  return [];
}

function getEntriesFromLive(body: unknown): unknown[] {
  const data = normalizeEnvelope(body);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { entries?: unknown[] }).entries)) {
    return (data as { entries: unknown[] }).entries;
  }
  return [];
}

function getEditionFromLive(body: unknown): Record<string, unknown> | null {
  const data = normalizeEnvelope(body);
  if (data && typeof data === "object" && (data as { edition?: unknown }).edition && typeof (data as { edition?: unknown }).edition === "object") {
    return (data as { edition: Record<string, unknown> }).edition;
  }
  if (data && typeof data === "object" && "slug" in data) return data as Record<string, unknown>;
  return null;
}

async function fetchJson(endpoint: string): Promise<{ ok: boolean; status: number; body: unknown; durationMs: number; error?: string }> {
  const controller = new AbortController();
  const started = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpointUrl(endpoint), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 1000) };
      }
    }
    return { ok: res.ok, status: res.status, body, durationMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Unknown network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

fs.mkdirSync(reportsDir, { recursive: true });

const fixtures = readJsonFile<Fixtures>(fixturesPath);
const checks: Check[] = [];

if (!shouldRunLive) {
  add(checks, {
    id: "LIVE-000",
    status: "skipped",
    title: "Live V2 API smoke test skipped",
    detail: "Set WAKILISHA_V2_LIVE_API_SMOKE=1 and WAKILISHA_V2_LIVE_API_BASE=https://example.com/wp-json/wakilisha/v2 to run live checks.",
  });
} else {
  const health = await fetchJson("/charts/health");
  add(checks, {
    id: "LIVE-001",
    status: health.ok ? "pass" : "fail",
    title: "Health endpoint responds",
    detail: health.ok ? `HTTP ${health.status}` : `HTTP ${health.status}; ${health.error ?? JSON.stringify(health.body).slice(0, 300)}`,
    endpoint: "/charts/health",
    durationMs: health.durationMs,
  });

  const programsRes = await fetchJson("/charts");
  const livePrograms = getProgramsFromLive(programsRes.body);
  add(checks, {
    id: "LIVE-002",
    status: programsRes.ok && livePrograms.length === fixtures.counts.programs ? "pass" : "fail",
    title: "Program list count matches fixture contract",
    detail: `live=${livePrograms.length}; fixture=${fixtures.counts.programs}; HTTP ${programsRes.status}`,
    endpoint: "/charts",
    durationMs: programsRes.durationMs,
  });

  const programs = fixturePrograms(fixtures).slice(0, 4);
  let counter = 3;
  for (const program of programs) {
    const latestEndpoint = `/charts/${program.publicSlug}/latest`;
    const latestRes = await fetchJson(latestEndpoint);
    const edition = getEditionFromLive(latestRes.body);
    const expectedLatest = fixtures.responses.latestExamples.find((example) => example.program.publicSlug === program.publicSlug)?.edition;
    add(checks, {
      id: `LIVE-${String(counter++).padStart(3, "0")}`,
      status: latestRes.ok && (!expectedLatest || edition?.slug === expectedLatest.slug) ? "pass" : "fail",
      title: `Latest edition matches fixture for ${program.publicSlug}`,
      detail: `live=${edition?.slug ?? "none"}; fixture=${expectedLatest?.slug ?? "none"}; HTTP ${latestRes.status}`,
      endpoint: latestEndpoint,
      durationMs: latestRes.durationMs,
    });

    if (expectedLatest) {
      const entriesEndpoint = `/charts/${program.publicSlug}/${expectedLatest.slug}/entries`;
      const entriesRes = await fetchJson(entriesEndpoint);
      const entries = getEntriesFromLive(entriesRes.body);
      add(checks, {
        id: `LIVE-${String(counter++).padStart(3, "0")}`,
        status: entriesRes.ok && entries.length === expectedLatest.entryCount ? "pass" : "fail",
        title: `Edition entry count matches fixture for ${program.publicSlug}/${expectedLatest.slug}`,
        detail: `live=${entries.length}; fixture=${expectedLatest.entryCount}; HTTP ${entriesRes.status}`,
        endpoint: entriesEndpoint,
        durationMs: entriesRes.durationMs,
      });
    }
  }

  const alias = fixtures.responses.aliasExamples.find((item) => item.legacySlug && item.canonicalSlug && item.legacySlug !== item.canonicalSlug);
  if (alias?.legacySlug) {
    const aliasEndpoint = `/charts/resolve/${alias.legacySlug}`;
    const aliasRes = await fetchJson(aliasEndpoint);
    const text = JSON.stringify(aliasRes.body);
    add(checks, {
      id: `LIVE-${String(counter++).padStart(3, "0")}`,
      status: aliasRes.ok && text.includes(String(alias.canonicalSlug)) ? "pass" : "fail",
      title: "Legacy alias resolves to canonical slug",
      detail: `legacy=${alias.legacySlug}; expected=${alias.canonicalSlug}; HTTP ${aliasRes.status}`,
      endpoint: aliasEndpoint,
      durationMs: aliasRes.durationMs,
    });
  }
}

const summary = {
  pass: checks.filter((check) => check.status === "pass").length,
  fail: checks.filter((check) => check.status === "fail").length,
  warning: checks.filter((check) => check.status === "warning").length,
  skipped: checks.filter((check) => check.status === "skipped").length,
};

const report = {
  generatedAt: new Date().toISOString(),
  mode: shouldRunLive ? "live-api-smoke" : "no-network-skipped",
  liveBase: liveBase || null,
  timeoutMs,
  fixtureSource: path.relative(root, fixturesPath),
  summary,
  checks,
};

const md = `# Chart V2 Live API Smoke Test

Generated: ${report.generatedAt}

Mode: **${report.mode}**

Live base: ${liveBase ? `\`${liveBase}\`` : "Not configured"}

Fixture source: \`${report.fixtureSource}\`

## Summary

| Status | Count |
| --- | ---: |
| Pass | ${summary.pass} |
| Warning | ${summary.warning} |
| Fail | ${summary.fail} |
| Skipped | ${summary.skipped} |

## Checks

| ID | Status | Check | Endpoint | Detail |
| --- | --- | --- | --- | --- |
${checks.map((check) => `| ${check.id} | ${check.status.toUpperCase()} | ${check.title} | ${check.endpoint ? `\`${check.endpoint}\`` : "—"} | ${check.detail.replace(/\|/g, "\\|")} |`).join("\n")}

## How to run live checks

\`WAKILISHA_V2_LIVE_API_SMOKE=1 WAKILISHA_V2_LIVE_API_BASE=https://example.com/wp-json/wakilisha/v2 npm run charts:v2-live-smoke\`

By default this script does not call the network. It is safe to run in CI before the backend exists.
`;

fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(mdReportPath, md);

console.log("Chart V2 live API smoke report generated");
console.log(`Mode: ${report.mode}`);
console.log(`Checks: ${summary.pass} pass, ${summary.warning} warning, ${summary.fail} fail, ${summary.skipped} skipped`);
console.log(`JSON: ${path.relative(root, jsonReportPath)}`);
console.log(`Markdown: ${path.relative(root, mdReportPath)}`);
if (summary.fail > 0) process.exitCode = 1;
