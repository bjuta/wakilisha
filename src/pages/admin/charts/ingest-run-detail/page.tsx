import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getIngestRun, getResourceGuardStatus, commitIngestRun, cancelIngestRun, retryIngestRun, sendGapsToReview } from "@/services/chartsIngestion/client";
import type { IngestRun, IngestStageStatus, ResourceGuardStatus } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";

const POLLING_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = new Set(["dry_run_complete", "committed", "failed", "cancelled", "needs_review"]);

export default function AdminChartsIngestRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<IngestRun | null>(null);
  const [guard, setGuard] = useState<ResourceGuardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startPolling(currentRun: IngestRun) {
    if (TERMINAL_STATUSES.has(currentRun.status)) return;
    if (pollingRef.current) return; // already polling
    setIsPolling(true);
    pollingRef.current = setInterval(async () => {
      if (!runId) return;
      try {
        const updated = await getIngestRun(runId);
        if (updated) {
          setRun(updated);
          if (TERMINAL_STATUSES.has(updated.status)) {
            stopPolling();
          }
        }
      } catch {
        stopPolling();
      }
    }, POLLING_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }

  useEffect(() => {
    async function load() {
      if (!runId) return;
      const [r, g] = await Promise.all([getIngestRun(runId), getResourceGuardStatus(runId)]);
      setRun(r);
      setGuard(g);
      setLoading(false);
      if (r) startPolling(r);
    }
    load();
    return () => stopPolling();
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-evaluate polling whenever run status changes externally
  useEffect(() => {
    if (!run) return;
    if (TERMINAL_STATUSES.has(run.status)) {
      stopPolling();
    } else {
      startPolling(run);
    }
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCommit() {
    if (!runId) return;
    setActionLoading("commit");
    try {
      await commitIngestRun({ runId, publishImmediately: true });
      const r = await getIngestRun(runId);
      setRun(r);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    if (!runId) return;
    setActionLoading("cancel");
    try {
      await cancelIngestRun(runId);
      const r = await getIngestRun(runId);
      setRun(r);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetry() {
    if (!runId) return;
    setActionLoading("retry");
    try {
      await retryIngestRun(runId);
      const r = await getIngestRun(runId);
      setRun(r);
      if (r) startPolling(r);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendGaps() {
    if (!runId) return;
    setActionLoading("gaps");
    try {
      await sendGapsToReview(runId);
      const r = await getIngestRun(runId);
      setRun(r);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Loading run details...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[var(--wk-text-muted)]">Run not found</div>
      </div>
    );
  }

  const stageStatusColor = (status: IngestStageStatus["status"]) => {
    switch (status) {
      case "done": return "bg-[var(--wk-success)]";
      case "running": return "bg-[var(--wk-info)] animate-pulse";
      case "warning": return "bg-[var(--wk-warning)]";
      case "failed": return "bg-[var(--wk-danger)]";
      default: return "bg-[var(--wk-surface-raised)]";
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

  const canCommit = run.status === "dry_run_complete" || run.status === "ready_to_commit";
  const canCancel = run.status === "running" || run.status === "dry_run_complete" || run.status === "ready_to_commit";
  const canRetry = run.status === "failed" || run.status === "cancelled";
  const canSendGaps = run.status === "dry_run_complete" && run.summary.gaps > 0;

  // Pipeline progress bar
  const doneStages = run.stages.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneStages / run.stages.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate("/admin/charts/ingest-runs")}
              className="text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors text-[13px]"
            >
              <i className="ri-arrow-left-line" /> Runs
            </button>
            <span className="text-[var(--wk-text-muted)]">/</span>
            <h1 className="text-[18px] font-bold text-[var(--wk-text)]">{run.chartTitle}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              run.status === "committed" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
              run.status === "failed" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
              run.status === "running" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
              run.status === "dry_run_complete" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
              "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
            }`}>
              {run.status === "running" && <i className="ri-loader-4-line animate-spin mr-1 text-[10px]" />}
              {run.status.replace(/_/g, " ")}
            </span>
            {isPolling && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--wk-info)]">
                <i className="ri-wifi-line" /> Live
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--wk-text-muted)]">
            {run.id} &bull; {run.editionDate} &bull; {run.chartSize} tracks &bull; {run.market}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCommit && (
            <button
              onClick={handleCommit}
              disabled={actionLoading === "commit"}
              className="wk-button wk-button-primary whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-check-line" />
              {actionLoading === "commit" ? "Committing..." : "Commit Edition"}
            </button>
          )}
          {canSendGaps && (
            <button
              onClick={handleSendGaps}
              disabled={actionLoading === "gaps"}
              className="wk-button wk-button-ghost whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-send-plane-line" />
              {actionLoading === "gaps" ? "Sending..." : `Send ${run.summary.gaps} Gaps to Review`}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={actionLoading === "cancel"}
              className="wk-button wk-button-danger whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-close-line" />
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </button>
          )}
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={actionLoading === "retry"}
              className="wk-button wk-button-ghost whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-refresh-line" />
              {actionLoading === "retry" ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <WkSurface className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Ingestion Pipeline</h2>
          {run.status === "running" && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 rounded-full bg-[var(--wk-surface-raised)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--wk-info)] transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-[var(--wk-info)]">{progressPct}%</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {run.stages.map((stage, i) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-[var(--wk-brand-on)] ${stageStatusColor(stage.status)}`}>
                {stage.status === "done" ? <i className="ri-check-line" /> : i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[var(--wk-text)]">{stageName(stage.stage)}</span>
                  <span className={`text-[11px] font-semibold ${
                    stage.status === "done" ? "text-[var(--wk-success)]" :
                    stage.status === "running" ? "text-[var(--wk-info)]" :
                    stage.status === "failed" ? "text-[var(--wk-danger)]" :
                    stage.status === "warning" ? "text-[var(--wk-warning)]" :
                    "text-[var(--wk-text-muted)]"
                  }`}>
                    {stageStatusLabel(stage.status)}
                    {stage.durationMs ? ` (${(stage.durationMs / 1000).toFixed(1)}s)` : ""}
                  </span>
                </div>
                {stage.message && (
                  <p className="text-[11px] text-[var(--wk-text-muted)]">{stage.message}</p>
                )}
                {stage.metrics && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {Object.entries(stage.metrics).map(([k, v]) => (
                      <span key={k} className="rounded bg-[var(--wk-surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">
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

      {/* Summary + Resource Guard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WkSurface className="p-4">
          <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">Match Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--wk-surface-raised)] p-3">
              <p className="text-[11px] text-[var(--wk-text-muted)]">Total Rows</p>
              <p className="text-[18px] font-bold text-[var(--wk-text)]">{run.summary.totalRows}</p>
            </div>
            <div className="rounded-lg bg-[var(--wk-surface-raised)] p-3">
              <p className="text-[11px] text-[var(--wk-text-muted)]">Canonical</p>
              <p className="text-[18px] font-bold text-[var(--wk-success)]">{run.summary.canonicalMatches}</p>
            </div>
            <div className="rounded-lg bg-[var(--wk-surface-raised)] p-3">
              <p className="text-[11px] text-[var(--wk-text-muted)]">Shells</p>
              <p className="text-[18px] font-bold text-[var(--wk-warning)]">{run.summary.shells}</p>
            </div>
            <div className="rounded-lg bg-[var(--wk-surface-raised)] p-3">
              <p className="text-[11px] text-[var(--wk-text-muted)]">Gaps</p>
              <p className="text-[18px] font-bold text-[var(--wk-danger)]">{run.summary.gaps}</p>
            </div>
            <div className="rounded-lg bg-[var(--wk-surface-raised)] p-3">
              <p className="text-[11px] text-[var(--wk-text-muted)]">Duplicates</p>
              <p className="text-[18px] font-bold text-[var(--wk-text-soft)]">{run.summary.duplicateCandidates}</p>
            </div>
            <div className="rounded-lg bg-[var(--wk-surface-raised)] p-3">
              <p className="text-[11px] text-[var(--wk-text-muted)]">Match Rate</p>
              <p className="text-[18px] font-bold text-[var(--wk-brand)]">{run.summary.matchRate.toFixed(1)}%</p>
            </div>
          </div>
        </WkSurface>

        <WkSurface className="p-4">
          <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">Resource Guard</h2>
          {guard ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Sources</span>
                <span className="text-[13px] font-semibold text-[var(--wk-text)]">{guard.sourceCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Provider Budget</span>
                <span className="text-[13px] font-semibold text-[var(--wk-text)]">{guard.providerBudgetRemaining}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Worker Concurrency</span>
                <span className="text-[13px] font-semibold text-[var(--wk-text)]">{guard.workerConcurrency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Est. Rows</span>
                <span className="text-[13px] font-semibold text-[var(--wk-text)]">{guard.estimatedRowCount}</span>
              </div>
              {guard.duplicateRunWarning && (
                <div className="rounded bg-[var(--wk-warning-soft)] p-2 text-[12px] text-[var(--wk-warning)]">
                  <i className="ri-alert-line mr-1" />{guard.duplicateRunWarning}
                </div>
              )}
              {guard.sameEditionDateWarning && (
                <div className="rounded bg-[var(--wk-warning-soft)] p-2 text-[12px] text-[var(--wk-warning)]">
                  <i className="ri-alert-line mr-1" />{guard.sameEditionDateWarning}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--wk-text-muted)]">Resource guard data not available</p>
          )}
        </WkSurface>
      </div>

      {/* Resolved Rows */}
      {run.rows.length > 0 && (
        <WkSurface className="overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Resolved Rows</h2>
            <span className="text-[12px] text-[var(--wk-text-muted)]">{run.rows.length} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--wk-border)]">
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">#</th>
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Title</th>
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Artist</th>
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Provider</th>
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Match</th>
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Confidence</th>
                  <th className="px-4 py-3 font-semibold text-[var(--wk-text-muted)]">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {run.rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--wk-border)]/50 transition-colors hover:bg-[var(--wk-surface-raised)]/50">
                    <td className="px-4 py-3 font-bold text-[var(--wk-text)]">{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.artworkUrl && (
                          <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
                        )}
                        <span className="font-semibold text-[var(--wk-text)]">{row.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--wk-text-soft)]">{row.artistNames.join(", ")}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[var(--wk-surface-raised)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)] border border-[var(--wk-border)]">
                        {row.sourceProvider === "spotify" ? "Spotify" : "Apple"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.matchStatus === "canonical" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                        row.matchStatus === "shell" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                        row.matchStatus === "no_match" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                        row.matchStatus === "needs_review" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
                        "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                      }`}>
                        {row.matchStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--wk-text-soft)]">{row.confidence}%</td>
                    <td className="px-4 py-3">
                      {row.warnings && row.warnings.length > 0 ? (
                        <span className="text-[11px] text-[var(--wk-warning)]" title={row.warnings.join("; ")}>
                          <i className="ri-alert-line mr-1" />{row.warnings.length} warning{row.warnings.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--wk-success)]">
                          <i className="ri-check-line mr-1" />OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WkSurface>
      )}

      {/* Error */}
      {run.errorMessage && (
        <div className="rounded-lg border border-[var(--wk-danger)]/30 bg-[var(--wk-danger-soft)] p-4">
          <div className="flex items-center gap-2 text-[var(--wk-danger)]">
            <i className="ri-error-warning-line text-lg" />
            <span className="font-semibold text-[14px]">Error</span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--wk-danger)]">{run.errorMessage}</p>
        </div>
      )}

      {/* Footer: source details */}
      <WkSurface className="p-4">
        <h2 className="mb-2 text-[13px] font-bold text-[var(--wk-text)]">Source URLs</h2>
        <div className="space-y-1">
          {run.sourceUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <i className={`text-[12px] ${
                url.includes("spotify") ? "ri-spotify-fill text-[var(--wk-success)]" :
                url.includes("apple") ? "ri-apple-fill text-[var(--wk-text-soft)]" :
                "ri-link text-[var(--wk-text-muted)]"
              }`} />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-mono text-[11px] text-[var(--wk-brand)] hover:underline break-all"
              >
                {url}
              </a>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/charts/ingest-health")}
            className="flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors"
          >
            <i className="ri-heart-pulse-line" /> API Health &amp; Endpoint Map
          </button>
        </div>
      </WkSurface>
    </div>
  );
}