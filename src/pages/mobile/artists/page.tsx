import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import { CoverStories } from "@/pages/artists/components/CoverStories";
import { ChartList } from "@/pages/artists/components/ChartList";
import { GenreRows } from "@/pages/artists/components/GenreRows";
import { RisingStars } from "@/pages/artists/components/RisingStars";
import { OriginBento } from "@/pages/artists/components/OriginBento";
import { ARTISTS, ARTIST_FILTERS, ALPHABET, ARTIST_STATS } from "@/mocks/artists";

const PAGE_SIZE = 12;

function getFlag(country: string): string {
  const flags: Record<string, string> = {
    Nigeria: "🇳🇬", Ghana: "🇬🇭", "South Africa": "🇿🇦", Kenya: "🇰🇪", Uganda: "🇺🇬",
    Tanzania: "🇹🇿", Cameroon: "🇨🇲", Ethiopia: "🇪🇹", Rwanda: "🇷🇼", Zambia: "🇿🇲",
    Zimbabwe: "🇿🇼", Senegal: "🇸🇳", Mali: "🇲🇱", Congo: "🇨🇩", Angola: "🇦🇴",
    Botswana: "🇧🇼", Namibia: "🇳🇦", Morocco: "🇲🇦", Algeria: "🇩🇿", Tunisia: "🇹🇳",
    Egypt: "🇪🇬", Sudan: "🇸🇩", "Sierra Leone": "🇸🇱", Liberia: "🇱🇷", "Burkina Faso": "🇧🇫",
    Niger: "🇳🇪", Chad: "🇹🇩", Gabon: "🇬🇦", Guinea: "🇬🇳", "Guinea-Bissau": "🇬🇼",
    The_Gambia: "🇬🇲", Togo: "🇹🇬", Benin: "🇧🇯", Mozambique: "🇲🇿", Malawi: "🇲🇼",
    Madagascar: "🇲🇬", Mauritius: "🇲🇺", Seychelles: "🇸🇨", Djibouti: "🇩🇯", Somalia: "🇸🇴",
    Eritrea: "🇪🇷", "South Sudan": "🇸🇸", Eswatini: "🇸🇿", Lesotho: "🇱🇸",
  };
  return flags[country] || "🌍";
}

export default function MobileArtists() {
  const [filter, setFilter] = useState("All");
  const [alphaFilter, setAlphaFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, alphaFilter, query]);

  const filtered = ARTISTS.filter((a) => {
    const matchesFilter = filter === "All" || a.genres.some((g) => g === filter);
    const matchesQuery = !query.trim() || a.name.toLowerCase().includes(query.toLowerCase());
    const matchesAlpha = alphaFilter === "All" || a.name.toUpperCase().startsWith(alphaFilter);
    return matchesFilter && matchesQuery && matchesAlpha;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const coverArtists = useMemo(() => {
    return ARTISTS.filter((a) => a.isChartArtist)
      .sort((a, b) => a.topChartPosition - b.topChartPosition)
      .slice(0, 4);
  }, []);

  const chartListArtists = useMemo(() => {
    return ARTISTS.filter((a) => a.isChartArtist)
      .sort((a, b) => a.topChartPosition - b.topChartPosition);
  }, []);

  const risingArtists = useMemo(() => {
    return ARTISTS.filter((a) => a.isRising && !a.isChartArtist);
  }, []);

  const genreShelves = useMemo(() => {
    const allGenres = Array.from(new Set(ARTISTS.flatMap((a) => a.genres)));
    const shelves = allGenres
      .map((genre) => ({
        genre,
        artists: ARTISTS.filter((a) => a.genres.includes(genre)).map((a) => ({
          slug: a.slug,
          name: a.name,
          imageUrl: a.imageUrl,
          trackCount: a.trackCount,
          releaseCount: a.releaseCount,
        })),
      }))
      .filter((s) => s.artists.length >= 2)
      .sort((a, b) => b.artists.length - a.artists.length)
      .slice(0, 5);
    return shelves;
  }, []);

  const originGroups = useMemo(() => {
    const groups: Record<string, { country: string; artists: typeof ARTISTS }> = {};
    ARTISTS.forEach((a) => {
      if (!groups[a.country]) groups[a.country] = { country: a.country, artists: [] };
      groups[a.country].artists.push(a);
    });
    return Object.values(groups)
      .sort((a, b) => b.artists.length - a.artists.length)
      .map((g) => ({
        country: g.country,
        flag: getFlag(g.country),
        artistCount: g.artists.length,
        chartCount: g.artists.filter((a) => a.isChartArtist).length,
        risingCount: g.artists.filter((a) => a.isRising && !a.isChartArtist).length,
        artists: g.artists.map((a) => ({ slug: a.slug, name: a.name, imageUrl: a.imageUrl })),
      }));
  }, []);

  const stats = [
    { label: "Artists", value: ARTIST_STATS.totalArtists },
    { label: "Chart", value: ARTIST_STATS.chartArtists },
    { label: "Tracks", value: ARTIST_STATS.totalTracks },
    { label: "Streams", value: ARTIST_STATS.monthlyStreams, suffix: "M", decimals: 1 },
  ];

  const goToPage = (p: number) => {
    setPage(p);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Cinematic%20portrait%20of%20African%20music%20performers%20on%20stage%2C%20dramatic%20concert%20lighting%20with%20warm%20amber%20and%20deep%20shadows%2C%20artistic%20silhouettes%2C%20gold%20and%20bronze%20tones%2C%20editorial%20music%20photography%2C%20high%20contrast%2C%20moody%20atmosphere%2C%20no%20text%20visible%2C%20professional%20concert%20photography%20style&width=1400&height=800&seq=artist-hero-v3&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            The voices
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[#F0EFE8]" style={{ fontSize: "clamp(42px, 14vw, 64px)" }}>
            Artists
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/70">
            {ARTIST_STATS.totalArtists} artists shaping the sound of now.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-2 py-3 text-center">
            <div className="text-[16px] font-black text-[var(--wk-brand)]">
              {stat.decimals ? stat.value.toFixed(stat.decimals) : stat.value}
              {stat.suffix || ""}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Cover Stories */}
      {!loading && <CoverStories artists={coverArtists} />}

      {/* Chart List */}
      {!loading && <ChartList artists={chartListArtists} />}

      {/* Genre Shelves */}
      {!loading && <GenreRows shelves={genreShelves} />}

      {/* Rising Stars */}
      {!loading && <RisingStars artists={risingArtists} />}

      {/* Origin Bento */}
      {!loading && <OriginBento groups={originGroups} />}

      {/* Directory */}
      <div ref={gridRef} className="px-5 py-6">
        <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          Full directory
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
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
        <div className="mb-3 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
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

        <div className="mb-3 flex items-center justify-between text-[12px]">
          <span className="text-[var(--wk-text-muted)]">
            {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
          </span>
          {totalPages > 1 && (
            <span className="text-[var(--wk-text-faint)]">
              {page}/{totalPages}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonSquare key={i} />)
            : paginated.map((artist) => (
                <ArtistCard
                  key={artist.slug}
                  slug={artist.slug}
                  name={artist.name}
                  imageUrl={artist.imageUrl}
                  genres={artist.genres}
                  trackCount={artist.trackCount}
                  releaseCount={artist.releaseCount}
                  isChartArtist={artist.isChartArtist}
                  country={artist.country}
                />
              ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-left-line text-sm" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 5) {
                if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`h-8 min-w-[32px] rounded-lg px-1.5 text-[12px] font-bold transition-all ${
                    page === p
                      ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                      : "border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        )}

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