import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import {
  getEndpointGroups,
  getIngestStudioEndpointGroups,
  getIngestionMode,
  testWordPressConnection,
  CHARTS_INGESTION_MODE,
} from "@/services/chartsIngestion/client";
import { PUBLIC_MODE } from "@/services/chartsPublic/client";
import type { EndpointDefinition } from "@/services/chartsIngestion/client";

const STATUS_STYLES: Record<string, string> = {
  not_configured: "bg-wk-surface-raised text-wk-text-faint border-wk-border",
  planned: "bg-wk-info-soft text-wk-info border-wk-info/20",
  mocked: "bg-wk-warning-soft text-wk-warning border-wk-warning/20",
  ready: "bg-wk-success-soft text-wk-success border-wk-success/20",
  deprecated: "bg-wk-danger-soft text-wk-danger border-wk-danger/20",
};

export default function AdminChartsIntegrationMap() {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; plugin: string; charts_ingestion: boolean; version: string } | null>(null);
  const navigate = useNavigate();
  const mode = getIngestionMode();
  const groups = getEndpointGroups();
  const studioGroups = getIngestStudioEndpointGroups();
  const allGroups = { ...groups, ...studioGroups };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const allEndpoints = Object.values(allGroups).flat();
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

  const wiredCount = allEndpoints.filter((e) => e.status === "ready" || e.status === "mocked").length;
  const totalCount = allEndpoints.length;

  // Ingest flow nodes
  const flowNodes = [
    {
      id: "provider",
      label: "Provider Sources",
      icon: "ri-global-line",
      color: "bg-wk-info-soft text-wk-info",
      description: "Spotify, Apple Music, CSV files",
      navigate: () => navigate("/admin/charts/ingest"),
    },
    {
      id: "fetch",
      label: "Fetch & Normalize",
      icon: "ri-download-cloud-line",
      color: "bg-wk-info-soft text-wk-info",
      description: "Source fetch, CSV parsing, row normalization",
      navigate: () => navigate("/admin/charts/ingest"),
    },
    {
      id: "match",
      label: "Registry Matching",
      icon: "ri-git-merge-line",
      color: "bg-wk-warning-soft text-wk-warning",
      description: "Match rows to canonical tracks, releases, artists",
      navigate: () => navigate("/admin/charts/review-queue"),
    },
    {
      id: "review",
      label: "Review Queue",
      icon: "ri-git-pull-request-line",
      color: "bg-wk-danger-soft text-wk-danger",
      description: "Human review for gaps, shells, duplicates",
      navigate: () => navigate("/admin/charts/review-queue"),
    },
    {
      id: "draft",
      label: "Draft Builder",
      icon: "ri-draft-line",
      color: "bg-wk-brand-soft text-wk-brand",
      description: "Assemble entries, apply scoring, ranking",
      navigate: () => navigate("/admin/charts/ingest"),
    },
    {
      id: "snapshot",
      label: "Snapshot & Publish",
      icon: "ri-lock-2-line",
      color: "bg-wk-success-soft text-wk-success",
      description: "Immutable snapshot, public edition, checksum",
      navigate: () => navigate("/admin/charts/snapshots"),
    },
    {
      id: "public",
      label: "Public API",
      icon: "ri-bar-chart-box-line",
      color: "bg-wk-success-soft text-wk-success",
      description: "Charts endpoint, entries, track history",
      navigate: () => navigate("/admin/charts/public-api-qa"),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminChartsPageHeader
        eyebrow="System Architecture"
        title="Integration Map"
        description="How chart ingestion connects to registry, review, and public API."
      >
        {copied && (
          <span className="text-[12px] text-wk-success font-semibold">
            <i className="ri-check-line mr-1" />Copied
          </span>
        )}
        <button
          onClick={handleTestConnection}
          disabled={testStatus === "loading"}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <i className={testStatus === "loading" ? "ri-loader-4-line animate-spin" : "ri-wifi-line"} />
          {testStatus === "loading" ? "Testing…" : "Test Connection"}
        </button>
      </AdminChartsPageHeader>

      {/* Backend connectivity */}
      <WkSurface className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="ri-plug-line text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Backend Connectivity</h2>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
            mode === "mock" ? "bg-wk-warning-soft text-wk-warning border-wk-warning/20" : "bg-wk-success-soft text-wk-success border-wk-success/20"
          }`}>
            {mode}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-wk-surface-raised p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Current Mode</p>
            <p className="text-[13px] font-semibold text-wk-text">{mode}</p>
          </div>
          <div className="rounded-md bg-wk-surface-raised p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">WP API Base</p>
            <p className="text-[12px] font-mono text-wk-text truncate">{import.meta.env.VITE_WAKILISHA_WP_API_BASE || "/wp-json/wakilisha/v1"}</p>
          </div>
          <div className="rounded-md bg-wk-surface-raised p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Nonce</p>
            <p className={`text-[13px] font-semibold ${
              typeof window !== "undefined" && (window as Record<string, string>).WAKILISHA_REST_NONCE ? "text-wk-success" : "text-wk-text-faint"
            }`}>
              {typeof window !== "undefined" && (window as Record<string, string>).WAKILISHA_REST_NONCE ? "Detected" : "Not detected"}
            </p>
          </div>
          <div className="rounded-md bg-wk-surface-raised p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Public Mode</p>
            <p className="text-[13px] font-semibold text-wk-text">{PUBLIC_MODE}</p>
          </div>
        </div>
        {testStatus === "success" && testResult && (
          <div className="mt-3 rounded-md bg-wk-success-soft p-3 text-[12px] text-wk-success">
            <strong>{testResult.plugin}</strong> v{testResult.version} — charts_ingestion: {testResult.charts_ingestion ? "enabled" : "disabled"}
          </div>
        )}
        {testStatus === "error" && testError && (
          <div className="mt-3 rounded-md bg-wk-danger-soft p-3 text-[12px] text-wk-danger">
            <strong>Connection failed:</strong> {testError}
          </div>
        )}
        {mode === "mock" && (
          <div className="mt-3 rounded-md bg-wk-info-soft p-3 text-[12px] text-wk-info">
            <strong>Mock mode active.</strong> All data is local. Switch VITE_CHARTS_INGESTION_MODE to wordpress for live connectivity.
          </div>
        )}
      </WkSurface>

      {/* Visual Flow */}
      <WkSurface className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <i className="ri-flow-chart text-wk-brand" />
          <h2 className="text-[14px] font-bold text-wk-text">Ingestion Flow</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {flowNodes.map((node, i) => (
            <button
              key={node.id}
              onClick={node.navigate}
              className="flex flex-col items-center gap-2 rounded-xl border border-wk-border bg-wk-surface p-4 text-center transition-all hover:border-wk-border-2 hover:bg-wk-surface-raised cursor-pointer"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${node.color}`}>
                <i className={`${node.icon} text-lg`} />
              </div>
              <div className="text-[12px] font-bold text-wk-text">{node.label}</div>
              <div className="text-[10px] text-wk-text-muted">{node.description}</div>
              {i < flowNodes.length - 1 && (
                <div className="hidden xl:block absolute right-[-14px] top-1/2 text-wk-text-faint">
                  <i className="ri-arrow-right-line" />
                </div>
              )}
            </button>
          ))}
        </div>
      </WkSurface>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className={`rounded-lg border p-3 ${STATUS_STYLES[status]}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider">{status.replace(/_/g, " ")}</div>
            <div className="text-[20px] font-bold mt-1">{count}</div>
          </div>
        ))}
      </div>

      {/* Overall bar */}
      <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-48 rounded-full bg-wk-surface-raised overflow-hidden">
            <div className="h-full rounded-full bg-wk-success" style={{ width: `${(wiredCount / totalCount) * 100}%` }} />
          </div>
          <span className="text-[12px] font-semibold text-wk-text">
            {wiredCount} / {totalCount} endpoints wired
          </span>
          <span className="text-[12px] text-wk-text-muted">
            ({Math.round((wiredCount / totalCount) * 100)}%)
          </span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-sm" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search endpoints, paths, or descriptions…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface pl-9 pr-3 py-2 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <button onClick={() => setFilter("")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          Clear
        </button>
      </div>

      {/* Endpoints */}
      {filter ? (
        <div className="space-y-3">
          <div className="text-[13px] font-bold text-wk-text">
            Search Results ({filtered.length} endpoint{filtered.length !== 1 ? "s" : ""})
          </div>
          {filtered.map((endpoint) => (
            <EndpointCard key={endpoint.key} endpoint={endpoint} onCopy={handleCopy} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(allGroups).map(([groupName, endpoints]) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-wk-text">{groupName}</h2>
                <span className="text-[10px] font-mono text-wk-text-faint bg-wk-surface-raised rounded-full px-2 py-0.5">
                  {endpoints.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider ml-auto text-wk-text-muted">
                  {endpoints.filter((e) => e.status === "ready" || e.status === "mocked").length}/{endpoints.length} wired
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

function EndpointCard({ endpoint, onCopy }: { endpoint: EndpointDefinition; onCopy: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-wk-surface-raised transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[endpoint.status]}`}>
            {endpoint.status}
          </span>
          <span className="text-[12px] font-mono text-wk-brand font-semibold whitespace-nowrap">{endpoint.method}</span>
          <span className="text-[13px] font-semibold text-wk-text truncate">{endpoint.key}</span>
        </div>
        <i className={`${expanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} text-wk-text-faint shrink-0`} />
      </button>
      {expanded && (
        <div className="border-t border-wk-border p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">Frontend Function</div>
              <div className="text-[12px] font-mono text-wk-text bg-wk-surface-raised rounded-md px-3 py-2">{endpoint.frontendFunction}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">Endpoint Path</div>
              <div className="text-[12px] font-mono text-wk-brand bg-wk-surface-raised rounded-md px-3 py-2">{endpoint.path}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">Description</div>
            <div className="text-[12px] text-wk-text-soft">{endpoint.description}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">Tables</div>
              <div className="flex flex-wrap gap-1">
                {endpoint.tables.map((t) => (
                  <span key={t} className="text-[10px] font-mono rounded-md bg-wk-surface-raised px-2 py-1 text-wk-text-muted">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint mb-1">Capabilities</div>
              <div className="flex flex-wrap gap-1">
                {endpoint.capabilities.map((c) => (
                  <span key={c} className="text-[10px] font-mono rounded-md bg-wk-brand-soft px-2 py-1 text-wk-brand">{c}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Payload Example</div>
                <button onClick={() => onCopy(JSON.stringify(endpoint.payloadExample, null, 2))} className="text-[10px] text-wk-brand hover:underline">
                  <i className="ri-file-copy-line mr-0.5" /> Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-wk-text-soft bg-wk-surface-raised rounded-md p-3 overflow-x-auto">
                {JSON.stringify(endpoint.payloadExample, null, 2)}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Response Example</div>
                <button onClick={() => onCopy(JSON.stringify(endpoint.responseExample, null, 2))} className="text-[10px] text-wk-brand hover:underline">
                  <i className="ri-file-copy-line mr-0.5" /> Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-wk-text-soft bg-wk-surface-raised rounded-md p-3 overflow-x-auto">
                {JSON.stringify(endpoint.responseExample, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}