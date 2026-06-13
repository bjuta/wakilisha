import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { WkIcon } from "@/components/design-system/Icon";
import { getChartFamilies, getChartEditionsForFamily } from "@/services/chartsPublic/client";
import type { ChartEdition, ChartFamily } from "@/services/chartsPublic/client";
import { getAllV2Editions, refreshV2EditionStore } from "@/services/chartsIngestion/v2EditionStore";
import type { V2Edition } from "@/services/chartsIngestion/commitTypes";

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
  const [dataSource, setDataSource] = useState<"mock" | "wordpress" | "cache">("mock");

  useEffect(() => {
    async function load() {
      const familiesResult = await getChartFamilies();
      const allFamilies = familiesResult.data.families;
      setFamilies(allFamilies);
      setDataSource(familiesResult.meta.source);

      // Load editions for all families in parallel
      const editionPromises = allFamilies.map((family) =>
        getChartEditionsForFamily(family.familyKey)
          .then((result) => result.data.map((e) => toAdminEdition(e, family)))
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

  if (loading) return <AdminChartsLoadingState message="Loading editions from public API…" />;

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
        description="Committed chart outputs from all chart programs. Source: V2 public chart API."
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
          dataSource === "wordpress" ? "bg-wk-success-soft text-wk-success" :
          dataSource === "cache" ? "bg-wk-info-soft text-wk-info" :
          "bg-wk-warning-soft text-wk-warning"
        }`}>
          <WkIcon name={dataSource === "mock" ? "FlaskConical" : dataSource === "cache" ? "Database" : "Globe"} size={12} />
          {dataSource === "mock" ? "Mock data" : dataSource === "cache" ? "Cached" : "Live WordPress"}
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
                title="No editions loaded"
                description="Editions are loaded from the V2 public chart API. Make sure the public JSON data is available."
                action={{ label: "Open Public API QA", onClick: () => navigate("/admin/charts/public-api-qa"), icon: "FlaskConical" }}
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
            Data sourced from the V2 public chart API — same data served to the public site.
            Run{" "}
            <button
              onClick={() => navigate("/admin/charts/public-api-qa")}
              className="font-semibold text-wk-brand hover:underline"
            >
              Public API QA
            </button>
            {" "}to verify endpoint health.
          </div>
        </WkSurface>
      )}
    </div>
  );
}