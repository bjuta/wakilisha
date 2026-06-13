import { AlertTriangle } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface RunMetadataPanelProps {
  run: IngestRun;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "text-wk-text-faint",
  running: "text-wk-brand",
  dry_run_complete: "text-wk-warning",
  ready_to_commit: "text-wk-success",
  committed: "text-wk-success",
  failed: "text-wk-danger",
  cancelled: "text-wk-text-faint",
  needs_review: "text-wk-brand",
};

interface RunAuditData {
  overallWarnings?: string[];
  canonicalMatchMetrics?: {
    matchRate?: number;
    avgConfidence?: number;
    registryHits?: number;
  };
  enrichmentCredentialErrors?: { provider: string; envVarName: string }[];
}

function parseRunNotes(notes?: string): RunAuditData | null {
  if (!notes) return null;
  try {
    return JSON.parse(notes) as RunAuditData;
  } catch {
    return null;
  }
}

export function RunMetadataPanel({ run }: RunMetadataPanelProps) {
  const audit = parseRunNotes(run.notes);
  const stageErrors = run.stages.filter((s) => s.status === "failed" || s.status === "warning");
  const credErrors = audit?.enrichmentCredentialErrors ?? [];
  const hasIssues = stageErrors.length > 0 || run.errorMessage || credErrors.length > 0;

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Run Metadata</h2>
        <span className={`text-[12px] font-bold ${STATUS_COLORS[run.status] || "text-wk-text-soft"}`}>
          {run.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[12px]">
        <div>
          <span className="text-wk-text-muted">Run ID:</span>{" "}
          <span className="font-mono font-semibold text-wk-text-soft truncate">{run.id}</span>
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
          <span className="text-wk-text-muted">Family:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.existingSeriesId || "—"}</span>
        </div>
        <div>
          <span className="text-wk-text-muted">Market:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.market}</span>
        </div>
        <div>
          <span className="text-wk-text-muted">Chart Size:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.chartSize} tracks</span>
        </div>

        {/* Source URLs */}
        <div className="sm:col-span-2">
          <span className="text-wk-text-muted">Sources:</span>{" "}
          <span className="font-semibold text-wk-text-soft">{run.sourceUrls.length} URL(s)</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {run.sourceUrls.map((url, i) => {
              const isSpotify = url.includes("spotify");
              const isApple = url.includes("apple");
              return (
                <span
                  key={i}
                  className="flex items-center gap-1 rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-mono text-wk-text-muted"
                >
                  <i className={`${isSpotify ? "ri-spotify-fill text-[#1DB954]" : isApple ? "ri-apple-fill text-wk-text-muted" : "ri-link text-wk-text-faint"} text-[11px]`} />
                  <span className="truncate max-w-[160px]">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Match metrics from audit */}
        {audit?.canonicalMatchMetrics && (
          <div className="sm:col-span-2 flex flex-wrap gap-3 rounded-lg bg-wk-surface-raised px-3 py-2">
            <div className="text-[11px]">
              <span className="text-wk-text-muted">Match Rate:</span>{" "}
              <span className={`font-bold ${(audit.canonicalMatchMetrics.matchRate ?? 0) >= 85 ? "text-wk-success" : "text-wk-warning"}`}>
                {audit.canonicalMatchMetrics.matchRate?.toFixed(1) ?? "—"}%
              </span>
            </div>
            <div className="text-[11px]">
              <span className="text-wk-text-muted">Avg Confidence:</span>{" "}
              <span className="font-bold text-wk-text">{audit.canonicalMatchMetrics.avgConfidence ?? "—"}%</span>
            </div>
            <div className="text-[11px]">
              <span className="text-wk-text-muted">Registry Hits:</span>{" "}
              <span className="font-bold text-wk-text">{audit.canonicalMatchMetrics.registryHits ?? "—"}</span>
            </div>
          </div>
        )}

        {/* Dry run completion */}
        {run.dryRunCompletedAt && (
          <div>
            <span className="text-wk-text-muted">Dry run completed:</span>{" "}
            <span className="font-semibold text-wk-text-soft">{new Date(run.dryRunCompletedAt).toLocaleString()}</span>
          </div>
        )}
        {run.committedAt && (
          <div>
            <span className="text-wk-text-muted">Committed:</span>{" "}
            <span className="font-semibold text-wk-success">{new Date(run.committedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Errors and warnings */}
      {hasIssues && (
        <div className="mt-3 space-y-2">
          {run.errorMessage && (
            <div className="rounded bg-wk-danger-soft p-2 text-[11px] text-wk-danger">
              <AlertTriangle size={11} className="mr-1 inline shrink-0" />
              <strong>Error:</strong> {run.errorMessage}
            </div>
          )}
          {stageErrors.map((s) => (
            <div key={s.stage} className={`rounded p-2 text-[11px] ${s.status === "failed" ? "bg-wk-danger-soft text-wk-danger" : "bg-wk-warning-soft text-wk-warning"}`}>
              <i className={`mr-1 ${s.status === "failed" ? "ri-close-circle-line" : "ri-alert-line"}`} />
              <strong>{s.stage.replace(/_/g, " ")}:</strong> {s.message || `Stage ${s.status}`}
            </div>
          ))}
          {credErrors.length > 0 && (
            <div className="rounded border border-wk-warning/20 bg-wk-warning-soft p-2 text-[11px] text-wk-warning">
              <p className="font-semibold mb-1">
                <i className="ri-key-line mr-1" />{credErrors.length} enrichment provider(s) missing credentials:
              </p>
              {credErrors.map((ce) => (
                <div key={ce.provider} className="text-[10px] text-wk-text-soft">
                  <span className="font-semibold">{ce.provider}:</span>{" "}
                  <code className="font-mono">{ce.envVarName}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WkSurface>
  );
}