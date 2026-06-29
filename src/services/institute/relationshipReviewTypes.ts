export type InstituteRelationshipReviewAction =
  | "approved"
  | "rejected"
  | "disputed"
  | "needs_more_evidence"
  | "public_safe_enabled"
  | "public_safe_disabled";

export interface InstituteRelationshipReviewResult {
  id: string;
  relationship_type: string;
  review_status: string;
  public_safe: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  updated_at: string;
}

export interface ReviewEntityRelationshipInput {
  relationshipId: string;
  decision: InstituteRelationshipReviewAction;
  decisionNote?: string | null;
}
