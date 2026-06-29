import { supabase } from "@/lib/supabase";
import type {
  CreateEvidenceReviewEventInput,
  CreateRetrievalPolicyInput,
  CreateRetrievalPolicyVersionInput,
  CreateRetrievalRunInput,
  CreateRetrievalRunItemInput,
  EvidenceReviewEvent,
  RetrievalPolicy,
  RetrievalPolicyVersion,
  RetrievalRun,
  RetrievalRunItem,
} from "./retrievalTypes";

function raiseSupabaseError(error: unknown, action: string): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${action} failed: ${message}`);
}

async function insertOne<TRecord>(table: string, payload: Record<string, unknown>, action: string): Promise<TRecord> {
  const { data, error } = await supabase.from(table).insert(payload).select("*").single();

  if (error) raiseSupabaseError(error, action);
  return data as TRecord;
}

export async function createEvidenceReviewEvent(
  input: CreateEvidenceReviewEventInput,
): Promise<EvidenceReviewEvent> {
  if (
    input.next_retrieval_status === "default_retrieval" &&
    !["reviewed", "approved"].includes(input.next_review_status)
  ) {
    throw new Error("Create evidence review event failed: default retrieval requires reviewed or approved evidence.");
  }

  return insertOne<EvidenceReviewEvent>(
    "evidence_review_events",
    input,
    "Create evidence review event",
  );
}

export async function createRetrievalPolicy(input: CreateRetrievalPolicyInput): Promise<RetrievalPolicy> {
  if (input.max_items !== undefined && (input.max_items < 1 || input.max_items > 50)) {
    throw new Error("Create retrieval policy failed: max_items must be between 1 and 50.");
  }

  return insertOne<RetrievalPolicy>(
    "retrieval_policies",
    {
      requires_reviewed_evidence: true,
      allow_unreviewed_evidence: false,
      allow_disputed_evidence: false,
      allowed_evidence_types: [],
      excluded_evidence_types: [],
      max_items: 12,
      status: "draft",
      ...input,
    },
    "Create retrieval policy",
  );
}

export async function listRetrievalPolicies(): Promise<RetrievalPolicy[]> {
  const { data, error } = await supabase
    .from("retrieval_policies")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) raiseSupabaseError(error, "List retrieval policies");
  return (data ?? []) as RetrievalPolicy[];
}

export async function createRetrievalPolicyVersion(
  input: CreateRetrievalPolicyVersionInput,
): Promise<RetrievalPolicyVersion> {
  return insertOne<RetrievalPolicyVersion>(
    "retrieval_policy_versions",
    {
      policy_json: {},
      status: "draft",
      ...input,
    },
    "Create retrieval policy version",
  );
}

export async function listRetrievalPolicyVersions(policyId: string): Promise<RetrievalPolicyVersion[]> {
  const { data, error } = await supabase
    .from("retrieval_policy_versions")
    .select("*")
    .eq("policy_id", policyId)
    .order("updated_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List retrieval policy versions");
  return (data ?? []) as RetrievalPolicyVersion[];
}

export async function createRetrievalRun(input: CreateRetrievalRunInput): Promise<RetrievalRun> {
  if (!input.inquiry_id && !input.entity_id && !input.query_text?.trim()) {
    throw new Error("Create retrieval run failed: inquiry_id, entity_id, or query_text is required.");
  }

  if (input.top_k !== undefined && (input.top_k < 1 || input.top_k > 50)) {
    throw new Error("Create retrieval run failed: top_k must be between 1 and 50.");
  }

  return insertOne<RetrievalRun>(
    "retrieval_runs",
    {
      query_json: {},
      filters_json: {},
      top_k: 12,
      status: "queued",
      ...input,
      query_text: input.query_text?.trim() || null,
    },
    "Create retrieval run",
  );
}

export async function createRetrievalRunItem(input: CreateRetrievalRunItemInput): Promise<RetrievalRunItem> {
  if (!input.evidence_id && !input.memory_embedding_id && !input.source_id && !input.source_ref) {
    throw new Error("Create retrieval run item failed: evidence, memory embedding, source_id, or source_ref is required.");
  }

  const isSafeEvidence =
    input.review_status_snapshot === "reviewed" ||
    input.review_status_snapshot === "approved";

  if (
    input.included_in_context === true &&
    input.source_type === "evidence" &&
    (!isSafeEvidence || input.retrieval_status_snapshot !== "default_retrieval")
  ) {
    throw new Error("Create retrieval run item failed: included evidence must be reviewed or approved and retrieval ready.");
  }

  return insertOne<RetrievalRunItem>(
    "retrieval_run_items",
    {
      included_in_context: false,
      metadata: {},
      ...input,
    },
    "Create retrieval run item",
  );
}

export async function listRetrievalRuns(query?: {
  inquiryId?: string;
  entityId?: string;
  taskType?: string;
  limit?: number;
}): Promise<RetrievalRun[]> {
  let request = supabase
    .from("retrieval_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(query?.limit ?? 50);

  if (query?.inquiryId) {
    request = request.eq("inquiry_id", query.inquiryId);
  }

  if (query?.entityId) {
    request = request.eq("entity_id", query.entityId);
  }

  if (query?.taskType) {
    request = request.eq("task_type", query.taskType);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List retrieval runs");
  return (data ?? []) as RetrievalRun[];
}

export async function listRetrievalRunItems(retrievalRunId: string): Promise<RetrievalRunItem[]> {
  const { data, error } = await supabase
    .from("retrieval_run_items")
    .select("*")
    .eq("retrieval_run_id", retrievalRunId)
    .order("retrieval_rank", { ascending: true, nullsFirst: false });

  if (error) raiseSupabaseError(error, "List retrieval run items");
  return (data ?? []) as RetrievalRunItem[];
}

export async function listRetrievalReadyEvidence(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("institute_retrieval_ready_evidence")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List retrieval ready evidence");
  return data ?? [];
}

export async function listReviewQueueEvidence(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("institute_review_queue_evidence")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List review queue evidence");
  return data ?? [];
}
