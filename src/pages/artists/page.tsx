import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import { ArtistStats } from "./components/ArtistStats";
import { CoverStories } from "./components/CoverStories";
import { ChartList } from "./components/ChartList";
import { GenreRows } from "./components/GenreRows";
import { RisingStars } from "./components/RisingStars";
import { OriginBento } from "./components/OriginBento";
import { ARTISTS, ARTIST_FILTERS, ALPHABET, ARTIST_STATS } from "@/mocks/artists";

const PAGE_SIZE = 16;

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

export default function Artists() {
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

  // Cover stories: top 4 chart artists
  const coverArtists = useMemo(() => {
    return ARTISTS.filter((a) => a.isChartArtist)
      .sort((a, b) => a.topChartPosition - b.topChartPosition)
      .slice(0, 4);
  }, []);

  // Chart list: top 8 chart artists
  const chartListArtists = useMemo(() => {
    return ARTISTS.filter((a) => a.isChartArtist)
      .sort((a, b) => a.topChartPosition - b.topChartPosition);
  }, []);

  // Rising: non-chart rising artists
  const risingArtists = useMemo(() => {
    return ARTISTS.filter((a) => a.isRising && !a.isChartArtist);
  }, []);

  // Genre shelves: top 5 genres with 2+ artists
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

  // Origin groups
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
    { label: "Chart artists", value: ARTIST_STATS.chartArtists },
    { label: "Tracks", value: ARTIST_STATS.totalTracks },
    { label: "Monthly streams", value: ARTIST_STATS.monthlyStreams, suffix: "M", decimals: 1 },
  ];

  const goToPage = (p: number) => {
    setPage(p);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <PageHero
        eyebrow="The voices"
        title="Artists"
        subtitle={`${ARTIST_STATS.totalArtists} artists shaping the sound of now. From chart legends to rising voices, every story is here.`}
        variant="full"
        imageUrl="https://readdy.ai/api/search-image?query=Cinematic%20portrait%20of%20African%20music%20performers%20on%20stage%2C%20dramatic%20concert%20lighting%20with%20warm%20amber%20and%20deep%20shadows%2C%20artistic%20silhouettes%2C%20gold%20and%20bronze%20tones%2C%20editorial%20music%20photography%2C%20high%20contrast%2C%20moody%20atmosphere%2C%20no%20text%20visible%2C%20professional%20concert%20photography%20style&width=1400&height=800&seq=artist-hero-v3&orientation=landscape"
      />

      {/* Slim stats strip */}
      <ArtistStats stats={stats} />

      {/* Cover Stories — 2x2 editorial grid */}
      {!loading && <CoverStories artists={coverArtists} />}

      {/* Chart List — vertical ranking */}
      {!loading && <ChartList artists={chartListArtists} />}

      {/* Genre Shelves — horizontal scroll rows */}
      {!loading && <GenreRows shelves={genreShelves} />}

      {/* Rising Stars — 2x2 grid */}
      {!loading && <RisingStars artists={risingArtists} />}

      {/* Origin Bento — country grid */}
      {!loading && <OriginBento groups={originGroups} />}

      {/* Directory */}
      <div ref={gridRef} className="wk-container-wide px-6 py-14 md:py-20">
        <div className="mb-6 flex items-center gap-3">
          <div className="wk-eyebrow">Full directory</div>
          <span className="text-[12px] text-[var(--wk-text-muted)]">{ARTISTS.length} artists</span>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <div className="relative max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists..."
              className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2.5 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
            />
          </div>
          <div className="flex flex-col gap-3">
            {/* Alphabet filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setAlphaFilter("All")}
                className={`h-7 min-w-[28px] rounded-md px-2 text-[11px] font-bold transition-all ${
                  alphaFilter === "All"
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                }`}
              >
                All
              </button>
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setAlphaFilter(letter)}
                  className={`h-7 min-w-[28px] rounded-md px-1.5 text-[11px] font-bold transition-all ${
                    alphaFilter === letter
                      ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                      : "border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
            {/* Genre filter */}
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
        </div>

        <div className="mb-4 flex items-center justify-between text-[13px]">
          <span className="text-[var(--wk-text-muted)]">
            {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
            {filter !== "All" && ` in ${filter}`}
            {alphaFilter !== "All" && ` starting with ${alphaFilter}`}
          </span>
          {totalPages > 1 && (
            <span className="text-[var(--wk-text-faint)]">
              Page {page} of {totalPages}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonSquare key={i} />)
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
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
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
                  className={`h-9 min-w-[36px] rounded-lg px-2 text-[13px] font-bold transition-all ${
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all disabled:opacity-40 hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-user-search-line mb-3 block text-4xl" />
            No artists match this search.
          </div>
        )}
      </div>
    </div>
  );
}