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

export default function AdminChartsNoMatch() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const r = await getIngestRuns();
      setRuns(r);
      setLoading(false);
    }
    load();
  }, []);

  const noMatchRows: EnrichedRow[] = runs.flatMap((run) =>
    run.rows
      .filter((row) => row.matchStatus === "no_match")
      .map((row) => ({ ...row, runId: run.id, runTitle: run.chartTitle, editionDate: run.editionDate }))
  );

  const filtered = noMatchRows.filter(
    (row) =>
      row.title.toLowerCase().includes(search.toLowerCase()) ||
      row.artistNames.join(", ").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-foreground-600">Loading no-match releases...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">Operations</div>
          <h1 className="text-[20px] font-bold text-foreground-950">No-match Releases</h1>
          <p className="text-[13px] text-foreground-600">Tracks that could not be matched to any canonical entity</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[12px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap">
            <i className="ri-download-line" /> Export CSV
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3 py-2 text-[12px] font-semibold text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap">
            <i className="ri-folder-add-line" /> Create Shells
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">Total No-match</p>
          <p className="mt-1 text-[24px] font-black text-red-700">{noMatchRows.length}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">From Spotify</p>
          <p className="mt-1 text-[24px] font-black text-foreground-950">
            {noMatchRows.filter((r) => r.sourceProvider === "spotify").length}
          </p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">From Apple Music</p>
          <p className="mt-1 text-[24px] font-black text-foreground-950">
            {noMatchRows.filter((r) => r.sourceProvider === "apple_music").length}
          </p>
        </WkSurface>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search no-match tracks..."
          className="w-full rounded-md border border-background-200 bg-background-50 py-2 pl-9 pr-3 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
        />
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
                        <i className="ri-folder-add-line" /> Create Shell
                      </button>
                      <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-foreground-500 hover:bg-background-100 transition-colors whitespace-nowrap">
                        <i className="ri-eye-off-line" /> Ignore
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
            <p className="text-[13px] text-foreground-500">No no-match releases found. All rows have canonical matches.</p>
          </div>
        )}
      </WkSurface>
    </div>
  );
}