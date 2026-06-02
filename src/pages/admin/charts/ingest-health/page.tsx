import { useState, useCallback } from "react";
import {
  testWordPressConnection,
  WP_API_BASE,
  getIngestionMode,
  INGEST_STUDIO_WP_ENDPOINTS,
  WORDPRESS_CHART_ENDPOINTS,
} from "@/services/chartsIngestion/client";
import type { IngestStudioEndpointDef } from "@/services/chartsIngestion/client";
import { WkSurface } from "@/components/design-system/primitives/Surface";

type TestStatus = "idle" | "running" | "ok" | "error";

interface HealthResult {
  ok: boolean;
  plugin: string;
  charts_ingestion: boolean;
  version: string;
}

interface EndpointTestResult {
  key: string;
  status: "untested" | "ok" | "not_implemented" | "error";
  statusCode?: number;
  durationMs?: number;
  message?: string;
}

export default function AdminChartsIngestHealth() {
  const mode = getIngestionMode();
  const apiBase = WP_API_BASE;

  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthDuration, setHealthDuration] = useState<number | null>(null);

  const [endpointResults, setEndpointResults] = useState<Record<string, EndpointTestResult>>({});
  const [probingAll, setProbingAll] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setTestStatus("running");
    setHealthResult(null);
    setHealthError(null);
    const t0 = Date.now();
    try {
      const result = await testWordPressConnection();
      setHealthResult(result);
      setTestStatus("ok");
      setHealthDuration(Date.now() - t0);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Connection failed");
      setTestStatus("error");
      setHealthDuration(Date.now() - t0);
    }
  }, []);

  const probeEndpoint = useCallback(async (path: string, method: string, key: string) => {
    const t0 = Date.now();
    const baseOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${baseOrigin}${path.startsWith("http") ? path.replace(/^https?:\/\/[^/]+/, "") : path.replace("/wp-json/wakilisha/v1", apiBase)}`;

    try {
      const res = await fetch(fullUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal: AbortSignal.timeout(10000),
      });

      const duration = Date.now() - t0;
      const statusCode = res.status;

      // 404 = endpoint doesn't exist on backend
      // 401/403 = endpoint exists but auth required (which is fine)
      // 200 = great
      // 500 = endpoint exists but threw server error

      const status: EndpointTestResult["status"] =
        statusCode === 404 ? "not_implemented" :
        statusCode >= 200 && statusCode < 500 ? "ok" :
        "error";

      setEndpointResults((prev) => ({
        ...prev,
        [key]: { key, status, statusCode, durationMs: duration },
      }));
    } catch (err) {
      const duration = Date.now() - t0;
      setEndpointResults((prev) => ({
        ...prev,
        [key]: {
          key,
          status: "error",
          durationMs: duration,
          message: err instanceof Error ? err.message : "Network error",
        },
      }));
    }
  }, [apiBase]);

  const probeAll = useCallback(async () => {
    setProbingAll(true);
    const allEndpoints: { key: string; path: string; method: string }[] = [
      ...INGEST_STUDIO_WP_ENDPOINTS.map((e) => ({ key: e.key, path: e.path, method: e.method })),
      ...Object.values(WORDPRESS_CHART_ENDPOINTS).map((e) => ({ key: e.key, path: e.path, method: e.method })),
    ];
    for (const ep of allEndpoints) {
      await probeEndpoint(ep.path, ep.method, ep.key);
      // small delay between requests to avoid flooding
      await new Promise((r) => setTimeout(r, 80));
    }
    setProbingAll(false);
  }, [probeEndpoint]);

  const ingestStudioGroups = INGEST_STUDIO_WP_ENDPOINTS.reduce<Record<string, IngestStudioEndpointDef[]>>((acc, ep) => {
    acc[ep.group] = acc[ep.group] ? [...acc[ep.group], ep] : [ep];
    return acc;
  }, {});

  const allEndpointCount =
    INGEST_STUDIO_WP_ENDPOINTS.length + Object.keys(WORDPRESS_CHART_ENDPOINTS).length;
  const testedCount = Object.keys(endpointResults).length;
  const okCount = Object.values(endpointResults).filter((r) => r.status === "ok").length;
  const notImplCount = Object.values(endpointResults).filter((r) => r.status === "not_implemented").length;
  const errorCount = Object.values(endpointResults).filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--wk-text)]">API Health &amp; Endpoint Map</h1>
          <p className="text-[13px] text-[var(--wk-text-muted)]">
            Verify WordPress plugin connectivity and probe all backend endpoints
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runHealthCheck}
            disabled={testStatus === "running"}
            className="wk-button wk-button-primary whitespace-nowrap disabled:opacity-50"
          >
            <i className={testStatus === "running" ? "ri-loader-4-line animate-spin" : "ri-heart-pulse-line"} />
            {testStatus === "running" ? "Testing..." : "Run Health Check"}
          </button>
          <button
            onClick={probeAll}
            disabled={probingAll}
            className="wk-button wk-button-ghost whitespace-nowrap disabled:opacity-50"
          >
            <i className={probingAll ? "ri-loader-4-line animate-spin" : "ri-radar-line"} />
            {probingAll ? "Probing..." : `Probe All (${allEndpointCount})`}
          </button>
        </div>
      </div>

      {/* Configuration */}
      <WkSurface className="p-4">
        <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">Configuration</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Mode</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-bold ${
                mode === "wordpress"
                  ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                  : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
              }`}>
                <i className={mode === "wordpress" ? "ri-check-line mr-1" : "ri-test-tube-line mr-1"} />
                {mode === "wordpress" ? "WordPress" : "Mock (Dev)"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">API Base</p>
            <p className="mt-1 font-mono text-[12px] text-[var(--wk-text-soft)] break-all">{apiBase}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Nonce</p>
            <p className="mt-1 font-mono text-[12px] text-[var(--wk-text-soft)]">
              {typeof window !== "undefined" && (window as unknown as Record<string, string>).WAKILISHA_REST_NONCE
                ? "Injected"
                : "Not set (auth may fail)"}
            </p>
          </div>
        </div>
      </WkSurface>

      {/* Health check result */}
      {testStatus !== "idle" && (
        <WkSurface className={`p-4 border-l-4 ${
          testStatus === "ok" ? "border-[var(--wk-success)]" :
          testStatus === "error" ? "border-[var(--wk-danger)]" :
          "border-[var(--wk-border)]"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <i className={
              testStatus === "running" ? "ri-loader-4-line animate-spin text-[var(--wk-info)]" :
              testStatus === "ok" ? "ri-check-double-line text-[var(--wk-success)]" :
              "ri-error-warning-line text-[var(--wk-danger)]"
            } />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">
              {testStatus === "running" ? "Testing connection..." :
               testStatus === "ok" ? "Connection successful" : "Connection failed"}
            </h2>
            {healthDuration != null && (
              <span className="ml-auto text-[11px] text-[var(--wk-text-faint)]">{healthDuration}ms</span>
            )}
          </div>

          {healthResult && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-[var(--wk-surface-raised)] p-2">
                <p className="text-[10px] text-[var(--wk-text-faint)]">Plugin</p>
                <p className="text-[12px] font-semibold text-[var(--wk-text)]">{healthResult.plugin || "—"}</p>
              </div>
              <div className="rounded-lg bg-[var(--wk-surface-raised)] p-2">
                <p className="text-[10px] text-[var(--wk-text-faint)]">Version</p>
                <p className="text-[12px] font-semibold text-[var(--wk-text)]">{healthResult.version || "—"}</p>
              </div>
              <div className="rounded-lg bg-[var(--wk-surface-raised)] p-2">
                <p className="text-[10px] text-[var(--wk-text-faint)]">Charts Ingestion</p>
                <p className={`text-[12px] font-semibold ${healthResult.charts_ingestion ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
                  {healthResult.charts_ingestion ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--wk-surface-raised)] p-2">
                <p className="text-[10px] text-[var(--wk-text-faint)]">Status</p>
                <p className="text-[12px] font-semibold text-[var(--wk-success)]">OK</p>
              </div>
            </div>
          )}

          {healthError && (
            <div className="mt-2 rounded bg-[var(--wk-danger-soft)] p-3">
              <p className="font-mono text-[12px] text-[var(--wk-danger)]">{healthError}</p>
              <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">
                Make sure <code className="rounded bg-[var(--wk-surface-raised)] px-1 py-0.5 font-mono">VITE_WAKILISHA_WP_API_BASE</code> is
                set correctly and the WordPress site is reachable. If running locally, ensure CORS allows this origin.
              </p>
            </div>
          )}
        </WkSurface>
      )}

      {/* Probe summary */}
      {testedCount > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <WkSurface className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Probed</p>
            <p className="mt-1 text-[20px] font-black text-[var(--wk-text)]">{testedCount} / {allEndpointCount}</p>
          </WkSurface>
          <WkSurface className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Responding</p>
            <p className="mt-1 text-[20px] font-black text-[var(--wk-success)]">{okCount}</p>
          </WkSurface>
          <WkSurface className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Not Implemented</p>
            <p className="mt-1 text-[20px] font-black text-[var(--wk-warning)]">{notImplCount}</p>
          </WkSurface>
          <WkSurface className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">Errors</p>
            <p className="mt-1 text-[20px] font-black text-[var(--wk-danger)]">{errorCount}</p>
          </WkSurface>
        </div>
      )}

      {/* Ingest Studio v2 endpoints */}
      <WkSurface className="overflow-hidden">
        <div className="border-b border-[var(--wk-border)] p-4">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Sprint 2 — Ingest Studio Endpoints</h2>
          <p className="text-[12px] text-[var(--wk-text-muted)]">Provider-based run pipeline endpoints</p>
        </div>
        {Object.entries(ingestStudioGroups).map(([group, endpoints]) => (
          <div key={group}>
            <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/50 px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{group}</p>
            </div>
            <table className="w-full text-left text-[13px]">
              <tbody>
                {endpoints.map((ep) => {
                  const result = endpointResults[ep.key];
                  return (
                    <EndpointRow
                      key={ep.key}
                      method={ep.method}
                      path={ep.path}
                      description={ep.description}
                      result={result}
                      onProbe={() => probeEndpoint(ep.path, ep.method, ep.key)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </WkSurface>

      {/* Legacy endpoints */}
      <WkSurface className="overflow-hidden">
        <div className="border-b border-[var(--wk-border)] p-4">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Sprint 1 — Legacy Ingest Job Endpoints</h2>
          <p className="text-[12px] text-[var(--wk-text-muted)]">Classic CSV + source-based job pipeline</p>
        </div>
        <div>
          <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/50 px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">All Legacy Endpoints</p>
          </div>
          <table className="w-full text-left text-[13px]">
            <tbody>
              {Object.values(WORDPRESS_CHART_ENDPOINTS).map((ep) => {
                const result = endpointResults[ep.key];
                return (
                  <EndpointRow
                    key={ep.key}
                    method={ep.method}
                    path={ep.path}
                    description={ep.description}
                    result={result}
                    onProbe={() => probeEndpoint(ep.path, ep.method, ep.key)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Sprint 3 Provider Credentials */}
      <WkSurface className="p-5">
        <h2 className="mb-3 text-[15px] font-bold text-[var(--wk-text)]">Provider Credentials (Sprint 3)</h2>
        <p className="mb-4 text-[12px] text-[var(--wk-text-muted)]">
          Real provider fetch requires credentials in <code className="rounded bg-[var(--wk-surface-raised)] px-1.5 py-0.5 text-[11px]">.env.local</code>.
          Without credentials, the system uses deterministic mock data based on the source URL hash.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] p-3">
            <div className="flex items-center gap-2">
              <i className="ri-spotify-fill text-[#1DB954]" />
              <div>
                <p className="text-[13px] font-semibold text-[var(--wk-text)]">Spotify Web API</p>
                <p className="text-[11px] text-[var(--wk-text-muted)]"><code>VITE_SPOTIFY_CLIENT_ID</code> + <code>VITE_SPOTIFY_CLIENT_SECRET</code></p>
              </div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">Mock mode — no env key visible in browser</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] p-3">
            <div className="flex items-center gap-2">
              <i className="ri-apple-fill" />
              <div>
                <p className="text-[13px] font-semibold text-[var(--wk-text)]">Apple Music API</p>
                <p className="text-[11px] text-[var(--wk-text-muted)]"><code>VITE_APPLE_MUSIC_DEVELOPER_TOKEN</code></p>
              </div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">Mock mode — no env key visible in browser</span>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[var(--wk-surface-raised)] p-3">
          <p className="text-[12px] font-semibold text-[var(--wk-text)]">Add to .env.local for real provider fetch:</p>
          <pre className="mt-1 text-[11px] text-[var(--wk-text-soft)] overflow-x-auto whitespace-pre-wrap">{`VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id\nVITE_SPOTIFY_CLIENT_SECRET=your_spotify_client_secret\nVITE_APPLE_MUSIC_DEVELOPER_TOKEN=your_apple_developer_token`}</pre>
          <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">Restart dev server after adding. In WordPress/backend mode, credentials are stored server-side as WP option or edge function secrets.</p>
        </div>
      </WkSurface>

      {/* Backend developer notes */}
      <WkSurface className="p-4">
        <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">Backend Developer Notes</h2>
        <div className="space-y-3 text-[13px] text-[var(--wk-text-soft)]">
          <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3">
            <p className="font-semibold text-[var(--wk-text)] mb-1">Authentication</p>
            <p>All endpoints require WordPress authentication. The frontend sends a <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">X-WP-Nonce</code> header populated from <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">window.WAKILISHA_REST_NONCE</code>. The plugin should inject this via <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">wp_localize_script</code>.</p>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3">
            <p className="font-semibold text-[var(--wk-text)] mb-1">Response Shape (Sprint 2 Runs)</p>
            <pre className="mt-1 overflow-x-auto rounded bg-[var(--wk-surface)] p-2 font-mono text-[11px] text-[var(--wk-text-muted)]">{`// GET /charts/ingest-runs
{ "runs": IngestRun[] }

// POST /charts/ingest-runs/dry-run
{ "runId": string, "status": IngestRunStatus, "stages": IngestStageStatus[], "summary": IngestRunSummary, "rows": IngestResolvedRow[] }

// POST /charts/ingest-runs/{runId}/commit  
{ "runId": string, "editionId": string, "editionSlug": string, "publicUrl": string, "status": "committed", "snapshotId": string, "integrity": { "ok": bool, "warnings": string[] } }`}</pre>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3">
            <p className="font-semibold text-[var(--wk-text)] mb-1">Error Shape</p>
            <pre className="mt-1 overflow-x-auto rounded bg-[var(--wk-surface)] p-2 font-mono text-[11px] text-[var(--wk-text-muted)]">{`{ "error": "Human-readable message", "code": "machine_code", "retryable": false }`}</pre>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3">
            <p className="font-semibold text-[var(--wk-text)] mb-1">Capabilities Required</p>
            <p>Register custom capabilities: <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">read_wakilisha_charts</code>, <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">edit_wakilisha_charts</code>, <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">create_wakilisha_charts</code>, <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">publish_wakilisha_charts</code>, <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">delete_wakilisha_charts</code>. Assign to <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">administrator</code> and <code className="bg-[var(--wk-surface)] rounded px-1 font-mono text-[11px]">editor</code> roles as appropriate.</p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}

// ─── Row sub-component ───

interface EndpointRowProps {
  method: string;
  path: string;
  description: string;
  result: EndpointTestResult | undefined;
  onProbe: () => void;
}

const METHOD_COLOR_MAP: Record<string, string> = {
  GET: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]",
  POST: "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]",
  PATCH: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]",
  DELETE: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]",
  PUT: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]",
};

function EndpointRow({ method, path, description, result, onProbe }: EndpointRowProps) {
  const statusIcon = !result ? "ri-circle-line text-[var(--wk-text-faint)]" :
    result.status === "ok" ? "ri-check-line text-[var(--wk-success)]" :
    result.status === "not_implemented" ? "ri-error-warning-line text-[var(--wk-warning)]" :
    "ri-close-line text-[var(--wk-danger)]";

  const statusLabel = !result ? "—" :
    result.status === "ok" ? `${result.statusCode} OK` :
    result.status === "not_implemented" ? "404 Not Impl." :
    result.message ? result.message.substring(0, 24) : "Error";

  return (
    <tr className="border-b border-[var(--wk-border)]/50 hover:bg-[var(--wk-surface-raised)]/40 transition-colors">
      <td className="w-8 px-4 py-2.5">
        <i className={`text-[14px] ${statusIcon}`} />
      </td>
      <td className="px-2 py-2.5 w-14">
        <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLOR_MAP[method] ?? "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
          {method}
        </span>
      </td>
      <td className="px-2 py-2.5 min-w-[260px]">
        <p className="font-mono text-[11px] text-[var(--wk-text-soft)] break-all">{path}</p>
        <p className="text-[11px] text-[var(--wk-text-muted)]">{description}</p>
      </td>
      <td className="px-2 py-2.5 w-28">
        <span className={`text-[11px] font-semibold ${
          !result ? "text-[var(--wk-text-faint)]" :
          result.status === "ok" ? "text-[var(--wk-success)]" :
          result.status === "not_implemented" ? "text-[var(--wk-warning)]" :
          "text-[var(--wk-danger)]"
        }`}>
          {statusLabel}
          {result?.durationMs != null && (
            <span className="ml-1 text-[10px] text-[var(--wk-text-faint)]">{result.durationMs}ms</span>
          )}
        </span>
      </td>
      <td className="px-2 py-2.5 w-14">
        <button
          onClick={onProbe}
          className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] transition-colors whitespace-nowrap"
        >
          Probe
        </button>
      </td>
    </tr>
  );
}