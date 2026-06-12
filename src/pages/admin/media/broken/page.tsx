import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminTable } from "@/components/design-system/admin/AdminTable";
import { supabase } from "@/lib/supabase";

interface MediaLink {
  id: string;
  entity_type: string;
  entity_slug: string;
  url: string;
  role: string;
  source: string;
  status: "ok" | "warning" | "broken";
  last_checked: string;
}

const LINKS_PER_PAGE = 50;

export default function AdminBrokenLinksPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<MediaLink[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [checking, setChecking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { count } = await supabase
      .from("registry_media_assets")
      .select("*", { count: "exact", head: true })
      .eq("media_kind", "image");

    setTotalCount(count ?? 0);

    const from = page * LINKS_PER_PAGE;
    const to = from + LINKS_PER_PAGE - 1;
    const { data, error } = await supabase
      .from("registry_media_assets")
      .select("id, slug, url, source_kind, source_entity, source_record_id, metadata")
      .eq("media_kind", "image")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Error loading media assets:", error);
    } else {
      const mapped: MediaLink[] = (data ?? []).map((item: {
        id: string;
        slug: string;
        url: string;
        source_kind: string | null;
        source_entity: string | null;
        source_record_id: string | null;
        metadata: Record<string, unknown> | null;
      }) => ({
        id: item.id,
        entity_type: item.source_entity ?? "unknown",
        entity_slug: item.source_record_id ?? item.slug,
        url: item.url,
        role: (item.metadata?.role as string) ?? item.source_kind ?? "unknown",
        source: item.source_kind ?? "unknown",
        status: "ok" as const,
        last_checked: "Never",
      }));
      setLinks(mapped);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const checkUrl = async (link: MediaLink) => {
    setChecking(link.id);
    try {
      const response = await fetch(link.url, { method: "HEAD", mode: "no-cors" });
      const status = response.status === 0 ? "ok" : response.ok ? "ok" : "broken";
      setLinks((prev) =>
        prev.map((l) =>
          l.id === link.id
            ? {
                ...l,
                status: status as "ok" | "broken",
                last_checked: new Date().toLocaleString(),
              }
            : l
        )
      );
      setToast(`Checked ${link.url}: ${status}`);
    } catch {
      setLinks((prev) =>
        prev.map((l) =>
          l.id === link.id
            ? {
                ...l,
                status: "broken" as const,
                last_checked: new Date().toLocaleString(),
              }
            : l
        )
      );
      setToast(`Failed to check ${link.url}`);
    }
    setChecking(null);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = links.filter((link) => {
    if (filterStatus !== "all" && link.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        link.entity_slug.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(totalCount / LINKS_PER_PAGE);

  const stats = {
    total: totalCount,
    ok: links.filter((l) => l.status === "ok").length,
    warning: links.filter((l) => l.status === "warning").length,
    broken: links.filter((l) => l.status === "broken").length,
  };

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

  const handleRefresh = () => {
    setPage(0);
    load();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
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
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Media Link Monitor</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {totalCount.toLocaleString()} image assets tracked. Check individual links to find broken ones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="RefreshCw" size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total.toLocaleString(), icon: "Link", color: "text-wk-brand" },
          { label: "OK", value: stats.ok, icon: "CheckCircle2", color: "text-emerald-600" },
          { label: "Warning", value: stats.warning, icon: "AlertTriangle", color: "text-amber-600" },
          { label: "Broken", value: stats.broken, icon: "LinkBreak", color: "text-rose-600" },
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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search media links..."
            className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setPage(0); }} className="text-wk-text-faint hover:text-wk-text">
              <WkIcon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
          {["all", "ok", "warning", "broken"].map((status) => (
            <button
              key={status}
              onClick={() => { setFilterStatus(status); setPage(0); }}
              className={`px-3 py-2 text-[12px] font-semibold transition-all ${
                filterStatus === status
                  ? "bg-wk-brand-soft text-wk-brand"
                  : "text-wk-text-muted hover:bg-wk-surface-raised"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

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
        <>
          <AdminTable
            columns={[
              {
                key: "url",
                label: "Preview",
                width: "60px",
                render: (row) => (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-wk-surface-raised">
                    {row.url ? (
                      <img src={row.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                        <WkIcon name="Image" size={16} />
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "entity",
                label: "Entity",
                render: (row) => (
                  <div>
                    <div className="text-[13px] font-semibold text-wk-text">{row.entity_slug}</div>
                    <div className="text-[11px] text-wk-text-muted">{row.entity_type} / {row.role}</div>
                  </div>
                ),
              },
              {
                key: "url",
                label: "URL",
                render: (row) => (
                  <div className="text-[12px] font-mono text-wk-text truncate max-w-[300px]" title={row.url}>
                    {row.url}
                  </div>
                ),
              },
              {
                key: "source",
                label: "Source",
                width: "100px",
                render: (row) => (
                  <span className="text-[12px] text-wk-text-muted">{row.source}</span>
                ),
              },
              {
                key: "status",
                label: "Status",
                width: "100px",
                render: (row) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    row.status === "ok" ? "bg-emerald-100 text-emerald-700" :
                    row.status === "warning" ? "bg-amber-100 text-amber-700" :
                    "bg-rose-100 text-rose-700"
                  }`}>
                    {row.status}
                  </span>
                ),
              },
              {
                key: "actions",
                label: "",
                width: "160px",
                render: (row) => (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/admin/${entityTypeRoute(row.entity_type)}/${row.entity_slug}`)}
                      className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                      title="Edit record"
                    >
                      <WkIcon name="Pencil" size={14} />
                    </button>
                    <button
                      onClick={() => checkUrl(row)}
                      disabled={checking === row.id}
                      className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised disabled:opacity-50"
                    >
                      <WkIcon name={checking === row.id ? "Loader2" : "RefreshCw"} size={12} className={checking === row.id ? "animate-spin" : ""} />
                      Check
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filtered}
            keyField="id"
            emptyMessage="No media links found."
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-4 py-3">
              <span className="text-[12px] text-wk-text-muted">
                Page {page + 1} of {totalPages} ({totalCount.toLocaleString()} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-wk-border px-3 py-1.5 text-[12px] font-semibold text-wk-text hover:bg-wk-surface-raised disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
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
    </div>
  );
}