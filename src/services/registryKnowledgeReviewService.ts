import { supabase } from "@/lib/supabase";

export interface MissingArtistIntakeRow {
  legacy_slug: string;
  suggested_display_name: string;
  affected_relationship_count: number;
  missing_source_count: number;
  missing_target_count: number;
  relationship_types: string[];
  submission_id: string | null;
  submission_review_status: string | null;
  submission_created_at: string | null;
  submission_reviewed_at: string | null;
  intake_state: "needs_intake" | "needs_reassessment" | "intake_in_progress" | "review_completed";
}

export interface EndpointWorkRow {
  relationship_id: string;
  missing_side: "source" | "target";
  missing_entity_type: string;
  legacy_slug: string;
  relationship_type: string;
  relationship_role: string | null;
  source_entity_id: string | null;
  target_entity_id: string | null;
  alias_match_count: number;
  alias_candidate_id: string | null;
  endpoint_work_state: "missing_entity" | "ready_to_resolve" | "ambiguous_alias";
}

export interface EvidenceReadinessRow {
  relationship_id: string;
  source_entity_type: string;
  source_entity_id: string | null;
  source_slug: string;
  target_entity_type: string;
  target_entity_id: string | null;
  target_slug: string;
  relationship_type: string;
  relationship_role: string | null;
  evidence_count: number;
  has_plain_reason: boolean;
  evidence_work_state: "resolve_endpoints" | "attach_evidence" | "add_plain_reason" | "ready_for_review";
}

export interface ConsolidationRow {
  relationship_id: string;
  source_entity_type: string;
  source_entity_id: string | null;
  source_slug: string;
  source_comparison_key: string;
  target_entity_type: string;
  target_entity_id: string | null;
  target_slug: string;
  target_comparison_key: string;
  relationship_type: string;
  relationship_role: string | null;
  relationship_status: string;
  review_status: string;
  public_safe: boolean;
  plain_reason: string | null;
  evidence_count: number;
  consolidation_state: string;
  vocabulary_supported: boolean;
  duplicate_group_size: number;
  duplicate_candidate: boolean;
}

export interface RegistryKnowledgeReviewSnapshot {
  missingArtists: MissingArtistIntakeRow[];
  endpoints: EndpointWorkRow[];
  evidence: EvidenceReadinessRow[];
  relationships: ConsolidationRow[];
}

export interface RelationshipReviewInput {
  relationshipId: string;
  evidenceTitle: string;
  evidenceType: string;
  sourceUrl: string;
  evidenceSummary: string;
  evidenceMainClaim: string;
  reliability: string;
  confidence: string;
  plainReason: string;
  reviewReason: string;
  nextReviewStatus: "pending_review" | "approved" | "rejected" | "disputed";
  publicSafe: boolean;
}

export interface RelationshipReviewDraft {
  evidenceTitle: string;
  evidenceType: string;
  evidenceSummary: string;
  evidenceMainClaim: string;
  publicExplanation: string;
  uncertaintyNote: string;
  reliability: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
}

function throwQueryError(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function loadRegistryKnowledgeReviewSnapshot(): Promise<RegistryKnowledgeReviewSnapshot> {
  const [missingArtistsResult, endpointsResult, evidenceResult, relationshipsResult] = await Promise.all([
    supabase.from("registry_missing_artist_intake_queue").select("*").order("affected_relationship_count", { ascending: false }).order("legacy_slug"),
    supabase.from("registry_relationship_endpoint_work_queue").select("*").order("endpoint_work_state").order("legacy_slug"),
    supabase.from("registry_relationship_evidence_readiness_queue").select("*").order("evidence_work_state").order("relationship_type"),
    supabase.from("registry_relationship_consolidation_queue").select("*").order("consolidation_state").order("relationship_type"),
  ]);

  throwQueryError(missingArtistsResult.error, "Missing artist queue failed");
  throwQueryError(endpointsResult.error, "Endpoint queue failed");
  throwQueryError(evidenceResult.error, "Evidence queue failed");
  throwQueryError(relationshipsResult.error, "Relationship queue failed");

  return {
    missingArtists: (missingArtistsResult.data ?? []) as MissingArtistIntakeRow[],
    endpoints: (endpointsResult.data ?? []) as EndpointWorkRow[],
    evidence: (evidenceResult.data ?? []) as EvidenceReadinessRow[],
    relationships: (relationshipsResult.data ?? []) as ConsolidationRow[],
  };
}

export async function createMissingArtistIntake(input: {
  legacySlug: string;
  displayName: string;
  reason: string;
  sourceUrl?: string;
}) {
  const { data, error } = await supabase.rpc("create_registry_missing_artist_intake", {
    p_legacy_slug: input.legacySlug,
    p_display_name: input.displayName,
    p_reason: input.reason,
    p_source_url: input.sourceUrl?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function acceptMissingArtistIntake(input: { submissionId: string; reviewReason: string }) {
  const { data, error } = await supabase.rpc("accept_registry_missing_artist_intake", {
    p_submission_id: input.submissionId,
    p_review_reason: input.reviewReason,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function completeRelationshipReview(input: RelationshipReviewInput) {
  const { data, error } = await supabase.rpc("complete_registry_relationship_review", {
    p_relationship_id: input.relationshipId,
    p_evidence_title: input.evidenceTitle.trim(),
    p_evidence_type: input.evidenceType,
    p_source_url: input.sourceUrl.trim() || null,
    p_evidence_summary: input.evidenceSummary.trim(),
    p_evidence_main_claim: input.evidenceMainClaim.trim() || null,
    p_reliability: input.reliability,
    p_confidence: input.confidence,
    p_plain_reason: input.plainReason.trim(),
    p_review_reason: input.reviewReason.trim(),
    p_next_review_status: input.nextReviewStatus,
    p_public_safe: input.publicSafe,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function draftRelationshipReview(relationshipId: string): Promise<RelationshipReviewDraft> {
  const { data, error } = await supabase.functions.invoke("registry-relationship-context", {
    body: { relationshipId },
  });
  if (error) throw new Error("The Culture Context Engine could not finish this review draft.");
  const payload = data as {
    ok?: boolean;
    data?: {
      evidence_title?: string;
      evidence_type?: string;
      evidence_summary?: string;
      evidence_main_claim?: string;
      public_explanation?: string;
      uncertainty_note?: string;
      reliability?: "low" | "medium" | "high";
      confidence?: "low" | "medium" | "high";
    };
    error?: string;
  } | null;
  const draft = payload?.data;
  if (!payload?.ok || !draft?.evidence_title || !draft.evidence_summary || !draft.public_explanation) {
    throw new Error(payload?.error || "The Culture Context Engine returned an incomplete review draft.");
  }
  return {
    evidenceTitle: draft.evidence_title,
    evidenceType: draft.evidence_type || "track_metadata",
    evidenceSummary: draft.evidence_summary,
    evidenceMainClaim: draft.evidence_main_claim || "",
    publicExplanation: draft.public_explanation,
    uncertaintyNote: draft.uncertainty_note || "",
    reliability: draft.reliability || "medium",
    confidence: draft.confidence || "medium",
  };
}
