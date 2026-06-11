import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkIcon } from "@/components/design-system/Icon";
import type { BackendCommitResponse } from "@/services/backendContract/backendTypes";

interface CommitResultPanelProps {
  result: BackendCommitResponse;
  onNewIngest?: () => void;
}

export function CommitResultPanel({ result, onNewIngest }: CommitResultPanelProps) {
  const navigate = useNavigate();
  const isLocalOnly = result.commitPersistence === "local_only" || result.publicAvailability === "local_preview_only";

  return (
    <WkSurface className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${result.integrity.ok ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>
          <WkIcon name={result.integrity.ok ? "CheckCircle2" : "AlertTriangle"} size={24} />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-wk-text">{isLocalOnly ? "Edition Locally Committed" : "Edition Published"}</h2>
          <p className="text-[12px] text-wk-text-soft mt-0.5">
            {isLocalOnly ? "Stored in local browser mode — not a public WAKILISHA publication" : result.integrity.ok ? "V2 edition written and verified" : "Edition written with warnings — check below"}
          </p>
        </div>
      </div>

      {isLocalOnly && (
        <div className="mb-4 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 text-[12px] text-wk-warning">
          <div className="flex items-center gap-2 font-semibold">
            <WkIcon name="AlertTriangle" size={14} />
            Local preview only
          </div>
          <p className="mt-1 text-wk-text-soft">This commit is saved in this browser only. It is not visible to public users until backend/database persistence and public API verification succeed.</p>
        </div>
      )}

      <div className="mb-5 rounded-lg border border-wk-border bg-wk-surface-raised p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[12px]">
          <div><span className="text-wk-text-muted">Program:</span> <span className="font-mono font-semibold text-wk-brand">{result.publicSlug}</span></div>
          <div><span className="text-wk-text-muted">Edition:</span> <span className="font-mono font-semibold text-wk-text">{result.editionSlug}</span></div>
          <div><span className="text-wk-text-muted">Entries:</span> <span className="font-bold text-wk-text">{result.entryCount}</span></div>
          <div><span className="text-wk-text-muted">Edition date:</span> <span className="font-semibold text-wk-text">{result.editionDate}</span></div>
          <div><span className="text-wk-text-muted">Persistence:</span> <span className="font-semibold text-wk-text">{result.commitPersistence.replace(/_/g, " ")}</span></div>
          <div><span className="text-wk-text-muted">Availability:</span> <span className="font-semibold text-wk-text">{result.publicAvailability.replace(/_/g, " ")}</span></div>
          <div className="sm:col-span-2"><span className="text-wk-text-muted">Snapshot:</span> <span className="text-wk-text-muted italic">{result.snapshotId ?? "Not implemented yet"}</span></div>
          <div className="sm:col-span-2">
            <span className="text-wk-text-muted">Integrity:</span>{" "}
            <span className={`font-semibold ${result.integrity.ok && result.integrity.errors.length === 0 ? "text-wk-success" : "text-wk-warning"}`}>
              {result.integrity.ok && result.integrity.errors.length === 0 ? "Passed" : result.integrity.errors.length > 0 ? `${result.integrity.errors.length} error(s)` : `${result.integrity.warnings.length} warning(s)`}
            </span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 border-t border-wk-divider pt-3">
          <div className="flex items-center gap-2 text-[12px]"><WkIcon name="Globe" size={12} className="text-wk-text-muted shrink-0" /><span className="text-wk-text-muted">Public URL:</span><span className="font-mono text-wk-brand truncate">{result.publicUrl}</span></div>
          <div className="flex items-center gap-2 text-[12px]"><WkIcon name="Code2" size={12} className="text-wk-text-muted shrink-0" /><span className="text-wk-text-muted">API URL:</span><span className="font-mono text-wk-text-soft truncate text-[11px]">{result.apiUrl}</span></div>
        </div>
      </div>

      {result.integrity.warnings.filter((w) => !w.includes("Snapshot service")).length > 0 && (
        <div className="mb-4 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3">
          <p className="text-[11px] font-bold text-wk-warning mb-1"><WkIcon name="AlertTriangle" size={12} className="mr-1 inline" />{result.integrity.warnings.length} note(s)</p>
          <ul className="space-y-0.5">{result.integrity.warnings.slice(0, 4).map((w, i) => <li key={i} className="text-[11px] text-wk-text-soft">· {w}</li>)}</ul>
        </div>
      )}

      {result.integrity.errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3">
          <p className="text-[11px] font-bold text-wk-danger mb-1"><WkIcon name="XCircle" size={12} className="mr-1 inline" />Integrity errors</p>
          <ul className="space-y-0.5">{result.integrity.errors.map((e, i) => <li key={i} className="text-[11px] text-wk-danger/90">· {e}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate(result.publicUrl)} disabled={isLocalOnly} title={isLocalOnly ? "Public chart is unavailable for local-only commits." : undefined} className="inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-4 py-2 text-[13px] font-semibold text-wk-brand-on hover:opacity-90 disabled:opacity-50 whitespace-nowrap"><WkIcon name="ExternalLink" size={14} />Open Public Chart</button>
        <button onClick={() => navigate(`/admin/charts/ingest-runs/${result.runId}`)} className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"><WkIcon name="FileText" size={14} />View Run Detail</button>
        <button onClick={() => navigate("/admin/charts/editions")} className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"><WkIcon name="LayoutList" size={14} />View in Editions</button>
        <button onClick={() => navigate(`/admin/charts/public-api-qa?publicSlug=${result.publicSlug}&editionSlug=${result.editionSlug}`)} className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"><WkIcon name="TestTube2" size={14} />Test in API QA</button>
        {onNewIngest && <button onClick={onNewIngest} className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"><WkIcon name="Plus" size={14} />New Ingest</button>}
      </div>
    </WkSurface>
  );
}
