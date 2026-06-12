import { WkIcon } from "@/components/design-system/Icon";
import type { WkChartEntryV2Row } from "@/services/chartsScoring/scoringTypes";

interface AuditSurfacePanelProps {
  entries: WkChartEntryV2Row[];
}

function AggregateChip({ label, value, cap, color = "brand" }: { label: string; value: number; cap: number; color?: "brand" | "warning" | "danger" | "info" | "success" }) {
  const pct = cap > 0 ? Math.min((value / cap) * 100, 100) : 0;
  const colorMap: Record<string, string> = {
    brand: "bg-wk-brand-soft text-wk-brand",
    warning: "bg-wk-warning-soft text-wk-warning",
    danger: "bg-wk-danger-soft text-wk-danger",
    info: "bg-wk-info-soft text-wk-info",
    success: "bg-wk-success-soft text-wk-success",
  };
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-wk-text-faint">{label}</span>
        <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${colorMap[color]}`}>{pct.toFixed(0)}%</span>
      </div>
      <span className="text-[16px] font-black tabular-nums text-wk-text">{value.toFixed(2)}</span>
      <div className="h-1 rounded-full bg-wk-border overflow-hidden">
        <div className="h-full rounded-full bg-wk-brand/50 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatPill({ label, value, accent = "muted" }: { label: string; value: number | string; accent?: "muted" | "brand" | "success" | "warning" | "danger" | "info" }) {
  const colors: Record<string, string> = {
    muted: "text-wk-text-muted",
    brand: "text-wk-brand",
    success: "text-wk-success",
    warning: "text-wk-warning",
    danger: "text-wk-danger",
    info: "text-wk-info",
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-wk-text-faint">{label}</span>
      <span className={`text-[12px] font-black tabular-nums ${colors[accent]}`}>{value}</span>
    </div>
  );
}

export function AuditSurfacePanel({ entries }: AuditSurfacePanelProps) {
  if (entries.length === 0) return null;

  const n = entries.length;

  // Component averages
  const avgSrc = entries.reduce((s, e) => s + e.source_score, 0) / n;
  const avgCross = entries.reduce((s, e) => s + e.cross_source_bonus, 0) / n;
  const avgOvl = entries.reduce((s, e) => s + e.overlap_bonus, 0) / n;
  const avgRec = entries.reduce((s, e) => s + e.recency_score, 0) / n;
  const avgCont = entries.reduce((s, e) => s + e.continuity_score, 0) / n;
  const avgCf = entries.reduce((s, e) => s + e.carry_forward_bonus, 0) / n;
  const avgAir = entries.reduce((s, e) => s + e.airplay_score, 0) / n;
  const avgPen = entries.reduce((s, e) => s + e.anti_gaming_penalty, 0) / n;
  const avgTotal = entries.reduce((s, e) => s + e.total_score, 0) / n;

  // Invariant pass rate
  const invariantPass = entries.filter((e) => {
    const computed =
      e.source_score + e.cross_source_bonus + e.overlap_bonus + e.recency_score +
      e.continuity_score + e.carry_forward_bonus + e.airplay_score - e.anti_gaming_penalty;
    return Math.abs(computed - e.total_score) <= 0.001;
  }).length;
  const invariantRate = Math.round((invariantPass / n) * 100);

  // Anti-gaming counts
  const overlapCapped = entries.filter((e) => e.overlap_bonus_capped).length;
  const artistOverflow = entries.filter((e) => e.lead_artist_overflow).length;
  const staleCf = entries.filter((e) => e.stale_carry_forward_demoted).length;
  const airplayCandidates = entries.filter((e) => e.airplay_candidate_only).length;

  // Movement breakdown
  const newEntries = entries.filter((e) => e.movement === "new").length;
  const reEntries = entries.filter((e) => e.movement === "reentry").length;
  const carryForward = entries.filter((e) => e.carry_forward_only).length;
  const movedUp = entries.filter((e) => e.movement === "up").length;
  const movedDown = entries.filter((e) => e.movement === "down").length;
  const same = entries.filter((e) => e.movement === "same").length;

  // Airplay coverage
  const airplayActive = entries.filter((e) => e.airplay_score > 0).length;
  const airplayCoverage = Math.round((airplayActive / n) * 100);

  return (
    <div className="rounded-xl border border-wk-border bg-wk-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-wk-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
            <WkIcon name="BarChart2" size={15} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-wk-text">Entry Audit Surface</div>
            <div className="text-[11px] text-wk-text-muted">
              {n} entries · {invariantRate}% invariant pass · {airplayCoverage}% airplay coverage
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatPill label="New" value={newEntries} accent="success" />
          <StatPill label="Re-entry" value={reEntries} accent="info" />
          <StatPill label="CF" value={carryForward} accent="warning" />
        </div>
      </div>

      {/* Component averages */}
      <div className="grid grid-cols-4 gap-3 p-5 sm:grid-cols-8">
        <AggregateChip label="SRC" value={avgSrc} cap={72} />
        <AggregateChip label="CROSS" value={avgCross} cap={24} />
        <AggregateChip label="OVL" value={avgOvl} cap={10} />
        <AggregateChip label="REC" value={avgRec} cap={18} />
        <AggregateChip label="CONT" value={avgCont} cap={18} />
        <AggregateChip label="CF" value={avgCf} cap={18} color="warning" />
        <AggregateChip label="AIR" value={avgAir} cap={24} />
        <AggregateChip label="PEN" value={avgPen} cap={999} color="danger" />
      </div>

      {/* Total + invariant */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-wk-border bg-wk-bg-subtle">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-wk-text-muted">Avg Total Score</span>
          <span className="text-[16px] font-black tabular-nums text-wk-brand">{avgTotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${invariantRate === 100 ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>
            <WkIcon name={invariantRate === 100 ? "CheckCircle2" : "AlertTriangle"} size={10} />
            {invariantRate === 100 ? "All invariants pass" : `${n - invariantPass} mismatch${n - invariantPass === 1 ? "" : "es"}`}
          </div>
          <div className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold bg-wk-info-soft text-wk-info">
            <WkIcon name="Radio" size={10} />
            {airplayCoverage}% airplay
          </div>
        </div>
      </div>

      {/* Anti-gaming + movement breakdown */}
      <div className="grid grid-cols-2 gap-px bg-wk-border sm:grid-cols-4">
        {[
          { label: "Overlap Capped", value: overlapCapped, icon: "AlertTriangle", color: "text-wk-warning" },
          { label: "Artist Overflow", value: artistOverflow, icon: "Users", color: "text-wk-danger" },
          { label: "Stale CF Demoted", value: staleCf, icon: "RotateCcw", color: "text-wk-warning" },
          { label: "Airplay Rescue", value: airplayCandidates, icon: "Radio", color: "text-wk-info" },
          { label: "Moved Up", value: movedUp, icon: "ArrowUp", color: "text-wk-success" },
          { label: "Moved Down", value: movedDown, icon: "ArrowDown", color: "text-wk-danger" },
          { label: "Same Position", value: same, icon: "Minus", color: "text-wk-text-muted" },
          { label: "New Entries", value: newEntries, icon: "Star", color: "text-wk-success" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="flex items-center gap-3 bg-wk-surface px-4 py-2.5">
            <WkIcon name={icon as never} size={12} className={`shrink-0 ${color}`} />
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-wk-text-muted">{label}</span>
                <span className="text-[13px] font-black tabular-nums text-wk-text">{value}</span>
              </div>
              <div className="h-1 rounded-full bg-wk-border overflow-hidden">
                <div className="h-full rounded-full bg-wk-brand/30" style={{ width: `${Math.min((value / n) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}