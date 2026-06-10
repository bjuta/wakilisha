import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";
import { useAdminUser } from "@/hooks/useAdminUser";

interface Article {
  slug: string;
  title: string | null;
  excerpt: string | null;
  author: string | null;
  published_at: string | null;
  wp_status: string | null;
  created_at: string;
  categories: unknown[] | null;
  tags: unknown[] | null;
  hero_image_url: string | null;
}

/* ─── Helpers ─── */

function normalizeTaxonomyTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null && "name" in item) {
      return String((item as Record<string, unknown>).name ?? "");
    }
    return String(item);
  }).filter(Boolean);
}

export default function AdminArticlesPage() {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [heroFilter, setHeroFilter] = useState<string>("all");

  const canEditOthers = adminUser.can("edit_others_articles");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("wk_articles")
        .select("slug, title, excerpt, author, published_at, wp_status, created_at, categories, tags, hero_image_url")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Error loading articles:", error);
      } else {
        setArticles(data ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  // For authors/writers: only show own articles
  const visibleArticles = canEditOthers
    ? articles
    : articles.filter((a) => {
        const currentUserName = adminUser.name?.toLowerCase();
        const articleAuthor = a.author?.toLowerCase() ?? "";
        return articleAuthor === currentUserName || articleAuthor.includes(currentUserName);
      });

  const filtered = visibleArticles.filter((a) => {
    const matchesSearch =
      !search ||
      (a.title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (a.slug?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (a.author?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || a.wp_status === statusFilter;
    const matchesHero =
      heroFilter === "all" ||
      (heroFilter === "missing" && (!a.hero_image_url || a.hero_image_url === "")) ||
      (heroFilter === "has" && a.hero_image_url && a.hero_image_url !== "");
    return matchesSearch && matchesStatus && matchesHero;
  });

  const statusOptions = ["all", "publish", "draft", "pending", "future", "private"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Content</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Articles</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {articles.length} articles imported. {articles.filter((a) => !a.title || !a.excerpt).length} need review.
            {!canEditOthers && (
              <span className="ml-1 text-wk-brand">Showing {adminUser.name}&apos;s articles.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
            <WkIcon name="Plus" size={14} />
            New Article
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles by title, slug, or author..."
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
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={heroFilter}
              onChange={(e) => setHeroFilter(e.target.value)}
              className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none cursor-pointer"
            >
              <option value="all">All Images</option>
              <option value="has">Has hero image</option>
              <option value="missing">No hero image</option>
            </select>
            <span className="text-[12px] text-wk-text-muted whitespace-nowrap">
              {filtered.length} of {articles.length}
            </span>
          </div>
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
            { key: "author", label: "Author", width: "140px" },
            {
              key: "wp_status",
              label: "Status",
              width: "100px",
              render: (row) => <StatusBadge status={row.wp_status} />,
            },
            {
              key: "published_at",
              label: "Published",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.published_at ? new Date(row.published_at).toLocaleDateString() : "—"}
                </span>
              ),
            },
            {
              key: "created_at",
              label: "Created",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "categories",
              label: "Categories",
              width: "160px",
              render: (row) => {
                const cats = normalizeTaxonomyTerms(row.categories);
                return (
                  <div className="flex flex-wrap gap-1">
                    {cats.length > 0 ? (
                      cats.slice(0, 3).map((cat) => (
                        <span key={cat} className="wk-tag text-[10px]">{cat}</span>
                      ))
                    ) : (
                      <span className="text-[11px] text-wk-text-faint">None</span>
                    )}
                  </div>
                );
              },
            },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage="No articles found."
          onRowClick={(row) => navigate(`/admin/content/articles/${row.slug}`)}
        />
      )}
    </div>
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
      : status === "private"
      ? "bg-wk-surface-raised text-wk-text-muted"
      : "bg-wk-surface-raised text-wk-text-muted";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {status}
    </span>
  );
}