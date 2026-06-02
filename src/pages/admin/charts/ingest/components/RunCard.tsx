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
    running: { color: "bg-primary-500", label: "Running" },
    dry_run_complete: { color: "bg-amber-500", label: "Dry Run Ready" },
    draft: { color: "bg-foreground-400", label: "Draft" },
  };
  const cfg = statusConfig[run.status] || { color: "bg-foreground-400", label: run.status };
  const done = run.stages.filter((s) => s.status === "done").length;
  const pct = Math.round((done / run.stages.length) * 100);
  const canCancel = run.status === "running" || run.status === "draft";
  const canRetry = run.status === "failed";

  return (
    <div className="w-full rounded-lg bg-background-50 p-3 border border-background-200 hover:border-primary-200 transition-all">
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center justify-between mb-1">
          <p className="truncate text-[12px] font-semibold text-foreground-950">{run.chartTitle}</p>
          <span className={`inline-block h-2 w-2 rounded-full ${cfg.color} ${run.status === "running" ? "animate-pulse" : ""}`} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-foreground-500">{run.editionDate}</span>
          <span className="text-[10px] font-semibold text-foreground-400">{run.market}</span>
          <span className="text-[10px] font-semibold text-foreground-400">by {run.createdBy}</span>
        </div>
        {run.status === "running" && (
          <div className="h-1 w-full rounded-full bg-background-200 overflow-hidden">
            <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </button>
      <div className="mt-2 flex gap-2">
        {canCancel && (
          <button
            onClick={onCancel}
            disabled={cancelLoading}
            className="flex-1 rounded bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            {cancelLoading ? "Cancelling…" : "Cancel"}
          </button>
        )}
        {canRetry && (
          <button
            onClick={onRetry}
            disabled={retryLoading}
            className="flex-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            {retryLoading ? "Retrying…" : "Retry"}
          </button>
        )}
        <button
          onClick={onClick}
          className="flex-1 rounded bg-background-100 px-2 py-1 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-200"
        >
          View
        </button>
      </div>
    </div>
  );
}