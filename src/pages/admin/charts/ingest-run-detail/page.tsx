import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIngestRun,
  getResourceGuardStatus,
  cancelIngestRun,
  retryIngestRun,
  sendGapsToReview,
  commitIngestRun,
  validateCommitReadiness,
} from "@/services/chartsIngestion/client";
import { SkeletonBlock } from "@/components/skeletons/Skeletons";
import type { CommitIngestRunResponse } from "@/services/chartsIngestion/commitTypes";
import type { IngestRun, IngestStageStatus, ResourceGuardStatus } from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkIcon } from "@/components/design-system/Icon";

const POLLING_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = new Set(["dry_run_complete", "committed", "failed", "cancelled", "needs_review"]);

function stageStatusColor(status: IngestStageStatus["status"]): string {
  switch (status) {
    case "done": return "bg-wk-success text-wk-brand-on";
    case "running": return "bg-wk-info text-wk-brand-on animate-pulse";
    case "warning": return "bg-wk-warning text-wk-brand-on";
    case "failed": return "bg-wk-danger text-wk-brand-on";
    default: return "bg-wk-surface-raised text-wk-text-faint";
  }
}

function stageStatusLabel(status: IngestStageStatus["status"]): string {
  switch (status) {
    case "done": return "Done";
    case "running": return "Running";
    case "warning": return "Warning";
    case "failed": return "Failed";
    default: return "Idle";
  }
}

function stageName(stage: string): string {
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

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    committed: "bg-wk-success-soft text-wk-success",
    failed: "bg-wk-danger-soft text-wk-danger",
    running: "bg-wk-info-soft text-wk-info",
    dry_run_complete: "bg-wk-warning-soft text-wk-warning",
    needs_review: "bg-wk-warning-soft text-wk-warning",
    cancelled: "bg-wk-surface-raised text-wk-text-muted",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status] ?? "bg-wk-surface-raised text-wk-text-muted"}`}>
      {status === "running" && <WkIcon name="Loader" size={10} className="animate-spin" />}
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminChartsIngestRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<IngestRun | null>(null);
  const [guard, setGuard] = useState<ResourceGuardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitIngestRunResponse | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startPolling(currentRun: IngestRun) {
    if (TERMINAL_STATUSES.has(currentRun.status)) return;
    if (pollingRef.current) return;
    setIsPolling(true);
    pollingRef.current = setInterval(async () => {
      if (!runId) return;
      try {
        const updated = await getIngestRun(runId);
        if (updated) {
          setRun(updated);
          if (TERMINAL_STATUSES.has(updated.status)) stopPolling();
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

  useEffect(() => {
    if (!run) return;
    if (TERMINAL_STATUSES.has(run.status)) stopPolling();
    else startPolling(run);
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCommit() {
    if (!runId || !run) return;
    setActionLoading("commit");
    setCommitError(null);
    setCommitResult(null);
    try {
      const result = await commitIngestRun({ runId, publishImmediately: true });
      setCommitResult(result);
      const updated = await getIngestRun(runId);
      setRun(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Commit failed";
      setCommitError(msg.replace(/^[^:]+: /, ""));
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
      <div className="space-y-6">
        <div className="animate-pulse space-y-2">
          <SkeletonBlock className="h-4 w-32 rounded" />
          <SkeletonBlock className="h-6 w-64 rounded" />
          <SkeletonBlock className="h-3 w-48 rounded" />
        </div>
        <SkeletonBlock className="h-[300px] rounded-xl border border-[var(--wk-border)]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonBlock className="h-[200px] rounded-xl border border-[var(--wk-border)]" />
          <SkeletonBlock className="h-[200px] rounded-xl border border-[var(--wk-border)]" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <WkIcon name="AlertCircle" size={32} className="text-wk-text-faint" />
        <p className="text-[14px] font-semibold text-wk-text-muted">Run not found</p>
        <button onClick={() => navigate("/admin/charts/ingest-runs")} className="wk-button wk-button-ghost wk-button-sm">
          Back to Runs
        </button>
      </div>
    );
  }

  const doneStages = run.stages.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneStages / run.stages.length) * 100);
  const canCommit = (run.status === "dry_run_complete" || run.status === "ready_to_commit") && !commitResult;
  const canCancel = run.status === "running" || run.status === "dry_run_complete" || run.status === "ready_to_commit";
  const canRetry = run.status === "failed" || run.status === "cancelled";
  const canSendGaps = run.status === "dry_run_complete" && run.summary.gaps > 0;

  // Get commit readiness for button tooltip
  const commitValidation = (run.status === "dry_run_complete" || run.status === "ready_to_commit")
    ? validateCommitReadiness(run)
    : null;
  const commitButtonTitle = !commitValidation?.canCommit && commitValidation?.errors[0]
    ? commitValidation.errors[0].message
    : "Commit this edition to V2";

  return (
    <div className="space-y-6">
      {/* Commit result panel */}
      {commitResult && (
        <div className="rounded-lg border border-wk-success/20 bg-wk-success-soft p-4">
          <div className="flex items-start gap-3">
            <WkIcon name="CheckCircle2" size={20} className="text-wk-success shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-wk-success mb-1">Edition Committed</p>
              <div className="text-[12px] text-wk-text grid grid-cols-1 sm:grid-cols-2 gap-1">
                <span>Program: <strong className="font-mono">{commitResult.publicSlug}</strong></span>
                <span>Edition: <strong className="font-mono">{commitResult.editionSlug}</strong></span>
                <span>Entries: <strong>{commitResult.entryCount}</strong></span>
                <span>Date: <strong>{commitResult.editionDate}</strong></span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={commitResult.publicUrl}
                  className="inline-flex items-center gap-1 rounded bg-wk-success px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                  onClick={(e) => { e.preventDefault(); navigate(commitResult.publicUrl); }}
                >
                  <WkIcon name="ExternalLink" size={11} />Open Chart
                </a>
                <button
                  onClick={() => navigate("/admin/charts/editions")}
                  className="inline-flex items-center gap-1 rounded border border-wk-success/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-wk-success hover:bg-wk-success-soft"
                >
                  <WkIcon name="LayoutList" size={11} />View in Editions
                </button>
                <button
                  onClick={() => navigate(`/admin/charts/public-api-qa?publicSlug=${commitResult.publicSlug}&editionSlug=${commitResult.editionSlug}`)}
                  className="inline-flex items-center gap-1 rounded border border-wk-success/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-wk-success hover:bg-wk-success-soft"
                >
                  <WkIcon name="TestTube2" size={11} />Test in QA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commit error */}
      {commitError && (
        <div className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-4">
          <div className="flex items-center gap-2">
            <WkIcon name="AlertCircle" size={16} className="text-wk-danger" />
            <div>
              <p className="text-[13px] font-bold text-wk-danger">Commit Failed</p>
              <p className="text-[12px] text-wk-danger/90 mt-0.5">{commitError}</p>
            </div>
            <button
              onClick={() => setCommitError(null)}
              className="ml-auto text-wk-danger hover:text-wk-danger/80"
            >
              <WkIcon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              onClick={() => navigate("/admin/charts/ingest-runs")}
              className="text-[13px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors inline-flex items-center gap-1"
            >
              <WkIcon name="ChevronLeft" size={14} />
              Runs
            </button>
            <WkIcon name="ChevronRight" size={12} className="text-wk-text-faint" />
            <h1 className="text-[18px] font-bold text-wk-text">{run.chartTitle}</h1>
            <RunStatusBadge status={run.status} />
            {isPolling && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-wk-info">
                <span className="h-1.5 w-1.5 rounded-full bg-wk-info animate-pulse" />Live
              </span>
            )}
          </div>
          <p className="text-[12px] text-wk-text-muted">
            {run.id} &bull; {run.editionDate} &bull; {run.chartSize} tracks &bull; {run.market}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCommit && (
            <button
              onClick={handleCommit}
              disabled={actionLoading === "commit" || !commitValidation?.canCommit}
              className={`wk-button whitespace-nowrap disabled:opacity-50 ${
                commitValidation?.canCommit ? "wk-button-primary" : "wk-button-ghost"
              }`}
              title={commitButtonTitle}
            >
              <WkIcon
                name={actionLoading === "commit" ? "Loader" : commitValidation?.canCommit ? "SendHorizontal" : "Lock"}
                size={14}
                className={actionLoading === "commit" ? "animate-spin" : ""}
              />
              {actionLoading === "commit"
                ? "Committing…"
                : commitValidation?.canCommit
                ? "Commit Edition to V2"
                : "Commit Blocked"}
            </button>
          )}
          {canSendGaps && (
            <button
              onClick={handleSendGaps}
              disabled={actionLoading === "gaps"}
              className="wk-button wk-button-ghost whitespace-nowrap disabled:opacity-50"
            >
              <WkIcon name={actionLoading === "gaps" ? "Loader" : "Send"} size={14} className={actionLoading === "gaps" ? "animate-spin" : ""} />
              {actionLoading === "gaps" ? "Sending…" : `Send ${run.summary.gaps} Gaps to Review`}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={actionLoading === "cancel"}
              className="wk-button wk-button-danger whitespace-nowrap disabled:opacity-50"
            >
              <WkIcon name={actionLoading === "cancel" ? "Loader" : "XCircle"} size={14} className={actionLoading === "cancel" ? "animate-spin" : ""} />
              {actionLoading === "cancel" ? "Cancelling…" : "Cancel"}
            </button>
          )}
          {canRetry && (
            <button
              onClick={handleRetry}
              disabled={actionLoading === "retry"}
              className="wk-button wk-button-ghost whitespace-nowrap disabled:opacity-50"
            >
              <WkIcon name={actionLoading === "retry" ? "Loader" : "RefreshCw"} size={14} className={actionLoading === "retry" ? "animate-spin" : ""} />
              {actionLoading === "retry" ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <WkSurface className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <WkIcon name="GitBranch" size={16} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Ingestion Pipeline</h2>
          </div>
          {run.status === "running" && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 rounded-full bg-wk-surface-raised overflow-hidden">
                <div
                  className="h-full rounded-full bg-wk-info transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-wk-info">{progressPct}%</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {run.stages.map((stage, i) => (
            <div key={stage.stage} className="flex items-start gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${stageStatusColor(stage.status)}`}>
                {stage.status === "done" ? <WkIcon name="Check" size={14} /> : <span>{i + 1}</span>}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-wk-text">{stageName(stage.stage)}</span>
                  <span className={`text-[11px] font-semibold ${
                    stage.status === "done" ? "text-wk-success" :
                    stage.status === "running" ? "text-wk-info" :
                    stage.status === "failed" ? "text-wk-danger" :
                    stage.status === "warning" ? "text-wk-warning" :
                    "text-wk-text-muted"
                  }`}>
                    {stageStatusLabel(stage.status)}
                    {stage.durationMs ? ` (${(stage.durationMs / 1000).toFixed(1)}s)` : ""}
                  </span>
                </div>
                {stage.message && (
                  <p className="text-[11px] text-wk-text-muted mt-0.5">{stage.message}</p>
                )}
                {stage.metrics && Object.keys(stage.metrics).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(stage.metrics).map(([k, v]) => (
                      <span key={k} className="rounded-md bg-wk-surface-raised border border-wk-border px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">
                        {k.replace(/_/g, " ")}: {String(v)}
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
        <WkSurface className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <WkIcon name="BarChart3" size={16} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Match Summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Rows", value: run.summary.totalRows, color: "" },
              { label: "Canonical", value: run.summary.canonicalMatches, color: "text-wk-success" },
              { label: "Shells", value: run.summary.shells, color: "text-wk-warning" },
              { label: "Gaps", value: run.summary.gaps, color: "text-wk-danger" },
              { label: "Duplicates", value: run.summary.duplicateCandidates, color: "text-wk-text-soft" },
              { label: "Match Rate", value: `${run.summary.matchRate.toFixed(1)}%`, color: "text-wk-brand" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg bg-wk-surface-raised p-3">
                <p className="text-[11px] text-wk-text-muted mb-1">{label}</p>
                <p className={`text-[20px] font-black ${color || "text-wk-text"}`}>{value}</p>
              </div>
            ))}
          </div>
          {/* Match rate bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-wk-text-muted">Match rate</span>
              <span className="text-[11px] font-semibold text-wk-brand">{run.summary.matchRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-wk-surface-raised overflow-hidden">
              <div
                className={`h-full rounded-full ${run.summary.matchRate >= 85 ? "bg-wk-success" : run.summary.matchRate >= 70 ? "bg-wk-warning" : "bg-wk-danger"}`}
                style={{ width: `${run.summary.matchRate}%` }}
              />
            </div>
          </div>
        </WkSurface>

        <WkSurface className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <WkIcon name="ShieldCheck" size={16} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">Resource Guard</h2>
          </div>
          {guard ? (
            <div className="space-y-2">
              {[
                { label: "Sources", value: String(guard.sourceCount) },
                { label: "Provider Budget Remaining", value: `${guard.providerBudgetRemaining}%` },
                { label: "Worker Concurrency", value: String(guard.workerConcurrency) },
                { label: "Estimated Rows", value: String(guard.estimatedRowCount) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-wk-surface-raised px-3 py-2">
                  <span className="text-[12px] text-wk-text-soft">{label}</span>
                  <span className="text-[12px] font-semibold text-wk-text">{value}</span>
                </div>
              ))}
              {guard.duplicateRunWarning && (
                <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-2.5 flex items-center gap-2 text-[12px] text-wk-warning">
                  <WkIcon name="AlertTriangle" size={14} />
                  {guard.duplicateRunWarning}
                </div>
              )}
              {guard.sameEditionDateWarning && (
                <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-2.5 flex items-center gap-2 text-[12px] text-wk-warning">
                  <WkIcon name="AlertTriangle" size={14} />
                  {guard.sameEditionDateWarning}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <WkIcon name="ShieldOff" size={24} className="text-wk-text-faint" />
              <p className="text-[13px] text-wk-text-muted">Resource guard data not available</p>
            </div>
          )}
        </WkSurface>
      </div>

      {/* Resolved Rows */}
      {run.rows.length > 0 && (
        <WkSurface className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-wk-border">
            <div className="flex items-center gap-2">
              <WkIcon name="ListChecks" size={16} className="text-wk-brand" />
              <h2 className="text-[14px] font-bold text-wk-text">Resolved Rows</h2>
            </div>
            <span className="text-[12px] text-wk-text-muted">{run.rows.length} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-wk-border">
                  {["#", "Track", "Artist", "Provider", "Match", "Confidence", "Candidates", "Warnings"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {run.rows.map((row) => (
                  <tr key={row.id} className="border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50">
                    <td className="px-4 py-3 font-bold text-wk-text">{row.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.artworkUrl && <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />}
                        <span className="font-semibold text-wk-text">{row.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-wk-text-soft">{row.artistNames.join(", ")}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-wk-surface-raised border border-wk-border px-1.5 py-0.5 text-[11px] font-semibold text-wk-text-soft">
                        {row.sourceProvider === "spotify" ? "Spotify" : "Apple"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.matchStatus === "canonical" ? "bg-wk-success-soft text-wk-success" :
                        row.matchStatus === "shell" ? "bg-wk-warning-soft text-wk-warning" :
                        row.matchStatus === "no_match" ? "bg-wk-danger-soft text-wk-danger" :
                        row.matchStatus === "needs_review" ? "bg-wk-info-soft text-wk-info" :
                        "bg-wk-surface-raised text-wk-text-muted"
                      }`}>
                        {row.matchStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-10 rounded-full bg-wk-surface-raised overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.confidence >= 80 ? "bg-wk-success" : row.confidence >= 60 ? "bg-wk-warning" : "bg-wk-danger"}`}
                            style={{ width: `${row.confidence}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-semibold text-wk-text-soft">{row.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-wk-text-muted font-mono">
                        {row.canonicalTrackId
                          ? <span className="text-wk-success">{row.canonicalTrackId.slice(0, 12)}…</span>
                          : row.releaseShellId
                            ? <span className="text-wk-warning">{row.releaseShellId.slice(0, 12)}…</span>
                            : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.warnings && row.warnings.length > 0 ? (
                        <div className="flex items-center gap-1 text-[11px] text-wk-warning">
                          <WkIcon name="AlertTriangle" size={12} />
                          <span>{row.warnings.length} warning{row.warnings.length > 1 ? "s" : ""}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-wk-success">
                          <WkIcon name="Check" size={12} />
                          <span>OK</span>
                        </div>
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
        <div className="rounded-lg border border-wk-danger/30 bg-wk-danger-soft p-4">
          <div className="flex items-center gap-2 mb-1">
            <WkIcon name="AlertCircle" size={16} className="text-wk-danger" />
            <span className="font-bold text-[14px] text-wk-danger">Error</span>
          </div>
          <p className="text-[13px] text-wk-danger">{run.errorMessage}</p>
        </div>
      )}

      {/* Source URLs */}
      <WkSurface className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <WkIcon name="Link" size={14} className="text-wk-text-muted" />
          <h2 className="text-[13px] font-bold text-wk-text">Source URLs</h2>
        </div>
        <div className="space-y-1.5">
          {run.sourceUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <WkIcon name={url.includes("spotify") ? "Music" : url.includes("apple") ? "Disc3" : "Globe"} size={12} className="text-wk-text-faint shrink-0" />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-mono text-[11px] text-wk-brand hover:underline break-all"
              >
                {url}
              </a>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/admin/charts/ingest-health")}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors"
          >
            <WkIcon name="HeartPulse" size={14} />
            API Health &amp; Endpoint Map
          </button>
          <button
            onClick={() => navigate("/admin/charts/review-queue")}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors"
          >
            <WkIcon name="GitPullRequest" size={14} />
            Review Queue
          </button>
        </div>
      </WkSurface>
    </div>
  );
}