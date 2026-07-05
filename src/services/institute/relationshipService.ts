import { supabase } from "@/lib/supabase";
import { logLearningEvent } from "@/services/institute/learningEventsService";

// Relationships are judgments, not links. Humans create every row here:
// accept a candidate, create manually, or change a status with a reason.
// The assistant only ever files candidates in the suggestions pipeline.
// No hard delete exists in this service, by contract.

export const RELATIONSHIP_ENTITY_TYPES = [
  "artist",
  "track",
  "release",
  "label",
  "genre",
  "scene",
  "place",
  "event",
  "institution",
  "person",
  "work",
  "contributor_memory",
  "evidence_item",
  "claim",
  "inquiry",
] as const;

export type RelationshipEntityType = (typeof RELATIONSHIP_ENTITY_TYPES)[number];

export type RelationshipConfidenceBand = "well_supported" | "partly_supported" | "thin_support";

export const CONFIDENCE_BAND_LABELS: Record<RelationshipConfidenceBand, string> = {
  well_supported: "Well supported by the material",
  partly_supported: "Partly supported by the material",
  thin_support: "Thin support so far",
};

export type RelationshipEntity = {
  entityType: RelationshipEntityType;
  label: string;
  registrySlug: string | null;
};

export type InstituteRelationship = {
  id: string;
  inquiryId: string;
  source: RelationshipEntity;
  target: RelationshipEntity;
  relationshipKind: string;
  plainReason: string;
  confidenceBand: RelationshipConfidenceBand;
  evidenceRefs: Array<{ type: string; id: string }>;
  sourceSuggestionId: string | null;
  status: "accepted" | "superseded" | "withdrawn_with_reason";
  statusReason: string | null;
  supersededByRelationshipId: string | null;
  createdAt: string;
  statusChangedAt: string | null;
};

type RelationshipRow = {
  id: string;
  inquiry_id: string;
  source_entity_type: string;
  source_entity_label: string;
  source_entity_slug: string | null;
  target_entity_type: string;
  target_entity_label: string;
  target_entity_slug: string | null;
  relationship_kind: string;
  plain_reason: string;
  confidence_band: string;
  evidence_refs: Array<{ type: string; id: string }> | null;
  source_suggestion_id: string | null;
  status: string;
  status_reason: string | null;
  superseded_by_relationship_id: string | null;
  created_at: string;
  status_changed_at: string | null;
};

const SELECT_COLUMNS =
  "id, inquiry_id, source_entity_type, source_entity_label, source_entity_slug, target_entity_type, target_entity_label, target_entity_slug, relationship_kind, plain_reason, confidence_band, evidence_refs, source_suggestion_id, status, status_reason, superseded_by_relationship_id, created_at, status_changed_at";

function mapRow(row: RelationshipRow): InstituteRelationship {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    source: {
      entityType: row.source_entity_type as RelationshipEntityType,
      label: row.source_entity_label,
      registrySlug: row.source_entity_slug,
    },
    target: {
      entityType: row.target_entity_type as RelationshipEntityType,
      label: row.target_entity_label,
      registrySlug: row.target_entity_slug,
    },
    relationshipKind: row.relationship_kind,
    plainReason: row.plain_reason,
    confidenceBand: row.confidence_band as RelationshipConfidenceBand,
    evidenceRefs: row.evidence_refs ?? [],
    sourceSuggestionId: row.source_suggestion_id,
    status: row.status as InstituteRelationship["status"],
    statusReason: row.status_reason,
    supersededByRelationshipId: row.superseded_by_relationship_id,
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function listRelationships(inquiryId: string): Promise<InstituteRelationship[]> {
  const { data, error } = await supabase
    .from("institute_relationships")
    .select(SELECT_COLUMNS)
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RelationshipRow[]).map(mapRow);
}

export type RelationshipInput = {
  source: RelationshipEntity;
  target: RelationshipEntity;
  relationshipKind: string;
  plainReason: string;
  confidenceBand: RelationshipConfidenceBand;
  evidenceItemIds: string[];
  sourceSuggestionId?: string | null;
};

function validateInput(input: RelationshipInput) {
  if (!input.source.label.trim() || !input.target.label.trim()) {
    throw new Error("Both sides of the relationship need a name.");
  }
  if (input.relationshipKind.trim().length === 0) {
    throw new Error("Say how the two are related, in a short phrase.");
  }
  if (input.plainReason.trim().length <= 3) {
    throw new Error("A link without a reason is not a relationship. Say why.");
  }
  if (input.evidenceItemIds.length === 0) {
    throw new Error("A relationship stands on evidence. Attach at least one evidence item, or keep this as doubt.");
  }
}

/**
 * Creates an accepted relationship. When it started as an assistant
 * candidate, the source suggestion is marked accepted in the same flow.
 */
export async function createRelationship(
  inquiry: { id: string; code: string },
  input: RelationshipInput,
): Promise<InstituteRelationship> {
  validateInput(input);
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("institute_relationships")
    .insert({
      inquiry_id: inquiry.id,
      source_entity_type: input.source.entityType,
      source_entity_label: input.source.label.trim(),
      source_entity_slug: input.source.registrySlug?.trim() || null,
      target_entity_type: input.target.entityType,
      target_entity_label: input.target.label.trim(),
      target_entity_slug: input.target.registrySlug?.trim() || null,
      relationship_kind: input.relationshipKind.trim(),
      plain_reason: input.plainReason.trim(),
      confidence_band: input.confidenceBand,
      evidence_refs: input.evidenceItemIds.map((id) => ({ type: "evidence_item", id })),
      source_suggestion_id: input.sourceSuggestionId ?? null,
      created_by: userId,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This inquiry already holds this judgment. Supersede the standing one if this is better.");
    }
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error("Relationships are not set up in this environment yet. The migration has to land first.");
    }
    throw error;
  }

  const relationship = mapRow(data as RelationshipRow);

  if (input.sourceSuggestionId) {
    await supabase
      .from("institute_assistant_suggestions")
      .update({ status: "accepted", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", input.sourceSuggestionId);
  }

  await logLearningEvent(
    inquiry.id,
    "relationship_accepted",
    "A relationship was accepted",
    {},
    {
      relationshipId: relationship.id,
      source: relationship.source.label,
      kind: relationship.relationshipKind,
      target: relationship.target.label,
      confidenceBand: relationship.confidenceBand,
    },
    { reason: relationship.plainReason, fromSuggestion: Boolean(input.sourceSuggestionId) },
  );

  return relationship;
}

/** Withdraws a standing relationship, keeping it readable forever. */
export async function withdrawRelationship(
  inquiry: { id: string },
  relationship: InstituteRelationship,
  reason: string,
): Promise<void> {
  const cleanReason = reason.trim();
  if (cleanReason.length <= 3) throw new Error("Withdrawing needs a reason on the record.");
  const userId = await currentUserId();

  const { error } = await supabase
    .from("institute_relationships")
    .update({
      status: "withdrawn_with_reason",
      status_reason: cleanReason,
      updated_by: userId,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", relationship.id);

  if (error) throw error;

  await logLearningEvent(
    inquiry.id,
    "relationship_status_changed",
    "A relationship was withdrawn",
    { relationshipId: relationship.id, status: relationship.status },
    { relationshipId: relationship.id, status: "withdrawn_with_reason" },
    { reason: cleanReason },
  );
}

/**
 * Replaces a standing judgment: creates the better relationship first, then
 * marks the old one superseded pointing at it. Both stay readable.
 */
export async function supersedeRelationship(
  inquiry: { id: string; code: string },
  oldRelationship: InstituteRelationship,
  replacement: RelationshipInput,
  reason: string,
): Promise<InstituteRelationship> {
  const cleanReason = reason.trim();
  if (cleanReason.length <= 3) throw new Error("Superseding needs a reason on the record.");
  const userId = await currentUserId();

  // Withdraw-style guard: the duplicate index only watches accepted rows, so
  // supersede the old row first when the replacement shares the same edge.
  const { error: statusError } = await supabase
    .from("institute_relationships")
    .update({
      status: "superseded",
      status_reason: cleanReason,
      superseded_by_relationship_id: oldRelationship.id, // temporary self-target; repointed below
      updated_by: userId,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", oldRelationship.id);

  if (statusError) throw statusError;

  let replacementRelationship: InstituteRelationship;
  try {
    replacementRelationship = await createRelationship(inquiry, replacement);
  } catch (error) {
    // Put the old judgment back on its feet if the replacement failed.
    await supabase
      .from("institute_relationships")
      .update({ status: "accepted", status_reason: null, superseded_by_relationship_id: null })
      .eq("id", oldRelationship.id);
    throw error;
  }

  await supabase
    .from("institute_relationships")
    .update({ superseded_by_relationship_id: replacementRelationship.id })
    .eq("id", oldRelationship.id);

  await logLearningEvent(
    inquiry.id,
    "relationship_status_changed",
    "A relationship was superseded by a better judgment",
    { relationshipId: oldRelationship.id, status: oldRelationship.status },
    {
      relationshipId: oldRelationship.id,
      status: "superseded",
      supersededBy: replacementRelationship.id,
    },
    { reason: cleanReason },
  );

  return replacementRelationship;
}
