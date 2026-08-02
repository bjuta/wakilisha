import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database.types";

type JsonRecord = Record<string, unknown>;
type PublicFunctions = Database["public"]["Functions"];

export type ArticleTrustCommandName =
  | "create_source"
  | "save_source_version"
  | "submit_source_version_for_review"
  | "review_source_version"
  | "withdraw_source"
  | "restore_source"
  | "create_citation"
  | "attach_article_version_citation"
  | "replace_article_version_citations"
  | "create_external_contributor"
  | "update_external_contributor"
  | "create_credit"
  | "set_credit_governance"
  | "attach_article_version_credit"
  | "replace_article_version_credits";

export type ArticleTrustCommandArgs<Name extends ArticleTrustCommandName> =
  PublicFunctions[Name]["Args"];

export type ArticleTrustErrorKind =
  | "concurrency"
  | "permission"
  | "validation"
  | "unknown";

export class ArticleTrustServiceError extends Error {
  readonly kind: ArticleTrustErrorKind;
  readonly code: string | null;

  constructor(
    message: string,
    kind: ArticleTrustErrorKind,
    code: string | null = null,
  ) {
    super(message);
    this.name = "ArticleTrustServiceError";
    this.kind = kind;
    this.code = code;
  }
}

export interface ArticleTrustCitation {
  attachmentId: string;
  resourceId: string;
  articleVersionId: string;
  citationId: string;
  citationPurpose: string;
  targetAnchorType: string;
  targetAnchorData: Json;
  displayOrder: number;
  attachmentPublicSafe: boolean;
  citationState: string;
  citationPublicSafe: boolean;
  locatorType: string;
  locatorData: Json;
  quotation: string | null;
  editorNote: string | null;
  publicLabel: string | null;
  sourceId: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  sourceType: string;
  sourceTitle: string;
  creatorDisplay: string | null;
  publisherDisplay: string | null;
  sourceUrl: string | null;
  archiveIdentifier: string | null;
  publicationDate: string | null;
  captureDate: string | null;
  retrievalDate: string | null;
  languageCode: string | null;
  countryCode: string | null;
  placeText: string | null;
  rightsStatus: string;
  consentStatus: string;
  sensitivity: string;
  reliabilityNote: string | null;
  creditLine: string | null;
  internalNotes: string | null;
  sourceReviewStatus: string;
  sourceExposureClass: string;
  sourceState: string;
  sourceCurrentApprovedVersionId: string | null;
  publiclyEligible: boolean;
}

export interface ArticleTrustCredit {
  attachmentId: string;
  resourceId: string;
  articleVersionId: string;
  creditId: string;
  displayOrder: number;
  isPrimary: boolean;
  attachmentPublicSafe: boolean;
  creditRole: string;
  displayNameSnapshot: string;
  roleLabelSnapshot: string | null;
  registryAuthorSlugSnapshot: string | null;
  userUsernameSnapshot: string | null;
  creditNote: string | null;
  contributorKind: "user" | "registry_author" | "external_contributor";
  userId: string | null;
  registryAuthorId: string | null;
  externalContributorId: string | null;
  governancePublicSafe: boolean;
  creditState: string;
  governanceRevision: number;
  governanceReason: string | null;
  externalContributorState: string | null;
  externalContributorConsentStatus: string | null;
  externalContributorPublicSafe: boolean | null;
  publiclyEligible: boolean;
}

export interface ArticleTrustWorkspace {
  articleVersionId: string;
  resourceId: string;
  citationRevision: number;
  creditRevision: number;
  citations: ArticleTrustCitation[];
  credits: ArticleTrustCredit[];
}

export interface ArticleWorkingVersionIdentity {
  articleId: string;
  resourceId: string;
  workingVersionId: string;
  workingVersionNumber: number;
  workingVersionKind: string;
  sourceDraftVersion: number;
  articleDraftVersion: number;
}

export interface ArticleTrustSourceType {
  sourceType: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface ArticleTrustSourceSummary {
  id: string;
  sourceType: string;
  title: string;
  creatorDisplay: string | null;
  publisherDisplay: string | null;
  sourceUrl: string | null;
  archiveIdentifier: string | null;
  publicationDate: string | null;
  captureDate: string | null;
  retrievalDate: string | null;
  languageCode: string | null;
  countryCode: string | null;
  placeText: string | null;
  rightsStatus: string;
  consentStatus: string;
  sensitivity: string;
  reliabilityNote: string | null;
  creditLine: string | null;
  reviewStatus: string;
  exposureClass: string;
  sourceState: string;
  currentWorkingVersionId: string | null;
  currentSubmittedVersionId: string | null;
  currentApprovedVersionId: string | null;
  workingRevision: number;
  updatedAt: string;
}

export interface ArticleTrustSourceLibrary {
  sourceTypes: ArticleTrustSourceType[];
  sources: ArticleTrustSourceSummary[];
}

export interface ArticleTrustCitationLocatorType {
  locatorType: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface ArticleTrustVocabularyOption {
  value: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface ArticleTrustCitationIntakeOptions {
  locatorTypes: ArticleTrustCitationLocatorType[];
  citationPurposes: ArticleTrustVocabularyOption[];
  targetAnchorTypes: ArticleTrustVocabularyOption[];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function json(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    (value && typeof value === "object")
  ) {
    return value as Json;
  }
  return null;
}

function compareAttachments(
  left: { displayOrder: number; attachmentId: string },
  right: { displayOrder: number; attachmentId: string },
): number {
  return (
    left.displayOrder - right.displayOrder ||
    left.attachmentId.localeCompare(right.attachmentId)
  );
}

function normalizeCitation(value: unknown): ArticleTrustCitation {
  const row = record(value);
  return {
    attachmentId: text(row.attachment_id),
    resourceId: text(row.resource_id),
    articleVersionId: text(row.article_version_id),
    citationId: text(row.citation_id),
    citationPurpose: text(row.citation_purpose),
    targetAnchorType: text(row.target_anchor_type),
    targetAnchorData: json(row.target_anchor_data),
    displayOrder: number(row.display_order),
    attachmentPublicSafe: row.attachment_public_safe === true,
    citationState: text(row.citation_state),
    citationPublicSafe: row.citation_public_safe === true,
    locatorType: text(row.locator_type),
    locatorData: json(row.locator_data),
    quotation: nullableText(row.quotation),
    editorNote: nullableText(row.editor_note),
    publicLabel: nullableText(row.public_label),
    sourceId: text(row.source_id),
    sourceVersionId: text(row.source_version_id),
    sourceVersionNumber: number(row.source_version_number),
    sourceType: text(row.source_type),
    sourceTitle: text(row.source_title),
    creatorDisplay: nullableText(row.creator_display),
    publisherDisplay: nullableText(row.publisher_display),
    sourceUrl: nullableText(row.source_url),
    archiveIdentifier: nullableText(row.archive_identifier),
    publicationDate: nullableText(row.publication_date),
    captureDate: nullableText(row.capture_date),
    retrievalDate: nullableText(row.retrieval_date),
    languageCode: nullableText(row.language_code),
    countryCode: nullableText(row.country_code),
    placeText: nullableText(row.place_text),
    rightsStatus: text(row.rights_status),
    consentStatus: text(row.consent_status),
    sensitivity: text(row.sensitivity),
    reliabilityNote: nullableText(row.reliability_note),
    creditLine: nullableText(row.credit_line),
    internalNotes: nullableText(row.internal_notes),
    sourceReviewStatus: text(row.source_review_status),
    sourceExposureClass: text(row.source_exposure_class),
    sourceState: text(row.source_state),
    sourceCurrentApprovedVersionId: nullableText(
      row.source_current_approved_version_id,
    ),
    publiclyEligible: row.publicly_eligible === true,
  };
}

function normalizeCredit(value: unknown): ArticleTrustCredit {
  const row = record(value);
  const kind = text(row.contributor_kind, "external_contributor");
  return {
    attachmentId: text(row.attachment_id),
    resourceId: text(row.resource_id),
    articleVersionId: text(row.article_version_id),
    creditId: text(row.credit_id),
    displayOrder: number(row.display_order),
    isPrimary: row.is_primary === true,
    attachmentPublicSafe: row.attachment_public_safe === true,
    creditRole: text(row.credit_role),
    displayNameSnapshot: text(row.display_name_snapshot),
    roleLabelSnapshot: nullableText(row.role_label_snapshot),
    registryAuthorSlugSnapshot: nullableText(
      row.registry_author_slug_snapshot,
    ),
    userUsernameSnapshot: nullableText(row.user_username_snapshot),
    creditNote: nullableText(row.credit_note),
    contributorKind:
      kind === "user" || kind === "registry_author"
        ? kind
        : "external_contributor",
    userId: nullableText(row.user_id),
    registryAuthorId: nullableText(row.registry_author_id),
    externalContributorId: nullableText(row.external_contributor_id),
    governancePublicSafe: row.governance_public_safe === true,
    creditState: text(row.credit_state),
    governanceRevision: number(row.governance_revision),
    governanceReason: nullableText(row.governance_reason),
    externalContributorState: nullableText(row.external_contributor_state),
    externalContributorConsentStatus: nullableText(
      row.external_contributor_consent_status,
    ),
    externalContributorPublicSafe:
      typeof row.external_contributor_public_safe === "boolean"
        ? row.external_contributor_public_safe
        : null,
    publiclyEligible: row.publicly_eligible === true,
  };
}

function normalizeSourceType(
  value: unknown,
): ArticleTrustSourceType {
  const row = record(value);

  return {
    sourceType: text(row.source_type),
    label: text(row.label),
    description: text(row.description),
    sortOrder: number(row.sort_order, 100),
  };
}

function normalizeSourceSummary(
  value: unknown,
): ArticleTrustSourceSummary {
  const row = record(value);

  return {
    id: text(row.id),
    sourceType: text(row.source_type),
    title: text(row.title),
    creatorDisplay: nullableText(
      row.creator_display,
    ),
    publisherDisplay: nullableText(
      row.publisher_display,
    ),
    sourceUrl: nullableText(row.source_url),
    archiveIdentifier: nullableText(
      row.archive_identifier,
    ),
    publicationDate: nullableText(
      row.publication_date,
    ),
    captureDate: nullableText(
      row.capture_date,
    ),
    retrievalDate: nullableText(
      row.retrieval_date,
    ),
    languageCode: nullableText(
      row.language_code,
    ),
    countryCode: nullableText(
      row.country_code,
    ),
    placeText: nullableText(
      row.place_text,
    ),
    rightsStatus: text(
      row.rights_status,
      "unknown",
    ),
    consentStatus: text(
      row.consent_status,
      "unknown",
    ),
    sensitivity: text(
      row.sensitivity,
      "none",
    ),
    reliabilityNote: nullableText(
      row.reliability_note,
    ),
    creditLine: nullableText(
      row.credit_line,
    ),
    reviewStatus: text(
      row.review_status,
      "draft",
    ),
    exposureClass: text(
      row.exposure_class,
      "internal",
    ),
    sourceState: text(
      row.source_state,
      "active",
    ),
    currentWorkingVersionId: nullableText(
      row.current_working_version_id,
    ),
    currentSubmittedVersionId: nullableText(
      row.current_submitted_version_id,
    ),
    currentApprovedVersionId: nullableText(
      row.current_approved_version_id,
    ),
    workingRevision: Math.max(
      1,
      number(row.working_revision, 1),
    ),
    updatedAt: text(row.updated_at),
  };
}

export function normalizeArticleTrustSourceLibrary(
  value: unknown,
): ArticleTrustSourceLibrary {
  const row = record(value);

  const sourceTypes =
    Array.isArray(row.source_types)
      ? row.source_types
          .map(normalizeSourceType)
          .filter(
            (item) =>
              item.sourceType &&
              item.label,
          )
          .sort(
            (left, right) =>
              left.sortOrder -
                right.sortOrder ||
              left.sourceType.localeCompare(
                right.sourceType,
              ),
          )
      : [];

  const sources =
    Array.isArray(row.sources)
      ? row.sources
          .map(normalizeSourceSummary)
          .filter((item) => item.id)
      : [];

  return {
    sourceTypes,
    sources,
  };
}

function normalizeCitationLocatorType(
  value: unknown,
): ArticleTrustCitationLocatorType {
  const row = record(value);

  return {
    locatorType: text(row.locator_type),
    label: text(row.label),
    description: text(row.description),
    sortOrder: number(row.sort_order, 100),
  };
}

function normalizeTrustVocabularyOption(
  value: unknown,
): ArticleTrustVocabularyOption {
  const row = record(value);

  return {
    value: text(row.value),
    label: text(row.label),
    description: text(row.description),
    sortOrder: number(row.sort_order, 100),
  };
}

export function normalizeArticleTrustCitationIntakeOptions(
  value: unknown,
): ArticleTrustCitationIntakeOptions {
  const row = record(value);

  const locatorTypes =
    Array.isArray(row.locator_types)
      ? row.locator_types
          .map(normalizeCitationLocatorType)
          .filter(
            (option) =>
              option.locatorType &&
              option.label,
          )
          .sort(
            (left, right) =>
              left.sortOrder -
                right.sortOrder ||
              left.locatorType.localeCompare(
                right.locatorType,
              ),
          )
      : [];

  const normalizeOptions = (
    candidate: unknown,
  ): ArticleTrustVocabularyOption[] =>
    Array.isArray(candidate)
      ? candidate
          .map(normalizeTrustVocabularyOption)
          .filter(
            (option) =>
              option.value &&
              option.label,
          )
          .sort(
            (left, right) =>
              left.sortOrder -
                right.sortOrder ||
              left.value.localeCompare(
                right.value,
              ),
          )
      : [];

  return {
    locatorTypes,
    citationPurposes:
      normalizeOptions(
        row.citation_purposes,
      ),
    targetAnchorTypes:
      normalizeOptions(
        row.target_anchor_types,
      ),
  };
}

export function normalizeArticleWorkingVersionIdentity(
  value: unknown,
): ArticleWorkingVersionIdentity {
  const row = record(value);

  return {
    articleId: text(row.article_id),
    resourceId: text(row.resource_id),
    workingVersionId: text(row.working_version_id),
    workingVersionNumber: number(
      row.working_version_number,
    ),
    workingVersionKind: text(
      row.working_version_kind,
    ),
    sourceDraftVersion: number(
      row.source_draft_version,
    ),
    articleDraftVersion: number(
      row.article_draft_version,
    ),
  };
}

export function normalizeArticleTrustWorkspace(
  value: unknown,
): ArticleTrustWorkspace {
  const row = record(value);
  return {
    articleVersionId: text(row.article_version_id),
    resourceId: text(row.resource_id),
    citationRevision: Math.max(1, number(row.citation_revision, 1)),
    creditRevision: Math.max(1, number(row.credit_revision, 1)),
    citations: Array.isArray(row.citations)
      ? row.citations.map(normalizeCitation).sort(compareAttachments)
      : [],
    credits: Array.isArray(row.credits)
      ? row.credits.map(normalizeCredit).sort(compareAttachments)
      : [],
  };
}

export function classifyArticleTrustError(
  message: string,
  code: string | null = null,
): ArticleTrustErrorKind {
  const normalized = `${code ?? ""} ${message}`.toLowerCase();

  if (
    normalized.includes("stale") ||
    normalized.includes("revision conflict") ||
    (normalized.includes("expected") && normalized.includes("revision")) ||
    normalized.includes("40001")
  ) {
    return "concurrency";
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("not authorized") ||
    normalized.includes("42501")
  ) {
    return "permission";
  }

  if (
    normalized.includes("required") ||
    normalized.includes("invalid") ||
    normalized.includes("must ")
  ) {
    return "validation";
  }

  return "unknown";
}

function throwTrustError(
  context: string,
  error: { message: string; code?: string | null },
): never {
  const code = error.code ?? null;
  throw new ArticleTrustServiceError(
    `${context}: ${error.message}`,
    classifyArticleTrustError(error.message, code),
    code,
  );
}

export async function fetchArticleTrustSourceLibrary(
  limit = 50,
): Promise<ArticleTrustSourceLibrary> {
  const normalizedLimit = Math.trunc(limit);

  if (
    !Number.isFinite(limit) ||
    normalizedLimit < 1 ||
    normalizedLimit > 100
  ) {
    throw new ArticleTrustServiceError(
      "Source Library limit must be between 1 and 100",
      "validation",
    );
  }

  const { data, error } = await supabase.rpc(
    "list_article_trust_sources",
    {
      p_limit: normalizedLimit,
    },
  );

  if (error) {
    throwTrustError(
      "Failed to load Article Source Library",
      error,
    );
  }

  return normalizeArticleTrustSourceLibrary(
    data,
  );
}

export async function fetchArticleTrustCitationIntakeOptions(): Promise<ArticleTrustCitationIntakeOptions> {
  const { data, error } = await supabase.rpc(
    "get_article_trust_citation_intake_options",
  );

  if (error) {
    throwTrustError(
      "Failed to load Article Citation intake options",
      error,
    );
  }

  const options =
    normalizeArticleTrustCitationIntakeOptions(
      data,
    );

  if (
    options.locatorTypes.length === 0 ||
    options.citationPurposes.length === 0 ||
    options.targetAnchorTypes.length === 0
  ) {
    throw new ArticleTrustServiceError(
      "Article Citation intake options are incomplete",
      "unknown",
    );
  }

  return options;
}

export async function fetchArticleWorkingVersionIdentity(
  articleId: string,
): Promise<ArticleWorkingVersionIdentity> {
  const normalizedId = articleId.trim();

  if (!normalizedId) {
    throw new ArticleTrustServiceError(
      "Article id is required",
      "validation",
    );
  }

  const { data, error } = await supabase.rpc(
    "get_article_working_version_identity",
    { p_article_id: normalizedId },
  );

  if (error) {
    throwTrustError(
      "Failed to load Article working version identity",
      error,
    );
  }

  const identity =
    normalizeArticleWorkingVersionIdentity(data);

  if (!identity.workingVersionId) {
    throw new ArticleTrustServiceError(
      "Article working version identity is unavailable",
      "unknown",
    );
  }

  if (
    identity.articleId &&
    identity.articleId !== normalizedId
  ) {
    throw new ArticleTrustServiceError(
      "Article working version identity returned a different Article",
      "unknown",
    );
  }

  return {
    ...identity,
    articleId: identity.articleId || normalizedId,
  };
}

export async function fetchArticleVersionTrustWorkspace(
  articleVersionId: string,
): Promise<ArticleTrustWorkspace> {
  const normalizedId = articleVersionId.trim();
  if (!normalizedId) {
    throw new ArticleTrustServiceError(
      "Article version id is required",
      "validation",
    );
  }

  const { data, error } = await supabase.rpc(
    "get_article_version_trust_workspace",
    { p_article_version_id: normalizedId },
  );

  if (error) {
    throwTrustError("Failed to load Article trust workspace", error);
  }

  const workspace = normalizeArticleTrustWorkspace(data);
  if (
    workspace.articleVersionId &&
    workspace.articleVersionId !== normalizedId
  ) {
    throw new ArticleTrustServiceError(
      "Article trust workspace returned a different Article version",
      "unknown",
    );
  }

  return {
    ...workspace,
    articleVersionId: workspace.articleVersionId || normalizedId,
  };
}

async function callArticleTrustCommand<Name extends ArticleTrustCommandName>(
  name: Name,
  args: ArticleTrustCommandArgs<Name>,
): Promise<Json> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) {
    throwTrustError(`Article trust command ${name} failed`, error);
  }
  return (data ?? null) as Json;
}

export const createSource = (
  args: ArticleTrustCommandArgs<"create_source">,
) => callArticleTrustCommand("create_source", args);

export const saveSourceVersion = (
  args: ArticleTrustCommandArgs<"save_source_version">,
) => callArticleTrustCommand("save_source_version", args);

export const submitSourceVersionForReview = (
  args: ArticleTrustCommandArgs<"submit_source_version_for_review">,
) => callArticleTrustCommand("submit_source_version_for_review", args);

export const reviewSourceVersion = (
  args: ArticleTrustCommandArgs<"review_source_version">,
) => callArticleTrustCommand("review_source_version", args);

export const withdrawSource = (
  args: ArticleTrustCommandArgs<"withdraw_source">,
) => callArticleTrustCommand("withdraw_source", args);

export const restoreSource = (
  args: ArticleTrustCommandArgs<"restore_source">,
) => callArticleTrustCommand("restore_source", args);

export const createCitation = (
  args: ArticleTrustCommandArgs<"create_citation">,
) => callArticleTrustCommand("create_citation", args);

export const attachArticleVersionCitation = (
  args: ArticleTrustCommandArgs<"attach_article_version_citation">,
) => callArticleTrustCommand("attach_article_version_citation", args);

export const replaceArticleVersionCitations = (
  args: ArticleTrustCommandArgs<"replace_article_version_citations">,
) => callArticleTrustCommand("replace_article_version_citations", args);

export const createExternalContributor = (
  args: ArticleTrustCommandArgs<"create_external_contributor">,
) => callArticleTrustCommand("create_external_contributor", args);

export const updateExternalContributor = (
  args: ArticleTrustCommandArgs<"update_external_contributor">,
) => callArticleTrustCommand("update_external_contributor", args);

export const createCredit = (
  args: ArticleTrustCommandArgs<"create_credit">,
) => callArticleTrustCommand("create_credit", args);

export const setCreditGovernance = (
  args: ArticleTrustCommandArgs<"set_credit_governance">,
) => callArticleTrustCommand("set_credit_governance", args);

export const attachArticleVersionCredit = (
  args: ArticleTrustCommandArgs<"attach_article_version_credit">,
) => callArticleTrustCommand("attach_article_version_credit", args);

export const replaceArticleVersionCredits = (
  args: ArticleTrustCommandArgs<"replace_article_version_credits">,
) => callArticleTrustCommand("replace_article_version_credits", args);
