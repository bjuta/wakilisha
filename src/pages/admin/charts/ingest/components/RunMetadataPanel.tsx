import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface RunMetadataPanelProps {
  run: IngestRun;
}

export function RunMetadataPanel({ run }: RunMetadataPanelProps) {
  const statusColors: Record<string, string> = {
    draft: "text-foreground-400",
    running: "text-primary-600",
    dry_run_complete: "text-amber-600",
    ready_to_commit: "text-green-600",
    committed: "text-green-600",
    failed: "text-red-600",
    cancelled: "text-foreground-400",
    needs_review: "text-purple-600",
  };

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-foreground-950">Run Metadata</h2>
        <span className={`text-[12px] font-bold ${statusColors[run.status] || "text-foreground-600"}`}>
          {run.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[12px]">
        <div>
          <span className="text-foreground-500">Run ID:</span>{" "}
          <span className="font-mono font-semibold text-foreground-700">{run.id}</span>
        </div>
        <div>
          <span className="text-foreground-500">Created by:</span>{" "}
          <span className="font-semibold text-foreground-700">{run.createdBy}</span>
        </div>
        <div>
          <span className="text-foreground-500">Started:</span>{" "}
          <span className="font-semibold text-foreground-700">{new Date(run.createdAt).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-foreground-500">Series:</span>{" "}
          <span className="font-semibold text-foreground-700">{run.existingSeriesId || "—"}</span>
        </div>
        <div className="sm:col-span-2">
          <span className="text-foreground-500">Sources:</span>{" "}
          <span className="font-semibold text-foreground-700">{run.sourceUrls.length} URL(s)</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {run.sourceUrls.map((url, i) => (
              <span key={i} className="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-mono text-foreground-500 truncate max-w-[200px]">
                {url}
              </span>
            ))}
          </div>
        </div>
        {run.dryRunCompletedAt && (
          <div>
            <span className="text-foreground-500">Dry run completed:</span>{" "}
            <span className="font-semibold text-foreground-700">{new Date(run.dryRunCompletedAt).toLocaleString()}</span>
          </div>
        )}
        {run.errorMessage && (
          <div className="sm:col-span-2 rounded bg-red-50 p-2 text-[11px] text-red-700">
            <i className="ri-error-warning-line mr-1" />{run.errorMessage}
          </div>
        )}
      </div>
    </WkSurface>
  );
}