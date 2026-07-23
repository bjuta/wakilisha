import { supabase } from "@/lib/supabase";

export type ArticleDocumentMode =
  | "write"
  | "suggest"
  | "view";

export type ArticleSuggestionOperation =
  | "insert"
  | "replace"
  | "delete";

export type ArticleSuggestionStatus =
  | "open"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "stale";

export type ArticleReviewErrorCode =
  | "unavailable"
  | "stale_update"
  | "permission_denied"
  | "not_found"
  | "invalid_request"
  | "unknown";

export type ArticleReviewResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
      errorCode: ArticleReviewErrorCode;
    };

export interface ArticleReviewTargetVersion {
  id: string;
  versionNumber: number;
  versionKind: string;
  sourceDraftVersion: number;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentFingerprint: string;
  createdBy: string | null;
  createdAt: string;
}

export interface ArticleReviewComment {
  id: string;
  threadId: string;
  bodyText: string;
  createdBy: string | null;
  createdByLabel: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface ArticleSuggestionEvent {
  id: string;
  suggestionId: string;
  action: string;
  actorId: string | null;
  actorLabel: string;
  note: string | null;
  appliedVersionId: string | null;
  createdAt: string;
}

export interface ArticleSuggestion {
  id: string;
  operationKind: ArticleSuggestionOperation;
  originalText: string;
  replacementText: string;
  proposedContentHtml: string;
  targetVersionFingerprint: string;
  status: ArticleSuggestionStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  appliedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleReviewThread {
  id: string;
  resourceId: string;
  articleId: string;
  targetVersionId: string;
  threadKind: "comment" | "suggestion";
  targetField: "title" | "excerpt" | "content_html";
  anchorKind: "document" | "field" | "text_range";
  anchorFrom: number | null;
  anchorTo: number | null;
  anchorQuote: string;
  anchorPrefix: string;
  anchorSuffix: string;
  status: "open" | "resolved";
  createdBy: string | null;
  createdByLabel: string;
  resolvedBy: string | null;
  resolvedByLabel: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  suggestion: ArticleSuggestion | null;
  comments: ArticleReviewComment[];
  events: ArticleSuggestionEvent[];
}

export interface ArticleReviewWorkspace {
  articleId: string;
  resourceId: string;
  currentSubmittedVersionId: string | null;
  canReview: boolean;
  targetVersion: ArticleReviewTargetVersion | null;
  threads: ArticleReviewThread[];
}

export interface CreateArticleSuggestionInput {
  articleId: string;
  targetVersionId: string;
  targetVersionFingerprint: string;
  anchorFrom: number;
  anchorTo: number;
  anchorQuote: string;
  anchorPrefix: string;
  anchorSuffix: string;
  operationKind: ArticleSuggestionOperation;
  originalText: string;
  replacementText: string;
  proposedContentHtml: string;
  comment?: string | null;
}

export interface CreatedArticleSuggestion {
  threadId: string;
  suggestionId: string;
  createdAt: string;
}

export interface CreatedArticleReviewComment {
  commentId: string;
  threadId: string;
  createdAt: string;
}

export interface ArticleSuggestionDecision {
  suggestionId: string;
  status: ArticleSuggestionStatus;
  decidedAt: string;
}

export interface AcceptedArticleSuggestion {
  suggestionId: string;
  status: "accepted" | "stale";
  articleId: string;
  articleSlug: string;
  draftVersion: number;
  appliedVersionId: string | null;
  appliedVersionNumber: number | null;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstRpcRow(value: unknown): UnknownRecord {
  if (Array.isArray(value)) {
    return asRecord(value[0]);
  }

  return asRecord(value);
}

function classifyReviewError(
  message: string,
): ArticleReviewErrorCode {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("could not find the function") ||
    normalized.includes("function") &&
      normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("pgrst202")
  ) {
    return "unavailable";
  }

  if (
    normalized.includes("stale") ||
    normalized.includes("conflict") ||
    normalized.includes("modified by someone else")
  ) {
    return "stale_update";
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("not authenticated") ||
    normalized.includes("unauthorized") ||
    normalized.includes("policy")
  ) {
    return "permission_denied";
  }

  if (
    normalized.includes("not found") ||
    normalized.includes("does not exist")
  ) {
    return "not_found";
  }

  if (
    normalized.includes("required") ||
    normalized.includes("cannot be blank") ||
    normalized.includes("must target") ||
    normalized.includes("require a") ||
    normalized.includes("invalid")
  ) {
    return "invalid_request";
  }

  return "unknown";
}

async function callReviewRpc<T>(
  rpcName: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T,
): Promise<ArticleReviewResult<T>> {
  try {
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          name: string,
          parameters: Record<string, unknown>,
        ) => Promise<{
          data: unknown;
          error: { message?: string } | null;
        }>;
      }
    ).rpc(rpcName, args);

    if (error) {
      const message =
        error.message || "Article review request failed.";

      return {
        ok: false,
        error: message,
        errorCode: classifyReviewError(message),
      };
    }

    try {
      return {
        ok: true,
        data: parse(data),
      };
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : "Article review response was invalid.";

      return {
        ok: false,
        error: message,
        errorCode: "unknown",
      };
    }
  } catch (requestError) {
    const message =
      requestError instanceof Error
        ? requestError.message
        : "Article review request failed.";

    return {
      ok: false,
      error: message,
      errorCode: classifyReviewError(message),
    };
  }
}

function parseTargetVersion(
  value: unknown,
): ArticleReviewTargetVersion | null {
  if (value == null) return null;

  const row = asRecord(value);
  const id = asString(row.id);

  if (!id) return null;

  return {
    id,
    versionNumber: asNumber(row.version_number),
    versionKind: asString(row.version_kind),
    sourceDraftVersion: asNumber(
      row.source_draft_version,
    ),
    title: asString(row.title),
    excerpt: asString(row.excerpt),
    contentHtml: asString(row.content_html),
    contentFingerprint: asString(
      row.content_fingerprint,
    ),
    createdBy: asNullableString(row.created_by),
    createdAt: asString(row.created_at),
  };
}

function parseComment(
  value: unknown,
): ArticleReviewComment {
  const row = asRecord(value);

  return {
    id: asString(row.id),
    threadId: asString(row.thread_id),
    bodyText: asString(row.body_text),
    createdBy: asNullableString(row.created_by),
    createdByLabel:
      asString(row.created_by_label) || "system",
    createdAt: asString(row.created_at),
    editedAt: asNullableString(row.edited_at),
    deletedAt: asNullableString(row.deleted_at),
  };
}

function parseSuggestionEvent(
  value: unknown,
): ArticleSuggestionEvent {
  const row = asRecord(value);

  return {
    id: asString(row.id),
    suggestionId: asString(row.suggestion_id),
    action: asString(row.action),
    actorId: asNullableString(row.actor_id),
    actorLabel:
      asString(row.actor_label) || "system",
    note: asNullableString(row.note),
    appliedVersionId: asNullableString(
      row.applied_version_id,
    ),
    createdAt: asString(row.created_at),
  };
}

function parseSuggestion(
  value: unknown,
): ArticleSuggestion | null {
  if (value == null) return null;

  const row = asRecord(value);
  const id = asString(row.id);

  if (!id) return null;

  return {
    id,
    operationKind:
      asString(
        row.operation_kind,
      ) as ArticleSuggestionOperation,
    originalText: asString(row.original_text),
    replacementText: asString(
      row.replacement_text,
    ),
    proposedContentHtml: asString(
      row.proposed_content_html,
    ),
    targetVersionFingerprint: asString(
      row.target_version_fingerprint,
    ),
    status:
      asString(row.status) as ArticleSuggestionStatus,
    decidedBy: asNullableString(row.decided_by),
    decidedAt: asNullableString(row.decided_at),
    decisionNote: asNullableString(
      row.decision_note,
    ),
    appliedVersionId: asNullableString(
      row.applied_version_id,
    ),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function parseThread(
  value: unknown,
): ArticleReviewThread {
  const row = asRecord(value);

  return {
    id: asString(row.id),
    resourceId: asString(row.resource_id),
    articleId: asString(row.article_id),
    targetVersionId: asString(
      row.target_version_id,
    ),
    threadKind:
      asString(row.thread_kind) as
        | "comment"
        | "suggestion",
    targetField:
      asString(row.target_field) as
        | "title"
        | "excerpt"
        | "content_html",
    anchorKind:
      asString(row.anchor_kind) as
        | "document"
        | "field"
        | "text_range",
    anchorFrom: asNullableNumber(row.anchor_from),
    anchorTo: asNullableNumber(row.anchor_to),
    anchorQuote: asString(row.anchor_quote),
    anchorPrefix: asString(row.anchor_prefix),
    anchorSuffix: asString(row.anchor_suffix),
    status:
      asString(row.status) as "open" | "resolved",
    createdBy: asNullableString(row.created_by),
    createdByLabel:
      asString(row.created_by_label) || "system",
    resolvedBy: asNullableString(row.resolved_by),
    resolvedByLabel: asNullableString(
      row.resolved_by_label,
    ),
    resolvedAt: asNullableString(row.resolved_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    suggestion: parseSuggestion(row.suggestion),
    comments: asArray(row.comments).map(parseComment),
    events: asArray(row.events).map(
      parseSuggestionEvent,
    ),
  };
}

function parseWorkspace(
  value: unknown,
): ArticleReviewWorkspace {
  const row = firstRpcRow(value);

  return {
    articleId: asString(row.article_id),
    resourceId: asString(row.resource_id),
    currentSubmittedVersionId: asNullableString(
      row.current_submitted_version_id,
    ),
    canReview: row.can_review === true,
    targetVersion: parseTargetVersion(
      row.target_version,
    ),
    threads: asArray(row.threads).map(parseThread),
  };
}

function parseCreatedSuggestion(
  value: unknown,
): CreatedArticleSuggestion {
  const row = firstRpcRow(value);

  return {
    threadId: asString(row.created_thread_id),
    suggestionId: asString(
      row.created_suggestion_id,
    ),
    createdAt: asString(row.created_at),
  };
}

function parseCreatedComment(
  value: unknown,
): CreatedArticleReviewComment {
  const row = firstRpcRow(value);

  return {
    commentId: asString(row.created_comment_id),
    threadId: asString(row.thread_id),
    createdAt: asString(row.created_at),
  };
}

function parseDecision(
  value: unknown,
): ArticleSuggestionDecision {
  const row = firstRpcRow(value);

  return {
    suggestionId: asString(row.suggestion_id),
    status:
      asString(
        row.decision_status,
      ) as ArticleSuggestionStatus,
    decidedAt: asString(row.decided_at),
  };
}

function parseAcceptance(
  value: unknown,
): AcceptedArticleSuggestion {
  const row = firstRpcRow(value);
  const status = asString(row.decision_status);

  if (status !== "accepted" && status !== "stale") {
    throw new Error(
      "Article suggestion acceptance returned an invalid status.",
    );
  }

  return {
    suggestionId: asString(row.suggestion_id),
    status,
    articleId: asString(row.article_id),
    articleSlug: asString(row.article_slug),
    draftVersion: asNumber(row.draft_version),
    appliedVersionId: asNullableString(
      row.applied_version_id,
    ),
    appliedVersionNumber: asNullableNumber(
      row.applied_version_number,
    ),
  };
}

export async function fetchArticleReviewWorkspace(
  articleId: string,
): Promise<ArticleReviewResult<ArticleReviewWorkspace>> {
  return callReviewRpc(
    "get_article_review_workspace",
    {
      p_article_id: articleId,
    },
    parseWorkspace,
  );
}

export async function createArticleSuggestion(
  input: CreateArticleSuggestionInput,
): Promise<ArticleReviewResult<CreatedArticleSuggestion>> {
  return callReviewRpc(
    "create_article_suggestion",
    {
      p_article_id: input.articleId,
      p_target_version_id: input.targetVersionId,
      p_target_version_fingerprint:
        input.targetVersionFingerprint,
      p_anchor_from: input.anchorFrom,
      p_anchor_to: input.anchorTo,
      p_anchor_quote: input.anchorQuote,
      p_anchor_prefix: input.anchorPrefix,
      p_anchor_suffix: input.anchorSuffix,
      p_operation_kind: input.operationKind,
      p_original_text: input.originalText,
      p_replacement_text: input.replacementText,
      p_proposed_content_html:
        input.proposedContentHtml,
      p_comment: input.comment ?? null,
    },
    parseCreatedSuggestion,
  );
}

export async function addArticleReviewComment(
  threadId: string,
  bodyText: string,
): Promise<ArticleReviewResult<CreatedArticleReviewComment>> {
  return callReviewRpc(
    "add_article_review_comment",
    {
      p_thread_id: threadId,
      p_body_text: bodyText,
    },
    parseCreatedComment,
  );
}

export async function rejectArticleSuggestion(
  suggestionId: string,
  note: string | null = null,
): Promise<ArticleReviewResult<ArticleSuggestionDecision>> {
  return callReviewRpc(
    "reject_article_suggestion",
    {
      p_suggestion_id: suggestionId,
      p_note: note,
    },
    parseDecision,
  );
}

export async function withdrawArticleSuggestion(
  suggestionId: string,
  note: string | null = null,
): Promise<ArticleReviewResult<ArticleSuggestionDecision>> {
  return callReviewRpc(
    "withdraw_article_suggestion",
    {
      p_suggestion_id: suggestionId,
      p_note: note,
    },
    parseDecision,
  );
}

export async function markArticleSuggestionStale(
  suggestionId: string,
  note: string | null = null,
): Promise<ArticleReviewResult<ArticleSuggestionDecision>> {
  return callReviewRpc(
    "mark_article_suggestion_stale",
    {
      p_suggestion_id: suggestionId,
      p_note: note,
    },
    parseDecision,
  );
}

export async function acceptArticleSuggestion(
  suggestionId: string,
  expectedDraftVersion: number,
  note: string | null = null,
): Promise<ArticleReviewResult<AcceptedArticleSuggestion>> {
  return callReviewRpc(
    "accept_article_suggestion",
    {
      p_suggestion_id: suggestionId,
      p_expected_draft_version: expectedDraftVersion,
      p_note: note,
    },
    parseAcceptance,
  );
}

export function isArticleReviewUnavailable(
  result: ArticleReviewResult<unknown>,
): boolean {
  return !result.ok && result.errorCode === "unavailable";
}
