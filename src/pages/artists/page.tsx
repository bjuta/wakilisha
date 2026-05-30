import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { SkeletonCard } from "@/components/skeletons/Skeletons";
import { ARTISTS, ARTIST_FILTERS } from "@/mocks/artists";

export default function Artists() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = ARTISTS.filter((a) => {
    const matchesFilter = filter === "All" || a.genres.some((g) => g === filter);
    const matchesQuery = !query.trim() || a.name.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <>
      <PageHero
        eyebrow="Registry"
        title="Artist directory"
        subtitle={`${ARTISTS.length} artists indexed. Browse by name, genre, or chart activity.`}
      />

      <div className="wk-container px-6 py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists..."
              className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ARTIST_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all whitespace-nowrap ${
                  filter === f
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
          {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
          {filter !== "All" && ` in ${filter}`}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.map((artist) => <ArtistCard key={artist.slug} {...artist} />)}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-user-search-line mb-3 block text-4xl" />
            No artists match this search.
          </div>
        )}
      </div>
    </>
  );
}