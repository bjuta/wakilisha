import { WkIcon } from "@/components/design-system/Icon";

interface ExclusionSummaryPanelProps {
  exclusionSummary: Record<string, number>;
  totalExcluded: number;
  totalEligible: number;
}

const REASON_LABELS: Record<string, { label: string; description: string; color: string }> = {
  missing_release_date:      { label: "Missing Release Date",     description: "Release date absent or unparseable", color: "text-wk-warning" },
  release_window:            { label: "Release Window",           description: "Outside configured release window dates", color: "text-wk-danger" },
  release_window_too_early:  { label: "Release Window (too early)", description: "Released before the start of the release window", color: "text-wk-danger" },
  release_window_too_late:   { label: "Release Window (too late)", description: "Released after the end of the release window", color: "text-wk-danger" },
  country_exclude:           { label: "Country Excluded",         description: "Artist origin matches an exclusion country", color: "text-wk-danger" },
  country_include:           { label: "Country Not Included",     description: "Artist origin not in the include list", color: "text-wk-danger" },
  gender_filter:             { label: "Gender Filter",            description: "Artist gender not in genders_include", color: "text-wk-text-muted" },
  type_filter:               { label: "Artist Type Filter",       description: "Artist type not in types_include", color: "text-wk-text-muted" },
  streaming_min_sources:     { label: "Min Streaming Sources",    description: "Too few distinct source URLs", color: "text-wk-warning" },
  airplay_min_stations:      { label: "Airplay Min Stations",     description: "Station count below configured minimum (§11.1)", color: "text-wk-warning" },
  airplay_min_detections:    { label: "Airplay Min Detections",   description: "Detection count below configured minimum (§11.1)", color: "text-wk-warning" },
  stale_carry_forward:       { label: "Stale Carry-Forward",      description: "3+ weeks carry-forward with no evidence (§11.4)", color: "text-wk-warning" },
  continuity_locked:         { label: "Continuity Locked",        description: "Locked — cannot be removed from chart", color: "text-wk-info" },
};

export function ExclusionSummaryPanel({ exclusionSummary, totalExcluded, totalEligible }: ExclusionSummaryPanelProps) {
  const entries = Object.entries(exclusionSummary).sort((a, b) => b[1] - a[1]);
  const total = totalEligible + totalExcluded;

  if (entries.length === 0 && totalExcluded === 0) {
    return (
      <div className="rounded-xl border border-wk-border bg-wk-surface p-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-success-soft text-wk-success">
          <WkIcon name="CheckCircle2" size={15} />
        </div>
        <div>
          <div className="text-[13px] font-bold text-wk-text">No Exclusions</div>
          <div className="text-[11px] text-wk-text-muted">All {totalEligible} candidates passed eligibility (§6)</div>
        </div>
      </div>
    );
  }

  const passRate = total > 0 ? Math.round((totalEligible / total) * 100) : 100;

  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-wk-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-warning-soft text-wk-warning">
            <WkIcon name="Filter" size={15} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-wk-text">Eligibility Exclusions (§6)</div>
            <div className="text-[11px] text-wk-text-muted">
              {totalExcluded} excluded · {totalEligible} eligible · {passRate}% pass rate
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[20px] font-black text-wk-warning">{totalExcluded}</div>
          <div className="text-[9px] text-wk-text-faint uppercase tracking-wide">excluded</div>
        </div>
      </div>

      {/* Pass rate bar */}
      <div className="px-5 py-3 border-b border-wk-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-wk-border overflow-hidden">
            <div
              className="h-full rounded-full bg-wk-success transition-all"
              style={{ width: `${passRate}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-wk-success whitespace-nowrap">{passRate}% eligible</span>
        </div>
      </div>

      {/* Reason breakdown */}
      <div className="p-5 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-wk-text-faint mb-3">
          Per-Reason Counts
        </div>
        {entries.map(([reason, count]) => {
          const meta = REASON_LABELS[reason];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={reason} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[12px] font-semibold truncate ${meta?.color ?? "text-wk-text"}`}>
                    {meta?.label ?? reason}
                  </span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-wk-text">{count}</span>
                </div>
                {meta?.description && (
                  <div className="text-[10px] text-wk-text-faint truncate">{meta.description}</div>
                )}
                <div className="mt-1 h-1.5 rounded-full bg-wk-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-wk-warning/60 transition-all"
                    style={{ width: `${Math.min(pct * 4, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {entries.length === 0 && totalExcluded > 0 && (
          <div className="text-[12px] text-wk-text-muted">
            {totalExcluded} rows excluded — per-reason breakdown not recorded in this edition.
          </div>
        )}
      </div>
    </div>
  );
}