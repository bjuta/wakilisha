import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface IngestRun {
  id: string;
  source_name: string;
  source_kind: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  imported_counts: Record<string, number> | null;
  warnings: string[] | null;
  errors: string[] | null;
}

export default function AdminImportsJobsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("wk_ingestion_runs")
        .select("id, source_name, source_kind, status, started_at, finished_at, created_at, imported_counts, warnings, errors")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error loading import jobs:", error);
      } else {
        setRuns(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = runs.filter((r) => {
    const matchesSearch =
      !search ||
      r.source_name.toLowerCase().includes(search.toLowerCase()) ||
      r.source_kind.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = ["all", "running", "completed", "failed", "queued", "paused"];

  function getTotalImported(counts: Record<string, number> | null) {
    if (!counts) return 0;
    return Object.values(counts).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Import Jobs</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {runs.length} import jobs. {runs.filter((r) => r.status === "failed").length} failed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/imports/upload")}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Upload" size={14} />
            New Import
          </button>
        </div>
      </div>

      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs by source or kind..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              {statusOptions.filter((s) => s !== "all").map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">{filtered.length} of {runs.length}</span>
          </div>
        </div>
      </WkSurface>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="h-4 w-48 rounded bg-wk-surface-raised mb-2" />
              <div className="h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "source_name",
              label: "Source",
              render: (row) => (
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.source_name}</div>
                  <div className="text-[11px] text-wk-text-muted">{row.source_kind}</div>
                </div>
              ),
            },
            { key: "status", label: "Status", width: "100px", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "imported_counts",
              label: "Imported",
              width: "100px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">{getTotalImported(row.imported_counts)} items</span>
              ),
            },
            {
              key: "warnings",
              label: "Warnings",
              width: "80px",
              render: (row) => (
                <span className={`text-[12px] font-semibold ${(row.warnings?.length ?? 0) > 0 ? "text-wk-warning" : "text-wk-text-muted"}`}>
                  {row.warnings?.length ?? 0}
                </span>
              ),
            },
            {
              key: "errors",
              label: "Errors",
              width: "80px",
              render: (row) => (
                <span className={`text-[12px] font-semibold ${(row.errors?.length ?? 0) > 0 ? "text-wk-danger" : "text-wk-text-muted"}`}>
                  {row.errors?.length ?? 0}
                </span>
              ),
            },
            {
              key: "started_at",
              label: "Started",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.started_at ? new Date(row.started_at).toLocaleString() : "—"}
                </span>
              ),
            },
            {
              key: "finished_at",
              label: "Finished",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.finished_at ? new Date(row.finished_at).toLocaleString() : "—"}
                </span>
              ),
            },
          ]}
          rows={filtered}
          keyField="id"
          emptyMessage="No import jobs found."
          onRowClick={(row) => navigate(`/admin/imports/jobs/${row.id}`)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" ? "bg-wk-success-soft text-wk-success" :
    status === "running" ? "bg-wk-info-soft text-wk-info" :
    status === "failed" ? "bg-wk-danger-soft text-wk-danger" :
    status === "queued" ? "bg-wk-warning-soft text-wk-warning" :
    "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {status}
    </span>
  );
}