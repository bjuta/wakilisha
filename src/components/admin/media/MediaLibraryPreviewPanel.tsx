/**
 * MediaLibraryPreviewPanel — right-hand preview + metadata + actions.
 *
 * Used inside the picker modal and optionally inside the library page.
 * Handles registered media assets and unmanaged URLs.
 */

import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { type MediaAsset } from "@/services/mediaService";
import { MediaEditModal } from "@/components/admin/media/MediaEditModal";

function assetFileKind(asset: MediaAsset): string {
  return asset.file_kind || (asset.mime_type === "application/pdf" ? "document" : asset.media_kind || "other");
}

function isImageAsset(asset: MediaAsset): boolean {
  return asset.mime_type?.startsWith("image/") === true || assetFileKind(asset) === "image";
}

function fileIconClass(asset: MediaAsset | null): string {
  return asset && assetFileKind(asset) === "document" ? "ri-file-pdf-2-line" : "ri-file-line";
}

interface Props {
  /** Currently selected asset (if it's a registered asset) */
  selectedAsset: MediaAsset | null;
  /** Always-set URL (either from asset or raw storage file) */
  selectedUrl: string;
  /** True if we're replacing an existing image */
  isReplaceMode: boolean;
  /** Picker mode: confirm selection */
  onSelect: () => void;
  /** Picker mode: close the modal */
  onClose: () => void;
  /** Library mode: copy URL */
  onCopy?: (url: string) => void;
  /** Library mode: delete asset */
  onDelete?: (asset: MediaAsset) => void;
  /** Library mode: callback after editing an asset in-place */
  onAssetUpdated?: (asset: MediaAsset) => void;
  /** Library mode: callback after deleting an asset */
  onAssetDeleted?: (id: string) => void;
  /** Which mode we're in — affects buttons shown */
  mode: "library" | "picker";
}

export function MediaLibraryPreviewPanel({
  selectedAsset,
  selectedUrl,
  isReplaceMode,
  onSelect,
  onClose,
  onCopy,
  onDelete,
  onAssetUpdated,
  onAssetDeleted,
  mode,
}: Props) {
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editFocus, setEditFocus] = useState<"view" | "edit">("view");
  const [previewError, setPreviewError] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUnmanagedUrl = !selectedAsset && !!selectedUrl;

  const metadata = selectedAsset?.metadata ?? {};
  const altText = typeof metadata.alt_text === "string" ? metadata.alt_text : undefined;
  const caption = typeof metadata.caption === "string" ? metadata.caption : undefined;
  const description = typeof metadata.description === "string" ? metadata.description : undefined;
  const width = typeof metadata.width === "number" ? metadata.width : undefined;
  const height = typeof metadata.height === "number" ? metadata.height : undefined;
  const fileSize = typeof metadata.file_size === "number" ? metadata.file_size : undefined;
  const fileName = typeof metadata.file_name === "string" ? metadata.file_name : undefined;
  const isImagePreview = selectedAsset ? isImageAsset(selectedAsset) : /\.(jpe?g|png|gif|webp|svg|avif|ico)(\?|$)/i.test(selectedUrl);
  const displayFileSize = selectedAsset?.file_size_bytes ?? fileSize;
  const displayFileName = selectedAsset?.original_filename ?? selectedAsset?.display_filename ?? fileName;

  const handleCopy = () => {
    if (selectedUrl) {
      navigator.clipboard.writeText(selectedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(selectedUrl);
    }
  };


  const handleOpenEdit = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditFocus("edit");
  };

  const handleOpenDetails = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditFocus("view");
  };

  const handleEditSave = (updated: MediaAsset) => {
    onAssetUpdated?.(updated);
    setEditingAsset(null);
  };

  const handleEditDelete = (id: string) => {
    onAssetDeleted?.(id);
    setEditingAsset(null);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="flex h-full flex-col w-[340px] shrink-0 border-l border-wk-border bg-wk-bg">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Preview</p>

        {selectedUrl ? (
          <>
            {/* Preview */}
            {isImagePreview ? (
              <>
                <div className="overflow-hidden rounded-xl border border-wk-border bg-wk-surface-raised">
                  <img
                    src={selectedUrl}
                    alt={altText || "Preview"}
                    className="w-full"
                    onError={() => setPreviewError(true)}
                  />
                </div>
                {previewError && (
                  <p className="text-[11px] text-wk-danger">Failed to load preview.</p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-wk-border bg-wk-surface-raised px-4 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-bg text-wk-text-faint">
                  <i className={`${fileIconClass(selectedAsset)} text-[32px]`} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-wk-text">{selectedAsset?.title || displayFileName || "Document"}</p>
                  <p className="mt-1 text-[11px] text-wk-text-muted">{selectedAsset?.mime_type || "Managed file"}</p>
                </div>
              </div>
            )}

            {/* ── Registered asset metadata ── */}
            {selectedAsset ? (
              <div className="space-y-2.5">
                {/* Title */}
                <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">Title</p>
                  <p className="text-[12px] font-semibold text-wk-text truncate">{selectedAsset.title || selectedAsset.slug || "Untitled"}</p>
                </div>

                {/* Dimensions */}
                {(width || height) && (
                  <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">Dimensions</p>
                    <p className="text-[12px] font-mono font-semibold text-wk-text">{width ?? "—"} × {height ?? "—"} px</p>
                  </div>
                )}

                {/* Alt text */}
                {altText && (
                  <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">Alt Text</p>
                    <p className="text-[11px] text-wk-text-soft leading-relaxed">{altText}</p>
                  </div>
                )}

                {/* Caption */}
                {caption && (
                  <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">Caption</p>
                    <p className="text-[11px] text-wk-text-soft leading-relaxed">{caption}</p>
                  </div>
                )}

                {/* Description */}
                {description && (
                  <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">Description</p>
                    <p className="text-[11px] text-wk-text-soft leading-relaxed">{description}</p>
                  </div>
                )}

                {/* File info */}
                <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">File</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-wk-text-faint">Type</span>
                    <span className="font-mono text-wk-text">{selectedAsset.mime_type || "—"}</span>
                  </div>
                  {displayFileSize && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-wk-text-faint">Size</span>
                      <span className="font-mono text-wk-text">{formatFileSize(displayFileSize)}</span>
                    </div>
                  )}
                  {displayFileName && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-wk-text-faint">Name</span>
                      <span className="font-mono text-wk-text truncate max-w-[140px]" title={displayFileName}>{displayFileName}</span>
                    </div>
                  )}
                </div>

                {/* Source / ID */}
                <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">Identification</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-wk-text-faint">ID</span>
                    <span className="font-mono text-wk-text text-[10px]">{selectedAsset.id.slice(0, 14)}…</span>
                  </div>
                  {selectedAsset.source_entity && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-wk-text-faint">Source</span>
                      <span className="text-wk-text capitalize">{selectedAsset.source_entity}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-wk-text-faint">Status</span>
                    <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                      selectedAsset.status === "active" ? "bg-wk-success-soft text-wk-success" :
                      selectedAsset.status === "needs_review" ? "bg-wk-warning-soft text-wk-warning" :
                      "bg-wk-surface-raised text-wk-text-muted"
                    }`}>{selectedAsset.status ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-wk-text-faint">Uploaded</span>
                    <span className="text-wk-text-muted">{formatDate(selectedAsset.created_at)}</span>
                  </div>
                </div>

                {isReplaceMode && (
                  <div className="rounded-lg border border-wk-info/20 bg-wk-info/5 p-2.5">
                    <p className="text-[11px] font-semibold text-wk-info">Current image</p>
                  </div>
                )}
              </div>
            ) : isUnmanagedUrl ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-1">URL</p>
                  <p className="text-[10px] font-mono text-wk-text break-all leading-relaxed">{selectedUrl}</p>
                </div>
                <div className="rounded-lg border border-wk-warning/20 bg-wk-warning/5 p-3">
                  <div className="flex items-start gap-2">
                    <i className="ri-alert-line text-[13px] text-wk-warning shrink-0 mt-0.5" />
                    <p className="text-[11px] text-wk-text-muted leading-relaxed">
                      This URL is not attached to a managed media asset. Re-upload it through Upload to bring it under the media registry.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-wk-text-muted">
            <WkIcon name="Image" size={36} className="mb-2 text-wk-text-faint" />
            <p className="text-[12px] text-center">Select a file<br />to preview it here</p>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="shrink-0 p-4 space-y-2 border-t border-wk-border">
        {/* Picker / Library: Edit & Details */}
        {selectedAsset && (
          <div className="flex gap-2">
            <button
              onClick={() => handleOpenEdit(selectedAsset)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised hover:text-wk-text hover:border-wk-brand transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-edit-line text-[13px]" />
              Edit
            </button>
            <button
              onClick={() => handleOpenDetails(selectedAsset)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised hover:text-wk-text hover:border-wk-brand transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-information-line text-[13px]" />
              Details
            </button>
          </div>
        )}

        {/* Library mode: Copy + Delete */}
        {mode === "library" && selectedAsset && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised transition-all cursor-pointer whitespace-nowrap"
            >
              <i className={copied ? "ri-check-line text-[13px]" : "ri-file-copy-line text-[13px]"} />
              {copied ? "Copied" : "Copy URL"}
            </button>
            <button
              onClick={() => onDelete?.(selectedAsset)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-wk-danger/20 bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-danger hover:bg-wk-danger-soft transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-delete-bin-line text-[13px]" />
              Delete
            </button>
          </div>
        )}

        {/* Picker mode: Use this image */}
        {mode === "picker" && (
          <button
            onClick={() => { if (selectedUrl) onSelect(); }}
            disabled={!selectedUrl}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-wk-brand px-4 py-2.5 text-[13px] font-bold text-wk-brand-on disabled:opacity-40 transition-all hover:opacity-90 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <WkIcon name="Check" size={14} />
            {isReplaceMode ? "Replace Image" : "Use This Image"}
          </button>
        )}

        {/* Picker mode: Cancel */}
        {mode === "picker" && (
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-all cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editingAsset && (
        <MediaEditModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          initialEditMode={editFocus}
        />
      )}
    </div>
  );
}