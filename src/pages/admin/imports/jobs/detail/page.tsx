import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface IngestRun {
  id: string;
  source_name: string;
  source_kind: string;
  source_manifest: Record<string, unknown>;
  status: string;
  imported_counts: Record<string, number> | null;
  warnings: string[] | null;
  errors: string[] | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

type PipelineStage = "upload" | "validate" | "stage" | "promote";

interface StageInfo {
  key: PipelineStage;
  label: string;
  icon: string;
  description: string;
}

const STAGES: StageInfo[] = [
  { key: "upload", label: "Upload", icon: "UploadCloud", description: "Archive received and extracted" },
  { key: "validate", label: "Validate", icon: "ShieldCheck", description: "Schema checks and integrity validation" },
  { key: "stage", label: "Stage", icon: "Database", description: "Records inserted into staging tables" },
  { key: "promote", label: "Promote", icon: "CheckCircle", description: "Moved to production with index rebuild" },
];

const STATUS_STAGE_MAP: Record<string, PipelineStage> = {
  queued: "upload",
  running: "stage",
  validating: "validate",
  staging: "stage",
  promoting: "promote",
  completed: "promote",
  failed: "validate",
  paused: "stage",
};

export default function AdminImportsJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<IngestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "errors" | "records">("overview");
  const [promoting, setPromoting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase
        .from("wk_ingestion_runs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        console.error("Error loading import job:", error);
      } else {
        setRun(data);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handlePromote() {
    if (!run || !id) return;
    setPromoting(true);
    await supabase
      .from("wk_ingestion_runs")
      .update({ status: "promoting", started_at: new Date().toISOString() })
      .eq("id", id);
    // Simulate promotion
    await new Promise((r) => setTimeout(r, 2000));
    await supabase
      .from("wk_ingestion_runs")
      .update({ status: "completed", finished_at: new Date().toISOString() })
      .eq("id", id);
    const { data } = await supabase.from("wk_ingestion_runs").select("*").eq("id", id).single();
    setRun(data);
    setPromoting(false);
  }

  async function handleRetry() {
    if (!run || !id) return;
    setRetrying(true);
    await supabase
      .from("wk_ingestion_runs")
      .update({ status: "queued", errors: [], warnings: [], finished_at: null })
      .eq("id", id);
    // Simulate retry
    await new Promise((r) => setTimeout(r, 2500));
    await supabase
      .from("wk_ingestion_runs")
      .update({ status: "completed", finished_at: new Date().toISOString() })
      .eq("id", id);
    const { data } = await supabase.from("wk_ingestion_runs").select("*").eq("id", id).single();
    setRun(data);
    setRetrying(false);
  }

  async function handleArchive() {
    if (!run || !id) return;
    await supabase
      .from("wk_ingestion_runs")
      .update({ status: "archived" })
      .eq("id", id);
    const { data } = await supabase.from("wk_ingestion_runs").select("*").eq("id", id).single();
    setRun(data);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 rounded bg-wk-surface-raised" />
          <div className="h-4 w-32 rounded bg-wk-surface-raised" />
        </div>
        <div className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-6">
          <div className="h-32 rounded bg-wk-surface-raised" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised">
          <WkIcon name="FileX" size={28} className="text-wk-text-muted" />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text">Import job not found</h2>
        <p className="mt-2 text-[13px] text-wk-text-muted">
          The import job you're looking for doesn't exist or was deleted.
        </p>
        <button
          onClick={() => navigate("/admin/imports/jobs")}
          className="mt-4 wk-button wk-button-primary wk-button-sm"
        >
          Back to Import Jobs
        </button>
      </div>
    );
  }

  const currentStage = STATUS_STAGE_MAP[run.status] || "upload";
  const stageIndex = STAGES.findIndex((s) => s.key === currentStage);
  const isFailed = run.status === "failed";
  const isCompleted = run.status === "completed";
  const isQueued = run.status === "queued";
  const isRunning = run.status === "running" || run.status === "validating" || run.status === "staging" || run.status === "promoting";

  const totalImported = run.imported_counts
    ? Object.values(run.imported_counts).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            <button
              onClick={() => navigate("/admin/imports/jobs")}
              className="hover:text-wk-brand-600 transition-colors"
            >
              Imports
            </button>
            <WkIcon name="ChevronRight" size={12} />
            <span>Job Detail</span>
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">{run.source_name}</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {run.source_kind} · {new Date(run.created_at).toLocaleString()} · {totalImported} items
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isQueued && (
            <button
              onClick={handlePromote}
              disabled={promoting}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name={promoting ? "Loader2" : "Play"} size={14} />
              {promoting ? "Starting..." : "Start Import"}
            </button>
          )}
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name={retrying ? "Loader2" : "RefreshCw"} size={14} />
              {retrying ? "Retrying..." : "Retry Import"}
            </button>
          )}
          {isCompleted && (
            <button
              onClick={handleArchive}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="Archive" size={14} />
              Archive
            </button>
          )}
          <button
            onClick={() => navigate("/admin/imports/jobs")}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={14} />
            Back
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-xl border p-4 ${
          isCompleted
            ? "border-wk-success/20 bg-wk-success-soft"
            : isFailed
            ? "border-wk-danger/20 bg-wk-danger-soft"
            : isRunning
            ? "border-wk-info/20 bg-wk-info-soft"
            : "border-wk-warning/20 bg-wk-warning-soft"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface">
            <WkIcon
              name={
                isCompleted
                  ? "CheckCircle2"
                  : isFailed
                  ? "XCircle"
                  : isRunning
                  ? "Loader2"
                  : "Clock"
              }
              size={20}
              className={
                isCompleted
                  ? "text-wk-success"
                  : isFailed
                  ? "text-wk-danger"
                  : isRunning
                  ? "text-wk-info"
                  : "text-wk-warning"
              }
            />
          </div>
          <div>
            <div className="text-[14px] font-bold text-wk-text">
              {isCompleted
                ? "Import completed successfully"
                : isFailed
                ? "Import failed"
                : isRunning
                ? "Import in progress"
                : "Import queued"}
            </div>
            <div className="text-[12px] text-wk-text-muted">
              {run.started_at
                ? `Started: ${new Date(run.started_at).toLocaleString()}`
                : "Not started yet"}
              {run.finished_at && ` · Finished: ${new Date(run.finished_at).toLocaleString()}`}
            </div>
          </div>
          <div className="ml-auto">
            <StatusBadge status={run.status} />
          </div>
        </div>
      </div>

      {/* Pipeline Progress */}
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-wk-text">Pipeline Progress</h2>
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-5 top-5 hidden h-1 w-[calc(100%-40px)] md:block">
            <div className="h-full w-full rounded-full bg-wk-border" />
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-wk-brand transition-all duration-500"
              style={{ width: `${Math.max(0, (stageIndex / (STAGES.length - 1)) * 100)}%` }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {STAGES.map((stage, idx) => {
              const isComplete = idx < stageIndex || isCompleted;
              const isCurrent = idx === stageIndex && !isCompleted && !isFailed;
              const isStageFailed = isFailed && stage.key === "validate";
              return (
                <div key={stage.key} className="relative flex flex-col items-center text-center">
                  <div
                    className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                      isStageFailed
                        ? "border-wk-danger bg-wk-danger text-white"
                        : isComplete
                        ? "border-wk-brand bg-wk-brand text-white"
                        : isCurrent
                        ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                        : "border-wk-border bg-wk-surface text-wk-text-muted"
                    }`}
                  >
                    <WkIcon
                      name={
                        isStageFailed
                          ? "XCircle"
                          : isComplete
                          ? "Check"
                          : stage.icon
                      }
                      size={16}
                    />
                  </div>
                  <div className="mt-2">
                    <div className="text-[13px] font-bold text-wk-text">{stage.label}</div>
                    <div className="text-[11px] text-wk-text-muted">{stage.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </WkSurface>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-wk-border">
        {[
          { key: "overview", label: "Overview", icon: "LayoutDashboard" },
          { key: "logs", label: "Logs", icon: "ScrollText" },
          { key: "errors", label: "Errors", icon: "AlertCircle" },
          { key: "records", label: "Records", icon: "List" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${
              activeTab === tab.key
                ? "border-wk-brand text-wk-brand"
                : "border-transparent text-wk-text-muted hover:text-wk-text"
            }`}
          >
            <WkIcon name={tab.icon as never} size={14} />
            {tab.label}
            {tab.key === "errors" && (run.errors?.length ?? 0) > 0 && (
              <span className="rounded-full bg-wk-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                {run.errors?.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Imported Counts */}
            <WkSurface className="p-5">
              <h3 className="mb-4 text-[14px] font-bold text-wk-text">Imported Records</h3>
              {run.imported_counts && Object.keys(run.imported_counts).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(run.imported_counts).map(([key, count]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3"
                    >
                      <div className="text-[18px] font-black text-wk-text">{count}</div>
                      <div className="text-[11px] font-semibold text-wk-text-muted uppercase tracking-wider">
                        {key}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
                  <p className="text-[13px] text-wk-text-muted">No records imported yet.</p>
                </div>
              )}
            </WkSurface>

            {/* Warnings */}
            {(run.warnings?.length ?? 0) > 0 && (
              <WkSurface className="p-5">
                <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text">
                  <WkIcon name="AlertTriangle" size={16} className="text-wk-warning" />
                  Warnings ({run.warnings?.length})
                </h3>
                <div className="space-y-2">
                  {run.warnings?.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3"
                    >
                      <WkIcon name="AlertTriangle" size={14} className="mt-0.5 text-wk-warning" />
                      <span className="text-[12px] text-wk-text">{warning}</span>
                    </div>
                  ))}
                </div>
              </WkSurface>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            <WkSurface className="p-5">
              <h3 className="mb-3 text-[14px] font-bold text-wk-text">Job Info</h3>
              <div className="space-y-3">
                <InfoRow label="ID" value={run.id} />
                <InfoRow label="Source" value={run.source_name} />
                <InfoRow label="Kind" value={run.source_kind} />
                <InfoRow label="Status" value={run.status} />
                <InfoRow
                  label="Created"
                  value={new Date(run.created_at).toLocaleString()}
                />
                {run.started_at && (
                  <InfoRow label="Started" value={new Date(run.started_at).toLocaleString()} />
                )}
                {run.finished_at && (
                  <InfoRow label="Finished" value={new Date(run.finished_at).toLocaleString()} />
                )}
              </div>
            </WkSurface>

            <WkSurface className="p-5">
              <h3 className="mb-3 text-[14px] font-bold text-wk-text">Manifest</h3>
              <pre className="max-h-60 overflow-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-[11px] text-wk-text">
                {JSON.stringify(run.source_manifest, null, 2)}
              </pre>
            </WkSurface>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[14px] font-bold text-wk-text">Activity Logs</h3>
          <div className="space-y-2">
            {[
              { time: run.created_at, message: "Job created", level: "info" },
              run.started_at && { time: run.started_at, message: "Import started", level: "info" },
              run.status === "validating" && { time: new Date().toISOString(), message: "Validation in progress", level: "info" },
              run.status === "staging" && { time: new Date().toISOString(), message: "Staging records", level: "info" },
              run.status === "promoting" && { time: new Date().toISOString(), message: "Promoting to production", level: "info" },
              run.finished_at && { time: run.finished_at, message: "Import completed", level: "success" },
            ]
              .filter(Boolean)
              .map((log, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-wk-border p-3">
                  <div
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      log.level === "success"
                        ? "bg-wk-success"
                        : log.level === "warning"
                        ? "bg-wk-warning"
                        : "bg-wk-info"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-wk-text">{log.message}</div>
                    <div className="text-[11px] text-wk-text-muted">
                      {new Date(log.time).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </WkSurface>
      )}

      {activeTab === "errors" && (
        <WkSurface className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text">
            <WkIcon name="AlertCircle" size={16} className="text-wk-danger" />
            Errors ({run.errors?.length ?? 0})
          </h3>
          {(run.errors?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {run.errors?.map((error, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3"
                >
                  <WkIcon name="XCircle" size={14} className="mt-0.5 text-wk-danger" />
                  <span className="text-[12px] text-wk-text">{error}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
              <WkIcon name="CheckCircle2" size={24} className="mx-auto mb-2 text-wk-success" />
              <p className="text-[13px] text-wk-text-muted">No errors recorded.</p>
            </div>
          )}
        </WkSurface>
      )}

      {activeTab === "records" && (
        <WkSurface className="p-5">
          <h3 className="mb-3 text-[14px] font-bold text-wk-text">Record Breakdown</h3>
          {run.imported_counts && Object.keys(run.imported_counts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(run.imported_counts).map(([key, count]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-brand-soft">
                      <WkIcon name="FileText" size={14} className="text-wk-brand" />
                    </div>
                    <span className="text-[13px] font-semibold text-wk-text capitalize">{key}</span>
                  </div>
                  <div className="text-[14px] font-bold text-wk-text">{count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center">
              <p className="text-[13px] text-wk-text-muted">No records imported yet.</p>
            </div>
          )}
        </WkSurface>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "bg-wk-success-soft text-wk-success"
      : status === "running" || status === "validating" || status === "staging" || status === "promoting"
      ? "bg-wk-info-soft text-wk-info"
      : status === "failed"
      ? "bg-wk-danger-soft text-wk-danger"
      : status === "queued"
      ? "bg-wk-warning-soft text-wk-warning"
      : "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase ${color}`}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[12px] font-semibold text-wk-text-muted">{label}</span>
      <span className="text-[12px] text-wk-text text-right">{value}</span>
    </div>
  );
}