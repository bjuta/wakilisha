/**
 * MediaPickerModal — thin wrapper around the unified MediaLibrary.
 *
 * Renders MediaLibraryCore (tabs, grid, filters, upload, storage) in the left
 * panel and MediaLibraryPreviewPanel in the right panel for a single, consistent
 * media experience whether you're browsing or selecting.
 */

import { useState, useEffect, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { MediaLibraryCore } from "@/components/admin/media/MediaLibraryCore";
import { MediaLibraryPreviewPanel } from "@/components/admin/media/MediaLibraryPreviewPanel";
import {
  type MediaAsset,
  type MediaFileKind,
  mediaService,
} from "@/services/mediaService";

export interface MediaPickerSelection {
  assetId: string | null;
  url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Always returns both assetId and url. assetId is null for Storage items. */
  onSelect: (assetId: string | null, url: string) => void;
  title?: string;
  /** When provided, pre-selects this image and shows "Replace" button text */
  currentUrl?: string;
  /** Existing consumers default to images/documents. Audio/video are opt-in. */
  allowedKinds?: MediaFileKind[];
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  title = "Select Media",
  currentUrl,
  allowedKinds = ["image", "document"],
}: Props) {
  const [selectedUrl, setSelectedUrl] = useState(currentUrl ?? "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [resolvedAsset, setResolvedAsset] = useState<MediaAsset | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [registerToast, setRegisterToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isReplaceMode = !!currentUrl;

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedUrl("");
      setSelectedAssetId(null);
      setResolvedAsset(null);
      setRegisterToast(null);
    }
  }, [open]);

  // Pre-select when opening
  useEffect(() => {
    if (open && currentUrl) {
      setSelectedUrl(currentUrl);
    }
  }, [open, currentUrl]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && e.target === modalRef.current) onClose();
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open, onClose]);

  const handleRegisterFromStorage = async (url: string): Promise<MediaAsset> => {
    const fileName = url.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "") || "registered-image";
    const title = fileName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const asset = await mediaService.registerFromUrl(url, {
      title,
      sourceKind: "admin_upload",
      sourceEntity: "storage_register",
    });

    // Refresh the asset list and auto-select the new asset
    setRefreshCounter((c) => c + 1);
    setSelectedAssetId(asset.id);
    setSelectedUrl(asset.url ?? url);
    setResolvedAsset(asset);
    setRegisterToast({ type: "success", msg: `Registered: ${title}` });
    setTimeout(() => setRegisterToast(null), 3500);

    return asset;
  };

  if (!open) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4"
    >
      <div className="flex h-[90vh] w-full max-w-[1280px] flex-col rounded-2xl border border-wk-border bg-wk-surface shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-wk-border px-5 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-bold text-wk-text">{title}</h3>
            <div className="flex items-center gap-1 rounded-lg border border-wk-border bg-wk-bg px-2 py-1 text-[11px] text-wk-text-muted">
              <i className="ri-database-2-line text-[10px]" />
              Unified Media Library
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors cursor-pointer"
          >
            <WkIcon name="X" size={16} />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: unified library browser */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <MediaLibraryCore
              mode="picker"
              currentUrl={currentUrl}
              refreshKey={refreshCounter}
              allowedKinds={allowedKinds}
              onSelectionChange={(id, url, asset) => {
                setSelectedAssetId(id);
                setSelectedUrl(url);
                if (asset) setResolvedAsset(asset);
                else if (!id && url) setResolvedAsset(null);
              }}
              onAssetUpdated={(asset: MediaAsset) => {
                if (selectedAssetId === asset.id) {
                  setResolvedAsset(asset);
                  setSelectedUrl(asset.url ?? "");
                }
              }}
              onAssetDeleted={(id: string) => {
                if (selectedAssetId === id) {
                  setSelectedAssetId(null);
                  setSelectedUrl("");
                  setResolvedAsset(null);
                }
              }}
            />
          </div>

          {/* Right: preview + actions */}
          <MediaLibraryPreviewPanel
            mode="picker"
            selectedAsset={resolvedAsset}
            selectedUrl={selectedUrl}
            isReplaceMode={isReplaceMode}
            onSelect={() => {
              if (selectedUrl) {
                onSelect(selectedAssetId, selectedUrl);
              }
            }}
            onClose={onClose}
            onAssetUpdated={(asset: MediaAsset) => {
              setResolvedAsset(asset);
              setSelectedUrl(asset.url ?? "");
            }}
            onAssetDeleted={(id: string) => {
              if (selectedAssetId === id) {
                setSelectedAssetId(null);
                setSelectedUrl("");
                setResolvedAsset(null);
              }
            }}
            onRegisterFromStorage={handleRegisterFromStorage}
          />
        </div>
      </div>

      {/* Register toast */}
      {registerToast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg border-wk-success/20 bg-wk-success-soft text-wk-success">
          <WkIcon name="CheckCircle2" size={16} />
          {registerToast.msg}
        </div>
      )}
    </div>
  );
}