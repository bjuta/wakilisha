import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import {
  readAdminMediaAssets,
} from "@/services/adminMediaReadService";
import { mediaService } from "@/services/mediaService";

interface BrokenLinkItem {
  id: string;
  slug: string;
  url: string;
  title: string | null;
  source_kind: string | null;
  source_entity: string | null;
  source_record_id: string | null;
  mime_type: string | null;
  checkStatus: "unchecked" | "ok" | "broken" | "checking";
  checkError: string | null;
  checkedAt: string | null;
  refCount: number;
  refEntities: string[];
}

const PAGE_SIZE = 50;

export default function AdminBrokenLinksPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<BrokenLinkItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [checkingAll, setCheckingAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const checkQueueRef = useRef<AbortController | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Load from registry_media_assets ───
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await readAdminMediaAssets({
        mediaKind: "image",
        orderBy: "created_at",
        ascending: false,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        includeReferences: true,
      });

      setTotalCount(result.total);

      const mapped: BrokenLinkItem[] =
        result.assets.map((asset) => {
          const meta = asset.metadata ?? {};
          const linkCheck =
            (meta.link_check as Record<string, unknown>)
            ?? {};
          const refEntities = [
            ...new Set(
              asset.references.map((reference) =>
                reference.table
                  .replace("registry_", "")
                  .replace("wk_", "")
              ),
            ),
          ];

          return {
            id: asset.id,
            slug: asset.slug ?? "",
            url: asset.url ?? "",
            title: asset.title,
            source_kind: asset.source_kind,
            source_entity: asset.source_entity,
            source_record_id: asset.source_record_id,
            mime_type: asset.mime_type,
            checkStatus: (
              linkCheck.status ?? "unchecked"
            ) as BrokenLinkItem["checkStatus"],
            checkError:
              (linkCheck.error as string) ?? null,
            checkedAt:
              (linkCheck.checked_at as string) ?? null,
            refCount: refEntities.length,
            refEntities,
          };
        });

      setItems(mapped);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load media assets.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Check a single URL ───
  const checkSingle = useCallback(
    (item: BrokenLinkItem): Promise<{ status: "ok" | "broken"; error: string | null }> => {
      return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          // Timeout after 15s — treat as broken
          img.src = "";
          resolve({ status: "broken", error: "Request timed out after 15s" });
        }, 15000);

        img.onload = () => {
          clearTimeout(timeout);
          resolve({ status: "ok", error: null });
        };

        img.onerror = () => {
          clearTimeout(timeout);
          resolve({ status: "broken", error: "Image failed to load" });
        };

        img.src = item.url;
      });
    },
    []
  );

  // ─── Persist check result to DB ───
  const persistCheckResult = useCallback(
    async (itemId: string, status: "ok" | "broken", error: string | null) => {
      try {
        await mediaService.updateMetadata(itemId, {
          metadata: {
            link_check: {
              status,
              error,
              checked_at: new Date().toISOString(),
            },
          },
        });
      } catch {
        // Best effort — UI state is already updated
      }
    },
    []
  );

  // ─── Check one (from UI) ───
  const handleCheckOne = async (item: BrokenLinkItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checkStatus: "checking" as const } : i))
    );

    const result = await checkSingle(item);

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, checkStatus: result.status, checkError: result.error, checkedAt: new Date().toISOString() }
          : i
      )
    );

    await persistCheckResult(item.id, result.status, result.error);
  };

  // ─── Check All ───
  const handleCheckAll = async () => {
    if (checkingAll) return;

    const unchecked = items.filter((i) => i.checkStatus !== "checking");
    if (unchecked.length === 0) {
      showToast("No unchecked items to verify.");
      return;
    }

    setCheckingAll(true);
    const controller = new AbortController();
    checkQueueRef.current = controller;

    let okCount = 0;
    let brokenCount = 0;

    // Process in chunks of 10 to avoid overwhelming the browser
    const chunkSize = 10;
    for (let i = 0; i < unchecked.length; i += chunkSize) {
      if (controller.signal.aborted) break;

      const chunk = unchecked.slice(i, i + chunkSize);

      // Mark chunk as checking
      setItems((prev) =>
        prev.map((p) =>
          chunk.some((c) => c.id === p.id) ? { ...p, checkStatus: "checking" as const } : p
        )
      );

      // Check all in chunk in parallel
      const results = await Promise.all(
        chunk.map(async (item) => {
          const result = await checkSingle(item);
          await persistCheckResult(item.id, result.status, result.error);
          return { id: item.id, ...result };
        })
      );

      // Update UI for chunk
      setItems((prev) =>
        prev.map((p) => {
          const r = results.find((r) => r.id === p.id);
          if (!r) return p;
          return {
            ...p,
            checkStatus: r.status,
            checkError: r.error,
            checkedAt: new Date().toISOString(),
          };
        })
      );

      results.forEach((r) => {
        if (r.status === "ok") okCount++;
        else brokenCount++;
      });
    }

    setCheckingAll(false);
    showToast(`Checked ${okCount + brokenCount} links: ${okCount} OK, ${brokenCount} broken.`);
  };

  const handleCancelCheck = () => {
    checkQueueRef.current?.abort();
    setCheckingAll(false);
    showToast("Check cancelled.");
  };

  // ─── Filters ───
  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.checkStatus !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (item.title ?? "").toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        (item.source_entity ?? "").toLowerCase().includes(q) ||
        (item.source_record_id ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort: broken first, then unchecked, then ok
  const sorted = [...filtered].sort((a, b) => {
    const order: Record<string, number> = { broken: 0, checking: 1, unchecked: 2, ok: 3 };
    return order[a.checkStatus] - order[b.checkStatus];
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const stats = {
    total: totalCount,
    unchecked: items.filter((l) => l.checkStatus === "unchecked").length,
    ok: items.filter((l) => l.checkStatus === "ok").length,
    broken: items.filter((l) => l.checkStatus === "broken").length,
    checking: items.filter((l) => l.checkStatus === "checking").length,
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
      case "author":
        return "registry/authors";
      default:
        return "content/articles";
    }
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
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Link Monitor</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {totalCount.toLocaleString()} image assets tracked. Check links to find broken ones — results persist across sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checkingAll ? (
            <button
              onClick={handleCancelCheck}
              className="inline-flex items-center gap-1.5 rounded-lg border border-wk-danger/40 bg-wk-danger-soft px-3 py-2 text-[12px] font-bold text-wk-danger hover:bg-wk-danger/10 transition-all cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="X" size={14} />
              Stop Checking
            </button>
          ) : (
            <button
              onClick={handleCheckAll}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="Zap" size={14} />
              Check All ({stats.unchecked})
            </button>
          )}
          <button
            onClick={() => { setPage(0); load(); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-all cursor-pointer whitespace-nowrap"
          >
            <WkIcon name="RefreshCw" size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total.toLocaleString(), icon: "Link", color: "text-wk-brand" },
          { label: "OK", value: stats.ok, icon: "CheckCircle2", color: "text-emerald-600" },
          { label: "Broken", value: stats.broken, icon: "AlertTriangle", color: "text-rose-600" },
          { label: "Checking", value: stats.checking, icon: "Loader2", color: "text-sky-600" },
          { label: "Unchecked", value: stats.unchecked, icon: "Circle", color: "text-wk-text-muted" },
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
          <WkIcon name="Search" size={14} className="text-wk-text-faint shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search by title, URL, or source ID…"
            className="w-full bg-transparent text-[12px] text-wk-text placeholder:text-wk-text-faint outline-none"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setPage(0); }} className="text-wk-text-faint hover:text-wk-text shrink-0">
              <WkIcon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center rounded-lg border border-wk-border bg-wk-surface overflow-hidden">
          {["all", "broken", "ok", "unchecked"].map((status) => (
            <button
              key={status}
              onClick={() => { setFilterStatus(status); setPage(0); }}
              className={`px-3 py-2 text-[12px] font-semibold transition-all whitespace-nowrap ${
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

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
          <p className="text-[14px] font-bold text-wk-text">Failed to load media assets</p>
          <p className="text-[13px] text-wk-text-muted">{loadError}</p>
          <button onClick={() => { setPage(0); load(); }} className="rounded-lg bg-wk-brand px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 cursor-pointer">
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
                    <th className="px-3 py-3 w-14">Preview</th>
                    <th className="px-3 py-3">Asset</th>
                    <th className="px-3 py-3 hidden sm:table-cell">URL</th>
                    <th className="px-3 py-3 hidden md:table-cell">Source</th>
                    <th className="px-3 py-3 hidden lg:table-cell">Refs</th>
                    <th className="px-3 py-3 w-[90px]">Status</th>
                    <th className="px-3 py-3 w-[130px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wk-border">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-20 text-center text-wk-text-muted">
                        <WkIcon name="Image" size={32} className="mx-auto mb-2 text-wk-text-faint" />
                        <p className="text-[14px] font-semibold">No media links found</p>
                        <p className="text-[12px] mt-1">Try adjusting your search or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-wk-surface-raised transition-colors ${
                          item.checkStatus === "broken" ? "bg-rose-50/50" : ""
                        }`}
                      >
                        {/* Preview */}
                        <td className="px-3 py-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-wk-surface-raised">
                            {item.checkStatus !== "broken" ? (
                              <img
                                src={item.url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-wk-text-faint">
                                <WkIcon name="ImageOff" size={16} />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Asset */}
                        <td className="px-3 py-3">
                          <div className="text-[13px] font-semibold text-wk-text truncate max-w-[180px]">
                            {item.title || item.slug}
                          </div>
                          <div className="text-[11px] text-wk-text-muted">
                            {item.source_entity || item.source_kind || "unknown"}
                          </div>
                        </td>

                        {/* URL */}
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-wk-text-muted hover:text-wk-brand truncate block max-w-[280px]"
                            title={item.url}
                          >
                            {item.url}
                          </a>
                        </td>

                        {/* Source */}
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className="text-[11px] text-wk-text-muted">{item.source_kind ?? "—"}</span>
                        </td>

                        {/* Refs */}
                        <td className="px-3 py-3 hidden lg:table-cell">
                          {item.refCount > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-wk-surface-raised px-2 py-0.5 text-[10px] font-bold text-wk-text cursor-default"
                              title={item.refEntities.join(", ")}
                            >
                              <WkIcon name="Link" size={10} />
                              {item.refCount} {item.refCount === 1 ? "ref" : "refs"}
                            </span>
                          ) : (
                            <span className="text-[10px] text-wk-text-faint">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          {item.checkStatus === "checking" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                              <WkIcon name="Loader2" size={10} className="animate-spin" />
                              Checking
                            </span>
                          ) : item.checkStatus === "ok" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              OK
                            </span>
                          ) : item.checkStatus === "broken" ? (
                            <span
                              className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 cursor-default"
                              title={item.checkError || "Link is dead"}
                            >
                              Broken
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              Unchecked
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {item.source_record_id && item.source_entity && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/admin/${entityTypeRoute(item.source_entity!)}/${item.source_record_id}`
                                  )
                                }
                                className="rounded-md p-1.5 text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text cursor-pointer"
                                title="Go to entity"
                              >
                                <WkIcon name="Pencil" size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleCheckOne(item)}
                              disabled={item.checkStatus === "checking"}
                              className="inline-flex items-center gap-1 rounded-md border border-wk-border px-2 py-1 text-[11px] font-semibold text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                              <WkIcon
                                name={item.checkStatus === "checking" ? "Loader2" : "RefreshCw"}
                                size={12}
                                className={item.checkStatus === "checking" ? "animate-spin" : ""}
                              />
                              Check
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary bar */}
          {sorted.length > 0 && (
            <div className="text-[11px] text-wk-text-muted px-1">
              Showing {sorted.length} of {totalCount.toLocaleString()} assets
              {filterStatus !== "all" && ` (filtered: ${filterStatus})`}
              {searchQuery && ` (search: "${searchQuery}")`}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-wk-border bg-wk-surface px-4 py-3">
              <span className="text-[12px] text-wk-text-muted">
                Page {page + 1} of {totalPages} &middot; {totalCount.toLocaleString()} total
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
    </div>
  );
}