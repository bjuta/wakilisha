import { supabase } from "@/lib/supabase";
import { logLearningEvent } from "@/services/institute/learningEventsService";
import type { ReviewState } from "@/pages/admin/institute/inquiry-interface/types";

// Evidence Reader decisions. Reading prepares evidence; it never judges
// claims. A verdict updates the evidence item's review state in human
// language, keeps the why, and leaves a learning event behind.

export type EvidenceReaderVerdict =
  | "accepted"
  | "context_only"
  | "weak_source"
  | "duplicate"
  | "needs_more"
  | "rejected";

export const READER_VERDICT_OPTIONS: Array<{
  value: EvidenceReaderVerdict;
  label: string;
  hint: string;
}> = [
  { value: "accepted", label: "Accept for internal memory", hint: "Solid enough to build on." },
  { value: "context_only", label: "Keep for context only", hint: "Useful background, not load-bearing." },
  { value: "weak_source", label: "Hold as doubt, weak source", hint: "Keep it visible, do not lean on it." },
  { value: "duplicate", label: "Duplicate of other evidence", hint: "Already covered by another item." },
  { value: "needs_more", label: "Needs more evidence", hint: "Cannot stand on its own yet." },
  { value: "rejected", label: "Reject with reason", hint: "Does not belong in this inquiry." },
];

const VERDICT_TO_REVIEW_STATE: Record<EvidenceReaderVerdict, ReviewState> = {
  accepted: "Accepted for internal memory",
  context_only: "Accepted for internal memory",
  weak_source: "Kept as doubt",
  duplicate: "Rejected with reason",
  needs_more: "Needs more evidence",
  rejected: "Rejected with reason",
};

export async function recordEvidenceVerdict(
  inquiryId: string,
  evidence: { id: string; title: string; reviewState: string; metadata?: Record<string, unknown> },
  verdict: EvidenceReaderVerdict,
  note: string,
): Promise<ReviewState> {
  const cleanNote = note.trim();
  if ((verdict === "rejected" || verdict === "duplicate") && cleanNote.length < 4) {
    throw new Error("Say why. Rejections and duplicates need a reason on the record.");
  }

  const nextState = VERDICT_TO_REVIEW_STATE[verdict];
  const nextMetadata = {
    ...(evidence.metadata ?? {}),
    readerVerdict: verdict,
    readerVerdictNote: cleanNote || null,
    readerVerdictAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("institute_evidence_items")
    .update({ review_state: nextState, metadata: nextMetadata })
    .eq("id", evidence.id);

  if (error) throw error;

  await logLearningEvent(
    inquiryId,
    "evidence_review_decided",
    "Evidence Reader recorded a decision",
    { evidenceItemId: evidence.id, title: evidence.title, reviewState: evidence.reviewState },
    { evidenceItemId: evidence.id, reviewState: nextState, verdict },
    { note: cleanNote },
  );

  return nextState;
}
