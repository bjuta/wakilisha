import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { WkIcon } from "@/components/design-system/Icon";
import {
  getEndpointGroups,
  getIngestStudioEndpointGroups,
  getIngestionMode,
  testWordPressConnection,
} from "@/services/chartsIngestion/client";
import { PUBLIC_MODE, PUBLIC_API_BASE } from "@/services/chartsPublic/client";
import { PUBLIC_V2_API_BASE } from "@/services/chartsPublic/v2Adapter";
import type { EndpointDefinition } from "@/services/chartsIngestion/client";

const V2_PUBLIC_ENDPOINTS = [
  { key: "v2-health", method: "GET", path: "/wp-json/wakilisha/v2/charts/health", fn: "testPublicV2Connection()", status: "mocked", desc: "Health check — API status, schema version, counts" },
  { key: "v2-list", method: "GET", path: "/wp-json/wakilisha/v2/charts", fn: "getV2ChartFamilies()", status: "mocked", desc: "List all chart programs with latest edition summaries" },
  { key: "v2-program", method: "GET", path: "/wp-json/wakilisha/v2/charts/{programSlug}", fn: "getV2ChartFamily(slug)", status: "mocked", desc: "Get one chart program by canonical or legacy slug" },
  { key: "v2-latest", method: "GET", path: "/wp-json/wakilisha/v2/charts/{programSlug}/latest", fn: "getV2LatestChartEdition(slug)", status: "mocked", desc: "Get latest published edition (excludes empty editions)" },
  { key: "v2-edition", method: "GET", path: "/wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}", fn: "getV2ChartEdition(slug, edition)", status: "mocked", desc: "Get one edition with program metadata" },
  { key: "v2-entries", method: "GET", path: "/wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries", fn: "getV2ChartEditionEntries(slug, edition)", status: "mocked", desc: "Get edition entries (limit/offset supported)" },
  { key: "v2-resolve", method: "GET", path: "/wp-json/wakilisha/v2/charts/resolve/{slug}", fn: "resolveV2Alias(slug)", status: "planned", desc: "Resolve legacy slug to canonical program slug" },
  { key: "v2-history", method: "GET", path: "/wp-json/wakilisha/v2/tracks/{trackSlug}/chart-history", fn: "getV2TrackChartHistory(trackSlug)", status: "mocked", desc: "Track chart appearances across all V2 editions" },
];

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
      icon: "Globe" as const,
      color: "bg-wk-info-soft text-wk-info",
      description: "Spotify, Apple Music, CSV files",
      navigate: () => navigate("/admin/settings/charts/ingest"),
    },
    {
      id: "fetch",
      label: "Fetch & Normalize",
      icon: "Download" as const,
      color: "bg-wk-info-soft text-wk-info",
      description: "Source fetch, CSV parsing, row normalization",
      navigate: () => navigate("/admin/settings/charts/ingest"),
    },
    {
      id: "match",
      label: "Registry Matching",
      icon: "GitMerge" as const,
      color: "bg-wk-warning-soft text-wk-warning",
      description: "Match rows to canonical tracks, releases, artists",
      navigate: () => navigate("/admin/settings/charts/review-queue"),
    },
    {
      id: "review",
      label: "Review Queue",
      icon: "GitPullRequest" as const,
      color: "bg-wk-danger-soft text-wk-danger",
      description: "Human review for gaps, shells, duplicates",
      navigate: () => navigate("/admin/settings/charts/review-queue"),
    },
    {
      id: "draft",
      label: "Draft Builder",
      icon: "FileEdit" as const,
      color: "bg-wk-brand-soft text-wk-brand",
      description: "Assemble entries, apply scoring, ranking",
      navigate: () => navigate("/admin/settings/charts/ingest"),
    },
    {
      id: "snapshot",
      label: "Snapshot & Publish",
      icon: "Lock" as const,
      color: "bg-wk-success-soft text-wk-success",
      description: "Immutable snapshot, public edition, checksum",
      navigate: () => navigate("/admin/settings/charts/snapshots"),
    },
    {
      id: "public",
      label: "V2 Public API",
      icon: "BarChart3" as const,
      color: "bg-wk-success-soft text-wk-success",
      description: "Charts endpoint, entries, track history",
      navigate: () => navigate("/admin/settings/charts/public-api-qa"),
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
          <span className="text-[12px] text-wk-success font-semibold flex items-center gap-1">
            <WkIcon name="Check" size={14} />Copied
          </span>
        )}
        <button
          onClick={handleTestConnection}
          disabled={testStatus === "loading"}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <WkIcon name={testStatus === "loading" ? "Loader" : "Wifi"} size={14} className={testStatus === "loading" ? "animate-spin" : ""} />
          {testStatus === "loading" ? "Testing…" : "Test Connection"}
        </button>
      </AdminChartsPageHeader>

      {/* V2 Public API section — prominently first */}
      <WkSurface className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <WkIcon name="BarChart3" size={16} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">V2 Public Chart API</h2>
            <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[10px] font-bold text-wk-brand">NEW</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-wk-text-muted font-mono truncate max-w-[220px]">{PUBLIC_V2_API_BASE}</span>
            <button
              onClick={() => navigate("/admin/settings/charts/public-api-qa")}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="FlaskConical" size={13} />
              Run QA
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-lg bg-wk-brand-soft border border-wk-brand/20 p-3">
          <p className="text-[12px] text-wk-text-muted">
            The V2 API introduces the <strong className="text-wk-text">ChartProgram = Series × Market</strong> ontology.
            4 programs · 78 editions · 6,332 entries · 10 legacy slug aliases.
            Execution readiness: <strong className="text-wk-success">6/6 checks pass</strong>, 0 blockers.
            Start the local V2 server with <code className="text-[11px] bg-white/30 rounded px-1">npm run charts:v2-serve</code>.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Method", "Path", "Frontend Function", "Status", "Description"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-wk-border/50">
              {V2_PUBLIC_ENDPOINTS.map((ep) => (
                <tr key={ep.key} className="hover:bg-wk-surface-raised/50">
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] font-bold text-wk-brand font-mono">{ep.method}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <code className="text-[11px] text-wk-text-soft">{ep.path}</code>
                  </td>
                  <td className="px-3 py-2.5">
                    <code className="text-[11px] text-wk-info">{ep.fn}</code>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${STATUS_STYLES[ep.status] ?? STATUS_STYLES.not_configured}`}>
                      {ep.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-wk-text-muted">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Backend connectivity */}
      <WkSurface className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <WkIcon name="Plug" size={14} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Backend Connectivity</h2>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
            mode === "mock" ? "bg-wk-warning-soft text-wk-warning border-wk-warning/20" : "bg-wk-success-soft text-wk-success border-wk-success/20"
          }`}>
            {mode}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Ingestion Mode", value: mode },
            { label: "V1 API Base", value: import.meta.env.VITE_WAKILISHA_WP_API_BASE || "/wp-json/wakilisha/v1" },
            { label: "WP Nonce", value: typeof window !== "undefined" && (window as Record<string, string>).WAKILISHA_REST_NONCE ? "Detected" : "Not detected" },
            { label: "Public Mode", value: PUBLIC_MODE },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md bg-wk-surface-raised p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</p>
              <p className="text-[12px] font-mono text-wk-text mt-0.5 truncate">{value}</p>
            </div>
          ))}
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
          <WkIcon name="GitBranch" size={14} className="text-wk-brand" />
          <h2 className="text-[14px] font-bold text-wk-text">Ingestion Flow</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {flowNodes.map((node) => (
            <button
              key={node.id}
              onClick={node.navigate}
              className="flex flex-col items-center gap-2 rounded-xl border border-wk-border bg-wk-surface p-4 text-center transition-all hover:border-wk-border-2 hover:bg-wk-surface-raised cursor-pointer"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${node.color}`}>
                <WkIcon name={node.icon} size={18} />
              </div>
              <div className="text-[12px] font-bold text-wk-text">{node.label}</div>
              <div className="text-[10px] text-wk-text-muted">{node.description}</div>
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
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 max-w-xs rounded-full bg-wk-surface-raised overflow-hidden">
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
          <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search endpoints, paths, or descriptions…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface pl-9 pr-3 py-2 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <button onClick={() => setFilter("")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Clear</button>
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
        <WkIcon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} className="text-wk-text-faint shrink-0" />
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
                <button onClick={() => onCopy(JSON.stringify(endpoint.payloadExample, null, 2))} className="text-[10px] text-wk-brand hover:underline flex items-center gap-0.5">
                  <WkIcon name="Copy" size={11} /> Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-wk-text-soft bg-wk-surface-raised rounded-md p-3 overflow-x-auto max-h-40">
                {JSON.stringify(endpoint.payloadExample, null, 2)}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">Response Example</div>
                <button onClick={() => onCopy(JSON.stringify(endpoint.responseExample, null, 2))} className="text-[10px] text-wk-brand hover:underline flex items-center gap-0.5">
                  <WkIcon name="Copy" size={11} /> Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-wk-text-soft bg-wk-surface-raised rounded-md p-3 overflow-x-auto max-h-40">
                {JSON.stringify(endpoint.responseExample, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}