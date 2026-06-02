import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns, sendGapsToReview } from "@/services/chartsIngestion/client";
import type { IngestRun, IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";

interface ReviewRowEx extends IngestResolvedRow {
  runId: string;
  runTitle: string;
  editionDate: string;
}

type LocalAction = "shell" | "no_match" | "resolved";

export default function AdminChartsReviewQueue() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localActions, setLocalActions] = useState<Record<string, LocalAction>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [drawerRow, setDrawerRow] = useState<ReviewRowEx | null>(null);

  const load = useCallback(async () => {
    const r = await getIngestRuns();
    setRuns(r.filter((run) => run.summary.gaps > 0 || run.summary.shells > 0 || run.status === "needs_review"));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const allRows: ReviewRowEx[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => ["needs_review", "no_match", "shell", "duplicate_candidate"].includes(row.matchStatus))
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate }))
  );

  const activeRows = allRows.filter((row) => localActions[row.id] !== "resolved");

  const filtered = activeRows.filter((row) => {
    const effectiveStatus = localActions[row.id] === "shell" ? "shell"
      : localActions[row.id] === "no_match" ? "no_match"
      : row.matchStatus;
    const matchFilter = filter === "all" || effectiveStatus === filter;
    const matchProvider = providerFilter === "all" || row.sourceProvider === providerFilter;
    const matchSearch = !search ||
      row.title.toLowerCase().includes(search.toLowerCase()) ||
      row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchProvider && matchSearch;
  });

  const needsReviewCount = allRows.filter((r) => r.matchStatus === "needs_review").length;
  const noMatchCount = allRows.filter((r) => r.matchStatus === "no_match").length;
  const shellCount = allRows.filter((r) => r.matchStatus === "shell").length;
  const dupCount = allRows.filter((r) => r.matchStatus === "duplicate_candidate").length;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () =>
    selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map((r) => r.id)));

  const applyAction = (rowId: string, action: LocalAction) => {
    setLocalActions((prev) => ({ ...prev, [rowId]: action }));
    const row = allRows.find((r) => r.id === rowId);
    const labels: Record<LocalAction, string> = { shell: "Marked as release shell", no_match: "Marked as no-match", resolved: "Resolved" };
    if (row) showToast(`${row.title} — ${labels[action]}`);
    setSelected((prev) => { const next = new Set(prev); next.delete(rowId); return next; });
    if (drawerRow?.id === rowId) setDrawerRow(null);
  };

  const handleBulkSendToReview = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const runIds = new Set<string>();
    selected.forEach((rowId) => {
      const row = allRows.find((r) => r.id === rowId);
      if (row) runIds.add(row.runId);
    });
    for (const runId of runIds) {
      try { await sendGapsToReview(runId); } catch { /* continue */ }
    }
    setBulkLoading(false);
    setSelected(new Set());
    showToast(`Sent ${selected.size} row(s) to review queue`);
    await load();
  };

  const handleBulkResolve = () => {
    const newActions: Record<string, LocalAction> = {};
    selected.forEach((rowId) => { newActions[rowId] = "resolved"; });
    setLocalActions((prev) => ({ ...prev, ...newActions }));
    showToast(`${selected.size} row(s) resolved`);
    setSelected(new Set());
  };

  const handleBulkNoMatch = () => {
    const newActions: Record<string, LocalAction> = {};
    selected.forEach((rowId) => { newActions[rowId] = "no_match"; });
    setLocalActions((prev) => ({ ...prev, ...newActions }));
    showToast(`${selected.size} row(s) marked as no-match`);
    setSelected(new Set());
  };

  if (loading) return <AdminChartsLoadingState message="Loading review queue…" />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      {/* Candidate drawer */}
      {drawerRow && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-t-xl sm:rounded-xl border border-wk-border bg-wk-surface p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-wk-text">{drawerRow.title}</h3>
              <button
                onClick={() => setDrawerRow(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-lg bg-wk-surface-raised p-2.5">
                  <p className="text-wk-text-faint text-[10px] uppercase tracking-wider font-bold">Artist</p>
                  <p className="mt-1 font-semibold text-wk-text">{drawerRow.artistNames.join(", ")}</p>
                </div>
                <div className="rounded-lg bg-wk-surface-raised p-2.5">
                  <p className="text-wk-text-faint text-[10px] uppercase tracking-wider font-bold">Match Status</p>
                  <p className="mt-1"><AdminChartsStatusBadge status={localActions[drawerRow.id] ?? drawerRow.matchStatus} size="sm" /></p>
                </div>
                <div className="rounded-lg bg-wk-surface-raised p-2.5">
                  <p className="text-wk-text-faint text-[10px] uppercase tracking-wider font-bold">Confidence</p>
                  <p className="mt-1 font-semibold text-wk-text">{drawerRow.confidence}%</p>
                </div>
                <div className="rounded-lg bg-wk-surface-raised p-2.5">
                  <p className="text-wk-text-faint text-[10px] uppercase tracking-wider font-bold">Provider</p>
                  <p className="mt-1 font-semibold text-wk-text capitalize">{drawerRow.sourceProvider.replace("_", " ")}</p>
                </div>
              </div>
              {drawerRow.warnings && drawerRow.warnings.length > 0 && (
                <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3">
                  {drawerRow.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] text-wk-warning">
                      <i className="ri-error-warning-line shrink-0" /> {w}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => applyAction(drawerRow.id, "shell")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap">
                  <i className="ri-folder-add-line" /> Create Shell
                </button>
                <button onClick={() => applyAction(drawerRow.id, "no_match")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-wk-danger/20 bg-wk-danger-soft px-3 py-2 text-[12px] font-semibold text-wk-danger transition-colors hover:bg-wk-danger/20 whitespace-nowrap">
                  <i className="ri-close-circle-line" /> No Match
                </button>
                <button onClick={() => applyAction(drawerRow.id, "resolved")} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-wk-brand px-3 py-2 text-[12px] font-semibold text-wk-brand-on transition-colors hover:opacity-90 whitespace-nowrap">
                  <i className="ri-check-line" /> Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Operations"
        title="Review Queue"
        description="Rows from ingest runs that need human judgment. Resolve, shell, or no-match each one."
      >
        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-wk-text-muted">{selected.size} selected</span>
            <button onClick={handleBulkSendToReview} disabled={bulkLoading} className="wk-button wk-button-sm wk-button-primary whitespace-nowrap disabled:opacity-50">
              <i className={bulkLoading ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"} />
              {bulkLoading ? "Sending…" : "Send to Review"}
            </button>
            <button onClick={handleBulkNoMatch} className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap">
              <i className="ri-close-circle-line" /> No-match
            </button>
            <button onClick={handleBulkResolve} className="wk-button wk-button-sm wk-button-ghost whitespace-nowrap">
              <i className="ri-check-double-line" /> Resolve
            </button>
            <button onClick={() => setSelected(new Set())} className="text-[12px] text-wk-text-faint hover:text-wk-text-muted">
              Clear
            </button>
          </div>
        )}
      </AdminChartsPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminChartsKpiCard value={needsReviewCount} label="Needs Review" icon="ri-flag-line" accent={needsReviewCount > 0 ? "brand" : "muted"} />
        <AdminChartsKpiCard value={noMatchCount} label="No Match" icon="ri-close-circle-line" accent={noMatchCount > 0 ? "danger" : "muted"} />
        <AdminChartsKpiCard value={shellCount} label="Shell Match" icon="ri-folder-add-line" accent={shellCount > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={dupCount} label="Duplicates" icon="ri-file-copy-line" accent={dupCount > 0 ? "info" : "muted"} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
        <div className="flex flex-wrap gap-1">
          {["all", "needs_review", "no_match", "shell", "duplicate_candidate"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === f ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
        >
          <option value="all">All Providers</option>
          <option value="spotify">Spotify</option>
          <option value="apple_music">Apple Music</option>
        </select>
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-wk-border accent-wk-brand cursor-pointer"
                  />
                </th>
                {["#", "Title & Artist", "Status", "Confidence", "Provider", "Run", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const effectiveStatus = localActions[row.id] === "shell" ? "shell"
                  : localActions[row.id] === "no_match" ? "no_match"
                  : row.matchStatus;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50 ${selected.has(row.id) ? "bg-wk-brand-soft/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="h-4 w-4 rounded border-wk-border accent-wk-brand cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-bold text-wk-text-muted">{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.artworkUrl && <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />}
                        <div>
                          <div className="font-semibold text-wk-text">{row.title}</div>
                          <div className="text-[11px] text-wk-text-muted">{row.artistNames.join(", ")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AdminChartsStatusBadge status={effectiveStatus} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-wk-surface-raised overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.confidence >= 80 ? "bg-wk-success" : row.confidence >= 60 ? "bg-wk-warning" : "bg-wk-danger"}`}
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
                        className="text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer whitespace-nowrap"
                        title={row.runTitle}
                      >
                        {row.editionDate}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDrawerRow(row)}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors whitespace-nowrap"
                          title="Open candidate drawer"
                        >
                          <i className="ri-eye-line" />
                        </button>
                        <button
                          onClick={() => applyAction(row.id, "shell")}
                          className="rounded px-2 py-1 text-[11px] text-wk-text-muted hover:bg-wk-warning-soft hover:text-wk-warning transition-colors"
                          title="Create shell"
                        >
                          <i className="ri-folder-add-line" />
                        </button>
                        <button
                          onClick={() => applyAction(row.id, "no_match")}
                          className="rounded px-2 py-1 text-[11px] text-wk-text-muted hover:bg-wk-danger-soft hover:text-wk-danger transition-colors"
                          title="Mark no-match"
                        >
                          <i className="ri-close-circle-line" />
                        </button>
                        <button
                          onClick={() => applyAction(row.id, "resolved")}
                          className="rounded px-2 py-1 text-[11px] text-wk-text-muted hover:bg-wk-success-soft hover:text-wk-success transition-colors"
                          title="Resolve"
                        >
                          <i className="ri-check-line" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            {allRows.length === 0 ? (
              <AdminChartsEmptyState
                icon="ri-checkbox-circle-line"
                title="Queue is clear"
                description="No rows from recent runs need review. Run a new ingest dry run to populate this queue."
                action={{ label: "Open Ingest Studio", onClick: () => navigate("/admin/charts/ingest"), icon: "ri-add-line" }}
              />
            ) : (
              <div>
                <i className="ri-checkbox-circle-line mb-3 block text-3xl text-wk-success" />
                <p className="text-[14px] font-semibold text-wk-text">All items actioned for these filters</p>
                <button
                  onClick={() => { setFilter("all"); setSearch(""); }}
                  className="mt-2 text-[13px] font-semibold text-wk-brand hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </WkSurface>

      {/* Runs with review items */}
      {runs.length > 0 && (
        <WkSurface className="p-4">
          <h2 className="mb-3 text-[14px] font-bold text-wk-text">Runs Contributing to Queue</h2>
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between rounded-lg bg-wk-surface-raised px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-wk-text truncate">{run.chartTitle}</span>
                  <span className="ml-2 text-[11px] text-wk-text-muted">{run.editionDate}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-wk-text-muted">
                    {run.summary.gaps > 0 && <><span className="font-semibold text-wk-danger">{run.summary.gaps}</span> gaps</>}
                    {run.summary.gaps > 0 && run.summary.shells > 0 && " · "}
                    {run.summary.shells > 0 && <><span className="font-semibold text-wk-warning">{run.summary.shells}</span> shells</>}
                  </span>
                  <button
                    onClick={() => navigate(`/admin/charts/ingest-runs/${run.id}`)}
                    className="text-[12px] font-semibold text-wk-brand hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Open Run →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}
    </div>
  );
}