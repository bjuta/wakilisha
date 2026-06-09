import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ArtistRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  country?: string | null;
  country_name?: string | null;
  iso2?: string | null;
  genres?: string | string[] | null;
  profile_image?: string | null;
  image_url?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_country"
  | "missing_genres"
  | "missing_image"
  | "missing_bio";

type EnrichedArtist = ArtistRow & {
  displayName: string;
  displayCountry: string;
  displayGenres: string;
  displayImage: string;
  completeness: number;
  missingFields: string[];
};

function getArtistName(artist: ArtistRow): string {
  return artist.name || "Untitled artist";
}

function getArtistCountry(artist: ArtistRow): string {
  return artist.country_name || artist.country || "";
}

function getArtistImage(artist: ArtistRow): string {
  return artist.profile_image || artist.image_url || artist.avatar_url || "";
}

function getArtistGenres(artist: ArtistRow): string {
  if (Array.isArray(artist.genres)) return artist.genres.filter(Boolean).join(", ");
  return artist.genres || "";
}

function getCompleteness(artist: ArtistRow): number {
  const checks = [
    Boolean(getArtistName(artist) && getArtistName(artist) !== "Untitled artist"),
    Boolean(getArtistCountry(artist)),
    Boolean(getArtistGenres(artist)),
    Boolean(getArtistImage(artist)),
    Boolean(artist.bio),
    Boolean(artist.status),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getMissingFields(artist: ArtistRow): string[] {
  const missing: string[] = [];

  if (!getArtistName(artist) || getArtistName(artist) === "Untitled artist") missing.push("name");
  if (!getArtistCountry(artist)) missing.push("country");
  if (!getArtistGenres(artist)) missing.push("genres");
  if (!getArtistImage(artist)) missing.push("image");
  if (!artist.bio) missing.push("bio");
  if (!artist.status) missing.push("status");

  return missing;
}

function completenessTone(value: number): string {
  if (value >= 85) return "bg-emerald-100 text-emerald-700";
  if (value >= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
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

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  useEffect(() => {
    async function fetchArtists() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("registry_artists")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(250);

      if (fetchError) {
        setError(fetchError.message);
        setArtists([]);
      } else {
        setArtists((data ?? []) as ArtistRow[]);
      }

      setLoading(false);
    }

    fetchArtists();
  }, []);

  const enrichedArtists = useMemo<EnrichedArtist[]>(() => {
    return artists.map((artist) => ({
      ...artist,
      displayName: getArtistName(artist),
      displayCountry: getArtistCountry(artist),
      displayGenres: getArtistGenres(artist),
      displayImage: getArtistImage(artist),
      completeness: getCompleteness(artist),
      missingFields: getMissingFields(artist),
    }));
  }, [artists]);

  const summary = useMemo(() => {
    const total = enrichedArtists.length;
    const complete = enrichedArtists.filter((artist) => artist.completeness >= 85).length;
    const missingCountry = enrichedArtists.filter((artist) => !artist.displayCountry).length;
    const missingGenres = enrichedArtists.filter((artist) => !artist.displayGenres).length;
    const missingImage = enrichedArtists.filter((artist) => !artist.displayImage).length;
    const missingBio = enrichedArtists.filter((artist) => !artist.bio).length;

    const averageCompleteness = total
      ? Math.round(enrichedArtists.reduce((sum, artist) => sum + artist.completeness, 0) / total)
      : 0;

    return {
      total,
      complete,
      missingCountry,
      missingGenres,
      missingImage,
      missingBio,
      averageCompleteness,
    };
  }, [enrichedArtists]);

  const visibleArtists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let rows = enrichedArtists.filter((artist) => {
      const searchable = [
        artist.displayName,
        artist.displayCountry,
        artist.displayGenres,
        artist.slug,
        artist.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;

      if (qualityFilter === "complete") return artist.completeness >= 85;
      if (qualityFilter === "incomplete") return artist.completeness < 85;
      if (qualityFilter === "missing_country") return !artist.displayCountry;
      if (qualityFilter === "missing_genres") return !artist.displayGenres;
      if (qualityFilter === "missing_image") return !artist.displayImage;
      if (qualityFilter === "missing_bio") return !artist.bio;

      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === "name") return a.displayName.localeCompare(b.displayName);
      if (sortMode === "completeness_low") return a.completeness - b.completeness;
      if (sortMode === "completeness_high") return b.completeness - a.completeness;

      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    return rows;
  }, [enrichedArtists, query, qualityFilter, sortMode]);

  return (
    <div className="min-h-screen bg-[#f7f7f2] px-5 py-6 text-[#171712]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Artists</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              Review canonical artist records, identity metadata, country coverage, genres, and profile completeness.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm text-[#5d6557] shadow-sm">
            <span className="font-black text-[#171712]">{visibleArtists.length}</span> shown ·{" "}
            <span className="font-black text-[#171712]">{summary.total}</span> loaded
          </div>
        </header>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing country", summary.missingCountry],
            ["Missing genres", summary.missingGenres],
            ["Missing image", summary.missingImage],
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
              placeholder="Search artists by name, country, genre, slug, or status..."
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
              <option value="missing_country">Missing country</option>
              <option value="missing_genres">Missing genres</option>
              <option value="missing_image">Missing image</option>
              <option value="missing_bio">Missing bio</option>
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none transition focus:border-[#85c441] focus:bg-white"
            >
              <option value="recent">Recently updated</option>
              <option value="name">Name A-Z</option>
              <option value="completeness_low">Completeness low-high</option>
              <option value="completeness_high">Completeness high-low</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#697062]">Loading artists…</div>
          ) : error ? (
            <div className="p-8 text-sm text-red-700">Failed to load artists: {error}</div>
          ) : visibleArtists.length === 0 ? (
            <div className="p-8 text-sm text-[#697062]">No artists match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ece2] bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    <th className="w-[34%] px-5 py-4">Artist</th>
                    <th className="w-[14%] px-5 py-4">Country</th>
                    <th className="w-[20%] px-5 py-4">Genres</th>
                    <th className="w-[10%] px-5 py-4">Status</th>
                    <th className="w-[10%] px-5 py-4">Updated</th>
                    <th className="w-[12%] px-5 py-4">Quality</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleArtists.map((artist) => (
                    <tr
                      key={artist.id}
                      className="border-b border-[#eef1ea] align-middle last:border-b-0 hover:bg-[#fbfcf8]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {artist.displayImage ? (
                            <img
                              src={artist.displayImage}
                              alt=""
                              className="h-11 w-11 flex-none rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#f0f3ec] text-xs font-black text-[#8a9283]">
                              A
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate font-black text-[#171712]">
                              {artist.displayName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#858c7e]">
                              {artist.slug || artist.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {artist.displayCountry ? (
                          <span className="font-semibold text-[#2d3329]">
                            {artist.displayCountry}
                          </span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {artist.displayGenres ? (
                          <span className="line-clamp-2 text-[#2d3329]">
                            {artist.displayGenres}
                          </span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                          {artist.status || "unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#5d6557]">
                        {formatDate(artist.updated_at || artist.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(
                              artist.completeness,
                            )}`}
                          >
                            {artist.completeness}%
                          </span>

                          {artist.missingFields.length > 0 ? (
                            <span
                              title={`Missing: ${artist.missingFields.join(", ")}`}
                              className="truncate text-xs text-[#8a9283]"
                            >
                              {artist.missingFields.length} missing
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700">Clean</span>
                          )}
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
                          <div
                            className="h-full rounded-full bg-[#85c441]"
                            style={{ width: `${artist.completeness}%` }}
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
