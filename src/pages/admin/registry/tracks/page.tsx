import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone } from "@/services/registry/admin/completeness";
import { getRegistryEntityList } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";
import { WkIcon } from "@/components/design-system/Icon";

const schema = getEntitySchema("track");
const PAGE_SIZE = 20;
const FETCH_LIMIT = 5000;

type SortMode = "recent" | "title" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_isrc"
  | "missing_artwork"
  | "missing_duration"
  | "missing_artist"
  | "missing_release"
  | "blocked";

interface EnrichedTrack extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayTitle: string;
  _displayDuration: string;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] disabled:opacity-40 hover:border-[#85c441] hover:text-[#5f8f2f]"
        >
          <WkIcon name="ChevronLeft" size={16} />
        </button>
        {getVisiblePages().map((page, i) =>
          typeof page === "string" ? (
            <span key={`dots-${i}`} className="px-2 text-[11px] text-[#858c7e]">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${
                page === currentPage
                  ? "bg-[#5f8f2f] text-white"
                  : "border border-[#dfe4d8] text-[#71796b] hover:border-[#85c441] hover:text-[#5f8f2f]"
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] disabled:opacity-40 hover:border-[#85c441] hover:text-[#5f8f2f]"
        >
          <WkIcon name="ChevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Track Card ─────────────── */

function TrackCard({
  track,
  onOpen,
  onNavigate,
}: {
  track: EnrichedTrack;
  onOpen: (track: EnrichedTrack) => void;
  onNavigate: (slug: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const q = track._quality;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white transition-all hover:border-[#85c441] hover:shadow-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Artwork area */}
      <div className="relative aspect-square bg-[#f0f3ec]">
        {track.artwork_url ? (
          <img
            src={String(track.artwork_url)}
            alt={track._displayTitle}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <WkIcon name="Music" size={40} className="text-[#c8d0be]" />
          </div>
        )}
        {/* Hover overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex gap-2">
            <button
              onClick={() => onOpen(track)}
              className="rounded-xl bg-white px-4 py-2 text-[12px] font-bold text-[#171712] hover:bg-[#f0f3ec]"
            >
              Edit
            </button>
            <button
              onClick={() => onNavigate(track.slug)}
              className="rounded-xl border border-white/50 px-4 py-2 text-[12px] font-bold text-white hover:bg-white/20"
            >
              Details
            </button>
          </div>
        </div>
        {/* Duration badge */}
        {track._displayDuration !== "—" && (
          <div className="absolute right-3 top-3">
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              {track._displayDuration}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => onNavigate(track.slug)}
              className="text-left text-[14px] font-bold text-[#171712] hover:text-[#5f8f2f] transition-colors truncate block"
            >
              {track._displayTitle}
            </button>
            <p className="mt-0.5 text-[11px] text-[#858c7e] truncate">{track.slug}</p>
          </div>
          <button
            onClick={() => onOpen(track)}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe4d8] text-[#858c7e] hover:border-[#85c441] hover:text-[#5f8f2f]"
            title="Quick edit"
          >
            <WkIcon name="Pencil" size={14} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {track.isrc && (
            <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide font-mono">
              {String(track.isrc)}
            </span>
          )}
          <span className="rounded-full bg-[#f0f3ec] px-2 py-0.5 text-[10px] font-bold text-[#71796b] uppercase tracking-wide">
            {String(track.status || "—")}
          </span>
        </div>

        {/* Completeness bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#858c7e] uppercase tracking-wide">Completeness</span>
            <span className={`text-[11px] font-black ${completenessTone(q.completeness)}`}>
              {q.completeness}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
            <div
              className="h-full rounded-full bg-[#85c441] transition-all"
              style={{ width: `${q.completeness}%` }}
            />
          </div>
          {q.missingFields.length > 0 && (
            <p className="mt-1 text-[10px] text-[#a8ad9e] truncate">
              Missing: {q.missingFields.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Page ─────────────── */

export default function TracksPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlFilter = searchParams.get("filter");

  const [tracks, setTracks] = useState<RegistryEntityProfile[]>([]);
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
  const [releaseSlugs, setReleaseSlugs] = useState<Set<string>>(new Set());
  const [selectedTrack, setSelectedTrack] = useState<EnrichedTrack | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchTracks() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getRegistryEntityList("track", { limit: FETCH_LIMIT });
    if (fetchError) {
      setError(fetchError);
      setTracks([]);
    } else {
      setTracks(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    if (qualityFilter === "missing_artist") {
      supabase
        .from("registry_entity_relationships")
        .select("target_slug")
        .eq("relationship_type", "artist_track")
        .eq("target_entity_type", "tracks")
        .then(({ data }) => {
          setArtistSlugs(new Set((data ?? []).map((r) => r.target_slug).filter(Boolean)));
        });
    }
  }, [qualityFilter]);

  useEffect(() => {
    if (qualityFilter === "missing_release") {
      supabase
        .from("registry_entity_relationships")
        .select("source_slug")
        .eq("relationship_type", "track_release")
        .eq("source_entity_type", "tracks")
        .then(({ data }) => {
          setReleaseSlugs(new Set((data ?? []).map((r) => r.source_slug).filter(Boolean)));
        });
    }
  }, [qualityFilter]);

  const enrichedTracks = useMemo<EnrichedTrack[]>(() => {
    return tracks.map((track) => ({
      ...track,
      _quality: calculateCompleteness(track, schema),
      _displayTitle: String(track.title ?? track.slug ?? track.id ?? "Untitled track"),
      _displayDuration: formatDuration(track.duration_ms as number | null),
    }));
  }, [tracks]);

  const summary = useMemo(() => {
    const total = enrichedTracks.length;
    const complete = enrichedTracks.filter((t) => t._quality.completeness >= 85).length;
    const missingIsrc = enrichedTracks.filter((t) => !t.isrc).length;
    const missingArtwork = enrichedTracks.filter((t) => !t.artwork_url).length;
    const blocked = enrichedTracks.filter((t) => t._quality.state === "blocked").length;
    const averageCompleteness = total
      ? Math.round(enrichedTracks.reduce((sum, t) => sum + t._quality.completeness, 0) / total)
      : 0;
    return { total, complete, missingIsrc, missingArtwork, blocked, averageCompleteness };
  }, [enrichedTracks]);

  const filteredTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = enrichedTracks.filter((track) => {
      const searchable = [
        track._displayTitle,
        track.slug,
        track.isrc,
        track.status,
        track.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (qualityFilter === "complete") return track._quality.completeness >= 85;
      if (qualityFilter === "incomplete") return track._quality.completeness < 85;
      if (qualityFilter === "missing_isrc") return !track.isrc;
      if (qualityFilter === "missing_artwork") return !track.artwork_url;
      if (qualityFilter === "missing_duration") return !track.duration_ms;
      if (qualityFilter === "missing_artist") return !artistSlugs.has(String(track.slug));
      if (qualityFilter === "missing_release") return !releaseSlugs.has(String(track.slug));
      if (qualityFilter === "blocked") return track._quality.state === "blocked";
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sortMode === "title") return a._displayTitle.localeCompare(b._displayTitle);
      if (sortMode === "completeness_low") return a._quality.completeness - b._quality.completeness;
      if (sortMode === "completeness_high") return b._quality.completeness - a._quality.completeness;
      const aTime = new Date(String(a.updated_at || a.created_at || 0)).getTime();
      const bTime = new Date(String(b.updated_at || b.created_at || 0)).getTime();
      return bTime - aTime;
    });
    return rows;
  }, [enrichedTracks, query, qualityFilter, sortMode, artistSlugs, releaseSlugs]);

  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / PAGE_SIZE));
  const pagedTracks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTracks.slice(start, start + PAGE_SIZE);
  }, [filteredTracks, page]);

  useEffect(() => {
    setPage(1);
  }, [query, qualityFilter, sortMode]);

  function handleSaved(updatedEntity: Record<string, unknown>) {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === updatedEntity.id ? (updatedEntity as RegistryEntityProfile) : track,
      ),
    );
    showToast(`Saved ${String(updatedEntity.title ?? "track")}`);
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-bold text-[#171712] shadow-xl">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Tracks</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              {filteredTracks.length.toLocaleString()} track{filteredTracks.length !== 1 ? "s" : ""} in registry
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchTracks}
              className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441] flex items-center gap-2"
            >
              <WkIcon name="RefreshCcw" size={14} />
              Refresh
            </button>
          </div>
        </header>

        {/* KPI stats */}
        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing ISRC", summary.missingIsrc],
            ["Missing artwork", summary.missingArtwork],
            ["Blocked", summary.blocked],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-[#dfe4d8] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">{label}</p>
              <p className="mt-2 text-2xl font-black text-[#171712]">{value as number}</p>
            </div>
          ))}
        </section>

        {/* Filter bar */}
        <section className="mb-5 rounded-2xl border border-[#dfe4d8] bg-white p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <WkIcon name="Search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8ad9e]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tracks by title, ISRC, slug, id, status…"
                className="h-11 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] pl-10 pr-4 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
              />
            </div>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value as QualityFilter)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_isrc">Missing ISRC</option>
              <option value="missing_artwork">Missing artwork</option>
              <option value="missing_duration">Missing duration</option>
              <option value="missing_artist">Missing artist</option>
              <option value="missing_release">Missing release</option>
              <option value="blocked">Blocked</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="recent">Recently updated</option>
              <option value="title">Title A-Z</option>
              <option value="completeness_low">Completeness low → high</option>
              <option value="completeness_high">Completeness high → low</option>
            </select>
          </div>
        </section>

        {/* Error */}
        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">Could not load registry tracks</p>
            <p className="mt-1 text-xs">{error}</p>
            <button onClick={fetchTracks} className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">
              Retry
            </button>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[#dfe4d8] bg-white">
            <div className="flex flex-col items-center gap-3">
              <WkIcon name="Loader2" size={28} className="animate-spin text-[#5f8f2f]" />
              <p className="text-[13px] font-bold text-[#697062]">Loading tracks…</p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && (
          <div className="space-y-4">
            {filteredTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#dfe4d8] bg-white px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0f3ec]">
                  <WkIcon name="SearchX" size={28} className="text-[#858c7e]" />
                </div>
                <p className="text-[16px] font-black text-[#171712]">No tracks found</p>
                <p className="max-w-md text-[13px] text-[#697062]">
                  {query || qualityFilter !== "all"
                    ? "No tracks match your current filters. Try adjusting your search or filters."
                    : "No live registry tracks found."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {pagedTracks.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      onOpen={setSelectedTrack}
                      onNavigate={(slug) => navigate(`/admin/registry/tracks/${slug}`)}
                    />
                  ))}
                </div>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={filteredTracks.length}
                  pageSize={PAGE_SIZE}
                />
              </>
            )}
          </div>
        )}
      </div>

      {selectedTrack && (
        <RegistryEntityEditorDrawer
          entityType="track"
          entity={selectedTrack}
          schema={schema}
          onClose={() => setSelectedTrack(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}