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
import { mediaService, type MediaAsset, type MediaFolder } from "@/services/mediaService";
import { MediaEditModal } from "@/components/admin/media/MediaEditModal";
import { MediaLibraryPreviewPanel } from "@/components/admin/media/MediaLibraryPreviewPanel";

// ─── Types ───────────────────────────────────────────────────

type Tab = "assets" | "upload" | "audit";

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
const ACCEPTED_UPLOAD_TYPES = "image/*,application/pdf,.pdf";

function inferUploadFileKind(file: File): "image" | "document" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "document";
  return "other";
}

function isSupportedUploadFile(file: File): boolean {
  return inferUploadFileKind(file) !== "other";
}

function assetFileKind(asset: MediaAsset): string {
  return asset.file_kind || (asset.mime_type === "application/pdf" ? "document" : asset.media_kind || "other");
}

function isImageAsset(asset: MediaAsset): boolean {
  return asset.mime_type?.startsWith("image/") === true || assetFileKind(asset) === "image";
}

function fileBadge(asset: MediaAsset): string {
  const ext = asset.file_extension || asset.original_filename?.split(".").pop() || asset.mime_type?.split("/").pop() || "file";
  return ext.toUpperCase();
}

function fileIconClass(asset: MediaAsset): string {
  return assetFileKind(asset) === "document" ? "ri-file-pdf-2-line" : "ri-file-line";
}

function assetPurposeForFolder(folder: MediaFolder | null, fileKind: "image" | "document" | "other"): string {
  if (folder?.purpose === "downloads") return "downloadable";
  if (folder?.purpose === "press_kits") return "press_kit";
  if (folder?.purpose === "brand_assets") return "brand_asset";
  if (fileKind === "document") return "downloadable";
  return "general";
}

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
  const [fileKindFilter, setFileKindFilter] = useState("all");
  const [assetPurposeFilter, setAssetPurposeFilter] = useState("all");
  const [folderIdFilter, setFolderIdFilter] = useState("all");
  const [rightsStatusFilter, setRightsStatusFilter] = useState("all");
  const [sourceKindFilter, setSourceKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [missingAltOnly, setMissingAltOnly] = useState(false);
  const [uploadedFrom, setUploadedFrom] = useState("");
  const [uploadedTo, setUploadedTo] = useState("");
  const [contentFrom, setContentFrom] = useState("");
  const [contentTo, setContentTo] = useState("");
  const [folders, setFolders] = useState<MediaFolder[]>([]);

  // ── Selection (picker mode)
  const [selectedUrl, setSelectedUrl] = useState(currentUrl ?? "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // ── Bulk actions (library mode)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("set_status_active");
  const [bulkRunning, setBulkRunning] = useState(false);

  // ── Edit modal
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);


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
        fileKind: fileKindFilter,
        assetPurpose: assetPurposeFilter,
        folderId: folderIdFilter,
        rightsStatus: rightsStatusFilter,
        sourceKind: sourceKindFilter,
        status: statusFilter,
        missingAltOnly,
        uploadedFrom,
        uploadedTo,
        contentFrom,
        contentTo,
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
  }, [search, mediaKindFilter, fileKindFilter, assetPurposeFilter, folderIdFilter, rightsStatusFilter, sourceKindFilter, statusFilter, missingAltOnly, uploadedFrom, uploadedTo, contentFrom, contentTo, page, refreshKey]);

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


  // ── Upload
  const uploadFile = useCallback(async (file: File) => {
    setUploadProgress((p) => ({ ...p, [file.name]: "uploading" }));
    try {
      const fileKind = inferUploadFileKind(file);
      const label = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const activeFolder = folderIdFilter !== "all" && folderIdFilter !== "none"
        ? folders.find((folder) => folder.id === folderIdFilter) ?? null
        : null;
      const folderPath = activeFolder?.path
        ? `uploads/${activeFolder.path}`
        : fileKind === "document" ? "uploads/downloads" : "uploads";
      const asset = await mediaService.upload(file, {
        folder: folderPath,
        folderId: activeFolder?.id ?? null,
        sourceKind: "editor_upload",
        sourceEntity: "admin_upload",
        altText: fileKind === "image" ? label : undefined,
        fileKind,
        assetPurpose: assetPurposeForFolder(activeFolder, fileKind),
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
  }, [fetchAssets, selectItem, folderIdFilter, folders]);

  const handleFilesAdded = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    const arr = incoming.filter(isSupportedUploadFile);
    const rejected = incoming.length - arr.length;

    if (rejected > 0) {
      showToast("error", `${rejected} unsupported file${rejected === 1 ? "" : "s"} skipped. Use images or PDFs.`);
    }

    if (arr.length === 0) return;

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


  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Tabs
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "assets", label: "Media Assets", icon: "ri-database-2-line" },
    { key: "upload", label: "Upload", icon: "ri-upload-cloud-line" },
    { key: "audit", label: "Audit", icon: "ri-shield-check-line" },
  ];

  const selectedAsset = selectedAssetId ? assets.find((a) => a.id === selectedAssetId) ?? null : null;
  const hasActiveFilters =
    search ||
    mediaKindFilter !== "all" ||
    fileKindFilter !== "all" ||
    assetPurposeFilter !== "all" ||
    folderIdFilter !== "all" ||
    rightsStatusFilter !== "all" ||
    sourceKindFilter !== "all" ||
    statusFilter !== "all" ||
    missingAltOnly ||
    uploadedFrom ||
    uploadedTo ||
    contentFrom ||
    contentTo;

  const clearFilters = () => {
    setSearch("");
    setMediaKindFilter("all");
    setFileKindFilter("all");
    setAssetPurposeFilter("all");
    setFolderIdFilter("all");
    setRightsStatusFilter("all");
    setSourceKindFilter("all");
    setStatusFilter("all");
    setMissingAltOnly(false);
    setUploadedFrom("");
    setUploadedTo("");
    setContentFrom("");
    setContentTo("");
    setPage(0);
  };

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
              {total.toLocaleString()} managed assets · Lightsail-backed media registry
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
              Upload Files
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
        <div className={`space-y-2 ${isPickerMode ? "px-4 pb-2" : ""}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
            <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2 flex-1 min-w-[220px]">
              <WkIcon name="Search" size={13} className="text-wk-text-faint shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search title, file name, slug, URL…"
                className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(0); }} className="shrink-0 text-wk-text-faint hover:text-wk-text cursor-pointer">
                  <WkIcon name="X" size={12} />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] font-semibold text-wk-text-soft hover:bg-wk-surface-raised cursor-pointer whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <select value={folderIdFilter} onChange={(e) => { setFolderIdFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All folders</option>
              <option value="none">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
            <select value={fileKindFilter} onChange={(e) => { setFileKindFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All file kinds</option>
              <option value="image">Images</option>
              <option value="document">Documents</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="archive">Archives</option>
              <option value="other">Other</option>
            </select>
            <select value={assetPurposeFilter} onChange={(e) => { setAssetPurposeFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All purposes</option>
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
            <select value={mediaKindFilter} onChange={(e) => { setMediaKindFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All legacy types</option>
              <option value="image">Legacy image</option>
              <option value="document">Legacy document</option>
              <option value="external_artist_image_postmeta">Artist postmeta</option>
              <option value="external_chart_entry_artwork">Chart artwork</option>
            </select>
            <select value={rightsStatusFilter} onChange={(e) => { setRightsStatusFilter(e.target.value); setPage(0); }}
              className="rounded-lg border border-wk-border bg-wk-surface px-2.5 py-2 text-[12px] text-wk-text outline-none cursor-pointer">
              <option value="all">All rights</option>
              <option value="unknown">Unknown rights</option>
              <option value="owned">Owned</option>
              <option value="licensed">Licensed</option>
              <option value="public_domain">Public domain</option>
              <option value="fair_use">Fair use</option>
              <option value="needs_clearance">Needs clearance</option>
              <option value="restricted">Restricted</option>
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

          {!isPickerMode && (
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-wk-border bg-wk-surface/60 p-2">
              <label className="flex items-center gap-1.5 text-[11px] text-wk-text-muted">
                Uploaded from
                <input type="date" value={uploadedFrom} onChange={(e) => { setUploadedFrom(e.target.value); setPage(0); }}
                  className="rounded-lg border border-wk-border bg-wk-bg px-2 py-1 text-[11px] text-wk-text outline-none" />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-wk-text-muted">
                to
                <input type="date" value={uploadedTo} onChange={(e) => { setUploadedTo(e.target.value); setPage(0); }}
                  className="rounded-lg border border-wk-border bg-wk-bg px-2 py-1 text-[11px] text-wk-text outline-none" />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-wk-text-muted">
                Content from
                <input type="date" value={contentFrom} onChange={(e) => { setContentFrom(e.target.value); setPage(0); }}
                  className="rounded-lg border border-wk-border bg-wk-bg px-2 py-1 text-[11px] text-wk-text outline-none" />
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-wk-text-muted">
                to
                <input type="date" value={contentTo} onChange={(e) => { setContentTo(e.target.value); setPage(0); }}
                  className="rounded-lg border border-wk-border bg-wk-bg px-2 py-1 text-[11px] text-wk-text outline-none" />
              </label>
            </div>
          )}
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
                    <p className="text-[12px] mt-1">Try different filters or upload new files.</p>
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

                      {/* File preview */}
                      {asset.url && isImageAsset(asset) ? (
                        <img src={asset.url} alt={String(asset.metadata?.alt_text ?? asset.title ?? "")}
                          className="h-full w-full object-cover object-top" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-wk-surface-raised text-wk-text-faint">
                          <i className={`${fileIconClass(asset)} text-[24px]`} />
                          <span className="text-[9px] font-black uppercase tracking-wider">{fileBadge(asset)}</span>
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
                        <th className="px-3 py-3 w-12">File</th>
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
                              {asset.url && isImageAsset(asset) ? (
                                <img src={asset.url} alt="" className="h-full w-full object-cover object-top" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-wk-text-faint"><i className={`${fileIconClass(asset)} text-[16px]`} /></div>
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
                            <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">{asset.file_kind ?? asset.media_kind ?? "—"}</span>
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

        {/* ═══ Audit tab ═══ */}
        {tab === "audit" && (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">File origin</p>
              <p className="mt-1 text-[14px] font-black text-wk-text">Lightsail</p>
              <p className="mt-1 text-[11px] text-wk-text-muted">All managed files should resolve from media.wakilisha.africa.</p>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Registry</p>
              <p className="mt-1 text-[14px] font-black text-wk-text">registry_media_assets</p>
              <p className="mt-1 text-[11px] text-wk-text-muted">This table is the auditable media library.</p>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">Legacy storage</p>
              <p className="mt-1 text-[14px] font-black text-wk-success">Retired</p>
              <p className="mt-1 text-[11px] text-wk-text-muted">Supabase Storage is no longer a browsing or upload surface.</p>
            </div>
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
                <p className="text-[15px] font-bold text-wk-text">{isDragging ? "Drop files here" : "Drag & drop or click to upload"}</p>
                <p className="mt-1 text-[12px] text-wk-text-muted">PNG, JPG, GIF, WebP, SVG, PDF · Uploads to Lightsail + media registry</p>
              </div>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_UPLOAD_TYPES} multiple className="hidden"
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
                        file.type.startsWith("image/") ? (
                          <img src={uploaded.url} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-text-faint">
                            <i className="ri-file-pdf-2-line text-[17px]" />
                          </div>
                        )
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
          mode="library"
        />
      )}
    </div>
  );
}