/** Exact #1094 operator view. Only authenticated existing Registry facts are evidence.
 * No repair, finalization, approval or new case is ever performed by this reader.
 */
import { supabase } from "@/lib/supabase";

const RULE_ID = "track_recording_identity_conflict";
const RULE_VERSION = "1.3.0";
const FINALIZER = "admin_finalize_public_music_identity_track_review_v1";

export const ISSUE_1094_CASES = [
  {
    key: "desire", title: "DESIRE",
    reviewId: "2b8b2d52-6c5e-4397-914d-60c8bf0e34d2",
    duplicateId: "f30846f0-8cf1-4df6-8875-38fa7a763e7b",
    survivorId: "afbe3f47-62af-4b68-8d54-527f04987ebe",
    decisionId: "829342ba-c6ab-47e2-b48a-ac8d7de254d5",
    operationId: null,
  },
  {
    key: "ficha", title: "Ficha",
    reviewId: "6c521cd1-0438-44e7-b6b0-6b737096774b",
    duplicateId: "a708a142-dc2b-4fd2-9dbb-d780b666667c",
    survivorId: "80642d87-769c-4949-8ecd-b3b9f6835486",
    decisionId: "dcc44187-cc0e-4c55-be4c-5a0eeb0604fa",
    operationId: "60919a4e-9e75-482c-a5e5-29a5def99414",
  },
  {
    key: "colors", title: "Colors",
    reviewId: "49ec3921-3f3e-46d3-8c3a-62f826957dfd",
    duplicateId: "aa2793e6-ed18-40a7-9654-dfd56769fcbe",
    survivorId: "bec6a6de-3001-44a7-8241-df1cd8b932ac",
    decisionId: "ff660681-6062-4268-a11f-a86788cf7ba9",
    operationId: "539815a6-8df4-45e0-94d6-c6fbaddf98ae",
  },
] as const;

export type Issue1094ReviewFact = Readonly<{
  id: string;
  status: string;
  source_id: string | null;
  source_payload: Record<string, unknown> | null;
  resolution_payload: Record<string, unknown> | null;
}>;

export type Issue1094DecisionFact = Readonly<{
  id: string;
  review_item_id: string;
  status: string;
  decision_type: string;
  after_payload: Record<string, unknown> | null;
}>;

export type Issue1094BriefRow = Readonly<{
  key: "desire" | "ficha" | "colors";
  title: string;
  reviewId: string;
  decisionId: string;
  operationId: string | null;
  status: "blocked" | "completed" | "unverified";
  summary: string;
}>;

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};

/** Fail closed on missing, duplicate or stale receipts; do not infer an action from a snapshot. */
export function projectIssue1094Brief(
  reviews: readonly Issue1094ReviewFact[],
  decisions: readonly Issue1094DecisionFact[],
): readonly Issue1094BriefRow[] {
  const reviewIds = ISSUE_1094_CASES.map((target) => target.reviewId);
  if (reviews.some((review) => !reviewIds.includes(review.id as typeof reviewIds[number]))) {
    throw new TypeError("Unexpected Registry review in #1094 result");
  }
  const reviewed = new Map<string, Issue1094ReviewFact>();
  for (const review of reviews) {
    if (reviewed.has(review.id)) throw new TypeError("Duplicate #1094 Registry review");
    reviewed.set(review.id, review);
  }
  return ISSUE_1094_CASES.map((target) => {
    const base = {
      key: target.key,
      title: target.title,
      reviewId: target.reviewId,
      decisionId: target.decisionId,
      operationId: target.operationId,
    };
    const row = reviewed.get(target.reviewId);
    const source = asObject(row?.source_payload);
    const resolution = asObject(row?.resolution_payload);
    const validSource = row?.source_id === target.duplicateId &&
      source.ruleId === RULE_ID && source.ruleVersion === RULE_VERSION;
    const unverified = (summary: string): Issue1094BriefRow =>
      ({ ...base, status: "unverified", summary });
    if (!row || !validSource) {
      return unverified("Evidence is missing or has changed. Review the original Registry record.");
    }
    if (target.key === "desire") {
      const matching = decisions.filter((decision) => decision.review_item_id === target.reviewId);
      const decision = matching[0];
      if (row.status !== "open" || matching.length !== 1 ||
          decision?.id !== target.decisionId || decision.status !== "recorded" ||
          decision.decision_type !== "public_music_identity_true_duplicate" ||
          asObject(decision.after_payload).canonicalTrackId !== target.survivorId) {
        return unverified("Decision or open-review authority differs from the accepted #1094 record.");
      }
      return {
        ...base, status: "blocked",
        summary: "Human duplicate decision recorded. Review remains open. The documented archived Lilmaina Artist credit blocker needs separate governed reconciliation.",
      };
    }
    if (row.status !== "resolved" ||
        resolution.decisionId !== target.decisionId ||
        resolution.verifiedOperationId !== target.operationId ||
        resolution.canonicalTrackId !== target.survivorId ||
        resolution.sourceTrackId !== target.duplicateId ||
        resolution.finalizerAuthority !== FINALIZER) {
      return unverified("This completion cannot be verified against its exact recorded decision and operation receipt.");
    }
    return {
      ...base, status: "completed",
      summary: "Review resolved. Exact human decision and verified operation receipts match. No repair needs repeating.",
    };
  });
}

export async function loadIssue1094Brief(): Promise<readonly Issue1094BriefRow[]> {
  const ids = ISSUE_1094_CASES.map((target) => target.reviewId);
  const [reviews, decisions] = await Promise.all([
    supabase.from("registry_review_items")
      .select("id,status,source_id,source_payload,resolution_payload")
      .in("id", ids),
    supabase.from("registry_canonicalization_decisions")
      .select("id,review_item_id,status,decision_type,after_payload")
      .eq("review_item_id", ISSUE_1094_CASES[0].reviewId)
      .eq("status", "recorded")
      .eq("metadata->>programmeKey", "public_music_identity_track_actual_zero_v1"),
  ]);
  if (reviews.error) throw reviews.error;
  if (decisions.error) throw decisions.error;
  return projectIssue1094Brief(
    (reviews.data ?? []) as Issue1094ReviewFact[],
    (decisions.data ?? []) as Issue1094DecisionFact[],
  );
}
