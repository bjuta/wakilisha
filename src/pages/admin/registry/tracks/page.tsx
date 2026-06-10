import { useEffect, useMemo, useState, useCallback } from "react";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone, completenessLabel } from "@/services/registry/admin/completeness";
import { getRegistryEntityList } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";

const schema = getEntitySchema("track");

type SortMode = "recent" | "title" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_isrc"
  | "missing_artwork"
  | "missing_duration"
  | "blocked";

interface EnrichedTrack extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayTitle: string;
  _displayDuration: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<RegistryEntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const [selectedTrack, setSelectedTrack] = useState<EnrichedTrack | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchTracks() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getRegistryEntityList("track", { limit: 250 });

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
    const missingDuration = enrichedTracks.filter((t) => !t.duration_ms).length;
    const blocked = enrichedTracks.filter((t) => t._quality.state === "blocked").length;
    const averageCompleteness = total
      ? Math.round(enrichedTracks.reduce((sum, t) => sum + t._quality.completeness, 0) / total)
      : 0;

    return { total, complete, missingIsrc, missingArtwork, missingDuration, blocked, averageCompleteness };
  }, [enrichedTracks]);

  const visibleTracks = useMemo(() => {
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
  }, [enrichedTracks, query, qualityFilter, sortMode]);

  function openTrack(track: EnrichedTrack) {
    setSelectedTrack(track);
  }

  function closeEditor() {
    setSelectedTrack(null);
  }

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
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Tracks</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              Review, search, open, edit, and save canonical track records idempotently.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchTracks}
              className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441]"
            >
              Refresh
            </button>

            <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm text-[#5d6557] shadow-sm">
              <span className="font-black text-[#171712]">{visibleTracks.length}</span> shown ·{" "}
              <span className="font-black text-[#171712]">{summary.total}</span> loaded
            </div>
          </div>
        </header>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing ISRC", summary.missingIsrc],
            ["Missing artwork", summary.missingArtwork],
            ["Missing duration", summary.missingDuration],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#dfe4d8] bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black text-[#171712]">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-4 rounded-2xl border border-[#dfe4d8] bg-white p-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tracks by title, ISRC, slug, id, or status..."
              className="h-11 w-full rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-4 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            />

            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_isrc">Missing ISRC</option>
              <option value="missing_artwork">Missing artwork</option>
              <option value="missing_duration">Missing duration</option>
              <option value="blocked">Blocked</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="recent">Recently updated</option>
              <option value="title">Title A-Z</option>
              <option value="completeness_low">Completeness low-high</option>
              <option value="completeness_high">Completeness high-low</option>
            </select>
          </div>
        </section>

        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">Could not load registry tracks</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              onClick={fetchTracks}
              className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#697062]">Loading registry tracks…</div>
          ) : visibleTracks.length === 0 ? (
            <div className="p-8 text-sm text-[#697062]">
              {query || qualityFilter !== "all"
                ? "No tracks match the current filters."
                : "No live registry tracks found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ece2] bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    <th className="w-[36%] px-5 py-4">Track</th>
                    <th className="w-[12%] px-5 py-4">ISRC</th>
                    <th className="w-[12%] px-5 py-4">Duration</th>
                    <th className="w-[10%] px-5 py-4">Status</th>
                    <th className="w-[10%] px-5 py-4">Updated</th>
                    <th className="w-[14%] px-5 py-4">Quality</th>
                    <th className="w-[6%] px-5 py-4">Edit</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTracks.map((track) => (
                    <tr
                      key={track.id}
                      onClick={() => openTrack(track)}
                      className="cursor-pointer border-b border-[#eef1ea] align-middle last:border-b-0 hover:bg-[#fbfcf8]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {track.artwork_url ? (
                            <img
                              src={String(track.artwork_url)}
                              alt=""
                              className="h-11 w-11 flex-none rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#f0f3ec] text-xs font-black text-[#8a9283]">
                              ♪
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate font-black text-[#171712]">
                              {track._displayTitle}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#858c7e]">
                              {String(track.slug || track.id)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {track.isrc ? (
                          <span className="font-mono text-xs text-[#2d3329]">{String(track.isrc)}</span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-[#2d3329]">
                        {track._displayDuration}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                          {String(track.status || "unknown")}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#5d6557]">
                        {formatDate(String(track.updated_at || track.created_at))}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(
                              track._quality.completeness,
                            )}`}
                          >
                            {track._quality.completeness}%
                          </span>
                          <span className="text-[11px] font-bold text-[#8a9283]">
                            {completenessLabel(track._quality.state)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
                          <div
                            className="h-full rounded-full bg-[#85c441]"
                            style={{ width: `${track._quality.completeness}%` }}
                          />
                        </div>
                        {track._quality.missingFields.length > 0 && (
                          <p className="mt-1 text-[10px] text-[#8a9283]">
                            Missing: {track._quality.missingFields.join(", ")}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTrack(track);
                          }}
                          className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-xs font-black text-[#171712] transition hover:border-[#85c441]"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedTrack && (
        <RegistryEntityEditorDrawer
          entityType="track"
          entity={selectedTrack}
          schema={schema}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}