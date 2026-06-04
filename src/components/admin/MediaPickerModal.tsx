import { useEffect, useState, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface MediaAssetRow {
  id: string;
  entity_type: string;
  entity_slug: string;
  role: string;
  url: string;
  alt_text: string | null;
  source: string;
}

interface BucketItem {
  name: string;
  id: string | null;
  path: string;
  isFolder: boolean;
  publicUrl?: string;
}

type Tab = "assets" | "migrated";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
}

export function MediaPickerModal({ open, onClose, onSelect, title = "Select Media" }: Props) {
  const [tab, setTab] = useState<Tab>("assets");
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

  const [bucketPath, setBucketPath] = useState("wp-import");
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);
  const [bucketLoading, setBucketLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [previewError, setPreviewError] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  /* ─── Load media assets ─── */
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    const { data, error } = await supabase
      .from("wk_media_assets")
      .select("id, entity_type, entity_slug, role, url, alt_text, source")
      .limit(500);

    if (error) {
      console.error("Error loading media assets:", error);
    } else {
      setMediaAssets(data ?? []);
    }
    setAssetsLoading(false);
  }, []);

  /* ─── Load bucket items ─── */
  const loadBucket = useCallback(async () => {
    setBucketLoading(true);
    const { data, error } = await supabase.storage.from("article-media").list(bucketPath);

    if (error) {
      console.error("Error loading bucket:", error);
      setBucketItems([]);
    } else {
      const items: BucketItem[] = (data ?? []).map((item) => {
        const isFolder = !item.id;
        const path = bucketPath ? `${bucketPath}/${item.name}` : item.name;
        let publicUrl: string | undefined;
        if (!isFolder) {
          const { data: urlData } = supabase.storage.from("article-media").getPublicUrl(path);
          publicUrl = urlData.publicUrl;
        }
        return { name: item.name, id: item.id ?? null, path, isFolder, publicUrl };
      });
      setBucketItems(items);
    }
    setBucketLoading(false);
  }, [bucketPath]);

  useEffect(() => {
    if (!open) return;
    loadAssets();
  }, [open, loadAssets]);

  useEffect(() => {
    if (!open || tab !== "migrated") return;
    loadBucket();
  }, [open, tab, bucketPath, loadBucket]);

  /* ─── Filtered assets ─── */
  const filteredAssets = mediaAssets.filter((m) => {
    if (!assetSearch) return true;
    const q = assetSearch.toLowerCase();
    return (
      m.entity_slug.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      (m.alt_text?.toLowerCase().includes(q) ?? false)
    );
  });

  /* ─── Click outside to close ─── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && e.target === modalRef.current) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex h-[85vh] w-full max-w-[960px] flex-col rounded-2xl border border-wk-border bg-wk-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wk-border px-5 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-[16px] font-bold text-wk-text">{title}</h3>
            <div className="flex items-center rounded-lg border border-wk-border bg-wk-bg-subtle p-0.5">
              <button
                onClick={() => setTab("assets")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
                  tab === "assets"
                    ? "bg-wk-surface text-wk-text"
                    : "text-wk-text-muted hover:text-wk-text"
                }`}
              >
                Media Assets
              </button>
              <button
                onClick={() => setTab("migrated")}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
                  tab === "migrated"
                    ? "bg-wk-surface text-wk-text"
                    : "text-wk-text-muted hover:text-wk-text"
                }`}
              >
                Migrated Images
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors"
          >
            <WkIcon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Media Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "assets" && (
              <div className="space-y-3">
                {/* Search */}
                <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
                  <WkIcon name="Search" size={14} className="text-wk-text-faint" />
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search media assets..."
                    className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
                  />
                  {assetSearch && (
                    <button onClick={() => setAssetSearch("")} className="text-wk-text-faint hover:text-wk-text">
                      <WkIcon name="X" size={14} />
                    </button>
                  )}
                </div>

                {/* Grid */}
                {assetsLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-lg bg-wk-surface-raised" />
                    ))}
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-wk-text-muted">
                    <WkIcon name="Image" size={32} className="mb-2 text-wk-text-faint" />
                    <p className="text-[13px]">No media assets found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedUrl(asset.url)}
                        className={`group relative aspect-square overflow-hidden rounded-lg border bg-wk-surface-raised transition-all ${
                          selectedUrl === asset.url
                            ? "ring-2 ring-wk-brand border-wk-brand"
                            : "border-wk-border hover:border-wk-border-2"
                        }`}
                      >
                        <img
                          src={asset.url}
                          alt={asset.alt_text || ""}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-[10px] font-semibold text-white truncate">{asset.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "migrated" && (
              <div className="space-y-3">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 text-[12px] text-wk-text-muted">
                  <button
                    onClick={() => setBucketPath("wp-import")}
                    className="rounded-md px-2 py-1 hover:bg-wk-surface-raised text-wk-brand font-semibold"
                  >
                    wp-import
                  </button>
                  {bucketPath !== "wp-import" && (
                    <>
                      <WkIcon name="ChevronRight" size={12} />
                      <span className="font-mono">{bucketPath.replace("wp-import/", "")}</span>
                    </>
                  )}
                </div>

                {/* Grid */}
                {bucketLoading ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-lg bg-wk-surface-raised" />
                    ))}
                  </div>
                ) : bucketItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-wk-text-muted">
                    <WkIcon name="Image" size={32} className="mb-2 text-wk-text-faint" />
                    <p className="text-[13px]">No images in this folder.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {bucketItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          if (item.isFolder) {
                            setBucketPath(item.path);
                          } else {
                            setSelectedUrl(item.publicUrl ?? "");
                          }
                        }}
                        className={`group relative aspect-square overflow-hidden rounded-lg border bg-wk-surface-raised transition-all ${
                          !item.isFolder && selectedUrl === item.publicUrl
                            ? "ring-2 ring-wk-brand border-wk-brand"
                            : "border-wk-border hover:border-wk-border-2"
                        }`}
                      >
                        {item.isFolder ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-wk-text-muted">
                            <WkIcon name="Folder" size={28} />
                            <span className="text-[11px] font-semibold truncate max-w-full px-2">{item.name}</span>
                          </div>
                        ) : (
                          <>
                            <img
                              src={item.publicUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <p className="text-[10px] font-semibold text-white truncate">{item.name}</p>
                            </div>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Preview + Actions */}
          <div className="w-[280px] border-l border-wk-border bg-wk-bg-subtle p-4 flex flex-col">
            <div className="flex-1">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-wk-text-muted mb-3">
                Preview
              </h4>
              {selectedUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-wk-border bg-wk-surface-raised">
                    <img
                      src={selectedUrl}
                      alt="Preview"
                      className="w-full object-contain"
                      style={{ maxHeight: 200 }}
                      onError={() => setPreviewError(true)}
                    />
                  </div>
                  {previewError && (
                    <p className="text-[11px] text-red-500">Failed to load preview.</p>
                  )}
                  <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-muted mb-1">URL</p>
                    <p className="text-[11px] font-mono text-wk-text break-all">{selectedUrl}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-wk-text-muted">
                  <WkIcon name="Image" size={32} className="mb-2 text-wk-text-faint" />
                  <p className="text-[12px]">Select an image to preview</p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 space-y-2">
              <button
                onClick={() => {
                  if (selectedUrl) {
                    onSelect(selectedUrl);
                    setSelectedUrl("");
                    setPreviewError(false);
                  }
                }}
                disabled={!selectedUrl}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-wk-brand px-4 py-2.5 text-[13px] font-bold text-wk-brand-on disabled:opacity-40 transition-all"
              >
                <WkIcon name="Check" size={14} />
                Select Image
              </button>
              <button
                onClick={() => {
                  setSelectedUrl("");
                  setPreviewError(false);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}