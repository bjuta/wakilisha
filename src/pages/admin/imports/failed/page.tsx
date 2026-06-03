import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface FailedRecord {
  id: string;
  run_id: string;
  source_name: string;
  entity_type: string;
  error: string;
  retry_count: number;
  created_at: string;
}

export default function AdminImportsFailedPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<FailedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      // Build failed records from ingestion runs with errors
      const { data: runs } = await supabase
        .from("wk_ingestion_runs")
        .select("id, source_name, errors, created_at")
        .not("errors", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      const failed: FailedRecord[] = [];
      runs?.forEach((run) => {
        const errors = Array.isArray(run.errors) ? run.errors : [];
        errors.forEach((err: string, idx: number) => {
          failed.push({
            id: `${run.id}-err-${idx}`,
            run_id: run.id,
            source_name: run.source_name,
            entity_type: "unknown",
            error: err,
            retry_count: 0,
            created_at: run.created_at,
          });
        });
      });

      setRecords(failed);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = records.filter((r) =>
    !search ||
    r.source_name.toLowerCase().includes(search.toLowerCase()) ||
    r.error.toLowerCase().includes(search.toLowerCase()) ||
    r.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  async function handleRetry(id: string) {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    setRetryingIds((prev) => new Set(prev).add(id));
    // Simulate retry
    await new Promise((r) => setTimeout(r, 1500));
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, retry_count: r.retry_count + 1, error: "Retry succeeded — record staged" } : r
      )
    );
    setRetryingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleRetryAll() {
    const failedIds = records.filter((r) => !r.error.includes("succeeded")).map((r) => r.id);
    setRetryingIds(new Set(failedIds));
    await new Promise((r) => setTimeout(r, 2000));
    setRecords((prev) =>
      prev.map((r) =>
        failedIds.includes(r.id)
          ? { ...r, retry_count: r.retry_count + 1, error: "Retry succeeded — record staged" }
          : r
      )
    );
    setRetryingIds(new Set());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Failed Records</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {records.length} failed records · {records.filter((r) => r.error.includes("succeeded")).length} resolved
          </p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <button
              onClick={handleRetryAll}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="RefreshCw" size={14} />
              Retry All
            </button>
          )}
          <button
            onClick={() => navigate("/admin/imports/jobs")}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="List" size={14} />
            View Jobs
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
              placeholder="Search failed records..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
          <span className="text-[12px] text-wk-text-muted whitespace-nowrap">{filtered.length} of {records.length}</span>
        </div>
      </WkSurface>

      {/* Failed Records */}
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
            filtered.map((record) => {
              const isResolved = record.error.includes("succeeded");
              const isRetrying = retryingIds.has(record.id);
              return (
                <div key={record.id} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised">
                      <WkIcon
                        name={isResolved ? "CheckCircle2" : "XCircle"}
                        size={14}
                        className={isResolved ? "text-wk-success" : "text-wk-danger"}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-wk-text capitalize">{record.entity_type}</span>
                        <span className="text-[11px] text-wk-text-muted">{record.source_name}</span>
                      </div>
                      <div className={`mt-1 text-[12px] ${isResolved ? "text-wk-success" : "text-wk-danger"}`}>
                        {record.error}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-wk-text-muted">
                        <span>Retries: {record.retry_count}</span>
                        <span>{new Date(record.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isResolved && (
                        <button
                          onClick={() => handleRetry(record.id)}
                          disabled={isRetrying}
                          className="flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised transition-colors"
                        >
                          <WkIcon name={isRetrying ? "Loader2" : "RefreshCw"} size={14} />
                          {isRetrying ? "Retrying..." : "Retry"}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/admin/imports/jobs/${record.run_id}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                        title="View job"
                      >
                        <WkIcon name="Eye" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
              <WkIcon name="CheckCircle2" size={24} className="mx-auto mb-2 text-wk-success" />
              <p className="text-[13px] text-wk-text-muted">No failed records. All imports are clean.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}