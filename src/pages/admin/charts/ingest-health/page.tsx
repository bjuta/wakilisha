import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  testWordPressConnection,
  WP_API_BASE,
  getIngestionMode,
  INGEST_STUDIO_WP_ENDPOINTS,
  WORDPRESS_CHART_ENDPOINTS,
} from "@/services/chartsIngestion/client";
import type { IngestStudioEndpointDef } from "@/services/chartsIngestion/client";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";

type TestStatus = "idle" | "running" | "ok" | "error";
interface HealthResult { ok: boolean; plugin: string; charts_ingestion: boolean; version: string; }
interface EndpointTestResult {
  key: string;
  status: "untested" | "ok" | "not_implemented" | "error";
  statusCode?: number;
  durationMs?: number;
  message?: string;
}

const PROVIDER_HEALTH = [
  {
    key: "spotify",
    label: "Spotify Web API",
    icon: "ri-spotify-fill",
    color: "#1DB954",
    envVars: ["VITE_SPOTIFY_CLIENT_ID", "VITE_SPOTIFY_CLIENT_SECRET"],
    status: "mock" as const,
    statusLabel: "Mock mode — credentials server-side only",
  },
  {
    key: "apple_music",
    label: "Apple Music API",
    icon: "ri-apple-fill",
    color: "",
    envVars: ["VITE_APPLE_MUSIC_DEVELOPER_TOKEN"],
    status: "mock" as const,
    statusLabel: "Mock mode — developer token required",
  },
  {
    key: "registry",
    label: "Registry DB",
    icon: "ri-database-2-line",
    color: "",
    envVars: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
    status: "not_connected" as const,
    statusLabel: "Supabase not connected",
  },
];

const METHOD_COLOR_MAP: Record<string, string> = {
  GET: "bg-wk-success-soft text-wk-success",
  POST: "bg-wk-brand-soft text-wk-brand",
  PATCH: "bg-wk-warning-soft text-wk-warning",
  DELETE: "bg-wk-danger-soft text-wk-danger",
  PUT: "bg-wk-info-soft text-wk-info",
};

export default function AdminChartsIngestHealth() {
  const navigate = useNavigate();
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
      const status: EndpointTestResult["status"] =
        res.status === 404 ? "not_implemented" :
        res.status >= 200 && res.status < 500 ? "ok" : "error";
      setEndpointResults((prev) => ({ ...prev, [key]: { key, status, statusCode: res.status, durationMs: duration } }));
    } catch (err) {
      setEndpointResults((prev) => ({
        ...prev,
        [key]: { key, status: "error", durationMs: Date.now() - t0, message: err instanceof Error ? err.message : "Network error" },
      }));
    }
  }, [apiBase]);

  const probeAll = useCallback(async () => {
    setProbingAll(true);
    const allEndpoints = [
      ...INGEST_STUDIO_WP_ENDPOINTS.map((e) => ({ key: e.key, path: e.path, method: e.method })),
      ...Object.values(WORDPRESS_CHART_ENDPOINTS).map((e) => ({ key: e.key, path: e.path, method: e.method })),
    ];
    for (const ep of allEndpoints) {
      await probeEndpoint(ep.path, ep.method, ep.key);
      await new Promise((r) => setTimeout(r, 80));
    }
    setProbingAll(false);
  }, [probeEndpoint]);

  const ingestStudioGroups = INGEST_STUDIO_WP_ENDPOINTS.reduce<Record<string, IngestStudioEndpointDef[]>>((acc, ep) => {
    acc[ep.group] = acc[ep.group] ? [...acc[ep.group], ep] : [ep];
    return acc;
  }, {});

  const allEndpointCount = INGEST_STUDIO_WP_ENDPOINTS.length + Object.keys(WORDPRESS_CHART_ENDPOINTS).length;
  const testedCount = Object.keys(endpointResults).length;
  const okCount = Object.values(endpointResults).filter((r) => r.status === "ok").length;
  const notImplCount = Object.values(endpointResults).filter((r) => r.status === "not_implemented").length;
  const errorCount = Object.values(endpointResults).filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      <AdminChartsPageHeader
        eyebrow="System"
        title="API Health"
        description="Provider and backend health. Diagnose configuration issues and probe live endpoints."
      >
        <button
          onClick={runHealthCheck}
          disabled={testStatus === "running"}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <i className={testStatus === "running" ? "ri-loader-4-line animate-spin" : "ri-heart-pulse-line"} />
          {testStatus === "running" ? "Testing…" : "Health Check"}
        </button>
        {mode === "wordpress" && (
          <button
            onClick={probeAll}
            disabled={probingAll}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap disabled:opacity-50"
          >
            <i className={probingAll ? "ri-loader-4-line animate-spin" : "ri-radar-line"} />
            {probingAll ? "Probing…" : `Probe All (${allEndpointCount})`}
          </button>
        )}
      </AdminChartsPageHeader>

      {/* Mode configuration */}
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-wk-text">Current Configuration</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">Ingestion Mode</p>
            <div className="flex items-center gap-2">
              <AdminChartsStatusBadge status={mode === "wordpress" ? "ready" : "mocked"} />
              <span className="text-[13px] font-semibold text-wk-text">{mode === "wordpress" ? "WordPress" : "Mock (Dev)"}</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">API Base</p>
            <p className="font-mono text-[12px] text-wk-text-soft break-all">{apiBase}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">REST Nonce</p>
            <p className={`font-mono text-[12px] ${
              typeof window !== "undefined" && (window as Record<string, string>).WAKILISHA_REST_NONCE
                ? "text-wk-success"
                : "text-wk-danger"
            }`}>
              {typeof window !== "undefined" && (window as Record<string, string>).WAKILISHA_REST_NONCE
                ? "Injected"
                : "Missing — auth will fail (VITE_WAKILISHA_WP_NONCE or wp_localize_script required)"}
            </p>
          </div>
        </div>
      </WkSurface>

      {/* Health check result */}
      {testStatus !== "idle" && (
        <WkSurface className={`p-4 border-l-4 ${
          testStatus === "ok" ? "border-l-wk-success" :
          testStatus === "error" ? "border-l-wk-danger" :
          "border-l-wk-border"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <i className={
              testStatus === "running" ? "ri-loader-4-line animate-spin text-wk-info" :
              testStatus === "ok" ? "ri-check-double-line text-wk-success" :
              "ri-error-warning-line text-wk-danger"
            } />
            <h2 className="text-[14px] font-bold text-wk-text">
              {testStatus === "running" ? "Testing connection…" :
               testStatus === "ok" ? "Connection successful" : "Connection failed"}
            </h2>
            {healthDuration != null && (
              <span className="ml-auto text-[11px] text-wk-text-faint">{healthDuration}ms</span>
            )}
          </div>
          {healthResult && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Plugin", value: healthResult.plugin || "—" },
                { label: "Version", value: healthResult.version || "—" },
                { label: "Charts Ingestion", value: healthResult.charts_ingestion ? "Enabled" : "Disabled", error: !healthResult.charts_ingestion },
                { label: "Status", value: "OK", success: true },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-wk-surface-raised p-2.5">
                  <p className="text-[10px] text-wk-text-faint">{item.label}</p>
                  <p className={`text-[12px] font-semibold ${item.success ? "text-wk-success" : item.error ? "text-wk-danger" : "text-wk-text"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
          {healthError && (
            <div className="mt-2 rounded bg-wk-danger-soft p-3">
              <p className="font-mono text-[12px] text-wk-danger">{healthError}</p>
              <div className="mt-2 text-[11px] text-wk-text-muted space-y-1">
                <p><strong>Check:</strong> VITE_WAKILISHA_WP_API_BASE is set correctly</p>
                <p><strong>Check:</strong> WordPress site is reachable from this origin</p>
                <p><strong>Check:</strong> CORS allows this domain in the WP plugin settings</p>
              </div>
            </div>
          )}
        </WkSurface>
      )}

      {/* Provider health */}
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-wk-text">Provider Credentials</h2>
        <div className="space-y-3">
          {PROVIDER_HEALTH.map((provider) => (
            <div key={provider.key} className="flex items-center justify-between rounded-lg border border-wk-border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-surface-raised">
                  <i className={`${provider.icon} text-[16px]`} style={{ color: provider.color || undefined }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-wk-text">{provider.label}</p>
                  <p className="text-[11px] text-wk-text-muted">
                    {provider.envVars.map((v) => <code key={v} className="mr-1">{v}</code>)}
                  </p>
                </div>
              </div>
              <AdminChartsStatusBadge status="mocked" size="sm" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-wk-surface-raised p-3">
          <p className="text-[12px] font-semibold text-wk-text mb-2">Add to .env.local for real provider fetch:</p>
          <pre className="text-[11px] text-wk-text-soft overflow-x-auto">{`VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
VITE_APPLE_MUSIC_DEVELOPER_TOKEN=your_apple_developer_token`}</pre>
          <p className="mt-2 text-[11px] text-wk-text-muted">Restart dev server after adding. In production, store credentials server-side as WP options or edge function secrets.</p>
        </div>
      </WkSurface>

      {/* Probe summary */}
      {testedCount > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AdminChartsKpiCard value={`${testedCount}/${allEndpointCount}`} label="Probed" icon="ri-radar-line" accent="muted" />
          <AdminChartsKpiCard value={okCount} label="Responding" icon="ri-check-line" accent="success" />
          <AdminChartsKpiCard value={notImplCount} label="Not Implemented" icon="ri-question-line" accent={notImplCount > 0 ? "warning" : "muted"} />
          <AdminChartsKpiCard value={errorCount} label="Errors" icon="ri-error-warning-line" accent={errorCount > 0 ? "danger" : "muted"} />
        </div>
      )}

      {/* Sprint 2 endpoints */}
      <WkSurface className="overflow-hidden">
        <div className="border-b border-wk-border p-4">
          <h2 className="text-[14px] font-bold text-wk-text">Sprint 2 — Ingest Studio Endpoints</h2>
          <p className="text-[12px] text-wk-text-muted mt-1">Provider-based run pipeline endpoints</p>
        </div>
        {Object.entries(ingestStudioGroups).map(([group, endpoints]) => (
          <div key={group}>
            <div className="border-b border-wk-border bg-wk-surface-raised/50 px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">{group}</p>
            </div>
            <table className="w-full text-left text-[13px]">
              <tbody>
                {endpoints.map((ep) => (
                  <EndpointRow
                    key={ep.key}
                    method={ep.method}
                    path={ep.path}
                    description={ep.description}
                    result={endpointResults[ep.key]}
                    onProbe={() => probeEndpoint(ep.path, ep.method, ep.key)}
                    disabled={mode === "mock"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </WkSurface>

      {/* Sprint 1 legacy endpoints */}
      <WkSurface className="overflow-hidden">
        <div className="border-b border-wk-border p-4">
          <h2 className="text-[14px] font-bold text-wk-text">Sprint 1 — Legacy Ingest Job Endpoints</h2>
          <p className="text-[12px] text-wk-text-muted mt-1">CSV + source-based job pipeline (legacy)</p>
        </div>
        <table className="w-full text-left text-[13px]">
          <tbody>
            {Object.values(WORDPRESS_CHART_ENDPOINTS).map((ep) => (
              <EndpointRow
                key={ep.key}
                method={ep.method}
                path={ep.path}
                description={ep.description}
                result={endpointResults[ep.key]}
                onProbe={() => probeEndpoint(ep.path, ep.method, ep.key)}
                disabled={mode === "mock"}
              />
            ))}
          </tbody>
        </table>
      </WkSurface>

      {/* Backend dev notes */}
      <WkSurface className="p-5">
        <h2 className="mb-3 text-[14px] font-bold text-wk-text">Backend Developer Notes</h2>
        <div className="space-y-3 text-[13px] text-wk-text-soft">
          <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
            <p className="font-semibold text-wk-text mb-1">Authentication</p>
            <p className="text-[12px]">All endpoints require WP auth. Frontend sends <code>X-WP-Nonce</code> from <code>window.WAKILISHA_REST_NONCE</code>. Inject via <code>wp_localize_script</code>.</p>
          </div>
          <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
            <p className="font-semibold text-wk-text mb-1">Error Shape (required)</p>
            <pre className="overflow-x-auto rounded bg-wk-surface p-2 font-mono text-[11px] text-wk-text-muted mt-1">{`{ "error": "Human-readable message", "code": "machine_code", "retryable": false }`}</pre>
            <p className="text-[11px] text-wk-text-muted mt-2">Never return generic "failed" — always include the specific reason (missing config, auth failure, rate limit, etc.)</p>
          </div>
          <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-3">
            <p className="font-semibold text-wk-text mb-1">Required Capabilities</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {["read_wakilisha_charts", "edit_wakilisha_charts", "create_wakilisha_charts", "publish_wakilisha_charts", "delete_wakilisha_charts"].map((cap) => (
                <code key={cap} className="rounded bg-wk-surface px-1.5 py-0.5 text-[10px] font-mono text-wk-text-muted">{cap}</code>
              ))}
            </div>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}

interface EndpointRowProps {
  method: string;
  path: string;
  description: string;
  result: EndpointTestResult | undefined;
  onProbe: () => void;
  disabled?: boolean;
}

function EndpointRow({ method, path, description, result, onProbe, disabled }: EndpointRowProps) {
  const statusIcon = !result ? "ri-circle-line text-wk-text-faint" :
    result.status === "ok" ? "ri-check-line text-wk-success" :
    result.status === "not_implemented" ? "ri-question-line text-wk-warning" :
    "ri-close-line text-wk-danger";

  const statusLabel = !result ? "—" :
    result.status === "ok" ? `${result.statusCode} OK` :
    result.status === "not_implemented" ? "404 Not Implemented" :
    result.message?.substring(0, 28) ?? "Error";

  return (
    <tr className="border-b border-wk-border/50 hover:bg-wk-surface-raised/40 transition-colors">
      <td className="w-8 px-4 py-2.5">
        <i className={`text-[14px] ${statusIcon}`} />
      </td>
      <td className="px-2 py-2.5 w-14">
        <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLOR_MAP[method] ?? "bg-wk-surface-raised text-wk-text-muted"}`}>
          {method}
        </span>
      </td>
      <td className="px-2 py-2.5 min-w-[240px]">
        <p className="font-mono text-[11px] text-wk-text-soft break-all">{path}</p>
        <p className="text-[11px] text-wk-text-faint">{description}</p>
      </td>
      <td className="px-2 py-2.5 w-32">
        <span className={`text-[11px] font-semibold ${
          !result ? "text-wk-text-faint" :
          result.status === "ok" ? "text-wk-success" :
          result.status === "not_implemented" ? "text-wk-warning" :
          "text-wk-danger"
        }`}>
          {statusLabel}
          {result?.durationMs != null && (
            <span className="ml-1 text-[10px] text-wk-text-faint">{result.durationMs}ms</span>
          )}
        </span>
      </td>
      <td className="px-2 py-2.5 w-14">
        <button
          onClick={onProbe}
          disabled={disabled}
          className="rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap disabled:opacity-30"
          title={disabled ? "Probe only available in WordPress mode" : "Probe this endpoint"}
        >
          Probe
        </button>
      </td>
    </tr>
  );
}