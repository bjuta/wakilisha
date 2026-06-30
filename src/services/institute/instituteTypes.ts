export type InstituteConfidence = "low" | "medium" | "high";

export type InquiryStatus = "draft" | "open" | "active" | "paused" | "closed";
export type InquiryVisibility = "internal" | "private" | "public";

export type InquiryEntityRole =
  | "primary_subject"
  | "related_subject"
  | "context"
  | "place"
  | "scene"
  | "language"
  | "source";

export type InquiryNoteType =
  | "known_known"
  | "known_unknown"
  | "unknown_unknown"
  | "memory"
  | "open_question"
  | "decision_note";

export type EvidenceType =
  | "internal_memory"
  | "book_reference"
  | "field_note"
  | "article"
  | "official_documentation"
  | "academic_paper"
  | "chart_record"
  | "release_metadata"
  | "track_metadata"
  | "artist_metadata"
  | "contributor_memory"
  | "correction"
  | "interview"
  | "video"
  | "screenshot"
  | "product_test"
  | "technical_test";

export type EvidenceReviewStatus =
  | "unreviewed"
  | "reviewed"
  | "approved"
  | "disputed"
  | "rejected";

export type RetrievalStatus = "excluded" | "review_only" | "default_retrieval";

export type CulturalEntityType =
  | "artist"
  | "track"
  | "release"
  | "label"
  | "genre"
  | "place"
  | "scene"
  | "language"
  | "article"
  | "inquiry"
  | "memory"
  | "source";

export type CulturalEntityStatus = "active" | "draft" | "merged" | "archived";

export type RelationshipType =
  | "collaborated_with"
  | "appeared_on"
  | "released_by"
  | "produced_by"
  | "belongs_to_scene"
  | "connected_to_place"
  | "uses_language"
  | "charted_with"
  | "mentioned_in"
  | "remembered_for"
  | "influenced_by"
  | "influenced"
  | "shares_context_with"
  | "opened_question"
  | "disputed_by"
  | "corrected_by";

export type RelationshipReviewStatus =
  | "suggested"
  | "pending_review"
  | "approved"
  | "rejected"
  | "disputed";

export type RelationshipEvidenceSupportType =
  | "supports"
  | "challenges"
  | "contextualizes";

export type ContributorStatus = "invited" | "active" | "paused" | "blocked";
export type ContributorTrustLevel = "new" | "known" | "trusted";

export type ContributorSubmissionType =
  | "memory"
  | "evidence"
  | "relationship_suggestion"
  | "correction"
  | "context_note";

export type ContributorConsentStatus =
  | "private"
  | "internal_use"
  | "public_review_allowed";

export type ContributorSubmissionReviewStatus =
  | "submitted"
  | "triaged"
  | "needs_source"
  | "needs_clarification"
  | "accepted_as_memory"
  | "accepted_as_evidence"
  | "accepted_as_relationship_context"
  | "rejected"
  | "merged"
  | "archived";

export type ReviewSubjectType =
  | "relationship"
  | "evidence"
  | "surface_draft"
  | "ai_run"
  | "correction"
  | "claim"
  | "contributor_submission";

export type ReviewDecision =
  | "approved"
  | "rejected"
  | "needs_more_evidence"
  | "needs_rewrite"
  | "too_vague"
  | "overclaims"
  | "internal_only"
  | "duplicate"
  | "accepted_as_memory"
  | "accepted_as_evidence";

export type SurfaceDraftType =
  | "artist_orientation"
  | "start_here"
  | "relationship_reason"
  | "community_question";

export type SurfaceDraftReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "revised";

export type CorrectionSubjectType =
  | "inquiry"
  | "evidence"
  | "relationship"
  | "draft"
  | "surface"
  | "entity"
  | "contributor_submission";

export type CorrectionStatus =
  | "submitted"
  | "accepted"
  | "rejected"
  | "unresolved";

export type MemoryEmbeddingSourceType =
  | "inquiry"
  | "evidence"
  | "relationship"
  | "surface_draft"
  | "correction"
  | "field_note"
  | "contributor_submission";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface Inquiry {
  id: string;
  inquiry_number: string;
  title: string;
  slug: string;
  primary_question: string;
  short_question: string | null;
  why_it_matters: string;
  status: InquiryStatus;
  visibility: InquiryVisibility;
  owner_id: string | null;
  summary: string | null;
  current_understanding: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InquiryEntityLink {
  id: string;
  inquiry_id: string;
  entity_id: string;
  entity_role: InquiryEntityRole;
  link_note: string | null;
  added_by: string | null;
  created_at: string;
  entity?: CulturalEntity | null;
}

export interface InquiryNote {
  id: string;
  inquiry_id: string;
  note_type: InquiryNoteType;
  title: string | null;
  body: string;
  confidence: InstituteConfidence;
  created_by: string | null;
  created_at: string;
}

export interface InquiryEvidenceLink {
  inquiry_id: string;
  evidence_id: string;
  use_note: string | null;
  added_by: string | null;
  created_at: string;
  evidence?: EvidenceItem | null;
}

export interface EvidenceItem {
  id: string;
  title: string;
  evidence_type: EvidenceType;
  source_url: string | null;
  source_file: string | null;
  source_note: string | null;
  summary: string;
  main_claim: string | null;
  why_it_matters: string | null;
  reliability: InstituteConfidence;
  confidence: InstituteConfidence;
  review_status: EvidenceReviewStatus;
  retrieval_status: RetrievalStatus;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CulturalEntity {
  id: string;
  entity_type: CulturalEntityType;
  source_table: string | null;
  source_id: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  status: CulturalEntityStatus;
  created_at: string;
  updated_at: string;
}

export interface EntityRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: RelationshipType;
  reason: string;
  confidence: InstituteConfidence;
  review_status: RelationshipReviewStatus;
  public_safe: boolean;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationshipEvidenceLink {
  relationship_id: string;
  evidence_id: string;
  support_type: RelationshipEvidenceSupportType;
  note: string | null;
  created_at: string;
  evidence?: EvidenceItem | null;
}

export type UpdateEntityRelationshipInput = Partial<
  Pick<
    EntityRelationship,
    | "source_entity_id"
    | "target_entity_id"
    | "relationship_type"
    | "reason"
    | "confidence"
    | "review_status"
    | "public_safe"
    | "review_note"
  >
>;

export interface Contributor {
  id: string;
  user_id: string | null;
  display_name: string;
  role_note: string | null;
  contributor_status: ContributorStatus;
  trust_level: ContributorTrustLevel;
  created_at: string;
  updated_at: string;
}

export interface ContributorSubmission {
  id: string;
  contributor_id: string;
  inquiry_id: string | null;
  entity_id: string | null;
  submission_type: ContributorSubmissionType;
  title: string | null;
  body: string;
  source_url: string | null;
  source_note: string | null;
  consent_status: ContributorConsentStatus;
  review_status: ContributorSubmissionReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  accepted_evidence_id: string | null;
  accepted_relationship_id: string | null;
  correction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewDecisionRecord {
  id: string;
  subject_type: ReviewSubjectType;
  subject_id: string;
  decision: ReviewDecision;
  reason: string;
  reviewer_id: string | null;
  created_at: string;
}

export interface SurfaceDraft {
  id: string;
  inquiry_id: string | null;
  entity_id: string | null;
  surface_type: SurfaceDraftType;
  draft_title: string | null;
  draft_body: string;
  ai_run_id: string | null;
  review_status: SurfaceDraftReviewStatus;
  public_safe: boolean;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Correction {
  id: string;
  subject_type: CorrectionSubjectType;
  subject_id: string;
  correction_text: string;
  correction_status: CorrectionStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface MemoryEmbeddingRecord {
  id: string;
  source_type: MemoryEmbeddingSourceType;
  source_id: string;
  content: string;
  metadata: Record<string, JsonValue>;
  retrieval_status: RetrievalStatus;
  created_at: string;
}

export type UpdateInquiryInput = Partial<
  Pick<
    Inquiry,
    | "title"
    | "primary_question"
    | "short_question"
    | "why_it_matters"
    | "status"
    | "visibility"
    | "summary"
    | "current_understanding"
    | "closed_at"
  >
>;

export type CreateInquiryEntityLinkInput = Pick<
  InquiryEntityLink,
  "inquiry_id" | "entity_id"
> &
  Partial<Pick<InquiryEntityLink, "entity_role" | "link_note">>;

export type CreateInquiryInput = Pick<
  Inquiry,
  "inquiry_number" | "title" | "slug" | "primary_question" | "why_it_matters"
> &
  Partial<Pick<Inquiry, "short_question" | "status" | "visibility" | "summary" | "current_understanding">>;

export type CreateInquiryNoteInput = Pick<InquiryNote, "inquiry_id" | "note_type" | "body"> &
  Partial<Pick<InquiryNote, "title" | "confidence">>;

export type UpdateEvidenceItemInput = Partial<
  Pick<
    EvidenceItem,
    | "title"
    | "evidence_type"
    | "source_url"
    | "source_file"
    | "source_note"
    | "summary"
    | "main_claim"
    | "why_it_matters"
    | "reliability"
    | "confidence"
    | "review_status"
    | "retrieval_status"
  >
>;

export type CreateEvidenceItemInput = Pick<EvidenceItem, "title" | "evidence_type" | "summary"> &
  Partial<
    Pick<
      EvidenceItem,
      | "source_url"
      | "source_file"
      | "source_note"
      | "main_claim"
      | "why_it_matters"
      | "reliability"
      | "confidence"
      | "review_status"
      | "retrieval_status"
    >
  >;

export type CreateCulturalEntityInput = Pick<CulturalEntity, "entity_type" | "name"> &
  Partial<Pick<CulturalEntity, "source_table" | "source_id" | "slug" | "description" | "status">>;

export type CreateEntityRelationshipInput = Pick<
  EntityRelationship,
  "source_entity_id" | "target_entity_id" | "relationship_type" | "reason"
> &
  Partial<Pick<EntityRelationship, "confidence" | "review_status" | "public_safe" | "review_note">>;

export type CreateContributorInput = Pick<Contributor, "display_name"> &
  Partial<Pick<Contributor, "user_id" | "role_note" | "contributor_status" | "trust_level">>;

export type CreateContributorSubmissionInput = Pick<
  ContributorSubmission,
  "contributor_id" | "submission_type" | "body"
> &
  Partial<
    Pick<
      ContributorSubmission,
      "inquiry_id" | "entity_id" | "title" | "source_url" | "source_note" | "consent_status"
    >
  >;

export type CreateReviewDecisionInput = Pick<
  ReviewDecisionRecord,
  "subject_type" | "subject_id" | "decision" | "reason"
>;

export type CreateCorrectionInput = Pick<Correction, "subject_type" | "subject_id" | "correction_text">;

export type CreateSurfaceDraftInput = Pick<SurfaceDraft, "surface_type" | "draft_body"> &
  Partial<Pick<SurfaceDraft, "inquiry_id" | "entity_id" | "draft_title" | "ai_run_id" | "review_status" | "public_safe">>;

export type CreateMemoryEmbeddingRecordInput = Pick<
  MemoryEmbeddingRecord,
  "source_type" | "source_id" | "content"
> &
  Partial<Pick<MemoryEmbeddingRecord, "metadata" | "retrieval_status">>;
