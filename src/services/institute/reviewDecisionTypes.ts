export type InstituteEvidenceReviewAction =
  | "reviewed"
  | "approved"
  | "rejected"
  | "disputed"
  | "needs_more_evidence"
  | "retrieval_enabled"
  | "retrieval_disabled";

export interface InstituteEvidenceReviewResult {
  id: string;
  title: string;
  review_status: string;
  retrieval_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface ReviewEvidenceItemInput {
  evidenceId: string;
  decision: InstituteEvidenceReviewAction;
  decisionNote?: string | null;
}
