import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIngestionRun, totalImported, type IngestionRun } from "@/services/migrationImportJobs";

const RUNNING_STATUSES = new Set(["running", "validating", "staging", "promoting", "processing", "scanning"]);

type ScanEvidence = {
  csv_headers?: Array<{ path: string; kind: string; headers: string[]; rows: number }>;
  json_keys?: Array<{ path: string; kind: string; keys: string[] }>;
  wxr_post_types?: Record<string, number>;
  sql_tables?: string[];
};

type ScanManifest = {
  scanned_at?: string;
  archive?: { file_count?: number; total_uncompressed_bytes?: number };
  counts?: Record<string, number>;
  detected?: string[];
  files?: Array<{ path: string; size: number; extension: string; kind: string; rows?: number; headers?: string[]; warning?: string }>;
  evidence?: ScanEvidence;
  warnings?: string[];
};

type MappingCandidate = {
  id: string;
  source: { entity: string; field: string; file?: string; evidence: string };
  target: { entity: string; field: string };
  confidence: number;
  status: "auto_matched" | "needs_review" | "ignored";
  reason: string;
};

type MappingManifest = {
  discovered_at?: string;
  processor?: string;
  version?: string;
  summary?: { total?: number; auto_matched?: number; needs_review?: number };
  candidates?: MappingCandidate[];
};

function getScan(run: IngestionRun): ScanManifest | null {
  const scan = run.source_manifest?.scan;
  return scan && typeof scan === "object" ? scan as ScanManifest : null;
}

function getMappings(run: IngestionRun): MappingManifest | null {
  const mappings = run.source_manifest?.mappings;
  return mappings && typeof mappings === "object" ? mappings as MappingManifest : null;
}

export default function AdminImportsJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<IngestionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "scan" | "mappings" | "manifest" | "warnings" | "errors">("overview");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try { setRun(await getIngestionRun(id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load import job."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="space-y-4"><div className="h-7 w-56 animate-pulse rounded bg-wk-surface-raised" /><div className="h-40 animate-pulse rounded-xl border border-wk-border bg-wk-surface" /></div>;
  if (error) return <EmptyState icon="AlertCircle" title="Could not load import job" body={error} actionLabel="Back to jobs" onAction={() => navigate("/admin/imports/jobs")} />;
  if (!run) return <EmptyState icon="FileX" title="Import job not found" body="The import job does not exist or you do not have access to it." actionLabel="Back to jobs" onAction={() => navigate("/admin/imports/jobs")} />;

  const scan = getScan(run);
  const mappings = getMappings(run);
  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";
  const isRunning = RUNNING_STATUSES.has(run.status);
  const isQueued = run.status === "queued";
  const importedTotal = totalImported(run);
  const mappingCount = mappings?.candidates?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-wk-brand"><button onClick={() => navigate("/admin/imports/jobs")} className="hover:text-wk-brand-600">Imports</button><WkIcon name="ChevronRight" size={12} /><span>Job Detail</span></div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">{run.source_name}</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">{run.source_kind} · created {new Date(run.created_at).toLocaleString()} · {importedTotal} imported records</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><button onClick={() => void load()} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><WkIcon name="RefreshCw" size={14} /> Refresh real status</button><button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="ArrowLeft" size={14} /> Back</button></div>
      </div>

      <div className={`rounded-xl border p-4 ${isCompleted ? "border-wk-success/20 bg-wk-success-soft" : isFailed ? "border-wk-danger/20 bg-wk-danger-soft" : isRunning ? "border-wk-info/20 bg-wk-info-soft" : "border-wk-warning/20 bg-wk-warning-soft"}`}>
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface"><WkIcon name={isCompleted ? "CheckCircle2" : isFailed ? "XCircle" : isRunning ? "Loader2" : "Clock"} size={20} className={isCompleted ? "text-wk-success" : isFailed ? "text-wk-danger" : isRunning ? "text-wk-info" : "text-wk-warning"} /></div><div><div className="text-[14px] font-bold text-wk-text">{isCompleted ? "Import completed by backend processor" : isFailed ? "Import failed in backend processor" : isRunning ? "Backend processor is working" : isQueued ? "Queued for backend processor" : `Status: ${run.status}`}</div><div className="text-[12px] text-wk-text-muted">{run.started_at ? `Started: ${new Date(run.started_at).toLocaleString()}` : "Not started yet"}{run.finished_at ? ` · Finished: ${new Date(run.finished_at).toLocaleString()}` : ""}</div></div><div className="ml-auto"><StatusBadge status={run.status} /></div></div>
      </div>

      {(isQueued || !run.started_at) && <WkSurface className="border-wk-warning/30 bg-wk-warning-soft/40 p-5"><div className="flex items-start gap-3"><WkIcon name="Info" size={18} className="mt-0.5 text-wk-warning" /><div><h2 className="text-[14px] font-black text-wk-text">Waiting for a real backend processor</h2><p className="mt-1 text-[12px] leading-5 text-wk-text-muted">This UI will not mark the job as started, validated, staged, promoted, completed or failed by itself. A backend worker must read the uploaded archive, process it, and update this row.</p></div></div></WkSurface>}

      <div className="flex flex-wrap items-center gap-1 border-b border-wk-border">
        {[
          { key: "overview", label: "Overview", icon: "LayoutDashboard" },
          { key: "scan", label: "Scan", icon: "ScanSearch", count: scan ? 1 : 0 },
          { key: "mappings", label: "Mappings", icon: "GitCompare", count: mappingCount },
          { key: "manifest", label: "Manifest", icon: "FileJson" },
          { key: "warnings", label: "Warnings", icon: "AlertTriangle", count: run.warnings?.length ?? 0 },
          { key: "errors", label: "Errors", icon: "AlertCircle", count: run.errors?.length ?? 0 },
        ].map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors ${activeTab === tab.key ? "border-wk-brand text-wk-brand" : "border-transparent text-wk-text-muted hover:text-wk-text"}`}><WkIcon name={tab.icon as never} size={14} />{tab.label}{typeof tab.count === "number" && tab.count > 0 && <span className="rounded-full bg-wk-brand px-1.5 py-0.5 text-[10px] font-bold text-black">{tab.count}</span>}</button>)}
      </div>

      {activeTab === "overview" && <OverviewTab run={run} scan={scan} mappings={mappings} />}
      {activeTab === "scan" && <ScanTab scan={scan} />}
      {activeTab === "mappings" && <MappingsTab mappings={mappings} />}
      {activeTab === "manifest" && <JsonPanel title="Source Manifest" value={run.source_manifest ?? {}} />}
      {activeTab === "warnings" && <ListPanel title="Warnings" icon="AlertTriangle" tone="warning" items={run.warnings ?? []} empty="No warnings recorded by the backend processor." />}
      {activeTab === "errors" && <ListPanel title="Errors" icon="AlertCircle" tone="danger" items={run.errors ?? []} empty="No errors recorded by the backend processor." />}
    </div>
  );
}

function OverviewTab({ run, scan, mappings }: { run: IngestionRun; scan: ScanManifest | null; mappings: MappingManifest | null }) {
  const counts = run.imported_counts ?? {};
  return <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><WkSurface className="p-5"><h3 className="mb-4 text-[14px] font-bold text-wk-text">Imported Records</h3>{Object.keys(counts).length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(counts).map(([key, count]) => <Metric key={key} label={key} value={count} />)}</div> : <HonestEmpty body="No imported counts have been written by the backend processor yet." />}</WkSurface><WkSurface className="p-5"><h3 className="mb-4 text-[14px] font-bold text-wk-text">Real Scan / Mapping Progress</h3><div className="grid gap-3 sm:grid-cols-3"><Metric label="Scanned files" value={scan?.archive?.file_count ?? 0} /><Metric label="Count groups" value={Object.keys(scan?.counts ?? {}).length} /><Metric label="Mappings" value={mappings?.candidates?.length ?? 0} /></div></WkSurface></div><div className="space-y-4"><WkSurface className="p-5"><h3 className="mb-3 text-[14px] font-bold text-wk-text">Job Info</h3><div className="space-y-3"><InfoRow label="ID" value={run.id} /><InfoRow label="Source" value={run.source_name} /><InfoRow label="Kind" value={run.source_kind} /><InfoRow label="Status" value={run.status} /><InfoRow label="Created" value={new Date(run.created_at).toLocaleString()} />{run.started_at && <InfoRow label="Started" value={new Date(run.started_at).toLocaleString()} />}{run.finished_at && <InfoRow label="Finished" value={new Date(run.finished_at).toLocaleString()} />}</div></WkSurface></div></div>;
}

function ScanTab({ scan }: { scan: ScanManifest | null }) {
  if (!scan) return <HonestEmpty body="No scan has been written to source_manifest.scan yet. Run the real ZIP processor first." />;
  const counts = scan.counts ?? {};
  const csvEvidence = scan.evidence?.csv_headers ?? [];
  const jsonEvidence = scan.evidence?.json_keys ?? [];
  const wxrPostTypes = scan.evidence?.wxr_post_types ?? {};
  const sqlTables = scan.evidence?.sql_tables ?? [];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Files" value={scan.archive?.file_count ?? 0} /><Metric label="Uncompressed MB" value={Math.round((scan.archive?.total_uncompressed_bytes ?? 0) / 1024 / 1024)} /><Metric label="Detected groups" value={(scan.detected ?? []).length} /></div><WkSurface className="p-5"><h3 className="mb-4 text-[14px] font-bold text-wk-text">Counts from real scan</h3>{Object.keys(counts).length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(counts).map(([key, count]) => <Metric key={key} label={key} value={count} />)}</div> : <HonestEmpty body="The scan did not produce count groups." />}</WkSurface><WkSurface className="p-5"><h3 className="mb-4 text-[14px] font-bold text-wk-text">Detected evidence</h3><div className="space-y-4"><EvidenceBlock title="CSV headers" rows={csvEvidence.map((item) => ({ label: `${item.kind} · ${item.rows} rows`, body: `${item.path}\n${item.headers.join(', ')}` }))} /><EvidenceBlock title="JSON keys" rows={jsonEvidence.map((item) => ({ label: item.kind, body: `${item.path}\n${item.keys.join(', ')}` }))} /><EvidenceBlock title="WXR post types" rows={Object.entries(wxrPostTypes).map(([key, value]) => ({ label: key, body: `${value} items` }))} /><EvidenceBlock title="SQL tables" rows={sqlTables.map((table) => ({ label: table, body: "Detected in SQL dump" }))} /></div></WkSurface></div>;
}

function MappingsTab({ mappings }: { mappings: MappingManifest | null }) {
  const candidates = mappings?.candidates ?? [];
  if (!mappings) return <HonestEmpty body="No mappings have been written to source_manifest.mappings yet. Run the real mapping discovery processor first." />;
  return <div className="space-y-5"><WkSurface className="p-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Total" value={mappings.summary?.total ?? candidates.length} /><Metric label="Auto matched" value={mappings.summary?.auto_matched ?? candidates.filter((item) => item.status === 'auto_matched').length} /><Metric label="Needs review" value={mappings.summary?.needs_review ?? candidates.filter((item) => item.status === 'needs_review').length} /></div></WkSurface><div className="space-y-3">{candidates.map((item) => <div key={item.id} className="rounded-2xl border border-wk-border bg-wk-bg-subtle p-4"><div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center"><div><p className="text-[10px] font-black uppercase tracking-wider text-wk-text-muted">Source</p><h3 className="mt-1 text-[14px] font-black text-wk-text">{item.source.entity}.{item.source.field}</h3><p className="mt-1 whitespace-pre-wrap text-[11px] text-wk-text-muted">{item.source.evidence}</p></div><div className="hidden text-wk-brand lg:block">→</div><div><p className="text-[10px] font-black uppercase tracking-wider text-wk-text-muted">Target</p><h3 className="mt-1 text-[14px] font-black text-wk-text">{item.target.entity}.{item.target.field}</h3><p className="mt-1 text-[11px] text-wk-text-muted">{item.reason}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-wk-surface px-3 py-1 text-[11px] font-black text-wk-text-muted">{Math.round(item.confidence * 100)}% confidence</span><span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${item.status === 'auto_matched' ? 'bg-wk-success-soft text-wk-success' : 'bg-wk-warning-soft text-wk-warning'}`}>{item.status.replace('_', ' ')}</span></div></div>)}</div></div>;
}

function EvidenceBlock({ title, rows }: { title: string; rows: Array<{ label: string; body: string }> }) { if (!rows.length) return null; return <div><h4 className="mb-2 text-[12px] font-black uppercase tracking-wider text-wk-text-muted">{title}</h4><div className="space-y-2">{rows.slice(0, 20).map((row, index) => <div key={`${title}-${index}`} className="rounded-lg border border-wk-border bg-wk-surface-raised p-3"><div className="text-[12px] font-black text-wk-text">{row.label}</div><pre className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-wk-text-muted">{row.body}</pre></div>)}</div>{rows.length > 20 && <p className="mt-2 text-[11px] text-wk-text-muted">Showing first 20 of {rows.length}.</p>}</div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3"><div className="text-[18px] font-black text-wk-text">{Number(value).toLocaleString()}</div><div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{label}</div></div>; }
function JsonPanel({ title, value }: { title: string; value: unknown }) { return <WkSurface className="p-5"><h3 className="mb-3 text-[14px] font-bold text-wk-text">{title}</h3><pre className="max-h-[520px] overflow-auto rounded-lg border border-wk-border bg-wk-bg-subtle p-3 text-[11px] leading-5 text-wk-text">{JSON.stringify(value, null, 2)}</pre></WkSurface>; }
function ListPanel({ title, icon, tone, items, empty }: { title: string; icon: string; tone: "warning" | "danger"; items: string[]; empty: string }) { const toneClass = tone === "danger" ? "border-wk-danger/20 bg-wk-danger-soft text-wk-danger" : "border-wk-warning/20 bg-wk-warning-soft text-wk-warning"; return <WkSurface className="p-5"><h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-wk-text"><WkIcon name={icon as never} size={16} className={tone === "danger" ? "text-wk-danger" : "text-wk-warning"} />{title} ({items.length})</h3>{items.length > 0 ? <div className="space-y-2">{items.map((item, index) => <div key={`${item}-${index}`} className={`rounded-lg border p-3 text-[12px] ${toneClass}`}>{item}</div>)}</div> : <HonestEmpty body={empty} />}</WkSurface>; }
function HonestEmpty({ body }: { body: string }) { return <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-6 text-center"><p className="text-[13px] text-wk-text-muted">{body}</p></div>; }
function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body: string; actionLabel: string; onAction: () => void }) { return <div className="py-20 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wk-surface-raised"><WkIcon name={icon as never} size={28} className="text-wk-text-muted" /></div><h2 className="text-[18px] font-bold text-wk-text">{title}</h2><p className="mt-2 text-[13px] text-wk-text-muted">{body}</p><button onClick={onAction} className="mt-4 wk-button wk-button-primary wk-button-sm">{actionLabel}</button></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === "completed" ? "bg-wk-success-soft text-wk-success" : RUNNING_STATUSES.has(status) ? "bg-wk-info-soft text-wk-info" : status === "failed" ? "bg-wk-danger-soft text-wk-danger" : status === "queued" ? "bg-wk-warning-soft text-wk-warning" : status === "mapped" || status === "scanned" ? "bg-wk-brand-soft text-wk-brand" : "bg-wk-surface-raised text-wk-text-muted"; return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase ${color}`}>{status}</span>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><span className="text-[12px] font-semibold text-wk-text-muted">{label}</span><span className="text-right text-[12px] text-wk-text">{value}</span></div>; }
