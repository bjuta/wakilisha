import { WkIcon } from "@/components/design-system/Icon";

interface ScoreBreakdownChipsProps {
  sourceScore: number;
  crossSourceBonus: number;
  overlapBonus: number;
  recencyScore: number;
  continuityScore: number;
  carryForwardBonus: number;
  airplayScore: number;
  antiGamingPenalty: number;
  totalScore: number;
  /** Show the sum-invariant check: Σcomponents - penalty == stored total */
  showInvariantCheck?: boolean;
}

interface ChipDef {
  key: string;
  label: string;
  abbr: string;
  value: number;
  cap: number;
  color: string;
  section: string; // §4.x
  isPenalty?: boolean;
}

function ScoreChip({ chip }: { chip: ChipDef }) {
  const fillPct = chip.cap > 0 ? Math.min((chip.value / chip.cap) * 100, 100) : 0;
  const isZero = chip.value === 0;

  return (
    <div
      title={`${chip.section} — ${chip.label}: ${chip.value.toFixed(4)} (cap ${chip.cap})`}
      className={`relative flex flex-col items-center rounded-lg border px-2.5 py-2 text-center transition-all ${
        chip.isPenalty
          ? "border-wk-danger/30 bg-wk-danger-soft"
          : isZero
          ? "border-wk-border/50 bg-wk-bg-subtle opacity-60"
          : "border-wk-border bg-wk-bg-subtle"
      }`}
    >
      {/* Fill bar at bottom */}
      {!chip.isPenalty && chip.cap > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-lg overflow-hidden">
          <div
            className="h-full rounded-b-lg bg-wk-brand/40 transition-all"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}

      <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
        chip.isPenalty ? "text-wk-danger" : "text-wk-text-faint"
      }`}>
        {chip.abbr}
      </span>
      <span className={`text-[15px] font-black tabular-nums leading-none ${
        chip.isPenalty
          ? "text-wk-danger"
          : isZero
          ? "text-wk-text-faint"
          : "text-wk-text"
      }`}>
        {chip.isPenalty ? `-${chip.value.toFixed(1)}` : chip.value.toFixed(1)}
      </span>
      <span className="text-[9px] text-wk-text-faint mt-0.5">/ {chip.cap}</span>
    </div>
  );
}

export function ScoreBreakdownChips({
  sourceScore,
  crossSourceBonus,
  overlapBonus,
  recencyScore,
  continuityScore,
  carryForwardBonus,
  airplayScore,
  antiGamingPenalty,
  totalScore,
  showInvariantCheck = true,
}: ScoreBreakdownChipsProps) {
  const chips: ChipDef[] = [
    { key: "src",   label: "Source Score",       abbr: "SRC",   value: sourceScore,      cap: 72,  color: "brand", section: "§4.1" },
    { key: "cross", label: "Cross-Source Bonus", abbr: "CROSS", value: crossSourceBonus, cap: 24,  color: "info",  section: "§4.2" },
    { key: "ovl",   label: "Overlap Bonus",      abbr: "OVL",   value: overlapBonus,     cap: 10,  color: "info",  section: "§4.3" },
    { key: "rec",   label: "Recency Score",       abbr: "REC",   value: recencyScore,     cap: 18,  color: "success",section: "§4.4" },
    { key: "cont",  label: "Continuity Score",    abbr: "CONT",  value: continuityScore,  cap: 18,  color: "success",section: "§4.5" },
    { key: "cf",    label: "Carry-Forward Bonus", abbr: "CF",    value: carryForwardBonus,cap: 18,  color: "warning",section: "§4.6" },
    { key: "air",   label: "Airplay Score",       abbr: "AIR",   value: airplayScore,     cap: 24,  color: "brand", section: "§4.7" },
  ];

  const penalty: ChipDef = {
    key: "penalty", label: "Anti-Gaming Penalty", abbr: "PEN", value: antiGamingPenalty, cap: 999, color: "danger", section: "§7", isPenalty: true,
  };

  // Sum invariant check: Σ components - penalty should == totalScore (within float rounding ε)
  const computedSum = chips.reduce((acc, c) => acc + c.value, 0) - antiGamingPenalty;
  const epsilon = 0.001;
  const invariantPasses = Math.abs(computedSum - totalScore) <= epsilon;

  return (
    <div className="space-y-3">
      {/* Component chips */}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {chips.map((chip) => <ScoreChip key={chip.key} chip={chip} />)}
        <ScoreChip chip={penalty} />
      </div>

      {/* Total + invariant check */}
      <div className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-bg-subtle px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-wk-text-muted">= Total Score</span>
          <span className="text-[18px] font-black tabular-nums text-wk-brand">{totalScore.toFixed(4)}</span>
        </div>
        {showInvariantCheck && (
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
              invariantPasses
                ? "bg-wk-success-soft text-wk-success"
                : "bg-wk-danger-soft text-wk-danger"
            }`}
            title={`Computed: ${computedSum.toFixed(4)} | Stored: ${totalScore.toFixed(4)}`}
          >
            <WkIcon name={invariantPasses ? "CheckCircle2" : "AlertTriangle"} size={11} />
            {invariantPasses ? "Sum ✓" : `Mismatch: ${(computedSum - totalScore).toFixed(4)}`}
          </div>
        )}
      </div>
    </div>
  );
}