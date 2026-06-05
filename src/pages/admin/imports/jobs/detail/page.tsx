import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIngestionRun, totalImported, type IngestionRun } from "@/services/migrationImportJobs";

const RUNNING_STATUSES = new Set(["running", "validating", "staging", "promoting", "processing"]);

export default function AdminImportsJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<IngestionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "manifest" | "warnings" | "errors">("overview");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setRun(await getIngestionRun(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load import job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="space-y-4"><div className="h-7 w-56 animate-pulse rounded bg-wk-surface-raised" /><div className="h-40 animate-pulse rounded-xl border border-wk-border bg-wk-surface" /></div>;
  }

  if (error) {
    return <EmptyState icon="AlertCircle" title="Could not load import job" body={error} actionLabel="Back to jobs" onAction={() => navigate("/admin/imports/jobs")} />;
  }

  if (!run) {
    return <EmptyState icon="FileX" title="Import job not found" body="The import job does not exist or you do not have access to it." actionLabel="Back to jobs" onAction={() => navigate("/admin/imports/jobs")} />;
  }

  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";
  const isRunning = RUNNING_STATUSES.has(run.status);
  const isQueued = run.status === "queued";
  const importedTotal = totalImported(run);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            <button onClick={() => navigate("/admin/imports/jobs")} className="hover:text-wk-brand-600">Imports</button>
            <WkIcon name="ChevronRight" size={12} />
            <span>Job Detail</span>
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">{run.source_name}</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">{run.source_kind} · created {new Date(run.created_at).toLocaleString()} · {importedTotal} imported records</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void load()} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><WkIcon name="RefreshCw" size={14} /> Refresh real status</button>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="ArrowLeft" size={14} /> Back</button>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${isCompleted ? "border-wk-success/20 bg-wk-success-soft" : isFailed ? "border-wk-danger/20 bg-wk-danger-soft" : isRunning ? "border-wk-info/20 bg-wk-info-soft" : "border-wk-warning/20 bg-wk-warning-soft"}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface">
            <WkIcon name={isCompleted ? "CheckCircle2" : isFailed ? "XCircle" : isRunning ? "Loader2" : "Clock"} size={20} className={isCompleted ? "text-wk-success" : isFailed ? "text-wk-danger" : isRunning ? "text-wk-info" : "text-wk-warning"} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-wk-text">
              {isCompleted ? "Import completed by backend processor" : isFailed ? "Import failed in backend processor" : isRunning ? "Backend processor is working" : isQueued ? "Queued for backend processor" : `Status: ${run.status}`}
            </div>
            <div className="text-[12px] text-wk-text-muted">
              {run.started_at ? `Started: ${new Date(run.started_at).toLocaleString()}` : "Not started yet"}
              {run.finished_at ? ` · Finished: ${new Date(run.finished_at).toLocaleString()}` : ""}
            </div>
          </div>
          <div className="ml-auto"><StatusBadge status={run.status} /></div>
        </div>
      </div>

      {(isQueued || !run.started_at) && (
        <WkSurface className="border-wk-warning/30 bg-wk-warning-soft/40 p-5">
          <div className="flex items-start gap-3">
            <WkIcon name="Info" size={18} className="mt-0.5 text-wk-warning" />
            <div>
              <h2 className="text-[14px] font-black text-wk-text">Waiting for a real backend processor</h2>
              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">This UI will not mark the job as started, validated, staged, promoted, completed or failed by itself. A backend worker must read the uploaded archive, process it, and update this row.</p>
            </div>
          </div>
        </WkSurface>
      )}

      <div className="flex flex-wrap items-center gap-1 border-b border-wk-border">
        {[
          { key: "overview", label: "Overview", icon: "LayoutDashboard" },
          { key: "manifest", label: "Manifest", icon: "FileJson" },
          { key: "warnings", label: "Warnings", icon: "AlertTriangle", count: run.warnings?.length ?? 0 },
          { key: "errors", label: "Errors", icon: "AlertCircle", count: run.errors?.length ?? 0 },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${activeTab === tab.key ? "border-wk-brand text-wk-brand" : "border-transparent text-wk-text-muted hover:text-wk-text"}`}>
            <WkIcon name={tab.icon as never} size={14} />{tab.label}{typeof tab.count === "number" && tab.count > 0 && <span className="rounded-full bg-wk-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{tab.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab run={run} />}
      {activeTab === "manifest" && <JsonPanel title="Source Manifest" value={run.source_manifest ?? {}} />}
      {activeTab === "warnings" && <ListPanel title="Warnings" icon="AlertTriangle" tone="warning" items={run.warnings ?? []} empty="No warnings recorded by the backend processor." />}
      {activeTab === "errors" && <ListPanel title="Errors" icon="AlertCircle" tone="danger" items={run.errors ?? []} empty="No errors recorded by the backend processor." />}
    </div>
  );
}

function OverviewTab({ run }: { run: IngestionRun }) {
  const counts = run.imported_counts ?? {};
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <WkSurface className="p-5">
          <h3 className="mb-4 text-[14px] font-bold text-wk-text">Imported Records</h3>
          {Object.keys(counts).length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(counts).map(([key, count]) => <div key={key} className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3"><div className="text-[18px] font-black text-wk-text">{count}</div><div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{key}</div></div>)}
            </div>
          ) : <HonestEmpty body="No imported counts have been written by the backend processor yet." />}
        </WkSurface>
      </div>
      <div className="space-y-4">
        <WkSurface className="p-5"><h3 className="mb-3 text-[14px] font-bold text-wk-text">Job Info</h3><div className="space-y-3"><InfoRow label="ID" value={run.id} /><InfoRow label="Source" value={run.source_name} /><InfoRow label="Kind" value={run.source_kind} /><InfoRow label="Status" value={run.status} /><InfoRow label="Created" value={new Date(run.created_at).toLocaleString()} />{run.started_at && <InfoRow label="Started" value={new Date(run.started_at).toLocaleString()} />}{run.finished_at && <InfoRow label="Finished" value={new Date(run.finished_at).toLocaleString()} />}</div></WkSurface>
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) { return <WkSurface className="p-5"><h3 className="mb-3 text-[14px] font-bold text-wk-text">{title}</h3><pre className="max-h-[520px] overflow-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-[11px] leading-5 text-wk-text">{JSON.stringify(value, null, 2)}</pre></WkSurface>; }
function ListPanel({ title, icon, tone, items, empty }: { title: string; icon: string; tone: "warning" | "danger"; items: string[]; empty: string }) { const toneClass = tone === "danger" ? "border-wk-danger/20 bg-wk-danger-soft text-wk-danger" : "border-wk-warning/20 bg-wk-warning-soft text-wk-warning"; return <WkSurface className="p-5"><h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text"><WkIcon name={icon as never} size={16} className={tone === "danger" ? "text-wk-danger" : "text-wk-warning"} />{title} ({items.length})</h3>{items.length > 0 ? <div className="space-y-2">{items.map((item, index) => <div key={`${item}-${index}`} className={`rounded-lg border p-3 text-[12px] ${toneClass}`}>{item}</div>)}</div> : <HonestEmpty body={empty} />}</WkSurface>; }
function HonestEmpty({ body }: { body: string }) { return <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center"><p className="text-[13px] text-wk-text-muted">{body}</p></div>; }
function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body: string; actionLabel: string; onAction: () => void }) { return <div className="py-20 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised"><WkIcon name={icon as never} size={28} className="text-wk-text-muted" /></div><h2 className="text-[18px] font-bold text-wk-text">{title}</h2><p className="mt-2 text-[13px] text-wk-text-muted">{body}</p><button onClick={onAction} className="mt-4 wk-button wk-button-primary wk-button-sm">{actionLabel}</button></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === "completed" ? "bg-wk-success-soft text-wk-success" : RUNNING_STATUSES.has(status) ? "bg-wk-info-soft text-wk-info" : status === "failed" ? "bg-wk-danger-soft text-wk-danger" : status === "queued" ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-surface-raised text-wk-text-muted"; return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase ${color}`}>{status}</span>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><span className="text-[12px] font-semibold text-wk-text-muted">{label}</span><span className="text-right text-[12px] text-wk-text">{value}</span></div>; }
