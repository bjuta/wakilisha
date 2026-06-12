import { useEffect, useState, useCallback, useRef } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

interface MediaAsset {
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
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

const PAGE_SIZE = 60;

function FieldRow({
  label,
  value,
  mono,
  long,
  copyable,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  long?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-wk-text-faint uppercase tracking-wider">{label}</span>
      <div className="flex items-start gap-1.5 group">
        <span
          className={`text-[12px] text-wk-text ${mono ? "font-mono" : ""} ${long ? "break-all" : "truncate"}`}
          title={long ? undefined : (value.length > 60 ? value : undefined)}
        >
          {value}
        </span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="shrink-0 mt-0.5 rounded p-0.5 text-wk-text-faint hover:text-wk-brand hover:bg-wk-brand-soft opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="Copy"
          >
            <i className="ri-file-copy-line text-[11px]" />
          </button>
        )}
      </div>
    </div>
  );
}

function MetadataBlock({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleKey = (k: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const entries = Object.entries(data);
  const displayEntries = expanded ? entries : entries.slice(0, 4);

  const renderValue = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  };

  const isExpandable = (value: unknown): boolean => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  return (
    <div className="space-y-1.5">
      {displayEntries.map(([key, value]) => {
        const expandable = isExpandable(value);
        const isOpen = expandedKeys.has(key);
        return (
          <div key={key} className="rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
            <div
              className={`flex items-center justify-between px-3 py-1.5 ${expandable ? "cursor-pointer hover:bg-wk-surface-raised transition-all" : ""}`}
              onClick={() => expandable && toggleKey(key)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-semibold text-wk-text-soft shrink-0">{key}</span>
                {!expandable && (
                  <span className="text-[11px] text-wk-text-muted font-mono truncate">
                    {typeof value === "string" && value.length > 80 ? value.slice(0, 80) + "…" : renderValue(value)}
                  </span>
                )}
              </div>
              {expandable && (
                <i className={`ri-arrow-down-s-line text-[12px] text-wk-text-faint shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              )}
            </div>
            {expandable && isOpen && (
              <div className="border-t border-wk-border px-3 py-2 bg-wk-bg-subtle">
                <pre className="text-[10px] text-wk-text-muted font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
      {entries.length > 4 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[11px] font-semibold text-wk-text-muted hover:text-wk-text hover:bg-wk-surface-raised transition-all cursor-pointer"
        >
          Show all {entries.length} fields…
        </button>
      )}
      {expanded && entries.length > 4 && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[11px] font-semibold text-wk-text-muted hover:text-wk-text hover:bg-wk-surface-raised transition-all cursor-pointer"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export default function AdminMediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [mediaKindFilter, setMediaKindFilter] = useState("all");
  const [sourceKindFilter, setSourceKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [missingAltOnly, setMissingAltOnly] = useState(false);

  const [page, setPage] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [editingAlt, setEditingAlt] = useState("");
  const [savingAlt, setSavingAlt] = useState(false);
  const [editingStatus, setEditingStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("set_status_active");
  const [bulkRunning, setBulkRunning] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAssets = useCallback(async (opts?: {
    searchQ?: string;
    kind?: string;
    source?: string;
    stat?: string;
    missingAlt?: boolean;
    pg?: number;
  }) => {
    setLoading(true);
    setLoadError(null);
    try {
      const sq = opts?.searchQ ?? search;
      const kind = opts?.kind ?? mediaKindFilter;
      const src = opts?.source ?? sourceKindFilter;
      const stat = opts?.stat ?? statusFilter;
      const noAlt = opts?.missingAlt ?? missingAltOnly;
      const pg = opts?.pg ?? page;

      let query = supabase
        .from("registry_media_assets")
        .select("id, slug, title, url, mime_type, media_kind, status, source_kind, source_entity, source_record_id, source_staging_record_id, metadata, created_at, updated_at", { count: "exact" });

      if (sq) {
        query = query.or(`title.ilike.%${sq}%,slug.ilike.%${sq}%,url.ilike.%${sq}%,source_record_id.ilike.%${sq}%`);
      }
      if (kind !== "all") query = query.eq("media_kind", kind);
      if (src !== "all") query = query.eq("source_kind", src);
      if (stat !== "all") query = query.eq("status", stat);
      if (noAlt) query = query.or("metadata.is.null,metadata->>alt_text.is.null");

      query = query
        .order("created_at", { ascending: false })
        .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      setAssets((data ?? []) as MediaAsset[]);
      setTotal(count ?? 0);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load media assets.");
    } finally {
      setLoading(false);
    }
  }, [search, mediaKindFilter, sourceKindFilter, statusFilter, missingAltOnly, page]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(0);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  };

  const handleFilterChange = (type: string, value: string) => {
    setPage(0);
    if (type === "kind") setMediaKindFilter(value);
    if (type === "source") setSourceKindFilter(value);
    if (type === "status") setStatusFilter(value);
  };

  const openDrawer = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setEditingAlt(
      typeof asset.metadata?.alt_text === "string" ? asset.metadata.alt_text : (asset.title ?? ""),
    );
    setEditingStatus(asset.status ?? "active");
  };

  const handleSaveAlt = async () => {
    if (!selectedAsset) return;
    setSavingAlt(true);
    try {
      const newMeta = { ...(selectedAsset.metadata ?? {}), alt_text: editingAlt };
      const { error } = await supabase
        .from("registry_media_assets")
        .update({ metadata: newMeta, updated_at: new Date().toISOString() })
        .eq("id", selectedAsset.id);
      if (error) throw error;
      setSelectedAsset((prev) => prev ? { ...prev, metadata: newMeta } : prev);
      setAssets((prev) => prev.map((a) => a.id === selectedAsset.id ? { ...a, metadata: newMeta } : a));
      showToast("success", "Alt text saved.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingAlt(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!selectedAsset) return;
    setSavingStatus(true);
    try {
      const { error } = await supabase
        .from("registry_media_assets")
        .update({ status: editingStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedAsset.id);
      if (error) throw error;
      setSelectedAsset((prev) => prev ? { ...prev, status: editingStatus } : prev);
      setAssets((prev) => prev.map((a) => a.id === selectedAsset.id ? { ...a, status: editingStatus } : a));
      showToast("success", "Status updated.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("error", "Failed to copy URL.");
    }
  };

  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setBulkSelected(new Set(assets.map((a) => a.id)));
  };

  const clearBulk = () => setBulkSelected(new Set());

  const handleBulkAction = async () => {
    if (bulkSelected.size === 0) return;
    setBulkRunning(true);
    try {
      const ids = Array.from(bulkSelected);
      if (bulkAction.startsWith("set_status_")) {
        const newStatus = bulkAction.replace("set_status_", "");
        const { error } = await supabase
          .from("registry_media_assets")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        showToast("success", `Set ${ids.length} assets to ${newStatus}.`);
      }
      clearBulk();
      fetchAssets();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkRunning(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Media</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Media Library</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {total.toLocaleString()} assets in registry_media_assets — real data, no mock entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-wk-border bg-wk-bg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${viewMode === "grid" ? "bg-wk-surface text-wk-brand" : "text-wk-text-muted hover:text-wk-text"}`}
            >
              <WkIcon name="LayoutGrid" size={14} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${viewMode === "table" ? "bg-wk-surface text-wk-brand" : "text-wk-text-muted hover:text-wk-text"}`}
            >
              <WkIcon name="List" size={14} />
            </button>
          </div>
          <button onClick={() => fetchAssets()} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="RefreshCw" size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2 flex-1 min-w-[200px]">
            <WkIcon name="Search" size={14} className="text-wk-text-faint shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by title, slug, URL, or source ID…"
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => handleSearch("")} className="shrink-0 text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={mediaKindFilter}
              onChange={(e) => handleFilterChange("kind", e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All types</option>
              <option value="image">Image</option>
              <option value="external_artist_image_postmeta">Artist photo (external)</option>
              <option value="external_chart_entry_artwork">Chart artwork (external)</option>
            </select>
            <select
              value={sourceKindFilter}
              onChange={(e) => handleFilterChange("source", e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All sources</option>
              <option value="wordpress_database">WordPress</option>
              <option value="external_artist_image_postmeta">Artist postmeta</option>
              <option value="external_chart_entry_artwork">Chart artwork</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="needs_review">Needs review</option>
              <option value="rejected">Rejected</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={missingAltOnly}
                onChange={(e) => {
                  setMissingAltOnly(e.target.checked);
                  setPage(0);
                }}
                className="rounded"
              />
              Missing alt text
            </label>
          </div>
        </div>
      </WkSurface>

      {/* Bulk actions bar */}
      {bulkSelected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-wk-brand/20 bg-wk-brand-soft px-4 py-3">
          <span className="text-[13px] font-bold text-wk-brand">{bulkSelected.size} selected</span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text outline-none cursor-pointer"
          >
            <option value="set_status_active">Set status: Active</option>
            <option value="set_status_archived">Set status: Archived</option>
            <option value="set_status_needs_review">Set status: Needs review</option>
          </select>
          <button
            onClick={handleBulkAction}
            disabled={bulkRunning}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            {bulkRunning ? <><WkIcon name="Loader2" size={13} className="animate-spin inline mr-1" /> Running…</> : "Apply"}
          </button>
          <button onClick={selectAll} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Select all</button>
          <button onClick={clearBulk} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Clear</button>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
            <WkIcon name="AlertTriangle" size={22} />
          </div>
          <p className="text-[14px] font-bold text-wk-text">Failed to load media assets</p>
          <p className="text-[13px] text-wk-text-muted">{loadError}</p>
          <button onClick={() => fetchAssets()} className="wk-button wk-button-primary wk-button-sm">
            <WkIcon name="RefreshCw" size={14} /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !loadError && (
        <div className={viewMode === "grid" ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3" : "space-y-2"}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className={`animate-pulse rounded-xl bg-wk-surface-raised ${viewMode === "grid" ? "aspect-square" : "h-14"}`} />
          ))}
        </div>
      )}

      {/* Grid view */}
      {!loading && !loadError && viewMode === "grid" && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {assets.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-wk-text-muted">
              <WkIcon name="Image" size={40} className="mb-3 text-wk-text-faint" />
              <p className="text-[14px] font-semibold">No media assets found</p>
              <p className="text-[12px] mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            assets.map((asset) => (
              <div
                key={asset.id}
                className={`group relative aspect-square overflow-hidden rounded-xl border cursor-pointer transition-all ${
                  bulkSelected.has(asset.id)
                    ? "ring-2 ring-wk-brand border-wk-brand"
                    : "border-wk-border hover:border-wk-border-2"
                }`}
                onClick={() => openDrawer(asset)}
              >
                {/* Bulk select checkbox */}
                <div
                  className="absolute top-1.5 left-1.5 z-10"
                  onClick={(e) => { e.stopPropagation(); toggleBulk(asset.id); }}
                >
                  <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    bulkSelected.has(asset.id)
                      ? "border-wk-brand bg-wk-brand"
                      : "border-white/80 bg-black/30 opacity-0 group-hover:opacity-100"
                  }`}>
                    {bulkSelected.has(asset.id) && <WkIcon name="Check" size={11} className="text-white" />}
                  </div>
                </div>

                {asset.url ? (
                  <img
                    src={asset.url}
                    alt={String(asset.metadata?.alt_text ?? asset.title ?? "")}
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-wk-surface-raised text-wk-text-faint">
                    <WkIcon name="Image" size={24} />
                  </div>
                )}

                {/* Status badge */}
                {asset.status && asset.status !== "active" && (
                  <div className="absolute top-1.5 right-1.5">
                    <span className="inline-flex rounded-full bg-wk-warning px-1.5 py-0.5 text-[8px] font-black text-white uppercase">
                      {asset.status}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <p className="text-[10px] font-semibold text-white truncate">
                    {asset.title || asset.slug || asset.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Table view */}
      {!loading && !loadError && viewMode === "table" && (
        <WkSurface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={bulkSelected.size === assets.length && assets.length > 0}
                      onChange={(e) => e.target.checked ? selectAll() : clearBulk()}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-3 w-14">Image</th>
                  <th className="px-3 py-3">Title / Slug</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Record ID</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wk-border">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-wk-text-muted">
                      No media assets found.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-wk-surface-raised">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(asset.id)}
                          onChange={() => toggleBulk(asset.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => openDrawer(asset)} className="cursor-pointer">
                          <div className="h-10 w-10 overflow-hidden rounded-lg bg-wk-surface-raised">
                            {asset.url ? (
                              <img
                                src={asset.url}
                                alt={String(asset.metadata?.alt_text ?? "")}
                                className="h-full w-full object-cover object-top"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                                <WkIcon name="Image" size={14} />
                              </div>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => openDrawer(asset)} className="text-left cursor-pointer hover:text-wk-brand">
                          <div className="font-semibold text-wk-text truncate max-w-[200px]">
                            {asset.title || "(no title)"}
                          </div>
                          <div className="text-wk-text-faint font-mono text-[10px] truncate max-w-[200px]">
                            {asset.slug}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">
                          {asset.media_kind ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-wk-text-muted">
                        {asset.source_kind ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          asset.status === "active"
                            ? "bg-wk-success-soft text-wk-success"
                            : asset.status === "needs_review"
                            ? "bg-wk-warning-soft text-wk-warning"
                            : "bg-wk-surface-raised text-wk-text-muted"
                        }`}>
                          {asset.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-wk-text-faint text-[10px]">
                        {asset.source_record_id?.slice(0, 12) ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => asset.url && handleCopy(asset.url)}
                            className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-brand cursor-pointer"
                            title="Copy URL"
                          >
                            <WkIcon name={copied ? "Check" : "Copy"} size={13} />
                          </button>
                          <button
                            onClick={() => openDrawer(asset)}
                            className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-brand cursor-pointer"
                            title="Open drawer"
                          >
                            <WkIcon name="PanelRight" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </WkSurface>
      )}

      {/* Pagination */}
      {!loading && !loadError && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-4 py-3">
          <span className="text-[12px] text-wk-text-muted">
            Page {page + 1} of {totalPages} · {total.toLocaleString()} total
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap disabled:opacity-50"
            >
              Previous
            </button>
            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pg = Math.max(0, Math.min(page - 2 + i, totalPages - 1));
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`h-8 w-8 rounded-md text-[12px] font-bold whitespace-nowrap ${
                    pg === page
                      ? "bg-wk-brand text-wk-brand-on"
                      : "border border-wk-border text-wk-text hover:bg-wk-surface-raised"
                  }`}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Preview / Edit Modal */}
      {selectedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="relative flex h-[80vh] w-full max-w-[1280px] flex-col rounded-2xl border border-wk-border bg-wk-bg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 shrink-0 border-b border-wk-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-text-muted shrink-0">
                  <i className="ri-image-line text-[14px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-wk-text truncate max-w-[400px]">
                    {selectedAsset.title || selectedAsset.slug || selectedAsset.id.slice(0, 12)}
                  </p>
                  <p className="text-[11px] text-wk-text-muted font-mono truncate max-w-[400px]">
                    {selectedAsset.slug || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedAsset.url && (
                  <>
                    <button
                      onClick={() => { selectedAsset.url && handleCopy(selectedAsset.url); }}
                      className="flex items-center gap-1.5 rounded-lg border border-wk-border px-3 py-1.5 text-[11px] font-semibold text-wk-text-soft hover:text-wk-text hover:border-wk-border-2 hover:bg-wk-surface-raised transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className={copied ? "ri-check-line text-[12px]" : "ri-file-copy-line text-[12px]"} />
                      {copied ? "Copied" : "Copy URL"}
                    </button>
                    <a
                      href={selectedAsset.url}
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
                  onClick={() => setSelectedAsset(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:text-wk-text hover:bg-wk-surface-raised transition-all cursor-pointer"
                >
                  <i className="ri-close-line text-[18px]" />
                </button>
              </div>
            </div>

            {/* Body: split layout — image left (2/3), details right (1/3) */}
            <div className="flex-1 flex min-h-0">
              {/* Left: image preview — fills full height, image is top-aligned */}
              <div className="flex-[2] min-w-0 flex items-start bg-wk-surface-raised p-4">
                {selectedAsset.url ? (
                  <img
                    src={selectedAsset.url}
                    alt={String(selectedAsset.metadata?.alt_text ?? selectedAsset.title ?? "")}
                    className="h-full w-full object-contain rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-wk-text-faint">
                    <i className="ri-image-line text-[56px]" />
                    <p className="text-[13px] font-medium">No preview available</p>
                  </div>
                )}
              </div>

              {/* Right: details panel — fills full height, scrolls independently */}
              <div className="flex-[1] min-w-0 border-l border-wk-border flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <div className="p-5 space-y-5 pb-4">

                    {/* Section: Editable controls */}
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">Quick Actions</h4>
                      <div className="space-y-3">
                        {/* Alt text */}
                        <div>
                          <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">Alt Text</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingAlt}
                              onChange={(e) => setEditingAlt(e.target.value)}
                              placeholder="Describe the image for accessibility…"
                              className="flex-1 rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-brand/50 focus:ring-1 focus:ring-wk-brand/20 transition-all"
                            />
                            <button
                              onClick={handleSaveAlt}
                              disabled={savingAlt}
                              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-wk-brand px-3 py-1.5 text-[11px] font-bold text-wk-brand-on hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
                            >
                              {savingAlt ? (
                                <><i className="ri-loader-2-line text-[12px] animate-spin" /> Saving</>
                              ) : (
                                "Save"
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <label className="block text-[11px] font-semibold text-wk-text-soft mb-1.5">Status</label>
                          <div className="flex gap-2">
                            <select
                              value={editingStatus}
                              onChange={(e) => setEditingStatus(e.target.value)}
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
                              {savingStatus ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Section: Identification */}
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">Identification</h4>
                      <div className="space-y-2">
                        <FieldRow label="ID" value={selectedAsset.id} mono long />
                        <FieldRow label="Slug" value={selectedAsset.slug || "—"} mono />
                        <FieldRow label="Title" value={selectedAsset.title || "—"} />
                      </div>
                    </section>

                    {/* Section: File Info */}
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">File</h4>
                      <div className="space-y-2">
                        <FieldRow label="URL" value={selectedAsset.url || "—"} mono long copyable onCopy={() => { selectedAsset.url && handleCopy(selectedAsset.url); }} />
                        <FieldRow label="MIME Type" value={selectedAsset.mime_type || "—"} mono />
                        <FieldRow label="Media Kind" value={selectedAsset.media_kind || "—"} />
                      </div>
                    </section>

                    {/* Section: Source */}
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">Source</h4>
                      <div className="space-y-2">
                        <FieldRow label="Source Kind" value={selectedAsset.source_kind || "—"} />
                        <FieldRow label="Source Entity" value={selectedAsset.source_entity || "—"} mono />
                        <FieldRow label="Source Record ID" value={selectedAsset.source_record_id || "—"} mono />
                        {selectedAsset.source_staging_record_id && (
                          <FieldRow label="Staging Record ID" value={selectedAsset.source_staging_record_id} mono />
                        )}
                      </div>
                    </section>

                    {/* Section: Timestamps */}
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">Timestamps</h4>
                      <div className="space-y-2">
                        <FieldRow
                          label="Created"
                          value={selectedAsset.created_at
                            ? new Date(selectedAsset.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                            : "—"}
                        />
                        <FieldRow
                          label="Updated"
                          value={selectedAsset.updated_at
                            ? new Date(selectedAsset.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                            : "—"}
                        />
                      </div>
                    </section>

                    {/* Section: Metadata */}
                    {selectedAsset.metadata && Object.keys(selectedAsset.metadata).length > 0 && (
                      <section>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint mb-3">
                          Metadata
                          <span className="ml-2 text-wk-text-faint font-normal normal-case tracking-normal">
                            ({Object.keys(selectedAsset.metadata).length} fields)
                          </span>
                        </h4>
                        <MetadataBlock data={selectedAsset.metadata} />
                      </section>
                    )}

                  </div>
                </div>


              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[999] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg ${
          toast.type === "success"
            ? "border-wk-success/20 bg-wk-success-soft text-wk-success"
            : "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
        }`}>
          <WkIcon name={toast.type === "success" ? "CheckCircle2" : "XCircle"} size={16} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}