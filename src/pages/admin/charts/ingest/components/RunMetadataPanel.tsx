import { AlertTriangle } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface RunMetadataPanelProps {
  run: IngestRun;
}

export function RunMetadataPanel({ run }: RunMetadataPanelProps) {
  const statusColors: Record<string, string> = {
    draft: "text-wk-text-faint",
    running: "text-wk-brand",
    dry_run_complete: "text-wk-warning",
    ready_to_commit: "text-wk-success",
    committed: "text-wk-success",
    failed: "text-wk-danger",
    cancelled: "text-wk-text-faint",
    needs_review: "text-wk-brand",
  };

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Run Metadata</h2>
        <span className={`text-[12px] font-bold ${statusColors[run.status] || "text-wk-text-soft"}`}>
          {run.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[12px]">
        <div>
          <span className="text-wk-text-muted">Run ID:</span>{" "}
          <span className="font-mono font-semibold text-wk-text-soft">{run.id}</span>
        </div>
        <div>
          <span className="text-wk-text-muted">Created by:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.createdBy}</span>
        </div>
        <div>
          <span className="text-wk-text-muted">Started:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{new Date(run.createdAt).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-wk-text-muted">Series:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.existingSeriesId || "—"}</span>
        </div>
        <div className="sm:col-span-2">
          <span className="text-wk-text-muted">Sources:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.sourceUrls.length} URL(s)</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {run.sourceUrls.map((url, i) => (
              <span key={i} className="rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-mono text-wk-text-muted truncate max-w-[200px]">
                {url}
              </span>
            ))}
          </div>
        </div>
        {run.dryRunCompletedAt && (
          <div>
            <span className="text-wk-text-muted">Dry run completed:</span>{" "}
            <span className="font-semibold text-wk-text-soft">{new Date(run.dryRunCompletedAt).toLocaleString()}</span>
          </div>
        )}
        {run.errorMessage && (
          <div className="sm:col-span-2 rounded bg-wk-danger-soft p-2 text-[11px] text-wk-danger">
            <AlertTriangle size={12} className="mr-1 inline" />{run.errorMessage}
          </div>
        )}
      </div>
    </WkSurface>
  );
}