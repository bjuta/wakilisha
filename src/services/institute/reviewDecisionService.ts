import { supabase } from "@/lib/supabase";
import type {
  InstituteEvidenceReviewResult,
  ReviewEvidenceItemInput,
} from "./reviewDecisionTypes";

function describeSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.details,
      record.hint,
      record.code ? `code: ${String(record.code)}` : null,
    ]
      .filter(Boolean)
      .map(String);

    if (parts.length > 0) return parts.join(" ");

    try {
      return JSON.stringify(record);
    } catch {
      return "Unknown Supabase error object";
    }
  }

  return String(error);
}

function raiseSupabaseError(error: unknown, action: string): never {
  throw new Error(`${action} failed: ${describeSupabaseError(error)}`);
}

export async function reviewEvidenceItem(
  input: ReviewEvidenceItemInput,
): Promise<InstituteEvidenceReviewResult> {
  if (!input.evidenceId) {
    throw new Error("Review evidence item failed: evidenceId is required.");
  }

  const { data, error } = await supabase.rpc("institute_review_evidence_item", {
    p_evidence_id: input.evidenceId,
    p_decision: input.decision,
    p_decision_note: input.decisionNote?.trim() || null,
  });

  if (error) raiseSupabaseError(error, "Review evidence item");

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Review evidence item failed: no evidence row returned.");
  }

  return row as InstituteEvidenceReviewResult;
}
