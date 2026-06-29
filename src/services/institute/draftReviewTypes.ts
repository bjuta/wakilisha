export type InstituteDraftReviewAction =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_rewrite"
  | "too_vague"
  | "overclaims"
  | "public_safe_enabled"
  | "public_safe_disabled";

export interface InstituteDraftReviewResult {
  id: string;
  surface_type: string;
  review_status: string;
  public_safe: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface ReviewSurfaceDraftInput {
  draftId: string;
  decision: InstituteDraftReviewAction;
  decisionNote?: string | null;
}
