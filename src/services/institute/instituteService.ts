import { supabase } from "@/lib/supabase";
import type {
  Correction,
  CreateCorrectionInput,
  CreateContributorInput,
  CreateContributorSubmissionInput,
  CreateCulturalEntityInput,
  CreateEntityRelationshipInput,
  CreateEvidenceItemInput,
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
  InquiryEntityLink,
  InquiryNote,
  Contributor,
  ContributorSubmission,
  MemoryEmbeddingRecord,
  ReviewDecisionRecord,
  SurfaceDraft,
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
  return insertOne<Inquiry>("inquiries", input, "Create inquiry");
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

export async function linkEvidenceToInquiry(input: {
  inquiry_id: string;
  evidence_id: string;
  use_note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("inquiry_evidence").insert(input);

  if (error) raiseSupabaseError(error, "Link evidence to inquiry");
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

export async function linkRelationshipEvidence(input: {
  relationship_id: string;
  evidence_id: string;
  support_type?: "supports" | "challenges" | "contextualizes";
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("relationship_evidence").insert(input);

  if (error) raiseSupabaseError(error, "Link relationship evidence");
}

export async function createContributor(input: CreateContributorInput): Promise<Contributor> {
  return insertOne<Contributor>("contributors", input, "Create contributor");
}

export async function createContributorSubmission(
  input: CreateContributorSubmissionInput,
): Promise<ContributorSubmission> {
  return insertOne<ContributorSubmission>("contributor_submissions", input, "Create contributor submission");
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
