import { useCallback, useEffect, useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import {
  isPublicMusicIdentityTrackReview,
  loadPublicMusicIdentityTrackReviewContext,
  recordRegistryReviewDecision,
  type RegistryReviewItemRow,
  type PublicMusicIdentityTrackReviewContext,
} from "@/services/adminReviewCommandCenter";

// Issue #1094. An exact, authenticated decision shortcut. It never executes repairs.
const targets = [
  {
    title: "DESIRE", slug: "desire",
    review: "2b8b2d52-6c5e-4397-914d-60c8bf0e34d2",
    peer: "f30846f0-8cf1-4df6-8875-38fa7a763e7b",
    survivor: "afbe3f47-62af-4b68-8d54-527f04987ebe",
    keep: "desire-2a895a",
    credit: "Lil Maina with Nikita Kering'",
    caveat: "The old Lilmaina Artist credit needs a separate repair before the duplicate Track can be archived.",
  },
  {
    title: "Ficha", slug: "ficha",
    review: "6c521cd1-0438-44e7-b6b0-6b737096774b",
    peer: "a708a142-dc2b-4fd2-9dbb-d780b666667c",
    survivor: "80642d87-769c-4949-8ecd-b3b9f6835486",
    keep: "ficha-1d71c1",
    credit: "Maandy with Charisma",
    caveat: "The existing survivor and its credits remain unchanged at this step.",
  },
  {
    title: "Colors", slug: "colors",
    review: "49ec3921-3f3e-46d3-8c3a-62f826957dfd",
    peer: "aa2793e6-ed18-40a7-9654-dfd56769fcbe",
    survivor: "bec6a6de-3001-44a7-8241-df1cd8b932ac",
    keep: "colors-1672b8",
    credit: "Njerae with Bensoul",
    caveat: "All 17 Chart pointers and the Apple Music link must be preserved when the later repair runs.",
  },
] as const;

type Target = (typeof targets)[number];
type Loaded = {
  target: Target;
  item: RegistryReviewItemRow;
  context: PublicMusicIdentityTrackReviewContext;
  recorded: boolean;
};

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};

async function load(): Promise<Loaded[]> {
  const ids = targets.map((target) => target.review);
  const [reviewResult, decisionResult, contexts] = await Promise.all([
    supabase.from("registry_review_items")
      .select("id, review_key, entity_type, entity_id, review_type, priority, status, title, summary, source_table, source_id, source_payload, candidate_payload, resolution_payload, created_at, updated_at")
      .in("id", ids),
    supabase.from("registry_canonicalization_decisions")
      .select("review_item_id, decision_type, after_payload")
      .in("review_item_id", ids).eq("status", "recorded")
      .eq("metadata->>programmeKey", "public_music_identity_track_actual_zero_v1"),
    Promise.all(targets.map((target) => loadPublicMusicIdentityTrackReviewContext(target.review))),
  ]);
  if (reviewResult.error) throw reviewResult.error;
  if (decisionResult.error) throw decisionResult.error;
  const reviews = (reviewResult.data ?? []) as RegistryReviewItemRow[];
  const decisions = (decisionResult.data ?? []) as Array<{
    review_item_id: string;
    decision_type: string;
    after_payload: Record<string, unknown> | null;
  }>;
  if (reviews.length !== targets.length) {
    throw new Error("The three approved reviews are not all available. No action was taken.");
  }
  return targets.map((target, index) => {
    const item = reviews.find((row) => row.id === target.review);
    const context = contexts[index];
    const source = object(item?.source_payload);
    const evidence = object(source.evidence);
    const peers = Array.isArray(evidence.peers) ? evidence.peers : [];
    if (!item || item.status !== "open" || !isPublicMusicIdentityTrackReview(item)
      || item.source_id !== target.peer || source.ruleId !== "track_recording_identity_conflict"
      || source.ruleVersion !== "1.3.0" || context.reviewId !== target.review
      || context.trackId !== target.peer || context.currentSlug !== target.slug
      || context.reviewStatus !== "open"
      || context.ruleId !== "track_recording_identity_conflict" || context.ruleVersion !== "1.3.0"
      || context.openRecordingIdentityReviewId !== target.review
      || !context.trackStateFingerprint
      || !peers.some((candidate: unknown) =>
        object(candidate).id === target.survivor && object(candidate).slug === target.keep)) {
      throw new Error(target.title + " no longer matches the approved evidence. No action was taken.");
    }
    const current = decisions.filter((decision) => decision.review_item_id === target.review);
    if (current.some((decision) => decision.decision_type !== "public_music_identity_true_duplicate"
      || object(decision.after_payload).canonicalTrackId !== target.survivor)) {
      throw new Error(target.title + " has a conflicting recorded decision. No action was taken.");
    }
    return { target, item, context, recorded: current.length > 0 };
  });
}

export default function Issue1094ExactDecisions() {
  const [rows, setRows] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRows(await load()); }
    catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "Unable to verify the three reviews.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const remaining = rows.filter((row) => !row.recorded).length;

  const recordApproved = async () => {
    if (saving || loading || rows.length !== targets.length || remaining === 0) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Recheck all identities before the first decision. On retry, already
      // recorded matching decisions are skipped, preserving partial progress.
      const checked = await load();
      for (const row of checked) {
        if (row.recorded) continue;
        await recordRegistryReviewDecision({
          item: row.item,
          decisionType: "public_music_identity_true_duplicate",
          expectedTrackStateFingerprint: row.context.trackStateFingerprint,
          notes: "Owner-approved same recording, issue #1094. Keep " + row.target.keep
            + ". No canonical data change is authorised by this decision.",
          resolutionPayload: {
            reviewedFrom: "issue_1094_exact_decisions",
            programmeIssue: 1094,
            canonicalTrackId: row.target.survivor,
            canonicalEntitiesChanged: false,
            reviewResolved: false,
            redirectMutation: false,
          },
        });
        setRows((current) => current.map((entry) =>
          entry.target.review === row.target.review ? { ...entry, recorded: true } : entry));
      }
      setSuccess("All three decisions are recorded. The repair stage remains separate.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recording stopped. Previously saved decisions remain.");
    } finally {
      setSaving(false);
      await refresh();
    }
  };

  return (
    <div data-wk-mizizi-1094-decisions className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide text-wk-brand">MIZIZI / Issue #1094</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-wk-text">Your three recording decisions</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-wk-text-muted">
          These are the exact recordings you already approved. One action records your decisions. No Tracks or credits change here.
        </p>
      </div>
      {loading ? <WkSurface className="p-5 text-[13px] text-wk-text-muted">Checking the three reviews...</WkSurface> : null}
      {error ? <WkSurface className="border border-wk-danger/30 p-4 text-[13px] text-wk-danger" role="alert">{error}</WkSurface> : null}
      {!loading && rows.length === targets.length ? (
        <WkSurface className="overflow-hidden p-0">
          <div className="divide-y divide-wk-border">
            {rows.map((row) => (
              <section key={row.target.review} className="space-y-3 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[16px] font-black text-wk-text">{row.target.title}</h2>
                  <span className="rounded-full bg-wk-brand-soft px-3 py-1 text-[11px] font-bold text-wk-brand">
                    {row.recorded ? "Decision recorded" : "Same recording"}
                  </span>
                </div>
                <p className="text-[12px] text-wk-text-muted">{row.target.credit}</p>
                <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                  <div className="rounded-lg border border-wk-border p-3">
                    <span className="text-wk-text-muted">Keep this Track</span>
                    <p className="mt-1 font-bold text-wk-text">{row.target.keep}</p>
                  </div>
                  <div className="rounded-lg border border-wk-border p-3">
                    <span className="text-wk-text-muted">Duplicate Track</span>
                    <p className="mt-1 font-bold text-wk-text">{row.target.slug}</p>
                  </div>
                </div>
                <p className="text-[12px] text-wk-text-muted">{row.target.caveat}</p>
              </section>
            ))}
          </div>
          <div className="space-y-3 border-t border-wk-border p-5 sm:p-6">
            <p className="text-[12px] leading-5 text-wk-text-muted">
              This records only the human decisions. Verified duplicate repairs and final review closure happen later.
            </p>
            <button type="button" data-wk-1094-record-decisions onClick={() => void recordApproved()}
              disabled={saving || remaining === 0} className="wk-button wk-button-primary w-full sm:w-auto">
              {saving ? "Recording..." : remaining === 0 ? "All three recorded"
                : "Record " + remaining + " approved decision" + (remaining === 1 ? "" : "s")}
            </button>
            {success ? <p className="text-[12px] font-semibold text-wk-brand" role="status">{success}</p> : null}
          </div>
        </WkSurface>
      ) : null}
      {!saving && !loading && error ? (
        <button type="button" onClick={() => void refresh()} className="wk-button wk-button-secondary">Check again</button>
      ) : null}
    </div>
  );
}
