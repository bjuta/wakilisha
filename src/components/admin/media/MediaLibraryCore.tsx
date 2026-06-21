/**
 * MediaLibraryCore
 *
 * The single shared component powering BOTH:
 *  - /admin/media/library (standalone page)
 *  - MediaPickerModal (inline picker mode)
 *
 * In "library" mode: full-width, no selection callback, shows upload count in header.
 * In "picker" mode:  selection state, onSelect callback, compact layout without outer padding.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { mediaService, type MediaAsset } from "@/services/mediaService";
import { MediaEditModal } from "@/components/admin/media/MediaEditModal";
import { MediaLibraryPreviewPanel } from "@/components/admin/media/MediaLibraryPreviewPanel";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────

interface BucketItem {
  name: string;
  id: string | null;
  path: string;
  isFolder: boolean;
  publicUrl?: string;
}

type Tab = "assets" | "storage" | "upload";

export interface MediaLibraryCoreProps {
  /** "library" = standalone page, "picker" = inside a modal for selection */
  mode: "library" | "picker";
  /** Picker mode: called when user confirms selection */
  onSelect?: (assetId: string | null, url: string) => void;
  /** Picker mode: pre-select this URL on mount */
  currentUrl?: string;
  /** Picker mode: passed state setters so the parent can read selectedUrl/assetId */
  onSelectionChange?: (assetId: string | null, url: string, asset?: MediaAsset | null) => void;
  /** Called when an asset is saved/updated via edit modal */
  onAssetUpdated?: (asset: MediaAsset) => void;
  /** Called when an asset is deleted via edit modal */
  onAssetDeleted?: (id: string) => void;
  /** External refresh trigger — increment to force a reload */
  refreshKey?: number;
  /** Show upload tab by default */
  defaultTab?: Tab;
}

const PAGE_SIZE = 60;
const BUCKET = "article-media";

// ─── Component ───────────────────────────────────────────────

export function MediaLibraryCore({
  mode,
  onSelect,
  currentUrl,
  onSelectionChange,
  onAssetUpdated,
  onAssetDeleted,
  refreshKey = 0,
  defaultTab = "assets",
}: MediaLibraryCoreProps) {
  // ── View state
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // ── Assets state
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // ── Filters
  const [search, setSearch] = useState("");
  const [mediaKindFilter, setMediaKindFilter] = useState("all");
  const [sourceKindFilter, setSourceKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [missingAltOnly, setMissingAltOnly] = useState(false);

  // ── Selection (picker mode)
  const [selectedUrl, setSelectedUrl] = useState(currentUrl ?? "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // ── Bulk actions (library mode)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("set_status_active");
  const [bulkRunning, setBulkRunning] = useState(false);

  // ── Edit modal
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);

  // ── Storage browser
  const [storageRoot, setStorageRoot] = useState<"uploads" | "wp-import">("uploads");
  const [bucketPath, setBucketPath] = useState("uploads");
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);
  const [bucketLoading, setBucketLoading] = useState(false);

  // ── Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, "pending" | "uploading" | "done" | "error">>({});
  const [uploadedItems, setUploadedItems] = useState<{ name: string; url: string; assetId?: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isPickerMode = mode === "picker";

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Notify parent on selection change
  const selectItem = useCallback((assetId: string | null, url: string, assetOverride?: MediaAsset | null) => {
    setSelectedUrl(url);
    setSelectedAssetId(assetId);
    const asset = assetOverride !== undefined
      ? assetOverride
      : (assetId ? (assets.find((a) => a.id === assetId) ?? null) : null);
    onSelectionChange?.(assetId, url, asset);
  }, [onSelectionChange, assets]);

  // ── Fetch assets
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await mediaService.list({
        search,
        mediaKind: mediaKindFilter,
        sourceKind: sourceKindFilter,
        status: statusFilter,
        missingAltOnly,
        page,
        pageSize: PAGE_SIZE,
        orderBy: "created_at",
        ascending: false,
      });
      setAssets(result.assets);
      setTotal(result.total);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load media assets.");
    } finally {
      setLoading(false);
    }
  }, [search, mediaKindFilter, sourceKindFilter, statusFilter, missingAltOnly, page, refreshKey]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // ── Pre-select currentUrl once assets load
  useEffect(() => {
    if (currentUrl && assets.length > 0 && !selectedAssetId) {
      const match = assets.find((a) => a.url === currentUrl);
      if (match) {
        setSelectedAssetId(match.id);
        setSelectedUrl(currentUrl);
      } else {
        setSelectedUrl(currentUrl);
      }
    }
  }, [currentUrl, assets]);

  // ── Fetch storage bucket
  const fetchBucket = useCallback(async () => {
    setBucketLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(bucketPath);
    if (error) {
      setBucketItems([]);
    } else {
      const items: BucketItem[] = (data ?? []).map((item) => {
        const isFolder = !item.id;
        const path = `${bucketPath}/${item.name}`;
        let publicUrl: string | undefined;
        if (!isFolder) {
          const { data: u } = supabase.storage.from(BUCKET).getPublicUrl(path);
          publicUrl = u.publicUrl;
        }
        return { name: item.name, id: item.id ?? null, path, isFolder, publicUrl };
      });
      setBucketItems(items.filter((i) => i.isFolder || /\.(jpe?g|png|gif|webp|svg)$/i.test(i.name)));
    }
    setBucketLoading(false);
  }, [bucketPath]);

  useEffect(() => { if (tab === "storage") fetchBucket(); }, [tab, bucketPath, fetchBucket]);

  // ── Upload
  const uploadFile = useCallback(async (file: File) => {
    setUploadProgress((p) => ({ ...p, [file.name]: "uploading" }));
    try {
      const asset = await mediaService.upload(file, {
        folder: "uploads",
        sourceKind: "editor_upload",
        sourceEntity: "admin_upload",
        altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      });
      setUploadProgress((p) => ({ ...p, [file.name]: "done" }));
      setUploadedItems((prev) => [...prev, { name: file.name, url: asset.url!, assetId: asset.id }]);
      // Auto-select the uploaded item, passing the full asset so the parent previews it
      selectItem(asset.id, asset.url!, asset);
      // Refresh assets list
      fetchAssets();
    } catch {
      setUploadProgress((p) => ({ ...p, [file.name]: "error" }));
    }
  }, [fetchAssets, selectItem]);

  const handleFilesAdded = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setUploadFiles((prev) => [...prev, ...arr]);
    arr.forEach(uploadFile);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  }, [handleFilesAdded]);

  // ── Bulk
  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkAction = async () => {
    if (bulkSelected.size === 0) return;
    setBulkRunning(true);
    try {
      const ids = Array.from(bulkSelected);
      if (bulkAction.startsWith("set_status_")) {
        const newStatus = bulkAction.replace("set_status_", "");
        await mediaService.updateStatusBatch(ids, newStatus);
        showToast("success", `Updated ${ids.length} assets.`);
      }
      setBulkSelected(new Set());
      fetchAssets();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkRunning(false);
    }
  };

  // ── Edit modal callbacks
  const handleEditSave = (updated: MediaAsset) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (selectedAssetId === updated.id) selectItem(updated.id, updated.url ?? "");
    setEditingAsset(null);
    onAssetUpdated?.(updated);
    showToast("success", "Saved.");
  };

  const handleEditDelete = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    if (selectedAssetId === id) selectItem(null, "");
    setEditingAsset(null);
    onAssetDeleted?.(id);
    showToast("success", "Deleted.");
  };

  // ── Copy URL
  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast("error", "Failed to copy.");
    }
  };

  const handleDeleteAsset = async (asset: MediaAsset) => {
    try {
      const result = await mediaService.deleteAsset(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      if (selectedAssetId === asset.id) selectItem(null, "");
      showToast("success", `Deleted. ${result.references.length} references cleared.`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  const handleDeleteStorage = async (url: string) => {
    try {
      const item = bucketItems.find((i) => i.publicUrl === url);
      if (!item) throw new Error("Storage item not found");
      const { error } = await supabase.storage.from(BUCKET).remove([item.path]);
      if (error) throw error;
      setBucketItems((prev) => prev.filter((i) => i.publicUrl !== url));
      if (selectedUrl === url) selectItem(null, "");
      showToast("success", "Deleted from storage.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  const handleRegisterFromStorage = async (url: string) => {
    try {
      const asset = await mediaService.registerFromUrl(url);
      setAssets((prev) => [asset, ...prev]);
      selectItem(asset.id, asset.url!, asset);
      showToast("success", `Registered: ${asset.title || asset.slug}`);
      return asset;
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to register.");
      throw err;
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Tabs
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "assets", label: "Media Assets", icon: "ri-database-2-line" },
    { key: "storage", label: "Storage", icon: "ri-folder-image-line" },
    { key: "upload", label: "Upload", icon: "ri-upload-cloud-line" },
  ];

  const selectedAsset = selectedAssetId ? assets.find((a) => a.id === selectedAssetId) ?? null : null;

  return (
    <div className={`flex ${isPickerMode ? "flex-col h-full" : "flex-row h-full"}`}>
      <div className={`flex flex-col ${isPickerMode ? "h-full" : "flex-1 min-h-0 overflow-y-auto space-y-4"}`}>

        {/* ── Header (library mode only) ── */}
      {!isPickerMode && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Media</div>
            <h1 className="text-[22px] font-black tracking-tight text-wk-text">Media Library</h1>
            <p className="mt-1 text-[13px] text-wk-text-muted">
              {total.toLocaleString()} assets · single source of truth for all images
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode */}
            <div className="flex items-center rounded-lg border border-wk-border bg-wk-bg p-0.5">
              <button onClick={() => setViewMode("grid")} className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${viewMode === "grid" ? "bg-wk-surface text-wk-brand" : "text-wk-text-muted hover:text-wk-text"}`}>
                <WkIcon name="LayoutGrid" size={14} />
              </button>
              <button onClick={() => setViewMode("table")} className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${viewMode === "table" ? "bg-wk-surface text-wk-brand" : "text-wk-text-muted hover:text-wk-text"}`}>
                <WkIcon name="List" size={14} />
              </button>
            </div>
            <button
              onClick={() => { setTab("upload"); }}
              className="flex items-center gap-1.5 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 transition-all whitespace-nowrap cursor-pointer"
            >
              <i className="ri-upload-cloud-line text-[13px]" />
              Upload Images
            </button>
            <button onClick={() => fetchAssets()} className="flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised transition-all whitespace-nowrap cursor-pointer">
              <WkIcon name="RefreshCw" size={13} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className={`flex items-center gap-0.5 ${isPickerMode ? "border-b border-wk-border px-4 pt-2" : "rounded-xl border border-wk-border bg-wk-surface p-1"}`}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
              tab === t.key
                ? isPickerMode
                  ? "border-b-2 border-wk-brand text-wk-brand rounded-none pb-[7px]"
                  : "bg-wk-bg text-wk-text shadow-sm border border-wk-border"
                : "text-wk-text-muted hover:text-wk-text"
            }`}
          >
            <i className={`${t.icon} text-[12px]`} />
            {t.label}
            {t.key === "upload" && uploadFiles.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-wk-brand px-1 text-[9px] font-black text-wk-brand-on">
                {uploadFiles.length}
              </span>
            )}
          </button>
        ))}
        {/* Spacer + count */}
        {!isPickerMode && (
          <div className="ml-auto text-[11px] text-wk-text-faint pr-1">
            {total.toLocaleString()} total
          </div>
        )}
      </div>

      {/* ── Filters (assets tab only) ── */}
      {tab === "assets" && (
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap ${isPickerMode ? "px-4 pb-2" : ""}`}>
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2 flex-1 min-w-[200px]">
            <WkIcon name="Search" size={13} className="text-wk-text-faint shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search title, slug, alt text, URL…"
              className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(0); }} className="shrink-0 text-wk-text-faint hover:text-wk-text cursor-pointer">
                <WkIcon name="X" size={12} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <select value={mediaKindFilter} onChange={(e) => { setMediaKindFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All types</option>
              <option value="image">Image</option>
              <option value="external_artist_image_postmeta">Artist photo</option>
              <option value="external_chart_entry_artwork">Chart artwork</option>
            </select>
            <select value={sourceKindFilter} onChange={(e) => { setSourceKindFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All sources</option>
              <option value="wordpress_database">WordPress</option>
              <option value="editor_upload">Uploaded</option>
              <option value="external_artist_image_postmeta">Artist postmeta</option>
              <option value="external_chart_entry_artwork">Chart artwork</option>
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="needs_review">Needs review</option>
              <option value="rejected">Rejected</option>
            </select>
            {!isPickerMode && (
              <label className="flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={missingAltOnly} onChange={(e) => { setMissingAltOnly(e.target.checked); setPage(0); }} className="rounded w-3 h-3" />
                Missing alt
              </label>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk action bar (library mode) ── */}
      {!isPickerMode && bulkSelected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-wk-brand/20 bg-wk-brand-soft px-4 py-2.5">
          <span className="text-[12px] font-bold text-wk-brand">{bulkSelected.size} selected</span>
          <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
            className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-1.5 text-[12px] text-wk-text outline-none cursor-pointer">
            <option value="set_status_active">Set Active</option>
            <option value="set_status_archived">Set Archived</option>
            <option value="set_status_needs_review">Set Needs Review</option>
          </select>
          <button onClick={handleBulkAction} disabled={bulkRunning}
            className="flex items-center gap-1 rounded-lg bg-wk-brand px-3 py-1.5 text-[11px] font-bold text-wk-brand-on hover:opacity-90 disabled:opacity-50 whitespace-nowrap cursor-pointer">
            {bulkRunning ? <><WkIcon name="Loader2" size={11} className="animate-spin" /> Running…</> : "Apply"}
          </button>
          <button onClick={() => setBulkSelected(new Set())} className="text-[11px] font-semibold text-wk-text-muted hover:text-wk-text cursor-pointer whitespace-nowrap">Clear</button>
          <button onClick={() => setBulkSelected(new Set(assets.map((a) => a.id)))} className="text-[11px] font-semibold text-wk-text-muted hover:text-wk-text cursor-pointer whitespace-nowrap">Select all</button>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className={`flex-1 ${isPickerMode ? "overflow-y-auto px-4 pb-4" : ""}`}>

        {/* ═══ Assets tab ═══ */}
        {tab === "assets" && (
          <>
            {/* Load error */}
            {loadError && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
                  <WkIcon name="AlertTriangle" size={18} />
                </div>
                <p className="text-[13px] font-bold text-wk-text">{loadError}</p>
                <button onClick={fetchAssets} className="flex items-center gap-1.5 rounded-lg bg-wk-brand px-3 py-1.5 text-[12px] font-bold text-wk-brand-on cursor-pointer">
                  <WkIcon name="RefreshCw" size={12} /> Retry
                </button>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && !loadError && (
              <div className={viewMode === "grid" ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3" : "space-y-1.5"}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className={`animate-pulse rounded-xl bg-wk-surface-raised ${viewMode === "grid" ? "aspect-square" : "h-12"}`} />
                ))}
              </div>
            )}

            {/* ── Grid view ── */}
            {!loading && !loadError && viewMode === "grid" && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {assets.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-wk-text-muted">
                    <WkIcon name="Image" size={36} className="mb-3 text-wk-text-faint" />
                    <p className="text-[13px] font-semibold">No media assets found</p>
                    <p className="text-[12px] mt-1">Try different filters or upload new images.</p>
                  </div>
                ) : assets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  const isBulked = bulkSelected.has(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        selectItem(asset.id, asset.url ?? "");
                      }}
                      className={`group relative aspect-square overflow-hidden rounded-xl border cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-wk-brand border-wk-brand" :
                        isBulked ? "ring-2 ring-wk-brand/70 border-wk-brand/70" :
                        "border-wk-border hover:border-wk-brand/40"
                      }`}
                    >
                      {/* Bulk checkbox (library mode) */}
                      {!isPickerMode && (
                        <div className="absolute top-1.5 left-1.5 z-10" onClick={(e) => { e.stopPropagation(); toggleBulk(asset.id); }}>
                          <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            isBulked ? "border-wk-brand bg-wk-brand" : "border-white/80 bg-black/30 opacity-0 group-hover:opacity-100"
                          }`}>
                            {isBulked && <WkIcon name="Check" size={10} className="text-white" />}
                          </div>
                        </div>
                      )}

                      {/* Image */}
                      {asset.url ? (
                        <img src={asset.url} alt={String(asset.metadata?.alt_text ?? asset.title ?? "")}
                          className="h-full w-full object-cover object-top" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-wk-surface-raised text-wk-text-faint">
                          <WkIcon name="Image" size={22} />
                        </div>
                      )}

                      {/* Status badge */}
                      {asset.status && asset.status !== "active" && (
                        <div className="absolute top-1.5 right-1.5">
                          <span className="inline-flex rounded-full bg-wk-warning px-1.5 py-0.5 text-[8px] font-black text-white uppercase">{asset.status}</span>
                        </div>
                      )}

                      {/* Picker selected check */}
                      {isSelected && (
                        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wk-brand shadow">
                          <WkIcon name="Check" size={11} className="text-white" />
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <p className="text-[10px] font-semibold text-white truncate">
                          {asset.title || asset.slug || asset.id.slice(0, 8)}
                        </p>
                      </div>

                      {/* Library: quick actions on hover */}
                      {!isPickerMode && (
                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); asset.url && handleCopy(asset.url); }}
                            title="Copy URL"
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70 cursor-pointer"
                          >
                            <WkIcon name={copied === asset.url ? "Check" : "Copy"} size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Table view (library mode) ── */}
            {!loading && !loadError && viewMode === "table" && !isPickerMode && (
              <div className="rounded-xl border border-wk-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint">
                      <tr>
                        <th className="px-3 py-3 w-8">
                          <input type="checkbox" checked={bulkSelected.size === assets.length && assets.length > 0}
                            onChange={(e) => e.target.checked ? setBulkSelected(new Set(assets.map((a) => a.id))) : setBulkSelected(new Set())}
                            className="rounded w-3 h-3" />
                        </th>
                        <th className="px-3 py-3 w-12">Img</th>
                        <th className="px-3 py-3">Title / Slug</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Source</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wk-border">
                      {assets.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-wk-text-muted">No assets found.</td></tr>
                      ) : assets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-wk-surface-raised/60">
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={bulkSelected.has(asset.id)} onChange={() => toggleBulk(asset.id)} className="rounded w-3 h-3" />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="h-9 w-9 overflow-hidden rounded-lg bg-wk-surface-raised cursor-pointer" onClick={() => selectItem(asset.id, asset.url ?? "")}>
                              {asset.url ? (
                                <img src={asset.url} alt="" className="h-full w-full object-cover object-top" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-wk-text-faint"><WkIcon name="Image" size={12} /></div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => selectItem(asset.id, asset.url ?? "")} className="text-left cursor-pointer hover:text-wk-brand">
                              <div className="font-semibold text-wk-text truncate max-w-[200px]">{asset.title || "(no title)"}</div>
                              <div className="text-wk-text-faint font-mono text-[10px] truncate max-w-[200px]">{asset.slug}</div>
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">{asset.media_kind ?? "—"}</span>
                          </td>
                          <td className="px-3 py-2.5 text-wk-text-muted">{asset.source_kind ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                              asset.status === "active" ? "bg-wk-success-soft text-wk-success" :
                              asset.status === "needs_review" ? "bg-wk-warning-soft text-wk-warning" :
                              "bg-wk-surface-raised text-wk-text-muted"
                            }`}>{asset.status ?? "—"}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => asset.url && handleCopy(asset.url)} title="Copy URL"
                                className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-brand cursor-pointer">
                                <WkIcon name={copied === asset.url ? "Check" : "Copy"} size={12} />
                              </button>
                              <button onClick={() => setEditingAsset(asset)} title="Edit"
                                className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-brand cursor-pointer">
                                <WkIcon name="PanelRight" size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {!loading && !loadError && totalPages > 1 && (
              <div className={`flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-4 py-2.5 ${isPickerMode ? "mt-3" : "mt-4"}`}>
                <span className="text-[11px] text-wk-text-muted">Page {page + 1} of {totalPages}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                    className="rounded-lg border border-wk-border px-2.5 py-1 text-[11px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised disabled:opacity-40 cursor-pointer whitespace-nowrap">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const pg = Math.max(0, Math.min(page - 2 + i, totalPages - 1));
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`h-7 w-7 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap ${pg === page ? "bg-wk-brand text-wk-brand-on" : "border border-wk-border text-wk-text hover:bg-wk-surface-raised"}`}>
                        {pg + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="rounded-lg border border-wk-border px-2.5 py-1 text-[11px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised disabled:opacity-40 cursor-pointer whitespace-nowrap">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ Storage tab ═══ */}
        {tab === "storage" && (
          <div className="space-y-3">
            {/* Root switcher */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted shrink-0">Folder</span>
              <div className="flex items-center rounded-lg border border-wk-border bg-wk-bg p-0.5 gap-0.5">
                {(["uploads", "wp-import"] as const).map((root) => (
                  <button key={root} onClick={() => { setStorageRoot(root); setBucketPath(root); }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      storageRoot === root ? "bg-wk-surface text-wk-text shadow-sm" : "text-wk-text-muted hover:text-wk-text"
                    }`}>
                    <i className={root === "uploads" ? "ri-upload-cloud-line text-[11px]" : "ri-wordpress-line text-[11px]"} />
                    {root === "uploads" ? "Uploads" : "WP Import"}
                  </button>
                ))}
              </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[12px] text-wk-text-muted">
              <i className="ri-folder-line text-[12px]" />
              <button onClick={() => setBucketPath(storageRoot)} className="rounded px-1.5 py-0.5 hover:bg-wk-surface-raised text-wk-brand font-semibold cursor-pointer">{storageRoot}</button>
              {bucketPath !== storageRoot && (
                <>
                  <WkIcon name="ChevronRight" size={11} />
                  <span className="font-mono text-[11px]">{bucketPath.replace(`${storageRoot}/`, "")}</span>
                </>
              )}
            </div>

            {bucketLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-wk-surface-raised" />)}
              </div>
            ) : bucketItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-wk-text-muted">
                <WkIcon name="Folder" size={32} className="mb-2 text-wk-text-faint" />
                <p className="text-[13px]">No images in this folder.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {bucketItems.map((item) => (
                  <div key={item.path}
                    onClick={() => { if (item.isFolder) { setBucketPath(item.path); } else { selectItem(null, item.publicUrl ?? ""); } }}
                    className={`group relative aspect-square overflow-hidden rounded-xl border cursor-pointer transition-all ${
                      !item.isFolder && selectedUrl === item.publicUrl
                        ? "ring-2 ring-wk-brand border-wk-brand"
                        : "border-wk-border hover:border-wk-brand/40"
                    }`}>
                    {item.isFolder ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-wk-text-muted bg-wk-surface-raised">
                        <WkIcon name="Folder" size={26} />
                        <span className="text-[10px] font-semibold truncate max-w-[90%] px-2">{item.name}</span>
                      </div>
                    ) : (
                      <>
                        <img src={item.publicUrl} alt={item.name} className="h-full w-full object-cover object-top" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <p className="text-[10px] font-semibold text-white truncate">{item.name}</p>
                        </div>
                        {selectedUrl === item.publicUrl && (
                          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wk-brand">
                            <WkIcon name="Check" size={11} className="text-white" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Storage item tip */}
            {selectedUrl && !selectedAsset && tab === "storage" && (
              <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 text-[11px] text-wk-text-muted">
                <strong className="text-wk-warning">Raw storage file</strong> — this URL has no registry metadata. For full management, use Upload to add it to the registry.
              </div>
            )}
          </div>
        )}

        {/* ═══ Upload tab ═══ */}
        {tab === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-12 px-8 transition-all ${
                isDragging ? "border-wk-brand bg-wk-brand/5" : "border-wk-border-2 hover:border-wk-brand/50 hover:bg-wk-surface"
              }`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wk-surface-raised">
                <i className="ri-upload-cloud-2-line text-[32px] text-wk-brand" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-wk-text">{isDragging ? "Drop images here" : "Drag & drop or click to upload"}</p>
                <p className="mt-1 text-[12px] text-wk-text-muted">PNG, JPG, GIF, WebP, SVG · Uploads to registry + storage</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => e.target.files && handleFilesAdded(e.target.files)} />
            </div>

            {uploadFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Upload Queue</p>
                {uploadFiles.map((file) => {
                  const status = uploadProgress[file.name] ?? "pending";
                  const uploaded = uploadedItems.find((u) => u.name === file.name);
                  return (
                    <div key={file.name}
                      onClick={() => { if (status === "done" && uploaded) selectItem(uploaded.assetId ?? null, uploaded.url); }}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                        status === "done" ? "border-wk-success/30 bg-wk-success/5 cursor-pointer" :
                        status === "error" ? "border-wk-danger/30 bg-wk-danger/5" :
                        "border-wk-border bg-wk-surface"
                      }`}>
                      <div className="shrink-0">
                        {status === "uploading" && <div className="h-5 w-5 animate-spin rounded-full border-2 border-wk-brand border-t-transparent" />}
                        {status === "done" && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-wk-success"><WkIcon name="Check" size={10} className="text-white" /></div>}
                        {status === "error" && <div className="flex h-5 w-5 items-center justify-center rounded-full bg-wk-danger"><WkIcon name="X" size={10} className="text-white" /></div>}
                        {status === "pending" && <div className="h-5 w-5 rounded-full border-2 border-wk-border-2" />}
                      </div>
                      {status === "done" && uploaded && (
                        <img src={uploaded.url} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-wk-text">{file.name}</p>
                        <p className="text-[11px] text-wk-text-muted">
                          {status === "uploading" && "Uploading…"}
                          {status === "done" && "Added to registry — click to select"}
                          {status === "error" && "Upload failed"}
                          {status === "pending" && `${(file.size / 1024).toFixed(0)} KB`}
                        </p>
                      </div>
                      {status === "done" && uploaded && selectedUrl === uploaded.url && (
                        <span className="shrink-0 text-[11px] font-bold text-wk-brand">Selected</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit modal ── */}
      {editingAsset && (
        <MediaEditModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
        />
      )}

      {/* ── Toast (library mode) ── */}
      {!isPickerMode && toast && (
        <div className={`fixed bottom-6 right-6 z-[999] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
          toast.type === "success" ? "border-wk-success/20 bg-wk-success-soft text-wk-success" : "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
        }`}>
          <WkIcon name={toast.type === "success" ? "CheckCircle2" : "XCircle"} size={16} />
          {toast.msg}
        </div>
      )}
      </div>
      {/* ── Preview panel (library mode only) ── */}
      {!isPickerMode && selectedUrl && (
        <MediaLibraryPreviewPanel
          selectedAsset={selectedAsset}
          selectedUrl={selectedUrl}
          isReplaceMode={false}
          onSelect={() => {}}
          onClose={() => {}}
          onCopy={handleCopy}
          onDelete={handleDeleteAsset}
          onAssetUpdated={handleEditSave}
          onAssetDeleted={handleEditDelete}
          onRegisterFromStorage={handleRegisterFromStorage}
          onDeleteStorage={handleDeleteStorage}
          mode="library"
        />
      )}
    </div>
  );
}