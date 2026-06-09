import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TrackRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
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
type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_artist"
  | "missing_release"
  | "missing_artwork";

type EnrichedTrack = TrackRow & {
  displayTitle: string;
  displayArtist: string;
  displayRelease: string;
  completeness: number;
  missingFields: string[];
};

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

function completenessTone(value: number): string {
  if (value >= 85) return "bg-emerald-100 text-emerald-700";
  if (value >= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
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

  const enrichedTracks = useMemo<EnrichedTrack[]>(() => {
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
        track.slug,
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
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Tracks</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              Review canonical track records, metadata coverage, and operational quality.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm text-[#5d6557] shadow-sm">
            <span className="font-black text-[#171712]">{visibleTracks.length}</span> shown ·{" "}
            <span className="font-black text-[#171712]">{summary.total}</span> loaded
          </div>
        </header>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing artist", summary.missingArtist],
            ["Missing release", summary.missingRelease],
            ["Missing artwork", summary.missingArtwork],
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
              placeholder="Search tracks by title, artist, release, slug, or status..."
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
              <option value="missing_artist">Missing artist</option>
              <option value="missing_release">Missing release</option>
              <option value="missing_artwork">Missing artwork</option>
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

        <section className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#697062]">Loading tracks…</div>
          ) : error ? (
            <div className="p-8 text-sm text-red-700">Failed to load tracks: {error}</div>
          ) : visibleTracks.length === 0 ? (
            <div className="p-8 text-sm text-[#697062]">No tracks match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ece2] bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    <th className="w-[36%] px-5 py-4">Track</th>
                    <th className="w-[18%] px-5 py-4">Artist</th>
                    <th className="w-[18%] px-5 py-4">Release</th>
                    <th className="w-[8%] px-5 py-4">Duration</th>
                    <th className="w-[8%] px-5 py-4">Status</th>
                    <th className="w-[12%] px-5 py-4">Quality</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTracks.map((track) => (
                    <tr
                      key={track.id}
                      className="border-b border-[#eef1ea] align-middle last:border-b-0 hover:bg-[#fbfcf8]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {track.artwork_url ? (
                            <img
                              src={track.artwork_url}
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
                              {track.displayTitle}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#858c7e]">
                              {track.slug || track.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {track.displayArtist ? (
                          <span className="font-semibold text-[#2d3329]">{track.displayArtist}</span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {track.displayRelease ? (
                          <span className="text-[#2d3329]">{track.displayRelease}</span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-[#2d3329]">
                        {formatDuration(track.duration)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                          {getStatusLabel(track)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(
                              track.completeness,
                            )}`}
                          >
                            {track.completeness}%
                          </span>

                          {track.missingFields.length > 0 ? (
                            <span
                              title={`Missing: ${track.missingFields.join(", ")}`}
                              className="truncate text-xs text-[#8a9283]"
                            >
                              {track.missingFields.length} missing
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700">Clean</span>
                          )}
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
                          <div
                            className="h-full rounded-full bg-[#85c441]"
                            style={{ width: `${track.completeness}%` }}
                          />
                        </div>
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
