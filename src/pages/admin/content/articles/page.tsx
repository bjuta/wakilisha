import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminCollectionHeader } from "@/components/design-system/admin/AdminCollectionHeader";
import { AdminStatusBadge } from "@/components/design-system/admin/AdminStatusBadge";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  fetchArticlesForAdminList,
  type AdminArticleListItem,
} from "@/services/articles/articleAdminService";

export default function AdminArticlesPage() {
  const navigate = useNavigate();
  const adminUser = useAdminUser();
  const [articles, setArticles] = useState<AdminArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [heroFilter, setHeroFilter] = useState<string>("all");

  const canEditOthers = adminUser.can("edit_others_articles");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchArticlesForAdminList(200);
      setArticles(data);
      setLoading(false);
    }
    load();
  }, []);

  const visibleArticles = canEditOthers
    ? articles
    : articles.filter(
        (article) => article.ownerId === adminUser.id,
      );

  const filtered = visibleArticles.filter((article) => {
    const matchesSearch =
      !search ||
      (article.title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (article.slug?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (article.author?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus =
      statusFilter === "all" || article.wpStatus === statusFilter;
    const matchesHero =
      heroFilter === "all" ||
      (heroFilter === "missing" &&
        (!article.heroImageUrl || article.heroImageUrl === "")) ||
      (heroFilter === "has" &&
        article.heroImageUrl && article.heroImageUrl !== "");
    return matchesSearch && matchesStatus && matchesHero;
  });

  const statusOptions = [
    "all",
    "publish",
    "draft",
    "pending",
    "future",
    "private",
  ];

  return (
    <div className="space-y-6">
      <AdminCollectionHeader
        eyebrow="Content & Editorial"
        title="Articles"
        description={
          <>
            {articles.length} Articles loaded. {" "}
            {articles.filter((article) => !article.title || !article.excerpt).length} need review.
            {!canEditOthers ? (
              <span className="ml-1 text-wk-brand">
                Showing {adminUser.name}&apos;s Articles.
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <button
              onClick={() => navigate("/admin/content/articles/trash")}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-text-muted hover:text-wk-danger"
            >
              <WkIcon name="Trash2" size={14} />
              Trash
            </button>
            <button
              onClick={() => navigate("/admin/content/articles/new")}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="Plus" size={14} />
              New Article
            </button>
          </>
        }
      />

      <WkSurface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
            <WkIcon name="Search" size={14} className="text-wk-text-faint" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Articles by title, slug, or author..."
              className="w-full bg-transparent text-[13px] text-wk-text outline-none placeholder:text-wk-text-faint"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="text-wk-text-faint hover:text-wk-text"
                aria-label="Clear search"
              >
                <WkIcon name="X" size={14} />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="cursor-pointer rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              <option value="all">All Status</option>
              {statusOptions
                .filter((status) => status !== "all")
                .map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
            </select>
            <select
              value={heroFilter}
              onChange={(event) => setHeroFilter(event.target.value)}
              className="cursor-pointer rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
            >
              <option value="all">All Images</option>
              <option value="has">Has hero image</option>
              <option value="missing">No hero image</option>
            </select>
            <span className="whitespace-nowrap text-[12px] text-wk-text-muted">
              {filtered.length} of {articles.length}
            </span>
          </div>
        </div>
      </WkSurface>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-xl border border-wk-border bg-wk-surface p-4"
            >
              <div className="mb-2 h-4 w-48 rounded bg-wk-surface-raised" />
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
                  <div className="text-[13px] font-semibold text-wk-text">
                    {row.title || "(Untitled)"}
                  </div>
                  <div className="text-[11px] text-wk-text-muted">{row.slug}</div>
                </div>
              ),
            },
            { key: "author", label: "Author", width: "140px" },
            {
              key: "wpStatus",
              label: "Status",
              width: "100px",
              render: (row) =>
                row.wpStatus ? (
                  <AdminStatusBadge status={row.wpStatus} />
                ) : (
                  <span className="text-[11px] text-wk-text-faint">—</span>
                ),
            },
            {
              key: "publishedAt",
              label: "Published",
              width: "140px",
              render: (row) => (
                <span className="text-[12px] text-wk-text-muted">
                  {row.publishedAt
                    ? new Date(row.publishedAt).toLocaleDateString()
                    : "—"}
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
              key: "categories",
              label: "Categories",
              width: "160px",
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.categories.length > 0 ? (
                    row.categories.slice(0, 3).map((category) => (
                      <span key={category} className="wk-tag text-[10px]">
                        {category}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-wk-text-faint">None</span>
                  )}
                </div>
              ),
            },
          ]}
          rows={filtered}
          keyField="slug"
          emptyMessage="No Articles found."
          onRowClick={(row) => navigate(`/admin/content/articles/${row.slug}`)}
        />
      )}
    </div>
  );
}
