import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getIngestRuns } from "@/services/chartsIngestion/client";
import type { IngestRun, IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface EnrichedRow extends IngestResolvedRow {
  runId: string;
  runTitle: string;
  editionDate: string;
}

export default function AdminChartsCanonGaps() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const r = await getIngestRuns();
      setRuns(r);
      setLoading(false);
    }
    load();
  }, []);

  const gapRows: EnrichedRow[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => row.matchStatus === "no_match" || row.matchStatus === "needs_review")
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate }))
  );

  const filtered = gapRows.filter((row) => {
    const matchesFilter = filter === "all" || row.matchStatus === filter;
    const matchesSearch =
      row.title.toLowerCase().includes(search.toLowerCase()) ||
      row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const matchBadge: Record<string, string> = {
    no_match: "bg-red-100 text-red-700",
    needs_review: "bg-primary-100 text-primary-700",
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-foreground-600">Loading canonical gaps...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">Operations</div>
          <h1 className="text-[20px] font-bold text-foreground-950">Canon Gaps</h1>
          <p className="text-[13px] text-foreground-600">Canonicalization gaps that need resolution before committing editions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/charts/review-queue")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3 py-2 text-[12px] font-semibold text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap"
          >
            <i className="ri-git-pull-request-line" /> Send All to Review
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Total Gaps</p>
          <p className="mt-1 text-[24px] font-black text-foreground-950">{gapRows.length}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">No Match</p>
          <p className="mt-1 text-[24px] font-black text-red-700">
            {gapRows.filter((r) => r.matchStatus === "no_match").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Needs Review</p>
          <p className="mt-1 text-[24px] font-black text-primary-700">
            {gapRows.filter((r) => r.matchStatus === "needs_review").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Avg Confidence</p>
          <p className="mt-1 text-[24px] font-black text-foreground-950">
            {gapRows.length > 0 ? Math.round(gapRows.reduce((a, r) => a + r.confidence, 0) / gapRows.length) : 0}%
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
            placeholder="Search canon gaps..."
            className="w-full rounded-md border border-background-200 bg-background-50 py-2 pl-9 pr-3 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <div className="flex gap-2">
          {["all", "no_match", "needs_review"].map((f) => (
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
                <th className="px-4 py-3 font-semibold text-foreground-500">#</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Title</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Artist</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Status</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Confidence</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Provider</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Run</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Warnings</th>
                <th className="px-4 py-3 font-semibold text-foreground-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-background-200/50 transition-colors hover:bg-background-100/50">
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
                      className="text-[11px] font-semibold text-primary-700 hover:underline"
                    >
                      {row.editionDate}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-amber-600 text-[11px]">
                    {row.warnings?.join("; ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 transition-colors whitespace-nowrap">
                        <i className="ri-git-pull-request-line" /> Review
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-foreground-500 hover:bg-background-100 transition-colors whitespace-nowrap">
                        <i className="ri-folder-add-line" /> Shell
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
            <i className="ri-check-double-line mb-3 block text-3xl text-green-400" />
            <p className="text-[13px] text-foreground-500">No canonical gaps found. All rows are resolved.</p>
          </div>
        )}
      </WkSurface>
    </div>
  );
}