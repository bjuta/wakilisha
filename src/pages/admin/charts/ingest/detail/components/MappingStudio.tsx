/**
 * Mapping Studio — Phase 3
 * Central column mapping: CSV column → mapped field.
 * Change/ignore/restore/mark as metadata/mark as source metric.
 */
import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { DiscoveredCsvSource } from "@/services/chartsIngestion/types";
import type { UserRole } from "@/services/chartsIngestion/client";

interface MappingStudioProps {
  csv: DiscoveredCsvSource | null;
  discoveredCsvs: DiscoveredCsvSource[];
  onSelectCsv: (csv: DiscoveredCsvSource) => void;
  onUpdate: () => void;
  role?: UserRole;
}

const KNOWN_FIELDS = [
  { value: "rank", label: "Rank / Position", required: true, group: "Chart" },
  { value: "title", label: "Track Title", required: true, group: "Chart" },
  { value: "artist_line", label: "Artist Line", required: true, group: "Chart" },
  { value: "isrc", label: "ISRC", required: false, group: "Identity" },
  { value: "upc", label: "UPC", required: false, group: "Identity" },
  { value: "release_title", label: "Album / Release Title", required: false, group: "Metadata" },
  { value: "label", label: "Label", required: false, group: "Metadata" },
  { value: "genre", label: "Genre", required: false, group: "Metadata" },
  { value: "artwork_url", label: "Artwork URL", required: false, group: "Metadata" },
  { value: "spotify_url", label: "Spotify URL", required: false, group: "External URLs" },
  { value: "apple_music_url", label: "Apple Music URL", required: false, group: "External URLs" },
  { value: "youtube_url", label: "YouTube URL", required: false, group: "External URLs" },
  { value: "chart_week", label: "Chart Week", required: false, group: "Edition" },
  { value: "chart_date", label: "Chart Date", required: false, group: "Edition" },
  { value: "position", label: "Position (alt rank)", required: false, group: "Chart" },
  { value: "peak", label: "Peak Position", required: false, group: "Source Metric" },
  { value: "weeks_on_chart", label: "Weeks on Chart", required: false, group: "Source Metric" },
];

type ColumnAction = "mapped" | "ignored" | "metadata" | "source_metric";

interface MappingRow {
  csvColumn: string;
  mappedField: string | null;
  action: ColumnAction;
  sampleValue: string;
}

export function MappingStudio({
  csv,
  discoveredCsvs,
  onSelectCsv,
}: MappingStudioProps) {
  const selected = csv ?? (discoveredCsvs.length > 0 ? discoveredCsvs[0] : null);

  const buildInitialMappings = (c: DiscoveredCsvSource): MappingRow[] => {
    return c.headers.map((header) => {
      const mappedField = Object.entries(c.mappedFields).find(([, col]) => col === header)?.[0] ?? null;
      const sampleValue = c.sampleRows[0]?.[header] ?? "—";
      const action: ColumnAction = mappedField ? "mapped" : "ignored";
      return { csvColumn: header, mappedField, action, sampleValue };
    });
  };

  const [mappings, setMappings] = useState<MappingRow[]>(
    selected ? buildInitialMappings(selected) : []
  );

  const handleFieldChange = (csvColumn: string, field: string | null) => {
    setMappings((prev) =>
      prev.map((row) =>
        row.csvColumn === csvColumn
          ? { ...row, mappedField: field, action: field ? "mapped" : "ignored" }
          : row
      )
    );
  };

  const handleActionChange = (csvColumn: string, action: ColumnAction) => {
    setMappings((prev) =>
      prev.map((row) =>
        row.csvColumn === csvColumn
          ? { ...row, action, mappedField: action === "ignored" ? null : row.mappedField }
          : row
      )
    );
  };

  const getStatusForRow = (row: MappingRow): { label: string; color: string } => {
    if (row.action === "ignored") return { label: "Ignored", color: "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]" };
    if (row.action === "metadata") return { label: "Metadata", color: "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" };
    if (row.action === "source_metric") return { label: "Source Metric", color: "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" };
    if (row.mappedField) {
      const field = KNOWN_FIELDS.find((f) => f.value === row.mappedField);
      if (field?.required) return { label: "Required ✓", color: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" };
      return { label: "Mapped ✓", color: "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" };
    }
    return { label: "Unmapped", color: "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" };
  };

  const mappedCount = mappings.filter((r) => r.action === "mapped" && r.mappedField).length;
  const ignoredCount = mappings.filter((r) => r.action === "ignored").length;
  const metaCount = mappings.filter((r) => r.action === "metadata").length;

  if (!selected) {
    return (
      <div className="space-y-4">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Mapping Studio</h2>
        <WkSurface className="p-8 text-center">
          <div className="text-[13px] font-semibold text-[var(--wk-text)]">No CSV selected</div>
          <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Select a CSV from Import Workspace first.</div>
        </WkSurface>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Mapping Studio</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            Map CSV columns to ingestion fields. Required fields must be mapped before normalization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selected.id}
            onChange={(e) => {
              const c = discoveredCsvs.find((d) => d.id === e.target.value);
              if (c) { onSelectCsv(c); setMappings(buildInitialMappings(c)); }
            }}
            className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[12px] text-[var(--wk-text)]"
          >
            {discoveredCsvs.map((c) => (
              <option key={c.id} value={c.id}>{c.filename}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
          <div className="text-[10px] text-[var(--wk-text-muted)]">Total Columns</div>
          <div className="text-[16px] font-black text-[var(--wk-text)]">{mappings.length}</div>
        </div>
        <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
          <div className="text-[10px] text-[var(--wk-text-muted)]">Mapped</div>
          <div className="text-[16px] font-black text-[var(--wk-success)]">{mappedCount}</div>
        </div>
        <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
          <div className="text-[10px] text-[var(--wk-text-muted)]">Ignored</div>
          <div className="text-[16px] font-black text-[var(--wk-text-faint)]">{ignoredCount}</div>
        </div>
        <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center">
          <div className="text-[10px] text-[var(--wk-text-muted)]">Metadata</div>
          <div className="text-[16px] font-black text-[var(--wk-info)]">{metaCount}</div>
        </div>
      </div>

      {/* Mapping Table */}
      <WkSurface className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--wk-border)]">
          <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Column Mappings</h3>
          <button
            onClick={() => setMappings(buildInitialMappings(selected))}
            className="wk-button wk-button-sm wk-button-ghost"
          >
            <i className="ri-restart-line mr-1" />
            Reset to Auto
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap">CSV Column</th>
                <th className="whitespace-nowrap">Mapped Field</th>
                <th className="whitespace-nowrap">Sample Value</th>
                <th className="whitespace-nowrap">Required</th>
                <th className="whitespace-nowrap">Confidence</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((row) => {
                const fieldDef = KNOWN_FIELDS.find((f) => f.value === row.mappedField);
                const status = getStatusForRow(row);
                return (
                  <tr key={row.csvColumn} className={row.action === "ignored" ? "opacity-50" : ""}>
                    <td className="font-semibold text-[var(--wk-text)]">{row.csvColumn}</td>
                    <td>
                      <select
                        value={row.mappedField ?? ""}
                        onChange={(e) => handleFieldChange(row.csvColumn, e.target.value || null)}
                        disabled={row.action === "ignored"}
                        className="rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-1.5 text-[11px] text-[var(--wk-text)] min-w-[160px]"
                      >
                        <option value="">— Not Mapped —</option>
                        {["Chart", "Identity", "Metadata", "External URLs", "Edition", "Source Metric"].map((group) => (
                          <optgroup key={group} label={group}>
                            {KNOWN_FIELDS.filter((f) => f.group === group).map((f) => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="text-[11px] text-[var(--wk-text-muted)] truncate max-w-[120px]" title={row.sampleValue}>
                      {row.sampleValue}
                    </td>
                    <td>
                      {fieldDef?.required ? (
                        <span className="rounded-full bg-[var(--wk-danger-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">Required</span>
                      ) : (
                        <span className="text-[10px] text-[var(--wk-text-faint)]">Optional</span>
                      )}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        row.mappedField ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                      }`}>
                        {row.mappedField ? "Auto" : "—"}
                      </span>
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {["mapped", "ignored", "metadata", "source_metric"].map((act) => (
                          <button
                            key={act}
                            onClick={() => handleActionChange(row.csvColumn, act as ColumnAction)}
                            className={`flex h-6 w-6 items-center justify-center rounded text-[10px] transition-all ${
                              row.action === act
                                ? "bg-[var(--wk-brand)] text-white"
                                : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                            }`}
                            title={act}
                          >
                            <i className={
                              act === "mapped" ? "ri-check-line" :
                              act === "ignored" ? "ri-eye-off-line" :
                              act === "metadata" ? "ri-information-line" :
                              "ri-bar-chart-2-line"
                            } />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </WkSurface>
    </div>
  );
}