import { useEffect, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { ImageEditor } from "./ImageEditor";
import {
  mediaService,
  type MediaAsset,
  type MediaAssetMetadata,
  type MediaFolder,
  type MediaGovernanceDraft,
  type MediaGovernanceState,
  type ReferencedEntity,
} from "@/services/mediaService";

function assetFileKind(asset: MediaAsset): string {
  return asset.file_kind || (asset.mime_type === "application/pdf" ? "document" : asset.media_kind || "other");
}

function isImageAsset(asset: MediaAsset): boolean {
  return asset.mime_type?.startsWith("image/") === true || assetFileKind(asset) === "image";
}

function fileIconClass(asset: MediaAsset): string {
  return assetFileKind(asset) === "document" ? "ri-file-pdf-2-line" : "ri-file-line";
}

function governanceDraftFrom(
  state: MediaGovernanceState,
): MediaGovernanceDraft {
  return {
    rightsStatus: state.rightsStatus,
    rightsBasis: state.rightsBasis,
    rightsHolder: state.rightsHolder,
    licenceIdentifier: state.licenceIdentifier,
    licenceTerms: state.licenceTerms,
    consentStatus: state.consentStatus,
    consentScope: state.consentScope,
    sensitivity: state.sensitivity,
    embargoState: state.embargoState,
    embargoUntil: state.embargoUntil,
    sourceProtectionClass: state.sourceProtectionClass,
    preservationState: state.preservationState,
    retentionState:
      state.retentionState === "retain" ? "retain" : "review_required",
    publicSafetyState: state.publicSafetyState,
    internalReason: state.internalReason,
  };
}

function governanceAllowsPublicUse(
  draft: MediaGovernanceDraft | null,
): boolean {
  if (!draft) return false;
  const embargoBlocked =
    draft.embargoState === "active"
    || (
      draft.embargoState === "scheduled"
      && draft.embargoUntil
      && new Date(draft.embargoUntil).getTime() > Date.now()
    );

  return (
    ["owned", "licensed", "public_domain", "fair_use"].includes(
      draft.rightsStatus,
    )
    && ["granted", "not_required"].includes(draft.consentStatus)
    && ["public", "public_redacted"].includes(draft.sourceProtectionClass)
    && ["retain", "review_required"].includes(draft.retentionState)
    && ["approved_public", "approved_redacted"].includes(
      draft.publicSafetyState,
    )
    && !embargoBlocked
  );
}

interface MediaEditModalProps {
  asset: MediaAsset;
  onClose: () => void;
  onSave: (asset: MediaAsset) => void;
  onDelete: (id: string) => void;
  /** Pre-set the initial mode — "edit" opens straight into image editing */
  initialEditMode?: "view" | "edit";
}

function FieldRow({
  label,
  value,
  mono,
  long,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  long?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-wk-text-faint uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-start gap-1.5 group">
        <span
          className={`text-[12px] text-wk-text ${mono ? "font-mono" : ""} ${long ? "break-all" : "truncate"}`}
        >
          {value}
        </span>
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 mt-0.5 rounded p-0.5 text-wk-text-faint hover:text-wk-brand hover:bg-wk-brand-soft opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Copy"
          >
            <i className={copied ? "ri-check-line text-[11px]" : "ri-file-copy-line text-[11px]"} />
          </button>
        )}
      </div>
    </div>
  );
}

export function MediaEditModal({
  asset,
  onClose,
  onSave,
  onDelete,
  initialEditMode = "view",
}: MediaEditModalProps) {
  const [editMode, setEditMode] = useState<"view" | "edit">(initialEditMode);
  const [editedPreview, setEditedPreview] = useState<string | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [editedWidth, setEditedWidth] = useState(0);
  const [editedHeight, setEditedHeight] = useState(0);

  const [title, setTitle] = useState(asset.title || "");
  const [altText, setAltText] = useState(
    typeof asset.metadata?.alt_text === "string" ? asset.metadata.alt_text : ""
  );
  const [caption, setCaption] = useState(
    typeof asset.metadata?.caption === "string" ? asset.metadata.caption : ""
  );
  const [description, setDescription] = useState(
    typeof asset.metadata?.description === "string" ? asset.metadata.description : ""
  );
  const [hexColor, setHexColor] = useState(
    typeof asset.metadata?.hex_color === "string" ? asset.metadata.hex_color : ""
  );
  const [animated, setAnimated] = useState(asset.metadata?.animated === true);
  const [status, setStatus] = useState(asset.status || "active");
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [folderId, setFolderId] = useState(asset.folder_id || "none");
  const [displayFilename, setDisplayFilename] = useState(asset.display_filename || asset.title || "");
  const [assetPurpose, setAssetPurpose] = useState(asset.asset_purpose || "general");
  const [contentDate, setContentDate] = useState(asset.content_date || "");
  const [rightsStatus, setRightsStatus] = useState(asset.rights_status || "unknown");
  const [creditText, setCreditText] = useState(asset.credit_text || "");
  const [countryCode, setCountryCode] = useState(asset.country_code || "");
  const [languageCode, setLanguageCode] = useState(asset.language_code || "");
  const [tagsText, setTagsText] = useState((asset.tags ?? []).join(", "));
  const [internalNotes, setInternalNotes] = useState(asset.internal_notes || "");

  const [governance, setGovernance] = useState<MediaGovernanceState | null>(null);
  const [governanceDraft, setGovernanceDraft] = useState<MediaGovernanceDraft | null>(null);
  const [governanceReason, setGovernanceReason] = useState("");
  const [governanceLoading, setGovernanceLoading] = useState(true);
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReferences, setDeleteReferences] = useState<ReferencedEntity[]>([]);
  const [deleteReferencesLoading, setDeleteReferencesLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let alive = true;
    mediaService.listFolders()
      .then((rows) => {
        if (alive) setFolders(rows);
      })
      .catch(() => {
        if (alive) setFolders([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setGovernanceLoading(true);
    setGovernanceError(null);

    mediaService.getGovernance(asset.id)
      .then((state) => {
        if (!alive) return;
        setGovernance(state);
        setGovernanceDraft(governanceDraftFrom(state));
      })
      .catch((error) => {
        if (!alive) return;
        setGovernance(null);
        setGovernanceDraft(null);
        setGovernanceError(
          error instanceof Error
            ? error.message
            : "Media governance could not load.",
        );
      })
      .finally(() => {
        if (alive) setGovernanceLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [asset.id]);

  const handleImageEdited = (blob: Blob, width: number, height: number) => {
    setEditedBlob(blob);
    setEditedWidth(width);
    setEditedHeight(height);
    setEditedPreview(URL.createObjectURL(blob));
    setEditMode("view");
    showToast("success", "Image edited. Click Save to apply changes to this asset.");
  };

  const handleSaveAsNewImage = async (blob: Blob, width: number, height: number) => {
    try {
      // Build SEO-friendly filename from the original asset title
      const baseTitle = (asset.title || asset.slug || asset.id?.slice(0, 12) || "image")
        .replace(/\.[^.]+$/, "") // strip extension
        .replace(/[^a-zA-Z0-9\s_-]/g, "") // sanitize
        .trim() || "cropped-image";

      const seoName = `${baseTitle}_${width}x${height}px`;

      const file = new File([blob], `${seoName}.png`, { type: "image/png" });
      const newAsset = await mediaService.upload(file, {
        title: seoName,
        altText: altText || baseTitle,
        sourceKind: "editor_upload",
        sourceEntity: "image_editor_crop",
      });

      onSave(newAsset);
      showToast("success", `Saved as new: ${seoName}`);
      // Close the modal after a brief delay so the toast is visible
      setTimeout(() => onClose(), 800);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Save as new failed.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updatedAsset = asset;

      // 1. If image was edited, re-upload to same storage path
      if (editedBlob) {
        updatedAsset = await mediaService.editImage(asset.id, editedBlob, {
          width: editedWidth,
          height: editedHeight,
        });
      }

      // 2. Update metadata fields
      const metadataUpdates: Partial<MediaAssetMetadata> = {
        alt_text: altText,
        caption,
        description,
        hex_color: hexColor,
        animated,
      };
      if (editedBlob) {
        metadataUpdates.width = editedWidth;
        metadataUpdates.height = editedHeight;
      }

      updatedAsset = await mediaService.updateMetadata(asset.id, {
        title: title || asset.title || undefined,
        metadata: metadataUpdates,
        status,
        folderId: folderId === "none" ? null : folderId,
        assetPurpose,
        displayFilename: displayFilename || title || asset.title || null,
        contentDate: contentDate || null,
        rightsStatus,
        creditText: creditText || null,
        countryCode: countryCode.trim().toUpperCase() || null,
        languageCode: languageCode.trim().toLowerCase() || null,
        tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
        internalNotes: internalNotes || null,
      });

      onSave(updatedAsset);
      showToast("success", "Changes saved successfully.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    try {
      const updated = await mediaService.updateMetadata(asset.id, { status });
      onSave(updated);
      showToast("success", "Status updated.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveGovernance = async () => {
    if (!governance || !governanceDraft) return;

    setGovernanceSaving(true);
    setGovernanceError(null);
    try {
      const next = await mediaService.createGovernanceVersion(
        asset.id,
        governance.authorityRevision,
        governanceDraft,
        governanceReason,
      );
      setGovernance(next);
      setGovernanceDraft(governanceDraftFrom(next));
      setGovernanceReason("");

      const refreshed = await mediaService.getById(asset.id);
      if (refreshed) onSave(refreshed);

      showToast("success", "Media governance version saved.");
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Media governance could not be saved.";
      setGovernanceError(message);
      showToast("error", message);
    } finally {
      setGovernanceSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    setDeleteConfirm(true);
    setDeleteReferencesLoading(true);
    try {
      const refs = await mediaService.getReferences(asset.id);
      setDeleteReferences(refs);
    } catch {
      setDeleteReferences([]);
    } finally {
      setDeleteReferencesLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await mediaService.archiveAsset(asset.id);
      if (result.success) {
        onDelete(asset.id);
        showToast("success", "File archived.");
        onClose();
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const imageUrl = editedPreview || asset.url || "";
  const canEditImage = isImageAsset(asset);
  const fileName = String(asset.original_filename ?? asset.display_filename ?? asset.metadata?.file_name ?? asset.slug ?? "—");
  const fileSize = typeof asset.file_size_bytes === "number"
    ? asset.file_size_bytes
    : asset.metadata?.file_size as number | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex h-[85vh] w-full max-w-[1280px] flex-col rounded-2xl border border-wk-border bg-wk-bg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 shrink-0 border-b border-wk-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-text-muted shrink-0">
              <i className={`${canEditImage ? "ri-image-line" : fileIconClass(asset)} text-[14px]`} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-wk-text truncate max-w-[400px]">
                {title || asset.title || asset.slug || asset.id.slice(0, 12)}
              </p>
              <p className="text-[11px] text-wk-text-muted font-mono truncate max-w-[400px]">
                {asset.slug || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {asset.url && (
              <>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(asset.url);
                    showToast("success", "URL copied to clipboard.");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-wk-border px-3 py-1.5 text-[11px] font-semibold text-wk-text-soft hover:text-wk-text hover:border-wk-border-2 hover:bg-wk-surface-raised transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-copy-line text-[12px]" />
                  Copy URL
                </button>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-wk-border px-3 py-1.5 text-[11px] font-semibold text-wk-text-soft hover:text-wk-text hover:border-wk-border-2 hover:bg-wk-surface-raised transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-external-link-line text-[12px]" />
                  Open
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:text-wk-text hover:bg-wk-surface-raised transition-all cursor-pointer"
            >
              <i className="ri-close-line text-[18px]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Preview */}
          <div className="flex-[2] min-w-0 flex flex-col bg-wk-surface-raised">
            {canEditImage && editMode === "edit" ? (
              <ImageEditor
                url={asset.url || ""}
                onApply={handleImageEdited}
                onSaveAsNew={handleSaveAsNewImage}
                onCancel={() => setEditMode("view")}
              />
            ) : canEditImage ? (
              <div
                className="flex-1 flex items-center justify-center p-4 overflow-hidden"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
                    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
                    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
                  `,
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                }}
              >
                {imageUrl ? (
                  <div className="relative group max-w-full max-h-full">
                    <img
                      src={imageUrl}
                      alt={String(asset.metadata?.alt_text ?? asset.title ?? "")}
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <button
                      onClick={() => setEditMode("edit")}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/30 rounded-lg cursor-pointer"
                    >
                      <span className="flex items-center gap-2 rounded-lg bg-white/90 px-4 py-2 text-[13px] font-semibold text-wk-text shadow-lg">
                        <i className="ri-edit-line text-[14px]" />
                        Edit Image
                      </span>
                    </button>
                    {editedBlob && (
                      <div className="absolute top-2 left-2 rounded-md bg-wk-warning px-2 py-1 text-[10px] font-bold text-white uppercase">
                        Edited
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-wk-text-faint">
                    <i className="ri-image-line text-[56px]" />
                    <p className="text-[13px] font-medium">No preview available</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-wk-border bg-wk-bg px-8 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-surface-raised text-wk-text-faint">
                    <i className={`${fileIconClass(asset)} text-[36px]`} />
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-wk-text">{asset.title || fileName}</p>
                    <p className="mt-1 text-[12px] text-wk-text-muted">{asset.mime_type || "Managed file"}</p>
                  </div>
                  {asset.url && (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90"
                    >
                      <i className="ri-download-line text-[13px]" />
                      Open file
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="flex-[1] min-w-0 border-l border-wk-border flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5 pb-4">
                {/* File Info */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">
                    File Info
                  </h4>
                  <div className="space-y-2">
                    <FieldRow
                      label="File name"
                      value={fileName}
                    />
                    <FieldRow label="MIME Type" value={asset.mime_type || "—"} />
                    <FieldRow
                      label="File size"
                      value={formatFileSize(fileSize)}
                    />
                    <FieldRow label="Uploaded" value={formatDate(asset.created_at)} />
                    <FieldRow label="URL" value={asset.url || "—"} long copyable />
                  </div>
                </section>

                {/* Asset Details */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">
                    {canEditImage ? "Image Details" : "File Details"}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                        Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Image title..."
                        className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                      />
                    </div>
                    {canEditImage && (
                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Alt Text
                        </label>
                        <input
                          type="text"
                          value={altText}
                          onChange={(e) => setAltText(e.target.value)}
                          placeholder="Describe the image for accessibility..."
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                        Caption
                      </label>
                      <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Caption shown below the image..."
                        rows={2}
                        className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 resize-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Longer description for SEO and accessibility..."
                        rows={3}
                        className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 resize-none transition-all"
                      />
                    </div>

                    {/* Dimensions */}
                    {canEditImage && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Width
                        </label>
                        <input
                          type="number"
                          value={
                            editedBlob
                              ? editedWidth
                              : (asset.metadata?.width as number | undefined) || ""
                          }
                          readOnly
                          className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-1.5 text-[12px] text-wk-text-muted outline-none cursor-not-allowed"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Height
                        </label>
                        <input
                          type="number"
                          value={
                            editedBlob
                              ? editedHeight
                              : (asset.metadata?.height as number | undefined) || ""
                          }
                          readOnly
                          className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-1.5 text-[12px] text-wk-text-muted outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                    )}

                    {/* HEX Color */}
                    {canEditImage && (
                    <div>
                      <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                        HEX Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={hexColor}
                          onChange={(e) => setHexColor(e.target.value)}
                          placeholder="#000000"
                          className="flex-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                        />
                        <div
                          className="w-8 h-8 rounded-lg border border-wk-border shrink-0"
                          style={{ backgroundColor: hexColor || "transparent" }}
                        />
                      </div>
                    </div>
                    )}

                    {/* Animated */}
                    {canEditImage && (
                    <label className="flex items-center gap-2 text-[12px] text-wk-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={animated}
                        onChange={(e) => setAnimated(e.target.checked)}
                        className="rounded"
                      />
                      Animated
                    </label>
                    )}

                    {/* Library metadata */}
                    <div className="rounded-xl border border-wk-border bg-wk-surface/60 p-3 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                        Library metadata
                      </p>

                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Folder
                        </label>
                        <select
                          value={folderId}
                          onChange={(e) => setFolderId(e.target.value)}
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50 cursor-pointer"
                        >
                          <option value="none">No folder</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Display filename
                        </label>
                        <input
                          type="text"
                          value={displayFilename}
                          onChange={(e) => setDisplayFilename(e.target.value)}
                          placeholder="Readable file name..."
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                            Purpose
                          </label>
                          <select
                            value={assetPurpose}
                            onChange={(e) => setAssetPurpose(e.target.value)}
                            className="w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50 cursor-pointer"
                          >
                            <option value="general">General</option>
                            <option value="article_hero">Article hero</option>
                            <option value="article_inline">Article inline</option>
                            <option value="chart_artwork">Chart artwork</option>
                            <option value="artist_photo">Artist photo</option>
                            <option value="release_artwork">Release artwork</option>
                            <option value="track_artwork">Track artwork</option>
                            <option value="downloadable">Downloadable</option>
                            <option value="press_kit">Press kit</option>
                            <option value="brand_asset">Brand asset</option>
                            <option value="profile_media">Profile media</option>
                            <option value="social_card">Social card</option>
                            <option value="system">System</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                            Content date
                          </label>
                          <input
                            type="date"
                            value={contentDate}
                            onChange={(e) => setContentDate(e.target.value)}
                            className="w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Rights status
                        </label>
                        <select
                          value={rightsStatus}
                          onChange={(e) => setRightsStatus(e.target.value)}
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50 cursor-pointer"
                        >
                          <option value="unknown">Unknown</option>
                          <option value="owned">Owned</option>
                          <option value="licensed">Licensed</option>
                          <option value="public_domain">Public domain</option>
                          <option value="fair_use">Fair use</option>
                          <option value="needs_clearance">Needs clearance</option>
                          <option value="restricted">Restricted</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Credit
                        </label>
                        <input
                          type="text"
                          value={creditText}
                          onChange={(e) => setCreditText(e.target.value)}
                          placeholder="Photographer, publication, partner..."
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                            Country
                          </label>
                          <input
                            type="text"
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            placeholder="KE"
                            maxLength={2}
                            className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] uppercase text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                            Language
                          </label>
                          <input
                            type="text"
                            value={languageCode}
                            onChange={(e) => setLanguageCode(e.target.value)}
                            placeholder="en"
                            maxLength={8}
                            className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] lowercase text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Tags
                        </label>
                        <input
                          type="text"
                          value={tagsText}
                          onChange={(e) => setTagsText(e.target.value)}
                          placeholder="comma, separated, tags"
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                          Internal notes
                        </label>
                        <textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Rights notes, usage limits, source context..."
                          rows={3}
                          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 resize-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Save */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                    >
                      {saving ? (
                        <>
                          <i className="ri-loader-2-line text-[12px] animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <i className="ri-save-line text-[12px]" /> Save Changes
                        </>
                      )}
                    </button>

                    {/* Status */}
                    <div>
                      <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">
                        Status
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="flex-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50 cursor-pointer"
                        >
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                          <option value="needs_review">Needs review</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <button
                          onClick={handleSaveStatus}
                          disabled={savingStatus}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[11px] font-bold text-wk-text-soft hover:text-wk-text hover:bg-wk-surface-raised disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                        >
                          {savingStatus ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                        Usage governance
                      </h4>
                      <p className="mt-1 text-[11px] text-wk-text-muted">
                        Draft Media may stay internal. Public Video publication still requires explicit rights, consent, source protection, and public safety approval.
                      </p>
                    </div>
                    {governanceDraft ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                          governanceAllowsPublicUse(governanceDraft)
                            ? "bg-wk-success-soft text-wk-success"
                            : "bg-wk-warning-soft text-wk-warning"
                        }`}
                      >
                        {governanceAllowsPublicUse(governanceDraft)
                          ? "Public ready"
                          : "Internal only"}
                      </span>
                    ) : null}
                  </div>

                  {governanceLoading ? (
                    <p className="text-[11px] text-wk-text-muted">
                      Loading governance…
                    </p>
                  ) : governanceError && !governanceDraft ? (
                    <div className="rounded-lg border border-wk-warning/25 bg-wk-warning-soft px-3 py-2 text-[11px] text-wk-warning">
                      {governanceError}
                    </div>
                  ) : governance && governanceDraft ? (
                    <div className="space-y-3 rounded-xl border border-wk-border bg-wk-surface/60 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[11px] font-semibold text-wk-text-soft">
                          Rights
                          <select
                            value={governanceDraft.rightsStatus}
                            onChange={(event) => {
                              const nextRights = event.target.value as MediaGovernanceDraft["rightsStatus"];
                              setGovernanceDraft((current) => current
                                ? {
                                    ...current,
                                    rightsStatus: nextRights, consentStatus: nextRights === "owned" ? "granted" : current.consentStatus,
                                  }
                                : current
                              );
                            }}
                            className="mt-1.5 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50"
                          >
                            <option value="unknown">Unknown</option>
                            <option value="owned">Owned</option>
                            <option value="licensed">Licensed</option>
                            <option value="public_domain">Public domain</option>
                            <option value="fair_use">Fair use</option>
                            <option value="needs_clearance">Needs clearance</option>
                            <option value="restricted">Restricted</option>
                          </select>
                        </label>

                        <label className="block text-[11px] font-semibold text-wk-text-soft">
                          Consent
                          <select
                            value={governanceDraft.consentStatus}
                            disabled={governanceDraft.rightsStatus === "owned"}
                            onChange={(event) =>
                              setGovernanceDraft((current) => current
                                ? { ...current, consentStatus: event.target.value as MediaGovernanceDraft["consentStatus"] }
                                : current
                              )
                            }
                            className="mt-1.5 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="unknown">Unknown</option>
                            <option value="not_required">Not required</option>
                            <option value="requested">Requested</option>
                            <option value="granted">Granted</option>
                            <option value="limited">Limited</option>
                            <option value="declined">Declined</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                          {governanceDraft.rightsStatus === "owned" ? (
                            <span className="mt-1 block text-[10px] font-medium text-wk-text-faint">
                              Granted automatically because Rights is Owned.
                            </span>
                          ) : null}
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[11px] font-semibold text-wk-text-soft">
                          Source protection
                          <select
                            value={governanceDraft.sourceProtectionClass}
                            onChange={(event) =>
                              setGovernanceDraft((current) => current
                                ? { ...current, sourceProtectionClass: event.target.value as MediaGovernanceDraft["sourceProtectionClass"] }
                                : current
                              )
                            }
                            className="mt-1.5 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50"
                          >
                            <option value="internal">Internal</option>
                            <option value="public">Public</option>
                            <option value="public_redacted">Public redacted</option>
                            <option value="restricted">Restricted</option>
                            <option value="confidential">Confidential</option>
                          </select>
                        </label>

                        <label className="block text-[11px] font-semibold text-wk-text-soft">
                          Public safety
                          <select
                            value={governanceDraft.publicSafetyState}
                            onChange={(event) =>
                              setGovernanceDraft((current) => current
                                ? { ...current, publicSafetyState: event.target.value as MediaGovernanceDraft["publicSafetyState"] }
                                : current
                              )
                            }
                            className="mt-1.5 w-full rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50"
                          >
                            <option value="internal">Internal</option>
                            <option value="review_required">Review required</option>
                            <option value="approved_public">Approved public</option>
                            <option value="approved_redacted">Approved redacted</option>
                            <option value="blocked">Blocked</option>
                          </select>
                        </label>
                      </div>

                      <label className="block text-[11px] font-semibold text-wk-text-soft">
                        Governance reason
                        <textarea
                          value={governanceReason}
                          onChange={(event) => setGovernanceReason(event.target.value)}
                          rows={2}
                          placeholder="Why this governance state is correct"
                          className="mt-1.5 w-full resize-none rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none focus:border-wk-brand/50"
                        />
                      </label>

                      {governanceError ? (
                        <div className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft px-3 py-2 text-[11px] text-wk-danger">
                          {governanceError}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void handleSaveGovernance()}
                        disabled={governanceSaving || !governanceReason.trim()}
                        className="w-full rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on disabled:opacity-40"
                      >
                        {governanceSaving ? "Saving governance..." : "Save Governance Version"}
                      </button>

                      <p className="text-[10px] text-wk-text-faint">
                        Governance version {governance.versionNumber}. Sensitivity, embargo, preservation, and retention stay at their current canonical values in this bounded control.
                      </p>
                    </div>
                  ) : null}
                </section>

                {/* Identification */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">
                    Identification
                  </h4>
                  <div className="space-y-2">
                    <FieldRow label="ID" value={asset.id} mono long />
                    <FieldRow label="Slug" value={asset.slug || "—"} mono />
                    <FieldRow label="Media Kind" value={asset.media_kind || "—"} />
                    <FieldRow label="File Kind" value={asset.file_kind || "—"} />
                    <FieldRow label="Purpose" value={asset.asset_purpose || "—"} />
                    <FieldRow label="Rights" value={asset.rights_status || "—"} />
                  </div>
                </section>

                {/* Source */}
                <section>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">
                    Source
                  </h4>
                  <div className="space-y-2">
                    <FieldRow label="Source Kind" value={asset.source_kind || "—"} />
                    <FieldRow label="Source Entity" value={asset.source_entity || "—"} mono />
                    <FieldRow label="Source Record ID" value={asset.source_record_id || "—"} mono />
                    {asset.source_staging_record_id && (
                      <FieldRow
                        label="Staging Record ID"
                        value={asset.source_staging_record_id}
                        mono
                      />
                    )}
                  </div>
                </section>

                {/* Danger Zone */}
                <section className="pt-4 border-t border-wk-border">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-danger mb-3">
                    Archive
                  </h4>
                  {deleteConfirm ? (
                    <div className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3 space-y-3">
                      <div className="flex items-start gap-2">
                        <WkIcon
                          name="AlertTriangle"
                          size={16}
                          className="text-wk-danger shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="text-[12px] font-bold text-wk-danger">
                            Archive this file?
                          </p>
                          <p className="text-[11px] text-wk-text-muted mt-0.5">
                            This keeps the file, its edit history, and every place it appears.
                            It will not appear publicly while archived.
                          </p>
                        </div>
                      </div>

                      {/* FK Reference warnings */}
                      {deleteReferencesLoading ? (
                        <div className="flex items-center gap-2 text-[11px] text-wk-text-muted">
                          <i className="ri-loader-4-line animate-spin text-[13px]" />
                          Checking references…
                        </div>
                      ) : deleteReferences.length > 0 ? (
                        <div className="rounded-lg border border-wk-warning/30 bg-wk-warning-soft p-2.5 space-y-1.5">
                          <p className="text-[11px] font-bold text-wk-warning">
                            This image is used by {deleteReferences.length} entit{deleteReferences.length === 1 ? "y" : "ies"}:
                          </p>
                          <div className="max-h-[120px] overflow-y-auto space-y-1">
                            {deleteReferences.slice(0, 15).map((ref, i) => (
                              <div key={i} className="flex items-center gap-2 text-[10px] text-wk-text-muted">
                                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-wk-warning" />
                                <span className="font-semibold text-wk-text-soft">{ref.table}</span>
                                <span className="text-wk-text-faint">→</span>
                                <span className="font-mono text-[10px] truncate">{ref.label || ref.entity_id.slice(0, 12)}</span>
                              </div>
                            ))}
                            {deleteReferences.length > 15 && (
                              <p className="text-[10px] text-wk-text-faint pl-4">
                                …and {deleteReferences.length - 15} more
                              </p>
                            )}
                          </div>
                          <p className="text-[10px] text-wk-text-muted">
                            Archiving keeps these links intact. Restore the file when you want it to appear again.
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-wk-success">
                          <WkIcon name="CheckCircle2" size={13} />
                          This file is not currently in use. Its history will still be kept.
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-wk-danger px-3 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                        >
                          {deleting ? (
                            <>
                              <i className="ri-loader-2-line animate-spin text-[12px]" />{" "}
                              Archiving...
                            </>
                          ) : (
                            <>
                              <WkIcon name="Archive" size={13} /> Archive File
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => { setDeleteConfirm(false); setDeleteReferences([]); }}
                          disabled={deleting}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleDeleteClick}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-wk-danger/20 bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-danger hover:bg-wk-danger-soft transition-all cursor-pointer whitespace-nowrap"
                    >
                      <WkIcon name="Archive" size={13} />
                      Archive File
                    </button>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[999] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
            toast.type === "success"
              ? "border-wk-success/20 bg-wk-success-soft text-wk-success"
              : "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
          }`}
        >
          <WkIcon name={toast.type === "success" ? "CheckCircle2" : "XCircle"} size={16} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}