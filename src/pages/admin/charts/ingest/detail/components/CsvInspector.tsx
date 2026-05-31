/**
 * CSV Inspector — Phase 1
 * File summary, headers, first 20 rows, detected chart metadata,
 * unknown columns, data quality warnings.
 */
import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { DiscoveredCsvSource } from "@/services/chartsIngestion/types";
import { validateCsvMapping } from "@/services/chartsIngestion/csv/parser";

interface CsvInspectorProps {
  csv: DiscoveredCsvSource | null;
  discoveredCsvs: DiscoveredCsvSource[];
  onSelectCsv: (csv: DiscoveredCsvSource) => void;
  onGoToPhase: (phase: number) => void;
  onUpdate: () => void;
  role?: string;
}

export function CsvInspector({
  csv,
  discoveredCsvs,
  onSelectCsv,
  onGoToPhase,
}: CsvInspectorProps) {
  const [showAllRows, setShowAllRows] = useState(false);
  const selected = csv ?? (discoveredCsvs.length > 0 ? discoveredCsvs[0] : null);

  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">CSV Inspector</h2>
        </div>
        <WkSurface className="p-8 text-center">
          <div className="text-[13px] font-semibold text-[var(--wk-text)]">No CSV selected</div>
          <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
            Select a CSV from the Import Workspace to inspect its contents.
          </div>
        </WkSurface>
      </div>
    );
  }

  const validation = validateCsvMapping({
    filename: selected.filename,
    filepath: selected.filepath,
    detectedChartType: selected.chartType,
    confidence: selected.confidence,
    rowCount: selected.rowCount,
    headers: selected.headers,
    sampleRows: selected.sampleRows,
    detectedDate: selected.detectedDate,
    detectedWeek: selected.detectedWeek,
    mappingStatus: selected.mappingStatus,
    validationStatus: selected.validationStatus,
    validationIssues: selected.validationIssues,
    mappedFields: selected.mappedFields,
    sourceSize: 0,
  });

  const unknownColumns = selected.headers.filter(
    (h) => !Object.values(selected.mappedFields).includes(h)
  );

  const displayRows = showAllRows ? selected.sampleRows : selected.sampleRows.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">CSV Inspector</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            {selected.filename} — {selected.rowCount} rows — {selected.headers.length} columns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selected.id}
            onChange={(e) => {
              const c = discoveredCsvs.find((d) => d.id === e.target.value);
              if (c) onSelectCsv(c);
            }}
            className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] text-[var(--wk-text)]"
          >
            {discoveredCsvs.map((c) => (
              <option key={c.id} value={c.id}>{c.filename}</option>
            ))}
          </select>
          <button
            onClick={() => onGoToPhase(2)}
            className="wk-button wk-button-sm wk-button-primary whitespace-nowrap"
          >
            <i className="ri-arrow-right-line mr-1" />
            Assign Edition
          </button>
        </div>
      </div>

      {/* File Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WkSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Chart Type</div>
          <div className="mt-1 text-[13px] font-semibold text-[var(--wk-text)]">{selected.chartType}</div>
        </WkSurface>
        <WkSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Detected Date</div>
          <div className="mt-1 text-[13px] font-semibold text-[var(--wk-text)]">{selected.detectedDate ?? "—"}</div>
        </WkSurface>
        <WkSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Detected Week</div>
          <div className="mt-1 text-[13px] font-semibold text-[var(--wk-text)]">{selected.detectedWeek ?? "—"}</div>
        </WkSurface>
        <WkSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Confidence</div>
          <div className={`mt-1 text-[13px] font-semibold ${
            selected.confidence === "high" ? "text-[var(--wk-success)]" :
            selected.confidence === "medium" ? "text-[var(--wk-warning)]" :
            "text-[var(--wk-text-faint)]"
          }`}>{selected.confidence}</div>
        </WkSurface>
      </div>

      {/* Data Quality Warnings */}
      {selected.validationIssues.length > 0 && (
        <div className="rounded-xl border border-[var(--wk-warning)] bg-[var(--wk-warning-soft)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-alert-line text-[var(--wk-warning)]" />
            <span className="text-[12px] font-bold text-[var(--wk-warning)]">
              {selected.validationIssues.length} Data Quality {selected.validationIssues.length === 1 ? "Warning" : "Warnings"}
            </span>
          </div>
          <div className="space-y-1">
            {selected.validationIssues.map((issue, i) => (
              <div key={i} className="text-[11px] text-[var(--wk-text-soft)]">
                <i className="ri-error-warning-line mr-1 text-[var(--wk-warning)]" />
                {issue}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Headers & Detected Fields */}
      <WkSurface className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
          <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Column Headers</h3>
          <span className="text-[11px] text-[var(--wk-text-muted)]">{selected.headers.length} columns</span>
        </div>
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Column</th>
                <th className="whitespace-nowrap">Mapped Field</th>
                <th className="whitespace-nowrap">Required</th>
                <th className="whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {selected.headers.map((header) => {
                const mappedField = Object.entries(selected.mappedFields).find(
                  ([, col]) => col === header
                )?.[0];
                const isMapped = !!mappedField;
                const isRequired = ["rank", "position", "title", "track_title", "artist_line", "artist_name"].includes(mappedField ?? "");
                return (
                  <tr key={header}>
                    <td className="font-semibold text-[var(--wk-text)]">{header}</td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">{mappedField ?? "—"}</td>
                    <td>
                      {isRequired ? (
                        <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">Required</span>
                      ) : (
                        <span className="rounded-full bg-[var(--wk-text-faint)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-faint)]">Optional</span>
                      )}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isMapped
                          ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                          : "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                      }`}>
                        {isMapped ? "mapped" : "ignored"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Unknown Columns */}
      {unknownColumns.length > 0 && (
        <WkSurface className="p-4 border-l-2 border-l-[var(--wk-info)]">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-information-line text-[var(--wk-info)]" />
            <span className="text-[12px] font-bold text-[var(--wk-info)]">Unknown Columns</span>
            <span className="text-[11px] text-[var(--wk-text-muted)]">{unknownColumns.length} columns not mapped to known fields</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unknownColumns.map((col) => (
              <span key={col} className="rounded-full bg-[var(--wk-info-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-info)]">
                {col}
              </span>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Sample Rows */}
      <WkSurface className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
          <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Sample Rows</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--wk-text-muted)]">
              Showing {displayRows.length} of {selected.sampleRows.length} sample rows
            </span>
            <button
              onClick={() => setShowAllRows(!showAllRows)}
              className="wk-button wk-button-sm wk-button-ghost"
            >
              {showAllRows ? "Show Less" : "Show All"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                {selected.headers.map((h) => (
                  <th key={h} className="whitespace-nowrap text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr key={idx}>
                  {selected.headers.map((h) => (
                    <td key={h} className="text-[11px] text-[var(--wk-text-muted)] truncate max-w-[140px]" title={row[h] ?? "—"}>
                      {row[h] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Validation Summary */}
      <WkSurface className="p-4">
        <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">Validation Summary</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Rows Detected</div>
            <div className="mt-1 text-[16px] font-black text-[var(--wk-text)]">{selected.rowCount}</div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing Titles</div>
            <div className="mt-1 text-[16px] font-black text-[var(--wk-success)]">
              {validation.missingRequired.includes("title") ? "Yes" : "0"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing Artists</div>
            <div className="mt-1 text-[16px] font-black text-[var(--wk-success)]">
              {validation.missingRequired.includes("artist") ? "Yes" : "0"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing ISRCs</div>
            <div className={`mt-1 text-[16px] font-black ${
              validation.missingRecommended.includes("isrc") ? "text-[var(--wk-warning)]" : "text-[var(--wk-success)]"
            }`}>
              {validation.missingRecommended.includes("isrc") ? "Yes" : "0"}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Ready to Normalize</div>
            <div className={`mt-1 text-[16px] font-black ${
              validation.readyToNormalize ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"
            }`}>
              {validation.readyToNormalize ? "Yes" : "No"}
            </div>
          </div>
        </div>
        {!validation.readyToNormalize && (
          <div className="mt-3 rounded-lg border border-[var(--wk-danger)] bg-[var(--wk-danger-soft)] p-3">
            <div className="text-[12px] font-bold text-[var(--wk-danger)]">Missing Required Fields</div>
            <div className="mt-1 text-[11px] text-[var(--wk-text-soft)]">
              {validation.missingRequired.join(", ")} — must be mapped before normalization
            </div>
          </div>
        )}
      </WkSurface>
    </div>
  );
}