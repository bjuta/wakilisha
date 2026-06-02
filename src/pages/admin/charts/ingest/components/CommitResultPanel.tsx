import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkIcon } from "@/components/design-system/Icon";
import type { CommitIngestRunResponse } from "@/services/chartsIngestion/commitTypes";

interface CommitResultPanelProps {
  result: CommitIngestRunResponse;
  onNewIngest?: () => void;
}

export function CommitResultPanel({ result, onNewIngest }: CommitResultPanelProps) {
  const navigate = useNavigate();

  return (
    <WkSurface className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            result.integrity.ok
              ? "bg-wk-success-soft text-wk-success"
              : "bg-wk-warning-soft text-wk-warning"
          }`}
        >
          <WkIcon name={result.integrity.ok ? "CheckCircle2" : "AlertTriangle"} size={24} />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-wk-text">Edition Committed</h2>
          <p className="text-[12px] text-wk-text-soft mt-0.5">
            {result.integrity.ok
              ? "V2 edition written successfully"
              : "Edition written with warnings — check below"}
          </p>
        </div>
      </div>

      {/* Edition details */}
      <div className="mb-5 rounded-lg border border-wk-border bg-wk-surface-raised p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[12px]">
          <div>
            <span className="text-wk-text-muted">Program:</span>{" "}
            <span className="font-mono font-semibold text-wk-brand">{result.publicSlug}</span>
          </div>
          <div>
            <span className="text-wk-text-muted">Edition:</span>{" "}
            <span className="font-mono font-semibold text-wk-text">{result.editionSlug}</span>
          </div>
          <div>
            <span className="text-wk-text-muted">Entries:</span>{" "}
            <span className="font-bold text-wk-text">{result.entryCount}</span>
          </div>
          <div>
            <span className="text-wk-text-muted">Edition date:</span>{" "}
            <span className="font-semibold text-wk-text">{result.editionDate}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-wk-text-muted">Snapshot:</span>{" "}
            <span className="text-wk-text-muted italic">Not implemented yet</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-wk-text-muted">Integrity:</span>{" "}
            <span
              className={`font-semibold ${
                result.integrity.ok && result.integrity.errors.length === 0
                  ? "text-wk-success"
                  : "text-wk-warning"
              }`}
            >
              {result.integrity.ok && result.integrity.errors.length === 0
                ? "Passed"
                : result.integrity.errors.length > 0
                ? `${result.integrity.errors.length} error(s)`
                : `${result.integrity.warnings.length} warning(s)`}
            </span>
          </div>
        </div>

        {/* URLs */}
        <div className="mt-3 space-y-1.5 border-t border-wk-divider pt-3">
          <div className="flex items-center gap-2 text-[12px]">
            <WkIcon name="Globe" size={12} className="text-wk-text-muted shrink-0" />
            <span className="text-wk-text-muted">Public URL:</span>
            <a
              href={result.publicUrl}
              className="font-mono text-wk-brand hover:underline truncate"
              onClick={(e) => {
                e.preventDefault();
                navigate(result.publicUrl);
              }}
            >
              {result.publicUrl}
            </a>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <WkIcon name="Code2" size={12} className="text-wk-text-muted shrink-0" />
            <span className="text-wk-text-muted">API URL:</span>
            <span className="font-mono text-wk-text-soft truncate text-[11px]">
              {result.apiUrl}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {result.integrity.warnings.filter((w) => !w.includes("Snapshot service")).length > 0 && (
        <div className="mb-4 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3">
          <p className="text-[11px] font-bold text-wk-warning mb-1">
            <i className="ri-alert-line mr-1" />
            {result.integrity.warnings.length} note(s)
          </p>
          <ul className="space-y-0.5">
            {result.integrity.warnings.slice(0, 4).map((w, i) => (
              <li key={i} className="text-[11px] text-wk-text-soft">
                · {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {result.integrity.errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3">
          <p className="text-[11px] font-bold text-wk-danger mb-1">
            <i className="ri-close-circle-line mr-1" />
            Integrity errors
          </p>
          <ul className="space-y-0.5">
            {result.integrity.errors.map((e, i) => (
              <li key={i} className="text-[11px] text-wk-danger/90">
                · {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate(result.publicUrl)}
          className="inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-4 py-2 text-[13px] font-semibold text-wk-brand-on hover:opacity-90 whitespace-nowrap"
        >
          <WkIcon name="ExternalLink" size={14} />
          Open Public Chart
        </button>
        <button
          onClick={() => navigate(`/admin/charts/ingest-runs/${result.runId}`)}
          className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"
        >
          <WkIcon name="FileText" size={14} />
          View Run Detail
        </button>
        <button
          onClick={() => navigate("/admin/charts/editions")}
          className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"
        >
          <WkIcon name="LayoutList" size={14} />
          View in Editions
        </button>
        <button
          onClick={() =>
            navigate(
              `/admin/charts/public-api-qa?publicSlug=${result.publicSlug}&editionSlug=${result.editionSlug}`
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"
        >
          <WkIcon name="TestTube2" size={14} />
          Test in API QA
        </button>
        {onNewIngest && (
          <button
            onClick={onNewIngest}
            className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised whitespace-nowrap"
          >
            <WkIcon name="Plus" size={14} />
            New Ingest
          </button>
        )}
      </div>
    </WkSurface>
  );
}