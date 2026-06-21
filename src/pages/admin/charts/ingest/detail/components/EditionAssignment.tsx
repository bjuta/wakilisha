/**
 * Edition Assignment — Phase 2
 * Assign chart family, edition label, edition date, period, chart size, rank policy.
 */
import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import DateRangePicker, { type DateRangeValue } from "@/components/base/DateRangePicker";
import type { IngestJob, DiscoveredCsvSource } from "@/services/chartsIngestion/types";
import type { UserRole } from "@/services/chartsIngestion/client";
import { hasCapability } from "@/services/chartsIngestion/client";

type RankPolicy =
  | "strict_ranked"
  | "allow_rank_gaps"
  | "allow_unranked"
  | "use_row_order"
  | "manual_required";

interface EditionAssignmentProps {
  job: IngestJob;
  discoveredCsvs: DiscoveredCsvSource[];
  selectedCsv: DiscoveredCsvSource | null;
  onSelectCsv: (csv: DiscoveredCsvSource) => void;
  onUpdate: () => void;
  role?: UserRole;
}

const RANK_POLICY_OPTIONS: { value: RankPolicy; label: string; desc: string }[] = [
  { value: "strict_ranked", label: "Strict Ranked Chart", desc: "All entries must have a unique, gapless rank starting from 1" },
  { value: "allow_rank_gaps", label: "Allow Rank Gaps", desc: "Ranks can have gaps (e.g. 1, 2, 4, 5 is allowed)" },
  { value: "allow_unranked", label: "Allow Unranked Candidates", desc: "Some candidates may have no rank — they appear at the end" },
  { value: "use_row_order", label: "Use Row Order as Rank", desc: "Rank is determined by the order rows appear in the CSV" },
  { value: "manual_required", label: "Manual Ranking Required", desc: "CSV provides source data only; admin assigns ranks manually" },
];

export function EditionAssignment({
  job,
  discoveredCsvs,
  selectedCsv,
  onSelectCsv,
  role = "admin",
}: EditionAssignmentProps) {
  const [form, setForm] = useState({
    chartFamily: job.chartFamilyId,
    editionLabel: job.editionSlug ?? "",
    editionDate: job.editionDate,
    periodRange: {
      mode: "custom" as const,
      start: job.periodStart || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
      end: job.periodEnd || new Date().toISOString().split("T")[0],
    } as DateRangeValue,
    chartSize: job.chartSize,
    rankPolicy: "strict_ranked" as RankPolicy,
  });
  const [saved, setSaved] = useState(false);
  const canEdit = hasCapability(role, "edit_job");

  const detectEditionMetadata = (csv: DiscoveredCsvSource) => {
    const weekLabel = csv.detectedWeek ?? "";
    const dateLabel = csv.detectedDate ?? "";
    const edLabel = weekLabel ? `${csv.chartType} — ${weekLabel}` : dateLabel ? `${csv.chartType} — ${dateLabel}` : "";
    setForm((p) => ({
      ...p,
      editionLabel: edLabel || p.editionLabel,
      editionDate: dateLabel || p.editionDate,
    }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Edition Assignment</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            Assign this import to a chart family and edition. Required before normalization.
          </p>
        </div>
      </div>

      {/* Detected metadata from CSV */}
      {discoveredCsvs.length > 0 && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-file-list-line text-[var(--wk-brand)] mr-1.5" />
            Auto-detect from CSV
          </h3>
          <div className="flex flex-wrap gap-2">
            {discoveredCsvs.map((csv) => {
              const isSelected = selectedCsv?.id === csv.id;
              return (
                <button
                  key={csv.id}
                  onClick={() => {
                    onSelectCsv(csv);
                    detectEditionMetadata(csv);
                  }}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all ${
                    isSelected
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                      : "border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <i className="ri-file-list-line" />
                    <span>{csv.filename}</span>
                    {csv.detectedWeek && (
                      <span className="rounded-full bg-[var(--wk-success-soft)] px-1.5 py-0 text-[9px] font-semibold text-[var(--wk-success)]">
                        {csv.detectedWeek}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedCsv && (selectedCsv.detectedWeek || selectedCsv.detectedDate) && (
            <div className="mt-2 text-[11px] text-[var(--wk-success)]">
              <i className="ri-check-line mr-1" />
              Auto-detected: {selectedCsv.detectedWeek ?? selectedCsv.detectedDate} — fields populated below
            </div>
          )}
        </WkSurface>
      )}

      {/* Edition Setup Form */}
      <WkSurface className="p-5">
        <h3 className="mb-4 text-[13px] font-bold text-[var(--wk-text)]">Edition Details</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Edition Label *</label>
            <input
              type="text"
              value={form.editionLabel}
              onChange={(e) => setForm((p) => ({ ...p, editionLabel: e.target.value }))}
              placeholder="e.g. Week 22, 2026"
              disabled={!canEdit}
              className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Edition Date *</label>
            <input
              type="date"
              value={form.editionDate}
              onChange={(e) => setForm((p) => ({ ...p, editionDate: e.target.value }))}
              disabled={!canEdit}
              className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Chart Size *</label>
            <input
              type="number"
              value={form.chartSize}
              onChange={(e) => setForm((p) => ({ ...p, chartSize: parseInt(e.target.value) || 40 }))}
              min={1}
              max={500}
              disabled={!canEdit}
              className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Period Range</label>
            <div className="mt-1">
              <DateRangePicker
                value={form.periodRange as DateRangeValue}
                onChange={(val) => setForm((p) => ({ ...p, periodRange: val }))}
                presets={[]}
              />
            </div>
          </div>
        </div>

        {/* Rank Policy */}
        <div className="mt-5">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Rank Policy *</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {RANK_POLICY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => canEdit && setForm((p) => ({ ...p, rankPolicy: opt.value }))}
                disabled={!canEdit}
                className={`rounded-lg border p-3 text-left transition-all ${
                  form.rankPolicy === opt.value
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                    : "border-[var(--wk-border)] hover:border-[var(--wk-brand-soft)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    form.rankPolicy === opt.value
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]"
                      : "border-[var(--wk-border)]"
                  }`}>
                    {form.rankPolicy === opt.value && <i className="ri-check-line text-white text-[8px]" />}
                  </div>
                  <span className={`text-[12px] font-semibold ${
                    form.rankPolicy === opt.value ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"
                  }`}>
                    {opt.label}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-[var(--wk-text-muted)]">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!form.editionLabel || !form.editionDate || !canEdit}
            className={`wk-button wk-button-primary whitespace-nowrap ${!form.editionLabel || !form.editionDate || !canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {saved ? <i className="ri-check-line" /> : <i className="ri-save-line" />}
            {saved ? "Saved!" : "Save Edition Config"}
          </button>
        </div>
      </WkSurface>

      {/* Current config read-only view */}
      <WkSurface className="p-4">
        <h3 className="mb-2 text-[12px] font-bold text-[var(--wk-text-muted)] uppercase tracking-[0.12em]">Current Job Configuration</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Chart Family", value: job.chartFamily?.label ?? "—" },
            { label: "Edition Date", value: job.editionDate },
            { label: "Period", value: `${job.periodStart} → ${job.periodEnd}` },
            { label: "Chart Size", value: `${job.chartSize} entries` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">{label}</div>
              <div className="mt-1 text-[12px] font-semibold text-[var(--wk-text)]">{value}</div>
            </div>
          ))}
        </div>
      </WkSurface>
    </div>
  );
}