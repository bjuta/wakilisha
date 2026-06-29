import { supabase } from "@/lib/supabase";
import type {
  HumanReviewQueueItem,
  HumanReviewSubjectType,
  InstituteAdminEntityRelationship,
  InstituteAdminInquiryEvidence,
  InstituteAdminOverviewCount,
} from "./adminHelperTypes";

function describeSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.details,
      record.hint,
      record.code ? `code: ${String(record.code)}` : null,
    ]
      .filter(Boolean)
      .map(String);

    if (parts.length > 0) return parts.join(" ");

    try {
      return JSON.stringify(record);
    } catch {
      return "Unknown Supabase error object";
    }
  }

  return String(error);
}

function raiseSupabaseError(error: unknown, action: string): never {
  throw new Error(`${action} failed: ${describeSupabaseError(error)}`);
}

export async function listHumanReviewQueueItems(query?: {
  subjectType?: HumanReviewSubjectType;
  inquiryId?: string;
  entityId?: string;
  limit?: number;
}): Promise<HumanReviewQueueItem[]> {
  let request = supabase
    .from("institute_review_queue_items")
    .select("*")
    .order("priority_weight", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(query?.limit ?? 50);

  if (query?.subjectType) {
    request = request.eq("subject_type", query.subjectType);
  }

  if (query?.inquiryId) {
    request = request.eq("inquiry_id", query.inquiryId);
  }

  if (query?.entityId) {
    request = request.eq("entity_id", query.entityId);
  }

  const { data, error } = await request;

  if (error) raiseSupabaseError(error, "List human review queue items");
  return (data ?? []) as HumanReviewQueueItem[];
}

export async function listInstituteAdminOverviewCounts(): Promise<InstituteAdminOverviewCount[]> {
  const { data, error } = await supabase
    .from("institute_admin_overview_counts")
    .select("*")
    .order("metric_key", { ascending: true });

  if (error) raiseSupabaseError(error, "List Institute admin overview counts");
  return (data ?? []) as InstituteAdminOverviewCount[];
}

export async function getInstituteAdminOverviewCountMap(): Promise<Record<string, number>> {
  const rows = await listInstituteAdminOverviewCounts();

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.metric_key] = Number(row.metric_value ?? 0);
    return acc;
  }, {});
}

export async function listInstituteAdminInquiryEvidence(inquiryId: string): Promise<InstituteAdminInquiryEvidence[]> {
  const { data, error } = await supabase
    .from("institute_admin_inquiry_evidence")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("added_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List Institute admin inquiry evidence");
  return (data ?? []) as InstituteAdminInquiryEvidence[];
}

export async function listInstituteAdminEntityRelationships(entityId: string): Promise<InstituteAdminEntityRelationship[]> {
  const { data, error } = await supabase
    .from("institute_admin_entity_relationships")
    .select("*")
    .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
    .order("updated_at", { ascending: false });

  if (error) raiseSupabaseError(error, "List Institute admin entity relationships");
  return (data ?? []) as InstituteAdminEntityRelationship[];
}
