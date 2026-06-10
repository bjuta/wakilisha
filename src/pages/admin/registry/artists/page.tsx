import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { type RegistryEntityProfile } from "@/services/registry/admin/types";
import { getEntitySchema } from "@/services/registry/admin/entitySchemas";
import { calculateCompleteness, completenessTone, completenessLabel } from "@/services/registry/admin/completeness";
import { getRegistryEntityList } from "@/services/registry/admin/client";
import RegistryEntityEditorDrawer from "@/components/admin/registry/RegistryEntityEditorDrawer";

const schema = getEntitySchema("artist");

type SortMode = "recent" | "name" | "completeness_low" | "completeness_high";

type QualityFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "missing_country"
  | "missing_image"
  | "missing_bio"
  | "missing_genre"
  | "blocked";

interface EnrichedArtist extends RegistryEntityProfile {
  _quality: ReturnType<typeof calculateCompleteness>;
  _displayName: string;
  _displayImage: string;
  _displayCountry: string;
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

function getDisplayName(artist: RegistryEntityProfile): string {
  return String(artist.display_name ?? artist.slug ?? artist.id ?? "Untitled artist");
}

function getDisplayImage(artist: RegistryEntityProfile): string {
  return String(artist.public_image_url ?? "");
}

function getDisplayCountry(artist: RegistryEntityProfile): string {
  return String(artist.origin_iso2 ?? "");
}

export default function ArtistsPage() {
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");

  const [artists, setArtists] = useState<RegistryEntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>(
    (urlFilter as QualityFilter) || "all"
  );
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const [genreSlugs, setGenreSlugs] = useState<Set<string>>(new Set());

  const [selectedArtist, setSelectedArtist] = useState<EnrichedArtist | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchArtists() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getRegistryEntityList("artist", { limit: 250 });

    if (fetchError) {
      setError(fetchError);
      setArtists([]);
    } else {
      setArtists(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchArtists();
  }, []);

  useEffect(() => {
    if (qualityFilter === "missing_genre") {
      supabase
        .from("registry_entity_relationships")
        .select("source_slug")
        .eq("relationship_type", "artist_genre")
        .eq("source_entity_type", "artists")
        .then(({ data }) => {
          setGenreSlugs(new Set((data ?? []).map((r) => r.source_slug).filter(Boolean)));
        });
    }
  }, [qualityFilter]);

  const enrichedArtists = useMemo<EnrichedArtist[]>(() => {
    return artists.map((artist) => ({
      ...artist,
      _quality: calculateCompleteness(artist, schema),
      _displayName: getDisplayName(artist),
      _displayImage: getDisplayImage(artist),
      _displayCountry: getDisplayCountry(artist),
    }));
  }, [artists]);

  const summary = useMemo(() => {
    const total = enrichedArtists.length;
    const complete = enrichedArtists.filter((a) => a._quality.completeness >= 85).length;
    const missingCountry = enrichedArtists.filter((a) => !a._displayCountry).length;
    const missingImage = enrichedArtists.filter((a) => !a._displayImage).length;
    const missingBio = enrichedArtists.filter((a) => !a.bio).length;
    const blocked = enrichedArtists.filter((a) => a._quality.state === "blocked").length;
    const averageCompleteness = total
      ? Math.round(enrichedArtists.reduce((sum, a) => sum + a._quality.completeness, 0) / total)
      : 0;

    return { total, complete, missingCountry, missingImage, missingBio, blocked, averageCompleteness };
  }, [enrichedArtists]);

  const visibleArtists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let rows = enrichedArtists.filter((artist) => {
      const searchable = [
        artist._displayName,
        artist._displayCountry,
        artist.slug,
        artist.status,
        artist.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;

      if (qualityFilter === "complete") return artist._quality.completeness >= 85;
      if (qualityFilter === "incomplete") return artist._quality.completeness < 85;
      if (qualityFilter === "missing_country") return !artist._displayCountry;
      if (qualityFilter === "missing_image") return !artist._displayImage;
      if (qualityFilter === "missing_bio") return !artist.bio;
      if (qualityFilter === "missing_genre") return !genreSlugs.has(String(artist.slug));
      if (qualityFilter === "blocked") return artist._quality.state === "blocked";

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
  }, [enrichedArtists, query, qualityFilter, sortMode, genreSlugs]);

  function openArtist(artist: EnrichedArtist) {
    setSelectedArtist(artist);
  }

  function closeEditor() {
    setSelectedArtist(null);
  }

  function handleSaved(updatedEntity: Record<string, unknown>) {
    setArtists((prev) =>
      prev.map((artist) =>
        artist.id === updatedEntity.id ? (updatedEntity as RegistryEntityProfile) : artist,
      ),
    );
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
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
              Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">Artists</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#697062]">
              Review, search, open, edit, and save canonical artist records idempotently.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchArtists}
              className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm font-black text-[#171712] shadow-sm transition hover:border-[#85c441]"
            >
              Refresh
            </button>

            <div className="rounded-2xl border border-[#dfe4d8] bg-white px-4 py-3 text-sm text-[#5d6557] shadow-sm">
              <span className="font-black text-[#171712]">{visibleArtists.length}</span> shown ·{" "}
              <span className="font-black text-[#171712]">{summary.total}</span> loaded
            </div>
          </div>
        </header>

        <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            ["Loaded", summary.total],
            ["Avg. completeness", `${summary.averageCompleteness}%`],
            ["Near complete", summary.complete],
            ["Missing country", summary.missingCountry],
            ["Missing image", summary.missingImage],
            ["Blocked", summary.blocked],
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
              placeholder="Search artists by name, country, slug, id, or status..."
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
              <option value="missing_image">Missing image</option>
              <option value="missing_bio">Missing bio</option>
              <option value="missing_genre">Missing genre</option>
              <option value="blocked">Blocked</option>
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

        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p className="font-bold">Could not load registry artists</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              onClick={fetchArtists}
              className="mt-2 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#697062]">Loading registry artists…</div>
          ) : visibleArtists.length === 0 ? (
            <div className="p-8 text-sm text-[#697062]">
              {query || qualityFilter !== "all"
                ? "No artists match the current filters."
                : "No live registry artists found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ece2] bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    <th className="w-[30%] px-5 py-4">Artist</th>
                    <th className="w-[14%] px-5 py-4">Country</th>
                    <th className="w-[10%] px-5 py-4">Type</th>
                    <th className="w-[10%] px-5 py-4">Status</th>
                    <th className="w-[10%] px-5 py-4">Updated</th>
                    <th className="w-[14%] px-5 py-4">Quality</th>
                    <th className="w-[12%] px-5 py-4">Edit</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleArtists.map((artist) => (
                    <tr
                      key={artist.id}
                      onClick={() => openArtist(artist)}
                      className="cursor-pointer border-b border-[#eef1ea] align-middle last:border-b-0 hover:bg-[#fbfcf8]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {artist._displayImage ? (
                            <img
                              src={artist._displayImage}
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
                              {artist._displayName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#858c7e]">
                              {String(artist.slug || artist.id)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {artist._displayCountry ? (
                          <span className="font-semibold text-[#2d3329]">
                            {artist._displayCountry}
                          </span>
                        ) : (
                          <span className="text-[#9aa292]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-[#2d3329]">
                          {String(artist.artist_type || "—")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                          {String(artist.status || "unknown")}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#5d6557]">
                        {formatDate(String(artist.updated_at || artist.created_at))}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${completenessTone(
                              artist._quality.completeness,
                            )}`}
                          >
                            {artist._quality.completeness}%
                          </span>
                          <span className="text-[11px] font-bold text-[#8a9283]">
                            {completenessLabel(artist._quality.state)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1e8]">
                          <div
                            className="h-full rounded-full bg-[#85c441]"
                            style={{ width: `${artist._quality.completeness}%` }}
                          />
                        </div>
                        {artist._quality.missingFields.length > 0 && (
                          <p className="mt-1 text-[10px] text-[#8a9283]">
                            Missing: {artist._quality.missingFields.join(", ")}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openArtist(artist);
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

      {selectedArtist && (
        <RegistryEntityEditorDrawer
          entityType="artist"
          entity={selectedArtist}
          schema={schema}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}