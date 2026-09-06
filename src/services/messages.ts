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
  [key: string]: unknown;
}

export interface MessageConversationSummary {
  conversation_id: string;
  security_classification: string;
  status: string;
  mailbox_folder: MessageFolder;
  first_contact_state: string;
  last_activity_at: string;
  other_participant: {
    person_resource_id: string;
    presentation: MessagePersonPresentation | null;
  } | null;
  latest_message: {
    id: string;
    body: string | null;
    accepted_at: string;
    sender_person_resource_id: string;
  } | null;
  unread_count: number;
}

export interface MessageResourceReference {
  resource_id: string;
  resource_version_id: string | null;
  presentation_kind: "resource" | "version";
}

export interface MessageRow {
  id: string;
  message_kind: string;
  body: string | null;
  accepted_at: string;
  client_created_at: string | null;
  sender_person_resource_id: string;
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
  participants: Array<{
    person_resource_id: string;
    presentation: MessagePersonPresentation | null;
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
}

export interface MyMessagesAccess {
  audience_mode: string;
  sender_category: string;
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
    p_resource_references: [],
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
): Promise<void> {
  await rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_resource_references: [],
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
  };
}
