/**
 * Import Workspace — Phase 0
 * Serious import table of all discovered CSVs.
 * Dense, command-center style. No playful UI.
 */
import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { DiscoveredCsvSource, CsvImportSession } from "@/services/chartsIngestion/types";
import {
  attachCsvAsSource,
  normalizeCsvCandidates,
  hasCapability,
  getDisabledReason,
} from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface ImportWorkspaceProps {
  jobId: string;
  discoveredCsvs: DiscoveredCsvSource[];
  importSessions: CsvImportSession[];
  onSelectCsv: (csv: DiscoveredCsvSource) => void;
  onUpdate: () => void;
  role?: UserRole;
}

export function ImportWorkspace({
  jobId,
  discoveredCsvs,
  importSessions,
  onSelectCsv,
  onUpdate,
  role = "admin",
}: ImportWorkspaceProps) {
  const [normalizingId, setNormalizingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "warnings" | "errors">("all");

  const canAddSource = hasCapability(role, "add_source");
  const canNormalize = hasCapability(role, "fetch_sources");

  const filtered = discoveredCsvs.filter((csv) => {
    if (filter === "all") return true;
    if (filter === "ready") return csv.validationStatus === "valid" && csv.mappingStatus === "mapped";
    if (filter === "warnings") return csv.validationStatus === "warnings";
    if (filter === "errors") return csv.validationStatus === "errors";
    return true;
  });

  const handleUseAsSource = async (csv: DiscoveredCsvSource) => {
    if (!canAddSource) return;
    await attachCsvAsSource(jobId, csv.id);
    onUpdate();
  };

  const handleNormalize = async (csv: DiscoveredCsvSource) => {
    if (!canNormalize) return;
    setNormalizingId(csv.id);
    await normalizeCsvCandidates(jobId, csv.id);
    setNormalizingId(null);
    onUpdate();
  };

  const getCsvSession = (csvId: string) => importSessions.find((s) => s.sourceId === csvId);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Discovered CSV Imports</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            {discoveredCsvs.length} files discovered from WAKILISHA export
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] text-[var(--wk-text)]"
          >
            <option value="all">All Files</option>
            <option value="ready">Ready to Import</option>
            <option value="warnings">Warnings</option>
            <option value="errors">Errors</option>
          </select>
        </div>
      </div>

      {/* CSV Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Filename</th>
                <th className="whitespace-nowrap">Chart Type</th>
                <th className="whitespace-nowrap">Edition</th>
                <th className="whitespace-nowrap">Rows</th>
                <th className="whitespace-nowrap">Rank</th>
                <th className="whitespace-nowrap">Title</th>
                <th className="whitespace-nowrap">Artist</th>
                <th className="whitespace-nowrap">Confidence</th>
                <th className="whitespace-nowrap">Validation</th>
                <th className="whitespace-nowrap">Mapping</th>
                <th className="whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((csv) => {
                const session = getCsvSession(csv.id);
                const rankCol = csv.mappedFields["rank"] || csv.mappedFields["position"] || null;
                const titleCol = csv.mappedFields["title"] || csv.mappedFields["track_title"] || null;
                const artistCol = csv.mappedFields["artist_line"] || csv.mappedFields["artist_name"] || null;
                const isImported = !!session;
                return (
                  <tr key={csv.id} className={isImported ? "bg-[var(--wk-brand-soft)]/10" : ""}>
                    <td className="font-semibold text-[var(--wk-text)]">
                      <div className="flex items-center gap-2">
                        <i className="ri-file-list-line text-[var(--wk-brand)]" />
                        <span className="truncate max-w-[160px]" title={csv.filename}>{csv.filename}</span>
                        {isImported && (
                          <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0 text-[9px] font-semibold text-[var(--wk-brand)]">
                            Imported
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">{csv.chartType}</td>
                    <td className="text-[12px] text-[var(--wk-text-muted)]">
                      {csv.detectedWeek ?? csv.detectedDate ?? "—"}
                    </td>
                    <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-text)]">{csv.rowCount}</td>
                    <td>
                      {rankCol ? (
                        <span className="rounded-full bg-[var(--wk-success-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-success)]">{rankCol}</span>
                      ) : (
                        <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">Missing</span>
                      )}
                    </td>
                    <td>
                      {titleCol ? (
                        <span className="rounded-full bg-[var(--wk-success-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-success)]">{titleCol}</span>
                      ) : (
                        <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">Missing</span>
                      )}
                    </td>
                    <td>
                      {artistCol ? (
                        <span className="rounded-full bg-[var(--wk-success-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-success)]">{artistCol}</span>
                      ) : (
                        <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">Missing</span>
                      )}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        csv.confidence === "high" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                        csv.confidence === "medium" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                        "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                      }`}>
                        {csv.confidence}
                      </span>
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        csv.validationStatus === "valid" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                        csv.validationStatus === "warnings" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                        "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                      }`}>
                        {csv.validationStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        csv.mappingStatus === "mapped" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                        csv.mappingStatus === "partial" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                        "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                      }`}>
                        {csv.mappingStatus}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onSelectCsv(csv)}
                          className="flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-brand)]"
                          title="Inspect CSV"
                        >
                          <i className="ri-eye-line mr-1" />
                          Inspect
                        </button>
                        <button
                          onClick={() => handleUseAsSource(csv)}
                          disabled={csv.usedAsSource || !canAddSource}
                          className={`flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-[var(--wk-success)] hover:bg-[var(--wk-success-soft)] ${csv.usedAsSource || !canAddSource ? "cursor-not-allowed opacity-50" : ""}`}
                          title={csv.usedAsSource ? "Already a source" : "Add as source"}
                        >
                          <i className="ri-add-circle-line mr-1" />
                          {csv.usedAsSource ? "Added" : "Source"}
                        </button>
                        <button
                          onClick={() => handleNormalize(csv)}
                          disabled={normalizingId === csv.id || !canNormalize}
                          className={`flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] ${normalizingId === csv.id || !canNormalize ? "cursor-not-allowed opacity-50" : ""}`}
                          title="Normalize into candidates"
                        >
                          {normalizingId === csv.id ? <i className="ri-loader-4-line animate-spin mr-1" /> : <i className="ri-sparkling-line mr-1" />}
                          {normalizingId === csv.id ? "..." : "Normalize"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[12px] text-[var(--wk-text-muted)]">
            No CSV files match the current filter.
          </div>
        )}
      </WkSurface>

      {/* CSV Import Sessions Summary */}
      {importSessions.length > 0 && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-file-list-3-line text-[var(--wk-brand)] mr-1.5" />
            CSV Import Sessions
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {importSessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--wk-text)] truncate max-w-[140px]" title={s.filename}>{s.filename}</span>
                  <span className="text-[10px] text-[var(--wk-text-faint)]">{s.candidateCount} cands</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                  <div className="text-center">
                    <div className="text-[var(--wk-text-muted)]">Rows</div>
                    <div className="font-bold text-[var(--wk-text)]">{s.rowCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[var(--wk-text-muted)]">Valid</div>
                    <div className="font-bold text-[var(--wk-success)]">{s.validRows}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[var(--wk-text-muted)]">Issues</div>
                    <div className={`font-bold ${s.issueCount > 0 ? "text-[var(--wk-warning)]" : "text-[var(--wk-text)]"}`}>{s.issueCount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}
    </div>
  );
}