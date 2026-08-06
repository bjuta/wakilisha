/**
 * Unified Media Service — single source of truth for all media operations.
 *
 * Every component that touches media (MediaPickerModal, MediaEditModal,
 * MediaLibrary page, article editor, settings pages) delegates to this service.
 *
 * ── Capabilities ──
 * upload()       → creates registry_media_assets row + uploads to Lightsail media origin
 * editImage()    → re-uploads edited Blob to same Lightsail path, updates registry_media_assets row
 * deleteAsset()  → checks all 11 FK references, returns affected entities, then deletes
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

const LEGACY_STORAGE_BUCKET = "article-media";
const LIGHTSAIL_STORAGE_BUCKET = "lightsail-media";
const MEDIA_ASSET_SELECT = "id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, folder_id, file_kind, asset_purpose, display_filename, original_filename, file_extension, file_size_bytes, content_date, rights_status, credit_text, country_code, language_code, tags, internal_notes, metadata, created_at, updated_at";

// ─── Helpers ──────────────────────────────────────────────────

function generateSlug(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `media-${ts}-${rand}`;
}

function buildStoragePath(folder: string, fileName: string): string {
  const clean = folder.replace(/^\/+|\/+$/g, "");
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  const ts = Date.now();
  const ext = safe.split(".").pop() ?? "bin";
  const base = safe.replace(/\.[^.]+$/, "").slice(0, 40);
  return clean ? `${clean}/${ts}-${base}.${ext}` : `${ts}-${base}.${ext}`;
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

function parseStoragePathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    const legacyPrefix = `/storage/v1/object/public/${LEGACY_STORAGE_BUCKET}/`;
    const legacyIdx = parsed.pathname.indexOf(legacyPrefix);
    if (legacyIdx !== -1) return parsed.pathname.slice(legacyIdx + legacyPrefix.length);

    if (parsed.hostname === "media.wakilisha.africa") {
      const cleanPath = parsed.pathname.replace(/^\/+/, "");
      if (cleanPath.startsWith("uploads/")) return cleanPath;
    }

    return null;
  } catch {
    return null;
  }
}

async function uploadToLightsailMedia(
  file: File | Blob,
  options: { folder?: string; storagePath?: string; fileName?: string } = {},
): Promise<{ url: string; storagePath: string; storageBucket: string; mimeType: string; size: number }> {
  const form = new FormData();

  const fileName = options.fileName || (file instanceof File ? file.name : "edited-image.png");
  const uploadFile = file instanceof File ? file : new File([file], fileName, { type: file.type || "image/png" });

  form.append("file", uploadFile);
  form.append("folder", options.folder || "uploads");
  if (options.storagePath) form.append("storage_path", options.storagePath);

  const { data, error } = await supabase.functions.invoke("media-upload-api", {
    body: form,
  });

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
    error?: string;
  } | null;

  if (!payload?.ok || !payload.url || !payload.storage_path) {
    throw new Error(payload?.error || "Lightsail upload failed.");
  }

  return {
    url: payload.url,
    storagePath: payload.storage_path,
    storageBucket: payload.storage_bucket || LIGHTSAIL_STORAGE_BUCKET,
    mimeType: payload.mime_type || uploadFile.type || "application/octet-stream",
    size: payload.size || uploadFile.size,
  };
}

// ─── Service ──────────────────────────────────────────────────

export const mediaService = {
  // ════════════════════════════════════════════════════════════
  // UPLOAD
  // ════════════════════════════════════════════════════════════

  /**
   * Upload a file to Lightsail media origin and create a registry_media_assets row.
   * Returns the complete MediaAsset with its generated ID.
   */
  async upload(file: File, options: UploadOptions = {}): Promise<MediaAsset> {
    const fileKind = options.fileKind ?? inferFileKind(file);
    const assetPurpose = options.assetPurpose ?? defaultAssetPurpose(fileKind);
    const folder = options.folder ?? (fileKind === "document" ? "uploads/downloads" : "uploads");

    // 1. Upload to Lightsail media origin
    const uploaded = await uploadToLightsailMedia(file, { folder });
    const publicUrl = uploaded.url;

    // 2. Get image dimensions when the file is an image
    let width = 0;
    let height = 0;
    if (isImageFileKind(fileKind)) {
      try {
        const dims = await getImageDimensions(file);
        width = dims.width;
        height = dims.height;
      } catch {
        // Non-blocking — dimensions are best-effort
      }
    }

    // 3. Insert into registry_media_assets
    const slug = options.slug ?? generateSlug();
    const fileExtension = getFileExtension(file.name);
    const metadata: MediaAssetMetadata = {
      ...(fileKind === "image" ? { alt_text: options.altText ?? file.name } : {}),
      caption: options.caption ?? null,
      description: options.description ?? null,
      file_name: file.name,
      file_size: uploaded.size || file.size,
      width,
      height,
      file_kind: fileKind,
      asset_purpose: assetPurpose,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("registry_media_assets")
      .insert({
        slug,
        title: options.title ?? file.name,
        url: publicUrl,
        mime_type: uploaded.mimeType || file.type,
        media_kind: fileKind,
        status: "active",
        source_kind: options.sourceKind ?? "editor_upload",
        source_entity: options.sourceEntity ?? null,
        source_record_id: options.sourceRecordId ?? null,
        storage_bucket: uploaded.storageBucket,
        storage_path: uploaded.storagePath,
        folder_id: options.folderId ?? null,
        file_kind: fileKind,
        asset_purpose: assetPurpose,
        display_filename: options.title ?? file.name,
        original_filename: file.name,
        file_extension: fileExtension,
        file_size_bytes: uploaded.size || file.size,
        metadata,
      })
      .select(MEDIA_ASSET_SELECT)
      .single();

    if (insertError || !inserted) {
      // Best-effort cleanup: remove the uploaded file if DB insert fails
      try {
        // Lightsail cleanup is handled separately. Do not delete through Supabase Storage here.
      } catch { /* best effort */ }
      throw new Error(`Failed to create media asset: ${insertError?.message ?? "Unknown error"}`);
    }

    return inserted as MediaAsset;
  },

  // ════════════════════════════════════════════════════════════
  // EDIT IMAGE
  // ════════════════════════════════════════════════════════════

  /**
   * Replace the image file for an existing media asset.
   * Re-uploads to the SAME storage path (keeps the URL stable).
   * Updates dimensions and updated_at on the registry_media_assets row.
   * The asset ID stays the same — all entity references remain valid.
   */
  async editImage(
    assetId: string,
    blob: Blob,
    newDimensions?: { width: number; height: number }
  ): Promise<MediaAsset> {
    // 1. Read the existing asset through Media authority.
    const existing =
      await getAdminMediaAssetById(assetId);

    if (!existing) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    let storagePath = existing.storage_path;
    const bucket = existing.storage_bucket ?? LIGHTSAIL_STORAGE_BUCKET;

    // If storage_path is missing (legacy data), try to derive from URL
    if (!storagePath && existing.url) {
      storagePath = parseStoragePathFromUrl(existing.url);
    }

    if (!storagePath) {
      throw new Error("Cannot determine storage path for this asset. Re-upload as a new asset instead.");
    }

    // 2. Re-upload to the same Lightsail path.
    // The public URL stays stable and all entity references keep working.
    await uploadToLightsailMedia(blob, {
      folder: storagePath.split("/").slice(0, -1).join("/") || "uploads",
      storagePath,
      fileName: storagePath.split("/").pop() || "edited-image.png",
    });

    // 3. Update metadata in registry_media_assets
    const existingMeta = (existing.metadata ?? {}) as MediaAssetMetadata;
    const updatedMeta: MediaAssetMetadata = {
      ...existingMeta,
      width: newDimensions?.width ?? existingMeta.width,
      height: newDimensions?.height ?? existingMeta.height,
    };

    const { data: updated, error: updateError } = await supabase
      .from("registry_media_assets")
      .update({
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId)
      .select(MEDIA_ASSET_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update asset metadata: ${updateError?.message ?? "Unknown error"}`);
    }

    return updated as MediaAsset;
  },

  // ════════════════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════════════════

  /**
   * Check what entities reference this media asset, then delete it.
   * Because all FKs use ON DELETE SET NULL, entity references are
   * automatically cleared when the asset row is deleted.
   *
   * Returns the list of referencing entities BEFORE deletion,
   * so the caller can show a warning to the admin.
   */
  async deleteAsset(assetId: string): Promise<DeleteResult> {
    // 1. Check references
    const references = await this.getReferences(assetId);

    // 2. Read the asset through Media authority.
    const asset =
      await getAdminMediaAssetById(assetId);

    // 3. Delete from database
    const { error: dbError } = await supabase
      .from("registry_media_assets")
      .delete()
      .eq("id", assetId);

    if (dbError) {
      throw new Error(`Delete failed: ${dbError.message}`);
    }

    // 4. Best-effort storage cleanup
    if (asset) {
      let storagePath = asset.storage_path;
      const bucket = asset.storage_bucket ?? LIGHTSAIL_STORAGE_BUCKET;

      if (!storagePath && asset.url) {
        storagePath = parseStoragePathFromUrl(asset.url);
      }

      if (storagePath && bucket !== LIGHTSAIL_STORAGE_BUCKET) {
        try {
          await supabase.storage.from(bucket).remove([storagePath]);
        } catch {
          // Best effort — the DB row is already gone
        }
      }
    }

    return { success: true, references };
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
   * Patch the metadata and status fields on a media asset.
   * Used by MediaEditModal when saving title, alt_text, caption, etc.
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
    }
  ): Promise<MediaAsset> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.folderId !== undefined) payload.folder_id = updates.folderId || null;
    if (updates.fileKind !== undefined) payload.file_kind = updates.fileKind || null;
    if (updates.assetPurpose !== undefined) payload.asset_purpose = updates.assetPurpose || null;
    if (updates.displayFilename !== undefined) payload.display_filename = updates.displayFilename || null;
    if (updates.originalFilename !== undefined) payload.original_filename = updates.originalFilename || null;
    if (updates.contentDate !== undefined) payload.content_date = updates.contentDate || null;
    if (updates.rightsStatus !== undefined) payload.rights_status = updates.rightsStatus || "unknown";
    if (updates.creditText !== undefined) payload.credit_text = updates.creditText || null;
    if (updates.countryCode !== undefined) payload.country_code = updates.countryCode || null;
    if (updates.languageCode !== undefined) payload.language_code = updates.languageCode || null;
    if (updates.tags !== undefined) payload.tags = updates.tags;
    if (updates.internalNotes !== undefined) payload.internal_notes = updates.internalNotes || null;

    if (updates.metadata !== undefined) {
      // Merge with metadata read through Media authority.
      const existing =
        await getAdminMediaAssetById(assetId);

      const existingMeta = (
        existing?.metadata ?? {}
      ) as MediaAssetMetadata;

      payload.metadata = { ...existingMeta, ...updates.metadata };
    }

    const { data, error } = await supabase
      .from("registry_media_assets")
      .update(payload)
      .eq("id", assetId)
      .select(MEDIA_ASSET_SELECT)
      .single();

    if (error || !data) {
      throw new Error(`Failed to update metadata: ${error?.message ?? "Unknown error"}`);
    }

    return data as MediaAsset;
  },

  // ════════════════════════════════════════════════════════════
  // BULK STATUS UPDATE
  // ════════════════════════════════════════════════════════════

  async updateStatusBatch(assetIds: string[], newStatus: string): Promise<void> {
    const { error } = await supabase
      .from("registry_media_assets")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .in("id", assetIds);

    if (error) {
      throw new Error(`Bulk status update failed: ${error.message}`);
    }
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