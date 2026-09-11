import { supabase } from "@/lib/supabase";

export interface FieldIntakeSummary {
  submission_resource_id: string;
  submission_reference: string;
  submission_state: string;
  current_revision: number;
  newsroom_identity_mode: string;
  contributor_identity_redacted: boolean;
  follow_up_permission: "allowed" | "not_allowed";
  preferred_contact_channel: "messages" | "email" | "phone" | null;
  can_message_contributor: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldIntakeDetail extends FieldIntakeSummary {
  contributor_person_resource_id: string | null;
  public_attribution_preference: string;
  declared_sensitivity: string;
  source_protection_request: string;
  embargo_request_mode: string;
  requested_embargo_until: string | null;
  location_mode: string;
  location_description: string | null;
  content_captured_at: string | null;
  received_at: string | null;
  submitted_at: string | null;
}

export interface FieldMessageStartResult {
  command_receipt_id: string;
  receipt_status: string;
  conversation_id: string;
  message_id: string;
  mailbox_folder: string;
  first_contact_state: string;
  idempotent_replay: boolean;
}

export interface FieldPromotionItem {
  media_intake_id: string;
  slot_number: number;
  media_asset_id: string;
  media_asset_revision_id: string;
  asset_title: string;
  media_governance_version_id: string;
  media_governance_version_number: number;
  media_governance_public_safety_state: string;
  media_governance_reviewed: boolean;
  promotion_eligible: boolean;
  source_id: string | null;
  source_version_id: string | null;
  promoted_at: string | null;
}

export interface FieldPromotionState {
  submission_resource_id: string;
  submission_reference: string;
  submission_state: string;
  current_revision: number;
  can_promote_sources: boolean;
  items: FieldPromotionItem[];
}

export interface FieldPromotionResult {
  command_receipt_id: string;
  receipt_status: string;
  submission_resource_id: string;
  source_id: string | null;
  source_version_id: string | null;
  source_review_status: string | null;
  media_asset_id: string | null;
  media_asset_revision_id: string | null;
  media_governance_version_id: string | null;
  idempotent_replay: boolean;
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new Error(error.message || `Field newsroom RPC failed: ${name}`);
  return data as T;
}

export async function listFieldSubmissionIntakes(): Promise<FieldIntakeSummary[]> {
  const rows = await rpc<FieldIntakeSummary[]>("list_field_submission_intakes_v1", { p_limit: 100 });
  return rows ?? [];
}

export async function getFieldSubmissionIntake(submissionResourceId: string): Promise<FieldIntakeDetail> {
  return rpc<FieldIntakeDetail>("get_field_submission_intake_v2", { p_submission_resource_id: submissionResourceId });
}

export async function getFieldSubmissionPromotionState(
  submissionResourceId: string,
): Promise<FieldPromotionState> {
  return rpc<FieldPromotionState>("get_field_submission_promotion_state_v1", {
    p_submission_resource_id: submissionResourceId,
  });
}

export async function startFieldSubmissionMessage(
  submission: Pick<FieldIntakeDetail, "submission_resource_id" | "current_revision">,
  body: string,
): Promise<FieldMessageStartResult> {
  const rows = await rpc<FieldMessageStartResult[]>("start_field_submission_message_v1", {
    p_submission_resource_id: submission.submission_resource_id,
    p_expected_submission_revision: submission.current_revision,
    p_body: body,
    p_idempotency_key: `field.message.start:${crypto.randomUUID()}`,
    p_correlation_id: null,
    p_client_created_at: new Date().toISOString(),
  });
  if (!rows?.[0]) throw new Error("Field Messages start returned no result.");
  return rows[0];
}

export async function promoteFieldSubmissionToSource(
  submission: Pick<FieldIntakeDetail, "submission_resource_id" | "current_revision">,
  mediaIntakeId: string,
): Promise<FieldPromotionResult> {
  const rows = await rpc<FieldPromotionResult[]>("promote_field_submission_to_source_v1", {
    p_submission_resource_id: submission.submission_resource_id,
    p_expected_submission_revision: submission.current_revision,
    p_media_intake_id: mediaIntakeId,
    p_idempotency_key: `field.promote.source:${crypto.randomUUID()}`,
    p_correlation_id: null,
  });
  if (!rows?.[0]) throw new Error("Field Source promotion returned no result.");
  return rows[0];
}
