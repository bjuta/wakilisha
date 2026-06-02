import { Check, Loader } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun, IngestStageStatus } from "@/services/chartsIngestion/ingestStudioTypes";

interface PipelinePanelProps {
  run: IngestRun;
  compact?: boolean;
}

export function PipelinePanel({ run, compact = false }: PipelinePanelProps) {
  const stageStatusColor = (status: IngestStageStatus["status"]) => {
    switch (status) {
      case "done": return "bg-wk-success";
      case "running": return "bg-wk-brand animate-pulse";
      case "warning": return "bg-wk-warning";
      case "failed": return "bg-wk-danger";
      default: return "bg-wk-border";
    }
  };

  const stageStatusLabel = (status: IngestStageStatus["status"]) => {
    switch (status) {
      case "done": return "Done";
      case "running": return "Running";
      case "warning": return "Warning";
      case "failed": return "Failed";
      default: return "Idle";
    }
  };

  const stageName = (stage: string) => {
    const names: Record<string, string> = {
      validate: "Validate",
      provider_detection: "Provider Detection",
      resource_guard: "Resource Guard",
      source_fetch: "Source Fetch",
      normalize: "Normalize",
      canonical_match: "Canonical Match",
      enrichment: "Enrichment",
      snapshot_commit: "Snapshot / Commit",
    };
    return names[stage] || stage;
  };

  const doneStages = run.stages.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneStages / run.stages.length) * 100);

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Ingestion Pipeline</h2>
        {run.status === "running" && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-wk-border overflow-hidden">
              <div className="h-full rounded-full bg-wk-brand transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-wk-brand">{progressPct}%</span>
          </div>
        )}
      </div>
      <div className={`space-y-2 ${compact ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
        {run.stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-wk-text-on-brand ${stageStatusColor(stage.status)}`}>
              {stage.status === "done" ? <Check size={10} /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-wk-text truncate">{stageName(stage.stage)}</span>
                <span className={`text-[11px] font-semibold ${
                  stage.status === "done" ? "text-wk-success" :
                  stage.status === "running" ? "text-wk-brand" :
                  stage.status === "failed" ? "text-wk-danger" :
                  stage.status === "warning" ? "text-wk-warning" :
                  "text-wk-text-faint"
                }`}>
                  {stageStatusLabel(stage.status)}
                  {stage.durationMs ? ` (${(stage.durationMs / 1000).toFixed(1)}s)` : ""}
                </span>
              </div>
              {stage.message && !compact && (
                <p className="text-[11px] text-wk-text-muted truncate">{stage.message}</p>
              )}
              {stage.metrics && !compact && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(stage.metrics).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}