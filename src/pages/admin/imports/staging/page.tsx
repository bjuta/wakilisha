import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface StagingRecord {
  id: string;
  run_id: string;
  source_name: string;
  entity_type: string;
  entity_data: Record<string, unknown>;
  status: "pending" | "valid" | "invalid" | "promoted" | "failed";
  validation_errors: string[] | null;
  created_at: string;
}

export default function AdminImportsStagingPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<StagingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      // Since we don't have a dedicated staging table, we simulate with ingestion runs
      // In a real implementation, this would query a staging table
      const { data: runs } = await supabase
        .from("wk_ingestion_runs")
        .select("id, source_name, status, imported_counts, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      // Simulate staging records from the runs data
      const simulated: StagingRecord[] = [];
      runs?.forEach((run) => {
        if (run.imported_counts) {
          Object.entries(run.imported_counts).forEach(([entityType, count]) => {
            const num = typeof count === "number" ? count : 0;
            for (let i = 0; i < Math.min(num, 5); i++) {
              simulated.push({
                id: `${run.id}-${entityType}-${i}`,
                run_id: run.id,
                source_name: run.source_name,
                entity_type: entityType,
                entity_data: { index: i, source: run.source_name },
                status: run.status === "completed" ? "promoted" : run.status === "failed" ? "failed" : "pending",
                validation_errors: null,
                created_at: run.created_at,
              });
            }
          });
        }
      });

      setRecords(simulated);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = records.filter((r) => {
    const matchesSearch = !search || r.source_name.toLowerCase().includes(search.toLowerCase()) || r.entity_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Staging Records</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {records.length} records in staging · {statusCounts["pending"] || 0} pending · {statusCounts["valid"] || 0} valid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/imports/upload")}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Upload" size={14} />
            New Upload
          </button>
        </div>
      </div>

      {/* Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staging records..."
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
              <option value="pending">Pending</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="promoted">Promoted</option>
              <option value="failed">Failed</option>
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">{filtered.length} of {records.length}</span>
          </div>
        </div>
      </WkSurface>

      {/* Records Table */}
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
        <div className="space-y-2">
          {filtered.length > 0 ? (
            filtered.map((record) => (
              <div key={record.id} className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-surface-raised">
                  <WkIcon
                    name={record.status === "promoted" ? "CheckCircle2" : record.status === "failed" ? "XCircle" : "Clock"}
                    size={14}
                    className={
                      record.status === "promoted" ? "text-wk-success" :
                      record.status === "failed" ? "text-wk-danger" :
                      record.status === "valid" ? "text-wk-success" :
                      "text-wk-warning"
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-wk-text capitalize">{record.entity_type}</div>
                  <div className="text-[11px] text-wk-text-muted">{record.source_name} · {new Date(record.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    record.status === "promoted" ? "bg-wk-success-soft text-wk-success" :
                    record.status === "failed" ? "bg-wk-danger-soft text-wk-danger" :
                    record.status === "valid" ? "bg-wk-success-soft text-wk-success" :
                    "bg-wk-warning-soft text-wk-warning"
                  }`}>
                    {record.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
              <p className="text-[13px] text-wk-text-muted">No staging records found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}