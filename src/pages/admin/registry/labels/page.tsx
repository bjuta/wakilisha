import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone } from "@/services/registry/admin/completeness";
import { getRegistryEntityList } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";
import { WkIcon } from "@/components/design-system/Icon";

const schema = getEntitySchema("label");
const PAGE_SIZE = 20;

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_country"
  | "missing_description"
  | "blocked";

interface EnrichedLabel extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayName: string;
  _displayCountry: string;
}

function getDisplayName(label: RegistryEntityProfile): string {
  return String(label.name ?? label.slug ?? label.id ?? "Untitled label");
}

function getDisplayCountry(label: RegistryEntityProfile): string {
  return String(label.country_code ?? "");
}

/* ─────────────── Pagination helper ─────────────── */

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3">
      <span className="text-[12px] text-[#858c7e]">
        Showing <strong className="text-[#171712]">{start}</strong>
        –<strong className="text-[#171712]">{end}</strong> of{" "}
        <strong className="text-[#171712]">{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] disabled:opacity-40 hover:border-[#85c441] hover:text-[#5f8f2f]">
          <WkIcon name="ChevronLeft" size={16} />
        </button>
        {getVisiblePages().map((page, i) => typeof page === "string" ? (
          <span key={`dots-${i}`} className="px-2 text-[11px] text-[#858c7e]">…</span>
        ) : (
          <button key={page} onClick={() => onPageChange(page)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${page === currentPage ? "bg-[#5f8f2f] text-white" : "border border-[#dfe4d8] text-[#71796b] hover:border-[#85c441] hover:text-[#5f8f2f]"}`}>
            {page}
          </button>
        ))}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] disabled:opacity-40 hover:border-[#85c441] hover:text-[#5f8f2f]">
          <WkIcon name="ChevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Label Card ─────────────── */

function LabelCard({
  label,
  onOpen,
  onNavigate,
}: {
  label: EnrichedLabel;
  onOpen: (label: EnrichedLabel) => void;
  onNavigate: (slug: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const q = label._quality;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white transition-all hover:border-[#85c441] hover:shadow-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#e58524]">
          <WkIcon name="Building2" size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <button onClick={() => onNavigate(label.slug)} className="text-left text-[15px] font-bold text-[#171712] hover:text-[#5f8f2f] transition-colors truncate block">
            {label._displayName}
          </button>
          <p className="text-[11px] text-[#858c7e] truncate">{label.slug}</p>
        </div>
        <button onClick={() => onOpen(label)} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] hover:border-[#85c441] hover:text-[#5f8f2f]">
          <WkIcon name="Pencil" size={14} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 uppercase tracking-wide">
            {String(label.status || "—")}
          </span>
          {label._displayCountry && (
            <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide">
              {label._displayCountry}
            </span>
          )}
        </div>

        {label.description && (
          <p className="mb-3 text-[12px] text-[#858c7e] leading-relaxed line-clamp-2">{String(label.description)}</p>
        )}

        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-[#858c7e] uppercase tracking-wide">Completeness</span>
          <span className={`text-[11px] font-black ${completenessTone(q.completeness)}`}>{q.completeness}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
          <div className="h-full rounded-full bg-[#85c441] transition-all" style={{ width: `${q.completeness}%` }} />
        </div>
        {q.missingFields.length > 0 && (
          <p className="mt-1 text-[10px] text-[#a8ad9e] truncate">Missing: {q.missingFields.join(", ")}</p>
        )}

        <div className={`flex items-center gap-2 mt-3 pt-3 border-t border-[#e8ece2] transition-all ${hovered ? "opacity-100" : "opacity-0"}`}>
          <button onClick={() => onOpen(label)} className="flex-1 rounded-lg bg-[#5f8f2f] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#4d7526]">
            Edit
          </button>
          <button onClick={() => onNavigate(label.slug)} className="flex-1 rounded-lg border border-[#dfe4d8] px-3 py-1.5 text-[11px] font-bold text-[#71796b] hover:border-[#85c441] hover:text-[#5f8f2f]">
            Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Page ─────────────── */

export default function LabelsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlFilter = searchParams.get("filter");

  const [labels, setLabels] = useState<RegistryEntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(
    (urlFilter as QualityFilter) || "all"
  );
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [page, setPage] = useState(1);

  const [selectedLabel, setSelectedLabel] = useState<EnrichedLabel | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchLabels() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getRegistryEntityList("label", { limit: 250 });
    if (fetchError) {
      setError(fetchError);
      setLabels([]);
    } else {
      setLabels(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLabels();
  }, []);

  const enrichedLabels = useMemo<EnrichedLabel[]>(() => {
    return labels.map((label) => ({
      ...label,
      _quality: calculateCompleteness(label, schema),
      _displayName: getDisplayName(label),
      _displayCountry: getDisplayCountry(label),
    }));
  }, [labels]);

  const summary = useMemo(() => {
    const total = enrichedLabels.length;
    const complete = enrichedLabels.filter((l) => l._quality.completeness >= 85).length;
    const missingCountry = enrichedLabels.filter((l) => !l._displayCountry).length;
    const missingDescription = enrichedLabels.filter((l) => !l.description).length;
    const blocked = enrichedLabels.filter((l) => l._quality.state === "blocked").length;
    const averageCompleteness = total
      ? Math.round(enrichedLabels.reduce((sum, l) => sum + l._quality.completeness, 0) / total)
      : 0;
    return { total, complete, missingCountry, missingDescription, blocked, averageCompleteness };
  }, [enrichedLabels]);

  const filteredLabels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedLabels.filter((label) => {
      const searchable = [
        label._displayName,
        label._displayCountry,
        label.slug,
        label.description,
        label.status,
        label.id,
      ].filter(Boolean).join(" ").toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter === "complete") return label._quality.completeness >= 85;
      if (qualityFilter === "incomplete") return label._quality.completeness < 85;
      if (qualityFilter === "missing_country") return !label._displayCountry;
      if (qualityFilter === "missing_description") return !label.description;
      if (qualityFilter === "blocked") return label._quality.state === "blocked";
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sortMode === "name") return a._displayName.localeCompare(b._displayName);
      if (sortMode === "completeness_low") return a._quality.completeness - b._quality.completeness;
      if (sortMode === "completeness_high") return b._quality.completeness - a._quality.completeness;
      const aTime = new Date(String(a.updated_at || a.created_at || 0)).getTime();
      const bTime = new Date(String(b.updated_at || b.created_at || 0)).getTime();
      return bTime - aTime;
    });
    return rows;
  }, [enrichedLabels, query, qualityFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredLabels.length / PAGE_SIZE));
  const pagedLabels = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLabels.slice(start, start + PAGE_SIZE);
  }, [filteredLabels, page]);

  useEffect(() => {
    setPage(1);
  }, [query, qualityFilter, sortMode]);

  function handleSaved(updatedEntity: Record<string, unknown>) {
    setLabels((prev) => prev.map((label) => label.id === updatedEntity.id ? (updatedEntity as RegistryEntityProfile) : label));
    showToast(`Saved ${getDisplayName(updatedEntity)}`);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-bold text-[#171712] shadow-xl">
          {toast}
        </div>
      )}
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">Registry</p>
            <h1 className="text-3xl font-black tracking-tight">Labels</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              {filteredLabels.length.toLocaleString()} label{filteredLabels.length !== 1 ? "s" : ""} in registry
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={fetchLabels} className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441] flex items-center gap-2">
              <WkIcon name="RefreshCcw" size={14} />
              Refresh
            </button>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing country", summary.missingCountry],
            ["Missing desc.", summary.missingDescription],
            ["Blocked", summary.blocked],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">{label}</p>
              <p className="mt-2 text-2xl font-black text-[#171712]">{value as number}</p>
            </div>
          ))}
        </section>

        <section className="mb-5 rounded-2xl border border-[#dfe4d8] bg-white p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <WkIcon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8ad9e]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search labels by name, country, slug, description..." className="h-11 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] pl-10 pr-4 text-sm outline-none transition focus:border-[#85c441] focus:bg-white" />
            </div>
            <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value as QualityFilter)} className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white">
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_country">Missing country</option>
              <option value="missing_description">Missing description</option>
              <option value="blocked">Blocked</option>
            </select>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white">
              <option value="recent">Recently updated</option>
              <option value="name">Name A-Z</option>
              <option value="completeness_low">Completeness low to high</option>
              <option value="completeness_high">Completeness high to low</option>
            </select>
          </div>
        </section>

        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">Could not load registry labels</p>
            <p className="mt-1 text-xs">{error}</p>
            <button onClick={fetchLabels} className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">Retry</button>
          </section>
        )}

        {loading && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-white">
            <div className="flex flex-col items-center gap-3">
              <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
              <p className="text-[13px] font-bold text-[#697062]">Loading labels...</p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {filteredLabels.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#dfe4d8] bg-white px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                  <WkIcon name="SearchX" size={28} className="text-[#858c7e]" />
                </div>
                <p className="text-[16px] font-black text-[#171712]">No labels found</p>
                <p className="max-w-md text-[13px] text-[#697062]">
                  {query || qualityFilter !== "all" ? "No labels match your current filters." : "No live registry labels found."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pagedLabels.map((label) => (
                    <LabelCard key={label.id} label={label} onOpen={setSelectedLabel} onNavigate={(slug) => navigate(`/admin/registry/labels/${slug}`)} />
                  ))}
                </div>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredLabels.length} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        )}
      </div>

      {selectedLabel && (
        <RegistryEntityEditorDrawer entityType="label" entity={selectedLabel} schema={schema} onClose={() => setSelectedLabel(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}