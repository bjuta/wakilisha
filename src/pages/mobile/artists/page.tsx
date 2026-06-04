import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ARTISTS, ARTIST_FILTERS, ARTIST_STATS } from "@/mocks/artists";
import { WkIcon } from "@/components/design-system/Icon";

type SortMode = "featured" | "az" | "newest" | "prolific";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "az", label: "A–Z" },
  { key: "newest", label: "Newest" },
  { key: "prolific", label: "Most tracks" },
];

export default function MobileArtists() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  const collageImages = useMemo(() => ARTISTS.filter((a) => a.imageUrl).slice(0, 20), []);

  useEffect(() => {
    const onScroll = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          setScrollY(window.scrollY);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTISTS.filter((artist) => {
      const matchesQuery = !q || artist.name.toLowerCase().includes(q) || artist.genres.some((g) => g.toLowerCase().includes(q));
      const matchesFilter = filter === "All" || artist.genres.includes(filter);
      return matchesQuery && matchesFilter;
    });
  }, [query, filter]);

  /* Smart sort — chart artists first by default */
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortMode) {
      case "featured":
        list.sort((a, b) => {
          const aChart = a.isChartArtist ? 1 : 0;
          const bChart = b.isChartArtist ? 1 : 0;
          if (aChart !== bChart) return bChart - aChart;
          if (a.isChartArtist && b.isChartArtist) return a.topChartPosition - b.topChartPosition;
          if (a.trackCount !== b.trackCount) return b.trackCount - a.trackCount;
          return a.name.localeCompare(b.name);
        });
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        list.sort((a, b) => b.debutYear - a.debutYear);
        break;
      case "prolific":
        list.sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [filtered, sortMode]);

  const chartArtists = useMemo(() => ARTISTS.filter((a) => a.isChartArtist).sort((a, b) => a.topChartPosition - b.topChartPosition), []);
  const risingArtists = useMemo(() => ARTISTS.filter((a) => a.isRising && !a.isChartArtist), []);
  const genreShelves = useMemo(() => {
    const allGenres = Array.from(new Set(ARTISTS.flatMap((a) => a.genres)));
    return allGenres
      .map((genre) => ({ genre, artists: ARTISTS.filter((a) => a.genres.includes(genre)) }))
      .filter((s) => s.artists.length >= 2)
      .sort((a, b) => b.artists.length - a.artists.length)
      .slice(0, 5);
  }, []);
  const originGroups = useMemo(() => {
    const groups: Record<string, typeof ARTISTS> = {};
    ARTISTS.forEach((a) => { if (!groups[a.country]) groups[a.country] = []; groups[a.country].push(a); });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length).slice(0, 8);
  }, []);

  return (
    <div className="wk-mobile-v5">
      {/* ═══ FULL-BLEED COLLAGE HERO ═══ */}
      <section ref={heroRef} className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden">
        {/* Masonry collage background */}
        <div className="absolute inset-0 z-0">
          <div className="h-full w-full" style={{ columnCount: 2, columnGap: "0.375rem" }}>
            {collageImages.map((artist, i) => {
              const heights = [140, 180, 120, 160, 200, 140, 170, 130, 190, 150, 180, 160, 140, 170, 200, 150, 130, 180, 160, 140];
              const h = heights[i % heights.length];
              const parallaxOffset = (i % 4) * 4 - 6;
              return (
                <div
                  key={artist.slug}
                  className="mb-1.5 break-inside-avoid overflow-hidden rounded-md"
                  style={{
                    height: `${h}px`,
                    transform: `translateY(${parallaxOffset + (scrollY * 0.015 * ((i % 3) - 1))}px)`,
                    transition: "transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  }}
                >
                  <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover object-top" loading={i < 8 ? "eager" : "lazy"} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[var(--wk-bg)]/60 via-[var(--wk-bg)]/25 to-[var(--wk-bg)]/65" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-5 py-20 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            <span className="h-1 w-1 rounded-full bg-[var(--wk-brand)] animate-pulse" />
            The voices
          </span>
          <h1 className="mb-4 font-black text-[clamp(48px,12vw,72px)] leading-[0.85] tracking-[-0.05em] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            African<br />
            <span className="text-[var(--wk-brand)] drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">Greats</span>
          </h1>
          <p className="mb-6 max-w-[36ch] text-[13px] leading-relaxed text-white/75 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {ARTIST_STATS.totalArtists} artists shaping the sound of the continent — ranked by impact, not alphabet.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { label: "Artists", value: ARTIST_STATS.totalArtists },
              { label: "Chart", value: ARTIST_STATS.chartArtists },
              { label: "Tracks", value: ARTIST_STATS.totalTracks },
              { label: "Nations", value: originGroups.length },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center rounded-xl border border-white/12 bg-white/8 px-4 py-2.5 backdrop-blur-md">
                <div className="text-[22px] font-black text-white">{stat.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-20 bg-gradient-to-t from-[var(--wk-bg)] to-transparent" />
      </section>

      <div className="spec-section-hd">Chart artists</div>
      <div className="phn-scroll-row">
        {chartArtists.slice(0, 10).map((artist) => <ArtistCard key={artist.slug} artist={artist} width={156} />)}
      </div>

      {genreShelves.map((shelf) => (
        <div key={shelf.genre}>
          <div className="spec-section-hd">{shelf.genre}</div>
          <div className="phn-scroll-row">
            {shelf.artists.slice(0, 8).map((artist) => <ArtistCard key={artist.slug} artist={artist} width={140} />)}
          </div>
        </div>
      ))}

      {risingArtists.length > 0 && (
        <>
          <div className="spec-section-hd">Rising stars</div>
          <div className="phn-scroll-row">
            {risingArtists.slice(0, 8).map((artist) => <ArtistCard key={artist.slug} artist={artist} width={140} />)}
          </div>
        </>
      )}

      <div className="spec-section-hd">By country</div>
      <div className="flex flex-col gap-2 px-5 pb-4">
        {originGroups.map(([country, artists]) => (
          <div key={country} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-bold text-[var(--wk-text)]">{country}</span>
              <span className="text-[11px] text-[var(--wk-text-muted)]">{artists.length} artists</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {artists.slice(0, 5).map((a) => (
                <Link key={a.slug} to={`/artists/${a.slug}`} className="mobile-pressable shrink-0">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]"><img src={a.imageUrl} alt="" className="h-full w-full object-cover object-top" /></div>
                </Link>
              ))}
              {artists.length > 5 && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] text-[10px] font-bold text-[var(--wk-text-muted)]">+{artists.length - 5}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="spec-section-hd">Full directory · {ARTISTS.length}</div>
      <div className="search-bar-zone">
        <label className="search-input">
          <WkIcon name="Search" size={17} className="search-input-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search artists" />
          {query && <button onClick={() => setQuery("")} className="search-input-icon" aria-label="Clear artist search"><WkIcon name="X" size={17} /></button>}
        </label>
      </div>

      {/* Sort pills — replaces the old A-Z strip */}
      <div className="flex flex-wrap gap-1.5 px-5 pb-3">
        <span className="self-center mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">Sort</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortMode(opt.key)}
            className={`mobile-pressable rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
              sortMode === opt.key
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="charts-filter-row">
        {ARTIST_FILTERS.slice(0, 12).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`charts-filter mobile-pressable ${filter === item ? "on" : ""}`}>{item}</button>
        ))}
      </div>

      <div className="px-5 pb-2 text-[12px] text-[var(--wk-text-muted)]">
        {sorted.length} artist{sorted.length !== 1 ? "s" : ""}{filter !== "All" && ` in ${filter}`}
      </div>

      <div className="artist-grid-2col">
        {sorted.map((artist) => <ArtistCard key={artist.slug} artist={artist} />)}
      </div>

      {sorted.length === 0 && (
        <div className="px-5 py-12 text-center text-[var(--wk-text-muted)]">
          <WkIcon name="UserSearch" size={32} className="mx-auto mb-3" />
          No artists match this search.
        </div>
      )}
    </div>
  );
}

function ArtistCard({ artist, width }: { artist: typeof ARTISTS[number]; width?: number }) {
  return (
    <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard mobile-pressable relative" style={width ? { width, flex: "0 0 auto" } : undefined}>
      <img src={artist.imageUrl} alt="" />
      {artist.isChartArtist && (
        <div className="absolute left-2 top-2 z-10">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--wk-brand)]/90 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
            <i className="ri-bar-chart-line text-[8px]" />
            Chart
          </span>
        </div>
      )}
      <div className="acard-overlay">
        <div className="acard-name">{artist.name}</div>
        <div className="acard-meta">{artist.genres[0] || ""}{artist.country ? ` · ${artist.country}` : ""}</div>
      </div>
    </Link>
  );
}