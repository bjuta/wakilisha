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

export default function AdminChartsFamilies() {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<ChartFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<ChartFamily | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveTarget, setArchiveTarget] = useState<ChartFamily | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    getChartFamilies()
      .then((result) => {
        setFamilies(result.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load chart programs");
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
    const matchStatus = statusFilter === "all" || statusFilter === "active";
    return matchSearch && matchStatus;
  });

  const handleArchive = (family: ChartFamily) => {
    setFamilies((prev) => prev.filter((f) => f.id !== family.id));
    setArchiveTarget(null);
    showToast(`"${family.label}" archived`);
    if (selectedFamily?.id === family.id) setSelectedFamily(null);
  };

  const activeCount = families.length;

  if (loading) return <AdminChartsLoadingState message="Loading chart programs…" />;

  if (error) {
    return (
      <div className="space-y-6">
        <AdminChartsPageHeader eyebrow="Chart Configuration" title="Chart Programs" description="V2 chart programs from the public API." />
        <AdminChartsEmptyState icon="AlertTriangle" title="Failed to load programs" description={error} />
      </div>
    );
  }

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
        description="This program will be removed from the active list."
        confirmLabel="Archive"
        variant="danger"
        onConfirm={() => archiveTarget && handleArchive(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />

      <AdminChartsPageHeader
        eyebrow="Chart Configuration"
        title="Chart Programs"
        description="V2 chart programs — each defines a series (what) × market (where). Data comes from the public chart API."
      >
        <button onClick={() => navigate("/admin/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <WkIcon name="Plus" size={14} /> New Ingest
        </button>
      </AdminChartsPageHeader>

      {/* V2 Ontology explainer */}
      <div className="rounded-lg border border-wk-border bg-wk-surface-raised p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-brand text-wk-brand-on">
            <WkIcon name="BarChart3" size={16} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-wk-text">V2 Chart Ontology: Program = Series × Market</p>
            <p className="mt-1 text-[12px] text-wk-text-muted">
              A <strong>ChartProgram</strong> is the combination of a <strong>ChartSeries</strong> (what is ranked — e.g., "R&B Songs") and a <strong>ChartMarket</strong> (where — e.g., "Kenya").
              Programs have canonical public slugs: <code className="bg-background-100 text-[11px] rounded px-1">rnb-kenya</code>, <code className="bg-background-100 text-[11px] rounded px-1">top-songs-kenya</code>.
              Data is loaded directly from the public chart API — no hardcoded mappings.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Program Mapping Table */}
      {families.length > 0 && (
        <WkSurface className="overflow-hidden">
          <div className="px-4 py-3 border-b border-wk-border flex items-center gap-2">
            <WkIcon name="Map" size={14} className="text-wk-brand" />
            <h2 className="text-[13px] font-bold text-wk-text">Program Mapping</h2>
            <span className="text-[11px] text-wk-text-muted ml-auto">
              {families.length} program{families.length !== 1 ? "s" : ""} ·{" "}
              {new Set(families.map((f) => f.seriesSlug).filter(Boolean)).size} series ·{" "}
              {new Set(families.map((f) => f.marketSlug).filter(Boolean)).size} market
              {new Set(families.map((f) => f.marketSlug).filter(Boolean)).size !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-wk-border">
                  {["Source Slug", "Series", "Market", "Public Slug (V2)", "Public Label", "Chart Size"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {families.map((f) => (
                  <tr key={f.id} className="border-b border-wk-border/50 hover:bg-wk-surface-raised/50 cursor-pointer" onClick={() => setSelectedFamily(selectedFamily?.id === f.id ? null : f)}>
                    <td className="px-4 py-2.5">
                      <code className="text-[11px] bg-wk-surface-raised border border-wk-border rounded px-1.5 py-0.5 text-wk-text-muted">{f.sourceFamilySlug ?? f.familyKey}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-[11px] text-wk-info">{f.seriesSlug ?? "—"}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-[11px] text-wk-warning">{f.marketSlug ?? "—"}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-[11px] font-bold text-wk-brand">{f.publicSlug ?? f.slug ?? "—"}</code>
                    </td>
                    <td className="px-4 py-2.5 text-wk-text">{f.publicLabel ?? f.label}</td>
                    <td className="px-4 py-2.5 text-wk-text-muted">{f.defaultChartSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WkSurface>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminChartsKpiCard value={families.length} label="Total Programs" icon="FolderTree" accent="muted" />
        <AdminChartsKpiCard value={activeCount} label="Active" icon="CheckCircle2" accent={families.length > 0 ? "success" : "muted"} />
        <AdminChartsKpiCard value={new Set(families.map((f) => f.seriesSlug).filter(Boolean)).size} label="Series" icon="Layers" accent="brand" />
        <AdminChartsKpiCard value={new Set(families.map((f) => f.marketSlug).filter(Boolean)).size} label="Markets" icon="Globe" accent="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search programs…"
            className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong" />
        </div>
        <div className="flex gap-1">
          {["all", "active"].map((s) => (
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
        <AdminChartsEmptyState
          icon="FolderTree"
          title={families.length === 0 ? "No chart programs yet" : "No programs match your filters"}
          description={
            families.length === 0
              ? "Import chart data from WordPress to populate programs, or create a new ingest run."
              : "Try clearing your search or updating filters."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((family) => (
            <ProgramCard
              key={family.id}
              family={family}
              selected={selectedFamily?.id === family.id}
              onClick={() => setSelectedFamily(selectedFamily?.id === family.id ? null : family)}
              onIngest={() => navigate("/admin/charts/ingest")}
              onArchive={() => setArchiveTarget(family)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedFamily && (
        <WkSurface className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[16px] font-bold text-wk-text">{selectedFamily.publicLabel ?? selectedFamily.label}</h2>
                <AdminChartsStatusBadge status="active" />
              </div>
              {selectedFamily.publicSlug && (
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-[12px] font-bold text-wk-brand bg-wk-surface-raised rounded px-2 py-0.5">{selectedFamily.publicSlug}</code>
                  <span className="text-[11px] text-wk-text-muted">V2 canonical slug</span>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedFamily(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised">
              <WkIcon name="X" size={16} />
            </button>
          </div>
          <p className="text-[13px] text-wk-text-soft mb-4">{selectedFamily.description}</p>

          {/* Program metadata from API */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {selectedFamily.seriesSlug && (
              <div className="rounded-lg bg-wk-info-soft p-2.5">
                <p className="text-[10px] font-bold uppercase text-wk-info">Series</p>
                <p className="mt-1 text-[13px] font-semibold text-wk-text">{selectedFamily.seriesSlug}</p>
                <p className="text-[11px] text-wk-text-muted">{selectedFamily.seriesLabel ?? "—"}</p>
              </div>
            )}
            {selectedFamily.marketSlug && (
              <div className="rounded-lg bg-wk-warning-soft p-2.5">
                <p className="text-[10px] font-bold uppercase text-wk-warning">Market</p>
                <p className="mt-1 text-[13px] font-semibold text-wk-text">{selectedFamily.marketSlug}</p>
                <p className="text-[11px] text-wk-text-muted">{selectedFamily.marketLabel ?? "—"}</p>
              </div>
            )}
            {selectedFamily.publicSlug && (
              <div className="rounded-lg bg-wk-brand-soft p-2.5">
                <p className="text-[10px] font-bold uppercase text-wk-brand">Public Slug</p>
                <p className="mt-1 text-[12px] font-bold text-wk-brand font-mono">{selectedFamily.publicSlug}</p>
              </div>
            )}
            <div className="rounded-lg bg-wk-surface-raised p-2.5">
              <p className="text-[10px] font-bold uppercase text-wk-text-faint">Chart Size</p>
              <p className="mt-1 text-[13px] font-semibold text-wk-text">{selectedFamily.defaultChartSize}</p>
              <p className="text-[11px] text-wk-text-muted">{selectedFamily.editionFrequency}</p>
            </div>
          </div>

          {/* Legacy slugs */}
          {selectedFamily.legacySlugs && selectedFamily.legacySlugs.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase text-wk-text-faint mb-1.5">Legacy Slugs</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedFamily.legacySlugs.map((slug) => (
                  <code key={slug} className="text-[11px] bg-wk-surface-raised border border-wk-border rounded px-2 py-0.5 text-wk-text-muted">{slug}</code>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate("/admin/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
              <WkIcon name="Plus" size={14} /> Start Ingest
            </button>
            <button onClick={() => navigate("/admin/charts/editions")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
              <WkIcon name="Layers" size={14} /> View Editions
            </button>
            <button onClick={() => navigate("/admin/charts/public-api-qa")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
              <WkIcon name="FlaskConical" size={14} /> API QA
            </button>
            <button onClick={() => setArchiveTarget(selectedFamily)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger border-wk-danger/30 hover:bg-wk-danger-soft">
              <WkIcon name="Archive" size={14} /> Archive
            </button>
          </div>
        </WkSurface>
      )}
    </div>
  );
}

function ProgramCard({
  family,
  selected,
  onClick,
  onIngest,
  onArchive,
}: {
  family: ChartFamily;
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
          ? "border-wk-brand bg-wk-surface-raised ring-1 ring-wk-brand"
          : "border-wk-border bg-wk-surface hover:border-wk-border-strong hover:bg-wk-surface-raised"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-surface-raised text-wk-brand">
          <WkIcon name="BarChart3" size={18} />
        </div>
        <AdminChartsStatusBadge status="active" size="sm" />
      </div>

      <h3 className="mt-3 text-[14px] font-bold text-wk-text">{family.publicLabel ?? family.label}</h3>
      {family.publicSlug && (
        <p className="text-[11px] font-mono text-wk-brand mt-0.5">{family.publicSlug}</p>
      )}
      <p className="mt-1 text-[12px] text-wk-text-muted line-clamp-2">{family.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {family.seriesSlug && (
          <span className="rounded bg-wk-info-soft px-1.5 py-0.5 text-[10px] font-semibold text-wk-info">{family.seriesSlug}</span>
        )}
        {family.marketSlug && (
          <span className="rounded bg-wk-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-wk-warning">{family.marketSlug}</span>
        )}
        <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.defaultChartSize} tracks</span>
        <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.editionFrequency}</span>
      </div>

      <div className="mt-3 flex gap-1 flex-wrap">
        <button onClick={(e) => { e.stopPropagation(); onIngest(); }}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <WkIcon name="Plus" size={12} /> Ingest
        </button>
        <button onClick={(e) => { e.stopPropagation(); onArchive(); }}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger border-wk-danger/20">
          <WkIcon name="Archive" size={12} />
        </button>
      </div>
    </div>
  );
}