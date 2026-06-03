import { useEffect, useState, useRef, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface MediaAsset {
  id: string;
  entity_type: string;
  entity_slug: string;
  role: string;
  url: string;
  alt_text: string | null;
  source: string;
}

const CMS_BUCKET = "cms-media";
const PAGE_SIZE = 50;

export default function AdminMediaLibraryPage() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState<MediaAsset | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wk_media_assets")
      .select("id, entity_type, entity_slug, role, url, alt_text, source")
      .limit(500);

    if (error) {
      console.error("Error loading media:", error);
    } else {
      setMedia(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    let success = 0;
    let failed = 0;

    for (const file of files) {
      const path = `cms/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from(CMS_BUCKET)
        .upload(path, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        failed++;
        continue;
      }

      const { data: publicData } = supabase.storage.from(CMS_BUCKET).getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("wk_media_assets")
        .insert({
          entity_type: "cms",
          entity_slug: "upload",
          role: "upload",
          url: publicData.publicUrl,
          source: "manual_upload",
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        failed++;
      } else {
        success++;
      }
    }

    setUploading(false);
    if (success > 0) {
      await load();
    }
    console.log(`Upload complete: ${success} succeeded, ${failed} failed`);
  }, [load]);

  const handleDelete = useCallback(async (asset: MediaAsset) => {
    setDeleting(asset.id);

    const url = new URL(asset.url);
    const pathMatch = url.pathname.match(/\/cms-media\/(.+)$/);
    const path = pathMatch ? pathMatch[1] : null;

    if (path) {
      const { error: removeError } = await supabase.storage.from(CMS_BUCKET).remove([path]);
      if (removeError) {
        console.error("Storage delete error:", removeError);
      }
    }

    const { error: deleteError } = await supabase
      .from("wk_media_assets")
      .delete()
      .eq("id", asset.id);

    if (deleteError) {
      console.error("DB delete error:", deleteError);
    }

    setDeleting(null);
    await load();
  }, [load]);

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy URL");
    }
  }, []);

  const filtered = media.filter((m) => {
    const matchesSearch =
      !search ||
      m.entity_slug.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      (m.alt_text?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    const matchesSource = sourceFilter === "all" || m.source === sourceFilter;
    return matchesSearch && matchesRole && matchesSource;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const roles = ["all", "hero", "artwork", "artist_photo", "label_logo", "inline"];
  const sources = Array.from(new Set(media.map((m) => m.source))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            Media
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">
            Media Library
          </h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {media.length} media assets in the library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-50"
          >
            <WkIcon
              name={uploading ? "Loader2" : "Upload"}
              size={14}
              className={uploading ? "animate-spin" : ""}
            />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search media by entity or role..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(0);
                }}
                className="text-wk-text-faint hover:text-wk-text"
              >
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              {roles
                .filter((r) => r !== "all")
                .map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1).replace("_", " ")}
                  </option>
                ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">
              {filtered.length} of {media.length}
            </span>
          </div>
        </div>
      </WkSurface>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-wk-surface-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-wk-surface-raised" />
                  <div className="h-3 w-32 rounded bg-wk-surface-raised" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <AdminTable
            columns={[
              {
                key: "url",
                label: "Preview",
                width: "60px",
                render: (row) => (
                  <button
                    onClick={() => setPreviewing(row)}
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-wk-surface-raised hover:ring-2 hover:ring-wk-brand cursor-pointer"
                  >
                    {row.url ? (
                      <img
                        src={row.url}
                        alt={row.alt_text || ""}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                        <WkIcon name="Image" size={16} />
                      </div>
                    )}
                  </button>
                ),
              },
              {
                key: "entity_slug",
                label: "Entity",
                render: (row) => (
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">
                      {row.entity_slug}
                    </div>
                    <div className="text-[11px] text-wk-text-muted">
                      {row.entity_type}
                    </div>
                  </div>
                ),
              },
              {
                key: "role",
                label: "Role",
                width: "100px",
                render: (row) => (
                  <span className="wk-tag text-[10px]">{row.role}</span>
                ),
              },
              {
                key: "source",
                label: "Source",
                width: "100px",
                render: (row) => (
                  <span className="text-[12px] text-wk-text-muted">
                    {row.source}
                  </span>
                ),
              },
              {
                key: "alt_text",
                label: "Alt Text",
                width: "200px",
                render: (row) => (
                  <span className="text-[12px] text-wk-text-muted">
                    {row.alt_text || "—"}
                  </span>
                ),
              },
              {
                key: "actions",
                label: "",
                width: "120px",
                render: (row) => (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(row.url)}
                      className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-brand"
                      title="Copy URL"
                    >
                      <WkIcon name={copied ? "Check" : "Copy"} size={14} />
                    </button>
                    <button
                      onClick={() => setPreviewing(row)}
                      className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-brand"
                      title="Preview"
                    >
                      <WkIcon name="Eye" size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={deleting === row.id}
                      className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-rose-600 disabled:opacity-50"
                      title="Delete"
                    >
                      <WkIcon
                        name={deleting === row.id ? "Loader2" : "Trash2"}
                        size={14}
                        className={deleting === row.id ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={paged}
            keyField="id"
            emptyMessage="No media assets found."
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-4 py-3">
              <span className="text-[12px] text-wk-text-muted">
                Page {page + 1} of {totalPages} ({filtered.length} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-2xl border border-wk-border bg-wk-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewing(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
            >
              <WkIcon name="X" size={16} />
            </button>
            <img
              src={previewing.url}
              alt={previewing.alt_text || previewing.entity_slug}
              className="max-h-[80vh] max-w-[85vw] rounded-xl object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-wk-text">
                  {previewing.entity_slug}
                </p>
                <p className="text-[11px] text-wk-text-muted">
                  {previewing.entity_type} / {previewing.role} / {previewing.source}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(previewing.url)}
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised"
                >
                  <WkIcon name={copied ? "Check" : "Copy"} size={14} />
                  {copied ? "Copied" : "Copy URL"}
                </button>
                <a
                  href={previewing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised"
                >
                  <WkIcon name="ExternalLink" size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}