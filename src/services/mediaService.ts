/**
 * Unified Media Service — single source of truth for all image operations.
 *
 * Every component that touches media (MediaPickerModal, MediaEditModal,
 * MediaLibrary page, article editor, settings pages) delegates to this service.
 *
 * ── Capabilities ──
 * upload()       → creates registry_media_assets row + uploads to Supabase Storage
 * editImage()    → re-uploads edited Blob to same path, updates registry_media_assets row
 * deleteAsset()  → checks all 11 FK references, returns affected entities, then deletes
 * getById()      → fetches full asset with metadata and dimensions
 * getByUrl()     → fetches asset by public URL
 * list()         → paginated, filterable asset list
 * getReferences()→ which entities reference this image?
 * updateMetadata()→ patch title, alt_text, caption, description, status
 * updateStatus() → quick status toggle for bulk operations
 */

import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────

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
  /** Subfolder path within the bucket. Defaults to "uploads/". */
  folder?: string;
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
  sourceKind?: string;
  status?: string;
  missingAltOnly?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: "created_at" | "updated_at" | "title";
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

// ─── FK Reference Map ────────────────────────────────────────
// All 11 foreign key columns that reference registry_media_assets.
// Used for reference checking before delete.

const FK_REFERENCE_MAP: Array<{ table: string; column: string; id_column: string; label_column?: string }> = [
  { table: "wk_articles", column: "hero_image_id", id_column: "id", label_column: "title" },
  { table: "registry_artists", column: "public_image_id", id_column: "id", label_column: "name" },
  { table: "registry_releases", column: "artwork_image_id", id_column: "id", label_column: "title" },
  { table: "registry_tracks", column: "artwork_image_id", id_column: "id", label_column: "title" },
  { table: "registry_authors", column: "cover_image_id", id_column: "id", label_column: "name" },
  { table: "registry_authors", column: "avatar_image_id", id_column: "id", label_column: "name" },
  { table: "guide_pages", column: "hero_image_id", id_column: "id", label_column: "title" },
  { table: "guides", column: "hero_image_id", id_column: "id", label_column: "title" },
  { table: "registry_artist_highlights", column: "artwork_image_id", id_column: "id", label_column: "title" },
  { table: "chart_entries", column: "artwork_image_id", id_column: "id", label_column: "title" },
  { table: "wk_chart_entries_v2", column: "artwork_image_id", id_column: "id", label_column: "title" },
];

const STORAGE_BUCKET = "article-media";

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

function parseStoragePathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = parsed.pathname.indexOf(prefix);
    if (idx === -1) return null;
    return parsed.pathname.slice(idx + prefix.length);
  } catch {
    return null;
  }
}

// ─── Service ──────────────────────────────────────────────────

export const mediaService = {
  // ════════════════════════════════════════════════════════════
  // UPLOAD
  // ════════════════════════════════════════════════════════════

  /**
   * Upload a file to Supabase Storage and create a registry_media_assets row.
   * Returns the complete MediaAsset with its generated ID.
   */
  async upload(file: File, options: UploadOptions = {}): Promise<MediaAsset> {
    const folder = options.folder ?? "uploads";
    const storagePath = buildStoragePath(folder, file.name);

    // 1. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 3. Get image dimensions
    let width = 0;
    let height = 0;
    try {
      const dims = await getImageDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch {
      // Non-blocking — dimensions are best-effort
    }

    // 4. Insert into registry_media_assets
    const slug = options.slug ?? generateSlug();
    const metadata: MediaAssetMetadata = {
      alt_text: options.altText ?? file.name,
      caption: options.caption ?? null,
      description: options.description ?? null,
      file_name: file.name,
      file_size: file.size,
      width,
      height,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("registry_media_assets")
      .insert({
        slug,
        title: options.title ?? file.name,
        url: publicUrl,
        mime_type: file.type,
        media_kind: "image",
        status: "active",
        source_kind: options.sourceKind ?? "editor_upload",
        source_entity: options.sourceEntity ?? null,
        source_record_id: options.sourceRecordId ?? null,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        metadata,
      })
      .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, metadata, created_at, updated_at")
      .single();

    if (insertError || !inserted) {
      // Best-effort cleanup: remove the uploaded file if DB insert fails
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
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
    // 1. Fetch the existing asset to get its storage_path
    const { data: existing, error: fetchError } = await supabase
      .from("registry_media_assets")
      .select("id, url, storage_bucket, storage_path, metadata")
      .eq("id", assetId)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    let storagePath = existing.storage_path;
    const bucket = existing.storage_bucket ?? STORAGE_BUCKET;

    // If storage_path is missing (legacy data), try to derive from URL
    if (!storagePath && existing.url) {
      storagePath = parseStoragePathFromUrl(existing.url);
    }

    if (!storagePath) {
      throw new Error("Cannot determine storage path for this asset. Re-upload as a new asset instead.");
    }

    // 2. Re-upload to the same path (upsert: true replaces the file)
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, blob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Image replace failed: ${uploadError.message}`);
    }

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
      .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, metadata, created_at, updated_at")
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

    // 2. Fetch the asset to get storage path for cleanup
    const { data: asset } = await supabase
      .from("registry_media_assets")
      .select("id, url, storage_bucket, storage_path")
      .eq("id", assetId)
      .single();

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
      const bucket = asset.storage_bucket ?? STORAGE_BUCKET;

      if (!storagePath && asset.url) {
        storagePath = parseStoragePathFromUrl(asset.url);
      }

      if (storagePath) {
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

  async getById(assetId: string): Promise<MediaAsset | null> {
    const { data, error } = await supabase
      .from("registry_media_assets")
      .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, metadata, created_at, updated_at")
      .eq("id", assetId)
      .single();

    if (error || !data) return null;
    return data as MediaAsset;
  },

  async getByUrl(url: string): Promise<MediaAsset | null> {
    const { data, error } = await supabase
      .from("registry_media_assets")
      .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, metadata, created_at, updated_at")
      .eq("url", url)
      .maybeSingle();

    if (error || !data) return null;
    return data as MediaAsset;
  },

  // ════════════════════════════════════════════════════════════
  // LIST
  // ════════════════════════════════════════════════════════════

  async list(options: ListOptions = {}): Promise<ListResult> {
    const {
      search = "",
      mediaKind = "all",
      sourceKind = "all",
      status = "all",
      missingAltOnly = false,
      page = 0,
      pageSize = 60,
      orderBy = "created_at",
      ascending = false,
    } = options;

    let query = supabase
      .from("registry_media_assets")
      .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, metadata, created_at, updated_at", { count: "exact" });

    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%,url.ilike.%${search}%,source_record_id.ilike.%${search}%`);
    }
    if (mediaKind !== "all") query = query.eq("media_kind", mediaKind);
    if (sourceKind !== "all") query = query.eq("source_kind", sourceKind);
    if (status !== "all") query = query.eq("status", status);
    if (missingAltOnly) query = query.or("metadata.is.null,metadata->>alt_text.is.null");

    query = query
      .order(orderBy, { ascending })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to list media assets: ${error.message}`);

    return {
      assets: (data ?? []) as MediaAsset[],
      total: count ?? 0,
    };
  },

  // ════════════════════════════════════════════════════════════
  // REFERENCES
  // ════════════════════════════════════════════════════════════

  /**
   * Check all 11 FK tables and return every entity that references
   * this media asset. Used before deletion to warn the admin.
   */
  async getReferences(assetId: string): Promise<ReferencedEntity[]> {
    const results: ReferencedEntity[] = [];

    for (const ref of FK_REFERENCE_MAP) {
      try {
        const selectCols = ref.label_column
          ? `${ref.id_column}, ${ref.label_column}`
          : ref.id_column;

        const { data, error } = await supabase
          .from(ref.table)
          .select(selectCols)
          .eq(ref.column, assetId);

        if (error) continue;

        for (const row of (data ?? []) as Record<string, unknown>[]) {
          results.push({
            table: ref.table,
            column: ref.column,
            entity_id: String(row[ref.id_column] ?? ""),
            label: ref.label_column ? String(row[ref.label_column] ?? "") : undefined,
          });
        }
      } catch {
        // Skip tables that might not exist or be inaccessible
        continue;
      }
    }

    return results;
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
    }
  ): Promise<MediaAsset> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.status !== undefined) payload.status = updates.status;

    if (updates.metadata !== undefined) {
      // Merge with existing metadata
      const { data: existing } = await supabase
        .from("registry_media_assets")
        .select("metadata")
        .eq("id", assetId)
        .single();

      const existingMeta = (existing?.metadata ?? {}) as MediaAssetMetadata;
      payload.metadata = { ...existingMeta, ...updates.metadata };
    }

    const { data, error } = await supabase
      .from("registry_media_assets")
      .update(payload)
      .eq("id", assetId)
      .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, storage_bucket, storage_path, metadata, created_at, updated_at")
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