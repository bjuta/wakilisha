import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

interface ArchivedItem {
  id: string;
  slug: string;
  title: string | null;
  type: "article" | "guide" | "page" | "document";
  status: string | null;
  wpStatus: string | null;
  originalStatus: string | null;
  author: string | null;
  trashedAt: string | null;
  createdAt: string;
}

/* ─── Page ─── */

export default function AdminContentArchivePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "success" | "error" | "info" }[]>([]);

  let toastCounter = 0;

  function addToast(type: "success" | "error" | "info", message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  useEffect(() => {
    async function load() {
      const [articlesRes, guidesRes, pagesRes, docsRes] = await Promise.all([
        supabase.from("wk_articles").select("id, slug, title, wp_status, author, created_at, updated_at").eq("wp_status", "trash").order("created_at", { ascending: false }).limit(100),
        supabase.from("wk_guides").select("id, slug, title, wp_status, created_at, updated_at").eq("wp_status", "trash").order("created_at", { ascending: false }).limit(50),
        supabase.from("wk_page_surfaces").select("id, slug, title, wp_status, document_type, created_at, updated_at").eq("wp_status", "trash").order("created_at", { ascending: false }).limit(50),
        supabase.from("wk_cms_documents").select("id, slug, title, status, editorial_state, created_at, updated_at").eq("status", "trash").order("created_at", { ascending: false }).limit(100),
      ]);

      const merged: ArchivedItem[] = [];

      if (articlesRes.data) {
        merged.push(...articlesRes.data.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          type: "article" as const,
          status: a.wp_status,
          wpStatus: a.wp_status,
          originalStatus: "publish",
          author: a.author,
          trashedAt: a.updated_at,
          createdAt: a.created_at,
        })));
      }
      if (guidesRes.data) {
        merged.push(...guidesRes.data.map((g) => ({
          id: g.id,
          slug: g.slug,
          title: g.title,
          type: "guide" as const,
          status: g.wp_status,
          wpStatus: g.wp_status,
          originalStatus: "publish",
          author: null,
          trashedAt: g.updated_at,
          createdAt: g.created_at,
        })));
      }
      if (pagesRes.data) {
        merged.push(...pagesRes.data.map((p) => ({
          id: p.id ?? p.slug,
          slug: p.slug,
          title: p.title,
          type: "page" as const,
          status: p.wp_status,
          wpStatus: p.wp_status,
          originalStatus: "publish",
          author: null,
          trashedAt: p.updated_at,
          createdAt: p.created_at,
        })));
      }
      if (docsRes.data) {
        merged.push(...docsRes.data.map((d) => ({
          id: d.id,
          slug: d.slug,
          title: d.title,
          type: "document" as const,
          status: d.status,
          wpStatus: null,
          originalStatus: "publish",
          author: null,
          trashedAt: d.updated_at,
          createdAt: d.created_at,
        })));
      }

      setItems(merged);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = items.filter((item) => {
    if (typeFilter === "all") return true;
    return item.type === typeFilter;
  });

  async function handleRestore(item: ArchivedItem) {
    setRestoringId(item.id);
    const tableMap: Record<string, string> = {
      article: "wk_articles",
      guide: "wk_guides",
      page: "wk_page_surfaces",
      document: "wk_cms_documents",
    };
    const table = tableMap[item.type];
    if (!table) {
      addToast("error", "Unknown content type.");
      setRestoringId(null);
      return;
    }

    const statusField = item.type === "document" ? "status" : "wp_status";
    const newStatus = item.originalStatus || "draft";

    const { error } = await supabase.from(table).update({ [statusField]: newStatus }).eq("id", item.id);

    if (error) {
      addToast("error", `Restore failed: ${error.message}`);
      setRestoringId(null);
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    addToast("success", `"${item.title || item.slug}" restored to ${newStatus}.`);
    setRestoringId(null);
  }

  async function handleBulkRestore() {
    const restorePromises = filtered.map((item) => handleRestore(item));
    await Promise.all(restorePromises);
  }

  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "article", label: "Articles" },
    { value: "guide", label: "Guides" },
    { value: "page", label: "Pages" },
    { value: "document", label: "Documents" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Content</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Archive</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {items.length} items in the trash. Restore or permanently delete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/content/publishing")}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={14} />
            Publishing
          </button>
          {items.length > 0 && (
            <button
              onClick={handleBulkRestore}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="RotateCcw" size={14} />
              Restore All
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
          >
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-[12px] text-wk-text-muted whitespace-nowrap">
            {filtered.length} of {items.length}
          </span>
        </div>
      </WkSurface>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
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
              key: "title",
              label: "Title",
              render: (row) => (
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.title || "(Untitled)"}</div>
                  <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                </div>
              ),
            },
            {
              key: "type",
              label: "Type",
              width: "90px",
              render: (row) => (
                <span className="text-[11px] font-semibold uppercase text-wk-text-muted">{row.type}</span>
              ),
            },
            {
              key: "status",
              label: "Status",
              width: "100px",
              render: (row) => (
                <span className="inline-flex items-center rounded-full bg-wk-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-wk-danger">
                  {row.status || row.wpStatus}
                </span>
              ),
            },
            {
              key: "trashedAt",
              label: "Trashed",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.trashedAt ? new Date(row.trashedAt).toLocaleDateString() : "—"}
                </span>
              ),
            },
            {
              key: "createdAt",
              label: "Created",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "actions",
              label: "",
              width: "100px",
              render: (row) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(row);
                  }}
                  disabled={restoringId === row.id}
                  className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
                >
                  {restoringId === row.id ? (
                    <WkIcon name="Loader2" size={14} className="animate-spin" />
                  ) : (
                    <WkIcon name="RotateCcw" size={14} />
                  )}
                  Restore
                </button>
              ),
            },
          ]}
          rows={filtered}
          keyField="id"
          emptyMessage="Nothing in the archive. All content is active."
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
              toast.type === "success"
                ? "border-wk-success/20 bg-wk-success-soft text-wk-success"
                : toast.type === "error"
                ? "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
                : "border-wk-info/20 bg-wk-info-soft text-wk-info"
            }`}
          >
            <WkIcon
              name={
                toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"
              }
              size={16}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}