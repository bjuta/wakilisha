import { Check, Loader } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun, IngestStageStatus } from "@/services/chartsIngestion/ingestStudioTypes";

interface PipelinePanelProps {
  run: IngestRun;
  compact?: boolean;
}

const STAGE_ICONS: Record<string, string> = {
  validate: "ri-shield-check-line",
  provider_detection: "ri-radar-line",
  resource_guard: "ri-safe-2-line",
  source_fetch: "ri-download-cloud-line",
  normalize: "ri-equalizer-line",
  canonical_match: "ri-git-branch-line",
  enrichment: "ri-sparkling-line",
  snapshot_commit: "ri-lock-2-line",
};

function StageBadge({ status }: { status: IngestStageStatus["status"] }) {
  const styles: Record<string, string> = {
    done: "bg-wk-success-soft text-wk-success",
    running: "bg-wk-brand-soft text-wk-brand",
    warning: "bg-wk-warning-soft text-wk-warning",
    failed: "bg-wk-danger-soft text-wk-danger",
    idle: "bg-wk-surface-raised text-wk-text-faint",
  };
  const labels: Record<string, string> = {
    done: "Done", running: "Running", warning: "Warn", failed: "Failed", idle: "Idle",
  };
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${styles[status] || styles.idle}`}>
      {labels[status] || status}
    </span>
  );
}

function MetricChip({ label, value, accent }: { label: string; value: string | number; accent?: "success" | "warning" | "danger" | "info" | "brand" }) {
  const colors: Record<string, string> = {
    success: "text-wk-success",
    warning: "text-wk-warning",
    danger: "text-wk-danger",
    info: "text-wk-info",
    brand: "text-wk-brand",
  };
  return (
    <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">
      {label}: <span className={accent ? colors[accent] : "text-wk-text"}>{value}</span>
    </span>
  );
}

function stageStatusColor(status: IngestStageStatus["status"]) {
  switch (status) {
    case "done": return "bg-wk-success";
    case "running": return "bg-wk-brand animate-pulse";
    case "warning": return "bg-wk-warning";
    case "failed": return "bg-wk-danger";
    default: return "bg-wk-border";
  }
}

function stageName(stage: string) {
  const names: Record<string, string> = {
    validate: "Input & Validation",
    provider_detection: "Provider Detection",
    resource_guard: "Resource Guard",
    source_fetch: "Source Fetch",
    normalize: "Normalize",
    canonical_match: "Canonical Match",
    enrichment: "Enrichment",
    snapshot_commit: "Snapshot / Commit",
  };
  return names[stage] || stage;
}

function renderStageMetrics(stage: IngestStageStatus) {
  if (!stage.metrics) return null;
  const m = stage.metrics as Record<string, unknown>;

  if (stage.stage === "canonical_match") {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {m.canonical !== undefined && <MetricChip label="canonical" value={String(m.canonical)} accent="success" />}
        {m.shell !== undefined && <MetricChip label="shell" value={String(m.shell)} accent="warning" />}
        {m.noMatch !== undefined && <MetricChip label="no_match" value={String(m.noMatch)} accent="danger" />}
        {m.needsReview !== undefined && <MetricChip label="review" value={String(m.needsReview)} accent="info" />}
        {m.matchRate !== undefined && <MetricChip label="match rate" value={`${m.matchRate}%`} accent={(m.matchRate as number) >= 85 ? "success" : "warning"} />}
        {m.avgConfidence !== undefined && <MetricChip label="avg conf" value={`${m.avgConfidence}%`} />}
      </div>
    );
  }

  if (stage.stage === "enrichment") {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {m.enriched !== undefined && <MetricChip label="enriched" value={String(m.enriched)} accent="success" />}
        {m.failed !== undefined && Number(m.failed) > 0 && <MetricChip label="failed" value={String(m.failed)} accent="danger" />}
        {m.spotifyHits !== undefined && Number(m.spotifyHits) > 0 && <MetricChip label="spotify" value={String(m.spotifyHits)} />}
        {m.appleMusicHits !== undefined && Number(m.appleMusicHits) > 0 && <MetricChip label="apple" value={String(m.appleMusicHits)} />}
        {m.youtubeHits !== undefined && Number(m.youtubeHits) > 0 && <MetricChip label="youtube" value={String(m.youtubeHits)} />}
        {m.credentialErrors !== undefined && Number(m.credentialErrors) > 0 && (
          <MetricChip label="no creds" value={`${m.credentialErrors}/4`} accent="warning" />
        )}
      </div>
    );
  }

  if (stage.stage === "source_fetch") {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {m.fetchedRows !== undefined && <MetricChip label="rows" value={String(m.fetchedRows)} />}
        {m.fromSpotify !== undefined && Number(m.fromSpotify) > 0 && <MetricChip label="spotify" value={String(m.fromSpotify)} />}
        {m.fromApple !== undefined && Number(m.fromApple) > 0 && <MetricChip label="apple" value={String(m.fromApple)} />}
        {m.failedSources !== undefined && Number(m.failedSources) > 0 && <MetricChip label="failed" value={String(m.failedSources)} accent="danger" />}
      </div>
    );
  }

  if (stage.stage === "normalize") {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {m.normalizedRows !== undefined && <MetricChip label="normalized" value={String(m.normalizedRows)} />}
        {m.droppedRows !== undefined && Number(m.droppedRows) > 0 && <MetricChip label="dropped" value={String(m.droppedRows)} accent="warning" />}
        {m.deduplicatedRows !== undefined && Number(m.deduplicatedRows) > 0 && <MetricChip label="deduped" value={String(m.deduplicatedRows)} />}
      </div>
    );
  }

  // Generic metrics for other stages
  const entries = Object.entries(m).slice(0, 4);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <MetricChip key={k} label={k.replace(/([A-Z])/g, " $1").toLowerCase()} value={String(v)} />
      ))}
    </div>
  );
}

export function PipelinePanel({ run, compact = false }: PipelinePanelProps) {
  const doneStages = run.stages.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneStages / run.stages.length) * 100);
  const failedStages = run.stages.filter((s) => s.status === "failed");
  const warnStages = run.stages.filter((s) => s.status === "warning");

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Ingestion Pipeline</h2>
        <div className="flex items-center gap-2">
          {failedStages.length > 0 && (
            <span className="text-[10px] font-bold text-wk-danger">
              <i className="ri-close-circle-line mr-0.5" />{failedStages.length} failed
            </span>
          )}
          {warnStages.length > 0 && (
            <span className="text-[10px] font-bold text-wk-warning">
              <i className="ri-alert-line mr-0.5" />{warnStages.length} warnings
            </span>
          )}
          {(run.status === "running" || doneStages > 0) && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-20 rounded-full bg-wk-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${run.status === "dry_run_complete" || run.status === "committed" ? "bg-wk-success" : "bg-wk-brand"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-wk-brand">{progressPct}%</span>
            </div>
          )}
        </div>
      </div>

      <div className={`space-y-2.5 ${compact ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
        {run.stages.map((stage, i) => {
          const icon = STAGE_ICONS[stage.stage] || "ri-circle-line";
          const isCommitDisabled = stage.stage === "snapshot_commit" && run.status === "dry_run_complete";

          return (
            <div key={stage.stage} className="flex items-start gap-2.5">
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${stageStatusColor(stage.status)}`}>
                {stage.status === "done" ? (
                  <Check size={9} />
                ) : stage.status === "running" ? (
                  <Loader size={9} className="animate-spin" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <i className={`${icon} text-[11px] shrink-0 ${
                      stage.status === "done" ? "text-wk-success" :
                      stage.status === "running" ? "text-wk-brand" :
                      stage.status === "failed" ? "text-wk-danger" :
                      stage.status === "warning" ? "text-wk-warning" :
                      "text-wk-text-faint"
                    }`} />
                    <span className={`text-[12px] font-semibold truncate ${isCommitDisabled ? "text-wk-text-muted" : "text-wk-text"}`}>
                      {stageName(stage.stage)}
                      {isCommitDisabled && (
                        <span className="ml-1 text-[9px] text-wk-text-faint">(Sprint 5)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {stage.durationMs != null && (
                      <span className="text-[10px] text-wk-text-faint">{(stage.durationMs / 1000).toFixed(1)}s</span>
                    )}
                    <StageBadge status={stage.status} />
                  </div>
                </div>

                {stage.message && !compact && (
                  <p className={`mt-0.5 text-[11px] leading-relaxed ${
                    stage.status === "failed" ? "text-wk-danger" :
                    stage.status === "warning" ? "text-wk-warning" :
                    "text-wk-text-muted"
                  }`}>
                    {stage.message}
                  </p>
                )}

                {!compact && renderStageMetrics(stage)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall status summary */}
      {!compact && (run.status === "dry_run_complete" || run.status === "committed") && (
        <div className="mt-3 rounded-lg bg-wk-success-soft px-3 py-2 flex items-center gap-2">
          <i className="ri-check-double-line text-wk-success" />
          <span className="text-[12px] font-semibold text-wk-success">
            {run.status === "committed" ? "Edition committed and persisted" : "Dry run complete — all stages passed"}
          </span>
          {run.status === "dry_run_complete" && (
            <span className="ml-auto text-[10px] text-wk-text-muted">Commit gated until Sprint 5 review</span>
          )}
        </div>
      )}

      {!compact && run.status === "failed" && (
        <div className="mt-3 rounded-lg bg-wk-danger-soft px-3 py-2 flex items-start gap-2">
          <i className="ri-close-circle-line text-wk-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-wk-danger">Pipeline failed</p>
            {run.errorMessage && (
              <p className="text-[11px] text-wk-danger/80 mt-0.5">{run.errorMessage}</p>
            )}
          </div>
        </div>
      )}
    </WkSurface>
  );
}