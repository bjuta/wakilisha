import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "../components/AdminChartsKpiCard";
import { AdminChartsEmptyState } from "../components/AdminChartsEmptyState";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsConfirmDialog } from "../components/AdminChartsConfirmDialog";

interface ChartFamily {
  id: string;
  familyKey: string;
  label: string;
  description: string;
  defaultChartSize: number;
  defaultRegion: string;
  editionFrequency: "weekly" | "monthly" | "daily";
  defaultRuleset: string;
  defaultScoringModel: string;
  status: "active" | "inactive" | "archived";
  lastEditionDate: string | null;
  nextExpectedDate: string | null;
  sourceUrls: string[];
  createdAt: string;
  updatedAt: string;
}

const INITIAL_FAMILIES: ChartFamily[] = [
  {
    id: "wakilisha-top-40",
    familyKey: "wakilisha_top_40",
    label: "WAKILISHA Top 40",
    description: "The definitive weekly chart of the most streamed African tracks across all platforms.",
    defaultChartSize: 40,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "standard_weekly",
    defaultScoringModel: "weighted_multi_source_v1",
    status: "active",
    lastEditionDate: "2026-05-30",
    nextExpectedDate: "2026-06-06",
    sourceUrls: ["https://open.spotify.com/playlist/wakilisha-top40"],
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2026-05-30T12:00:00Z",
  },
  {
    id: "wakilisha-top-100",
    familyKey: "wakilisha_top_100",
    label: "WAKILISHA Top 100",
    description: "Extended weekly chart capturing the full breadth of African music consumption.",
    defaultChartSize: 100,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "standard_weekly",
    defaultScoringModel: "weighted_multi_source_v1",
    status: "active",
    lastEditionDate: "2026-05-30",
    nextExpectedDate: "2026-06-06",
    sourceUrls: ["https://open.spotify.com/playlist/wakilisha-top100"],
    createdAt: "2025-02-01T10:00:00Z",
    updatedAt: "2026-05-30T12:00:00Z",
  },
  {
    id: "afrobeats-top-20",
    familyKey: "wakilisha_afrobeats_20",
    label: "Afrobeats Top 20",
    description: "Weekly Afrobeats-specific chart focused on the genre&apos;s global reach.",
    defaultChartSize: 20,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "genre_specific",
    defaultScoringModel: "weighted_multi_source_v1",
    status: "active",
    lastEditionDate: "2026-05-30",
    nextExpectedDate: "2026-06-06",
    sourceUrls: [],
    createdAt: "2025-03-10T10:00:00Z",
    updatedAt: "2026-05-28T09:00:00Z",
  },
  {
    id: "gengetone-top-20",
    familyKey: "wakilisha_gengetone_20",
    label: "Gengetone Top 20",
    description: "Kenyan Gengetone chart tracking the most popular tracks in the genre.",
    defaultChartSize: 20,
    defaultRegion: "Kenya",
    editionFrequency: "weekly",
    defaultRuleset: "genre_specific",
    defaultScoringModel: "weighted_multi_source_v1",
    status: "active",
    lastEditionDate: "2026-05-23",
    nextExpectedDate: "2026-06-06",
    sourceUrls: [],
    createdAt: "2025-04-01T10:00:00Z",
    updatedAt: "2026-05-23T12:00:00Z",
  },
  {
    id: "rnb-top-20",
    familyKey: "wakilisha_rnb_20",
    label: "R&B Top 20",
    description: "African R&B chart highlighting the best R&B tracks from the continent.",
    defaultChartSize: 20,
    defaultRegion: "Africa",
    editionFrequency: "weekly",
    defaultRuleset: "genre_specific",
    defaultScoringModel: "weighted_multi_source_v1",
    status: "inactive",
    lastEditionDate: "2026-04-20",
    nextExpectedDate: null,
    sourceUrls: [],
    createdAt: "2025-04-15T10:00:00Z",
    updatedAt: "2026-04-20T12:00:00Z",
  },
];

type ModalMode = "create" | "edit" | null;
const EMPTY_FAMILY: Omit<ChartFamily, "id" | "createdAt" | "updatedAt"> = {
  familyKey: "",
  label: "",
  description: "",
  defaultChartSize: 40,
  defaultRegion: "Africa",
  editionFrequency: "weekly",
  defaultRuleset: "standard_weekly",
  defaultScoringModel: "weighted_multi_source_v1",
  status: "active",
  lastEditionDate: null,
  nextExpectedDate: null,
  sourceUrls: [],
};

export default function AdminChartsFamilies() {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<ChartFamily[]>(INITIAL_FAMILIES);
  const [selectedFamily, setSelectedFamily] = useState<ChartFamily | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<Omit<ChartFamily, "id" | "createdAt" | "updatedAt">>(EMPTY_FAMILY);
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ChartFamily | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filtered = families.filter((f) => {
    const matchSearch = !search ||
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.familyKey.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => {
    setFormData(EMPTY_FAMILY);
    setFormError(null);
    setModalMode("create");
  };

  const openEdit = (family: ChartFamily) => {
    setFormData({ ...family });
    setFormError(null);
    setSelectedFamily(family);
    setModalMode("edit");
  };

  const handleDuplicate = (family: ChartFamily) => {
    const newFamily: ChartFamily = {
      ...family,
      id: `${family.familyKey}_copy_${Date.now()}`,
      familyKey: `${family.familyKey}_copy`,
      label: `${family.label} (Copy)`,
      status: "inactive",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFamilies((prev) => [...prev, newFamily]);
    showToast(`"${family.label}" duplicated`);
  };

  const handleArchive = (family: ChartFamily) => {
    setFamilies((prev) =>
      prev.map((f) => f.id === family.id ? { ...f, status: "archived", updatedAt: new Date().toISOString() } : f)
    );
    setArchiveTarget(null);
    showToast(`"${family.label}" archived`);
    if (selectedFamily?.id === family.id) setSelectedFamily(null);
  };

  const validateForm = (): string | null => {
    if (!formData.label.trim()) return "Label is required";
    if (!formData.familyKey.trim()) return "Family key is required";
    if (!/^[a-z0-9_]+$/.test(formData.familyKey)) return "Family key must be lowercase alphanumeric with underscores only";
    if (formData.defaultChartSize < 1 || formData.defaultChartSize > 200) return "Chart size must be 1–200";
    if (modalMode === "create") {
      const dup = families.find((f) => f.familyKey === formData.familyKey);
      if (dup) return `Family key "${formData.familyKey}" already exists as "${dup.label}"`;
    }
    return null;
  };

  const handleSave = () => {
    const error = validateForm();
    if (error) { setFormError(error); return; }
    if (modalMode === "create") {
      const newFamily: ChartFamily = {
        ...formData,
        id: formData.familyKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setFamilies((prev) => [...prev, newFamily]);
      showToast(`"${newFamily.label}" created`);
    } else if (modalMode === "edit" && selectedFamily) {
      setFamilies((prev) =>
        prev.map((f) => f.id === selectedFamily.id ? { ...f, ...formData, updatedAt: new Date().toISOString() } : f)
      );
      setSelectedFamily((prev) => prev ? { ...prev, ...formData, updatedAt: new Date().toISOString() } : null);
      showToast(`"${formData.label}" updated`);
    }
    setModalMode(null);
    setFormError(null);
  };

  const handleLabelChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      label: value,
      ...(modalMode === "create" && !prev.familyKey ? {
        familyKey: value.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_").substring(0, 50),
      } : {}),
    }));
  };

  const activeCount = families.filter((f) => f.status === "active").length;
  const missingSourceCount = families.filter((f) => f.sourceUrls.length === 0 && f.status === "active").length;
  const totalFamilies = families.length;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-surface-strong px-4 py-3 text-[13px] font-semibold text-wk-text shadow-lg border border-wk-border">
          {toastMsg}
        </div>
      )}

      <AdminChartsConfirmDialog
        open={!!archiveTarget}
        title={`Archive "${archiveTarget?.label}"?`}
        description="This family will be archived. Existing editions remain accessible. You can reactivate it later."
        confirmLabel="Archive Family"
        variant="danger"
        onConfirm={() => archiveTarget && handleArchive(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
      />

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl border border-wk-border bg-wk-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-wk-text">
                {modalMode === "create" ? "New Chart Family" : `Edit — ${selectedFamily?.label}`}
              </h2>
              <button onClick={() => { setModalMode(null); setFormError(null); }} className="flex h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised">
                <i className="ri-close-line" />
              </button>
            </div>
            {formError && (
              <div className="mb-4 rounded-lg border border-wk-danger/20 bg-wk-danger-soft px-3 py-2 text-[13px] text-wk-danger">
                <i className="ri-error-warning-line mr-1" />{formError}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Label *</label>
                  <input type="text" value={formData.label} onChange={(e) => handleLabelChange(e.target.value)} placeholder="WAKILISHA Top 40" className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Family Key *</label>
                  <input type="text" value={formData.familyKey} onChange={(e) => setFormData((p) => ({ ...p, familyKey: e.target.value }))} placeholder="wakilisha_top_40" className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] font-mono text-wk-text outline-none focus:border-wk-border-strong" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Chart Size *</label>
                  <input type="number" min={1} max={200} value={formData.defaultChartSize} onChange={(e) => setFormData((p) => ({ ...p, defaultChartSize: Number(e.target.value) }))} className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Region</label>
                  <select value={formData.defaultRegion} onChange={(e) => setFormData((p) => ({ ...p, defaultRegion: e.target.value }))} className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none">
                    {["Africa", "Kenya", "Nigeria", "South Africa", "Ghana", "East Africa", "Global"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Frequency</label>
                  <select value={formData.editionFrequency} onChange={(e) => setFormData((p) => ({ ...p, editionFrequency: e.target.value as ChartFamily["editionFrequency"] }))} className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Ruleset</label>
                  <select value={formData.defaultRuleset} onChange={(e) => setFormData((p) => ({ ...p, defaultRuleset: e.target.value }))} className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none">
                    <option value="standard_weekly">standard_weekly</option>
                    <option value="genre_specific">genre_specific</option>
                    <option value="regional">regional</option>
                    <option value="editorial">editorial</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-wk-text-muted">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as ChartFamily["status"] }))} className="w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => { setModalMode(null); setFormError(null); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Cancel</button>
              <button onClick={handleSave} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
                <i className="ri-save-line" />
                {modalMode === "create" ? "Create Family" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminChartsPageHeader
        eyebrow="Chart Configuration"
        title="Chart Families"
        description="Manage chart series configurations. Families are the backbone of Ingest Studio."
      >
        <button onClick={openCreate} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">
          <i className="ri-add-line" /> New Family
        </button>
      </AdminChartsPageHeader>

      {/* Warning: families missing source URLs */}
      {missingSourceCount > 0 && (
        <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 flex items-start gap-2">
          <i className="ri-alert-line text-wk-warning mt-0.5" />
          <div className="text-[12px] text-wk-warning">
            <strong>{missingSourceCount} active famil{missingSourceCount !== 1 ? "ies" : "y"}</strong> {missingSourceCount !== 1 ? "have" : "has"} no source URLs configured.
            Ingest Studio won&apos;t be able to fetch data without source URLs.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminChartsKpiCard value={totalFamilies} label="Total Families" icon="ri-folder-chart-line" accent="muted" />
        <AdminChartsKpiCard value={activeCount} label="Active" icon="ri-check-line" accent="success" />
        <AdminChartsKpiCard value={families.filter((f) => f.status === "inactive").length} label="Inactive" icon="ri-pause-line" accent="muted" />
        <AdminChartsKpiCard value={missingSourceCount} label="Missing Sources" icon="ri-alert-line" accent={missingSourceCount > 0 ? "warning" : "muted"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-wk-text-faint text-[13px]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search families…" className="w-full rounded-lg border border-wk-border bg-wk-surface py-2 pl-9 pr-3 text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong" />
        </div>
        <div className="flex gap-1">
          {["all", "active", "inactive", "archived"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${statusFilter === s ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface text-wk-text-soft border border-wk-border hover:bg-wk-surface-raised"}`}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Families Grid */}
      {filtered.length === 0 ? (
        <AdminChartsEmptyState
          icon="ri-folder-chart-line"
          title="No families found"
          description="Try clearing your search or create a new chart family."
          action={{ label: "New Family", onClick: openCreate, icon: "ri-add-line" }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((family) => (
            <FamilyCard
              key={family.id}
              family={family}
              selected={selectedFamily?.id === family.id}
              onClick={() => setSelectedFamily(selectedFamily?.id === family.id ? null : family)}
              onIngest={() => navigate("/admin/charts/ingest")}
              onEdit={() => openEdit(family)}
              onDuplicate={() => handleDuplicate(family)}
              onArchive={() => setArchiveTarget(family)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedFamily && !modalMode && (
        <WkSurface className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-wk-text">{selectedFamily.label}</h2>
                <AdminChartsStatusBadge status={selectedFamily.status} />
              </div>
              <p className="text-[12px] font-mono text-wk-text-muted mt-0.5">{selectedFamily.familyKey}</p>
            </div>
            <button onClick={() => setSelectedFamily(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-wk-text-muted hover:bg-wk-surface-raised">
              <i className="ri-close-line" />
            </button>
          </div>
          <p className="text-[13px] text-wk-text-soft mb-4">{selectedFamily.description}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            {[
              { label: "Chart Size", value: selectedFamily.defaultChartSize },
              { label: "Frequency", value: selectedFamily.editionFrequency },
              { label: "Region", value: selectedFamily.defaultRegion },
              { label: "Ruleset", value: selectedFamily.defaultRuleset },
              { label: "Scoring Model", value: selectedFamily.defaultScoringModel },
              { label: "Last Edition", value: selectedFamily.lastEditionDate || "Never" },
              { label: "Next Expected", value: selectedFamily.nextExpectedDate || "Not scheduled" },
              { label: "Source URLs", value: `${selectedFamily.sourceUrls.length} configured` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-wk-surface-raised p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-wk-text">{value}</p>
              </div>
            ))}
          </div>
          {selectedFamily.sourceUrls.length === 0 && (
            <div className="mb-4 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 text-[12px] text-wk-warning">
              <i className="ri-alert-line mr-1" />
              No source URLs configured. Ingest Studio cannot fetch data for this family.
              <button onClick={() => openEdit(selectedFamily)} className="ml-2 font-semibold underline hover:no-underline">Add source URLs</button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openEdit(selectedFamily)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><i className="ri-edit-line" /> Edit</button>
            <button onClick={() => handleDuplicate(selectedFamily)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><i className="ri-file-copy-line" /> Duplicate</button>
            <button onClick={() => navigate("/admin/charts/ingest")} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"><i className="ri-add-line" /> Start Ingest</button>
            <button onClick={() => navigate("/admin/charts/editions")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><i className="ri-stack-line" /> View Editions</button>
            {selectedFamily.status !== "archived" && (
              <button onClick={() => setArchiveTarget(selectedFamily)} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger border-wk-danger/30 hover:bg-wk-danger-soft">
                <i className="ri-archive-line" /> Archive
              </button>
            )}
          </div>
        </WkSurface>
      )}
    </div>
  );
}

function FamilyCard({
  family,
  selected,
  onClick,
  onIngest,
  onEdit,
  onDuplicate,
  onArchive,
}: {
  family: ChartFamily;
  selected: boolean;
  onClick: () => void;
  onIngest: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const hasWarning = family.sourceUrls.length === 0 && family.status === "active";
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${
        selected
          ? "border-wk-brand bg-wk-brand-soft ring-1 ring-wk-brand"
          : "border-wk-border bg-wk-surface hover:border-wk-border-2 hover:bg-wk-surface-raised"
      } ${family.status === "archived" ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
          <i className="ri-bar-chart-grouped-line text-lg" />
        </div>
        <div className="flex items-center gap-1.5">
          {hasWarning && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-wk-warning-soft text-wk-warning" title="No source URLs">
              <i className="ri-alert-line text-[12px]" />
            </div>
          )}
          <AdminChartsStatusBadge status={family.status} size="sm" />
        </div>
      </div>
      <h3 className="mt-3 text-[14px] font-bold text-wk-text">{family.label}</h3>
      <p className="mt-1 text-[12px] text-wk-text-muted line-clamp-2">{family.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.defaultChartSize} tracks</span>
        <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.defaultRegion}</span>
        <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{family.editionFrequency}</span>
        {family.lastEditionDate && (
          <span className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">Last: {family.lastEditionDate}</span>
        )}
      </div>
      <div className="mt-3 flex gap-1 flex-wrap">
        <button onClick={(e) => { e.stopPropagation(); onIngest(); }} disabled={family.status !== "active"} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap disabled:opacity-40" title={family.status !== "active" ? "Activate this family to start ingest" : undefined}>
          <i className="ri-add-line" /> Ingest
        </button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <i className="ri-edit-line" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <i className="ri-file-copy-line" />
        </button>
        {family.status !== "archived" && (
          <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap text-wk-danger border-wk-danger/20">
            <i className="ri-archive-line" />
          </button>
        )}
      </div>
    </div>
  );
}