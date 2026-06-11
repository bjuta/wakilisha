import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns, sendGapsToReview } from "@/services/chartsIngestion/client";
import type { IngestRun, IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";

interface EnrichedRow extends IngestResolvedRow {
  runId: string;
  runTitle: string;
  editionDate: string;
  gapType: "missing_track" | "missing_release" | "missing_artist" | "duplicate_candidate" | "low_confidence" | "provider_conflict";
}

type RowState = "pending" | "sent_to_review" | "shell_created" | "merged" | "ignored";

const GAP_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string; description: string }> = {
  missing_track: { label: "Missing Track", color: "text-wk-danger", icon: "ri-music-line", description: "No canonical track entity found in registry" },
  missing_release: { label: "Missing Release", color: "text-wk-danger", icon: "ri-album-line", description: "Track exists but release entity is missing" },
  missing_artist: { label: "Missing Artist", color: "text-wk-warning", icon: "ri-user-line", description: "Artist entity not in registry" },
  duplicate_candidate: { label: "Duplicate", color: "text-wk-info", icon: "ri-file-copy-line", description: "Multiple matching candidates found" },
  low_confidence: { label: "Low Confidence", color: "text-wk-warning", icon: "ri-bar-chart-line", description: "Match confidence below threshold" },
  provider_conflict: { label: "Provider Conflict", color: "text-wk-danger", icon: "ri-error-warning-line", description: "Conflicting data between providers" },
};

function inferGapType(row: IngestResolvedRow): EnrichedRow["gapType"] {
  if (row.matchStatus === "duplicate_candidate") return "duplicate_candidate";
  if (row.confidence < 50) return "low_confidence";
  if (row.warnings && row.warnings.some((w) => w.toLowerCase().includes("artist"))) return "missing_artist";
  if (row.warnings && row.warnings.some((w) => w.toLowerCase().includes("release"))) return "missing_release";
  if (row.warnings && row.warnings.some((w) => w.toLowerCase().includes("conflict"))) return "provider_conflict";
  return "missing_track";
}

export default function AdminChartsCanonGaps() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gapTypeFilter, setGapTypeFilter] = useState("all");
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  const load = useCallback(async () => {
    setRuns(await getIngestRuns());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const allGapRows: EnrichedRow[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => row.matchStatus === "no_match" || row.matchStatus === "needs_review" || row.matchStatus === "duplicate_candidate")
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate, gapType: inferGapType(row) }))
  );

  const pendingGapRows = allGapRows.filter((row) => !rowStates[row.id]);

  const filtered = allGapRows.filter((row) => {
    const matchType = gapTypeFilter === "all" || row.gapType === gapTypeFilter;
    const matchSearch = !search ||
      row.title.toLowerCase().includes(search.toLowerCase()) ||
      row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Group by gap type for strategic view
  const grouped = Object.keys(GAP_TYPE_CONFIG).reduce<Record<string, EnrichedRow[]>>((acc, type) => {
    acc[type] = allGapRows.filter((r) => r.gapType === type);
    return acc;
  }, {});

  const handleSendToReview = async (row: EnrichedRow) => {
    try {
      await sendGapsToReview(row.runId);
      setRowStates((prev) => ({ ...prev, [row.id]: "sent_to_review" }));
      showToast(`"${row.title}" sent to review`);
      await load();
    } catch {
      showToast(`Failed to send "${row.title}" to review`);
    }
  };

  const handleCreateShell = (row: EnrichedRow) => {
    setRowStates((prev) => ({ ...prev, [row.id]: "shell_created" }));
    showToast(`Shell created for "${row.title}"`);
  };

  const handleIgnore = (row: EnrichedRow) => {
    setRowStates((prev) => ({ ...prev, [row.id]: "ignored" }));
    showToast(`"${row.title}" ignored`);
  };

  const handleSendAllToReview = async () => {
    if (pendingGapRows.length === 0) return;
    setSendingAll(true);
    const runIds = new Set<string>(pendingGapRows.map((r) => r.runId));
    for (const runId of runIds) {
      try { await sendGapsToReview(runId); } catch { /* continue */ }
    }
    const newStates: Record<string, RowState> = {};
    pendingGapRows.forEach((row) => { newStates[row.id] = "sent_to_review"; });
    setRowStates((prev) => ({ ...prev, ...newStates }));
    setSendingAll(false);
    showToast(`${pendingGapRows.length} gap rows sent to review`);
    await load();
  };

  if (loading) return <AdminChartsLoadingState message="Loading canon gaps…" />;

  const sentCount = Object.values(rowStates).filter((s) => s === "sent_to_review").length;
  const shellCount = Object.values(rowStates).filter((s) => s === "shell_created").length;
  const ignoredCount = Object.values(rowStates).filter((s) => s === "ignored").length;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Operations"
        title="Canon Gaps"
        description="Strategic view of systemic registry gaps discovered through ingestion. Not row-level triage — pattern-level remediation."
      >
        <button
          onClick={handleSendAllToReview}
          disabled={sendingAll || pendingGapRows.length === 0}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <i className={sendingAll ? "ri-loader-4-line animate-spin" : "ri-git-pull-request-line"} />
          {sendingAll ? "Sending…" : `Send All to Review (${pendingGapRows.length})`}
        </button>
      </AdminChartsPageHeader>

      {/* Purpose callout */}
      <div className="rounded-lg border border-wk-border bg-wk-surface p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-danger-soft text-wk-danger">
          <i className="ri-error-warning-line" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-text">Review Queue is row-level. Canon Gaps is pattern-level.</p>
          <p className="mt-0.5 text-[12px] text-wk-text-muted">
            Use this page to identify systemic gaps in the registry — not to resolve individual rows.
            Group-level insight helps prioritize what to fix in the registry to prevent future ingest failures.
          </p>
        </div>
      </div>

      {/* Gap type summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(GAP_TYPE_CONFIG).map(([type, config]) => {
          const count = grouped[type]?.length ?? 0;
          return (
            <button
              key={type}
              onClick={() => setGapTypeFilter(gapTypeFilter === type ? "all" : type)}
              className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                gapTypeFilter === type
                  ? "border-wk-brand bg-wk-brand-soft"
                  : "border-wk-border bg-wk-surface hover:border-wk-border-2 hover:bg-wk-surface-raised"
              }`}
            >
              <div className={`text-[16px] ${config.color}`}>
                <i className={config.icon} />
              </div>
              <p className="mt-2 text-[22px] font-black text-wk-text">{count}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-wk-text-muted">{config.label}</p>
            </button>
          );
        })}
      </div>

      {/* Progress */}
      {(sentCount > 0 || shellCount > 0 || ignoredCount > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-4 py-3">
          {sentCount > 0 && <span className="text-[12px] font-semibold text-wk-brand"><i className="ri-git-pull-request-line mr-1" />{sentCount} in review</span>}
          {shellCount > 0 && <span className="text-[12px] font-semibold text-wk-warning"><i className="ri-folder-add-line mr-1" />{shellCount} shells</span>}
          {ignoredCount > 0 && <span className="text-[12px] font-semibold text-wk-text-faint"><i className="ri-eye-off-line mr-1" />{ignoredCount} ignored</span>}
          <button onClick={() => setRowStates({})} className="ml-auto text-[12px] font-semibold text-wk-brand hover:underline">Reset</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminChartsKpiCard value={allGapRows.length} label="Total Gaps" icon="AlertCircle" accent={allGapRows.length > 0 ? "danger" : "muted"} />
        <AdminChartsKpiCard value={allGapRows.filter((r) => r.matchStatus === "no_match").length} label="No Match" icon="XCircle" accent="danger" />
        <AdminChartsKpiCard value={allGapRows.filter((r) => r.matchStatus === "needs_review").length} label="Needs Review" icon="Flag" accent="warning" />
        <AdminChartsKpiCard value={sentCount + shellCount} label="Actioned" icon="Check" accent={sentCount + shellCount > 0 ? "success" : "muted"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search canon gaps…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <button
          onClick={() => { setGapTypeFilter("all"); setSearch(""); }}
          disabled={gapTypeFilter === "all" && !search}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap disabled:opacity-40"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["#", "Track", "Artist", "Gap Type", "Confidence", "Provider", "Run", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const state = rowStates[row.id];
                const config = GAP_TYPE_CONFIG[row.gapType];
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50 ${state ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 font-bold text-wk-text-muted">{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.artworkUrl && <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />}
                        <span className="font-semibold text-wk-text">{row.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-wk-text-soft">{row.artistNames.join(", ")}</td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${config.color}`}>
                        <i className={config.icon} />
                        {config.label}
                      </div>
                      <div className="mt-0.5 text-[10px] text-wk-text-faint">{config.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-wk-surface-raised overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.confidence >= 70 ? "bg-wk-success" : row.confidence >= 50 ? "bg-wk-warning" : "bg-wk-danger"}`}
                            style={{ width: `${row.confidence}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-semibold text-wk-text-soft">{row.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-wk-surface-raised text-wk-text-soft border border-wk-border">
                        {row.sourceProvider === "spotify" ? "Spotify" : "Apple"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-runs/${row.runId}`)}
                        className="text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer"
                      >
                        {row.editionDate}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {state === "sent_to_review" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2 py-0.5 text-[11px] font-semibold text-wk-brand">
                          <i className="ri-git-pull-request-line" /> In Review
                        </span>
                      ) : state === "shell_created" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2 py-0.5 text-[11px] font-semibold text-wk-warning">
                          <i className="ri-folder-add-line" /> Shell
                        </span>
                      ) : state === "ignored" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wk-surface-raised px-2 py-0.5 text-[11px] font-semibold text-wk-text-faint">
                          <i className="ri-eye-off-line" /> Ignored
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSendToReview(row)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                          >
                            <i className="ri-git-pull-request-line" /> Review
                          </button>
                          <button
                            onClick={() => handleCreateShell(row)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-warning-soft hover:text-wk-warning transition-colors whitespace-nowrap"
                          >
                            <i className="ri-folder-add-line" /> Shell
                          </button>
                          <button
                            onClick={() => handleIgnore(row)}
                            className="rounded px-2 py-1 text-[11px] text-wk-text-faint hover:bg-wk-surface-raised transition-colors"
                            title="Ignore"
                          >
                            <i className="ri-eye-off-line" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            {allGapRows.length === 0 ? (
              <AdminChartsEmptyState
                icon="CheckCircle2"
                title="No canonical gaps"
                description="All rows from recent ingest runs are canonically matched. No systemic gaps detected."
              />
            ) : (
              <div>
                <p className="text-[14px] font-semibold text-wk-text">No gaps match this filter</p>
                <button onClick={() => { setGapTypeFilter("all"); setSearch(""); }} className="mt-2 text-[13px] font-semibold text-wk-brand hover:underline">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </WkSurface>
    </div>
  );
}