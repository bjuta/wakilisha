import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns } from "@/services/chartsIngestion/client";
import type { IngestRun, IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface ReviewRowEx extends IngestResolvedRow {
  runId: string;
  runTitle: string;
  editionDate: string;
}

export default function AdminChartsReviewQueue() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const r = await getIngestRuns();
      setRuns(r.filter((run) => run.summary.gaps > 0 || run.summary.shells > 0 || run.status === "needs_review"));
      setLoading(false);
    }
    load();
  }, []);

  const allReviewRows: ReviewRowEx[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => row.matchStatus === "needs_review" || row.matchStatus === "no_match" || row.matchStatus === "shell" || row.matchStatus === "duplicate_candidate")
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate }))
  );

  const filtered = allReviewRows.filter((row) => {
    const matchesFilter = filter === "all" || row.matchStatus === filter;
    const matchesSearch =
      row.title.toLowerCase().includes(search.toLowerCase()) ||
      row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const matchBadge: Record<string, string> = {
    needs_review: "bg-primary-100 text-primary-700",
    no_match: "bg-red-100 text-red-700",
    shell: "bg-amber-100 text-amber-700",
    duplicate_candidate: "bg-purple-100 text-purple-700",
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-foreground-600">Loading review queue...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">
            Operations
          </div>
          <h1 className="text-[20px] font-bold text-foreground-950">Review Queue</h1>
          <p className="text-[13px] text-foreground-600">Rows awaiting manual review from recent ingest runs</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-foreground-500">{selected.size} selected</span>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3 py-2 text-[12px] font-semibold text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap">
              <i className="ri-send-plane-line" /> Bulk Send to Review
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[12px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap">
              <i className="ri-close-circle-line" /> Mark No-match
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Needs Review</p>
          <p className="mt-1 text-[24px] font-black text-primary-700">
            {allReviewRows.filter((r) => r.matchStatus === "needs_review").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">No Match</p>
          <p className="mt-1 text-[24px] font-black text-red-700">
            {allReviewRows.filter((r) => r.matchStatus === "no_match").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Shells</p>
          <p className="mt-1 text-[24px] font-black text-amber-700">
            {allReviewRows.filter((r) => r.matchStatus === "shell").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Duplicates</p>
          <p className="mt-1 text-[24px] font-black text-purple-700">
            {allReviewRows.filter((r) => r.matchStatus === "duplicate_candidate").length}
          </p>
        </WkSurface>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or artist..."
            className="w-full rounded-md border border-background-200 bg-background-50 py-2 pl-9 pr-3 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "needs_review", "no_match", "shell", "duplicate_candidate"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === f
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-100 text-foreground-600 hover:bg-background-200"
              }`}
            >
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-background-200">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-background-200 accent-primary-500"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-foreground-500">#</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Title</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Artist</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Status</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Confidence</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Source</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Run</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={`border-b border-background-200/50 transition-colors hover:bg-background-100/50 ${selected.has(row.id) ? "bg-primary-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="h-4 w-4 rounded border-background-200 accent-primary-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground-950">{row.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.artworkUrl && (
                        <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      )}
                      <span className="font-semibold text-foreground-950">{row.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground-600">{row.artistNames.join(", ")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${matchBadge[row.matchStatus] || "bg-background-100 text-foreground-500"}`}>
                      {row.matchStatus.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-600">{row.confidence}%</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-background-100 px-1.5 py-0.5 text-[11px] font-semibold text-foreground-500 border border-background-200">
                      {row.sourceProvider === "spotify" ? "Spotify" : "Apple"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/admin/charts/ingest-runs/${row.runId}`)}
                      className="max-w-[120px] truncate text-[11px] font-semibold text-primary-700 hover:underline"
                      title={row.runTitle}
                    >
                      {row.editionDate}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-md p-1.5 text-[11px] text-foreground-500 hover:bg-background-100 hover:text-foreground-950 transition-colors" title="Mark shell">
                        <i className="ri-folder-add-line" />
                      </button>
                      <button className="rounded-md p-1.5 text-[11px] text-foreground-500 hover:bg-red-50 hover:text-red-700 transition-colors" title="Mark no-match">
                        <i className="ri-close-circle-line" />
                      </button>
                      <button className="rounded-md p-1.5 text-[11px] text-foreground-500 hover:bg-green-50 hover:text-green-700 transition-colors" title="Resolve">
                        <i className="ri-check-line" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <i className="ri-checkbox-circle-line mb-3 block text-3xl text-green-400" />
            <p className="text-[13px] text-foreground-500">No rows match this filter. All clear!</p>
          </div>
        )}
      </WkSurface>
    </div>
  );
}