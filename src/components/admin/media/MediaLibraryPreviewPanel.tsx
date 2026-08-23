/**
 * MediaLibraryPreviewPanel — right-hand preview + metadata + actions.
 *
 * Used inside the picker modal and optionally inside the library page.
 * Handles registered media assets and unmanaged URLs.
 */

import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  getMediaAssetDeliveryUrl,
  mediaService,
  type MediaAsset,
  type MediaDerivative,
} from "@/services/mediaService";
import { MediaEditModal } from "@/components/admin/media/MediaEditModal";
import type { MediaPickerPurpose } from "@/types/mediaPicker";

function assetFileKind(asset: MediaAsset): string {
  return asset.file_kind || (asset.mime_type === "application/pdf" ? "document" : asset.media_kind || "other");
}

function isImageAsset(asset: MediaAsset): boolean {
  return asset.mime_type?.startsWith("image/") === true || assetFileKind(asset) === "image";
}

function fileIconClass(asset: MediaAsset | null): string {
  const kind = asset ? assetFileKind(asset) : "other";
  if (kind === "document") return "ri-file-pdf-2-line";
  if (kind === "audio") return "ri-music-2-line";
  if (kind === "video") return "ri-video-line";
  if (kind === "transcript") return "ri-file-text-line";
  if (kind === "caption") return "ri-file-list-3-line";
  return "ri-file-line";
}

function derivative(
  asset: MediaAsset | null,
  role: string,
): MediaDerivative | null {
  return asset?.selected_derivatives?.[role] ?? null;
}

function pickerActionLabel(
  purpose: MediaPickerPurpose,
  replace: boolean,
  selectedKind: string,
): string {
  if (purpose === "master_audio") return replace ? "Replace Master Audio" : "Use Master Audio";
  if (purpose === "transcript") return replace ? "Replace Transcript" : "Use Transcript";
  if (purpose === "cover_art") return replace ? "Replace Cover Art" : "Use Cover Art";
  if (purpose === "featured_image") return replace ? "Replace Featured Image" : "Use Featured Image";
  if (selectedKind === "image") return replace ? "Replace Image" : "Use Image";
  if (selectedKind === "audio") return replace ? "Replace Audio" : "Use Audio";
  if (selectedKind === "video") return replace ? "Replace Video" : "Use Video";
  if (selectedKind === "transcript") return replace ? "Replace Transcript" : "Use Transcript";
  if (selectedKind === "document") return replace ? "Replace Document" : "Use Document";
  return replace ? "Replace Media" : "Use Media";
}

interface Props {
  /** Currently selected asset (if it's a registered asset) */
  selectedAsset: MediaAsset | null;
  /** Always-set URL (either from asset or raw storage file) */
  selectedUrl: string;
  /** True if we are replacing an existing selection. */
  isReplaceMode: boolean;
  /** Semantic role for the picker confirmation action. */
  selectionPurpose?: MediaPickerPurpose;
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
  selectionPurpose = "media",
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
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [openingProtectedFile, setOpeningProtectedFile] = useState(false);
  const isUnmanagedUrl = !selectedAsset && !!selectedUrl;

  const selectedKind = selectedAsset ? assetFileKind(selectedAsset) : "";
  const audioPreview = derivative(selectedAsset, "audio_preview");
  const waveform = derivative(selectedAsset, "waveform_data");
  const videoTranscode = derivative(selectedAsset, "video_transcode");
  const posterFrame = derivative(selectedAsset, "poster_frame");
  const thumbnail = derivative(selectedAsset, "thumbnail");
  const effectiveSelectedUrl = selectedAsset
    ? getMediaAssetDeliveryUrl(selectedAsset)
    : selectedUrl;

  useEffect(() => {
    let alive = true;
    if (!waveform?.url) {
      setWaveformPeaks([]);
      return () => { alive = false; };
    }
    fetch(waveform.url)
      .then((response) => {
        if (!response.ok) throw new Error("Waveform request failed.");
        return response.json();
      })
      .then((payload) => {
        if (alive && Array.isArray(payload?.peaks)) {
          setWaveformPeaks(
            payload.peaks.map(Number).filter(Number.isFinite).slice(0, 1000),
          );
        }
      })
      .catch(() => { if (alive) setWaveformPeaks([]); });
    return () => { alive = false; };
  }, [waveform?.url]);

  const waveformPoints = useMemo(() => {
    if (!waveformPeaks.length) return "";
    return waveformPeaks.map((peak, index) => {
      const x = waveformPeaks.length > 1
        ? (index / (waveformPeaks.length - 1)) * 100
        : 50;
      const normalized = Math.max(-1, Math.min(1, peak));
      const y = 50 - normalized * 42;
      return `${x},${y}`;
    }).join(" ");
  }, [waveformPeaks]);

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
    if (effectiveSelectedUrl) {
      navigator.clipboard.writeText(effectiveSelectedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(effectiveSelectedUrl);
    }
  };

  const handleRetryProcessing = async () => {
    if (!selectedAsset) return;
    setRetryingProcessing(true);
    try {
      const updated = await mediaService.retryProcessing(selectedAsset.id);
      onAssetUpdated?.(updated);
    } finally {
      setRetryingProcessing(false);
    }
  };

  const handleOpenProtectedFile = async () => {
    const fileObjectId = selectedAsset?.current_file_object_id;
    if (!fileObjectId) return;

    setOpeningProtectedFile(true);
    try {
      const url = await mediaService.createPrivateDeliveryUrl(
        fileObjectId,
      );
      window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      setOpeningProtectedFile(false);
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

        {selectedAsset || selectedUrl ? (
          <>
            {/* Preview */}
            {selectedKind === "audio" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                  {audioPreview?.url ? (
                    <audio controls preload="metadata" src={audioPreview.url} className="w-full" />
                  ) : (
                    <div className="flex items-center gap-3 py-5">
                      <i className="ri-music-2-line text-[28px] text-wk-brand" />
                      <div>
                        <p className="text-[12px] font-bold text-wk-text">Audio master protected</p>
                        <p className="text-[11px] text-wk-text-muted">Preview becomes available when processing succeeds.</p>
                      </div>
                    </div>
                  )}
                </div>
                {waveformPoints && (
                  <div className="rounded-xl border border-wk-border bg-wk-bg p-2">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-20 w-full" aria-label="Audio waveform">
                      <polyline points={waveformPoints} fill="none" stroke="currentColor" strokeWidth="1" className="text-wk-brand" />
                    </svg>
                  </div>
                )}
              </div>
            ) : selectedKind === "video" ? (
              <div className="space-y-3">
                {videoTranscode?.url ? (
                  <video controls preload="metadata" poster={posterFrame?.url ?? thumbnail?.url ?? undefined} src={videoTranscode.url} className="w-full rounded-xl border border-wk-border bg-black" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-wk-border bg-wk-surface-raised px-4 py-10 text-center">
                    {posterFrame?.url || thumbnail?.url ? (
                      <img src={posterFrame?.url ?? thumbnail?.url ?? ""} alt="" className="w-full rounded-lg" />
                    ) : (
                      <i className="ri-video-line text-[32px] text-wk-brand" />
                    )}
                    <p className="text-[11px] text-wk-text-muted">Video playback becomes available when processing succeeds.</p>
                  </div>
                )}
              </div>
            ) : isImagePreview ? (
              <>
                <div className="overflow-hidden rounded-xl border border-wk-border bg-wk-surface-raised">
                  <img src={effectiveSelectedUrl} alt={altText || "Preview"} className="w-full" onError={() => setPreviewError(true)} />
                </div>
                {previewError && <p className="text-[11px] text-wk-danger">Failed to load preview.</p>}
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
                {(selectedKind === "audio" || selectedKind === "video") && (
                  <div className="rounded-lg border border-wk-border bg-wk-surface p-2.5 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Processing</p>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-wk-text-faint">State</span>
                      <span className="font-semibold text-wk-text">
                        {selectedAsset.delivery_ready
                          ? "ready"
                          : selectedAsset.processing_job_status
                            ?? selectedAsset.upload_session_state
                            ?? "waiting"}
                      </span>
                    </div>
                    {selectedAsset.processing_attempt_count !== null && selectedAsset.processing_attempt_count !== undefined && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-wk-text-faint">Attempt</span>
                        <span className="font-mono text-wk-text">
                          {selectedAsset.processing_attempt_count}
                          {selectedAsset.processing_max_attempts ? ` / ${selectedAsset.processing_max_attempts}` : ""}
                        </span>
                      </div>
                    )}
                    {selectedAsset.processing_last_error && (
                      <p className="text-[11px] leading-relaxed text-wk-danger">{selectedAsset.processing_last_error}</p>
                    )}
                    {selectedAsset.processing_job_status === "dead_letter" && (
                      <button type="button" disabled={retryingProcessing} onClick={() => void handleRetryProcessing()} className="mt-1 rounded-lg bg-wk-brand px-2.5 py-1.5 text-[11px] font-bold text-wk-brand-on disabled:opacity-50">
                        {retryingProcessing ? "Retrying…" : "Retry processing"}
                      </button>
                    )}
                  </div>
                )}

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
        {mode === "library"
          && selectedAsset?.current_file_object_id
          && ["audio", "video", "transcript", "caption"].includes(selectedKind)
          && (
            <button
              type="button"
              disabled={openingProtectedFile}
              onClick={() => void handleOpenProtectedFile()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-wk-brand px-4 py-2.5 text-[12px] font-bold text-wk-brand-on disabled:opacity-50 transition-all hover:opacity-90 cursor-pointer disabled:cursor-not-allowed"
            >
              <i className="ri-lock-unlock-line text-[13px]" />
              {openingProtectedFile ? "Opening…" : "Open Protected Original"}
            </button>
          )}

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
            {pickerActionLabel(selectionPurpose, isReplaceMode, selectedKind)}
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