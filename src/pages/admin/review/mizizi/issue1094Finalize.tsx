import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { wakilishaDialog } from "@/components/design-system/primitives/DialogProvider";

// Immutable receipts from #1094 authenticated Admin decisions and verified operations.
const receipts = [
  {
    label: "Ficha", slug: "ficha-1d71c1",
    review: "6c521cd1-0438-44e7-b6b0-6b737096774b",
    decision: "dcc44187-cc0e-4c55-be4c-5a0eeb0604fa",
    operation: "60919a4e-9e75-482c-a5e5-29a5def99414",
    survivor: "80642d87-769c-4949-8ecd-b3b9f6835486",
    duplicate: "a708a142-dc2b-4fd2-9dbb-d780b666667c",
  },
  {
    label: "Colors", slug: "colors-1672b8",
    review: "49ec3921-3f3e-46d3-8c3a-62f826957dfd",
    decision: "ff660681-6062-4268-a11f-a86788cf7ba9",
    operation: "539815a6-8df4-45e0-94d6-c6fbaddf98ae",
    survivor: "bec6a6de-3001-44a7-8241-df1cd8b932ac",
    duplicate: "aa2793e6-ed18-40a7-9654-dfd56769fcbe",
  },
] as const;

type Receipt = (typeof receipts)[number];
type Review = {
  id: string; status: string;
  source_id: string | null;
  source_payload: Record<string, unknown> | null;
  resolution_payload: Record<string, unknown> | null;
};
type State = { status: "open" | "resolved" | "blocked"; error: string };

function isExpectedResolution(review: Review, item: Receipt): boolean {
  const resolved = review.resolution_payload ?? {};
  return review.status === "resolved"
    && resolved.decisionId === item.decision
    && resolved.verifiedOperationId === item.operation
    && resolved.canonicalTrackId === item.survivor
    && resolved.finalizerAuthority === "admin_finalize_public_music_identity_track_review_v1";
}

async function current(item: Receipt): Promise<Review> {
  const { data, error } = await supabase.from("registry_review_items")
    .select("id,status,source_id,source_payload,resolution_payload")
    .eq("id", item.review).single();
  if (error) throw error;
  if (!data) throw new Error("The exact review was not found.");
  return data as Review;
}

function verifyReview(review: Review, item: Receipt): State {
  if (isExpectedResolution(review, item)) return { status: "resolved", error: "" };
  if (review.id !== item.review || review.source_id !== item.duplicate
      || review.source_payload?.ruleId !== "track_recording_identity_conflict"
      || review.source_payload?.ruleVersion !== "1.3.0"
      || review.status !== "open") {
    return { status: "blocked", error: "The reviewed evidence changed. Finalization is blocked." };
  }
  return { status: "open", error: "" };
}

export default function Issue1094Finalize() {
  const [state, setState] = useState<Record<string, State>>({});
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const verified = await Promise.all(receipts.map(async (item) => {
      try { return [item.label, verifyReview(await current(item), item)] as const; }
      catch (e) { return [item.label, {
        status: "blocked" as const,
        error: e instanceof Error ? e.message : "Review authority unavailable",
      }] as const; }
    }));
    setState(Object.fromEntries(verified));
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const eligible = !loading && receipts.every(item =>
    ["open", "resolved"].includes(state[item.label]?.status ?? "blocked"));
  const pending = receipts.filter(item => state[item.label]?.status === "open");

  const finalize = async () => {
    if (loading || working || !eligible || pending.length === 0) return;
    const accepted = await wakilishaDialog.confirm({
      title: "Finalize two verified recording reviews",
      message: "The repairs are already independently verified. This will close only their exact Ficha and Colors reviews and preserve their approved surviving Tracks. DESIRE remains open and blocked.",
      confirmLabel: "Finalize verified reviews",
      destructive: false,
    });
    if (!accepted) return;
    setWorking(true);
    try {
      for (const item of receipts) {
        const now = verifyReview(await current(item), item);
        if (now.status === "resolved") continue;
        if (now.status !== "open") throw new Error(item.label + ": " + now.error);
        const { error } = await supabase.rpc("admin_finalize_public_music_identity_track_review_v1", {
          p_review_id: item.review,
          p_decision_id: item.decision,
          p_verified_operation_id: item.operation,
          p_archive_event_id: null,
          p_note: "Issue #1094: exact reviewed duplicate repair independently verified. Keep " + item.slug,
        });
        if (error) throw error;
        const after = verifyReview(await current(item), item);
        if (after.status !== "resolved") throw new Error(item.label + ": finalization receipt not independently readable.");
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Finalization stopped.";
      await refresh();
      setState(prev => ({
        ...prev,
        workflowError: { status: "blocked", error: reason },
      }));
      setWorking(false);
      return;
    }
    await refresh();
    setWorking(false);
  };

  return <div data-wk-1094-finalization className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
    <h1 className="text-2xl font-black text-wk-text">Finish Ficha and Colors</h1>
    <p className="text-[13px] leading-6 text-wk-text-muted">
      Both repairs passed independent verification. This final step closes their two exact reviews.
      It does not repeat the repairs or affect DESIRE.
    </p>
    <WkSurface className="space-y-4 p-5">
      {receipts.map(item => (
        <div key={item.review} className="flex items-center justify-between gap-4 border-b border-wk-border pb-3">
          <div><p className="font-bold text-wk-text">{item.label}</p>
            <p className="text-[12px] text-wk-text-muted">Keep {item.slug}</p></div>
          <span className="text-[12px] font-semibold text-wk-text">
            {loading ? "Checking" : state[item.label]?.status === "resolved" ? "Finalized"
              : state[item.label]?.status === "open" ? "Ready" : "Blocked"}
          </span>
        </div>
      ))}
      {receipts.map(item => state[item.label]?.error ?
        <p key={item.label} role="alert" className="text-[12px] text-wk-danger">
          {item.label}: {state[item.label]?.error}
        </p> : null)}
      {state.workflowError?.error ?
        <p role="alert" className="text-[12px] text-wk-danger">{state.workflowError.error}</p> : null}
      <button type="button" data-wk-1094-finalize-exact className="wk-button wk-button-primary w-full"
        disabled={loading || working || !eligible || pending.length === 0}
        onClick={() => void finalize()}>
        {working ? "Finalizing..." : pending.length === 0 && eligible
          ? "Both reviews finalized" : "Finalize " + pending.length + " verified reviews"}
      </button>
    </WkSurface>
    <WkSurface className="p-4">
      <p className="text-[13px] font-bold text-wk-text">DESIRE stays open</p>
      <p className="text-[12px] text-wk-text-muted">
        Its archived Lilmaina credit requires separate governed reconciliation.
      </p>
    </WkSurface>
  </div>;
}
