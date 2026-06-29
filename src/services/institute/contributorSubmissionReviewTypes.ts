export type InstituteContributorSubmissionReviewAction =
  | "triaged"
  | "needs_source"
  | "needs_clarification"
  | "accepted_as_memory"
  | "accepted_as_evidence"
  | "rejected"
  | "archived";

export interface InstituteContributorSubmissionReviewResult {
  id: string;
  submission_type: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  updated_at: string;
}

export interface ReviewContributorSubmissionInput {
  submissionId: string;
  decision: InstituteContributorSubmissionReviewAction;
  decisionNote?: string | null;
}
