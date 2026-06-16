import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { WkIcon } from "@/components/design-system/Icon";
import { getSupabaseChartFamilies, getSupabaseChartEditionsForFamily } from "@/services/chartsPublic/client";
import type { ChartEdition, ChartFamily } from "@/services/chartsPublic/client";
import { getAllV2Editions, refreshV2EditionStore } from "@/services/chartsIngestion/v2EditionStore";
import type { V2Edition } from "@/services/chartsIngestion/commitTypes";
import { reingestEdition } from "@/services/chartsIngestion/client";
import type { ReingestEditionResult } from "@/services/chartsIngestion/client";

// Augment with admin metadata (in production this comes from the backend)
interface AdminEdition extends ChartEdition {
  ingestRunId: string | null;
  ingestJobId: string | null;
  publishedBy: string | null;
  publicUrl: string | null;
}

function toAdminEdition(edition: ChartEdition, family: ChartFamily): AdminEdition {
  // Derive public URL from family slug and edition slug
  const familySlug = (family as ChartFamily & { sourceFamilySlug?: string }).sourceFamilySlug ?? family.familyKey;
  return {
    ...edition,
    ingestRunId: null,
    ingestJobId: null,
    publishedBy: "system",
    publicUrl: `/charts/${familySlug}/${edition.slug}`,
  };
}

export default function AdminChartsEditions() {
  const navigate = useNavigate();
  const [editions, setEditions] = useState<AdminEdition[]>([]);
  const [committedV2Editions, setCommittedV2Editions] = useState<V2Edition[]>([]);
  const [families, setFamilies] = useState<ChartFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"database" | "cache">("database");

  // ── Reingest state ──
  const [reingestingId, setReingestingId] = useState<string | null>(null);
  const [reingestResult, setReingestResult] = useState<ReingestEditionResult | null>(null);
  const [reingestError, setReingestError] = useState<string | null>(null);
  const [reingestDialogOpen, setReingestDialogOpen] = useState(false);
  const [pendingReingestId, setPendingReingestId] = useState<string | null>(null);
  const reingestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reingestRef.current && !reingestRef.current.contains(e.target as Node) && reingestDialogOpen) {
        setReingestDialogOpen(false);
      }
    }
    if (reingestDialogOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [reingestDialogOpen]);

  async function handleReingest(editionId: string) {
    setReingestDialogOpen(false);
    setReingestingId(editionId);
    setReingestError(null);
    setReingestResult(null);
    try {
      const result = await reingestEdition({ editionId, dryRun: true });
      setReingestResult(result);
    } catch (err) {
      setReingestError(err instanceof Error ? err.message : "Reingest failed");
    } finally {
      setReingestingId(null);
    }
  }

  function openReingestDialog(editionId: string) {
    setPendingReingestId(editionId);
    setReingestError(null);
    setReingestResult(null);
    setReingestDialogOpen(true);
  }

  useEffect(() => {
    async function load() {
      const families = await getSupabaseChartFamilies();
      setFamilies(families);
      setDataSource("database");

      // Load editions for all families in parallel
      const editionPromises = families.map((family) =>
        getSupabaseChartEditionsForFamily(family.familyKey)
          .then((editions) => editions.map((e) => toAdminEdition(e, family)))
          .catch(() => [] as AdminEdition[])
      );
      const results = await Promise.all(editionPromises);
      const allEditions = results.flat();
      // Sort by date descending
      allEditions.sort((a, b) => b.date.localeCompare(a.date));
      setEditions(allEditions);
      setLoading(false);
    }
    load();
  }, []);

  const familyNames = Array.from(new Set(editions.map((e) => e.familyId)));
  const familyLabel = (id: string) => families.find((f) => f.id === id || f.familyKey === id)?.label ?? id;

  const filtered = editions.filter((e) => {
    const matchStatus = filter === "all" || e.status === filter;
    const matchFamily = familyFilter === "all" || (e.familyId === familyFilter || familyLabel(e.familyId) === familyFilter);
    const matchSearch =
      !search ||
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase()) ||
      familyLabel(e.familyId).toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchFamily && matchSearch;
  });

  const publishedCount = editions.filter((e) => e.status === "published").length;
  const draftCount = editions.filter((e) => e.status === "draft").length;
  const totalNew = editions.reduce((s, e) => s + e.newEntries, 0);
  const totalEntries = editions.filter((e) => e.status === "published").reduce((s, e) => s + e.entryCount, 0);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setToastMsg("URL copied to clipboard");
    setTimeout(() => setToastMsg(null), 2000);
  };

  if (loading) return <AdminChartsLoadingState message="Loading editions from database…" />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Published Charts"
        title="Chart Editions"
        description="Committed chart outputs from all chart programs. Source: live database."
      >
        <button
          onClick={() => navigate("/admin/charts/ingest")}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Plus" size={14} />
          New Edition
        </button>
        <button
          onClick={() => navigate("/admin/charts/snapshots")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Camera" size={14} />
          Snapshots
        </button>
      </AdminChartsPageHeader>

      {/* Data source badge */}
      <div className="flex items-center gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
          dataSource === "database" ? "bg-wk-success-soft text-wk-success" :
          "bg-wk-info-soft text-wk-info"
        }`}>
          <WkIcon name={dataSource === "database" ? "Database" : "Database"} size={12} />
          {dataSource === "database" ? "Live Database" : "Cached"}
        </div>
        <span className="text-[12px] text-wk-text-muted">
          {editions.length} editions loaded across {families.length} chart programs
        </span>
      </div>

      {/* V2 Ontology callout */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { icon: "Database", color: "text-wk-info bg-wk-info-soft", title: "Run", desc: "The ingestion process. Provider fetches, normalizes, matches." },
          { icon: "Layers", color: "text-wk-brand bg-wk-brand-soft", title: "Edition", desc: "Committed chart output. Tied to a ChartProgram. This page.", active: true },
          { icon: "Lock", color: "text-wk-success bg-wk-success-soft", title: "Snapshot", desc: "Immutable record of what was published. Trust layer." },
        ].map(({ icon, color, title, desc, active }) => (
          <div key={title} className={`flex items-start gap-3 rounded-lg border p-3 ${active ? "border-wk-brand/20 bg-wk-brand-soft" : "border-wk-border bg-wk-surface"}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color}`}>
              <WkIcon name={icon as never} size={14} />
            </div>
            <div>
              <p className="text-[12px] font-bold text-wk-text">{title}</p>
              <p className="text-[11px] text-wk-text-muted">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminChartsKpiCard value={editions.length} label="Total Editions" icon="Layers" accent="muted" />
        <AdminChartsKpiCard value={publishedCount} label="Published" icon="CheckCircle2" accent="success" />
        <AdminChartsKpiCard value={draftCount} label="Drafts" icon="FileEdit" accent={draftCount > 0 ? "warning" : "muted"} />
        <AdminChartsKpiCard value={totalNew} label="New Entries (Total)" icon="Star" accent="brand" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search editions…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
          />
        </div>
        <select
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
          className="rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none"
        >
          <option value="all">All Programs</option>
          {familyNames.map((id) => (
            <option key={id} value={id}>{familyLabel(id)}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {["all", "published", "draft"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                filter === s ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Editions Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Edition", "Program", "Status", "Entries", "New", "Date", "Source", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((edition) => (
                <tr key={edition.id} className="border-b border-wk-border/50 transition-colors hover:bg-wk-surface-raised/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-wk-text">{edition.label}</div>
                    <div className="text-[11px] font-mono text-wk-text-muted">{edition.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft text-[12px]">{familyLabel(edition.familyId)}</td>
                  <td className="px-4 py-3">
                    <AdminChartsStatusBadge status={edition.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft">{edition.entryCount || "—"}</td>
                  <td className="px-4 py-3">
                    {edition.newEntries > 0 ? (
                      <span className="font-semibold text-wk-brand">{edition.newEntries}</span>
                    ) : (
                      <span className="text-wk-text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-wk-text-soft text-[12px]">{edition.date}</td>
                  <td className="px-4 py-3">
                    {edition.ingestRunId ? (
                      <button
                        onClick={() => navigate(`/admin/charts/ingest-runs/${edition.ingestRunId}`)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-wk-info hover:underline whitespace-nowrap"
                      >
                        <WkIcon name="Database" size={11} />
                        Run
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-wk-text-faint">
                        <WkIcon name="Globe" size={11} />
                        V2 API
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {edition.publicUrl && (
                        <a
                          href={edition.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-7 w-7 items-center justify-center rounded text-wk-brand hover:bg-wk-brand-soft transition-colors"
                          title="Open public URL"
                        >
                          <WkIcon name="Eye" size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => navigate("/admin/charts/snapshots")}
                        className="flex h-7 w-7 items-center justify-center rounded text-wk-success hover:bg-wk-success-soft transition-colors"
                        title="View snapshot"
                      >
                        <WkIcon name="Lock" size={14} />
                      </button>
                      {edition.publicUrl && (
                        <button
                          onClick={() => handleCopyUrl(edition.publicUrl!)}
                          className="flex h-7 w-7 items-center justify-center rounded text-wk-text-muted hover:bg-wk-surface-raised transition-colors"
                          title="Copy public URL"
                        >
                          <WkIcon name="Link" size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openReingestDialog(edition.id)}
                        disabled={reingestingId === edition.id}
                        className="flex h-7 w-7 items-center justify-center rounded text-wk-warning hover:bg-wk-warning-soft transition-colors disabled:opacity-50"
                        title="Re-process edition through registry resolution"
                      >
                        {reingestingId === edition.id ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-wk-warning/30 border-t-wk-warning" />
                        ) : (
                          <WkIcon name="RefreshCw" size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            {editions.length === 0 ? (
              <AdminChartsEmptyState
                icon="Layers"
                title="No editions found"
                description="No chart editions exist in the database yet. Create one from the Ingest Studio."
                action={{ label: "Open Ingest Studio", onClick: () => navigate("/admin/charts/ingest"), icon: "FlaskConical" }}
              />
            ) : (
              <AdminChartsEmptyState
                icon="Search"
                title="No editions match your filters"
                description="Try clearing the filters or publishing a new edition from the Ingest Studio."
              />
            )}
          </div>
        )}
      </WkSurface>

      {/* V2 summary stats */}
      {editions.length > 0 && (
        <WkSurface className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <WkIcon name="BarChart3" size={16} className="text-wk-brand" />
            <h2 className="text-[14px] font-bold text-wk-text">V2 Chart Program Summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {families.map((family) => {
              const familyEditions = editions.filter((e) => e.familyId === family.id || e.familyId === family.familyKey);
              return (
                <div key={family.id} className="rounded-lg bg-wk-surface-raised border border-wk-border p-3">
                  <p className="text-[11px] font-semibold text-wk-text-muted truncate">{family.label}</p>
                  <p className="text-[20px] font-black text-wk-text mt-1">{familyEditions.length}</p>
                  <p className="text-[10px] text-wk-text-faint">editions</p>
                  {familyEditions.length > 0 && (
                    <p className="text-[10px] text-wk-text-muted mt-1 truncate">Latest: {familyEditions[0].date}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-[12px] text-wk-text-muted">
            <strong className="text-wk-text">{totalEntries.toLocaleString()}</strong> total published entries across all programs.
            Data sourced directly from the database.
          </div>
        </WkSurface>
      )}

      {/* Reingest result panel */}
      {(reingestResult || reingestError) && (
        <div className={`rounded-lg border p-4 ${reingestResult ? "border-wk-success/20 bg-wk-success-soft" : "border-wk-danger/20 bg-wk-danger-soft"}`}>
          <div className="flex items-start gap-3">
            <WkIcon name={reingestResult ? "CheckCircle2" : "AlertCircle"} size={20} className={reingestResult ? "text-wk-success shrink-0 mt-0.5" : "text-wk-danger shrink-0 mt-0.5"} />
            <div className="flex-1 min-w-0">
              <p className={`text-[14px] font-bold mb-1 ${reingestResult ? "text-wk-success" : "text-wk-danger"}`}>
                {reingestResult ? `Reingest ${reingestResult.dry_run ? "Preview" : "Complete"} — ${reingestResult.edition_slug}` : "Reingest Failed"}
              </p>
              {reingestResult ? (
                <div className="text-[12px] text-wk-text grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  <span>Tracks found: <strong className="text-wk-success">{reingestResult.stats.tracks_found}</strong></span>
                  <span>Tracks created: <strong className="text-wk-brand">{reingestResult.stats.tracks_created}</strong></span>
                  <span>Artists found: <strong className="text-wk-success">{reingestResult.stats.artists_found}</strong></span>
                  <span>Artists created: <strong className="text-wk-brand">{reingestResult.stats.artists_created}</strong></span>
                  <span>Links created: <strong>{reingestResult.stats.links_created}</strong></span>
                  <span>Slugs fixed: <strong>{reingestResult.stats.artist_slugs_fixed}</strong></span>
                  <span>Canonical IDs: <strong>{reingestResult.stats.canonical_ids_set}</strong></span>
                  <span>Errors: <strong className={reingestResult.stats.errors > 0 ? "text-wk-danger" : ""}>{reingestResult.stats.errors}</strong></span>
                </div>
              ) : (
                <p className="text-[12px] text-wk-danger/90">{reingestError}</p>
              )}
              {reingestResult?.repairs && reingestResult.repairs.length > 0 && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-[11px] font-semibold text-wk-text-muted">Repairs ({reingestResult.repairs.length}):</p>
                  {reingestResult.repairs.slice(0, 6).map((r, i) => (
                    <div key={i} className="text-[11px] text-wk-text-soft flex items-center gap-2">
                      <span className="font-semibold">{r.track_title}</span>
                      <span className="text-wk-text-faint">by</span>
                      <span>{r.artist_name}</span>
                      <span className="rounded bg-wk-surface-raised border border-wk-border px-1.5 py-0.5 text-[10px] font-mono ml-auto">{r.action}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setReingestResult(null); setReingestError(null); }}
                className="mt-3 text-[11px] font-semibold text-wk-text-muted hover:text-wk-text transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reingest confirm dialog */}
      {reingestDialogOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
          <div ref={reingestRef} className="w-full max-w-sm rounded-xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="flex items-center gap-2">
              <WkIcon name="RefreshCw" size={18} className="text-wk-warning" />
              <h3 className="text-[15px] font-bold text-wk-text">Reingest Edition</h3>
            </div>
            <p className="mt-2 text-[13px] text-wk-text-muted">
              This will re-process this edition's entries through the registry. For each entry: it looks up existing registry tracks and artists, creates new ones where missing, links them up, and populates correct canonical IDs and slugs. Running as a dry run first.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setReingestDialogOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-wk-border-2 bg-wk-surface px-4 py-2 text-[13px] font-semibold text-wk-text transition-colors hover:bg-wk-surface-raised whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => pendingReingestId && handleReingest(pendingReingestId)}
                className="inline-flex items-center gap-1.5 rounded-md bg-wk-warning px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:opacity-90 whitespace-nowrap cursor-pointer"
              >
                Run Dry Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}