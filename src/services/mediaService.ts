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

// ─── Types ────────────────────────────────────────────────────

export type MediaFileKind = "image" | "document" | "audio" | "video" | "archive" | "other";
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

async function invokeMediaWrite(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const rpc = supabase.rpc as unknown as (
    name: string,
    payload: Record<string, unknown>,
  ) => PromiseLike<MediaWriteRpcResponse>;

  const { data, error } = await rpc(functionName, args);

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

// ─── Service ──────────────────────────────────────────────────

export const mediaService = {
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
    // Clean up common WordPress patterns
    fileName = fileName.replace(/-\d+x\d+(?=\.\w+$)/, ""); // strip -300x200 suffix
    if (!fileName.includes(".")) fileName += ".png";

    // 3. Create a File object from the blob
    const file = new File([blob], fileName, { type: blob.type });

    // 4. Upload via standard upload pipeline
    return this.upload(file, {
      ...options,
      sourceKind: options.sourceKind ?? "wordpress_database",
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