import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";

interface PageSurface {
  slug: string;
  title: string | null;
  document_type: string | null;
  wp_status: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminPagesPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageSurface[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("wk_articles")
        .select("slug, title, raw_meta, wp_status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error loading pages:", error);
      } else {
        const surfaces: PageSurface[] = (data ?? []).map((row: Record<string, unknown>) => {
          const rawMeta = row.raw_meta as Record<string, unknown> | null;
          return {
            slug: row.slug as string,
            title: row.title as string | null,
            document_type: (rawMeta?.post_type as string) ?? null,
            wp_status: row.wp_status as string | null,
            created_at: row.created_at as string,
            updated_at: row.updated_at as string,
          };
        });
        setPages(surfaces);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = pages.filter((p) => {
    const matchesSearch =
      !search ||
      (p.title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.wp_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = ["all", "publish", "draft", "pending", "future", "private"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Content</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Pages</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {pages.length} pages and surfaces in the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Plus" size={14} />
            New Page
          </button>
        </div>
      </div>

      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2 flex-1 max-w-md">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages by title or slug..."
              className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text">
                <WkIcon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              {statusOptions.filter((s) => s !== "all").map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">{filtered.length} of {pages.length}</span>
          </div>
        </div>
      </WkSurface>

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
              label: "Page",
              render: (row) => (
                <div>
                  <div className="text-[13px] font-semibold text-wk-text">{row.title ? decodeHtmlEntities(row.title) : "(Untitled)"}</div>
                  <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                </div>
              ),
            },
            { key: "document_type", label: "Type", width: "120px", render: (row) => <span className="text-[12px] text-wk-text-muted">{row.document_type || "—"}</span> },
            {
              key: "wp_status",
              label: "Status",
              width: "100px",
              render: (row) => <StatusBadge status={row.wp_status} />,
            },
            {
              key: "created_at",
              label: "Created",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">{new Date(row.created_at).toLocaleDateString()}</span>
              ),
            },
            {
              key: "updated_at",
              label: "Updated",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">{new Date(row.updated_at).toLocaleDateString()}</span>
              ),
            },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage="No pages found."
          onRowClick={(row) => navigate(`/admin/content/pages/${row.slug}`)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[11px] text-wk-text-faint">—</span>;
  const color =
    status === "publish" ? "bg-wk-success-soft text-wk-success" :
    status === "draft" ? "bg-wk-warning-soft text-wk-warning" :
    status === "pending" ? "bg-wk-info-soft text-wk-info" :
    "bg-wk-surface-raised text-wk-text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {status}
    </span>
  );
}