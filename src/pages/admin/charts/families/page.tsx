import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsConfirmDialog } from "../components/AdminChartsConfirmDialog";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { WkIcon } from "@/components/design-system/Icon";
import { getChartFamilies } from "@/services/chartsPublic/client";
import type { ChartFamily } from "@/services/chartsPublic/client";

// V2 extended ChartFamily type
type V2ChartFamily = ChartFamily & {
  seriesSlug?: string;
  seriesLabel?: string;
  marketSlug?: string;
  marketLabel?: string;
  publicSlug?: string;
  publicLabel?: string;
  sourceFamilySlug?: string;
  status?: "active" | "inactive" | "archived";
  nextExpectedDate?: string | null;
  lastEditionDate?: string | null;
  sourceUrls?: string[];
};

// Well-known V2 programs with metadata
const V2_PROGRAMS: Record<string, { series: string; market: string; seriesLabel: string; marketLabel: string; publicSlug: string; status: "active" | "inactive" }> = {
  "top-songs-kenya": { series: "top-songs", market: "kenya", seriesLabel: "Top 100 Songs", marketLabel: "Kenya", publicSlug: "top-songs-kenya", status: "active" },
  "rnb-kenya": { series: "rnb", market: "kenya", seriesLabel: "R&B Songs", marketLabel: "Kenya", publicSlug: "rnb-kenya", status: "active" },
  "gengetone-kenya": { series: "gengetone", market: "kenya", seriesLabel: "Gengetone Songs", marketLabel: "Kenya", publicSlug: "gengetone-kenya", status: "active" },
  "2026-releases-kenya": { series: "2026-releases", market: "kenya", seriesLabel: "2026 Releases", marketLabel: "Kenya", publicSlug: "2026-releases-kenya", status: "active" },
};

function getV2Meta(family: V2ChartFamily) {
  if (family.publicSlug && V2_PROGRAMS[family.publicSlug]) return V2_PROGRAMS[family.publicSlug];
  const byKey = Object.values(V2_PROGRAMS).find((p) => p.series === family.familyKey || p.publicSlug === family.familyKey);
  return byKey || null;
}

export default function AdminChartsFamilies() {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<V2ChartFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<V2ChartFamily | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveTarget, setArchiveTarget] = useState<V2ChartFamily | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"mock" | "wordpress" | "cache">("mock");

  useEffect(() => {
    getChartFamilies().then((result) => {
      // Merge V2 metadata in
      const enriched = result.data.map((f) => {
        const v2 = getV2Meta(f as V2ChartFamily);
        return {
          ...f,
          status: "active" as const,
          sourceUrls: [],
          nextExpectedDate: null,
          lastEditionDate: null,
          ...v2 ? {
            seriesSlug: v2.series,
            seriesLabel: v2.seriesLabel,
            marketSlug: v2.market,
            marketLabel: v2.marketLabel,
            publicSlug: v2.publicSlug,
            publicLabel: `${v2.seriesLabel} · ${v2.marketLabel}`,
          } : {},
        } as V2ChartFamily;
      });
      setFamilies(enriched);
      setDataSource(result.meta.source);
      setLoading(false);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filtered = families.filter((f) => {
    const matchSearch = !search ||
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.familyKey.toLowerCase().includes(search.toLowerCase()) ||
      (f.publicSlug ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (f.status ?? "active") === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleArchive = (family: V2ChartFamily) => {
    setFamilies((prev) =>
      prev.map((f) => f.id === family.id ? { ...f, status: "archived" as const } : f)
    );
    setArchiveTarget(null);
    showToast(`"${family.label}" archived`);
    if (selectedFamily?.id === family.id) setSelectedFamily(null);
  };

  const activeCount = families.filter((f) => (f.status ?? "active") === "active").length;
  const missingV2Count = families.filter((f) => !f.publicSlug).length;

  if (loading) return <AdminChartsLoadingState message="Loading chart programs…" />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsConfirmDialog
        open={!!archiveTarget}
        title={`Archive "${archiveTarget?.label}"?`}
        description="This program will be archived. Existing editions remain accessible."
        confirmLabel="Archive"
        variant="danger"
        onConfirm={() => archiveTarget && handleArchive(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />

      <AdminChartsPageHeader
        eyebrow="Chart Configuration"
        title="Chart Programs"
        description="V2 chart programs — each defines a series (what) × market (where). Source: V2 public chart API."
      >
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
          dataSource === "wordpress" ? "bg-wk-success-soft text-wk-success" :
          dataSource === "cache" ? "bg-wk-info-soft text-wk-info" :
          "bg-wk-warning-soft text-wk-warning"
        }`}>
          <WkIcon name={dataSource === "mock" ? "FlaskConical" : dataSource === "cache" ? "Database" : "Globe"} size={12} />
          {dataSource}
        </div>
        <button onClick={() => navigate("/admin/settings/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <WkIcon name="Plus" size={14} /> New Ingest
        </button>
      </AdminChartsPageHeader>

      {/* V2 Ontology explainer */}
      <div className="rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand text-wk-brand-on">
            <WkIcon name="BarChart3" size={16} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-wk-text">V2 Chart Ontology: Program = Series × Market</p>
            <p className="mt-1 text-[12px] text-wk-text-muted">
              A <strong>ChartProgram</strong> is the combination of a <strong>ChartSeries</strong> (what is ranked — e.g., "R&B Songs") and a <strong>ChartMarket</strong> (where — e.g., "Kenya").
              Programs have canonical public slugs: <code className="bg-white/30 text-[11px] rounded px-1">rnb-kenya</code>, <code className="bg-white/30 text-[11px] rounded px-1">top-songs-kenya</code>.
              Legacy source slugs (<code className="bg-white/30 text-[11px] rounded px-1">rnb</code>, <code className="bg-white/30 text-[11px] rounded px-1">kenya</code>) redirect to canonical V2 slugs.
            </p>
          </div>
        </div>
      </div>

      {/* V2 Mapping Table */}
      <WkSurface className="overflow-hidden">
        <div className="px-4 py-3 border-b border-wk-border flex items-center gap-2">
          <WkIcon name="Map" size={14} className="text-wk-brand" />
          <h2 className="text-[13px] font-bold text-wk-text">V2 Program Mapping</h2>
          <span className="text-[11px] text-wk-text-muted ml-auto">4 programs · 4 series · 1 market (Kenya)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-wk-border">
                {["Source Slug (Legacy)", "Series Slug", "Market Slug", "Public Slug (V2)", "Public Label", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { source: "kenya", series: "top-songs", market: "kenya", slug: "top-songs-kenya", label: "Top 100 Songs · Kenya" },
                { source: "rnb", series: "rnb", market: "kenya", slug: "rnb-kenya", label: "R&B Songs · Kenya" },
                { source: "gengetone", series: "gengetone", market: "kenya", slug: "gengetone-kenya", label: "Gengetone Songs · Kenya" },
                { source: "2026", series: "2026-releases", market: "kenya", slug: "2026-releases-kenya", label: "2026 Releases · Kenya" },
              ].map((row) => (
                <tr key={row.slug} className="border-b border-wk-border/50 hover:bg-wk-surface-raised/50">
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] bg-wk-surface-raised border border-wk-border rounded px-1.5 py-0.5 text-wk-text-muted">{row.source}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] text-wk-info">{row.series}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] text-wk-warning">{row.market}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] font-bold text-wk-brand">{row.slug}</code>
                  </td>
                  <td className="px-4 py-2.5 text-wk-text">{row.label}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-semibold text-wk-success">
                      <WkIcon name="Check" size={10} />Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminChartsKpiCard value={families.length} label="Total Programs" icon="FolderTree" accent="muted" />
        <AdminChartsKpiCard value={activeCount} label="Active" icon="CheckCircle2" accent="success" />
        <AdminChartsKpiCard value={Object.keys(V2_PROGRAMS).length} label="V2 Wired" icon="Link" accent="brand" />
        <AdminChartsKpiCard value={missingV2Count} label="No V2 Slug" icon="AlertTriangle" accent={missingV2Count > 0 ? "warning" : "muted"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search programs…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong" />
        </div>
        <div className="flex gap-1">
          {["all", "active", "inactive", "archived"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                statusFilter === s ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"
              }`}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Programs Grid */}
      {filtered.length === 0 ? (
        <AdminChartsEmptyState icon="FolderTree" title="No programs found" description="Try clearing your search or updating filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((family) => {
            const v2 = getV2Meta(family);
            return (
              <ProgramCard
                key={family.id}
                family={family}
                v2={v2}
                selected={selectedFamily?.id === family.id}
                onClick={() => setSelectedFamily(selectedFamily?.id === family.id ? null : family)}
                onIngest={() => navigate("/admin/settings/charts/ingest")}
                onArchive={() => setArchiveTarget(family)}
              />
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selectedFamily && (
        <WkSurface className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[16px] font-bold text-wk-text">{selectedFamily.label}</h2>
                <AdminChartsStatusBadge status={selectedFamily.status ?? "active"} />
              </div>
              {selectedFamily.publicSlug && (
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-[12px] font-bold text-wk-brand bg-wk-brand-soft rounded px-2 py-0.5">{selectedFamily.publicSlug}</code>
                  <span className="text-[11px] text-wk-text-muted">V2 canonical slug</span>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedFamily(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised">
              <WkIcon name="X" size={16} />
            </button>
          </div>
          <p className="text-[13px] text-wk-text-soft mb-4">{selectedFamily.description}</p>

          {/* V2 Program info */}
          {(() => {
            const v2 = getV2Meta(selectedFamily);
            return v2 ? (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-wk-info-soft p-2.5">
                  <p className="text-[10px] font-bold uppercase text-wk-info">Series</p>
                  <p className="mt-1 text-[13px] font-semibold text-wk-text">{v2.series}</p>
                  <p className="text-[11px] text-wk-text-muted">{v2.seriesLabel}</p>
                </div>
                <div className="rounded-lg bg-wk-warning-soft p-2.5">
                  <p className="text-[10px] font-bold uppercase text-wk-warning">Market</p>
                  <p className="mt-1 text-[13px] font-semibold text-wk-text">{v2.market}</p>
                  <p className="text-[11px] text-wk-text-muted">{v2.marketLabel}</p>
                </div>
                <div className="rounded-lg bg-wk-brand-soft p-2.5">
                  <p className="text-[10px] font-bold uppercase text-wk-brand">Public Slug</p>
                  <p className="mt-1 text-[12px] font-bold text-wk-brand font-mono">{v2.publicSlug}</p>
                </div>
                <div className="rounded-lg bg-wk-surface-raised p-2.5">
                  <p className="text-[10px] font-bold uppercase text-wk-text-faint">Chart Size</p>
                  <p className="mt-1 text-[13px] font-semibold text-wk-text">{selectedFamily.defaultChartSize}</p>
                  <p className="text-[11px] text-wk-text-muted">{selectedFamily.editionFrequency}</p>
                </div>
              </div>
            ) : null;
          })()}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate("/admin/settings/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
              <WkIcon name="Plus" size={14} /> Start Ingest
            </button>
            <button onClick={() => navigate("/admin/settings/charts/editions")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
              <WkIcon name="Layers" size={14} /> View Editions
            </button>
            <button onClick={() => navigate("/admin/settings/charts/public-api-qa")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
              <WkIcon name="FlaskConical" size={14} /> API QA
            </button>
            {(selectedFamily.status ?? "active") !== "archived" && (
              <button onClick={() => setArchiveTarget(selectedFamily)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger border-wk-danger/30 hover:bg-wk-danger-soft">
                <WkIcon name="Archive" size={14} /> Archive
              </button>
            )}
          </div>
        </WkSurface>
      )}
    </div>
  );
}

function ProgramCard({
  family,
  v2,
  selected,
  onClick,
  onIngest,
  onArchive,
}: {
  family: V2ChartFamily;
  v2: (typeof V2_PROGRAMS)[string] | null;
  selected: boolean;
  onClick: () => void;
  onIngest: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${
        selected
          ? "border-wk-brand bg-wk-brand-soft ring-1 ring-wk-brand"
          : "border-wk-border bg-wk-surface hover:border-wk-border-2 hover:bg-wk-surface-raised"
      } ${(family.status ?? "active") === "archived" ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
          <WkIcon name="BarChart3" size={18} />
        </div>
        <div className="flex items-center gap-1.5">
          {v2 && (
            <span className="rounded-full bg-wk-brand-soft px-1.5 py-0.5 text-[9px] font-bold text-wk-brand">V2</span>
          )}
          <AdminChartsStatusBadge status={family.status ?? "active"} size="sm" />
        </div>
      </div>

      <h3 className="mt-3 text-[14px] font-bold text-wk-text">{family.label}</h3>
      {v2 && (
        <p className="text-[11px] font-mono text-wk-brand mt-0.5">{v2.publicSlug}</p>
      )}
      <p className="mt-1 text-[12px] text-wk-text-muted line-clamp-2">{family.description}</p>

      {v2 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded bg-wk-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-wk-info">{v2.series}</span>
          <span className="rounded bg-wk-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-wk-warning">{v2.market}</span>
          <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.defaultChartSize} tracks</span>
          <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.editionFrequency}</span>
        </div>
      )}

      <div className="mt-3 flex gap-1 flex-wrap">
        <button onClick={(e) => { e.stopPropagation(); onIngest(); }}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <WkIcon name="Plus" size={12} /> Ingest
        </button>
        {(family.status ?? "active") !== "archived" && (
          <button onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger border-wk-danger/20">
            <WkIcon name="Archive" size={12} />
          </button>
        )}
      </div>
    </div>
  );
}