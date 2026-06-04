import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";

/* ─── Types ─── */

interface ContentItem {
  id: string;
  slug: string;
  title: string | null;
  type: "article" | "guide" | "page" | "document";
  status: string | null;
  wpStatus: string | null;
  editorialState: string | null;
  author: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  createdAt: string;
}

/* ─── Page ─── */

export default function AdminPublishingDashboardPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const [articlesRes, guidesRes, pagesRes, docsRes] = await Promise.all([
        supabase.from("wk_articles").select("id, slug, title, wp_status, author, published_at, modified_at, created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("wk_guides").select("id, slug, title, wp_status, created_at, updated_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("wk_page_surfaces").select("id, slug, title, wp_status, document_type, created_at, updated_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("wk_cms_documents").select("id, slug, title, status, editorial_state, published_at, modified_at, created_at").order("created_at", { ascending: false }).limit(100),
      ]);

      const merged: ContentItem[] = [];

      if (articlesRes.data) {
        merged.push(...articlesRes.data.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          type: "article" as const,
          status: a.wp_status,
          wpStatus: a.wp_status,
          editorialState: null,
          author: a.author,
          publishedAt: a.published_at,
          modifiedAt: a.modified_at,
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
          editorialState: null,
          author: null,
          publishedAt: null,
          modifiedAt: g.updated_at,
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
          editorialState: null,
          author: null,
          publishedAt: null,
          modifiedAt: p.updated_at,
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
          editorialState: d.editorial_state,
          author: null,
          publishedAt: d.published_at,
          modifiedAt: d.modified_at,
          createdAt: d.created_at,
        })));
      }

      setItems(merged);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter || item.wpStatus === statusFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesStatus && matchesType;
  });

  const counts = {
    draft: items.filter((i) => i.status === "draft" || i.wpStatus === "draft").length,
    publish: items.filter((i) => i.status === "publish" || i.wpStatus === "publish").length,
    trash: items.filter((i) => i.status === "trash" || i.wpStatus === "trash").length,
    pending: items.filter((i) => i.status === "pending" || i.wpStatus === "pending").length,
    scheduled: items.filter((i) => {
      if (i.publishedAt && i.status !== "publish") {
        return new Date(i.publishedAt) > new Date();
      }
      return false;
    }).length,
  };

  const statusOptions = [
    { value: "all", label: "All", count: items.length },
    { value: "draft", label: "Draft", count: counts.draft },
    { value: "publish", label: "Published", count: counts.publish },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "trash", label: "Trashed", count: counts.trash },
  ];

  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "article", label: "Articles" },
    { value: "guide", label: "Guides" },
    { value: "page", label: "Pages" },
    { value: "document", label: "Documents" },
  ];

  function getRoute(item: ContentItem) {
    if (item.type === "article") return `/admin/content/articles/${item.slug}`;
    if (item.type === "guide") return `/admin/content/guides/${item.slug}`;
    if (item.type === "page") return `/admin/content/pages/${item.slug}`;
    return `/admin/content/articles/${item.slug}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Content</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Publishing</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {items.length} total pieces of content across all types.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/content/archive")}
            className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Archive" size={14} />
            Archive
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Draft"
          value={counts.draft}
          icon="FileEdit"
          color="bg-wk-warning-soft text-wk-warning"
          onClick={() => setStatusFilter("draft")}
        />
        <KpiCard
          label="Published"
          value={counts.publish}
          icon="Globe"
          color="bg-wk-success-soft text-wk-success"
          onClick={() => setStatusFilter("publish")}
        />
        <KpiCard
          label="Pending"
          value={counts.pending}
          icon="Clock"
          color="bg-wk-info-soft text-wk-info"
          onClick={() => setStatusFilter("pending")}
        />
        <KpiCard
          label="Trashed"
          value={counts.trash}
          icon="Trash2"
          color="bg-wk-danger-soft text-wk-danger"
          onClick={() => setStatusFilter("trash")}
        />
      </div>

      {/* Filters */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
          {/* Status pills */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-wk-border bg-wk-bg-subtle p-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap ${
                  statusFilter === opt.value
                    ? "bg-wk-surface text-wk-text"
                    : "text-wk-text-muted hover:text-wk-text"
                }`}
              >
                {opt.label}
                <span className="text-[10px] text-wk-text-faint">{opt.count}</span>
              </button>
            ))}
          </div>

          {/* Type filter */}
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
            {filtered.length} items
          </span>
        </div>
      </WkSurface>

      {/* Table */}
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
              key: "title",
              label: "Title",
              render: (row) => (
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.title ? decodeHtmlEntities(row.title) : "(Untitled)"}</div>
                  <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                </div>
              ),
            },
            {
              key: "type",
              label: "Type",
              width: "90px",
              render: (row) => (
                <span className="text-[11px] font-semibold uppercase text-wk-text-muted">
                  {row.type}
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              width: "110px",
              render: (row) => <StatusBadge status={row.status || row.wpStatus} />,
            },
            {
              key: "author",
              label: "Author",
              width: "120px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">{row.author || "—"}</span>
              ),
            },
            {
              key: "publishedAt",
              label: "Published",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : "—"}
                </span>
              ),
            },
            {
              key: "modifiedAt",
              label: "Modified",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.modifiedAt ? new Date(row.modifiedAt).toLocaleDateString() : "—"}
                </span>
              ),
            },
          ]}
          rows={filtered}
          keyField="id"
          emptyMessage="No content found for this filter."
          onRowClick={(row) => navigate(getRoute(row))}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({
  label,
  value,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-wk-border bg-wk-surface p-4 text-left hover:bg-wk-surface-raised transition-colors"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <WkIcon name={icon as never} size={18} />
      </div>
      <div>
        <div className="text-[22px] font-black text-wk-text">{value}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{label}</div>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[11px] text-wk-text-faint">—</span>;

  const color =
    status === "publish"
      ? "bg-wk-success-soft text-wk-success"
      : status === "draft"
      ? "bg-wk-warning-soft text-wk-warning"
      : status === "pending"
      ? "bg-wk-info-soft text-wk-info"
      : status === "trash"
      ? "bg-wk-danger-soft text-wk-danger"
      : "bg-wk-surface-raised text-wk-text-muted";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {status}
    </span>
  );
}