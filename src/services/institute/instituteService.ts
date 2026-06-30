import { supabase } from "@/lib/supabase";
import type {
  Correction,
  CreateCorrectionInput,
  CreateContributorInput,
  CreateContributorSubmissionInput,
  CreateCulturalEntityInput,
  CreateEntityRelationshipInput,
  CreateEvidenceItemInput,
  UpdateEvidenceItemInput,
  CreateInquiryEntityLinkInput,
  CreateInquiryInput,
  CreateInquiryNoteInput,
  CreateMemoryEmbeddingRecordInput,
  CreateReviewDecisionInput,
  CreateSurfaceDraftInput,
  CulturalEntity,
  EntityRelationship,
  EvidenceItem,
  Inquiry,
  QuestionVersion,
  CreateQuestionVersionInput,
  InquiryEntityLink,
  InquiryEvidenceLink,
  InquiryNote,
  Contributor,
  ContributorSubmission,
  MemoryEmbeddingRecord,
  RelationshipEvidenceLink,
  ReviewDecisionRecord,
  SurfaceDraft,
  UpdateEntityRelationshipInput,
  UpdateInquiryInput,
} from "./instituteTypes";

function raiseSupabaseError(error: unknown, action: string): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${action} failed: ${message}`);
}

async function insertOne<TRecord>(table: string, payload: Record<string, unknown>, action: string): Promise<TRecord> {
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();

  if (error) raiseSupabaseError(error, action);
  return data as TRecord;
}

export async function listInquiries(): Promise<Inquiry[]> {
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List inquiries");
  return (data ?? []) as Inquiry[];
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) raiseSupabaseError(error, "Get inquiry");
  return (data ?? null) as Inquiry | null;
}

export async function createInquiry(input: CreateInquiryInput): Promise<Inquiry> {
  const inquiry = await insertOne<Inquiry>("inquiries", input, "Create inquiry");

  await createQuestionVersion({
    inquiry_id: inquiry.id,
    question_text: inquiry.primary_question,
    change_reason: "Initial curiosity.",
    change_type: "initial_question",
    metadata: { source: "create_inquiry" },
  });

  return inquiry;
}

export async function updateInquiry(id: string, input: UpdateInquiryInput): Promise<Inquiry> {
  if (!id) {
    throw new Error("Update inquiry failed: id is required.");
  }

  const { data, error } = await supabase
    .from("inquiries")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) raiseSupabaseError(error, "Update inquiry");
  return data as Inquiry;
}

function requireTrimmedValue(value: string | undefined | null, label: string): string {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  return trimmed;
}

export async function listQuestionVersions(inquiryId: string): Promise<QuestionVersion[]> {
  if (!inquiryId) {
    throw new Error("List question versions failed: inquiryId is required.");
  }

  const { data, error } = await supabase
    .from("question_versions")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("version_number", { ascending: false });

  if (error) raiseSupabaseError(error, "List question versions");
  return (data ?? []) as QuestionVersion[];
}

export async function getCurrentQuestionVersion(inquiryId: string): Promise<QuestionVersion | null> {
  if (!inquiryId) {
    throw new Error("Get current question version failed: inquiryId is required.");
  }

  const { data, error } = await supabase
    .from("question_versions")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) raiseSupabaseError(error, "Get current question version");
  return (data ?? null) as QuestionVersion | null;
}

export async function createQuestionVersion(input: CreateQuestionVersionInput): Promise<QuestionVersion> {
  const inquiryId = requireTrimmedValue(input.inquiry_id, "Inquiry id");
  const questionText = requireTrimmedValue(input.question_text, "Question text");
  const changeReason = requireTrimmedValue(input.change_reason, "Reason for change");

  const existingVersions = await listQuestionVersions(inquiryId);
  const nextVersionNumber = existingVersions.length > 0
    ? Math.max(...existingVersions.map((version) => version.version_number)) + 1
    : 1;

  const { error: unsetError } = await supabase
    .from("question_versions")
    .update({ is_current: false })
    .eq("inquiry_id", inquiryId)
    .eq("is_current", true);

  if (unsetError) raiseSupabaseError(unsetError, "Unset current question version");

  const { data, error } = await supabase
    .from("question_versions")
    .insert({
      inquiry_id: inquiryId,
      version_number: nextVersionNumber,
      question_text: questionText,
      change_reason: changeReason,
      change_type: input.change_type ?? "manual_refinement",
      is_current: true,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) raiseSupabaseError(error, "Create question version");

  const { error: inquiryError } = await supabase
    .from("inquiries")
    .update({
      primary_question: questionText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiryId);

  if (inquiryError) raiseSupabaseError(inquiryError, "Sync inquiry current question");

  return data as QuestionVersion;
}

export async function setCurrentQuestionVersion(versionId: string, reason: string): Promise<QuestionVersion> {
  const safeVersionId = requireTrimmedValue(versionId, "Question version id");
  const changeReason = requireTrimmedValue(reason, "Reason for selecting current question");

  const { data: version, error: versionError } = await supabase
    .from("question_versions")
    .select("*")
    .eq("id", safeVersionId)
    .maybeSingle();

  if (versionError) raiseSupabaseError(versionError, "Get question version for current selection");
  if (!version) {
    throw new Error("Set current question version failed: version was not found.");
  }

  const questionVersion = version as QuestionVersion;

  const { error: unsetError } = await supabase
    .from("question_versions")
    .update({ is_current: false })
    .eq("inquiry_id", questionVersion.inquiry_id)
    .eq("is_current", true);

  if (unsetError) raiseSupabaseError(unsetError, "Unset previous current question version");

  const nextMetadata = {
    ...(questionVersion.metadata ?? {}),
    current_selection_reason: changeReason,
    current_selected_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("question_versions")
    .update({
      is_current: true,
      metadata: nextMetadata,
    })
    .eq("id", safeVersionId)
    .select("*")
    .single();

  if (error) raiseSupabaseError(error, "Set current question version");

  const { error: inquiryError } = await supabase
    .from("inquiries")
    .update({
      primary_question: questionVersion.question_text,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionVersion.inquiry_id);

  if (inquiryError) raiseSupabaseError(inquiryError, "Sync inquiry current question");

  return data as QuestionVersion;
}

export async function listInquiryNotes(inquiryId: string): Promise<InquiryNote[]> {
  const { data, error } = await supabase
    .from("inquiry_notes")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List inquiry notes");
  return (data ?? []) as InquiryNote[];
}

export async function createInquiryNote(input: CreateInquiryNoteInput): Promise<InquiryNote> {
  return insertOne<InquiryNote>("inquiry_notes", input, "Create inquiry note");
}

export async function listInquiryEntityLinks(inquiryId: string): Promise<InquiryEntityLink[]> {
  const { data, error } = await supabase
    .from("inquiry_entities")
    .select("*, entity:cultural_entities(*)")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List inquiry entity links");
  return (data ?? []) as InquiryEntityLink[];
}

export async function linkEntityToInquiry(input: CreateInquiryEntityLinkInput): Promise<InquiryEntityLink> {
  return insertOne<InquiryEntityLink>(
    "inquiry_entities",
    {
      entity_role: "related_subject",
      ...input,
    },
    "Link entity to inquiry",
  );
}

export async function unlinkEntityFromInquiry(linkId: string): Promise<void> {
  if (!linkId) {
    throw new Error("Unlink entity from inquiry failed: linkId is required.");
  }

  const { error } = await supabase.from("inquiry_entities").delete().eq("id", linkId);

  if (error) raiseSupabaseError(error, "Unlink entity from inquiry");
}

export async function createEvidenceItem(input: CreateEvidenceItemInput): Promise<EvidenceItem> {
  return insertOne<EvidenceItem>("evidence_items", input, "Create evidence item");
}

export async function listEvidenceItems(query?: {
  reviewStatus?: string;
  retrievalStatus?: string;
  search?: string;
  limit?: number;
}): Promise<EvidenceItem[]> {
  let request = supabase
    .from("evidence_items")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(query?.limit ?? 100);

  if (query?.reviewStatus) {
    request = request.eq("review_status", query.reviewStatus);
  }

  if (query?.retrievalStatus) {
    request = request.eq("retrieval_status", query.retrievalStatus);
  }

  if (query?.search) {
    request = request.ilike("title", `%${query.search}%`);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List evidence items");
  return (data ?? []) as EvidenceItem[];
}

export async function getEvidenceItem(id: string): Promise<EvidenceItem | null> {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) raiseSupabaseError(error, "Get evidence item");
  return (data ?? null) as EvidenceItem | null;
}

export async function updateEvidenceItem(id: string, input: UpdateEvidenceItemInput): Promise<EvidenceItem> {
  if (!id) {
    throw new Error("Update evidence item failed: id is required.");
  }

  const { data, error } = await supabase
    .from("evidence_items")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) raiseSupabaseError(error, "Update evidence item");
  return data as EvidenceItem;
}

export async function linkEvidenceToInquiry(input: {
  inquiry_id: string;
  evidence_id: string;
  use_note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("inquiry_evidence").insert(input);

  if (error) raiseSupabaseError(error, "Link evidence to inquiry");
}

export async function listInquiryEvidenceLinks(inquiryId: string): Promise<InquiryEvidenceLink[]> {
  if (!inquiryId) {
    throw new Error("List Inquiry evidence failed: inquiryId is required.");
  }

  const { data, error } = await supabase
    .from("inquiry_evidence")
    .select("*, evidence:evidence_items(*)")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List Inquiry evidence");
  return (data ?? []) as InquiryEvidenceLink[];
}

export async function listEvidenceInquiryLinks(evidenceId: string): Promise<InquiryEvidenceLink[]> {
  if (!evidenceId) {
    throw new Error("List evidence Inquiry links failed: evidenceId is required.");
  }

  const { data, error } = await supabase
    .from("inquiry_evidence")
    .select("*, inquiry:inquiries(*)")
    .eq("evidence_id", evidenceId)
    .order("created_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List evidence Inquiry links");
  return (data ?? []) as InquiryEvidenceLink[];
}

export async function createCulturalEntityReference(input: CreateCulturalEntityInput): Promise<CulturalEntity> {
  return insertOne<CulturalEntity>("cultural_entities", input, "Create cultural entity reference");
}

export async function listCulturalEntities(query?: {
  entity_type?: string;
  search?: string;
  limit?: number;
}): Promise<CulturalEntity[]> {
  let request = supabase
    .from("cultural_entities")
    .select("*")
    .order("name", { ascending: true })
    .limit(query?.limit ?? 50);

  if (query?.entity_type) {
    request = request.eq("entity_type", query.entity_type);
  }

  if (query?.search) {
    request = request.ilike("name", `%${query.search}%`);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List cultural entities");
  return (data ?? []) as CulturalEntity[];
}

export async function createEntityRelationship(input: CreateEntityRelationshipInput): Promise<EntityRelationship> {
  return insertOne<EntityRelationship>("entity_relationships", input, "Create entity relationship");
}

export async function listEntityRelationships(query?: {
  reviewStatus?: string;
  entityId?: string;
  limit?: number;
}): Promise<EntityRelationship[]> {
  let request = supabase
    .from("entity_relationships")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(query?.limit ?? 100);

  if (query?.reviewStatus) {
    request = request.eq("review_status", query.reviewStatus);
  }

  if (query?.entityId) {
    request = request.or(`source_entity_id.eq.${query.entityId},target_entity_id.eq.${query.entityId}`);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List entity relationships");
  return (data ?? []) as EntityRelationship[];
}

export async function getEntityRelationship(id: string): Promise<EntityRelationship | null> {
  const { data, error } = await supabase
    .from("entity_relationships")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) raiseSupabaseError(error, "Get entity relationship");
  return (data ?? null) as EntityRelationship | null;
}

export async function updateEntityRelationship(
  id: string,
  input: UpdateEntityRelationshipInput,
): Promise<EntityRelationship> {
  if (!id) {
    throw new Error("Update entity relationship failed: id is required.");
  }

  const { data, error } = await supabase
    .from("entity_relationships")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) raiseSupabaseError(error, "Update entity relationship");
  return data as EntityRelationship;
}

export async function listRelationshipEvidenceLinks(relationshipId: string): Promise<RelationshipEvidenceLink[]> {
  if (!relationshipId) {
    throw new Error("List relationship evidence links failed: relationshipId is required.");
  }

  const { data, error } = await supabase
    .from("relationship_evidence")
    .select("*, evidence:evidence_items(*)")
    .eq("relationship_id", relationshipId);

  if (error) raiseSupabaseError(error, "List relationship evidence links");
  return (data ?? []) as RelationshipEvidenceLink[];
}

export async function linkRelationshipEvidence(input: {
  relationship_id: string;
  evidence_id: string;
  support_type?: "supports" | "challenges" | "contextualizes";
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("relationship_evidence").insert(input);

  if (error) raiseSupabaseError(error, "Link relationship evidence");
}

export async function unlinkRelationshipEvidence(input: {
  relationship_id: string;
  evidence_id: string;
}): Promise<void> {
  if (!input.relationship_id || !input.evidence_id) {
    throw new Error("Unlink relationship evidence failed: relationship_id and evidence_id are required.");
  }

  const { error } = await supabase
    .from("relationship_evidence")
    .delete()
    .eq("relationship_id", input.relationship_id)
    .eq("evidence_id", input.evidence_id);

  if (error) raiseSupabaseError(error, "Unlink relationship evidence");
}

export async function createContributor(input: CreateContributorInput): Promise<Contributor> {
  return insertOne<Contributor>("contributors", input, "Create contributor");
}

export async function listContributors(query?: {
  status?: string;
  trustLevel?: string;
  search?: string;
  limit?: number;
}): Promise<Contributor[]> {
  let request = supabase
    .from("contributors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(query?.limit ?? 100);

  if (query?.status) {
    request = request.eq("contributor_status", query.status);
  }

  if (query?.trustLevel) {
    request = request.eq("trust_level", query.trustLevel);
  }

  if (query?.search) {
    request = request.ilike("display_name", `%${query.search}%`);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List contributors");
  return (data ?? []) as Contributor[];
}

export async function createContributorSubmission(
  input: CreateContributorSubmissionInput,
): Promise<ContributorSubmission> {
  return insertOne<ContributorSubmission>("contributor_submissions", input, "Create contributor submission");
}

export async function listContributorSubmissions(query?: {
  inquiryId?: string;
  entityId?: string;
  reviewStatus?: string;
  submissionType?: string;
  limit?: number;
}): Promise<ContributorSubmission[]> {
  let request = supabase
    .from("contributor_submissions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(query?.limit ?? 100);

  if (query?.inquiryId) {
    request = request.eq("inquiry_id", query.inquiryId);
  }

  if (query?.entityId) {
    request = request.eq("entity_id", query.entityId);
  }

  if (query?.reviewStatus) {
    request = request.eq("review_status", query.reviewStatus);
  }

  if (query?.submissionType) {
    request = request.eq("submission_type", query.submissionType);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List contributor submissions");
  return (data ?? []) as ContributorSubmission[];
}

export async function acceptContributorSubmissionAsEvidence(input: {
  submissionId: string;
  evidenceTitle?: string | null;
  reviewNote?: string | null;
}): Promise<ContributorSubmission> {
  if (!input.submissionId) {
    throw new Error("Accept submission as evidence failed: submissionId is required.");
  }

  const { data, error } = await supabase.rpc("institute_accept_submission_as_evidence", {
    p_submission_id: input.submissionId,
    p_evidence_title: input.evidenceTitle ?? null,
    p_review_note: input.reviewNote ?? null,
  });

  if (error) raiseSupabaseError(error, "Accept submission as evidence");
  return data as ContributorSubmission;
}

export async function acceptContributorSubmissionAsMemory(input: {
  submissionId: string;
  reviewNote?: string | null;
}): Promise<ContributorSubmission> {
  if (!input.submissionId) {
    throw new Error("Accept submission as memory failed: submissionId is required.");
  }

  const { data, error } = await supabase.rpc("institute_accept_submission_as_memory", {
    p_submission_id: input.submissionId,
    p_review_note: input.reviewNote ?? null,
  });

  if (error) raiseSupabaseError(error, "Accept submission as memory");
  return data as ContributorSubmission;
}

export async function createReviewDecision(input: CreateReviewDecisionInput): Promise<ReviewDecisionRecord> {
  return insertOne<ReviewDecisionRecord>("review_decisions", input, "Create review decision");
}

export async function createCorrection(input: CreateCorrectionInput): Promise<Correction> {
  return insertOne<Correction>("corrections", input, "Create correction");
}

export async function createSurfaceDraft(input: CreateSurfaceDraftInput): Promise<SurfaceDraft> {
  if (!input.inquiry_id && !input.entity_id) {
    throw new Error("Create surface draft failed: inquiry_id or entity_id is required.");
  }

  return insertOne<SurfaceDraft>("surface_drafts", input, "Create surface draft");
}

export async function createMemoryEmbeddingRecord(
  input: CreateMemoryEmbeddingRecordInput,
): Promise<MemoryEmbeddingRecord> {
  return insertOne<MemoryEmbeddingRecord>(
    "memory_embeddings",
    {
      metadata: {},
      retrieval_status: "excluded",
      ...input,
    },
    "Create memory embedding record",
  );
}
