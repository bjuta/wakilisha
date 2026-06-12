import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface MissingImage {
  id: string;
  entity_type: string;
  entity_slug: string;
  title: string | null;
  missing_role: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "resolved" | "skipped";
}

interface ArtistRow {
  slug: string;
  title: string;
  artist_type: string;
}

interface ArticleRow {
  slug: string;
  title: string;
}

const CMS_BUCKET = "cms-media";

export default function AdminMissingImagesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MissingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<MissingImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: dbItems } = await supabase
      .from("registry_artists")
      .select("slug, display_name as title, artist_type")
      .is("public_image_url", null)
      .limit(50);

    const { data: articles } = await supabase
      .from("wk_articles")
      .select("slug, title")
      .not("wp_status", "eq", "publish")
      .limit(50);

    const mapped: MissingImage[] = [
      ...(dbItems ?? []).map((a: ArtistRow) => ({
        id: `artist-${a.slug}`,
        entity_type: "artist" as const,
        entity_slug: a.slug,
        title: a.title,
        missing_role: "artist_photo",
        priority: "high" as const,
        status: "pending" as const,
      })),
      ...(articles ?? []).map((a: ArticleRow) => ({
        id: `article-${a.slug}`,
        entity_type: "article" as const,
        entity_slug: a.slug,
        title: a.title,
        missing_role: "hero_image",
        priority: "medium" as const,
        status: "pending" as const,
      })),
    ];

    setItems(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterType !== "all" && item.entity_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (item.title || "").toLowerCase().includes(q) ||
        item.entity_slug.toLowerCase().includes(q) ||
        item.missing_role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    resolved: items.filter((i) => i.status === "resolved").length,
    skipped: items.filter((i) => i.status === "skipped").length,
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleBulkResolve = () => {
    setItems((prev) =>
      prev.map((item) =>
        selectedIds.has(item.id) ? { ...item, status: "resolved" as const } : item
      )
    );
    setSelectedIds(new Set());
    setToast(`Resolved ${selectedIds.size} items`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleBulkSkip = () => {
    setItems((prev) =>
      prev.map((item) =>
        selectedIds.has(item.id) ? { ...item, status: "skipped" as const } : item
      )
    );
    setSelectedIds(new Set());
    setToast(`Skipped ${selectedIds.size} items`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleResolve = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "resolved" as const } : item)));
    setToast("Image marked as resolved");
    setTimeout(() => setToast(null), 3000);
  };

  const handleSkip = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "skipped" as const } : item)));
    setToast("Image marked as skipped");
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !uploadTarget) return;
      setUploading(true);

      const file = files[0];
      const path = `${uploadTarget.entity_type}/${uploadTarget.entity_slug}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage
        .from(CMS_BUCKET)
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setToast("Upload failed: " + uploadError.message);
        setUploading(false);
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const { data: publicData } = supabase.storage.from(CMS_BUCKET).getPublicUrl(path);
      const publicUrl = publicData.publicUrl;

      // Update entity record
      if (uploadTarget.entity_type === "artist") {
        await supabase.from("registry_artists").update({ public_image_url: publicUrl }).eq("slug", uploadTarget.entity_slug);
      } else if (uploadTarget.entity_type === "article") {
        await supabase.from("wk_articles").update({ hero_image_url: publicUrl }).eq("slug", uploadTarget.entity_slug);
      }

      // Create media asset record
      const mediaSlug = `${uploadTarget.entity_type}-${uploadTarget.entity_slug}-${uploadTarget.missing_role}`;
      const { error: insertError } = await supabase.from("registry_media_assets").insert({
        slug: mediaSlug,
        title: uploadTarget.title,
        url: publicUrl,
        media_kind: "image",
        status: "active",
        source_kind: "manual_upload",
        source_entity: uploadTarget.entity_type,
        source_record_id: uploadTarget.entity_slug,
        metadata: { role: uploadTarget.missing_role },
      });

      if (insertError) {
        console.error("Insert error:", insertError);
      }

      setItems((prev) => prev.map((item) => (item.id === uploadTarget.id ? { ...item, status: "resolved" as const } : item)));
      setToast("Image uploaded and linked successfully");
      setUploading(false);
      setShowUpload(false);
      setUploadTarget(null);
      setTimeout(() => setToast(null), 3000);
    },
    [uploadTarget]
  );

  const entityTypeRoute = (type: string) => {
    switch (type) {
      case "artist":
        return "registry/artists";
      case "track":
        return "registry/tracks";
      case "release":
        return "registry/releases";
      case "label":
        return "registry/labels";
      case "genre":
        return "registry/genres";
      default:
        return "content/articles";
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-wk-brand bg-wk-brand-soft px-4 py-3 text-[13px] font-semibold text-wk-brand shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Media</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Missing Images</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {stats.pending} pending, {stats.in_progress} in progress, {stats.resolved} resolved.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total, icon: "Image", color: "text-wk-brand" },
          { label: "Pending", value: stats.pending, icon: "Clock", color: "text-amber-600" },
          { label: "In Progress", value: stats.in_progress, icon: "Loader2", color: "text-sky-600" },
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 flex-1 max-w-md">
          <WkIcon name="Search" size={14} className="text-wk-text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search missing images..."
            className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-wk-text-faint hover:text-wk-text">
              <WkIcon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text outline-none"
          >
            <option value="all">All Types</option>
            <option value="artist">Artist</option>
            <option value="track">Track</option>
            <option value="release">Release</option>
            <option value="article">Article</option>
            <option value="label">Label</option>
            <option value="genre">Genre</option>
          </select>
          <div className="flex items-center rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
            {["all", "pending", "in_progress", "resolved", "skipped"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 text-[12px] font-semibold transition-all ${
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

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface-raised px-4 py-2">
          <span className="text-[13px] font-semibold text-wk-text">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleBulkResolve} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-600">
              <WkIcon name="CheckCircle2" size={12} />
              Resolve
            </button>
            <button onClick={handleBulkSkip} className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface">
              <WkIcon name="SkipForward" size={12} />
              Skip
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="rounded-md p-1 text-wk-text-muted hover:text-wk-text">
              <WkIcon name="X" size={14} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4">
              <div className="h-4 w-48 rounded bg-wk-surface-raised mb-2" />
              <div className="h-3 w-32 rounded bg-wk-surface-raised" />
            </div>
          ))}
        </div>
      ) : (
        <AdminTable
          columns={[
            {
              key: "select",
              label: (
                <button onClick={toggleAll} className="flex items-center">
                  <WkIcon name={selectedIds.size === filtered.length && filtered.length > 0 ? "CheckSquare" : "Square"} size={16} />
                </button>
              ),
              width: "40px",
              render: (row) => (
                <button onClick={() => toggleSelect(row.id)} className="flex items-center">
                  <WkIcon name={selectedIds.has(row.id) ? "CheckSquare" : "Square"} size={16} />
                </button>
              ),
            },
            {
              key: "entity",
              label: "Entity",
              render: (row) => (
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.title || row.entity_slug}</div>
                  <div className="text-[11px] text-wk-text-muted">{row.entity_type}</div>
                </div>
              ),
            },
            { key: "missing_role", label: "Missing Role", width: "140px", render: (row) => <span className="wk-tag text-[10px]">{row.missing_role}</span> },
            {
              key: "priority",
              label: "Priority",
              width: "100px",
              render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  row.priority === "high" ? "bg-rose-100 text-rose-700" : row.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                }`}>
                  {row.priority}
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              width: "100px",
              render: (row) => (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  row.status === "pending" ? "bg-amber-100 text-amber-700" :
                  row.status === "in_progress" ? "bg-sky-100 text-sky-700" :
                  row.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {row.status.replace("_", " ")}
                </span>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              width: "200px",
              render: (row) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/admin/${entityTypeRoute(row.entity_type)}/${row.entity_slug}`)}
                    className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                    title="Edit record"
                  >
                    <WkIcon name="Pencil" size={14} />
                  </button>
                  {row.status === "pending" && (
                    <>
                      <button
                        onClick={() => {
                          setUploadTarget(row);
                          setShowUpload(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-wk-brand px-2 py-1 text-[11px] font-bold text-white hover:bg-wk-brand/90"
                      >
                        <WkIcon name="Upload" size={12} />
                        Upload
                      </button>
                      <button
                        onClick={() => handleResolve(row.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-600"
                      >
                        <WkIcon name="Check" size={12} />
                        Resolve
                      </button>
                      <button
                        onClick={() => handleSkip(row.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised"
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {row.status === "resolved" && (
                    <button
                      onClick={() => {
                        setItems((prev) => prev.map((i) => i.id === row.id ? { ...i, status: "pending" as const } : i));
                        setToast("Reset to pending");
                        setTimeout(() => setToast(null), 3000);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised"
                    >
                      <WkIcon name="Undo2" size={12} />
                      Reopen
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={filtered}
          keyField="id"
          emptyMessage="No missing images found."
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-wk-text">
                Upload Image for {uploadTarget?.title || uploadTarget?.entity_slug}
              </h3>
              <button
                onClick={() => {
                  setShowUpload(false);
                  setUploadTarget(null);
                }}
                className="rounded-md p-1 text-wk-text-muted hover:text-wk-text"
              >
                <WkIcon name="X" size={18} />
              </button>
            </div>
            <div
              className="rounded-xl border-2 border-dashed border-wk-border bg-wk-surface-raised p-8 text-center cursor-pointer hover:border-wk-brand hover:bg-wk-brand-soft/50 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <WkIcon name="ImagePlus" size={32} className="mx-auto text-wk-text-muted" />
              <p className="mt-3 text-[13px] font-semibold text-wk-text">Drop image here or click to browse</p>
              <p className="mt-1 text-[12px] text-wk-text-muted">JPG, PNG, WebP up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowUpload(false);
                  setUploadTarget(null);
                }}
                className="rounded-lg border border-wk-border px-4 py-2 text-[13px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}