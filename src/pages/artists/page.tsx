import { useState, useEffect, useMemo } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { SkeletonCard } from "@/components/skeletons/Skeletons";
import { ArtistSpotlight } from "./components/ArtistSpotlight";
import { ArtistStats } from "./components/ArtistStats";
import { ChartLegends } from "./components/ChartLegends";
import { RisingArtists } from "./components/RisingArtists";
import { GenreClusters } from "./components/GenreClusters";
import { ARTISTS, ARTIST_FILTERS, ALPHABET, ARTIST_STATS, GENRE_CLUSTERS } from "@/mocks/artists";

export default function Artists() {
  const [filter, setFilter] = useState("All");
  const [alphaFilter, setAlphaFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDirectory, setShowDirectory] = useState(false);

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

  const spotlightArtist = useMemo(() => {
    const chartLeaders = ARTISTS.filter((a) => a.isChartArtist && a.monthlyStreams > 10);
    return chartLeaders[Math.floor(Math.random() * chartLeaders.length)] || ARTISTS[0];
  }, []);

  const chartLegends = ARTISTS.filter((a) => a.isChartArtist).sort(
    (a, b) => a.topChartPosition - b.topChartPosition
  );

  const risingArtists = ARTISTS.filter((a) => a.isRising);

  const stats = [
    { label: "Artists", value: ARTIST_STATS.totalArtists },
    { label: "Chart artists", value: ARTIST_STATS.chartArtists },
    { label: "Tracks catalogued", value: ARTIST_STATS.totalTracks },
    { label: "Releases", value: ARTIST_STATS.totalReleases },
    { label: "Genres", value: ARTIST_STATS.totalGenres },
    { label: "Monthly streams", value: ARTIST_STATS.monthlyStreams, suffix: "M", decimals: 1 },
  ];

  return (
    <div className="min-h-screen">
      {/* Celebratory Hero — not a directory header */}
      <PageHero
        eyebrow="The voices"
        title="Artists"
        subtitle={`${ARTIST_STATS.totalArtists} artists shaping the sound of now. From chart legends to rising voices, every story is here.`}
        variant="standard"
        imageUrl="https://readdy.ai/api/search-image?query=Abstract%20African%20music%20culture%20mosaic%2C%20silhouettes%20of%20artists%20and%20performers%2C%20dramatic%20warm%20lighting%2C%20dark%20background%20with%20gold%20and%20green%20accents%2C%20artistic%20representation%20of%20musical%20talent%2C%20cinematic%2C%20no%20text%2C%20editorial%20style&width=1400&height=600&seq=artist-hero-v2&orientation=landscape"
        actions={
          <button
            onClick={() => setShowDirectory(!showDirectory)}
            className="wk-button wk-button-primary"
          >
            {showDirectory ? (
              <>
                Hide directory
                <i className="ri-arrow-up-line" />
              </>
            ) : (
              <>
                Browse all artists
                <i className="ri-arrow-down-line" />
              </>
            )}
          </button>
        }
      />

      {/* By The Numbers — aggregate stats strip */}
      <ArtistStats stats={stats} />

      {/* Artist Spotlight — one artist, full presence */}
      <ArtistSpotlight {...spotlightArtist} />

      {/* Chart Legends — the artists who run the charts */}
      {!loading && <ChartLegends artists={chartLegends} />}

      {/* Rising — emerging voices */}
      {!loading && <RisingArtists artists={risingArtists} />}

      {/* Genre Discovery — explore by sound */}
      {!loading && <GenreClusters clusters={GENRE_CLUSTERS} />}

      {/* Directory — search, filters, alphabet, grid — secondary, collapsible */}
      <div className="wk-container-wide px-6 py-14 md:py-20">
        <div className="mb-6 flex items-center gap-3">
          <div className="wk-eyebrow">Full directory</div>
          <span className="text-[12px] text-[var(--wk-text-muted)]">
            {ARTISTS.length} artists
          </span>
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

        <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
          {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
          {filter !== "All" && ` in ${filter}`}
          {alphaFilter !== "All" && ` starting with ${alphaFilter}`}
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
    </div>
  );
}