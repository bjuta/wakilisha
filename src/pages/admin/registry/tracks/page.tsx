import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TrackRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  primary_artist_name?: string | null;
  artist_name?: string | null;
  release_name?: string | null;
  release_title?: string | null;
  duration?: string | number | null;
  artwork_url?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type SortMode = "recent" | "title" | "completeness_low" | "completeness_high";

function getTrackTitle(track: TrackRow): string {
  return track.title || track.name || "Untitled track";
}

function getArtistName(track: TrackRow): string {
  return track.primary_artist_name || track.artist_name || "";
}

function getReleaseName(track: TrackRow): string {
  return track.release_name || track.release_title || "";
}

function formatDuration(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "number") {
    if (value <= 0) return "—";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return String(value);
}

function getCompleteness(track: TrackRow): number {
  const checks = [
    Boolean(getTrackTitle(track) && getTrackTitle(track) !== "Untitled track"),
    Boolean(getArtistName(track)),
    Boolean(getReleaseName(track)),
    Boolean(track.duration),
    Boolean(track.artwork_url),
    Boolean(track.status),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getMissingFields(track: TrackRow): string[] {
  const missing: string[] = [];

  if (!getTrackTitle(track) || getTrackTitle(track) === "Untitled track") missing.push("title");
  if (!getArtistName(track)) missing.push("artist");
  if (!getReleaseName(track)) missing.push("release");
  if (!track.duration) missing.push("duration");
  if (!track.artwork_url) missing.push("artwork");
  if (!track.status) missing.push("status");

  return missing;
}

function getStatusLabel(track: TrackRow): string {
  return track.status || "unknown";
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<"all" | "complete" | "incomplete" | "missing_artist" | "missing_release" | "missing_artwork">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  useEffect(() => {
    async function fetchTracks() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("registry_tracks")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(250);

      if (fetchError) {
        setError(fetchError.message);
        setTracks([]);
      } else {
        setTracks((data ?? []) as TrackRow[]);
      }

      setLoading(false);
    }

    fetchTracks();
  }, []);

  const enrichedTracks = useMemo(() => {
    return tracks.map((track) => ({
      ...track,
      displayTitle: getTrackTitle(track),
      displayArtist: getArtistName(track),
      displayRelease: getReleaseName(track),
      completeness: getCompleteness(track),
      missingFields: getMissingFields(track),
    }));
  }, [tracks]);

  const summary = useMemo(() => {
    const total = enrichedTracks.length;
    const complete = enrichedTracks.filter((track) => track.completeness >= 85).length;
    const missingArtist = enrichedTracks.filter((track) => !track.displayArtist).length;
    const missingRelease = enrichedTracks.filter((track) => !track.displayRelease).length;
    const missingArtwork = enrichedTracks.filter((track) => !track.artwork_url).length;
    const averageCompleteness = total
      ? Math.round(enrichedTracks.reduce((sum, track) => sum + track.completeness, 0) / total)
      : 0;

    return {
      total,
      complete,
      missingArtist,
      missingRelease,
      missingArtwork,
      averageCompleteness,
    };
  }, [enrichedTracks]);

  const visibleTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let rows = enrichedTracks.filter((track) => {
      const searchable = [
        track.displayTitle,
        track.displayArtist,
        track.displayRelease,
        track.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;

      if (qualityFilter === "complete") return track.completeness >= 85;
      if (qualityFilter === "incomplete") return track.completeness < 85;
      if (qualityFilter === "missing_artist") return !track.displayArtist;
      if (qualityFilter === "missing_release") return !track.displayRelease;
      if (qualityFilter === "missing_artwork") return !track.artwork_url;

      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === "title") return a.displayTitle.localeCompare(b.displayTitle);
      if (sortMode === "completeness_low") return a.completeness - b.completeness;
      if (sortMode === "completeness_high") return b.completeness - a.completeness;

      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    return rows;
  }, [enrichedTracks, query, qualityFilter, sortMode]);

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-6 py-6 text-[#151510]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f7568]">
            Registry Console
          </p>
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Tracks</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6f7568]">
                Review canonical track records, identify missing metadata, and monitor registry quality using live registry data.
              </p>
            </div>
            <div className="rounded-2xl border border-[#d9ddd2] bg-white px-4 py-3 text-sm text-[#555c4f] shadow-sm">
              Showing <strong>{visibleTracks.length}</strong> of <strong>{summary.total}</strong> loaded tracks
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6f7568]">Loaded</p>
            <p className="mt-2 text-3xl font-black">{summary.total}</p>
          </div>

          <div className="rounded-2xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6f7568]">Avg. completeness</p>
            <p className="mt-2 text-3xl font-black">{summary.averageCompleteness}%</p>
          </div>

          <div className="rounded-2xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6f7568]">Near complete</p>
            <p className="mt-2 text-3xl font-black">{summary.complete}</p>
          </div>

          <div className="rounded-2xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6f7568]">Missing artist</p>
            <p className="mt-2 text-3xl font-black">{summary.missingArtist}</p>
          </div>

          <div className="rounded-2xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6f7568]">Missing release</p>
            <p className="mt-2 text-3xl font-black">{summary.missingRelease}</p>
          </div>

          <div className="rounded-2xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6f7568]">Missing artwork</p>
            <p className="mt-2 text-3xl font-black">{summary.missingArtwork}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9ddd2] bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by track, artist, release, or status..."
              className="w-full rounded-2xl border border-[#d9ddd2] bg-[#fbfbf7] px-4 py-3 text-sm outline-none focus:border-[#85c441]"
            />

            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value as typeof qualityFilter)}
              className="rounded-2xl border border-[#d9ddd2] bg-[#fbfbf7] px-4 py-3 text-sm outline-none focus:border-[#85c441]"
            >
              <option value="all">All quality states</option>
              <option value="complete">Near complete</option>
              <option value="incomplete">Incomplete</option>
              <option value="missing_artist">Missing artist</option>
              <option value="missing_release">Missing release</option>
              <option value="missing_artwork">Missing artwork</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-2xl border border-[#d9ddd2] bg-[#fbfbf7] px-4 py-3 text-sm outline-none focus:border-[#85c441]"
            >
              <option value="recent">Recently updated</option>
              <option value="title">Title A-Z</option>
              <option value="completeness_low">Completeness low-high</option>
              <option value="completeness_high">Completeness high-low</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#d9ddd2] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#6f7568]">Loading tracks…</div>
          ) : error ? (
            <div className="p-8 text-sm text-red-700">Failed to load tracks: {error}</div>
          ) : visibleTracks.length === 0 ? (
            <div className="p-8 text-sm text-[#6f7568]">No tracks match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead className="bg-[#f0f2ea] text-xs uppercase tracking-wide text-[#6f7568]">
                  <tr>
                    <th className="px-4 py-3">Track</th>
                    <th className="px-4 py-3">Artist</th>
                    <th className="px-4 py-3">Release</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Completeness</th>
                    <th className="px-4 py-3">Missing</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTracks.map((track) => (
                    <tr key={track.id} className="border-t border-[#ecefe6] align-top hover:bg-[#fbfbf7]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {track.artwork_url ? (
                            <img
                              src={track.artwork_url}
                              alt=""
                              className="h-12 w-12 rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef1e8] text-xs font-bold text-[#6f7568]">
                              —
                            </div>
                          )}

                          <div>
                            <p className="font-bold text-[#151510]">{track.displayTitle}</p>
                            <p className="mt-1 max-w-[280px] truncate text-xs text-[#6f7568]">{track.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {track.displayArtist ? (
                          <span className="font-medium">{track.displayArtist}</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                            Missing artist
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {track.displayRelease || <span className="text-[#9a9f92]">—</span>}
                      </td>

                      <td className="px-4 py-4">{formatDuration(track.duration)}</td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[#eef1e8] px-2 py-1 text-xs font-bold capitalize text-[#4f5948]">
                          {getStatusLabel(track)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex min-w-[140px] items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef1e8]">
                            <div
                              className="h-full rounded-full bg-[#85c441]"
                              style={{ width: `${track.completeness}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-black">{track.completeness}%</span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {track.missingFields.length === 0 ? (
                          <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                            Clean
                          </span>
                        ) : (
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {track.missingFields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full bg-[#f6f1df] px-2 py-1 text-[11px] font-bold text-[#7b6422]"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
