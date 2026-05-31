import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getEndpointGroups,
  getIngestionMode,
  testWordPressConnection,
  CHARTS_INGESTION_MODE,
} from "@/services/chartsIngestion/client";
import type { EndpointDefinition } from "@/services/chartsIngestion/client";

const STATUS_STYLES: Record<string, string> = {
  not_configured: "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)] border-[var(--wk-border)]",
  planned: "bg-[var(--wk-info-soft)] text-[var(--wk-info)] border-[var(--wk-info)]/20",
  mocked: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)] border-[var(--wk-warning)]/20",
  ready: "bg-[var(--wk-success-soft)] text-[var(--wk-success)] border-[var(--wk-success)]/20",
  deprecated: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)] border-[var(--wk-danger)]/20",
};

function DiagnosticsPanel() {
  const mode = getIngestionMode();
  const wpApiBase = import.meta.env.VITE_WAKILISHA_WP_API_BASE || "/wp-json/wakilisha/v1";
  const hasNonce = typeof window !== "undefined" && !!(window as unknown as Record<string, string>).WAKILISHA_REST_NONCE;
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    plugin: string;
    charts_ingestion: boolean;
    version: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setTestStatus("loading");
    setTestError(null);
    setTestResult(null);
    try {
      const result = await testWordPressConnection();
      setTestResult(result);
      setTestStatus("success");
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Unknown error");
      setTestStatus("error");
    }
  };

  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">
          <i className="ri-plug-line mr-1.5 text-[var(--wk-brand)]" />
          Backend Connectivity Diagnostics
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
            mode === "mock"
              ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)] border-[var(--wk-warning)]/20"
              : "bg-[var(--wk-success-soft)] text-[var(--wk-success)] border-[var(--wk-success)]/20"
          }`}
        >
          {mode}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md bg-[var(--wk-bg-subtle)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Current Mode</div>
          <div className="text-[13px] font-semibold text-[var(--wk-text)]">{mode}</div>
        </div>
        <div className="rounded-md bg-[var(--wk-bg-subtle)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">WP API Base</div>
          <div className="text-[12px] font-mono text-[var(--wk-text)] truncate" title={wpApiBase}>{wpApiBase}</div>
        </div>
        <div className="rounded-md bg-[var(--wk-bg-subtle)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">REST Nonce</div>
          <div className={`text-[13px] font-semibold ${hasNonce ? "text-[var(--wk-success)]" : "text-[var(--wk-text-faint)]"}`}>
            {hasNonce ? "Detected" : "Not detected"}
          </div>
        </div>
        <div className="rounded-md bg-[var(--wk-bg-subtle)] p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Last Test</div>
          <div className={`text-[13px] font-semibold ${
            testStatus === "success" ? "text-[var(--wk-success)]" :
            testStatus === "error" ? "text-[var(--wk-danger)]" :
            "text-[var(--wk-text-faint)]"
          }`}>
            {testStatus === "idle" ? "Not tested" :
             testStatus === "loading" ? "Testing..." :
             testStatus === "success" ? "Connected" :
             "Failed"}
          </div>
        </div>
      </div>

      {mode === "mock" && (
        <div className="rounded-md bg-[var(--wk-info-soft)]/30 border border-[var(--wk-info)]/20 p-3 flex items-start gap-2">
          <i className="ri-information-line text-[var(--wk-info)] mt-0.5" />
          <div className="text-[12px] text-[var(--wk-info)]">
            Currently running in <strong>mock mode</strong>. All data is stored in localStorage.
            Switch <code className="font-mono text-[11px] bg-[var(--wk-info)]/10 px-1 rounded">VITE_CHARTS_INGESTION_MODE</code> to <strong>wordpress</strong> to test live backend connectivity.
          </div>
        </div>
      )}

      {mode === "wordpress" && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === "loading"}
            className="wk-button wk-button-sm whitespace-nowrap disabled:opacity-50"
          >
            {testStatus === "loading" ? (
              <><i className="ri-loader-4-line animate-spin mr-1.5" />Testing...</>
            ) : (
              <><i className="ri-wifi-line mr-1.5" />Test WordPress Connection</>
            )}
          </button>
          {testStatus === "success" && testResult && (
            <span className="text-[12px] text-[var(--wk-success)] font-semibold">
              <i className="ri-check-line mr-1" />
              {testResult.plugin} v{testResult.version} — charts_ingestion: {testResult.charts_ingestion ? "enabled" : "disabled"}
            </span>
          )}
          {testStatus === "error" && testError && (
            <span className="text-[12px] text-[var(--wk-danger)] font-semibold">
              <i className="ri-close-line mr-1" />{testError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EndpointCard({ endpoint, onCopy }: { endpoint: EndpointDefinition; onCopy: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--wk-surface-raised)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[endpoint.status]}`}>
            {endpoint.status}
          </span>
          <span className="text-[12px] font-mono text-[var(--wk-brand)] font-semibold whitespace-nowrap">
            {endpoint.method}
          </span>
          <span className="text-[13px] font-semibold text-[var(--wk-text)] truncate">
            {endpoint.key}
          </span>
        </div>
        <i className={expanded ? "ri-arrow-up-s-line text-[var(--wk-text-muted)]" : "ri-arrow-down-s-line text-[var(--wk-text-muted)]"} />
      </button>

      {expanded && (
        <div className="border-t border-[var(--wk-border)] p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Frontend Function</div>
              <div className="text-[12px] font-mono text-[var(--wk-text)] bg-[var(--wk-bg-subtle)] rounded-md px-3 py-2">{endpoint.frontendFunction}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Endpoint Path</div>
              <div className="text-[12px] font-mono text-[var(--wk-brand)] bg-[var(--wk-bg-subtle)] rounded-md px-3 py-2">{endpoint.path}</div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Description</div>
            <div className="text-[12px] text-[var(--wk-text-soft)]">{endpoint.description}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Tables</div>
              <div className="flex flex-wrap gap-1">
                {endpoint.tables.map((t) => (
                  <span key={t} className="text-[10px] font-mono rounded-md bg-[var(--wk-bg-subtle)] px-2 py-1 text-[var(--wk-text-muted)]">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)] mb-1">Capabilities</div>
              <div className="flex flex-wrap gap-1">
                {endpoint.capabilities.map((c) => (
                  <span key={c} className="text-[10px] font-mono rounded-md bg-[var(--wk-brand-soft)] px-2 py-1 text-[var(--wk-brand)]">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Payload Example</div>
                <button
                  onClick={() => onCopy(JSON.stringify(endpoint.payloadExample, null, 2))}
                  className="text-[10px] text-[var(--wk-brand)] hover:underline"
                >
                  <i className="ri-file-copy-line mr-0.5" /> Copy JSON
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[var(--wk-text-soft)] bg-[var(--wk-bg-subtle)] rounded-md p-3 overflow-x-auto">
                {JSON.stringify(endpoint.payloadExample, null, 2)}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Response Example</div>
                <button
                  onClick={() => onCopy(JSON.stringify(endpoint.responseExample, null, 2))}
                  className="text-[10px] text-[var(--wk-brand)] hover:underline"
                >
                  <i className="ri-file-copy-line mr-0.5" /> Copy JSON
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[var(--wk-text-soft)] bg-[var(--wk-bg-subtle)] rounded-md p-3 overflow-x-auto">
                {JSON.stringify(endpoint.responseExample, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminChartsIntegrationMap() {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");
  const groups = getEndpointGroups();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allEndpoints = Object.values(groups).flat();
  const filtered = filter
    ? allEndpoints.filter(
        (e) =>
          e.key.toLowerCase().includes(filter.toLowerCase()) ||
          e.path.toLowerCase().includes(filter.toLowerCase()) ||
          e.description.toLowerCase().includes(filter.toLowerCase())
      )
    : allEndpoints;

  const statusCounts = {
    not_configured: allEndpoints.filter((e) => e.status === "not_configured").length,
    planned: allEndpoints.filter((e) => e.status === "planned").length,
    mocked: allEndpoints.filter((e) => e.status === "mocked").length,
    ready: allEndpoints.filter((e) => e.status === "ready").length,
    deprecated: allEndpoints.filter((e) => e.status === "deprecated").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--wk-text)]">Backend Integration Map</h1>
          <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
            Every frontend action mapped to its future WordPress endpoint, method, payload, and response.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {copied && (
            <span className="text-[12px] text-[var(--wk-success)] font-semibold">
              <i className="ri-check-line mr-1" />Copied to clipboard
            </span>
          )}
        </div>
      </div>

      {/* Diagnostics Panel */}
      <DiagnosticsPanel />

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className={`rounded-lg border p-3 ${STATUS_STYLES[status]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider">{status.replace(/_/g, " ")}</div>
            <div className="text-[20px] font-bold mt-1">{count}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)] text-sm" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search endpoints, paths, or descriptions..."
            className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] pl-9 pr-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--wk-brand)]"
          />
        </div>
        <button
          onClick={() => setFilter("")}
          className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap"
        >
          Clear
        </button>
      </div>

      {/* Endpoints by Group */}
      {filter ? (
        <div className="space-y-3">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">
            Search Results ({filtered.length} endpoint{filtered.length !== 1 ? "s" : ""})
          </div>
          {filtered.map((endpoint) => (
            <EndpointCard key={endpoint.key} endpoint={endpoint} onCopy={handleCopy} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([groupName, endpoints]) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-[var(--wk-text)]">{groupName}</h2>
                <span className="text-[10px] font-mono text-[var(--wk-text-muted)] bg-[var(--wk-bg-subtle)] rounded-full px-2 py-0.5">
                  {endpoints.length}
                </span>
              </div>
              <div className="space-y-2">
                {endpoints.map((endpoint) => (
                  <EndpointCard key={endpoint.key} endpoint={endpoint} onCopy={handleCopy} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}