import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  supabase,
} from "@/lib/supabase";
import type {
  Database,
} from "@/types/database.types";

const publishingSupabase =
  supabase as unknown as SupabaseClient<Database>;

type PublishingWorkspaceRow =
  Database["public"]["Views"]["wk_publishing_workspace_items"]["Row"];

type PublishingContentKindRow =
  Database["public"]["Views"]["wk_publishing_content_kinds"]["Row"];

type PublishingChannelRow =
  Database["public"]["Views"]["wk_publishing_channels"]["Row"];

type PublishingMutationRow =
  Database["public"]["Functions"]["create_publishing_item"]["Returns"][number];

type CreatePublishingItemArgs =
  Database["public"]["Functions"]["create_publishing_item"]["Args"];

type UpdatePublishingItemArgs =
  Database["public"]["Functions"]["update_publishing_item"]["Args"];

type LinkPublishingItemResourceArgs =
  Database["public"]["Functions"]["link_publishing_item_resource"]["Args"];

type AddPublishingItemAssigneeArgs =
  Database["public"]["Functions"]["add_publishing_item_assignee"]["Args"];

type RemovePublishingItemAssigneeArgs =
  Database["public"]["Functions"]["remove_publishing_item_assignee"]["Args"];

type AddPublishingItemChannelArgs =
  Database["public"]["Functions"]["add_publishing_item_channel"]["Args"];

type RemovePublishingItemChannelArgs =
  Database["public"]["Functions"]["remove_publishing_item_channel"]["Args"];

export const PUBLISHING_PRODUCTION_STAGES = [
  "idea",
  "assigned",
  "producing",
  "production_review",
  "revisions",
  "ready",
] as const;

export const PUBLISHING_PLANNING_STATES = [
  "active",
  "paused",
  "dropped",
  "archived",
] as const;

export const PUBLISHING_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const PUBLISHING_EDITORIAL_STATES = [
  "not_linked",
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "published",
] as const;

export const PUBLISHING_PUBLICATION_STATES = [
  "unscheduled",
  "scheduled",
  "paused",
  "published",
  "dropped",
  "archived",
] as const;

export const PUBLISHING_ASSIGNMENT_ROLES = [
  "owner",
  "editor",
  "writer",
  "producer",
  "designer",
  "photographer",
  "video",
  "social",
  "reviewer",
  "other",
] as const;

export type PublishingProductionStage =
  typeof PUBLISHING_PRODUCTION_STAGES[number];

export type PublishingPlanningState =
  typeof PUBLISHING_PLANNING_STATES[number];

export type PublishingPriority =
  typeof PUBLISHING_PRIORITIES[number];

export type PublishingEditorialState =
  typeof PUBLISHING_EDITORIAL_STATES[number];

export type PublishingPublicationState =
  typeof PUBLISHING_PUBLICATION_STATES[number];

export type PublishingAssignmentRole =
  typeof PUBLISHING_ASSIGNMENT_ROLES[number];

export interface PublishingAssignee {
  userId: string;
  label: string;
  role: PublishingAssignmentRole;
  assignedBy: string | null;
  createdAt: string | null;
}

export interface PublishingItemChannel {
  key: string;
  label: string;
  isPrimary: boolean;
  createdAt: string | null;
}

export interface PublishingWorkspaceItem {
  id: string;
  resourceId: string | null;
  resourceKind: string | null;
  title: string;
  contentKind: string;
  contentKindLabel: string;
  brief: string | null;
  productionStage: PublishingProductionStage;
  planningState: PublishingPlanningState;
  editorialState: PublishingEditorialState;
  publicationState: PublishingPublicationState;
  priority: PublishingPriority;
  ownerId: string | null;
  ownerLabel: string | null;
  productionDeadline: string | null;
  plannedPublishAt: string | null;
  recordVersion: number;
  currentWorkingVersionId: string | null;
  currentSubmittedVersionId: string | null;
  currentApprovedVersionId: string | null;
  currentPublishedVersionId: string | null;
  assignees: PublishingAssignee[];
  channels: PublishingItemChannel[];
  createdBy: string | null;
  createdByLabel: string | null;
  updatedBy: string | null;
  updatedByLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishingContentKind {
  key: string;
  label: string;
  description: string;
  canonicalResourceKind: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PublishingChannel {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
}

export interface ListPublishingItemsOptions {
  limit?: number;
  contentKind?: string;
  ownerId?: string;
  productionStage?:
    | PublishingProductionStage
    | "all";
  planningState?:
    | PublishingPlanningState
    | "all";
}

export interface CreatePublishingItemInput {
  title: string;
  contentKind: string;
  resourceId?: string | null;
  ownerId?: string | null;
  brief?: string | null;
  productionStage?: PublishingProductionStage;
  priority?: PublishingPriority;
  productionDeadline?: string | null;
  plannedPublishAt?: string | null;
  note?: string | null;
}

export interface UpdatePublishingItemInput {
  itemId: string;
  expectedRecordVersion: number;
  title: string;
  contentKind: string;
  ownerId: string | null;
  brief: string | null;
  productionStage: PublishingProductionStage;
  planningState: PublishingPlanningState;
  priority: PublishingPriority;
  productionDeadline: string | null;
  plannedPublishAt: string | null;
  note?: string | null;
}

export interface LinkPublishingItemResourceInput {
  itemId: string;
  expectedRecordVersion: number;
  resourceId: string;
  note?: string | null;
}

export interface PublishingAssigneeMutationInput {
  itemId: string;
  expectedRecordVersion: number;
  userId: string;
  assignmentRole: PublishingAssignmentRole;
  note?: string | null;
}

export interface AddPublishingItemChannelInput {
  itemId: string;
  expectedRecordVersion: number;
  channelKey: string;
  isPrimary?: boolean;
  note?: string | null;
}

export interface RemovePublishingItemChannelInput {
  itemId: string;
  expectedRecordVersion: number;
  channelKey: string;
  note?: string | null;
}

export type PublishingMutationErrorCode =
  | "stale_update"
  | "permission_denied"
  | "not_found"
  | "conflict"
  | "validation"
  | "unknown";

export interface PublishingMutationResult {
  ok: boolean;
  itemId?: string;
  recordVersion?: number;
  error?: string;
  errorCode?: PublishingMutationErrorCode;
}

interface PublishingErrorLike {
  code?: string | null;
  message: string;
}

interface PublishingMutationResponse {
  data: PublishingMutationRow[] | null;
  error: PublishingErrorLike | null;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  );
}

function readString(
  value: unknown,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function readBoolean(
  value: unknown,
): boolean {
  return value === true;
}

function normalizeChoice<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (
    value !== null
    && allowed.includes(value as T)
  ) {
    return value as T;
  }

  return fallback;
}

function parseAssignees(
  value: unknown,
): PublishingAssignee[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const userId = readString(entry.userId);
    const role = readString(entry.role);

    if (
      userId === null
      || role === null
      || !PUBLISHING_ASSIGNMENT_ROLES.includes(
        role as PublishingAssignmentRole,
      )
    ) {
      return [];
    }

    return [{
      userId,
      label:
        readString(entry.label)
        ?? userId,
      role: role as PublishingAssignmentRole,
      assignedBy:
        readString(entry.assignedBy),
      createdAt:
        readString(entry.createdAt),
    }];
  });
}

function parseChannels(
  value: unknown,
): PublishingItemChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const key = readString(entry.key);

    if (key === null) {
      return [];
    }

    return [{
      key,
      label:
        readString(entry.label)
        ?? key,
      isPrimary:
        readBoolean(entry.isPrimary),
      createdAt:
        readString(entry.createdAt),
    }];
  });
}

function mapPublishingWorkspaceRow(
  row: PublishingWorkspaceRow,
): PublishingWorkspaceItem {
  return {
    id: row.id,
    resourceId: row.resource_id,
    resourceKind: row.resource_kind,
    title: row.title,
    contentKind: row.content_kind,
    contentKindLabel:
      row.content_kind_label,
    brief: row.brief,
    productionStage: normalizeChoice(
      row.production_stage,
      PUBLISHING_PRODUCTION_STAGES,
      "idea",
    ),
    planningState: normalizeChoice(
      row.planning_state,
      PUBLISHING_PLANNING_STATES,
      "active",
    ),
    editorialState: normalizeChoice(
      row.editorial_state,
      PUBLISHING_EDITORIAL_STATES,
      "not_linked",
    ),
    publicationState: normalizeChoice(
      row.publication_state,
      PUBLISHING_PUBLICATION_STATES,
      "unscheduled",
    ),
    priority: normalizeChoice(
      row.priority,
      PUBLISHING_PRIORITIES,
      "normal",
    ),
    ownerId: row.owner_id,
    ownerLabel: row.owner_label,
    productionDeadline:
      row.production_deadline,
    plannedPublishAt:
      row.planned_publish_at,
    recordVersion:
      row.record_version,
    currentWorkingVersionId:
      row.current_working_version_id,
    currentSubmittedVersionId:
      row.current_submitted_version_id,
    currentApprovedVersionId:
      row.current_approved_version_id,
    currentPublishedVersionId:
      row.current_published_version_id,
    assignees:
      parseAssignees(row.assignees),
    channels:
      parseChannels(row.channels),
    createdBy: row.created_by,
    createdByLabel:
      row.created_by_label,
    updatedBy: row.updated_by,
    updatedByLabel:
      row.updated_by_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContentKind(
  row: PublishingContentKindRow,
): PublishingContentKind {
  return {
    key: row.kind,
    label: row.label,
    description: row.description,
    canonicalResourceKind:
      row.canonical_resource_kind,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  };
}

function mapChannel(
  row: PublishingChannelRow,
): PublishingChannel {
  return {
    key: row.channel_key,
    label: row.label,
    description: row.description,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  };
}

export async function listPublishingWorkspaceItems(
  options: ListPublishingItemsOptions = {},
): Promise<PublishingWorkspaceItem[]> {
  const limit = Math.min(
    Math.max(options.limit ?? 100, 1),
    500,
  );

  let query = publishingSupabase
    .from("wk_publishing_workspace_items")
    .select("*")
    .order("updated_at", {
      ascending: false,
    })
    .limit(limit);

  if (
    options.productionStage
    && options.productionStage !== "all"
  ) {
    query = query.eq(
      "production_stage",
      options.productionStage,
    );
  }

  if (
    options.planningState
    && options.planningState !== "all"
  ) {
    query = query.eq(
      "planning_state",
      options.planningState,
    );
  }

  if (options.contentKind) {
    query = query.eq(
      "content_kind",
      options.contentKind,
    );
  }

  if (options.ownerId) {
    query = query.eq(
      "owner_id",
      options.ownerId,
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw new Error(
      `Failed to load Publishing items: ${error.message}`,
    );
  }

  return (data ?? []).map(
    mapPublishingWorkspaceRow,
  );
}

export async function fetchPublishingWorkspaceItem(
  itemId: string,
): Promise<PublishingWorkspaceItem | null> {
  const {
    data,
    error,
  } = await publishingSupabase
    .from("wk_publishing_workspace_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load the Publishing item: ${error.message}`,
    );
  }

  return data
    ? mapPublishingWorkspaceRow(data)
    : null;
}

export async function listPublishingContentKinds(
): Promise<PublishingContentKind[]> {
  const {
    data,
    error,
  } = await publishingSupabase
    .from("wk_publishing_content_kinds")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Failed to load Publishing content types: ${error.message}`,
    );
  }

  return (data ?? []).map(mapContentKind);
}

export async function listPublishingChannels(
): Promise<PublishingChannel[]> {
  const {
    data,
    error,
  } = await publishingSupabase
    .from("wk_publishing_channels")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Failed to load Publishing channels: ${error.message}`,
    );
  }

  return (data ?? []).map(mapChannel);
}

export function classifyPublishingMutationError(
  error: PublishingErrorLike,
): PublishingMutationErrorCode {
  const code = error.code ?? "";
  const message =
    error.message.toLowerCase();

  if (
    code === "40001"
    || message.includes(
      "stale_publishing_item_version",
    )
  ) {
    return "stale_update";
  }

  if (
    code === "42501"
    || message.includes("permission denied")
    || message.includes(
      "authentication required",
    )
  ) {
    return "permission_denied";
  }

  if (
    code === "P0002"
    || message.includes("not found")
  ) {
    return "not_found";
  }

  if (
    code === "23505"
    || message.includes("already exists")
    || message.includes("already attached")
  ) {
    return "conflict";
  }

  if (
    code === "23503"
    || code === "23514"
    || code === "22P02"
    || message.includes("is required")
    || message.includes("missing or disabled")
    || message.includes("requires resource kind")
    || message.includes("cannot link")
    || message.includes("cannot be unlinked")
    || message.includes("made no changes")
  ) {
    return "validation";
  }

  return "unknown";
}

function mutationErrorMessage(
  errorCode: PublishingMutationErrorCode,
  originalMessage: string,
): string {
  switch (errorCode) {
    case "stale_update":
      return "Someone changed this Publishing item. Reload it, review the latest version, and try again.";
    case "permission_denied":
      return "You do not have permission to change this Publishing item.";
    case "not_found":
      return "We could not find this Publishing item.";
    case "conflict":
      return "This Publishing change conflicts with an existing record.";
    case "validation":
      return `Publishing change failed: ${originalMessage}`;
    default:
      return `Publishing change failed: ${originalMessage}`;
  }
}

function failedMutation(
  error: PublishingErrorLike,
): PublishingMutationResult {
  const errorCode =
    classifyPublishingMutationError(error);

  return {
    ok: false,
    errorCode,
    error: mutationErrorMessage(
      errorCode,
      error.message,
    ),
  };
}

function failedUnknownMutation(
  error: unknown,
): PublishingMutationResult {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown Publishing failure";

  return failedMutation({
    message,
  });
}

function successfulMutation(
  data: PublishingMutationRow[] | null,
): PublishingMutationResult {
  const row = data?.[0];

  if (!row) {
    return {
      ok: false,
      errorCode: "unknown",
      error:
        "Publishing changed the record but returned no result.",
    };
  }

  return {
    ok: true,
    itemId: row.item_id,
    recordVersion: row.record_version,
  };
}

async function executePublishingMutation(
  request: () => PromiseLike<PublishingMutationResponse>,
): Promise<PublishingMutationResult> {
  try {
    const {
      data,
      error,
    } = await request();

    if (error) {
      return failedMutation(error);
    }

    return successfulMutation(data);
  } catch (error) {
    return failedUnknownMutation(error);
  }
}

export async function createPublishingItem(
  input: CreatePublishingItemInput,
): Promise<PublishingMutationResult> {
  const args: CreatePublishingItemArgs = {
    p_title: input.title,
    p_content_kind: input.contentKind,
    p_resource_id:
      input.resourceId ?? null,
    p_owner_id:
      input.ownerId ?? null,
    p_brief:
      input.brief ?? null,
    p_production_stage:
      input.productionStage ?? "idea",
    p_priority:
      input.priority ?? "normal",
    p_production_deadline:
      input.productionDeadline ?? null,
    p_planned_publish_at:
      input.plannedPublishAt ?? null,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "create_publishing_item",
      args,
    ),
  );
}

export async function updatePublishingItem(
  input: UpdatePublishingItemInput,
): Promise<PublishingMutationResult> {
  const args: UpdatePublishingItemArgs = {
    p_item_id: input.itemId,
    p_expected_record_version:
      input.expectedRecordVersion,
    p_title: input.title,
    p_content_kind: input.contentKind,
    p_owner_id: input.ownerId,
    p_brief: input.brief,
    p_production_stage:
      input.productionStage,
    p_planning_state:
      input.planningState,
    p_priority: input.priority,
    p_production_deadline:
      input.productionDeadline,
    p_planned_publish_at:
      input.plannedPublishAt,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "update_publishing_item",
      args,
    ),
  );
}

export async function linkPublishingItemResource(
  input: LinkPublishingItemResourceInput,
): Promise<PublishingMutationResult> {
  const args: LinkPublishingItemResourceArgs = {
    p_item_id: input.itemId,
    p_expected_record_version:
      input.expectedRecordVersion,
    p_resource_id: input.resourceId,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "link_publishing_item_resource",
      args,
    ),
  );
}

export async function addPublishingItemAssignee(
  input: PublishingAssigneeMutationInput,
): Promise<PublishingMutationResult> {
  const args: AddPublishingItemAssigneeArgs = {
    p_item_id: input.itemId,
    p_expected_record_version:
      input.expectedRecordVersion,
    p_user_id: input.userId,
    p_assignment_role:
      input.assignmentRole,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "add_publishing_item_assignee",
      args,
    ),
  );
}

export async function removePublishingItemAssignee(
  input: PublishingAssigneeMutationInput,
): Promise<PublishingMutationResult> {
  const args: RemovePublishingItemAssigneeArgs = {
    p_item_id: input.itemId,
    p_expected_record_version:
      input.expectedRecordVersion,
    p_user_id: input.userId,
    p_assignment_role:
      input.assignmentRole,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "remove_publishing_item_assignee",
      args,
    ),
  );
}

export async function addPublishingItemChannel(
  input: AddPublishingItemChannelInput,
): Promise<PublishingMutationResult> {
  const args: AddPublishingItemChannelArgs = {
    p_item_id: input.itemId,
    p_expected_record_version:
      input.expectedRecordVersion,
    p_channel_key:
      input.channelKey,
    p_is_primary:
      input.isPrimary ?? false,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "add_publishing_item_channel",
      args,
    ),
  );
}

export async function removePublishingItemChannel(
  input: RemovePublishingItemChannelInput,
): Promise<PublishingMutationResult> {
  const args: RemovePublishingItemChannelArgs = {
    p_item_id: input.itemId,
    p_expected_record_version:
      input.expectedRecordVersion,
    p_channel_key:
      input.channelKey,
    p_note:
      input.note ?? null,
  };

  return executePublishingMutation(
    () => publishingSupabase.rpc(
      "remove_publishing_item_channel",
      args,
    ),
  );
}
