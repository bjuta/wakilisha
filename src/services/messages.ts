import { supabase } from "@/lib/supabase";

export type MessageFolder =
  | "inbox"
  | "requests"
  | "spam"
  | "archived";

export type MessageSenderCategory =
  | "staff"
  | "system"
  | "contributors"
  | "members"
  | "public";

export type FirstContactDisposition =
  | "inbox"
  | "requests"
  | "reject";

export interface MessagePersonPresentation {
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  canonical_path?: string | null;
  label?: string | null;
  actor_key?: string | null;
  actor_kind?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface MessageParticipantIdentity {
  actor_kind?: "human" | "system" | "automation" | string;
  person_resource_id: string;
  actor_key?: string | null;
  presentation: MessagePersonPresentation | null;
}

export interface MessageConversationSummary {
  conversation_id: string;
  security_classification: string;
  status: string;
  mailbox_folder: MessageFolder;
  first_contact_state: string;
  last_activity_at: string;
  other_participant: MessageParticipantIdentity | null;
  latest_message: {
    id: string;
    body: string | null;
    accepted_at: string;
    sender?: MessageParticipantIdentity | null;
    sender_actor_kind?: string | null;
    sender_person_resource_id: string;
    sender_actor_key?: string | null;
  } | null;
  unread_count: number;
}

export interface MessageResourceReference {
  resource_id: string;
  resource_version_id: string | null;
  presentation_kind: "resource" | "version";
}

export interface MessagePlaylistReviewProjection {
  resource_id: string;
  resource_version_id: string;
  playlist_id: string;
  title: string;
  slug: string;
  version_number: number;
  version_kind: string;
  playlist_status: string;
  authority_revision: number;
  current_submitted_version_id: string | null;
  is_current_submitted: boolean;
  can_participate_review: boolean;
  can_manage_review: boolean;
  allowed_review_actions: Array<
    "start_review" | "request_changes" | "approve"
  >;
}

export interface MessageRow {
  id: string;
  message_kind: string;
  body: string | null;
  accepted_at: string;
  client_created_at: string | null;
  sender?: MessageParticipantIdentity | null;
  sender_actor_kind?: string | null;
  sender_person_resource_id: string;
  sender_actor_key?: string | null;
  my_read_at: string | null;
  recipient_read_at: string | null;
  resource_references: MessageResourceReference[];
}

export interface MessageConversationDetail {
  conversation: {
    id: string;
    security_classification: string;
    status: string;
    mailbox_folder: MessageFolder;
    first_contact_state: string;
    created_at: string;
    last_activity_at: string;
  };
  participants: Array<MessageParticipantIdentity & {
    membership_status: string;
  }>;
  messages: MessageRow[];
}

export interface MessagePreference {
  sender_category: MessageSenderCategory;
  first_contact_disposition: FirstContactDisposition;
  allow_links: boolean;
  allow_media: boolean;
  allow_resource_references: boolean;
  show_read_receipts: boolean;
  revision: number;
}

export interface MessageRecipientSuggestion {
  person_resource_id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  sender_category: string;
}

export interface MessagesControlCenterStatus {
  audience_mode: string;
  policy_revision: number;
  active_conversations: number;
  messages: number;
  pending_requests: number;
  spam_conversations: number;
  active_human_participants: number;
  registered_system_actors: number;
  messages_enabled_system_actors: number;
}

export interface MessagesSystemActor {
  actor_key: string;
  label: string;
  actor_kind: "system" | "automation" | string;
  actor_status: "active" | "disabled" | string;
  messaging_enabled: boolean;
  permitted_purposes: string[];
  recipient_scope: string;
  allow_links: boolean;
  allow_resource_references: boolean;
  allow_human_reply: boolean;
  revision: number;
  latest_message_at: string | null;
}

export type MessagesSafetyCaseStatus =
  | "open"
  | "under_review"
  | "resolved";

export type MessagesSafetyDisposition =
  | "pending"
  | "no_action"
  | "quarantine";

export interface MessagesSafetyCaseSummary {
  case_id: string;
  status: MessagesSafetyCaseStatus;
  policy_category: string;
  severity: "low" | "medium" | "high" | "severe" | string;
  current_disposition: MessagesSafetyDisposition;
  source_kind: "user_report" | "staff" | "automated_signal" | string;
  created_at: string;
  updated_at: string;
  message_target_count: number;
  media_target_count: number;
  active_quarantine_count: number;
}

export interface MessagesSafetyTarget {
  target_id: string;
  target_type: "message" | "media_file";
  message_id?: string | null;
  conversation_id?: string | null;
  accepted_at?: string | null;
  sender?: MessageParticipantIdentity | null;
  media_file_object_id?: string | null;
  linked_at: string;
}

export interface MessagesSafetyCaseEvent {
  event_id: string;
  event_kind:
    | "opened"
    | "signal_added"
    | "review_started"
    | "quarantined"
    | "released"
    | "resolved"
    | "evidence_viewed"
    | string;
  actor_kind: "human" | "system" | "automation" | string;
  actor_user_id: string | null;
  actor_person_resource_id: string | null;
  actor_key: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface MessagesQuarantineState {
  quarantine_id: string;
  message_id: string;
  status: "active" | "released" | string;
  policy_category: string;
  placed_at: string;
  released_at: string | null;
  release_note: string | null;
}

export interface MessagesSafetyCaseDetail {
  case: {
    case_id: string;
    status: MessagesSafetyCaseStatus;
    policy_category: string;
    severity: "low" | "medium" | "high" | "severe" | string;
    confidence: number | null;
    current_disposition: MessagesSafetyDisposition;
    source_kind: "user_report" | "staff" | "automated_signal" | string;
    created_by_user_id: string | null;
    created_at: string;
    updated_at: string;
    reviewed_by_user_id: string | null;
    review_started_at: string | null;
    resolved_by_user_id: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
  };
  targets: MessagesSafetyTarget[];
  events: MessagesSafetyCaseEvent[];
  quarantine: MessagesQuarantineState[];
}

export interface MessagesSafetyEvidence {
  safety_case_id: string;
  message_id: string;
  conversation_id: string;
  message_kind: string;
  body: string | null;
  accepted_at: string;
  client_created_at: string | null;
  sender: MessageParticipantIdentity | null;
  sender_actor_kind: string | null;
  sender_person_resource_id: string | null;
  sender_actor_key: string | null;
  evidence_event_id: string;
  idempotent_replay: boolean;
}

export interface MyMessagesAccess {
  audience_mode: string;
  sender_category: string;
  can_start: boolean;
  can_send: boolean;
  has_conversations: boolean;
  visible: boolean;
}

function actionKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw new Error(error.message || `Messages RPC failed: ${name}`);
  return data as T;
}

export function messageDisplayName(
  presentation: MessagePersonPresentation | null | undefined,
): string {
  return String(
    presentation?.display_name
      || presentation?.label
      || presentation?.username
      || "WAKILISHA member",
  );
}

export function messageUsername(
  presentation: MessagePersonPresentation | null | undefined,
): string | null {
  const value = presentation?.username;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export function messageAvatar(
  presentation: MessagePersonPresentation | null | undefined,
): string | null {
  const value = presentation?.avatar_url;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export async function getMyMessagesAccess(): Promise<MyMessagesAccess> {
  const raw = await rpc<Record<string, unknown>>("get_my_message_access");
  return {
    audience_mode: String(raw.audience_mode ?? "unknown"),
    sender_category: String(raw.sender_category ?? "unknown"),
    can_start: raw.can_start === true,
    can_send: raw.can_send === true,
    has_conversations: raw.has_conversations === true,
    visible: raw.visible === true,
  };
}

export async function getMessageUnreadCounts(): Promise<Record<MessageFolder, number>> {
  const raw = await rpc<Record<string, unknown>>("get_my_message_unread_counts");
  return {
    inbox: Number(raw?.inbox ?? 0),
    requests: Number(raw?.requests ?? 0),
    spam: Number(raw?.spam ?? 0),
    archived: Number(raw?.archived ?? 0),
  };
}

export async function listMessageConversations(
  folder: MessageFolder,
): Promise<MessageConversationSummary[]> {
  return rpc<MessageConversationSummary[]>("list_my_message_conversations", {
    p_folder: folder,
    p_before_last_activity_at: null,
    p_before_conversation_id: null,
    p_limit: 100,
  });
}

export async function getMessageConversation(
  conversationId: string,
): Promise<MessageConversationDetail> {
  return rpc<MessageConversationDetail>("get_my_message_conversation", {
    p_conversation_id: conversationId,
    p_before_accepted_at: null,
    p_before_message_id: null,
    p_limit: 100,
  });
}

export async function getMessagePlaylistReviewProjection(
  resourceId: string,
  resourceVersionId: string,
): Promise<MessagePlaylistReviewProjection> {
  return rpc<MessagePlaylistReviewProjection>(
    "get_message_playlist_review_projection_v1",
    {
      p_resource_id: resourceId,
      p_resource_version_id: resourceVersionId,
    },
  );
}

export async function markMessageConversationRead(
  conversationId: string,
): Promise<void> {
  await rpc("mark_my_message_conversation_read", {
    p_conversation_id: conversationId,
    p_through_message_id: null,
  });
}

export async function searchMessageRecipients(
  query: string,
): Promise<MessageRecipientSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return rpc<MessageRecipientSuggestion[]>("search_message_recipients", {
    p_query: trimmed,
    p_limit: 8,
  });
}

export async function startMessageConversation(
  recipientPersonResourceId: string,
  body: string,
  resourceReferences: MessageResourceReference[] = [],
): Promise<{
  conversation_id: string;
  message_id: string;
  mailbox_folder: MessageFolder;
  first_contact_state: string;
}> {
  const rows = await rpc<Array<{
    conversation_id: string;
    message_id: string;
    mailbox_folder: MessageFolder;
    first_contact_state: string;
  }>>("start_message_conversation", {
    p_recipient_person_resource_id: recipientPersonResourceId,
    p_body: body,
    p_resource_references: resourceReferences,
    p_idempotency_key: actionKey("messages.start"),
    p_correlation_id: null,
    p_client_created_at: new Date().toISOString(),
  });
  if (!rows?.[0]) throw new Error("Conversation start returned no result.");
  return rows[0];
}

export async function sendMessage(
  conversationId: string,
  body: string,
  resourceReferences: MessageResourceReference[] = [],
): Promise<void> {
  await rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_resource_references: resourceReferences,
    p_idempotency_key: actionKey("messages.send"),
    p_correlation_id: null,
    p_client_created_at: new Date().toISOString(),
  });
}

export async function acceptMessageRequest(
  conversationId: string,
): Promise<void> {
  await rpc("accept_message_request", {
    p_conversation_id: conversationId,
    p_idempotency_key: actionKey("messages.accept"),
    p_correlation_id: null,
  });
}

export async function declineMessageRequest(
  conversationId: string,
): Promise<void> {
  await rpc("decline_message_request", {
    p_conversation_id: conversationId,
    p_idempotency_key: actionKey("messages.decline"),
    p_correlation_id: null,
  });
}

export async function moveMessageConversation(
  conversationId: string,
  folder: MessageFolder,
): Promise<void> {
  await rpc("move_message_conversation", {
    p_conversation_id: conversationId,
    p_folder: folder,
    p_idempotency_key: actionKey("messages.move"),
    p_correlation_id: null,
  });
}

export async function revokeMessageSenderApproval(
  senderPersonResourceId: string,
): Promise<void> {
  await rpc("revoke_message_sender_approval", {
    p_sender_person_resource_id: senderPersonResourceId,
    p_idempotency_key: actionKey("messages.revoke"),
    p_correlation_id: null,
  });
}

export async function getMessagePreferences(): Promise<MessagePreference[]> {
  return rpc<MessagePreference[]>("get_my_message_preferences");
}

export async function updateMessagePreference(
  preference: MessagePreference,
): Promise<MessagePreference> {
  const result = await rpc<MessagePreference>("update_my_message_sender_policy", {
    p_sender_category: preference.sender_category,
    p_expected_revision: preference.revision,
    p_first_contact_disposition: preference.first_contact_disposition,
    p_allow_links: preference.allow_links,
    p_allow_media: preference.allow_media,
    p_allow_resource_references: preference.allow_resource_references,
    p_show_read_receipts: preference.show_read_receipts,
    p_idempotency_key: actionKey(`messages.preference.${preference.sender_category}`),
    p_correlation_id: null,
  });
  return {
    ...preference,
    ...result,
    revision: Number(result.revision),
  };
}

export async function getMessagesControlCenterStatus(): Promise<MessagesControlCenterStatus> {
  const raw = await rpc<Record<string, unknown>>("get_messages_control_center_status");
  return {
    audience_mode: String(raw.audience_mode ?? "unknown"),
    policy_revision: Number(raw.policy_revision ?? 0),
    active_conversations: Number(raw.active_conversations ?? 0),
    messages: Number(raw.messages ?? 0),
    pending_requests: Number(raw.pending_requests ?? 0),
    spam_conversations: Number(raw.spam_conversations ?? 0),
    active_human_participants: Number(raw.active_human_participants ?? 0),
    registered_system_actors: Number(raw.registered_system_actors ?? 0),
    messages_enabled_system_actors: Number(raw.messages_enabled_system_actors ?? 0),
  };
}

export async function getMessagesSystemActors(): Promise<MessagesSystemActor[]> {
  const rows = await rpc<MessagesSystemActor[]>("get_messages_system_actors");
  return (rows ?? []).map((actor) => ({
    ...actor,
    messaging_enabled: actor.messaging_enabled === true,
    permitted_purposes: Array.isArray(actor.permitted_purposes)
      ? actor.permitted_purposes.map(String)
      : [],
    allow_links: actor.allow_links === true,
    allow_resource_references: actor.allow_resource_references === true,
    allow_human_reply: actor.allow_human_reply === true,
    revision: Number(actor.revision ?? 0),
    latest_message_at: actor.latest_message_at || null,
  }));
}

export async function setMessagesSystemActorEnabled(
  actor: Pick<MessagesSystemActor, "actor_key" | "revision">,
  enabled: boolean,
): Promise<{ actor_key: string; messaging_enabled: boolean; revision: number }> {
  const result = await rpc<Record<string, unknown>>("set_messages_system_actor_enabled", {
    p_actor_key: actor.actor_key,
    p_expected_revision: actor.revision,
    p_enabled: enabled,
    p_idempotency_key: actionKey(`messages.system_actor.${actor.actor_key}`),
    p_correlation_id: null,
  });
  return {
    actor_key: String(result.actor_key ?? actor.actor_key),
    messaging_enabled: result.messaging_enabled === true,
    revision: Number(result.revision ?? actor.revision),
  };
}

export async function reportMessageSafety(
  messageId: string,
  policyCategory: string,
  note: string | null,
): Promise<{
  safety_case_id: string;
  message_id: string;
  status: MessagesSafetyCaseStatus;
  created: boolean;
}> {
  return rpc("report_message_safety_v1", {
    p_message_id: messageId,
    p_policy_category: policyCategory,
    p_note: note,
    p_idempotency_key: actionKey("messages.safety.report"),
    p_correlation_id: null,
  });
}

export async function listMessagesSafetyCases(
  status: MessagesSafetyCaseStatus | null = null,
): Promise<MessagesSafetyCaseSummary[]> {
  return rpc<MessagesSafetyCaseSummary[]>("list_messages_safety_cases_v1", {
    p_status: status,
    p_before_updated_at: null,
    p_before_case_id: null,
    p_limit: 100,
  });
}

export async function getMessagesSafetyCase(
  caseId: string,
): Promise<MessagesSafetyCaseDetail> {
  return rpc<MessagesSafetyCaseDetail>("get_messages_safety_case_v1", {
    p_case_id: caseId,
  });
}

export async function startMessagesSafetyReview(
  caseId: string,
): Promise<void> {
  await rpc("start_messages_safety_review_v1", {
    p_case_id: caseId,
    p_idempotency_key: actionKey("messages.safety.review"),
    p_correlation_id: null,
  });
}

export async function setMessageQuarantine(
  caseId: string,
  messageId: string,
  quarantined: boolean,
  reason: string,
): Promise<void> {
  await rpc("set_message_quarantine_v1", {
    p_case_id: caseId,
    p_message_id: messageId,
    p_quarantined: quarantined,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.safety.quarantine"),
    p_correlation_id: null,
  });
}

export async function resolveMessageSafetyCase(
  caseId: string,
  disposition: Exclude<MessagesSafetyDisposition, "pending">,
  resolutionNote: string,
): Promise<void> {
  await rpc("resolve_message_safety_case_v1", {
    p_case_id: caseId,
    p_disposition: disposition,
    p_resolution_note: resolutionNote,
    p_idempotency_key: actionKey("messages.safety.resolve"),
    p_correlation_id: null,
  });
}

export async function inspectMessageSafetyEvidence(
  caseId: string,
  messageId: string,
  reason: string,
): Promise<MessagesSafetyEvidence> {
  return rpc<MessagesSafetyEvidence>("inspect_message_safety_evidence_v1", {
    p_case_id: caseId,
    p_message_id: messageId,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.safety.evidence"),
    p_correlation_id: null,
  });
}
