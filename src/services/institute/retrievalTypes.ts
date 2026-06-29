import type { EvidenceReviewStatus, JsonValue, RetrievalStatus } from "./instituteTypes";
import type { InferenceTaskType } from "./modelPromptTypes";

export type EvidenceReviewDecision =
  | "reviewed"
  | "approved"
  | "rejected"
  | "disputed"
  | "needs_more_evidence"
  | "retrieval_enabled"
  | "retrieval_disabled";

export type RetrievalPolicyStatus = "draft" | "active" | "paused" | "deprecated";
export type RetrievalRunType =
  | "manual_test"
  | "context_build"
  | "evidence_refresh"
  | "embedding_candidate_refresh"
  | "evaluation";

export type RetrievalRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type RetrievalRunItemSourceType =
  | "evidence"
  | "memory_embedding"
  | "inquiry_note"
  | "relationship"
  | "contributor_submission"
  | "manual_context";

export interface EvidenceReviewEvent {
  id: string;
  evidence_id: string;
  decision: EvidenceReviewDecision;
  previous_review_status: EvidenceReviewStatus | null;
  next_review_status: EvidenceReviewStatus;
  previous_retrieval_status: RetrievalStatus | null;
  next_retrieval_status: RetrievalStatus;
  decision_note: string | null;
  decided_by: string | null;
  created_at: string;
}

export interface RetrievalPolicy {
  id: string;
  policy_key: string;
  display_name: string;
  task_type: InferenceTaskType;
  purpose: string;
  requires_reviewed_evidence: boolean;
  allow_unreviewed_evidence: boolean;
  allow_disputed_evidence: boolean;
  allowed_evidence_types: string[];
  excluded_evidence_types: string[];
  max_items: number;
  status: RetrievalPolicyStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetrievalPolicyVersion {
  id: string;
  policy_id: string;
  version_name: string;
  policy_json: Record<string, JsonValue>;
  status: RetrievalPolicyStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetrievalRun {
  id: string;
  run_type: RetrievalRunType;
  task_type: InferenceTaskType;
  inquiry_id: string | null;
  entity_id: string | null;
  policy_id: string | null;
  policy_version_id: string | null;
  query_text: string | null;
  query_json: Record<string, JsonValue>;
  filters_json: Record<string, JsonValue>;
  top_k: number;
  status: RetrievalRunStatus;
  error_message: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RetrievalRunItem {
  id: string;
  retrieval_run_id: string;
  source_type: RetrievalRunItemSourceType;
  evidence_id: string | null;
  memory_embedding_id: string | null;
  source_table: string | null;
  source_id: string | null;
  source_ref: string | null;
  source_title: string | null;
  excerpt: string | null;
  retrieval_rank: number | null;
  similarity_score: number | null;
  review_status_snapshot: EvidenceReviewStatus | null;
  retrieval_status_snapshot: RetrievalStatus | null;
  included_in_context: boolean;
  exclusion_reason: string | null;
  metadata: Record<string, JsonValue>;
  created_at: string;
}

export type CreateEvidenceReviewEventInput = Pick<
  EvidenceReviewEvent,
  "evidence_id" | "decision" | "next_review_status" | "next_retrieval_status"
> &
  Partial<
    Pick<
      EvidenceReviewEvent,
      | "previous_review_status"
      | "previous_retrieval_status"
      | "decision_note"
    >
  >;

export type CreateRetrievalPolicyInput = Pick<
  RetrievalPolicy,
  "policy_key" | "display_name" | "task_type" | "purpose"
> &
  Partial<
    Pick<
      RetrievalPolicy,
      | "requires_reviewed_evidence"
      | "allow_unreviewed_evidence"
      | "allow_disputed_evidence"
      | "allowed_evidence_types"
      | "excluded_evidence_types"
      | "max_items"
      | "status"
      | "notes"
    >
  >;

export type CreateRetrievalPolicyVersionInput = Pick<
  RetrievalPolicyVersion,
  "policy_id" | "version_name"
> &
  Partial<Pick<RetrievalPolicyVersion, "policy_json" | "status" | "approved_by" | "approved_at">>;

export type CreateRetrievalRunInput = Pick<RetrievalRun, "run_type" | "task_type"> &
  Partial<
    Pick<
      RetrievalRun,
      | "inquiry_id"
      | "entity_id"
      | "policy_id"
      | "policy_version_id"
      | "query_text"
      | "query_json"
      | "filters_json"
      | "top_k"
      | "status"
      | "error_message"
      | "started_at"
      | "completed_at"
    >
  >;

export type CreateRetrievalRunItemInput = Pick<
  RetrievalRunItem,
  "retrieval_run_id" | "source_type"
> &
  Partial<
    Pick<
      RetrievalRunItem,
      | "evidence_id"
      | "memory_embedding_id"
      | "source_table"
      | "source_id"
      | "source_ref"
      | "source_title"
      | "excerpt"
      | "retrieval_rank"
      | "similarity_score"
      | "review_status_snapshot"
      | "retrieval_status_snapshot"
      | "included_in_context"
      | "exclusion_reason"
      | "metadata"
    >
  >;
