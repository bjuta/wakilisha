import { useState, useEffect, useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { useArtistSearchData, type ArtistSearchItem } from "@/hooks/useArtistSearchData";
import {
  fetchFeaturedArtists,
  addFeaturedArtist,
  removeFeaturedArtist,
  moveFeaturedArtist,
  type FeaturedArtist,
} from "@/services/magazineFeaturedArtists";

export default function AdminFeaturedArtistsPage() {
  const [featured, setFeatured] = useState<FeaturedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addingSlug, setAddingSlug] = useState<string | null>(null);

  const { data: allArtists, loading: artistsLoading } = useArtistSearchData();

  const loadFeatured = () => {
    fetchFeaturedArtists().then((data) => {
      setFeatured(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadFeatured();
  }, []);

  const featuredSlugs = useMemo(() => new Set(featured.map((f) => f.artist_slug)), [featured]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allArtists
      .filter((a) => !featuredSlugs.has(a.slug))
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.genres.some((g) => g.toLowerCase().includes(q)) ||
          (a.country && a.country.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [search, allArtists, featuredSlugs]);

  const handleAdd = async (slug: string) => {
    setAddingSlug(slug);
    const ok = await addFeaturedArtist(slug);
    if (ok) {
      loadFeatured();
      setSearch("");
    }
    setAddingSlug(null);
  };

  const handleRemove = async (id: string) => {
    setSaving(id);
    const ok = await removeFeaturedArtist(id);
    if (ok) loadFeatured();
    setSaving(null);
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    setSaving(id);
    const ok = await moveFeaturedArtist(id, direction, featured);
    if (ok) loadFeatured();
    setSaving(null);
  };

  const maxArtists = 8;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Magazine</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Featured Artists</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            These artists appear in the spotlight section on the magazine landing page.{" "}
            {featured.length > 0 && `${featured.length} of ${maxArtists} slots used.`}
          </p>
        </div>
      </div>

      {/* Search & Add */}
      <WkSurface className="p-4">
        <div className="flex flex-col gap-3">
          <label className="text-[12px] font-bold text-wk-text-muted uppercase tracking-wide">
            Add an artist to the spotlight
          </label>
          <div className="relative max-w-lg">
            <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg-subtle px-3 py-2">
              <WkIcon name="Search" size={14} className="text-wk-text-faint shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search artists by name, genre, or country..."
                className="w-full bg-transparent text-[13px] text-wk-text placeholder:text-wk-text-faint outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-wk-text-faint hover:text-wk-text cursor-pointer">
                  <WkIcon name="X" size={14} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {search.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-wk-border bg-wk-surface shadow-lg z-20 overflow-hidden">
                {artistsLoading ? (
                  <div className="p-3 text-[13px] text-wk-text-muted">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-[13px] text-wk-text-muted">
                    {featuredSlugs.size >= maxArtists
                      ? `All ${maxArtists} spotlight slots are filled. Remove an artist first.`
                      : "No artists found."}
                  </div>
                ) : (
                  searchResults.map((artist) => (
                    <button
                      key={artist.slug}
                      onClick={() => handleAdd(artist.slug)}
                      disabled={addingSlug === artist.slug || featuredSlugs.size >= maxArtists}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-wk-bg-subtle transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="w-9 h-9 rounded-lg bg-wk-surface-raised overflow-hidden shrink-0 flex items-center justify-center">
                        {artist.imageUrl ? (
                          <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <WkIcon name="User" size={16} className="text-wk-text-faint" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-wk-text truncate">{artist.name}</div>
                        <div className="text-[11px] text-wk-text-muted truncate">
                          {[artist.country, ...artist.genres.slice(0, 2)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <WkIcon name="Plus" size={14} className="text-wk-brand shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </WkSurface>

      {/* Current featured artists */}
      <WkSurface className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <WkIcon name="Star" size={14} className="text-wk-brand" />
          <h2 className="text-[13px] font-bold text-wk-text uppercase tracking-wide">Spotlight Lineup</h2>
          {featured.length > 0 && (
            <span className="text-[11px] text-wk-text-muted ml-auto">
              Drag not available — use the arrows to reorder
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-wk-border bg-wk-surface p-3">
                <div className="h-4 w-32 rounded bg-wk-surface-raised" />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-bg-subtle mx-auto mb-3">
              <WkIcon name="Users" size={22} className="text-wk-text-faint" />
            </div>
            <p className="text-[14px] font-semibold text-wk-text-muted mb-1">No featured artists yet</p>
            <p className="text-[12px] text-wk-text-faint">Search above to add artists to the spotlight</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {featured.map((artist, idx) => (
              <div
                key={artist.id}
                className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-bg-subtle p-3 transition-colors hover:border-wk-border-strong group"
              >
                {/* Order number */}
                <span className="w-7 h-7 rounded-full bg-wk-brand text-wk-brand-on text-[11px] font-black flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-wk-surface-raised overflow-hidden shrink-0 flex items-center justify-center">
                  {artist.artist_image ? (
                    <img src={artist.artist_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <WkIcon name="User" size={18} className="text-wk-text-faint" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-wk-text truncate">{artist.artist_name}</div>
                  <div className="text-[11px] text-wk-text-muted truncate">
                    {[artist.artist_country, ...artist.artist_genres.slice(0, 2)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>

                {/* Reorder controls */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMove(artist.id, "up")}
                    disabled={idx === 0 || saving === artist.id}
                    className="w-7 h-7 rounded-md border border-wk-border bg-wk-surface flex items-center justify-center hover:border-wk-brand hover:text-wk-brand transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <WkIcon name="ChevronUp" size={14} />
                  </button>
                  <button
                    onClick={() => handleMove(artist.id, "down")}
                    disabled={idx === featured.length - 1 || saving === artist.id}
                    className="w-7 h-7 rounded-md border border-wk-border bg-wk-surface flex items-center justify-center hover:border-wk-brand hover:text-wk-brand transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <WkIcon name="ChevronDown" size={14} />
                  </button>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(artist.id)}
                  disabled={saving === artist.id}
                  className="w-7 h-7 rounded-md border border-transparent flex items-center justify-center text-wk-text-faint hover:text-wk-danger hover:border-wk-danger/30 hover:bg-wk-danger/5 transition-all cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <WkIcon name="X" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </WkSurface>

      {/* Help card */}
      <WkSurface className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-wk-brand-soft flex items-center justify-center shrink-0 mt-0.5">
            <WkIcon name="Info" size={16} className="text-wk-brand" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-wk-text mb-1">How this works</h3>
            <p className="text-[12px] text-wk-text-muted leading-relaxed">
              Featured artists appear in a dedicated spotlight section on the WAKILISHA Magazine landing page, right after the hero and section navigation. Each artist card shows their image, name, country, genres, and links to their full profile. The order you set here is the order visitors see on the site.
            </p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}