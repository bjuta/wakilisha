/**
 * Unified Media Service — single source of truth for all media operations.
 *
 * Every component that touches media (MediaPickerModal, MediaEditModal,
 * MediaLibrary page, article editor, settings pages) delegates to this service.
 *
 * ── Capabilities ──
 * upload()       → creates canonical Media identity and immutable original revision
 * editImage()    → uploads a new immutable object and activates a replacement revision
 * archiveAsset() → preserves identity, history, storage objects, and references
 * getById()      → fetches full asset with metadata and dimensions
 * getByUrl()     → fetches asset by public URL
 * list()         → paginated, filterable asset list
 * getReferences()→ which entities reference this image?
 * updateMetadata()→ patch title, alt_text, caption, description, status
 * updateStatus() → quick status toggle for bulk operations
 */

import { supabase } from "@/lib/supabase";
import {
  getAdminMediaAssetById,
  getAdminMediaAssetByUrl,
  listAdminMediaAssets,
  type AdminMediaAsset,
} from "@/services/adminMediaReadService";
import {
  hashBlobSha256,
  hashFileSha256,
} from "@/services/mediaHash";

// ─── Types ────────────────────────────────────────────────────

export type MediaFileKind =
  | "image"
  | "document"
  | "audio"
  | "video"
  | "archive"
  | "transcript"
  | "caption"
  | "other";
export type MediaAssetPurpose =
  | "general"
  | "article_hero"
  | "article_inline"
  | "chart_artwork"
  | "artist_photo"
  | "release_artwork"
  | "track_artwork"
  | "downloadable"
  | "press_kit"
  | "brand_asset"
  | "profile_media"
  | "social_card"
  | "system";
export type MediaRightsStatus =
  | "unknown"
  | "owned"
  | "licensed"
  | "public_domain"
  | "fair_use"
  | "needs_clearance"
  | "restricted";

export type MediaConsentStatus =
  | "unknown"
  | "not_required"
  | "requested"
  | "granted"
  | "limited"
  | "declined"
  | "withdrawn";

export type MediaSensitivity =
  | "none"
  | "low"
  | "moderate"
  | "high"
  | "extreme";

export type MediaEmbargoState =
  | "none"
  | "scheduled"
  | "active"
  | "released";

export type MediaSourceProtectionClass =
  | "public"
  | "public_redacted"
  | "internal"
  | "restricted"
  | "confidential";

export type MediaPreservationState =
  | "unassessed"
  | "working_copy"
  | "preservation_candidate"
  | "preserved"
  | "at_risk"
  | "lost";

export type MediaRetentionState =
  | "retain"
  | "review_required"
  | "purge_requested"
  | "purge_approved"
  | "purged";

export type MediaPublicSafetyState =
  | "internal"
  | "review_required"
  | "approved_public"
  | "approved_redacted"
  | "blocked";

export interface MediaGovernanceState {
  assetId: string;
  authorityRevision: number;
  currentRevisionId: string | null;
  currentGovernanceVersionId: string;
  versionNumber: number;
  rightsStatus: MediaRightsStatus;
  rightsBasis: string | null;
  rightsHolder: string | null;
  licenceIdentifier: string | null;
  licenceTerms: string | null;
  consentStatus: MediaConsentStatus;
  consentScope: string | null;
  sensitivity: MediaSensitivity;
  embargoState: MediaEmbargoState;
  embargoUntil: string | null;
  sourceProtectionClass: MediaSourceProtectionClass;
  preservationState: MediaPreservationState;
  retentionState: MediaRetentionState;
  publicSafetyState: MediaPublicSafetyState;
  internalReason: string | null;
  approvedBy: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

export interface MediaGovernanceDraft {
  rightsStatus: MediaRightsStatus;
  rightsBasis?: string | null;
  rightsHolder?: string | null;
  licenceIdentifier?: string | null;
  licenceTerms?: string | null;
  consentStatus: MediaConsentStatus;
  consentScope?: string | null;
  sensitivity: MediaSensitivity;
  embargoState: MediaEmbargoState;
  embargoUntil?: string | null;
  sourceProtectionClass: MediaSourceProtectionClass;
  preservationState: MediaPreservationState;
  retentionState: Extract<MediaRetentionState, "retain" | "review_required">;
  publicSafetyState: MediaPublicSafetyState;
  internalReason?: string | null;
}

export interface MediaFolder {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  path: string;
  purpose: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_system: boolean;
  created_at: string | null;
  updated_at: string | null;
}


export interface MediaAsset {
  id: string;
  slug: string | null;
  title: string | null;
  url: string | null;
  mime_type: string | null;
  media_kind: string | null;
  status: string | null;
  source_kind: string | null;
  source_entity: string | null;
  source_record_id: string | null;
  source_staging_record_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  folder_id?: string | null;
  file_kind?: MediaFileKind | string | null;
  asset_purpose?: string | null;
  display_filename?: string | null;
  original_filename?: string | null;
  file_extension?: string | null;
  file_size_bytes?: number | null;
  content_date?: string | null;
  rights_status?: string | null;
  credit_text?: string | null;
  country_code?: string | null;
  language_code?: string | null;
  tags?: string[] | null;
  internal_notes?: string | null;
  metadata: MediaAssetMetadata | null;
  created_at: string | null;
  updated_at: string | null;
  current_file_object_id?: string | null;
  upload_session_id?: string | null;
  upload_session_state?: string | null;
  processing_job_id?: string | null;
  processing_job_status?: string | null;
  processing_attempt_count?: number | null;
  processing_max_attempts?: number | null;
  processing_last_error?: string | null;
  processing_profile_version?: string | null;
  selected_derivatives?: Record<string, MediaDerivative>;
  primary_delivery_url?: string | null;
  delivery_ready?: boolean;
}

export interface MediaDerivative {
  variant_id: string | null;
  file_object_id: string | null;
  url: string | null;
  mime_type: string | null;
  byte_size: number | null;
  variant_role: string;
  selection_revision: number | null;
  generator_name: string | null;
  generator_version: string | null;
  technical_metadata: Record<string, unknown> | null;
}

export interface MediaAssetMetadata {
  alt_text?: string;
  caption?: string;
  description?: string;
  hex_color?: string;
  animated?: boolean;
  width?: number;
  height?: number;
  file_name?: string;
  file_size?: number;
  [key: string]: unknown;
}

export interface ReferencedEntity {
  table: string;
  column: string;
  entity_id: string;
  label?: string;
}

export interface UploadOptions {
  /** Slug for the media asset. Auto-generated if omitted. */
  slug?: string;
  /** Human-readable title. Defaults to file name. */
  title?: string;
  /** Subfolder path within the media origin. Defaults by file kind. */
  folder?: string;
  /** Logical file kind for filtering. Auto-detected if omitted. */
  fileKind?: MediaFileKind;
  /** Admin/editorial purpose. Defaults to general or downloadable. */
  assetPurpose?: string;
  /** Logical folder ID from media_folders. */
  folderId?: string | null;
  /** Source tracking — what ingested this? */
  sourceKind?: string;
  sourceEntity?: string;
  sourceRecordId?: string;
  /** Initial metadata */
  altText?: string;
  caption?: string;
  description?: string;
}

export type ResumableMasterKind = "audio" | "video";

export type MediaUploadStage =
  | "hashing"
  | "creating_session"
  | "uploading"
  | "paused"
  | "verifying"
  | "processing"
  | "ready"
  | "retry_wait"
  | "failed"
  | "cancelled";

export interface ResumableMasterContext {
  sessionId: string;
  masterKind: ResumableMasterKind;
  capabilityToken: string;
  partUploadBaseUrl: string;
  expectedSha256: string;
  expectedByteSize: number;
  partSizeBytes: number;
  totalParts: number;
  uploadedParts: number;
  uploadedBytes: number;
}

export interface ResumableMasterProgress {
  stage: MediaUploadStage;
  progress: number;
  processedBytes: number;
  totalBytes: number;
  uploadedParts: number;
  totalParts: number;
  message: string;
}

export interface ResumableMasterUploadOptions extends UploadOptions {
  signal?: AbortSignal;
  resumeContext?: ResumableMasterContext | null;
  onSession?: (context: ResumableMasterContext) => void;
  onProgress?: (progress: ResumableMasterProgress) => void;
}

export interface ListOptions {
  search?: string;
  mediaKind?: string;
  fileKind?: string;
  assetPurpose?: string;
  folderId?: string;
  rightsStatus?: string;
  sourceKind?: string;
  status?: string;
  missingAltOnly?: boolean;
  uploadedFrom?: string;
  uploadedTo?: string;
  contentFrom?: string;
  contentTo?: string;
  page?: number;
  pageSize?: number;
  orderBy?: "created_at" | "updated_at" | "title" | "content_date";
  ascending?: boolean;
}

export interface ListResult {
  assets: MediaAsset[];
  total: number;
}

export interface DeleteResult {
  success: boolean;
  references: ReferencedEntity[];
}

const LIGHTSAIL_STORAGE_BUCKET = "lightsail-media";

// ─── Helpers ──────────────────────────────────────────────────

function generateSlug(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `media-${ts}-${rand}`;
}

function getFileExtension(fileName: string): string | null {
  const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function inferFileKind(file: File): MediaFileKind {
  const ext = getFileExtension(file.name);
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || ext === "pdf") return "document";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (ext === "txt") return "transcript";
  if (ext === "vtt" || ext === "srt") return "caption";
  if (ext === "zip") return "archive";
  return "other";
}

function defaultAssetPurpose(fileKind: MediaFileKind): string {
  return fileKind === "document" ? "downloadable" : "general";
}

function isImageFileKind(fileKind: MediaFileKind): boolean {
  return fileKind === "image";
}

async function uploadToLightsailMedia(
  file: File | Blob,
  options: { folder?: string; fileName?: string } = {},
): Promise<{
  url: string;
  storagePath: string;
  storageBucket: string;
  mimeType: string;
  size: number;
  sha256: string;
  variant: Record<string, unknown> | null;
}> {
  const form = new FormData();

  const fileName = options.fileName
    || (file instanceof File ? file.name : "edited-image.png");
  const uploadFile = file instanceof File
    ? file
    : new File(
        [file],
        fileName,
        { type: file.type || "image/png" },
      );

  form.append("file", uploadFile);
  form.append("folder", options.folder || "uploads");

  const { data, error } = await supabase.functions.invoke(
    "media-upload-api",
    { body: form },
  );

  if (error) {
    throw new Error(`Lightsail upload failed: ${error.message}`);
  }

  const payload = data as {
    ok?: boolean;
    url?: string;
    storage_path?: string;
    storage_bucket?: string;
    mime_type?: string;
    size?: number;
    sha256?: string;
    responsive_derivative?: Record<string, unknown> | null;
    error?: string;
  } | null;

  if (
    !payload?.ok
    || !payload.url
    || !payload.storage_path
    || !payload.sha256
    || !/^[0-9a-f]{64}$/.test(payload.sha256)
  ) {
    throw new Error(payload?.error || "Lightsail upload failed.");
  }

  return {
    url: payload.url,
    storagePath: payload.storage_path,
    storageBucket:
      payload.storage_bucket || LIGHTSAIL_STORAGE_BUCKET,
    mimeType:
      payload.mime_type
      || uploadFile.type
      || "application/octet-stream",
    size: payload.size || uploadFile.size,
    sha256: payload.sha256,
    variant: objectValue(payload.responsive_derivative),
  };
}

type MediaWriteRpcError = {
  message: string;
};

type MediaWriteRpcResponse = {
  data: unknown;
  error: MediaWriteRpcError | null;
};

function objectValue(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function invokeMediaRead(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      payload: Record<string, unknown>,
    ) => PromiseLike<MediaWriteRpcResponse>;
  };

  const { data, error } = await client.rpc(
    functionName,
    args,
  );

  if (error) {
    throw new Error(
      `We could not load Media governance: ${error.message}`,
    );
  }

  const result = objectValue(data);
  if (!result) {
    throw new Error(
      "We could not confirm the current Media governance state.",
    );
  }

  return result;
}

async function invokeMediaWrite(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      payload: Record<string, unknown>,
    ) => PromiseLike<MediaWriteRpcResponse>;
  };

  const { data, error } = await client.rpc(
    functionName,
    args,
  );

  if (error) {
    throw new Error(
      `We could not save this file: ${error.message}`,
    );
  }

  const result = objectValue(data);
  if (!result) {
    throw new Error(
      "We could not confirm the file update. Refresh and try again.",
    );
  }

  return result;
}

function requireAuthorityRevision(
  asset: AdminMediaAsset,
): number {
  const revision = asset.authority_revision;

  if (
    typeof revision !== "number"
    || !Number.isInteger(revision)
    || revision < 1
  ) {
    throw new Error(
      "This file is missing its current version. Refresh and try again.",
    );
  }

  return revision;
}

async function requireAdminAsset(
  assetId: string,
): Promise<AdminMediaAsset> {
  const asset = await getAdminMediaAssetById(assetId);
  if (!asset) {
    throw new Error(`File not found: ${assetId}`);
  }
  return asset;
}

function immutableFilePayload(
  uploaded: {
    url: string;
    storagePath: string;
    storageBucket: string;
    mimeType: string;
    size: number;
    sha256: string;
  },
  originalFilename: string,
  technicalMetadata: Record<string, unknown>,
): Record<string, unknown> {
  return {
    storage_provider: "lightsail_media",
    storage_namespace: uploaded.storageBucket,
    storage_path: uploaded.storagePath,
    delivery_url: uploaded.url,
    original_filename: originalFilename,
    mime_type: uploaded.mimeType,
    byte_size: uploaded.size,
    sha256: uploaded.sha256,
    technical_metadata: technicalMetadata,
  };
}

type MediaUploadControlResponse = {
  data: unknown;
  error: MediaWriteRpcError | null;
};

function nullableStringValue(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function numericValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function throwIfUploadAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw new DOMException("Media upload was paused.", "AbortError");
}

async function invokeMediaUploadControl(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(
    "media-upload-api",
    { body },
  ) as MediaUploadControlResponse;
  if (error) {
    throw new Error(`Media upload control failed: ${error.message}`);
  }
  const result = objectValue(data);
  if (!result) {
    throw new Error("Media upload control returned an invalid response.");
  }
  return result;
}

async function invokeMediaTableWrite(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      payload: Record<string, unknown>,
    ) => PromiseLike<MediaWriteRpcResponse>;
  };
  const { data, error } = await client.rpc(functionName, args);
  if (error) {
    throw new Error(`Media workflow command failed: ${error.message}`);
  }
  const value = Array.isArray(data) ? data[0] : data;
  const result = objectValue(value);
  if (!result) {
    throw new Error("Media workflow command returned an invalid response.");
  }
  return result;
}

function requireString(value: unknown, label: string): string {
  const string = nullableStringValue(value)?.trim();
  if (!string) {
    throw new Error(`Media workflow response is missing ${label}.`);
  }
  return string;
}

function masterKindForFile(file: File): ResumableMasterKind {
  const kind = inferFileKind(file);
  if (kind !== "audio" && kind !== "video") {
    throw new Error("Resumable Media masters must be audio or video.");
  }
  return kind;
}

function profileForMasterKind(
  kind: ResumableMasterKind,
): "audio-v1" | "video-v1" {
  return kind === "audio" ? "audio-v1" : "video-v1";
}

function masterIdempotencyKey(
  kind: ResumableMasterKind,
  sha256: string,
  byteSize: number,
): string {
  return ["m3", kind, sha256, byteSize].join(".");
}

function reportUploadProgress(
  options: ResumableMasterUploadOptions,
  progress: ResumableMasterProgress,
) {
  options.onProgress?.(progress);
}

export function getMediaAssetDeliveryUrl(
  asset: MediaAsset | null | undefined,
): string {
  if (!asset) return "";
  const kind = asset.file_kind || asset.media_kind || "";
  if (kind === "audio") {
    return asset.selected_derivatives?.audio_preview?.url
      || asset.primary_delivery_url
      || "";
  }
  if (kind === "video") {
    return asset.selected_derivatives?.video_transcode?.url
      || asset.primary_delivery_url
      || "";
  }
  return asset.primary_delivery_url || asset.url || "";
}

// ─── Service ──────────────────────────────────────────────────

export const mediaService = {
  // ════════════════════════════════════════════════════════════
  // CANONICAL MEDIA GOVERNANCE
  // ════════════════════════════════════════════════════════════

  async getGovernance(
    assetId: string,
  ): Promise<MediaGovernanceState> {
    const result = await invokeMediaRead(
      "get_media_asset_governance_admin",
      { p_asset_id: assetId },
    );

    const requiredNumber = (key: string): number => {
      const value = Number(result[key]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("Media governance returned an invalid version.");
      }
      return value;
    };

    const requiredText = (key: string): string => {
      const value = result[key];
      if (typeof value !== "string" || !value) {
        throw new Error("Media governance returned an incomplete state.");
      }
      return value;
    };

    const nullableText = (key: string): string | null => {
      const value = result[key];
      return typeof value === "string" && value ? value : null;
    };

    return {
      assetId: requiredText("asset_id"),
      authorityRevision: requiredNumber("authority_revision"),
      currentRevisionId: nullableText("current_revision_id"),
      currentGovernanceVersionId: requiredText(
        "current_governance_version_id",
      ),
      versionNumber: requiredNumber("version_number"),
      rightsStatus: requiredText("rights_status") as MediaRightsStatus,
      rightsBasis: nullableText("rights_basis"),
      rightsHolder: nullableText("rights_holder"),
      licenceIdentifier: nullableText("licence_identifier"),
      licenceTerms: nullableText("licence_terms"),
      consentStatus: requiredText("consent_status") as MediaConsentStatus,
      consentScope: nullableText("consent_scope"),
      sensitivity: requiredText("sensitivity") as MediaSensitivity,
      embargoState: requiredText("embargo_state") as MediaEmbargoState,
      embargoUntil: nullableText("embargo_until"),
      sourceProtectionClass: requiredText(
        "source_protection_class",
      ) as MediaSourceProtectionClass,
      preservationState: requiredText(
        "preservation_state",
      ) as MediaPreservationState,
      retentionState: requiredText(
        "retention_state",
      ) as MediaRetentionState,
      publicSafetyState: requiredText(
        "public_safety_state",
      ) as MediaPublicSafetyState,
      internalReason: nullableText("internal_reason"),
      approvedBy: nullableText("approved_by"),
      createdBy: nullableText("created_by"),
      createdAt: nullableText("created_at"),
    };
  },

  async createGovernanceVersion(
    assetId: string,
    expectedAuthorityRevision: number,
    governance: MediaGovernanceDraft,
    reason: string,
  ): Promise<MediaGovernanceState> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("Explain why this Media governance state is changing.");
    }

    await invokeMediaWrite(
      "create_media_governance_version",
      {
        p_asset_id: assetId,
        p_expected_authority_revision: expectedAuthorityRevision,
        p_governance: {
          rights_status: governance.rightsStatus,
          rights_basis: governance.rightsBasis?.trim() || null,
          rights_holder: governance.rightsHolder?.trim() || null,
          licence_identifier: governance.licenceIdentifier?.trim() || null,
          licence_terms: governance.licenceTerms?.trim() || null,
          consent_status: governance.consentStatus,
          consent_scope: governance.consentScope?.trim() || null,
          sensitivity: governance.sensitivity,
          embargo_state: governance.embargoState,
          embargo_until: governance.embargoUntil || null,
          source_protection_class: governance.sourceProtectionClass,
          preservation_state: governance.preservationState,
          retention_state: governance.retentionState,
          public_safety_state: governance.publicSafetyState,
        },
        p_reason: trimmedReason,
        p_correlation_id: crypto.randomUUID(),
      },
    );

    return this.getGovernance(assetId);
  },

  // ════════════════════════════════════════════════════════════
  // RESUMABLE AUDIO / VIDEO MASTER WORKFLOW
  // ════════════════════════════════════════════════════════════

  async uploadResumableMaster(
    file: File,
    options: ResumableMasterUploadOptions = {},
  ): Promise<MediaAsset> {
    const masterKind = masterKindForFile(file);
    if (file.size <= 0) throw new Error("The Media master is empty.");
    if (file.size > 2 * 1024 * 1024 * 1024) {
      throw new Error("Media masters cannot exceed 2 GiB.");
    }

    let context = options.resumeContext ?? null;
    if (
      context
      && (context.masterKind !== masterKind || context.expectedByteSize !== file.size)
    ) {
      throw new Error("The paused upload belongs to a different file.");
    }

    if (!context) {
      reportUploadProgress(options, {
        stage: "hashing",
        progress: 0,
        processedBytes: 0,
        totalBytes: file.size,
        uploadedParts: 0,
        totalParts: 0,
        message: "Calculating master checksum…",
      });

      const expectedSha256 = await hashFileSha256(file, {
        signal: options.signal,
        onProgress: (progress) => reportUploadProgress(options, {
          stage: "hashing",
          progress: progress.progress,
          processedBytes: progress.processedBytes,
          totalBytes: progress.totalBytes,
          uploadedParts: 0,
          totalParts: 0,
          message: "Calculating master checksum…",
        }),
      });

      throwIfUploadAborted(options.signal);
      reportUploadProgress(options, {
        stage: "creating_session",
        progress: 0,
        processedBytes: 0,
        totalBytes: file.size,
        uploadedParts: 0,
        totalParts: 0,
        message: "Creating resumable upload session…",
      });

      const created = await invokeMediaUploadControl({
        action: "create_resumable_session_v2",
        idempotency_key: masterIdempotencyKey(
          masterKind,
          expectedSha256,
          file.size,
        ),
        original_filename: file.name,
        mime_type: file.type,
        expected_byte_size: file.size,
        expected_sha256: expectedSha256,
        ttl_seconds: 86400,
        correlation_id: crypto.randomUUID(),
      });
      const session = objectValue(created.session);
      if (!session) {
        throw new Error("Resumable upload session was not returned.");
      }

      context = {
        sessionId: requireString(session.session_id, "session_id"),
        masterKind,
        capabilityToken: requireString(created.capability_token, "capability_token"),
        partUploadBaseUrl: requireString(created.part_upload_base_url, "part_upload_base_url"),
        expectedSha256,
        expectedByteSize: file.size,
        partSizeBytes: numericValue(session.part_size_bytes),
        totalParts: numericValue(session.total_parts),
        uploadedParts: numericValue(session.uploaded_parts),
        uploadedBytes: numericValue(session.uploaded_bytes),
      };
      if (context.partSizeBytes <= 0 || context.totalParts <= 0) {
        throw new Error("Resumable upload session has an invalid part contract.");
      }
      options.onSession?.(context);
    } else {
      const status = await invokeMediaUploadControl({
        action: "resumable_session_status",
        session_id: context.sessionId,
      });
      const receiver = objectValue(status.receiver);
      context = {
        ...context,
        uploadedParts: numericValue(receiver?.uploaded_parts, context.uploadedParts),
        uploadedBytes: numericValue(receiver?.uploaded_bytes, context.uploadedBytes),
      };
      options.onSession?.(context);
    }

    throwIfUploadAborted(options.signal);

    for (
      let partNumber = context.uploadedParts;
      partNumber < context.totalParts;
      partNumber += 1
    ) {
      throwIfUploadAborted(options.signal);
      const start = partNumber * context.partSizeBytes;
      const end = Math.min(start + context.partSizeBytes, file.size);
      const part = file.slice(start, end);
      const partSha256 = await hashBlobSha256(part, {
        chunkSizeBytes: 1024 * 1024,
        signal: options.signal,
      });
      throwIfUploadAborted(options.signal);

      const response = await fetch(
        `${context.partUploadBaseUrl}/${partNumber}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${context.capabilityToken}`,
            "Content-Type": "application/octet-stream",
            "X-Part-SHA256": partSha256,
          },
          body: part,
          signal: options.signal,
        },
      );
      const payload = objectValue(await response.json().catch(() => null));
      if (!response.ok) {
        throw new Error(
          nullableStringValue(payload?.error)
          || `Upload part ${partNumber + 1} failed.`,
        );
      }

      context = {
        ...context,
        uploadedParts: numericValue(payload?.uploaded_parts, partNumber + 1),
        uploadedBytes: numericValue(payload?.uploaded_bytes, end),
      };
      options.onSession?.(context);
      reportUploadProgress(options, {
        stage: "uploading",
        progress: context.uploadedBytes / context.expectedByteSize,
        processedBytes: context.uploadedBytes,
        totalBytes: context.expectedByteSize,
        uploadedParts: context.uploadedParts,
        totalParts: context.totalParts,
        message: `Uploaded ${context.uploadedParts} of ${context.totalParts} parts`,
      });
    }

    throwIfUploadAborted(options.signal);
    reportUploadProgress(options, {
      stage: "verifying",
      progress: 1,
      processedBytes: context.expectedByteSize,
      totalBytes: context.expectedByteSize,
      uploadedParts: context.totalParts,
      totalParts: context.totalParts,
      message: "Verifying immutable master…",
    });

    const finalized = await invokeMediaUploadControl({
      action: "finalize_resumable_session",
      session_id: context.sessionId,
    });
    const verified = objectValue(finalized.session);
    const fileObjectId = requireString(
      verified?.file_object_id,
      "verified file_object_id",
    );

    const adoption = await invokeMediaWrite(
      "adopt_verified_media_upload_session_v1",
      {
        p_session_id: context.sessionId,
        p_title: options.title
          ?? file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        p_asset_purpose: options.assetPurpose ?? "general",
        p_folder_id: options.folderId ?? null,
        p_correlation_id: crypto.randomUUID(),
      },
    );
    const assetId = requireString(adoption.asset_id, "asset_id");
    const revisionId = requireString(adoption.asset_revision_id, "asset_revision_id");
    if (requireString(adoption.file_object_id, "adopted file_object_id") !== fileObjectId) {
      throw new Error("Adopted Media revision does not reference the verified master.");
    }

    await invokeMediaTableWrite(
      "submit_media_processing_command_v1",
      {
        p_asset_id: assetId,
        p_asset_revision_id: revisionId,
        p_idempotency_key: `m3.process.${context.sessionId}`,
        p_profile_version: profileForMasterKind(masterKind),
        p_correlation_id: crypto.randomUUID(),
      },
    );

    reportUploadProgress(options, {
      stage: "processing",
      progress: 1,
      processedBytes: context.expectedByteSize,
      totalBytes: context.expectedByteSize,
      uploadedParts: context.totalParts,
      totalParts: context.totalParts,
      message: "Master verified. Processing derivatives…",
    });

    return requireAdminAsset(assetId);
  },

  async createPrivateDeliveryUrl(
    fileObjectId: string,
    ttlSeconds = 300,
  ): Promise<string> {
    const payload = await invokeMediaUploadControl({
      action: "create_private_delivery",
      file_object_id: fileObjectId,
      ttl_seconds: ttlSeconds,
    });

    const url = String(payload.url ?? "");
    if (!url.startsWith(
      "https://media.wakilisha.africa/__private/media-file/",
    )) {
      throw new Error(
        "Private file access returned an invalid URL.",
      );
    }

    return url;
  },

  async cancelResumableMaster(
    context: ResumableMasterContext,
  ): Promise<void> {
    await invokeMediaUploadControl({
      action: "cancel_resumable_session",
      session_id: context.sessionId,
      reason: "Cancel Media Library resumable master upload",
    });
  },

  async waitForProcessingReady(
    assetId: string,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
      onUpdate?: (asset: MediaAsset) => void;
    } = {},
  ): Promise<MediaAsset> {
    const timeoutMs = options.timeoutMs ?? 120000;
    const intervalMs = options.intervalMs ?? 1500;
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const asset = await requireAdminAsset(assetId);
      options.onUpdate?.(asset);
      if (
        asset.delivery_ready
        || asset.processing_job_status === "dead_letter"
        || asset.processing_job_status === "cancelled"
      ) return asset;
      if (Date.now() >= deadline) return asset;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  },

  async retryProcessing(assetId: string): Promise<MediaAsset> {
    const asset = await requireAdminAsset(assetId);
    const revisionId = asset.current_revision_id;
    if (!revisionId) {
      throw new Error("This Media asset is missing its current revision.");
    }
    const kind = asset.file_kind || asset.media_kind;
    if (kind !== "audio" && kind !== "video") {
      throw new Error("Only audio and video assets use durable Media processing.");
    }
    await invokeMediaTableWrite(
      "submit_media_processing_command_v1",
      {
        p_asset_id: assetId,
        p_asset_revision_id: revisionId,
        p_idempotency_key: `m3.retry.${assetId}.${crypto.randomUUID()}`,
        p_profile_version: profileForMasterKind(kind),
        p_correlation_id: crypto.randomUUID(),
      },
    );
    return requireAdminAsset(assetId);
  },

  // ════════════════════════════════════════════════════════════
  // UPLOAD
  // ════════════════════════════════════════════════════════════

  /**
   * Upload a new immutable file and create its canonical Media identity,
   * first revision, compatibility projection, and bridge atomically.
   */
  async upload(
    file: File,
    options: UploadOptions = {},
  ): Promise<MediaAsset> {
    const fileKind = options.fileKind ?? inferFileKind(file);
    const assetPurpose =
      options.assetPurpose ?? defaultAssetPurpose(fileKind);
    const folder = options.folder
      ?? (
        fileKind === "document"
          ? "uploads/downloads"
          : "uploads"
      );

    const uploaded = await uploadToLightsailMedia(file, { folder });

    let width = 0;
    let height = 0;
    if (isImageFileKind(fileKind)) {
      try {
        const dimensions = await getImageDimensions(file);
        width = dimensions.width;
        height = dimensions.height;
      } catch {
        // Dimensions remain optional technical metadata.
      }
    }

    const slug = options.slug ?? generateSlug();
    const title = options.title ?? file.name;
    const metadata: MediaAssetMetadata = {
      ...(fileKind === "image"
        ? { alt_text: options.altText ?? file.name }
        : {}),
      caption: options.caption ?? null,
      description: options.description ?? null,
      file_name: file.name,
      file_size: uploaded.size,
      width,
      height,
      file_kind: fileKind,
      asset_purpose: assetPurpose,
    };

    const result = await invokeMediaWrite(
      "create_media_asset_write_v2",
      {
        p_asset: {
          slug,
          title,
          asset_kind: fileKind,
          media_kind: fileKind,
          file_kind: fileKind,
          asset_purpose: assetPurpose,
          status: "active",
          source_kind:
            options.sourceKind ?? "editor_upload",
          source_entity: options.sourceEntity ?? null,
          source_record_id: options.sourceRecordId ?? null,
          storage_bucket: uploaded.storageBucket,
          folder_id: options.folderId ?? null,
          display_filename: title,
          metadata,
        },
        p_file: immutableFilePayload(
          uploaded,
          file.name,
          { width, height },
        ),
        p_variant: uploaded.variant,
        p_reason:
          "Create Media asset from the Media Library upload flow",
        p_correlation_id: crypto.randomUUID(),
      },
    );

    const assetId = String(result.asset_id ?? "");
    if (!assetId) {
      throw new Error("The upload completed, but the file record was not created.");
    }

    return requireAdminAsset(assetId);
  },

  // ════════════════════════════════════════════════════════════
  // EDIT IMAGE
  // ════════════════════════════════════════════════════════════

  /**
   * Upload an edited image to a new immutable path and activate a new
   * revision for the existing logical Media asset.
   */
  async editImage(
    assetId: string,
    blob: Blob,
    newDimensions?: { width: number; height: number },
  ): Promise<MediaAsset> {
    const existing = await requireAdminAsset(assetId);
    const authorityRevision = requireAuthorityRevision(existing);

    const folder = existing.storage_path
      ?.split("/")
      .slice(0, -1)
      .join("/")
      || "uploads";
    const fileName =
      existing.original_filename
      || existing.display_filename
      || "edited-image.png";

    const uploaded = await uploadToLightsailMedia(
      blob,
      { folder, fileName },
    );

    await invokeMediaWrite(
      "replace_media_asset_file_v2",
      {
        p_asset_id: assetId,
        p_expected_authority_revision: authorityRevision,
        p_file: immutableFilePayload(
          uploaded,
          fileName,
          {
            width:
              newDimensions?.width
              ?? existing.metadata?.width
              ?? null,
            height:
              newDimensions?.height
              ?? existing.metadata?.height
              ?? null,
          },
        ),
        p_variant: uploaded.variant,
        p_reason:
          "Replace Media image through the immutable editor flow",
        p_correlation_id: crypto.randomUUID(),
      },
    );

    return requireAdminAsset(assetId);
  },

  // ════════════════════════════════════════════════════════════
  // ARCHIVE
  // ════════════════════════════════════════════════════════════

  /**
   * Archive the logical Media asset while preserving files, revisions,
   * compatibility identity, and entity references.
   */
  async archiveAsset(assetId: string): Promise<DeleteResult> {
    const references = await this.getReferences(assetId);
    const existing = await requireAdminAsset(assetId);

    await invokeMediaWrite(
      "update_media_asset_record_v2",
      {
        p_asset_id: assetId,
        p_expected_authority_revision:
          requireAuthorityRevision(existing),
        p_patch: { status: "archived" },
        p_reason: "Archive Media asset from the Media Library",
        p_correlation_id: crypto.randomUUID(),
      },
    );

    return { success: true, references };
  },

  /**
   * Compatibility alias for callers that have not yet renamed their action.
   * This no longer performs a hard delete.
   */
  async deleteAsset(assetId: string): Promise<DeleteResult> {
    return this.archiveAsset(assetId);
  },

  // ════════════════════════════════════════════════════════════
  // READ
  // ════════════════════════════════════════════════════════════

  async getById(
    assetId: string,
  ): Promise<MediaAsset | null> {
    return getAdminMediaAssetById(assetId);
  },

  async getByUrl(
    url: string,
  ): Promise<MediaAsset | null> {
    return getAdminMediaAssetByUrl(url);
  },

  async listFolders(): Promise<MediaFolder[]> {
    const { data, error } = await supabase
      .from("media_folders")
      .select("id, parent_id, slug, name, path, purpose, description, color, icon, sort_order, is_system, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to list media folders: ${error.message}`);
    }

    return (data ?? []) as MediaFolder[];
  },

  // ════════════════════════════════════════════════════════════
  // LIST
  // ════════════════════════════════════════════════════════════

  async list(
    options: ListOptions = {},
  ): Promise<ListResult> {
    return listAdminMediaAssets(options);
  },

  // ════════════════════════════════════════════════════════════
  // REFERENCES
  // ════════════════════════════════════════════════════════════

  /**
   * Check all 11 FK tables and return every entity that references
   * this media asset. Used before deletion to warn the admin.
   */
  async getReferences(
    assetId: string,
  ): Promise<ReferencedEntity[]> {
    const asset =
      await getAdminMediaAssetById(
        assetId,
        true,
      );

    return asset?.references ?? [];
  },

  // ════════════════════════════════════════════════════════════
  // UPDATE METADATA
  // ════════════════════════════════════════════════════════════

  /**
   * Patch Media metadata, compatibility fields, and lifecycle through
   * canonical write authority with optimistic concurrency.
   */
  async updateMetadata(
    assetId: string,
    updates: {
      title?: string;
      metadata?: Partial<MediaAssetMetadata>;
      status?: string;
      folderId?: string | null;
      fileKind?: MediaFileKind | string | null;
      assetPurpose?: MediaAssetPurpose | string | null;
      displayFilename?: string | null;
      originalFilename?: string | null;
      contentDate?: string | null;
      rightsStatus?: MediaRightsStatus | string;
      creditText?: string | null;
      countryCode?: string | null;
      languageCode?: string | null;
      tags?: string[];
      internalNotes?: string | null;
    },
  ): Promise<MediaAsset> {
    const existing = await requireAdminAsset(assetId);
    const patch: Record<string, unknown> = {};

    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.metadata !== undefined) {
      patch.metadata = updates.metadata;
    }
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.folderId !== undefined) {
      patch.folder_id = updates.folderId || null;
    }
    if (updates.fileKind !== undefined) {
      patch.file_kind = updates.fileKind || null;
    }
    if (updates.assetPurpose !== undefined) {
      patch.asset_purpose = updates.assetPurpose || null;
    }
    if (updates.displayFilename !== undefined) {
      patch.display_filename = updates.displayFilename || null;
    }
    if (updates.originalFilename !== undefined) {
      patch.original_filename = updates.originalFilename || null;
    }
    if (updates.contentDate !== undefined) {
      patch.content_date = updates.contentDate || null;
    }
    if (updates.rightsStatus !== undefined) {
      patch.rights_status = updates.rightsStatus || "unknown";
    }
    if (updates.creditText !== undefined) {
      patch.credit_text = updates.creditText || null;
    }
    if (updates.countryCode !== undefined) {
      patch.country_code = updates.countryCode || null;
    }
    if (updates.languageCode !== undefined) {
      patch.language_code = updates.languageCode || null;
    }
    if (updates.tags !== undefined) patch.tags = updates.tags;
    if (updates.internalNotes !== undefined) {
      patch.internal_notes = updates.internalNotes || null;
    }

    await invokeMediaWrite(
      "update_media_asset_record_v2",
      {
        p_asset_id: assetId,
        p_expected_authority_revision:
          requireAuthorityRevision(existing),
        p_patch: patch,
        p_reason: "Update Media metadata from the Media Library",
        p_correlation_id: crypto.randomUUID(),
      },
    );

    return requireAdminAsset(assetId);
  },

  // ════════════════════════════════════════════════════════════
  // BULK STATUS UPDATE
  // ════════════════════════════════════════════════════════════

  async updateStatusBatch(
    assetIds: string[],
    newStatus: string,
  ): Promise<void> {
    if (!assetIds.length) return;

    await invokeMediaWrite(
      "update_media_asset_status_batch_v2",
      {
        p_asset_ids: [...new Set(assetIds)],
        p_status: newStatus,
        p_reason: "Update Media status from the Media Library",
        p_correlation_id: crypto.randomUUID(),
      },
    );
  },

  // ════════════════════════════════════════════════════════════
  // REGISTER FROM URL
  // ════════════════════════════════════════════════════════════

  /**
   * Fetch an image from a URL and register it as a proper registry_media_assets row.
   * Used by "Register to Library" flow for raw storage files.
   */
  async registerFromUrl(
    imageUrl: string,
    options: UploadOptions = {}
  ): Promise<MediaAsset> {
    // 1. Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error(`URL does not point to an image (got ${blob.type})`);
    }

    // 2. Derive a filename from the URL path
    let fileName = imageUrl.split("/").pop()?.split("?")[0] || "untitled.png";
    // Clean up common generated image-size suffix patterns
    fileName = fileName.replace(/-\d+x\d+(?=\.\w+$)/, ""); // strip -300x200 suffix
    if (!fileName.includes(".")) fileName += ".png";

    // 3. Create a File object from the blob
    const file = new File([blob], fileName, { type: blob.type });

    // 4. Upload via standard upload pipeline
    return this.upload(file, {
      ...options,
      sourceKind: options.sourceKind ?? "admin_upload",
      sourceEntity: options.sourceEntity ?? "storage_register",
    });
  },
};

// ─── Private helpers ──────────────────────────────────────────

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for dimension extraction"));
    };
    img.src = url;
  });
}