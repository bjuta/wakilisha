import { supabase } from "@/lib/supabase";
import type {
  InstituteDraftReviewResult,
  ReviewSurfaceDraftInput,
} from "./draftReviewTypes";

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

export async function reviewSurfaceDraft(
  input: ReviewSurfaceDraftInput,
): Promise<InstituteDraftReviewResult> {
  if (!input.draftId) {
    throw new Error("Review surface draft failed: draftId is required.");
  }

  const { data, error } = await supabase.rpc("institute_review_surface_draft", {
    p_draft_id: input.draftId,
    p_decision: input.decision,
    p_decision_note: input.decisionNote?.trim() || null,
  });

  if (error) raiseSupabaseError(error, "Review surface draft");

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Review surface draft failed: no draft row returned.");
  }

  return row as InstituteDraftReviewResult;
}
