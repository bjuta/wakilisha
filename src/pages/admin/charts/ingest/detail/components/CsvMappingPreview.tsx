import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { CsvColumnMapping, CsvMappingPreview } from "@/services/chartsIngestion/types";

const DEFAULT_MAPPING: CsvColumnMapping[] = [
  { csvColumn: "rank", detectedField: "rank", sampleValue: "1", required: true, status: "mapped" },
  { csvColumn: "title", detectedField: "title", sampleValue: "Love Me JeJe", required: true, status: "mapped" },
  { csvColumn: "artist", detectedField: "artist_line", sampleValue: "Tems", required: true, status: "mapped" },
  { csvColumn: "isrc", detectedField: "isrc", sampleValue: "NGA0H2400001", required: false, status: "mapped" },
  { csvColumn: "spotify_url", detectedField: "external_urls.spotify", sampleValue: "https://open.spotify.com/track/abc123", required: false, status: "mapped" },
  { csvColumn: "apple_url", detectedField: "external_urls.apple", sampleValue: "https://music.apple.com/track/xyz789", required: false, status: "mapped" },
  { csvColumn: "youtube_url", detectedField: "external_urls.youtube", sampleValue: "", required: false, status: "unmapped" },
  { csvColumn: "release_date", detectedField: "release_date", sampleValue: "2026-04-15", required: false, status: "mapped" },
  { csvColumn: "label", detectedField: "label", sampleValue: "Mavin Records", required: false, status: "mapped" },
  { csvColumn: "notes", detectedField: "", sampleValue: "Internal note", required: false, status: "ignored" },
];

export function CsvMappingPreview() {
  const [columns, setColumns] = useState<CsvColumnMapping[]>(DEFAULT_MAPPING);
  const [validated, setValidated] = useState(false);

  const handleToggleIgnore = (index: number) => {
    setColumns((prev) =>
      prev.map((col, i) =>
        i === index
          ? { ...col, status: col.status === "ignored" ? "mapped" : "ignored" }
          : col
      )
    );
    setValidated(false);
  };

  const handleValidate = () => {
    setValidated(true);
  };

  const rowsDetected = 40;
  const missingTitles = columns.find((c) => c.detectedField === "title")?.status === "ignored" ? 40 : 0;
  const missingArtists = columns.find((c) => c.detectedField === "artist_line")?.status === "ignored" ? 40 : 0;
  const missingIsrcs = 3;
  const duplicateRows = 2;
  const readyToNormalize = missingTitles === 0 && missingArtists === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[var(--wk-text)]">CSV Mapping Preview</h3>
        <button
          onClick={handleValidate}
          className="wk-button wk-button-sm wk-button-primary"
        >
          <i className="ri-check-line" />
          Validate CSV
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
                <th className="whitespace-nowrap">Required</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, index) => (
                <tr key={col.csvColumn}>
                  <td className="font-semibold text-[var(--wk-text)]">{col.csvColumn}</td>
                  <td className="text-[12px] text-[var(--wk-text-soft)]">
                    {col.detectedField || "—"}
                  </td>
                  <td className="text-[12px] text-[var(--wk-text-muted)]">
                    {col.sampleValue || "—"}
                  </td>
                  <td>
                    <span className={`text-[10px] font-semibold ${col.required ? "text-[var(--wk-danger)]" : "text-[var(--wk-text-faint)]"}`}>
                      {col.required ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      col.status === "mapped"
                        ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                        : col.status === "ignored"
                          ? "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                          : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"
                    }`}>
                      {col.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleIgnore(index)}
                      className="text-[11px] text-[var(--wk-brand)] hover:underline"
                    >
                      {col.status === "ignored" ? "Restore" : "Ignore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Validation Summary */}
      {validated && (
        <WkSurface className="p-4">
          <h4 className="text-[12px] font-bold text-[var(--wk-text)]">Validation Results</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Rows Detected</div>
              <div className="mt-1 text-[16px] font-black text-[var(--wk-text)]">{rowsDetected}</div>
            </div>
            <div className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing Titles</div>
              <div className={`mt-1 text-[16px] font-black ${missingTitles > 0 ? "text-[var(--wk-danger)]" : "text-[var(--wk-success)]"}`}>
                {missingTitles}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing Artists</div>
              <div className={`mt-1 text-[16px] font-black ${missingArtists > 0 ? "text-[var(--wk-danger)]" : "text-[var(--wk-success)]"}`}>
                {missingArtists}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Missing ISRCs</div>
              <div className={`mt-1 text-[16px] font-black ${missingIsrcs > 0 ? "text-[var(--wk-warning)]" : "text-[var(--wk-success)]"}`}>
                {missingIsrcs}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Duplicate Rows</div>
              <div className={`mt-1 text-[16px] font-black ${duplicateRows > 0 ? "text-[var(--wk-warning)]" : "text-[var(--wk-success)]"}`}>
                {duplicateRows}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${readyToNormalize ? "bg-[var(--wk-success)] text-white" : "bg-[var(--wk-warning)] text-white"}`}>
              <i className={readyToNormalize ? "ri-check-line" : "ri-alert-line"} />
            </div>
            <span className={`text-[12px] font-semibold ${readyToNormalize ? "text-[var(--wk-success)]" : "text-[var(--wk-warning)]"}`}>
              {readyToNormalize ? "Ready to normalize" : "Cannot normalize — required fields missing"}
            </span>
          </div>
        </WkSurface>
      )}
    </div>
  );
}