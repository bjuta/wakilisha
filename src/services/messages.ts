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
  | "quarantine"
  | "enforced";

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
  active_enforcement_count: number;
  open_appeal_count: number;
  active_media_containment_count: number;
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
    | "assessment_updated"
    | "enforcement_applied"
    | "enforcement_released"
    | "enforcement_superseded"
    | "enforcement_expired"
    | "enforcement_reversed"
    | "appeal_submitted"
    | "appeal_review_started"
    | "appeal_resolved"
    | "media_contained"
    | "media_containment_released"
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
  enforcements: MessagesSafetyEnforcement[];
  appeals: MessagesSafetyAppeal[];
  media_containment: MessagesSafetyMediaContainment[];
}

export type MessagesSafetyEnforcementKind =
  | "warning"
  | "send_cooldown"
  | "send_rate_limit"
  | "links_restricted"
  | "media_restricted"
  | "conversation_start_restricted"
  | "messaging_suspended"
  | "messaging_removed";

export type MessagesSafetyEnforcementStatus =
  | "active"
  | "released"
  | "expired"
  | "reversed"
  | "superseded";

export interface MessagesSafetyEnforcement {
  enforcement_id: string;
  source_message_id: string;
  subject_user_id: string;
  subject_person_resource_id: string;
  enforcement_kind: MessagesSafetyEnforcementKind;
  status: MessagesSafetyEnforcementStatus;
  applied_at: string;
  applied_by_user_id: string;
  effective_until: string | null;
  appeal_allowed: boolean;
  public_reason: string;
  internal_reason: string;
  cooldown_seconds: number | null;
  rate_limit_count: number | null;
  rate_limit_window_seconds: number | null;
  ended_at: string | null;
  ended_by_user_id: string | null;
  end_reason: string | null;
  superseded_by_enforcement_id: string | null;
  revision: number;
}

export interface MessagesSafetyAppeal {
  appeal_id: string;
  enforcement_id: string;
  status: "open" | "under_review" | "resolved" | string;
  appeal_reason: string;
  submitted_at: string;
  review_started_at: string | null;
  reviewed_by_user_id: string | null;
  resolution: "upheld" | "modified" | "reversed" | null;
  resolution_public_note: string | null;
  resolution_internal_note: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  revision: number;
}

export interface MessagesSafetyAppealSummary {
  appeal_id: string;
  enforcement_id: string;
  safety_case_id: string;
  status: "open" | "under_review" | "resolved" | string;
  enforcement_kind: MessagesSafetyEnforcementKind;
  submitted_at: string;
  review_started_at: string | null;
  resolved_at: string | null;
  resolution: "upheld" | "modified" | "reversed" | null;
}

export interface MessagesSafetyMediaContainment {
  containment_id: string;
  media_file_object_id: string;
  status: "active" | "released" | string;
  policy_category: string;
  placed_at: string;
  placed_by_user_id: string;
  released_at: string | null;
  released_by_user_id: string | null;
  release_note: string | null;
}

export interface MyMessageSafetyStateAppeal {
  appeal_id: string;
  status: "open" | "under_review" | "resolved" | string;
  submitted_at: string;
  review_started_at: string | null;
  resolution: "upheld" | "modified" | "reversed" | null;
  resolution_public_note: string | null;
  resolved_at: string | null;
}

export interface MyMessageSafetyStateEnforcement {
  enforcement_id: string;
  enforcement_kind: MessagesSafetyEnforcementKind;
  applied_at: string;
  effective_until: string | null;
  is_effective: boolean;
  appeal_allowed: boolean;
  public_reason: string;
  appeal: MyMessageSafetyStateAppeal | null;
}

export interface MyMessageSafetyState {
  enforcements: MyMessageSafetyStateEnforcement[];
  can_start: boolean;
  can_send: boolean;
  links_allowed: boolean;
  media_allowed: boolean;
  next_send_at: string | null;
  has_safety_state: boolean;
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
  links_allowed: boolean;
  media_allowed: boolean;
  send_limited_until: string | null;
  has_safety_state: boolean;
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
    links_allowed: raw.links_allowed !== false,
    media_allowed: raw.media_allowed !== false,
    send_limited_until: typeof raw.send_limited_until === "string" ? raw.send_limited_until : null,
    has_safety_state: raw.has_safety_state === true,
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


export async function updateMessagesSafetyAssessment(
  caseId: string,
  policyCategory: string,
  severity: string,
  confidence: number | null,
  reason: string,
): Promise<void> {
  await rpc("update_messages_safety_assessment_v1", {
    p_case_id: caseId,
    p_policy_category: policyCategory,
    p_severity: severity,
    p_confidence: confidence,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.safety.assessment.update"),
    p_correlation_id: null,
  });
}

export interface SetMessagesSafetyEnforcementInput {
  caseId: string;
  messageId: string;
  enforcementKind: MessagesSafetyEnforcementKind;
  active: boolean;
  effectiveUntil: string | null;
  appealAllowed: boolean;
  publicReason: string;
  internalReason: string;
  cooldownSeconds: number | null;
  rateLimitCount: number | null;
  rateLimitWindowSeconds: number | null;
}

export async function setMessagesSafetyEnforcement(
  input: SetMessagesSafetyEnforcementInput,
): Promise<void> {
  await rpc("set_messages_safety_enforcement_v1", {
    p_case_id: input.caseId,
    p_message_id: input.messageId,
    p_enforcement_kind: input.enforcementKind,
    p_active: input.active,
    p_effective_until: input.effectiveUntil,
    p_appeal_allowed: input.appealAllowed,
    p_public_reason: input.publicReason,
    p_internal_reason: input.internalReason,
    p_cooldown_seconds: input.cooldownSeconds,
    p_rate_limit_count: input.rateLimitCount,
    p_rate_limit_window_seconds: input.rateLimitWindowSeconds,
    p_idempotency_key: actionKey("messages.safety.enforcement.update"),
    p_correlation_id: null,
  });
}

export async function getMyMessageSafetyState(): Promise<MyMessageSafetyState> {
  return rpc<MyMessageSafetyState>("get_my_message_safety_state_v1");
}

export async function submitMessagesSafetyAppeal(
  enforcementId: string,
  appealReason: string,
): Promise<void> {
  await rpc("submit_messages_safety_appeal_v1", {
    p_enforcement_id: enforcementId,
    p_appeal_reason: appealReason,
    p_idempotency_key: actionKey("messages.safety.appeal.submit"),
    p_correlation_id: null,
  });
}

export async function listMessagesSafetyAppeals(
  status: "open" | "under_review" | "resolved" | null = null,
): Promise<MessagesSafetyAppealSummary[]> {
  return rpc<MessagesSafetyAppealSummary[]>("list_messages_safety_appeals_v1", {
    p_status: status,
    p_before_submitted_at: null,
    p_before_appeal_id: null,
    p_limit: 100,
  });
}

export async function startMessagesSafetyAppealReview(
  appealId: string,
): Promise<void> {
  await rpc("start_messages_safety_appeal_review_v1", {
    p_appeal_id: appealId,
    p_idempotency_key: actionKey("messages.safety.appeal.review.start"),
    p_correlation_id: null,
  });
}

export interface ResolveMessagesSafetyAppealInput {
  appealId: string;
  resolution: "upheld" | "modified" | "reversed";
  resolutionPublicNote: string;
  resolutionInternalNote: string;
  modifiedEnforcementKind: MessagesSafetyEnforcementKind | null;
  modifiedEffectiveUntil: string | null;
  modifiedAppealAllowed: boolean | null;
  modifiedCooldownSeconds: number | null;
  modifiedRateLimitCount: number | null;
  modifiedRateLimitWindowSeconds: number | null;
}

export async function resolveMessagesSafetyAppeal(
  input: ResolveMessagesSafetyAppealInput,
): Promise<void> {
  await rpc("resolve_messages_safety_appeal_v1", {
    p_appeal_id: input.appealId,
    p_resolution: input.resolution,
    p_resolution_public_note: input.resolutionPublicNote,
    p_resolution_internal_note: input.resolutionInternalNote,
    p_modified_enforcement_kind: input.modifiedEnforcementKind,
    p_modified_effective_until: input.modifiedEffectiveUntil,
    p_modified_appeal_allowed: input.modifiedAppealAllowed,
    p_modified_cooldown_seconds: input.modifiedCooldownSeconds,
    p_modified_rate_limit_count: input.modifiedRateLimitCount,
    p_modified_rate_limit_window_seconds: input.modifiedRateLimitWindowSeconds,
    p_idempotency_key: actionKey("messages.safety.appeal.resolve"),
    p_correlation_id: null,
  });
}

export async function setMessagesSafetyMediaContainment(
  caseId: string,
  mediaFileObjectId: string,
  contained: boolean,
  reason: string,
): Promise<void> {
  await rpc("set_messages_safety_media_containment_v1", {
    p_case_id: caseId,
    p_media_file_object_id: mediaFileObjectId,
    p_contained: contained,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.safety.media.containment.update"),
    p_correlation_id: null,
  });
}

export async function submitMessagesSafetyMediaScan(
  caseId: string,
  mediaFileObjectId: string,
): Promise<void> {
  await rpc("submit_messages_safety_media_scan_v1", {
    p_case_id: caseId,
    p_media_file_object_id: mediaFileObjectId,
    p_idempotency_key: actionKey("messages.safety.media.scan"),
    p_correlation_id: null,
  });
}
// -----------------------------------------------------------------------------
// Candidate C: Legal preservation and scoped disclosure.
// Safe case reads remain metadata-only. Private evidence and released package
// delivery are separate, purpose-recorded operations.
// -----------------------------------------------------------------------------

export type MessagesLegalCaseStatus = "open" | "under_review" | "closed";
export type MessagesLegalRequestKind =
  | "preservation"
  | "disclosure"
  | "emergency"
  | "other";
export type MessagesLegalNoticeRestriction = "none" | "restricted" | "unknown";
export type MessagesLegalScopeKind =
  | "exact_message"
  | "conversation_window"
  | "exact_media_file"
  | "exact_resource_version";
export type MessagesLegalClassification =
  | "unclassified"
  | "responsive"
  | "elevated_review"
  | "excluded";
export type MessagesLegalPackageStatus =
  | "draft"
  | "approved"
  | "queued"
  | "generating"
  | "generated"
  | "released"
  | "failed"
  | "voided";

export interface MessagesLegalCaseSummary {
  id: string;
  request_reference: string;
  request_kind: MessagesLegalRequestKind;
  status: MessagesLegalCaseStatus;
  requesting_authority: string;
  jurisdiction_or_process: string;
  received_at: string;
  scope_statement: string;
  notice_restriction_state: MessagesLegalNoticeRestriction;
  assigned_user_id: string | null;
  opened_at: string;
  closed_at: string | null;
  revision: number;
  held_object_count: number;
  package_count: number;
}

export interface MessagesLegalCaseRecord {
  id: string;
  request_reference: string;
  request_kind: MessagesLegalRequestKind;
  status: MessagesLegalCaseStatus;
  requesting_authority: string;
  jurisdiction_or_process: string;
  received_at: string;
  scope_statement: string;
  notice_restriction_state: MessagesLegalNoticeRestriction;
  assigned_user_id: string | null;
  opened_by_user_id: string | null;
  opened_at: string;
  closed_by_user_id: string | null;
  closed_at: string | null;
  closure_note: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface MessagesLegalScope {
  id: string;
  legal_request_case_id: string;
  scope_kind: MessagesLegalScopeKind;
  status: "active" | "released" | string;
  message_id: string | null;
  conversation_id: string | null;
  accepted_from: string | null;
  accepted_until: string | null;
  media_file_object_id: string | null;
  resource_version_id: string | null;
  scope_note: string | null;
  created_by_user_id: string | null;
  created_at: string;
  released_by_user_id: string | null;
  released_at: string | null;
  release_reason: string | null;
  revision: number;
}

export interface MessagesLegalPreservedObject {
  id: string;
  object_kind: "message" | "media_file" | "resource_version" | string;
  message_id: string | null;
  media_file_object_id: string | null;
  resource_version_id: string | null;
  preservation_status: "held" | "released" | string;
  response_classification: MessagesLegalClassification;
  classification_reason: string | null;
  preserved_at: string;
  classified_at: string | null;
  released_at: string | null;
  revision: number;
}

export interface MessagesLegalPackageSummary {
  id: string;
  production_reference: string;
  status: MessagesLegalPackageStatus;
  scope_statement: string;
  documented_omissions: string[];
  selection_fingerprint: string;
  requested_at: string;
  generated_at: string | null;
  manifest_sha256: string | null;
  package_file_object_id: string | null;
  package_sha256: string | null;
  package_byte_size: number | null;
  released_at: string | null;
  failure_summary: string | null;
  revision: number;
}

export interface MessagesLegalCaseEvent {
  id: string;
  legal_disclosure_package_id: string | null;
  legal_preserved_object_id: string | null;
  event_kind: string;
  actor_kind: string;
  actor_user_id: string | null;
  actor_key: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface MessagesLegalCaseDetail {
  case: MessagesLegalCaseRecord;
  scopes: MessagesLegalScope[];
  preserved_objects: MessagesLegalPreservedObject[];
  packages: MessagesLegalPackageSummary[];
  events: MessagesLegalCaseEvent[];
}

export interface MessagesLegalDisclosureObject {
  id: string;
  legal_disclosure_package_id: string;
  legal_preserved_object_id: string;
  manifest_order: number;
  object_kind: "message" | "media_file" | "resource_version" | string;
  response_classification: MessagesLegalClassification;
  source_object_id: string;
  source_fingerprint: string | null;
  output_path: string | null;
  output_mime_type: string | null;
  object_sha256: string | null;
  object_byte_size: number | null;
  finalized_at: string | null;
}

export interface MessagesLegalDisclosureApproval {
  id: string;
  legal_disclosure_package_id: string;
  legal_preserved_object_id: string | null;
  approval_scope: "package" | "elevated_object" | string;
  status: "active" | "revoked" | string;
  selection_fingerprint: string;
  approval_reason: string;
  approved_by_user_id: string | null;
  approved_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  revision: number;
}

export interface MessagesLegalDisclosurePackageDetail {
  package: MessagesLegalPackageSummary & {
    legal_request_case_id?: string;
    manifest_text?: string | null;
    archive_version?: string;
    manifest_version?: string;
  };
  objects: MessagesLegalDisclosureObject[];
  approvals: MessagesLegalDisclosureApproval[];
}

export interface MessagesLegalEvidenceResult {
  legal_request_case_id: string;
  legal_preserved_object_id: string;
  evidence: Record<string, unknown>;
  command_receipt_id: string;
  correlation_id: string;
}

export interface MessagesLegalDeliveryTarget {
  ok: boolean;
  legal_disclosure_package_id: string;
  file_object_id: string;
  url: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface OpenMessagesLegalCaseInput {
  requestReference: string;
  requestKind: MessagesLegalRequestKind;
  requestingAuthority: string;
  jurisdictionOrProcess: string;
  receivedAt: string;
  scopeStatement: string;
  noticeRestrictionState: MessagesLegalNoticeRestriction;
  assignedUserId?: string | null;
}

export interface UpdateMessagesLegalScopeInput {
  caseId: string;
  action: "add" | "release";
  scopeId?: string | null;
  scopeKind?: MessagesLegalScopeKind | null;
  messageId?: string | null;
  conversationId?: string | null;
  acceptedFrom?: string | null;
  acceptedUntil?: string | null;
  mediaFileObjectId?: string | null;
  resourceVersionId?: string | null;
  scopeNote?: string | null;
  expectedRevision: number;
  reason: string;
}

export async function listMessagesLegalCases(
  status: MessagesLegalCaseStatus | null = null,
): Promise<MessagesLegalCaseSummary[]> {
  return rpc<MessagesLegalCaseSummary[]>("list_messages_legal_cases_v1", {
    p_status: status,
    p_limit: 100,
  });
}

export async function getMessagesLegalCase(
  caseId: string,
): Promise<MessagesLegalCaseDetail> {
  return rpc<MessagesLegalCaseDetail>("get_messages_legal_case_v1", {
    p_case_id: caseId,
  });
}

export async function listMessagesLegalPreservedObjects(
  caseId: string,
  preservationStatus: "held" | "released" | null = null,
  responseClassification: MessagesLegalClassification | null = null,
  limit = 200,
): Promise<MessagesLegalPreservedObject[]> {
  return rpc<MessagesLegalPreservedObject[]>(
    "list_messages_legal_preserved_objects_v1",
    {
      p_case_id: caseId,
      p_preservation_status: preservationStatus,
      p_response_classification: responseClassification,
      p_limit: limit,
    },
  );
}

export async function getMessagesLegalDisclosurePackage(
  packageId: string,
): Promise<MessagesLegalDisclosurePackageDetail> {
  return rpc<MessagesLegalDisclosurePackageDetail>(
    "get_messages_legal_disclosure_package_v1",
    { p_package_id: packageId },
  );
}

export async function openMessagesLegalRequestCase(
  input: OpenMessagesLegalCaseInput,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("open_messages_legal_request_case_v1", {
    p_request_reference: input.requestReference,
    p_request_kind: input.requestKind,
    p_requesting_authority: input.requestingAuthority,
    p_jurisdiction_or_process: input.jurisdictionOrProcess,
    p_received_at: input.receivedAt,
    p_scope_statement: input.scopeStatement,
    p_notice_restriction_state: input.noticeRestrictionState,
    p_assigned_user_id: input.assignedUserId || null,
    p_idempotency_key: actionKey("messages.legal.case.open"),
    p_correlation_id: null,
  });
}

export async function startMessagesLegalReview(
  caseId: string,
  expectedRevision: number,
  reason: string,
  assignedUserId: string | null = null,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("start_messages_legal_review_v1", {
    p_case_id: caseId,
    p_expected_revision: expectedRevision,
    p_assigned_user_id: assignedUserId,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.legal.review.start"),
    p_correlation_id: null,
  });
}

export async function updateMessagesLegalScope(
  input: UpdateMessagesLegalScopeInput,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("update_messages_legal_scope_v1", {
    p_case_id: input.caseId,
    p_action: input.action,
    p_scope_id: input.scopeId || null,
    p_scope_kind: input.scopeKind || null,
    p_message_id: input.messageId || null,
    p_conversation_id: input.conversationId || null,
    p_accepted_from: input.acceptedFrom || null,
    p_accepted_until: input.acceptedUntil || null,
    p_media_file_object_id: input.mediaFileObjectId || null,
    p_resource_version_id: input.resourceVersionId || null,
    p_scope_note: input.scopeNote || null,
    p_expected_revision: input.expectedRevision,
    p_reason: input.reason,
    p_idempotency_key: actionKey("messages.legal.scope.update"),
    p_correlation_id: null,
  });
}

export async function materializeMessagesLegalPreservation(
  caseId: string,
  scopeId: string,
  expectedCaseRevision: number,
  reason: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>(
    "materialize_messages_legal_preservation_v1",
    {
      p_case_id: caseId,
      p_scope_id: scopeId,
      p_expected_case_revision: expectedCaseRevision,
      p_reason: reason,
      p_idempotency_key: actionKey("messages.legal.preservation.materialize"),
      p_correlation_id: null,
    },
  );
}

export async function releaseMessagesLegalPreservation(
  caseId: string,
  preservedObjectId: string,
  expectedRevision: number,
  reason: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>(
    "release_messages_legal_preservation_v1",
    {
      p_case_id: caseId,
      p_preserved_object_id: preservedObjectId,
      p_expected_revision: expectedRevision,
      p_reason: reason,
      p_idempotency_key: actionKey("messages.legal.preservation.release"),
      p_correlation_id: null,
    },
  );
}

export async function classifyMessagesLegalObject(
  caseId: string,
  preservedObjectId: string,
  expectedRevision: number,
  classification: Exclude<MessagesLegalClassification, "unclassified">,
  reason: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("classify_messages_legal_object_v1", {
    p_case_id: caseId,
    p_preserved_object_id: preservedObjectId,
    p_expected_revision: expectedRevision,
    p_classification: classification,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.legal.classification.update"),
    p_correlation_id: null,
  });
}

export async function inspectMessagesLegalEvidence(
  caseId: string,
  preservedObjectId: string,
  purpose: string,
): Promise<MessagesLegalEvidenceResult> {
  return rpc<MessagesLegalEvidenceResult>("inspect_message_legal_evidence_v1", {
    p_case_id: caseId,
    p_preserved_object_id: preservedObjectId,
    p_purpose: purpose,
    p_idempotency_key: actionKey("messages.legal.evidence.inspect"),
    p_correlation_id: null,
  });
}

export async function prepareMessagesLegalDisclosure(
  caseId: string,
  productionReference: string,
  scopeStatement: string,
  documentedOmissions: string[],
  preservedObjectIds: string[],
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("prepare_messages_legal_disclosure_v1", {
    p_case_id: caseId,
    p_production_reference: productionReference,
    p_scope_statement: scopeStatement,
    p_documented_omissions: documentedOmissions,
    p_preserved_object_ids: preservedObjectIds,
    p_idempotency_key: actionKey("messages.legal.disclosure.prepare"),
    p_correlation_id: null,
  });
}

export async function updateMessagesLegalDisclosureApproval(
  packageId: string,
  action:
    | "record_package"
    | "record_elevated"
    | "revoke_package"
    | "revoke_elevated",
  preservedObjectId: string | null,
  expectedPackageRevision: number,
  selectionFingerprint: string,
  reason: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>(
    "update_messages_legal_disclosure_approval_v1",
    {
      p_package_id: packageId,
      p_action: action,
      p_preserved_object_id: preservedObjectId,
      p_expected_package_revision: expectedPackageRevision,
      p_selection_fingerprint: selectionFingerprint,
      p_reason: reason,
      p_idempotency_key: actionKey("messages.legal.disclosure.approval.update"),
      p_correlation_id: null,
    },
  );
}

export async function submitMessagesLegalDisclosureGeneration(
  packageId: string,
  expectedPackageRevision: number,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>(
    "submit_messages_legal_disclosure_generation_v1",
    {
      p_package_id: packageId,
      p_expected_package_revision: expectedPackageRevision,
      p_idempotency_key: actionKey("messages.legal.disclosure.generate"),
      p_correlation_id: null,
    },
  );
}

export async function releaseMessagesLegalDisclosure(
  packageId: string,
  expectedRevision: number,
  reason: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("release_messages_legal_disclosure_v1", {
    p_package_id: packageId,
    p_expected_revision: expectedRevision,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.legal.disclosure.release"),
    p_correlation_id: null,
  });
}

export async function voidMessagesLegalDisclosure(
  packageId: string,
  expectedRevision: number,
  reason: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("void_messages_legal_disclosure_v1", {
    p_package_id: packageId,
    p_expected_revision: expectedRevision,
    p_reason: reason,
    p_idempotency_key: actionKey("messages.legal.disclosure.void"),
    p_correlation_id: null,
  });
}

export async function closeMessagesLegalRequestCase(
  caseId: string,
  expectedRevision: number,
  closureNote: string,
): Promise<Record<string, unknown>> {
  return rpc<Record<string, unknown>>("close_messages_legal_request_case_v1", {
    p_case_id: caseId,
    p_expected_revision: expectedRevision,
    p_closure_note: closureNote,
    p_idempotency_key: actionKey("messages.legal.case.close"),
    p_correlation_id: null,
  });
}

export async function createMessagesLegalDisclosureDelivery(
  packageId: string,
  purpose: string,
  ttlSeconds = 300,
): Promise<MessagesLegalDeliveryTarget> {
  const { data, error } = await supabase.functions.invoke("media-upload-api", {
    body: {
      action: "create_legal_disclosure_delivery",
      package_id: packageId,
      purpose,
      ttl_seconds: ttlSeconds,
      idempotency_key: actionKey("messages.legal.evidence.inspect.delivery"),
      correlation_id: null,
    },
  });
  if (error) {
    throw new Error(
      error.message || "Released Legal disclosure delivery could not be created.",
    );
  }
  const target = data as Partial<MessagesLegalDeliveryTarget> | null;
  if (
    !target?.ok
    || typeof target.url !== "string"
    || typeof target.file_object_id !== "string"
    || typeof target.expires_at !== "string"
  ) {
    throw new Error("Released Legal disclosure delivery response is invalid.");
  }
  return target as MessagesLegalDeliveryTarget;
}
