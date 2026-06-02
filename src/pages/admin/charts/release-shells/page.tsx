import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns } from "@/services/chartsIngestion/client";
import type { IngestRun, IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";

interface EnrichedShell extends IngestResolvedRow {
  runId: string;
  runTitle: string;
  editionDate: string;
}

type ShellState = "pending" | "canonicalized" | "editing";

interface EditData { title: string; artist: string; isrc: string; }

export default function AdminChartsReleaseShells() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shellStates, setShellStates] = useState<Record<string, ShellState>>({});
  const [editData, setEditData] = useState<Record<string, EditData>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [canonicalizingAll, setCanonicalizingAll] = useState(false);

  const load = useCallback(async () => {
    setRuns(await getIngestRuns());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const shellRows: EnrichedShell[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => row.matchStatus === "shell")
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate }))
  );

  const filtered = shellRows.filter((row) =>
    !search ||
    row.title.toLowerCase().includes(search.toLowerCase()) ||
    row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase())
  );

  const pendingRows = filtered.filter((row) => shellStates[row.id] !== "canonicalized");

  const handleCanonicalize = (rowId: string, title: string) => {
    setShellStates((prev) => ({ ...prev, [rowId]: "canonicalized" }));
    setEditData((prev) => { const n = { ...prev }; delete n[rowId]; return n; });
    showToast(`"${title}" — shell promoted to canonical`);
  };

  const handleStartEdit = (row: EnrichedShell) => {
    setShellStates((prev) => ({ ...prev, [row.id]: "editing" }));
    setEditData((prev) => ({ ...prev, [row.id]: { title: row.title, artist: row.artistNames.join(", "), isrc: "" } }));
  };

  const handleSaveEdit = (rowId: string) => {
    const data = editData[rowId];
    if (!data?.title?.trim()) { showToast("Title is required"); return; }
    if (!data?.artist?.trim()) { showToast("Artist is required"); return; }
    setShellStates((prev) => ({ ...prev, [rowId]: "pending" }));
    showToast(`Shell metadata saved for "${data.title}"`);
  };

  const handleCanonicalizeAll = async () => {
    if (pendingRows.length === 0) return;
    setCanonicalizingAll(true);
    await new Promise((res) => setTimeout(res, 800));
    const newStates: Record<string, ShellState> = {};
    pendingRows.forEach((row) => { newStates[row.id] = "canonicalized"; });
    setShellStates((prev) => ({ ...prev, ...newStates }));
    setCanonicalizingAll(false);
    showToast(`${pendingRows.length} shell(s) canonicalized`);
  };

  if (loading) return <AdminChartsLoadingState message="Loading release shells…" />;

  const canonicalizedCount = Object.values(shellStates).filter((s) => s === "canonicalized").length;
  const avgConfidence = shellRows.length > 0
    ? Math.round(shellRows.reduce((a, r) => a + r.confidence, 0) / shellRows.length)
    : 0;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Operations"
        title="Release Shells"
        description="Temporary release shells created during ingestion. Canonicalize them to prevent junk accumulation."
      >
        <button
          onClick={handleCanonicalizeAll}
          disabled={canonicalizingAll || pendingRows.length === 0}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
        >
          <i className={canonicalizingAll ? "ri-loader-4-line animate-spin" : "ri-check-double-line"} />
          {canonicalizingAll ? "Canonicalizing…" : `Canonicalize All (${pendingRows.length})`}
        </button>
      </AdminChartsPageHeader>

      {/* Purpose callout */}
      <div className="rounded-lg border border-wk-border bg-wk-surface p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-warning-soft text-wk-warning">
          <i className="ri-folder-add-line" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-wk-text">Shells reduce future manual work</p>
          <p className="mt-0.5 text-[12px] text-wk-text-muted">
            A shell is a provisional registry entry. Canonicalize it to create a permanent entity.
            Shells that are never canonicalized become junk — clean them up proactively.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <AdminChartsKpiCard value={shellRows.length} label="Total Shells" icon="FolderPlus" accent={shellRows.length > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={canonicalizedCount} label="Canonicalized" icon="CheckCircle2" accent={canonicalizedCount > 0 ? "success" : "muted"} />
        <AdminChartsKpiCard value={`${avgConfidence}%`} label="Avg Confidence" icon="BarChart3" accent={avgConfidence >= 70 ? "success" : "warning"} />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shells by title or artist…"
          className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
        />
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["#", "Track", "Artist", "Shell ID", "Confidence", "Run", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const state = shellStates[row.id] ?? "pending";
                const isEditing = state === "editing";
                const isCanonical = state === "canonicalized";
                const data = editData[row.id];

                return (
                  <>
                    <tr
                      key={row.id}
                      className={`border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50 ${isCanonical ? "opacity-50" : ""}`}
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
                        <span className="font-mono text-[11px] text-wk-text-muted">{row.releaseShellId || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 rounded-full bg-wk-surface-raised overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.confidence >= 80 ? "bg-wk-success" : row.confidence >= 60 ? "bg-wk-warning" : "bg-wk-danger"}`}
                              style={{ width: `${row.confidence}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-semibold text-wk-text-soft">{row.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/admin/settings/charts/ingest-runs/${row.runId}`)}
                          className="text-[11px] font-semibold text-wk-brand hover:underline cursor-pointer"
                        >
                          {row.editionDate}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {isCanonical ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-wk-success-soft px-2 py-0.5 text-[11px] font-semibold text-wk-success">
                            <i className="ri-check-double-line" /> Canonical
                          </span>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleCanonicalize(row.id, row.title)}
                              disabled={isEditing}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-brand hover:bg-wk-brand-soft transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              <i className="ri-check-double-line" /> Promote
                            </button>
                            <button
                              onClick={() => isEditing ? setShellStates((p) => ({ ...p, [row.id]: "pending" })) : handleStartEdit(row)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-colors whitespace-nowrap"
                            >
                              <i className={isEditing ? "ri-close-line" : "ri-edit-line"} />
                              {isEditing ? "Cancel" : "Edit"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isEditing && data && (
                      <tr key={`${row.id}-edit`} className="border-b border-wk-border bg-wk-surface-raised/50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-wk-text-muted">Title *</label>
                              <input
                                type="text"
                                value={data.title}
                                onChange={(e) => setEditData((p) => ({ ...p, [row.id]: { ...p[row.id], title: e.target.value } }))}
                                className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-border-strong"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-wk-text-muted">Artist *</label>
                              <input
                                type="text"
                                value={data.artist}
                                onChange={(e) => setEditData((p) => ({ ...p, [row.id]: { ...p[row.id], artist: e.target.value } }))}
                                className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-border-strong"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-wk-text-muted">ISRC (optional)</label>
                              <input
                                type="text"
                                value={data.isrc}
                                onChange={(e) => setEditData((p) => ({ ...p, [row.id]: { ...p[row.id], isrc: e.target.value } }))}
                                placeholder="e.g. USRC17607839"
                                className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-border-strong"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => handleSaveEdit(row.id)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
                              <i className="ri-save-line" /> Save Metadata
                            </button>
                            <button onClick={() => handleCanonicalize(row.id, data.title || row.title)} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
                              <i className="ri-check-double-line" /> Save &amp; Promote
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            <AdminChartsEmptyState
              icon="FolderCheck"
              title="No release shells"
              description="Release shells appear here after a dry run identifies tracks without canonical entity matches."
            />
          </div>
        )}
      </WkSurface>
    </div>
  );
}