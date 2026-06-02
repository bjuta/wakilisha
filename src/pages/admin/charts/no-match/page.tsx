import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns } from "@/services/chartsIngestion/client";
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
}

type RowState = "pending" | "shell_created" | "sent_to_review" | "ignored";

export default function AdminChartsNoMatch() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [creatingShells, setCreatingShells] = useState(false);

  const load = useCallback(async () => {
    const r = await getIngestRuns();
    setRuns(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const noMatchRows: EnrichedRow[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => row.matchStatus === "no_match")
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate }))
  );

  const filtered = noMatchRows.filter((row) => {
    const matchProvider = providerFilter === "all" || row.sourceProvider === providerFilter;
    const matchSearch = !search ||
      row.title.toLowerCase().includes(search.toLowerCase()) ||
      row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase());
    return matchProvider && matchSearch;
  });

  const activeRows = filtered.filter((row) => !rowStates[row.id] || rowStates[row.id] === "pending");

  const handleCreateShell = (rowId: string, title: string) => {
    setRowStates((prev) => ({ ...prev, [rowId]: "shell_created" }));
    showToast(`Release shell created for "${title}"`);
  };

  const handleSendToReview = (rowId: string, title: string) => {
    setRowStates((prev) => ({ ...prev, [rowId]: "sent_to_review" }));
    showToast(`"${title}" sent to review queue`);
  };

  const handleIgnore = (rowId: string, title: string) => {
    setRowStates((prev) => ({ ...prev, [rowId]: "ignored" }));
    showToast(`"${title}" ignored`);
  };

  const handleCreateAllShells = async () => {
    if (activeRows.length === 0) return;
    setCreatingShells(true);
    await new Promise((res) => setTimeout(res, 600));
    const newStates: Record<string, RowState> = {};
    activeRows.forEach((row) => { newStates[row.id] = "shell_created"; });
    setRowStates((prev) => ({ ...prev, ...newStates }));
    setCreatingShells(false);
    showToast(`${activeRows.length} release shell(s) created`);
  };

  const handleExportCsv = () => {
    const headers = ["Rank", "Title", "Artist", "Provider", "Run ID", "Edition Date", "Warnings"];
    const rows = activeRows.map((row) => [
      row.rank,
      `"${row.title.replace(/"/g, '""')}"`,
      `"${row.artistNames.join(", ").replace(/"/g, '""')}"`,
      row.sourceProvider === "spotify" ? "Spotify" : "Apple Music",
      row.runId,
      row.editionDate,
      `"${(row.warnings ?? []).join("; ").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `no-match-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${activeRows.length} rows to CSV`);
  };

  if (loading) return <AdminChartsLoadingState message="Loading no-match releases…" />;

  const shellCreatedCount = Object.values(rowStates).filter((s) => s === "shell_created").length;
  const sentToReviewCount = Object.values(rowStates).filter((s) => s === "sent_to_review").length;
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
        title="No-match Releases"
        description="Tracks from ingest runs that could not be matched to any canonical entity in the registry."
      >
        <button
          onClick={handleExportCsv}
          disabled={activeRows.length === 0}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap disabled:opacity-40"
        >
          <i className="ri-download-line" />
          Export CSV
        </button>
        <button
          onClick={handleCreateAllShells}
          disabled={creatingShells || activeRows.length === 0}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <i className={creatingShells ? "ri-loader-4-line animate-spin" : "ri-folder-add-line"} />
          {creatingShells ? "Creating…" : `Create All Shells (${activeRows.length})`}
        </button>
      </AdminChartsPageHeader>

      {/* Context callout */}
      <div className="rounded-lg border border-wk-border bg-wk-surface p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-danger-soft text-wk-danger">
          <i className="ri-close-circle-line" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-text">These tracks are not in the registry</p>
          <p className="mt-0.5 text-[12px] text-wk-text-muted">
            No-match rows must be resolved before an edition can be cleanly committed.
            Create a release shell to hold the track temporarily, or send to review for manual investigation.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard value={noMatchRows.length} label="Total No-match" icon="ri-close-circle-line" accent={noMatchRows.length > 0 ? "danger" : "muted"} />
        <AdminChartsKpiCard value={shellCreatedCount} label="Shells Created" icon="ri-folder-add-line" accent={shellCreatedCount > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={sentToReviewCount} label="Sent to Review" icon="ri-git-pull-request-line" accent={sentToReviewCount > 0 ? "brand" : "muted"} />
        <AdminChartsKpiCard value={ignoredCount} label="Ignored" icon="ri-eye-off-line" accent="muted" />
      </div>

      {/* Action progress */}
      {(shellCreatedCount > 0 || sentToReviewCount > 0 || ignoredCount > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-4 py-3">
          <span className="text-[12px] text-wk-text-muted">
            Session progress: {shellCreatedCount} shells · {sentToReviewCount} in review · {ignoredCount} ignored
          </span>
          <button
            onClick={() => setRowStates({})}
            className="text-[12px] font-semibold text-wk-brand hover:underline ml-auto"
          >
            Reset all
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or artist…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <div className="flex gap-1">
          {["all", "spotify", "apple_music"].map((p) => (
            <button
              key={p}
              onClick={() => setProviderFilter(p)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                providerFilter === p ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {p === "all" ? "All" : p === "spotify" ? "Spotify" : "Apple Music"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["#", "Track", "Artist", "Provider", "Warnings", "Run", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const state = rowStates[row.id] ?? "pending";
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50 ${state !== "pending" ? "opacity-50" : ""}`}
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
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-wk-surface-raised text-wk-text-soft border border-wk-border">
                        {row.sourceProvider === "spotify" ? "Spotify" : "Apple"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-wk-warning text-[11px]">{row.warnings?.join("; ") || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-runs/${row.runId}`)}
                        className="text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer"
                      >
                        {row.editionDate}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {state === "shell_created" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wk-warning-soft px-2 py-0.5 text-[11px] font-semibold text-wk-warning">
                          <i className="ri-folder-add-line" /> Shell Created
                        </span>
                      ) : state === "sent_to_review" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wk-brand-soft px-2 py-0.5 text-[11px] font-semibold text-wk-brand">
                          <i className="ri-git-pull-request-line" /> In Review
                        </span>
                      ) : state === "ignored" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wk-surface-raised px-2 py-0.5 text-[11px] font-semibold text-wk-text-faint">
                          <i className="ri-eye-off-line" /> Ignored
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleCreateShell(row.id, row.title)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-warning hover:bg-wk-warning-soft transition-colors whitespace-nowrap"
                            title="Create release shell"
                          >
                            <i className="ri-folder-add-line" /> Shell
                          </button>
                          <button
                            onClick={() => handleSendToReview(row.id, row.title)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                            title="Send to review queue"
                          >
                            <i className="ri-git-pull-request-line" /> Review
                          </button>
                          <button
                            onClick={() => handleIgnore(row.id, row.title)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
                            title="Ignore this row"
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
            {noMatchRows.length === 0 ? (
              <AdminChartsEmptyState
                icon="ri-check-double-line"
                title="No no-match releases"
                description="All rows from recent ingest runs have canonical matches. Run a new ingest to check for new no-match rows."
              />
            ) : (
              <div>
                <i className="ri-check-double-line mb-3 block text-3xl text-wk-success" />
                <p className="text-[14px] font-semibold text-wk-text">All visible rows actioned</p>
                <button onClick={() => { setSearch(""); setProviderFilter("all"); }} className="mt-2 text-[13px] font-semibold text-wk-brand hover:underline">
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