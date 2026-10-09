import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { wakilishaDialog } from "@/components/design-system/primitives/DialogProvider";

const targets = [
  { label: "Ficha", keep: "ficha-1d71c1",
    survivor: "80642d87-769c-4949-8ecd-b3b9f6835486",
    peer: "a708a142-dc2b-4fd2-9dbb-d780b666667c", charts: 0, providers: 0 },
  { label: "Colors", keep: "colors-1672b8",
    survivor: "bec6a6de-3001-44a7-8241-df1cd8b932ac",
    peer: "aa2793e6-ed18-40a7-9654-dfd56769fcbe", charts: 8, providers: 1 },
] as const;

type Target = (typeof targets)[number];
type Preview = {
  canonicalTrack?: { id?: string };
  duplicateTracks?: Array<{ id?: string }>;
  confidenceBucket?: string;
  blockers?: string[];
  counts?: Record<string, number>;
};
type Gate = { preview: Preview | null; error: string; applying: boolean; applied: boolean };
const empty = (): Gate => ({ preview: null, error: "", applying: false, applied: false });

async function preview(target: Target): Promise<Preview> {
  const { data, error } = await supabase.rpc("admin_preview_registry_track_duplicate_repair", {
    p_canonical_track_id: target.survivor,
    p_duplicate_track_ids: [target.peer],
  });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("Official preview unavailable.");
  return data as Preview;
}

function passes(target: Target, value: Preview): boolean {
  return value.canonicalTrack?.id === target.survivor
    && value.duplicateTracks?.length === 1
    && value.duplicateTracks[0]?.id === target.peer
    && value.confidenceBucket === "high"
    && Array.isArray(value.blockers) && value.blockers.length === 0
    && value.counts?.duplicateTracks === 1
    && value.counts?.reviewedHumanDecisionMatches === 1
    && value.counts?.chartRowsToMove === target.charts
    && value.counts?.providerLinksToMove === target.providers;
}

export default function Issue1094RepairGate() {
  const [gates, setGates] = useState<Record<string, Gate>>(
    () => Object.fromEntries(targets.map((target) => [target.label, empty()])));
  const [loading, setLoading] = useState(true);
  const busy = Object.values(gates).some((gate) => gate.applying);

  const refresh = async () => {
    if (busy) return;
    setLoading(true);
    const results = await Promise.all(targets.map(async (target) => {
      try { return { target, value: await preview(target), error: "" }; }
      catch (error) { return { target, value: null,
        error: error instanceof Error ? error.message : "Preview unavailable." }; }
    }));
    setGates((current) => {
      const next = { ...current };
      for (const result of results) if (!current[result.target.label].applied) {
        next[result.target.label] = { ...empty(), preview: result.value, error: result.error };
      }
      return next;
    });
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const apply = async (target: Target) => {
    const gate = gates[target.label];
    if (loading || busy || gate.applied || !gate.preview || !passes(target, gate.preview)) return;
    const accepted = await wakilishaDialog.confirm({
      title: "Apply reviewed Registry repair",
      message: "Keep " + target.keep + " and archive the duplicate " + target.label
        + " Track? Expected moves: " + target.charts + " Chart pointers and "
        + target.providers + " provider links. This changes canonical Registry data."
        + " DESIRE remains blocked. Independent verification and finalization are separate.",
      confirmLabel: "Apply " + target.label + " repair", destructive: true,
    });
    if (!accepted) return;
    setGates((current) => ({ ...current, [target.label]: { ...current[target.label], applying: true, error: "" } }));
    try {
      const current = await preview(target);
      if (!passes(target, current)) throw new Error("Evidence changed. Nothing applied.");
      const { error } = await supabase.rpc("admin_apply_registry_track_duplicate_repair", {
        p_canonical_track_id: target.survivor,
        p_duplicate_track_ids: [target.peer],
        p_note: "Reviewed #1094 " + target.label + " exact repair",
        p_allow_medium_confidence: false,
      });
      if (error) throw error;
      setGates((before) => ({ ...before, [target.label]: {
        ...before[target.label], applying: false, applied: true, error: "",
      } }));
    } catch (error) {
      setGates((before) => ({ ...before, [target.label]: {
        ...before[target.label], applying: false,
        error: error instanceof Error ? error.message : "Repair did not return a success receipt.",
      } }));
    }
  };

  return <section data-wk-1094-governed-repair-gate className="space-y-4">
    <h2 className="text-lg font-black text-wk-text">Governed repairs</h2>
    <p className="text-[13px] text-wk-text-muted">
      Your decisions are already recorded. The official preview checks the exact evidence
      before each confirmed repair. No repair runs automatically.
    </p>
    <WkSurface className="p-4">
      <p className="text-[13px] font-bold text-wk-text">DESIRE: blocked</p>
      <p className="text-[12px] text-wk-text-muted">
        An archived Artist alias primary credit needs separate governed reconciliation.
      </p>
    </WkSurface>
    <div className="grid gap-3 sm:grid-cols-2">
      {targets.map((target) => {
        const gate = gates[target.label];
        const ready = Boolean(gate.preview && passes(target, gate.preview));
        return <WkSurface key={target.label} className="space-y-3 p-4">
          <h3 className="text-[15px] font-black text-wk-text">{target.label}</h3>
          <p className="text-[12px] text-wk-text-muted">
            Keep {target.keep}. Expected moves: {target.charts} Chart pointers,
            {" "}{target.providers} provider links.
          </p>
          <p className="text-[12px] text-wk-text-muted">
            {gate.applied ? "Repair applied. Awaiting independent verification."
              : loading ? "Checking authenticated preview..."
              : ready ? "Official preview matches the approved evidence."
              : "Official preview blocked or differs from the approved evidence."}
          </p>
          {gate.error ? <p role="alert" className="text-[12px] text-wk-danger">{gate.error}</p> : null}
          <button type="button" className="wk-button wk-button-primary w-full"
            data-wk-1094-exact-apply={target.label.toLowerCase()}
            disabled={loading || busy || !ready || gate.applied}
            onClick={() => void apply(target)}>
            {gate.applying ? "Applying..." : gate.applied ? "Repair receipt saved"
              : "Apply " + target.label + " reviewed repair"}
          </button>
        </WkSurface>;
      })}
    </div>
    <button type="button" className="wk-button wk-button-secondary"
      onClick={() => void refresh()} disabled={loading || busy}>
      Refresh official previews
    </button>
  </section>;
}
