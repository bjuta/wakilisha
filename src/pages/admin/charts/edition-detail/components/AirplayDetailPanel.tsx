import { WkIcon } from "@/components/design-system/Icon";

interface AirplayDetailPanelProps {
  airplayScore: number;
  detections: number | null;
  stationCount: number | null;
  totalDurationSeconds: number | null;
  weightedScore: number | null;
  lastDetectedAt: string | null;
  matchedBy: string | null;
  rescueMode: string | null;
  isAirplayCandidate: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AirplayDetailPanel({
  airplayScore,
  detections,
  stationCount,
  totalDurationSeconds,
  weightedScore,
  lastDetectedAt,
  matchedBy,
  rescueMode,
  isAirplayCandidate,
}: AirplayDetailPanelProps) {
  const hasAirplay = airplayScore > 0 || (detections !== null && detections > 0);

  if (!hasAirplay) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-2.5 text-[11px] text-wk-text-faint">
        <WkIcon name="Radio" size={13} />
        No airplay data for this track this week
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-wk-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-wk-border bg-wk-bg-subtle px-4 py-2.5">
        <WkIcon name="Radio" size={14} className="text-wk-brand" />
        <span className="text-[12px] font-bold text-wk-text">Airplay Breakdown (§5)</span>
        {isAirplayCandidate && (
          <span className="rounded-full bg-wk-info-soft px-2 py-0.5 text-[9px] font-bold text-wk-info">
            RESCUE CANDIDATE
          </span>
        )}
        <span className="ml-auto text-[14px] font-black tabular-nums text-wk-brand">
          +{airplayScore.toFixed(4)}
        </span>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-px bg-wk-border sm:grid-cols-3">
        {[
          { label: "Detections (D)",     value: detections?.toString() ?? "—",             icon: "Zap",     title: "Total qualifying detections this week" },
          { label: "Stations (S)",       value: stationCount?.toString() ?? "—",            icon: "Antenna", title: "Distinct stations contributing" },
          { label: "Total Airtime",      value: formatDuration(totalDurationSeconds),       icon: "Clock",   title: "Sum of qualifying detection durations" },
          { label: "Weighted Score (W)", value: weightedScore?.toFixed(4) ?? "—",           icon: "Scale",   title: "Σ detection_count×weight + duration/60 across stations" },
          { label: "Matched By",         value: matchedBy ?? "—",                           icon: "Link",    title: "How the detection was linked to this track" },
          { label: "Rescue Mode",        value: rescueMode ?? "—",                          icon: "Siren",   title: "allow_rescue or strengthen_only" },
        ].map(({ label, value, icon, title }) => (
          <div key={label} className="flex flex-col gap-0.5 bg-wk-surface px-3 py-2.5" title={title}>
            <div className="flex items-center gap-1.5">
              <WkIcon name={icon as never} size={11} className="text-wk-text-faint" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-wk-text-faint">{label}</span>
            </div>
            <span className="text-[13px] font-bold font-mono text-wk-text">{value}</span>
          </div>
        ))}
      </div>

      {/* Last detected */}
      {lastDetectedAt && (
        <div className="border-t border-wk-border bg-wk-bg-subtle px-4 py-2 flex items-center gap-2 text-[11px] text-wk-text-muted">
          <WkIcon name="Clock" size={11} />
          Last detected: {formatDateTime(lastDetectedAt)}
        </div>
      )}

      {/* Formula explanation */}
      <div className="border-t border-wk-border bg-wk-bg-subtle px-4 py-2">
        <p className="text-[10px] text-wk-text-faint font-mono">
          W={weightedScore?.toFixed(2) ?? "?"} → base=ln(1+{weightedScore?.toFixed(2) ?? "?"})×4.25
          {stationCount !== null && stationCount > 1 ? ` + station_bonus(${stationCount - 1}×1.5)` : ""}
          {detections !== null && detections >= 3 ? ` + detection_bonus(⌊${detections}/3⌋)` : ""}
          {" "}→ min(24, …×weight) = <strong>{airplayScore.toFixed(4)}</strong>
        </p>
      </div>
    </div>
  );
}