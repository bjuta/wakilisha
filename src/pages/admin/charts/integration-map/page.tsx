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

const V2_PUBLIC_ENDPOINTS = [
  { key: "v2-health", method: "GET", path: "/api/v1/health", fn: "testPublicV2Connection()", status: "ready", desc: "Health check — API status, schema version, counts" },
  { key: "v2-list", method: "GET", path: "/api/v1/charts", fn: "getV2ChartFamilies()", status: "ready", desc: "List all chart programs with latest edition summaries" },
  { key: "v2-program", method: "GET", path: "/api/v1/charts/{programSlug}", fn: "getV2ChartFamily(slug)", status: "ready", desc: "Get one chart program by canonical slug" },
  { key: "v2-latest", method: "GET", path: "/api/v1/charts/{programSlug}/latest", fn: "getV2LatestChartEdition(slug)", status: "ready", desc: "Get latest published edition" },
  { key: "v2-edition", method: "GET", path: "/api/v1/charts/{programSlug}/{editionSlug}", fn: "getV2ChartEdition(slug, edition)", status: "ready", desc: "Get one edition with program metadata" },
  { key: "v2-entries", method: "GET", path: "/api/v1/charts/{programSlug}/{editionSlug}/entries", fn: "getV2ChartEditionEntries(slug, edition)", status: "ready", desc: "Get edition entries" },
  { key: "v2-resolve", method: "GET", path: "/api/v1/charts/resolve/{slug}", fn: "resolveV2Alias(slug)", status: "planned", desc: "Resolve old chart slug to canonical program slug" },
  { key: "v2-history", method: "GET", path: "/api/v1/tracks/{trackSlug}/chart-history", fn: "getV2TrackChartHistory(trackSlug)", status: "ready", desc: "Track chart appearances across all editions" },
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
      label: "Public API",
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

      <WkSurface className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <WkIcon name="BarChart3" size={16} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Public Chart API</h2>
            <span className="rounded-full bg-wk-brand-soft px-2 py-0.5 text-[10px] font-bold text-wk-brand">CANONICAL</span>
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
            The canonical public API now serves chart programs, editions, entries, and track history from <strong className="text-wk-text">/api/v1</strong>.
            It is backed by the imported Supabase registry and materialized chart compatibility tables.
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
            { label: "Public API Base", value: PUBLIC_API_BASE },
            { label: "Runtime", value: "API / Supabase registry" },
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
            API probe completed: {testResult.plugin} · {testResult.version}
          </div>
        )}
        {testStatus === "error" && testError && (
          <div className="mt-3 rounded-md bg-wk-danger-soft p-3 text-[12px] text-wk-danger">{testError}</div>
        )}
      </WkSurface>

      <WkSurface className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <WkIcon name="Network" size={14} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Runtime Endpoint Contract</h2>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter endpoints…"
            className="rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-4 mb-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="rounded-md bg-wk-surface-raised p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">{status}</p>
              <p className="text-[18px] font-black text-wk-text">{count}</p>
            </div>
          ))}
        </div>

        <p className="mb-3 text-[12px] text-wk-text-muted">{wiredCount}/{totalCount} runtime endpoints are wired or locally implemented.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Method", "Path", "Function", "Status", "Description"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-wk-border/50">
              {filtered.map((ep) => (
                <tr key={ep.key}>
                  <td className="px-3 py-2.5 font-mono font-bold text-wk-brand">{ep.method}</td>
                  <td className="px-3 py-2.5"><code className="text-wk-text-soft">{ep.path}</code></td>
                  <td className="px-3 py-2.5"><code className="text-wk-info">{ep.frontendFunction}</code></td>
                  <td className="px-3 py-2.5"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${STATUS_STYLES[ep.status] ?? STATUS_STYLES.not_configured}`}>{ep.status}</span></td>
                  <td className="px-3 py-2.5 text-wk-text-muted">{ep.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WkSurface>

      <WkSurface className="p-4">
        <h2 className="mb-4 text-[14px] font-bold text-wk-text">Pipeline Flow</h2>
        <div className="grid gap-3 md:grid-cols-7">
          {flowNodes.map((node) => (
            <button key={node.id} onClick={node.navigate} className="rounded-xl border border-wk-border bg-wk-surface-raised p-3 text-left hover:border-wk-brand/50">
              <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ${node.color}`}><WkIcon name={node.icon} size={15} /></div>
              <p className="text-[12px] font-bold text-wk-text">{node.label}</p>
              <p className="mt-1 text-[11px] text-wk-text-muted">{node.description}</p>
            </button>
          ))}
        </div>
      </WkSurface>
    </div>
  );
}
