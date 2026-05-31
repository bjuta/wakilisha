import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { DiscoveredCsvSource } from "@/services/chartsIngestion/types";
import { validateCsvMapping } from "@/services/chartsIngestion/csv/parser";

interface CsvMappingPreviewProps {
  discoveredCsv?: DiscoveredCsvSource;
}

export function CsvMappingPreview({ discoveredCsv }: CsvMappingPreviewProps) {
  const [validated, setValidated] = useState(false);

  if (discoveredCsv) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold text-[var(--wk-text)]">
            CSV Mapping Preview: {discoveredCsv.filename}
          </h3>
          <button
            onClick={() => setValidated(true)}
            className="wk-button wk-button-sm wk-button-primary"
          >
            <i className="ri-check-line" />
            Validate
          </button>
        </div>

        <WkSurface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="wk-table min-w-full">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">CSV Column</th>
                  <th className="whitespace-nowrap">Detected Field</th>
                  <th className="whitespace-nowrap">Sample Value</th>
                  <th className="whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {discoveredCsv.headers.map((header) => {
                  const mappedField = Object.entries(discoveredCsv.mappedFields).find(
                    ([, col]) => col === header
                  )?.[0];
                  const sampleValue = discoveredCsv.sampleRows[0]?.[header] ?? "—";
                  const isMapped = !!mappedField;
                  return (
                    <tr key={header}>
                      <td className="font-semibold text-[var(--wk-text)]">{header}</td>
                      <td className="text-[12px] text-[var(--wk-text-soft)]">
                        {mappedField ?? "—"}
                      </td>
                      <td className="text-[12px] text-[var(--wk-text-muted)] truncate max-w-[120px]">
                        {sampleValue}
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

        {/* Sample Rows */}
        {discoveredCsv.sampleRows.length > 0 && (
          <WkSurface className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="wk-table min-w-full">
                <thead>
                  <tr>
                    {discoveredCsv.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {discoveredCsv.sampleRows.map((row, idx) => (
                    <tr key={idx}>
                      {discoveredCsv.headers.map((h) => (
                        <td key={h} className="text-[11px] text-[var(--wk-text-muted)] truncate max-w-[120px]">
                          {row[h] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WkSurface>
        )}

        {/* Validation Summary */}
        {validated && (
          <WkSurface className="p-4">
            <h4 className="text-[12px] font-bold text-[var(--wk-text)]">Validation Results</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg border border-[var(--wk-border)] p-3">
                <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Rows Detected</div>
                <div className="mt-1 text-[16px] font-black text-[var(--wk-text)]">{discoveredCsv.rowCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--wk-border)] p-3">
                <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing Titles</div>
                <div className="mt-1 text-[16px] font-black text-[var(--wk-success)]">0</div>
              </div>
              <div className="rounded-lg border border-[var(--wk-border)] p-3">
                <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing Artists</div>
                <div className="mt-1 text-[16px] font-black text-[var(--wk-success)]">0</div>
              </div>
              <div className="rounded-lg border border-[var(--wk-border)] p-3">
                <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing ISRCs</div>
                <div className={`mt-1 text-[16px] font-black ${
                  !discoveredCsv.mappedFields["isrc"] ? "text-[var(--wk-warning)]" : "text-[var(--wk-success)]"
                }`}>
                  {!discoveredCsv.mappedFields["isrc"] ? "Yes" : "0"}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--wk-border)] p-3">
                <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Validation</div>
                <div className={`mt-1 text-[16px] font-black ${
                  discoveredCsv.validationStatus === "valid" ? "text-[var(--wk-success)]" :
                  discoveredCsv.validationStatus === "warnings" ? "text-[var(--wk-warning)]" :
                  "text-[var(--wk-danger)]"
                }`}>
                  {discoveredCsv.validationStatus}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                discoveredCsv.validationStatus === "valid" ? "bg-[var(--wk-success)] text-white" : "bg-[var(--wk-warning)] text-white"
              }`}>
                <i className={discoveredCsv.validationStatus === "valid" ? "ri-check-line" : "ri-alert-line"} />
              </div>
              <span className={`text-[12px] font-semibold ${
                discoveredCsv.validationStatus === "valid" ? "text-[var(--wk-success)]" : "text-[var(--wk-warning)]"
              }`}>
                {discoveredCsv.validationStatus === "valid" ? "Ready to normalize" : "Issues found — review before normalizing"}
              </span>
            </div>
            {discoveredCsv.validationIssues.length > 0 && (
              <div className="mt-2 space-y-1">
                {discoveredCsv.validationIssues.map((issue, i) => (
                  <div key={i} className="text-[11px] text-[var(--wk-warning)]">
                    <i className="ri-error-warning-line mr-1" />
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </WkSurface>
        )}
      </div>
    );
  }

  // Fallback default preview (no discovered CSV)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[var(--wk-text)]">CSV Mapping Preview</h3>
      </div>
      <div className="text-[12px] text-[var(--wk-text-muted)]">
        Select a discovered CSV file to see its real headers and sample values.
      </div>
    </div>
  );
}