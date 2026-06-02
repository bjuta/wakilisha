import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface RunCardProps {
  run: IngestRun;
  onClick: () => void;
  onCancel: () => void;
  onRetry: () => void;
  cancelLoading: boolean;
  retryLoading: boolean;
}

export function RunCard({
  run,
  onClick,
  onCancel,
  onRetry,
  cancelLoading,
  retryLoading,
}: RunCardProps) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    running: { color: "bg-wk-brand", label: "Running" },
    dry_run_complete: { color: "bg-wk-warning", label: "Dry Run Ready" },
    draft: { color: "bg-wk-text-faint", label: "Draft" },
  };
  const cfg = statusConfig[run.status] || { color: "bg-wk-text-faint", label: run.status };
  const done = run.stages.filter((s) => s.status === "done").length;
  const pct = Math.round((done / run.stages.length) * 100);
  const canCancel = run.status === "running" || run.status === "draft";
  const canRetry = run.status === "failed";

  return (
    <div className="w-full rounded-lg bg-wk-bg p-3 border border-wk-border hover:border-wk-brand/50 transition-all">
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center justify-between mb-1">
          <p className="truncate text-[12px] font-semibold text-wk-text">{run.chartTitle}</p>
          <span className={`inline-block h-2 w-2 rounded-full ${cfg.color} ${run.status === "running" ? "animate-pulse" : ""}`} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-wk-text-muted">{run.editionDate}</span>
          <span className="text-[10px] font-semibold text-wk-text-faint">{run.market}</span>
          <span className="text-[10px] font-semibold text-wk-text-faint">by {run.createdBy}</span>
        </div>
        {run.status === "running" && (
          <div className="h-1 w-full rounded-full bg-wk-border overflow-hidden">
            <div className="h-full rounded-full bg-wk-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </button>
      <div className="mt-2 flex gap-2">
        {canCancel && (
          <button
            onClick={onCancel}
            disabled={cancelLoading}
            className="flex-1 rounded bg-wk-danger-soft px-2 py-1 text-[11px] font-semibold text-wk-danger transition-colors hover:bg-wk-danger/20 disabled:opacity-50"
          >
            {cancelLoading ? "Cancelling…" : "Cancel"}
          </button>
        )}
        {canRetry && (
          <button
            onClick={onRetry}
            disabled={retryLoading}
            className="flex-1 rounded bg-wk-warning-soft px-2 py-1 text-[11px] font-semibold text-wk-warning transition-colors hover:bg-wk-warning/20 disabled:opacity-50"
          >
            {retryLoading ? "Retrying…" : "Retry"}
          </button>
        )}
        <button
          onClick={onClick}
          className="flex-1 rounded bg-wk-bg-subtle px-2 py-1 text-[11px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-border"
        >
          View
        </button>
      </div>
    </div>
  );
}