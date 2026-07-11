import { supabase } from "@/lib/supabase";

export type ReviewEvidenceItem = {
  id: string;
  title: string;
  evidenceType: string;
  sourceUrl: string | null;
  summary: string;
  mainClaim: string | null;
  whyItMatters: string | null;
  reviewStatus: string;
  retrievalStatus: string;
  reliability: string;
  confidence: string;
  attached: boolean;
};

export type RelationshipReviewContext = {
  relationship: {
    id: string;
    sourceEntityId: string | null;
    sourceEntityType: string;
    sourceSlug: string;
    sourceName: string;
    targetEntityId: string | null;
    targetEntityType: string;
    targetSlug: string;
    targetName: string;
    relationshipType: string;
    relationshipRole: string | null;
    relationshipStatus: string;
    reviewStatus: string;
    publicSafe: boolean;
    plainReason: string | null;
    reviewNote: string | null;
  };
  evidence: ReviewEvidenceItem[];
};

export type ContextDraft = {
  draft: string;
  uncertaintyNote: string;
  factsUsed: string[];
};

export async function loadRelationshipReviewContext(relationshipId: string): Promise<RelationshipReviewContext> {
  const { data, error } = await supabase.rpc("get_registry_relationship_review_context", {
    p_relationship_id: relationshipId,
  });
  if (error) throw new Error(error.message);
  return data as RelationshipReviewContext;
}

export async function createReviewedRelationshipEvidence(input: {
  title: string;
  evidenceType: "article" | "official_documentation" | "release_metadata" | "track_metadata" | "artist_metadata" | "interview" | "video";
  sourceUrl: string;
  summary: string;
  mainClaim: string;
  reviewReason: string;
}): Promise<ReviewEvidenceItem> {
  const { data, error } = await supabase.rpc("create_registry_relationship_review_evidence", {
    p_title: input.title,
    p_evidence_type: input.evidenceType,
    p_source_url: input.sourceUrl,
    p_summary: input.summary,
    p_main_claim: input.mainClaim,
    p_review_reason: input.reviewReason,
  });
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    title: String(row.title),
    evidenceType: String(row.evidence_type),
    sourceUrl: row.source_url ? String(row.source_url) : null,
    summary: String(row.summary),
    mainClaim: row.main_claim ? String(row.main_claim) : null,
    whyItMatters: row.why_it_matters ? String(row.why_it_matters) : null,
    reviewStatus: String(row.review_status),
    retrievalStatus: String(row.retrieval_status),
    reliability: String(row.reliability),
    confidence: String(row.confidence),
    attached: false,
  };
}

export async function draftRelationshipExplanation(relationshipId: string, evidenceId: string): Promise<ContextDraft> {
  const { data, error } = await supabase.functions.invoke("registry-context-draft", {
    body: { relationshipId, evidenceId },
  });
  if (error) throw new Error("The Culture Context Engine could not finish this draft.");
  const payload = data as {
    ok?: boolean;
    data?: { draft?: string; uncertainty_note?: string; facts_used?: string[] };
    error?: string;
  } | null;
  if (!payload?.ok || !payload.data?.draft) {
    throw new Error(payload?.error || "The Culture Context Engine returned no draft.");
  }
  return {
    draft: payload.data.draft,
    uncertaintyNote: payload.data.uncertainty_note || "",
    factsUsed: payload.data.facts_used || [],
  };
}

export async function completeRelationshipReview(input: {
  relationshipId: string;
  evidenceId: string | null;
  plainReason: string;
  reviewReason: string;
  nextReviewStatus: "pending_review" | "approved" | "rejected" | "disputed";
  publicSafe: boolean;
}) {
  const { data, error } = await supabase.rpc("complete_registry_relationship_review", {
    p_relationship_id: input.relationshipId,
    p_evidence_id: input.evidenceId,
    p_plain_reason: input.plainReason,
    p_review_reason: input.reviewReason,
    p_next_review_status: input.nextReviewStatus,
    p_public_safe: input.publicSafe,
  });
  if (error) throw new Error(error.message);
  return data;
}