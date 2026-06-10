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

type ArtistEditorState = {
  name: string;
  slug: string;
  country: string;
  country_name: string;
  iso2: string;
  genres: string;
  profile_image: string;
  image_url: string;
  avatar_url: string;
  bio: string;
  status: string;
};

function valueOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

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

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function toEditorState(artist: ArtistRow): ArtistEditorState {
  return {
    name: valueOrEmpty(artist.name),
    slug: valueOrEmpty(artist.slug),
    country: valueOrEmpty(artist.country),
    country_name: valueOrEmpty(artist.country_name),
    iso2: valueOrEmpty(artist.iso2),
    genres: getArtistGenres(artist),
    profile_image: valueOrEmpty(artist.profile_image),
    image_url: valueOrEmpty(artist.image_url),
    avatar_url: valueOrEmpty(artist.avatar_url),
    bio: valueOrEmpty(artist.bio),
    status: valueOrEmpty(artist.status || "active"),
  };
}

function emptyToNull(value: string): string | null {
  const clean = value.trim();
  return clean ? clean : null;
}

function genresForSave(original: ArtistRow, value: string): string | string[] | null {
  const clean = value.trim();

  if (!clean) return Array.isArray(original.genres) ? [] : null;

  if (Array.isArray(original.genres)) {
    return clean
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return clean;
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const [selectedArtist, setSelectedArtist] = useState<EnrichedArtist | null>(null);
  const [editor, setEditor] = useState<ArtistEditorState | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

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

  useEffect(() => {
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
        artist.id,
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

  function openArtist(artist: EnrichedArtist) {
    setSelectedArtist(artist);
    setEditor(toEditorState(artist));
  }

  function closeEditor() {
    setSelectedArtist(null);
    setEditor(null);
    setSaving(false);
  }

  function updateEditorField<K extends keyof ArtistEditorState>(key: K, value: ArtistEditorState[K]) {
    setEditor((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveArtist() {
    if (!selectedArtist || !editor) return;

    setSaving(true);
    setError(null);

    const cleanName = editor.name.trim();
    const cleanSlug = editor.slug.trim() || normalizeSlug(cleanName);

    if (!cleanName) {
      setSaving(false);
      showToast("Artist name is required.");
      return;
    }

    if (!cleanSlug) {
      setSaving(false);
      showToast("Slug is required.");
      return;
    }

    const payload = {
      name: cleanName,
      slug: cleanSlug,
      country: emptyToNull(editor.country),
      country_name: emptyToNull(editor.country_name),
      iso2: emptyToNull(editor.iso2.toUpperCase()),
      genres: genresForSave(selectedArtist, editor.genres),
      profile_image: emptyToNull(editor.profile_image),
      image_url: emptyToNull(editor.image_url),
      avatar_url: emptyToNull(editor.avatar_url),
      bio: emptyToNull(editor.bio),
      status: emptyToNull(editor.status) || "active",
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from("registry_artists")
      .update(payload)
      .eq("id", selectedArtist.id)
      .select("*")
      .single();

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      showToast(`Failed to save artist: ${updateError.message}`);
      return;
    }

    const updated = data as ArtistRow;

    setArtists((prev) => prev.map((artist) => (artist.id === selectedArtist.id ? updated : artist)));

    const enrichedUpdated: EnrichedArtist = {
      ...updated,
      displayName: getArtistName(updated),
      displayCountry: getArtistCountry(updated),
      displayGenres: getArtistGenres(updated),
      displayImage: getArtistImage(updated),
      completeness: getCompleteness(updated),
      missingFields: getMissingFields(updated),
    };

    setSelectedArtist(enrichedUpdated);
    setEditor(toEditorState(updated));
    setSaving(false);
    showToast(`Saved ${getArtistName(updated)}.`);
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
              placeholder="Search artists by name, country, genre, slug, id, or status..."
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

        {error && (
          <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#dfe4d8] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-[#697062]">Loading artists…</div>
          ) : visibleArtists.length === 0 ? (
            <div className="p-8 text-sm text-[#697062]">No artists match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8ece2] bg-[#fbfcf8] text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    <th className="w-[30%] px-5 py-4">Artist</th>
                    <th className="w-[14%] px-5 py-4">Country</th>
                    <th className="w-[19%] px-5 py-4">Genres</th>
                    <th className="w-[10%] px-5 py-4">Status</th>
                    <th className="w-[10%] px-5 py-4">Updated</th>
                    <th className="w-[12%] px-5 py-4">Quality</th>
                    <th className="w-[5%] px-5 py-4">Edit</th>
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

      {selectedArtist && editor && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            aria-label="Close artist editor"
            onClick={closeEditor}
            className="absolute inset-0 cursor-default"
          />

          <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            <header className="border-b border-[#e8ece2] bg-[#fbfcf8] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5f8f2f]">
                    Backend artist profile
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    {selectedArtist.displayName}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[#858c7e]">{selectedArtist.id}</p>
                </div>

                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-xs font-black text-[#171712] hover:border-[#85c441]"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    Completeness
                  </p>
                  <p className="mt-1 text-2xl font-black">{selectedArtist.completeness}%</p>
                </div>

                <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    Missing
                  </p>
                  <p className="mt-1 text-2xl font-black">{selectedArtist.missingFields.length}</p>
                </div>

                <div className="rounded-2xl border border-[#dfe4d8] bg-[#fbfcf8] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#71796b]">
                    Status
                  </p>
                  <p className="mt-1 text-lg font-black">{editor.status || "active"}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                    Artist name
                  </span>
                  <input
                    value={editor.name}
                    onChange={(event) => updateEditorField("name", event.target.value)}
                    className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                    Slug
                  </span>
                  <div className="flex gap-2">
                    <input
                      value={editor.slug}
                      onChange={(event) => updateEditorField("slug", event.target.value)}
                      className="h-11 flex-1 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateEditorField("slug", normalizeSlug(editor.name))}
                      className="rounded-xl border border-[#dfe4d8] bg-white px-3 text-xs font-black hover:border-[#85c441]"
                    >
                      Generate
                    </button>
                  </div>
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                      Country name
                    </span>
                    <input
                      value={editor.country_name}
                      onChange={(event) => updateEditorField("country_name", event.target.value)}
                      placeholder="Kenya"
                      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                      Country
                    </span>
                    <input
                      value={editor.country}
                      onChange={(event) => updateEditorField("country", event.target.value)}
                      placeholder="Kenya"
                      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                      ISO2
                    </span>
                    <input
                      value={editor.iso2}
                      onChange={(event) => updateEditorField("iso2", event.target.value)}
                      placeholder="KE"
                      maxLength={2}
                      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm uppercase outline-none focus:border-[#85c441] focus:bg-white"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                    Genres
                  </span>
                  <input
                    value={editor.genres}
                    onChange={(event) => updateEditorField("genres", event.target.value)}
                    placeholder="Afrobeats, Gengetone, Bongo"
                    className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                  />
                  <span className="text-xs text-[#858c7e]">
                    Comma-separated. If the existing DB value is an array, it saves back as an array.
                  </span>
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                      Profile image
                    </span>
                    <input
                      value={editor.profile_image}
                      onChange={(event) => updateEditorField("profile_image", event.target.value)}
                      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                      Image URL
                    </span>
                    <input
                      value={editor.image_url}
                      onChange={(event) => updateEditorField("image_url", event.target.value)}
                      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                      Avatar URL
                    </span>
                    <input
                      value={editor.avatar_url}
                      onChange={(event) => updateEditorField("avatar_url", event.target.value)}
                      className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                    Bio
                  </span>
                  <textarea
                    value={editor.bio}
                    onChange={(event) => updateEditorField("bio", event.target.value)}
                    rows={6}
                    className="rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 py-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[#71796b]">
                    Status
                  </span>
                  <select
                    value={editor.status}
                    onChange={(event) => updateEditorField("status", event.target.value)}
                    className="h-11 rounded-xl border border-[#dfe4d8] bg-[#f8f9f4] px-3 text-sm outline-none focus:border-[#85c441] focus:bg-white"
                  >
                    <option value="active">active</option>
                    <option value="draft">draft</option>
                    <option value="needs_review">needs_review</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </div>
            </div>

            <footer className="border-t border-[#e8ece2] bg-[#fbfcf8] px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#697062]">
                  Saves update the existing registry artist by ID. Re-saving the same values is idempotent.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-xl border border-[#dfe4d8] bg-white px-4 py-2 text-sm font-black text-[#171712] hover:border-[#85c441]"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveArtist}
                    disabled={saving}
                    className="rounded-xl bg-[#85c441] px-4 py-2 text-sm font-black text-[#102006] shadow-sm transition hover:bg-[#76b33a] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save artist"}
                  </button>
                </div>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
