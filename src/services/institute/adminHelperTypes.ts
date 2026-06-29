import type { JsonValue } from "./instituteTypes";

export type HumanReviewSubjectType =
  | "evidence"
  | "relationship"
  | "contributor_submission"
  | "surface_draft"
  | "correction";

export interface HumanReviewQueueItem {
  subject_type: HumanReviewSubjectType;
  subject_id: string;
  title: string;
  summary: string;
  review_status: string;
  review_reason: string;
  priority_weight: number;
  inquiry_id: string | null;
  entity_id: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, JsonValue>;
}

export interface InstituteAdminOverviewCount {
  metric_key:
    | "review_queue_items"
    | "active_inquiries"
    | "retrieval_ready_evidence"
    | "approved_relationships"
    | "pending_contributor_submissions";
  metric_value: number;
  measured_at: string;
}

export interface InstituteAdminInquiryEvidence {
  inquiry_id: string;
  inquiry_number: string;
  inquiry_title: string;
  inquiry_slug: string;
  evidence_id: string;
  evidence_title: string;
  evidence_type: string;
  summary: string;
  review_status: string;
  retrieval_status: string;
  use_note: string | null;
  added_by: string | null;
  added_at: string;
}

export interface InstituteAdminEntityRelationship {
  relationship_id: string;
  relationship_type: string;
  reason: string;
  confidence: string;
  review_status: string;
  public_safe: boolean;
  source_entity_id: string;
  source_entity_type: string;
  source_entity_name: string;
  source_entity_slug: string | null;
  target_entity_id: string;
  target_entity_type: string;
  target_entity_name: string;
  target_entity_slug: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
