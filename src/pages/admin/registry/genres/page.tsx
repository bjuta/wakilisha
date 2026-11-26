import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone } from "@/services/registry/admin/completeness";
import { getRegistryEntityList } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { WkSearchField } from "@/components/design-system/primitives/Field";


const schema = getEntitySchema("genre");
const PAGE_SIZE = 20;

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_description"
  | "missing_artist"
  | "blocked";

interface EnrichedGenre extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayName: string;
}

function getDisplayName(genre: RegistryEntityProfile): string {
  return String(genre.name ?? genre.slug ?? genre.id ?? "Untitled genre");
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
    <div className="flex items-center justify-between rounded-2xl border border-wk-border bg-wk-surface px-4 py-3">
      <span className="text-[12px] text-wk-text-muted">
        Showing <strong className="text-wk-text">{start}</strong>
        –<strong className="text-wk-text">{end}</strong> of{" "}
        <strong className="text-wk-text">{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted disabled:opacity-40 hover:border-wk-brand hover:text-wk-brand">
          <WkIcon name="ChevronLeft" size={16} />
        </button>
        {getVisiblePages().map((page, i) => typeof page === "string" ? (
          <span key={`dots-${i}`} className="px-2 text-[11px] text-wk-text-muted">…</span>
        ) : (
          <button key={page} onClick={() => onPageChange(page)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${page === currentPage ? "bg-wk-brand text-wk-brand-on" : "border border-wk-border text-wk-text-muted hover:border-wk-brand hover:text-wk-brand"}`}>
            {page}
          </button>
        ))}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted disabled:opacity-40 hover:border-wk-brand hover:text-wk-brand">
          <WkIcon name="ChevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Genre Card ─────────────── */

function GenreCard({
  genre,
  onOpen,
  onNavigate,
}: {
  genre: EnrichedGenre;
  onOpen: (genre: EnrichedGenre) => void;
  onNavigate: (slug: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const q = genre._quality;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-wk-border bg-wk-surface transition-all hover:border-wk-brand hover:shadow-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-wk-danger-soft text-wk-danger">
          <WkIcon name="Tags" size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <button onClick={() => onNavigate(genre.slug)} className="text-left text-[15px] font-bold text-wk-text hover:text-wk-brand transition-colors truncate block">
            {genre._displayName}
          </button>
          <p className="text-[11px] text-wk-text-muted truncate">{genre.slug}</p>
        </div>
        <button onClick={() => onOpen(genre)} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-wk-border text-wk-text-muted hover:border-wk-brand hover:text-wk-brand">
          <WkIcon name="Pencil" size={14} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="rounded-full bg-wk-danger-soft px-2 py-0.5 text-[10px] font-bold text-wk-danger uppercase tracking-wide">
            {String(genre.status || "—")}
          </span>
        </div>

        {genre.description && (
          <p className="mb-3 text-[12px] text-wk-text-muted leading-relaxed line-clamp-2">{String(genre.description)}</p>
        )}

        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-wk-text-muted uppercase tracking-wide">Completeness</span>
          <span className={`text-[11px] font-black ${completenessTone(q.completeness)}`}>{q.completeness}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-wk-surface-strong">
          <div className="h-full rounded-full bg-wk-brand transition-all" style={{ width: `${q.completeness}%` }} />
        </div>
        {q.missingFields.length > 0 && (
          <p className="mt-1 text-[10px] text-wk-text-muted truncate">Missing: {q.missingFields.join(", ")}</p>
        )}

        <div className={`flex items-center gap-2 mt-3 pt-3 border-t border-wk-divider transition-all ${hovered ? "opacity-100" : "opacity-0"}`}>
          <button onClick={() => onOpen(genre)} className="flex-1 rounded-lg bg-wk-brand px-3 py-1.5 text-[11px] font-bold text-wk-brand-on hover:opacity-90">
            Edit
          </button>
          <button onClick={() => onNavigate(genre.slug)} className="flex-1 rounded-lg border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text-muted hover:border-wk-brand hover:text-wk-brand">
            Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Page ─────────────── */

export default function GenresPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlFilter = searchParams.get("filter");

  const [genres, setGenres] = useState<RegistryEntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(
    (urlFilter as QualityFilter) || "all"
  );
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [page, setPage] = useState(1);

  const [artistSlugs, setArtistSlugs] = useState<Set<string>>(new Set());
  const [selectedGenre, setSelectedGenre] = useState<EnrichedGenre | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchGenres() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getRegistryEntityList("genre", { limit: 250 });
    if (fetchError) {
      setError(fetchError);
      setGenres([]);
    } else {
      setGenres(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchGenres();
  }, []);

  useEffect(() => {
    if (qualityFilter === "missing_artist") {
      supabase
        .from("registry_entity_relationships")
        .select("target_slug")
        .eq("relationship_type", "artist_genre")
        .eq("target_entity_type", "genres")
        .then(({ data }) => {
          setArtistSlugs(new Set((data ?? []).map((r) => r.target_slug).filter(Boolean)));
        });
    }
  }, [qualityFilter]);

  const enrichedGenres = useMemo<EnrichedGenre[]>(() => {
    return genres.map((genre) => ({
      ...genre,
      _quality: calculateCompleteness(genre, schema),
      _displayName: getDisplayName(genre),
    }));
  }, [genres]);

  const summary = useMemo(() => {
    const total = enrichedGenres.length;
    const complete = enrichedGenres.filter((g) => g._quality.completeness >= 85).length;
    const missingDescription = enrichedGenres.filter((g) => !g.description).length;
    const blocked = enrichedGenres.filter((g) => g._quality.state === "blocked").length;
    const averageCompleteness = total
      ? Math.round(enrichedGenres.reduce((sum, g) => sum + g._quality.completeness, 0) / total)
      : 0;
    return { total, complete, missingDescription, blocked, averageCompleteness };
  }, [enrichedGenres]);

  const filteredGenres = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedGenres.filter((genre) => {
      const searchable = [
        genre._displayName,
        genre.slug,
        genre.description,
        genre.status,
        genre.id,
      ].filter(Boolean).join(" ").toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter === "complete") return genre._quality.completeness >= 85;
      if (qualityFilter === "incomplete") return genre._quality.completeness < 85;
      if (qualityFilter === "missing_description") return !genre.description;
      if (qualityFilter === "missing_artist") return !artistSlugs.has(String(genre.slug));
      if (qualityFilter === "blocked") return genre._quality.state === "blocked";
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
  }, [enrichedGenres, query, qualityFilter, sortMode, artistSlugs]);

  const totalPages = Math.max(1, Math.ceil(filteredGenres.length / PAGE_SIZE));
  const pagedGenres = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredGenres.slice(start, start + PAGE_SIZE);
  }, [filteredGenres, page]);

  useEffect(() => {
    setPage(1);
  }, [query, qualityFilter, sortMode]);

  function handleSaved(updatedEntity: Record<string, unknown>) {
    setGenres((prev) => prev.map((genre) => genre.id === updatedEntity.id ? (updatedEntity as RegistryEntityProfile) : genre));
    showToast(`Saved ${getDisplayName(updatedEntity)}`);
  }

  return (
    <div data-wk-registry-entity-list="genres" className="min-w-0 bg-wk-bg px-5 py-6 text-wk-text">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-wk-border bg-wk-surface px-4 py-3 text-sm font-bold text-wk-text shadow-xl">
          {toast}
        </div>
      )}
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-wk-brand">Registry</p>
            <h1 className="text-3xl font-black tracking-tight">Genres</h1>
            <p className="mt-2 max-w-2xl text-sm text-wk-text-muted">
              {filteredGenres.length.toLocaleString()} genre{filteredGenres.length !== 1 ? "s" : ""} in registry
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={fetchGenres} className="rounded-2xl border border-wk-border bg-wk-surface px-4 py-3 text-sm font-black text-wk-text shadow-sm transition hover:border-wk-brand flex items-center gap-2">
              <WkIcon name="RefreshCcw" size={14} />
              Refresh
            </button>
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing desc.", summary.missingDescription],
            ["Blocked", summary.blocked],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-wk-border bg-wk-surface p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-wk-text-muted">{label}</p>
              <p className="mt-2 text-2xl font-black text-wk-text">{value as number}</p>
            </div>
          ))}
        </section>

        <section className="mb-5 rounded-2xl border border-wk-border bg-wk-surface p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
            <WkSearchField value={query} onChange={setQuery} ariaLabel="Search genres" placeholder="Search genres by name, slug, description, status..." />
            <WkSelect value={qualityFilter} onChange={(value) => setQualityFilter(value as QualityFilter)} triggerClassName="h-11 rounded-xl border border-wk-border bg-wk-surface-raised px-3 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface">
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_description">Missing description</option>
              <option value="missing_artist">Missing artist</option>
              <option value="blocked">Blocked</option>
            </WkSelect>
            <WkSelect value={sortMode} onChange={(value) => setSortMode(value as SortMode)} triggerClassName="h-11 rounded-xl border border-wk-border bg-wk-surface-raised px-3 text-sm outline-none transition focus:border-wk-brand focus:bg-wk-surface">
              <option value="recent">Recently updated</option>
              <option value="name">Name A-Z</option>
              <option value="completeness_low">Completeness low to high</option>
              <option value="completeness_high">Completeness high to low</option>
            </WkSelect>
          </div>
        </section>

        {error && (
          <section className="mb-4 rounded-2xl border border-wk-danger bg-wk-danger-soft p-4 text-sm font-semibold text-wk-danger">
            <p className="font-bold">Could not load registry genres</p>
            <p className="mt-1 text-xs">{error}</p>
            <button onClick={fetchGenres} className="mt-2 rounded-xl border border-wk-danger bg-wk-surface px-3 py-1.5 text-xs font-bold text-wk-danger hover:bg-wk-danger-soft">Retry</button>
          </section>
        )}

        {loading && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-wk-border bg-wk-surface">
            <div className="flex flex-col items-center gap-3">
              <WkIcon name="Loader2" size={28} className="animate-spin text-wk-brand" />
              <p className="text-[13px] font-bold text-wk-text-muted">Loading genres...</p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {filteredGenres.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-wk-border bg-wk-surface px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-surface-raised">
                  <WkIcon name="SearchX" size={28} className="text-wk-text-muted" />
                </div>
                <p className="text-[16px] font-black text-wk-text">No genres found</p>
                <p className="max-w-md text-[13px] text-wk-text-muted">
                  {query || qualityFilter !== "all" ? "No genres match your current filters." : "No live registry genres found."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pagedGenres.map((genre) => (
                    <GenreCard key={genre.id} genre={genre} onOpen={setSelectedGenre} onNavigate={(slug) => navigate(`/admin/registry/genres/${slug}`)} />
                  ))}
                </div>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredGenres.length} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        )}
      </div>

      {selectedGenre && (
        <RegistryEntityEditorDrawer entityType="genre" entity={selectedGenre} schema={schema} onClose={() => setSelectedGenre(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}