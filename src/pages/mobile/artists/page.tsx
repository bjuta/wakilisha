import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { SkeletonCard } from "@/components/skeletons/Skeletons";
import { ARTISTS, ARTIST_FILTERS, ALPHABET, ARTIST_STATS } from "@/mocks/artists";

export default function MobileArtists() {
  const [filter, setFilter] = useState("All");
  const [alphaFilter, setAlphaFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const filtered = ARTISTS.filter((a) => {
    const matchesFilter = filter === "All" || a.genres.some((g) => g === filter);
    const matchesQuery = !query.trim() || a.name.toLowerCase().includes(query.toLowerCase());
    const matchesAlpha = alphaFilter === "All" || a.name.toUpperCase().startsWith(alphaFilter);
    return matchesFilter && matchesQuery && matchesAlpha;
  });

  const stats = [
    { label: "Artists", value: ARTIST_STATS.totalArtists },
    { label: "Chart artists", value: ARTIST_STATS.chartArtists },
    { label: "Tracks", value: ARTIST_STATS.totalTracks },
  ];

  return (
    <div className="min-h-screen">
      {/* Celebratory Hero */}
      <section className="relative min-h-[360px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20African%20music%20culture%20mosaic%2C%20silhouettes%20of%20artists%20and%20performers%2C%20dramatic%20warm%20lighting%2C%20dark%20background%20with%20gold%20and%20green%20accents%2C%20artistic%20representation%20of%20musical%20talent%2C%20cinematic%2C%20no%20text%2C%20editorial%20style&width=1400&height=600&seq=artist-hero-v2&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            The voices
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(36px, 12vw, 56px)" }}>
            Artists
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {ARTIST_STATS.totalArtists} artists shaping the sound of now.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
            <div className="text-[18px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Directory */}
      <div className="px-5 py-8">
        <div className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
          Full directory · {ARTISTS.length} artists
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists..."
            className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2.5 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
          />
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {ARTIST_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Alphabet */}
        <div className="mb-4 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setAlphaFilter("All")}
            className={`h-7 min-w-[28px] rounded-md px-2 text-[11px] font-bold transition-all ${
              alphaFilter === "All"
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
            }`}
          >
            All
          </button>
          {ALPHABET.slice(0, 13).map((letter) => (
            <button
              key={letter}
              onClick={() => setAlphaFilter(letter)}
              className={`h-7 min-w-[28px] rounded-md px-1.5 text-[11px] font-bold transition-all ${
                alphaFilter === letter
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
              }`}
            >
              {letter}
            </button>
          ))}
        </div>

        <div className="mb-3 text-[12px] text-[var(--wk-text-muted)]">
          {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.slice(0, 20).map((artist) => (
                <div key={artist.slug}>
                  <ArtistCard {...artist} />
                </div>
              ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="py-12 text-center text-[var(--wk-text-muted)]">
            <i className="ri-user-search-line mb-3 block text-4xl" />
            No artists match this search.
          </div>
        )}
      </div>
    </div>
  );
}