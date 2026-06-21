import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import { supabase } from "@/lib/supabase";

interface MissingImageSlot {
  uid: string;
  entityType: string;
  entitySlug: string;
  entityTitle: string | null;
  missingRole: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "resolved" | "skipped";
  /** The FK column to set on the entity record */
  fkColumn: string;
  /** The URL column to set on the entity record */
  urlColumn: string;
  /** Table to update */
  targetTable: string;
  /** Column that identifies the entity row */
  slugColumn: string;
}

interface AuditStatus {
  status: MissingImageSlot["status"];
  updatedAt: string;
}

const PAGE_SIZE = 50;
const LS_KEY = "wk_missing_images_status";

type EntityQueryDef = {
  table: string;
  fkColumn: string;
  urlColumn: string;
  slugColumn: string;
  labelColumn: string;
  entityType: string;
  missingRole: string;
  priority: MissingImageSlot["priority"];
};

const ENTITY_DEFS: EntityQueryDef[] = [
  {
    table: "registry_artists",
    fkColumn: "public_image_id",
    urlColumn: "public_image_url",
    slugColumn: "slug",
    labelColumn: "display_name",
    entityType: "artist",
    missingRole: "artist_photo",
    priority: "high",
  },
  {
    table: "registry_releases",
    fkColumn: "artwork_image_id",
    urlColumn: "artwork_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "release",
    missingRole: "artwork",
    priority: "high",
  },
  {
    table: "registry_tracks",
    fkColumn: "artwork_image_id",
    urlColumn: "artwork_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "track",
    missingRole: "artwork",
    priority: "medium",
  },
  {
    table: "wk_articles",
    fkColumn: "hero_image_id",
    urlColumn: "hero_image_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "article",
    missingRole: "hero_image",
    priority: "high",
  },
  {
    table: "registry_authors",
    fkColumn: "avatar_image_id",
    urlColumn: "avatar_url",
    slugColumn: "slug",
    labelColumn: "name",
    entityType: "author",
    missingRole: "avatar",
    priority: "low",
  },
  {
    table: "registry_authors",
    fkColumn: "cover_image_id",
    urlColumn: "cover_url",
    slugColumn: "slug",
    labelColumn: "name",
    entityType: "author",
    missingRole: "cover_photo",
    priority: "low",
  },
  {
    table: "guides",
    fkColumn: "hero_image_id",
    urlColumn: "hero_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "guide",
    missingRole: "hero_image",
    priority: "medium",
  },
  {
    table: "guide_pages",
    fkColumn: "hero_image_id",
    urlColumn: "hero_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "guide_page",
    missingRole: "hero_image",
    priority: "low",
  },
  {
    table: "registry_artist_highlights",
    fkColumn: "artwork_image_id",
    urlColumn: "artwork_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "highlight",
    missingRole: "artwork",
    priority: "low",
  },
  {
    table: "chart_entries",
    fkColumn: "artwork_image_id",
    urlColumn: "artwork_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "chart_entry",
    missingRole: "artwork",
    priority: "low",
  },
  {
    table: "wk_chart_entries_v2",
    fkColumn: "artwork_image_id",
    urlColumn: "artwork_url",
    slugColumn: "slug",
    labelColumn: "title",
    entityType: "chart_v2",
    missingRole: "artwork",
    priority: "low",
  },
];

export default function AdminMissingImagesPage() {
  const navigate = useNavigate();

  const [allItems, setAllItems] = useState<MissingImageSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // MediaPicker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<MissingImageSlot | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Audit status cache (localStorage)
  const [auditCache, setAuditCache] = useState<Record<string, AuditStatus>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Load audit cache from localStorage ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setAuditCache(JSON.parse(raw));
    } catch {
      // Corrupt cache — ignore
    }
  }, []);

  const saveAudit = useCallback((uid: string, status: MissingImageSlot["status"]) => {
    setAuditCache((prev) => {
      const next = { ...prev, [uid]: { status, updatedAt: new Date().toISOString() } };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        // localStorage full — best effort
      }
      return next;
    });
  }, []);

  // ─── Load all missing images from all entity types ───
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const allResults: MissingImageSlot[] = [];

      for (const def of ENTITY_DEFS) {
        try {
          const columns = [def.slugColumn, def.labelColumn, def.fkColumn, "id"]
            .filter((c, i, arr) => arr.indexOf(c) === i)
            .join(",");

          const { data, error } = await supabase
            .from(def.table)
            .select(columns)
            .is(def.fkColumn, null)
            .is(def.urlColumn, null)
            .limit(2000);

          if (error) {
            console.warn(`Failed to query ${def.table}:`, error.message);
            continue;
          }

          for (const row of (data ?? []) as Record<string, unknown>[]) {
            const slug = String(row[def.slugColumn] ?? "");
            const title = row[def.labelColumn] ? String(row[def.labelColumn]) : null;
            if (!slug) continue;

            const uid = `${def.entityType}:${def.missingRole}:${slug}`;
            allResults.push({
              uid,
              entityType: def.entityType,
              entitySlug: slug,
              entityTitle: title,
              missingRole: def.missingRole,
              priority: def.priority,
              status: "pending",
              fkColumn: def.fkColumn,
              urlColumn: def.urlColumn,
              targetTable: def.table,
              slugColumn: def.slugColumn,
            });
          }
        } catch {
          // Table might not exist or be inaccessible — skip
        }
      }

      setAllItems(allResults);
      setPage(0);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load missing images.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Merge audit cache into items ───
  const itemsWithStatus = allItems.map((item) => {
    const audit = auditCache[item.uid];
    return audit ? { ...item, status: audit.status } : item;
  });

  // ─── Filters ───
  const filtered = itemsWithStatus.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterType !== "all" && item.entityType !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (item.entityTitle ?? "").toLowerCase().includes(q) ||
        item.entitySlug.toLowerCase().includes(q) ||
        item.missingRole.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort: priority first, then by entity type
  const sorted = [...filtered].sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority])
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    return a.entityType.localeCompare(b.entityType);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ─── Stats ───
  const stats = {
    total: allItems.length,
    pending: itemsWithStatus.filter((i) => i.status === "pending").length,
    inProgress: itemsWithStatus.filter((i) => i.status === "in_progress").length,
    resolved: itemsWithStatus.filter((i) => i.status === "resolved").length,
    skipped: itemsWithStatus.filter((i) => i.status === "skipped").length,
  };

  // ─── Entity route helper ───
  const entityTypeRoute = (type: string) => {
    switch (type) {
      case "artist":
        return "registry/artists";
      case "release":
        return "registry/releases";
      case "track":
        return "registry/tracks";
      case "author":
        return "registry/authors";
      case "highlight":
        return "registry/artist-highlights";
      default:
        return "content/articles";
    }
  };

  // ─── Individual actions ───
  const handleMarkResolved = (uid: string) => {
    saveAudit(uid, "resolved");
    showToast("Marked as resolved");
  };

  const handleMarkSkipped = (uid: string) => {
    saveAudit(uid, "skipped");
    showToast("Marked as skipped");
  };

  const handleReopen = (uid: string) => {
    saveAudit(uid, "pending");
    showToast("Reset to pending");
  };

  const handleLinkExisting = (item: MissingImageSlot) => {
    setPickerTarget(item);
    setPickerOpen(true);
  };

  // ─── MediaPicker callback: link selected asset ───
  const handlePickerSelect = async (assetId: string | null, url: string) => {
    if (!pickerTarget || !assetId) return;

    const item = pickerTarget;

    try {
      // Update entity record with FK
      const updatePayload: Record<string, unknown> = {};
      updatePayload[item.fkColumn] = assetId;

      const { error } = await supabase
        .from(item.targetTable)
        .update(updatePayload)
        .eq(item.slugColumn, item.entitySlug);

      if (error) {
        showToast("Failed to link: " + error.message);
        return;
      }

      saveAudit(item.uid, "resolved");
      showToast("Image linked successfully!");

      // Remove from local list
      setAllItems((prev) => prev.filter((i) => i.uid !== item.uid));
    } catch (err) {
      showToast("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }

    setPickerOpen(false);
    setPickerTarget(null);
  };

  // ─── Direct upload ───
  const handleDirectUpload = useCallback(
    async (item: MissingImageSlot, files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      const folder = `${item.entityType}/${item.entitySlug}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${folder}/${Date.now()}-${safeName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("article-media")
          .upload(storagePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          showToast("Upload failed: " + uploadError.message);
          return;
        }

        const { data: urlData } = supabase.storage.from("article-media").getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        // Get dimensions
        let width = 0;
        let height = 0;
        try {
          const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => reject(new Error("Failed"));
            img.src = URL.createObjectURL(file);
          });
          width = dims.width;
          height = dims.height;
        } catch {
          // Best effort
        }

        // Create registry_media_assets row
        const { data: inserted, error: insertError } = await supabase
          .from("registry_media_assets")
          .insert({
            slug: `${item.entityType}-${item.entitySlug}-${item.missingRole}`,
            title: file.name,
            url: publicUrl,
            mime_type: file.type,
            media_kind: "image",
            status: "active",
            source_kind: "manual_upload",
            source_entity: item.entityType,
            source_record_id: item.entitySlug,
            storage_bucket: "article-media",
            storage_path: storagePath,
            metadata: {
              alt_text: item.entityTitle ?? file.name,
              file_name: file.name,
              file_size: file.size,
              width,
              height,
              role: item.missingRole,
            },
          })
          .select("id")
          .single();

        if (insertError || !inserted) {
          showToast("Failed to create media asset: " + (insertError?.message ?? "Unknown"));
          return;
        }

        // Update entity FK
        const updatePayload: Record<string, unknown> = {};
        updatePayload[item.fkColumn] = inserted.id;

        const { error: updateError } = await supabase
          .from(item.targetTable)
          .update(updatePayload)
          .eq(item.slugColumn, item.entitySlug);

        if (updateError) {
          showToast("Linked but failed to update entity: " + updateError.message);
          return;
        }

        saveAudit(item.uid, "resolved");
        showToast("Uploaded and linked!");

        // Remove from list
        setAllItems((prev) => prev.filter((i) => i.uid !== item.uid));
      } catch (err) {
        showToast("Error: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    },
    []
  );

  // ─── Bulk actions ───
  const toggleSelect = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paged.length && paged.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((i) => i.uid)));
    }
  };

  const handleBulkResolve = () => {
    selectedIds.forEach((uid) => saveAudit(uid, "resolved"));
    setSelectedIds(new Set());
    showToast(`Resolved ${selectedIds.size} items`);
  };

  const handleBulkSkip = () => {
    selectedIds.forEach((uid) => saveAudit(uid, "skipped"));
    setSelectedIds(new Set());
    showToast(`Skipped ${selectedIds.size} items`);
  };

  // ─── Entity type label helper ───
  const entityLabel = (type: string) => {
    const map: Record<string, string> = {
      artist: "Artist",
      release: "Release",
      track: "Track",
      article: "Article",
      author: "Author",
      guide: "Guide",
      guide_page: "Guide Page",
      highlight: "Highlight",
      chart_entry: "Chart Entry",
      chart_v2: "Chart V2",
    };
    return map[type] ?? type;
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-wk-brand bg-wk-brand-soft px-4 py-3 text-[13px] font-semibold text-wk-brand shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Media</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Missing Images</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {stats.total.toLocaleString()} missing images across {ENTITY_DEFS.length} entity types.
            {stats.pending} pending, {stats.resolved} resolved, {stats.skipped} skipped.
          </p>
        </div>
        <button
          onClick={() => { load(); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-all cursor-pointer whitespace-nowrap"
        >
          <WkIcon name="RefreshCw" size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total, icon: "Image", color: "text-wk-brand" },
          { label: "Pending", value: stats.pending, icon: "Clock", color: "text-amber-600" },
          { label: "In Progress", value: stats.inProgress, icon: "Loader2", color: "text-sky-600" },
          { label: "Resolved", value: stats.resolved, icon: "CheckCircle2", color: "text-emerald-600" },
          { label: "Skipped", value: stats.skipped, icon: "SkipForward", color: "text-wk-text-muted" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-wk-border bg-wk-surface p-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-wk-surface-raised ${stat.color}`}>
                <WkIcon name={stat.icon as never} size={14} />
              </span>
              <span className="text-[11px] font-semibold text-wk-text-muted">{stat.label}</span>
            </div>
            <div className="mt-1 text-[18px] font-black text-wk-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 flex-1 max-w-md">
          <WkIcon name="Search" size={14} className="text-wk-text-faint shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Search by title, slug, or role…"
            className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setPage(0); }} className="text-wk-text-faint hover:text-wk-text shrink-0">
              <WkIcon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            {ENTITY_DEFS.filter((d, i, arr) => arr.findIndex((x) => x.entityType === d.entityType) === i).map((d) => (
              <option key={d.entityType} value={d.entityType}>
                {entityLabel(d.entityType)}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
            {["all", "pending", "in_progress", "resolved", "skipped"].map((status) => (
              <button
                key={status}
                onClick={() => { setFilterStatus(status); setPage(0); }}
                className={`px-3 py-2 text-[12px] font-semibold transition-all whitespace-nowrap ${
                  filterStatus === status
                    ? "bg-wk-brand-soft text-wk-brand"
                    : "text-wk-text-muted hover:bg-wk-surface-raised"
                }`}
              >
                {status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface-raised px-4 py-2">
          <span className="text-[13px] font-semibold text-wk-text">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleBulkResolve}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="CheckCircle2" size={12} />
              Resolve
            </button>
            <button
              onClick={handleBulkSkip}
              className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="SkipForward" size={12} />
              Skip
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="rounded-md p-1 text-wk-text-muted hover:text-wk-text cursor-pointer">
              <WkIcon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="h-4 w-48 rounded bg-wk-surface-raised mb-2" />
              <div className="h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      )}

      {/* Load error */}
      {loadError && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
            <WkIcon name="AlertTriangle" size={22} />
          </div>
          <p className="text-[14px] font-bold text-wk-text">Failed to load missing images</p>
          <p className="text-[13px] text-wk-text-muted">{loadError}</p>
          <button onClick={() => load()} className="rounded-lg bg-wk-brand px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !loadError && (
        <>
          <div className="overflow-hidden rounded-xl border border-wk-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint">
                  <tr>
                    <th className="px-3 py-3 w-[40px]">
                      <button onClick={toggleAll} className="cursor-pointer flex items-center">
                        {selectedIds.size === paged.length && paged.length > 0 ? (
                          <WkIcon name="Check" size={16} />
                        ) : (
                          <WkIcon name="Square" size={16} />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3">Entity</th>
                    <th className="px-3 py-3 hidden sm:table-cell">Missing Role</th>
                    <th className="px-3 py-3 hidden md:table-cell">Type</th>
                    <th className="px-3 py-3 w-[90px]">Priority</th>
                    <th className="px-3 py-3 w-[100px]">Status</th>
                    <th className="px-3 py-3 w-[260px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wk-border">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-20 text-center text-wk-text-muted">
                        <WkIcon name="Image" size={32} className="mx-auto mb-2 text-wk-text-faint" />
                        <p className="text-[14px] font-semibold">No missing images found</p>
                        <p className="text-[12px] mt-1">All images are in place, or try adjusting your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    paged.map((item) => (
                      <tr key={item.uid} className="hover:bg-wk-surface-raised transition-colors">
                        {/* Select */}
                        <td className="px-3 py-3">
                          <button onClick={() => toggleSelect(item.uid)} className="cursor-pointer flex items-center">
                            {selectedIds.has(item.uid) ? (
                              <WkIcon name="Check" size={16} />
                            ) : (
                              <WkIcon name="Square" size={16} />
                            )}
                          </button>
                        </td>

                        {/* Entity */}
                        <td className="px-3 py-3">
                          <div className="text-[13px] font-semibold text-wk-text truncate max-w-[200px]">
                            {item.entityTitle || item.entitySlug}
                          </div>
                          <div className="text-[11px] text-wk-text-muted font-mono truncate max-w-[200px]">
                            {item.entitySlug}
                          </div>
                        </td>

                        {/* Missing Role */}
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="inline-flex items-center rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">
                            {item.missingRole.replace("_", " ")}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className="text-[11px] text-wk-text-muted">{entityLabel(item.entityType)}</span>
                        </td>

                        {/* Priority */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.priority === "high"
                                ? "bg-rose-100 text-rose-700"
                                : item.priority === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : item.status === "in_progress"
                                ? "bg-sky-100 text-sky-700"
                                : item.status === "resolved"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Navigate to entity */}
                            <button
                              onClick={() =>
                                navigate(`/admin/${entityTypeRoute(item.entityType)}/${item.entitySlug}`)
                              }
                              className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text cursor-pointer"
                              title="Edit entity"
                            >
                              <WkIcon name="Pencil" size={14} />
                            </button>

                            {item.status === "pending" && (
                              <>
                                {/* Upload (hidden file input triggered by button) */}
                                <button
                                  onClick={() => {
                                    const input = document.createElement("input");
                                    input.type = "file";
                                    input.accept = "image/*";
                                    input.onchange = (e) => {
                                      const files = (e.target as HTMLInputElement).files;
                                      handleDirectUpload(item, files);
                                    };
                                    input.click();
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-wk-brand px-2 py-1 text-[11px] font-bold text-white hover:opacity-90 cursor-pointer whitespace-nowrap"
                                >
                                  <WkIcon name="Upload" size={12} />
                                  Upload
                                </button>

                                {/* Link existing */}
                                <button
                                  onClick={() => handleLinkExisting(item)}
                                  className="inline-flex items-center gap-1 rounded-md border border-wk-brand/40 bg-wk-brand-soft px-2 py-1 text-[11px] font-bold text-wk-brand hover:bg-wk-brand-soft/80 cursor-pointer whitespace-nowrap"
                                >
                                  <WkIcon name="Link" size={12} />
                                  Link
                                </button>

                                {/* Resolve */}
                                <button
                                  onClick={() => handleMarkResolved(item.uid)}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 cursor-pointer whitespace-nowrap"
                                >
                                  <WkIcon name="Check" size={12} />
                                  OK
                                </button>

                                {/* Skip */}
                                <button
                                  onClick={() => handleMarkSkipped(item.uid)}
                                  className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised cursor-pointer whitespace-nowrap"
                                >
                                  Skip
                                </button>
                              </>
                            )}

                            {(item.status === "resolved" || item.status === "skipped") && (
                              <button
                                onClick={() => handleReopen(item.uid)}
                                className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised cursor-pointer whitespace-nowrap"
                              >
                                <WkIcon name="Undo2" size={12} />
                                Reopen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          {sorted.length > 0 && (
            <div className="text-[11px] text-wk-text-muted px-1">
              Showing {paged.length} of {sorted.length.toLocaleString()} items
              {filterStatus !== "all" && ` (filtered: ${filterStatus})`}
              {filterType !== "all" && ` (type: ${filterType})`}
              {searchQuery && ` (search: "${searchQuery}")`}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-4 py-3">
              <span className="text-[12px] text-wk-text-muted">
                Page {page + 1} of {totalPages} &middot; {sorted.length.toLocaleString()} total
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const pg = Math.max(0, Math.min(page - 2 + i, totalPages - 1));
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`h-8 w-8 rounded-md text-[12px] font-bold whitespace-nowrap cursor-pointer ${
                        pg === page
                          ? "bg-wk-brand text-white"
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
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Media Picker for linking existing assets */}
      {pickerOpen && pickerTarget && (
        <MediaPickerModal
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
            setPickerTarget(null);
          }}
          onSelect={handlePickerSelect}
          title={`Link Image: ${pickerTarget.entityTitle || pickerTarget.entitySlug}`}
        />
      )}
    </div>
  );
}