import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { CoverStories } from "./CoverStories";
import { ChartList } from "./ChartList";
import { OriginBento } from "./OriginBento";
import { GenreRows } from "./GenreRows";
import { RisingStars } from "./RisingStars";
import { normalizeCountry, getCountryFlagUrl, getCountryLabel } from "@/utils/countries";
import { listArtists, type PublicArtist } from "@/services/publicContent/client";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

/* ── Viewport-responsive column count (consistent canvas ↔ production) ── */
function getViewportColumns(width: number): number {
  if (width >= 1600) return 18;
  if (width >= 1280) return 15;
  if (width >= 1024) return 12;
  if (width >= 768)  return 9;
  if (width >= 480)  return 6;
  return 5;
}

function useHeroColumnCount(): number {
  const [cols, setCols] = useState(() => getViewportColumns(typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const handler = () => setCols(getViewportColumns(window.innerWidth));
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return cols;
}

/* ── Gap in px based on column density ── */
function getHeroGap(cols: number): number {
  if (cols <= 3) return 5;
  if (cols <= 7) return 4;
  if (cols <= 12) return 3;
  return 2;
}

/* ── Portrait aspect ratios for organic rhythm — width-driven, never height-driven ── */
/* Each value is "w/h" — all > 1 tall so faces are always visible regardless of viewport height */
const CELL_ASPECTS = ["2/3", "3/4", "1/2", "7/10", "3/5", "2/3", "3/4", "9/16", "7/10", "3/5"] as const;



/* ─────────────── helpers ─────────────── */

const PAGE_SIZE = 12;

type SortMode = "featured" | "az" | "newest" | "prolific";

const SORT_OPTIONS: { key: SortMode; label: string; icon: string }[] = [
  { key: "featured", label: "Featured", icon: "ri-star-line" },
  { key: "az", label: "A–Z", icon: "ri-sort-alphabet-asc" },
  { key: "newest", label: "Newest", icon: "ri-calendar-event-line" },
  { key: "prolific", label: "Most tracks", icon: "ri-stack-line" },
];

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const s = Math.abs(h) / 2147483647;
  return (min: number, max: number) => min + (s % 1) * (max - min);
}

function enrichArtist(artist: PublicArtist) {
  const rng = seededRandom(artist.slug);
  const bioSnippets = [
    "Tracks, releases, and chart history gathered in one place.",
    "Follow the songs, genres, and routes around this artist.",
    "From early releases to wider audience attention.",
    "Sound, scene, and story, all in one artist profile.",
    "Part of the wider WAKILISHA artist lineup.",
    "Browse the work, links, and listening routes around this artist.",
  ];
  return {
    ...artist,
    spotlightBio: bioSnippets[Math.floor(rng(0, bioSnippets.length))],
    country: normalizeCountry(artist.country),
  };
}

/* ─────────────── page ─────────────── */

type ViewMode = "grid" | "list";

export default function ArtistsPageContent() {
  const [artists, setArtists] = useState<PublicArtist[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sortMode, setSortMode] = useState<SortMode>("featured");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    listArtists()
      .then((items) => {
        if (!alive) return;
        setArtists(items.filter((a) => a.name));
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError("Could not load artists.");
        setStatus("error");
      });
    return () => { alive = false; };
  }, []);

  const enriched = useMemo(() => artists.map(enrichArtist), [artists]);
  const chartArtists = useMemo(() => enriched.filter((a) => a.isChartArtist).sort((a, b) => (a.topChartPosition || 999) - (b.topChartPosition || 999)), [enriched]);
  const risingArtists = useMemo(() => enriched.filter((a) => a.isRising).slice(0, 12), [enriched]);
  const featured = useMemo(() => chartArtists.slice(0, 7), [chartArtists]);

  const artistFilters = useMemo(
    () => ["All", ...Array.from(new Set(artists.flatMap((a) => a.genres))).filter(Boolean).slice(0, 20)],
    [artists]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return artists.filter((a) => {
      const matchesFilter = filter === "All" || a.genres.some((g) => g === filter);
      const matchesQuery = !q || a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q)) || getCountryLabel(a.country).toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [artists, filter, query]);

  /* ── Smart sorting ── */
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortMode) {
      case "featured":
        list.sort((a, b) => {
          const aChart = a.isChartArtist ? 1 : 0;
          const bChart = b.isChartArtist ? 1 : 0;
          if (aChart !== bChart) return bChart - aChart;
          if (a.isChartArtist && b.isChartArtist) {
            return (a.topChartPosition || 999) - (b.topChartPosition || 999);
          }
          if (a.trackCount !== b.trackCount) return b.trackCount - a.trackCount;
          return a.name.localeCompare(b.name);
        });
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        list.sort((a, b) => b.releaseCount - a.releaseCount || b.trackCount - a.trackCount || a.name.localeCompare(b.name));
        break;
      case "prolific":
        list.sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
        break;
    }
    return list;
  }, [filtered, sortMode]);

  const hasMore = visibleCount < sorted.length;
  const paginated = sorted.slice(0, visibleCount);

  const loadMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  const updateFilter = (next: string) => { setFilter(next); setVisibleCount(PAGE_SIZE); };

  /* genre shelves */
  const genreShelves = useMemo(() => {
    const map = new Map<string, PublicArtist[]>();
    enriched.forEach((a) => {
      a.genres.slice(0, 2).forEach((g) => {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(a);
      });
    });
    return Array.from(map.entries())
      .map(([genre, list]) => ({ genre, artists: list.slice(0, 10) }))
      .sort((a, b) => b.artists.length - a.artists.length)
      .slice(0, 6);
  }, [enriched]);

  /* origin groups */
  const originGroups = useMemo(() => {
    const map = new Map<string, PublicArtist[]>();
    enriched.forEach((a) => {
      const c = normalizeCountry(a.country) || "Unknown";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(a);
    });
    return Array.from(map.entries())
      .map(([country, list]) => ({
        country,
        artistCount: list.length,
        chartCount: list.filter((a) => a.isChartArtist).length,
        risingCount: list.filter((a) => a.isRising).length,
        artists: list.slice(0, 8),
      }))
      .sort((a, b) => b.artistCount - a.artistCount)
      .slice(0, 8);
  }, [enriched]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--wk-brand)]" />
          </div>
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">Loading artists</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <i className="ri-error-warning-line text-[40px] text-[var(--wk-text-faint)]" />
          <p className="mt-4 text-[14px] text-[var(--wk-text-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* ═══════════════════════════════════════════
          FULL-BLEED MASONRY COLLAGE HERO
          ═══════════════════════════════════════════ */}
      <SplitHeroWrapper artists={enriched} />

      {/* ════════ EDITORIAL SPOTLIGHT ════════ */}
      <CoverStories
        artists={featured.map((a) => ({
          slug: a.slug,
          name: a.name,
          imageUrl: a.imageUrl || undefined,
          genres: a.genres,
          monthlyStreams: a.monthlyStreams,
          topChartPosition: a.topChartPosition || 99,
          spotlightBio: a.spotlightBio,
          trackCount: a.trackCount,
          country: a.country,
        }))}
      />

      {/* ════════ CHART LEADERS ════════ */}
      <ChartList
        artists={chartArtists.slice(0, 10).map((a) => ({
          slug: a.slug,
          name: a.name,
          imageUrl: a.imageUrl || undefined,
          genres: a.genres,
          trackCount: a.trackCount,
          releaseCount: a.releaseCount,
          monthlyStreams: a.monthlyStreams,
          topChartPosition: a.topChartPosition || 99,
        }))}
      />

      {/* ════════ BY ORIGIN ════════ */}
      <OriginBento groups={originGroups} />

      {/* ════════ RISING VOICES ════════ */}
      <RisingStars
        artists={risingArtists.map((a) => ({
          slug: a.slug,
          name: a.name,
          imageUrl: a.imageUrl || undefined,
          genres: a.genres,
          trackCount: a.trackCount,
          releaseCount: a.releaseCount,
          country: a.country,
          debutYear: a.debutYear,
          monthlyStreams: a.monthlyStreams,
          spotlightBio: a.spotlightBio,
        }))}
      />

      {/* ════════ EXPLORE BY SOUND ════════ */}
      <GenreRows
        shelves={genreShelves.map((s) => ({
          genre: s.genre,
          artists: s.artists.map((a) => ({
            slug: a.slug,
            name: a.name,
            imageUrl: a.imageUrl || undefined,
            trackCount: a.trackCount,
            releaseCount: a.releaseCount,
          })),
        }))}
      />

      {/* ════════ PULLQUOTE BREAK ════════ */}
      <div className="px-4 md:px-6">
        <div className="wk-container-wide border-y border-[var(--wk-border)] py-14">
          <div className="max-w-[700px] mx-auto text-center">
            <div className="w-10 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mb-5" />
            <p className="text-[clamp(26px,3.5vw,44px)] font-black tracking-[-0.04em] leading-[1.02] text-[var(--wk-text)]">
              Artists, countries, songs, and routes in one place.
            </p>
            <div className="w-10 h-0.5 rounded-full bg-[var(--wk-brand)] mx-auto mt-5" />
          </div>
        </div>
      </div>

      {/* ════════ FULL DIRECTORY ════════ */}
      <section id="directory" className="px-4 md:px-6 py-14 md:py-20">
        <div className="wk-container-wide">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="wk-eyebrow mb-3">Keep exploring</div>
              <h2 className="wk-h-page">Browse artists</h2>
            </div>
            <p className="wk-copy max-w-[44ch] text-[13px]">
              Search by name, country, genre, chart moments, or release history. Start with who you know. Leave with someone new.
            </p>
          </div>

          {/* Toolbar */}
          <div className="directory-toolbar">
            <div className="directory-filters">
              {artistFilters.slice(0, 12).map((f) => (
                <button key={f} onClick={() => updateFilter(f)} className={`directory-filter ${filter === f ? "on" : ""}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="directory-tools">
              <div className="relative">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[var(--wk-text-faint)]" />
                <input
                  className="directory-search pl-9"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                  placeholder="Search by artist, genre, or country"
                />
              </div>
              <div className="view-toggle" aria-label="View mode">
                <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}>
                  <WkIcon name="Grid2x2" size={15} />
                </button>
                <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                  <WkIcon name="List" size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Sort bar */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mr-1">Sort by</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setSortMode(opt.key); setVisibleCount(PAGE_SIZE); }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all duration-[var(--wk-d-fast)] ${
                  sortMode === opt.key
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "border border-[var(--wk-border-2)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] hover:border-[var(--wk-text-faint)] hover:text-[var(--wk-text)]"
                }`}
              >
                <i className={`${opt.icon} text-[11px]`} />
                {opt.label}
              </button>
            ))}
            <span className="ml-auto text-[12px] text-[var(--wk-text-faint)]">
              {sorted.length} artist{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Results */}
          {sorted.length === 0 ? (
            <div className="artist-empty">
              <i className="ri-user-search-line text-[32px] text-[var(--wk-text-faint)]" />
              <div className="mt-3 text-[14px] text-[var(--wk-text-muted)]">No artists found. Try another name, genre, or country.</div>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {paginated.map((artist) => {
                const flagUrl = getCountryFlagUrl(artist.country, 40);
                return (
                <Link
                  key={artist.slug}
                  to={`/artists/${artist.slug}`}
                  className="group relative block overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-1 hover:border-[var(--wk-border-2)]"
                >
                  <div className="relative aspect-square overflow-hidden bg-[var(--wk-surface-raised)]">
                    {artist.imageUrl && String(artist.imageUrl).startsWith("http") ? (
                      <img src={artist.imageUrl} alt={artist.name} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105" />
                    ) : (
                      <Ch19GradientImage slug={artist.slug} name={artist.name} />
                    )}
                    {artist.isChartArtist && (
                      <div className="absolute left-2 top-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)]/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                          <i className="ri-bar-chart-line text-[9px]" />
                          Chart
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="text-[14px] font-bold text-[var(--wk-text)] leading-tight md:text-[15px]">{artist.name}</h3>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--wk-text-muted)]">
                      {flagUrl && (
                        <img src={flagUrl} alt="" loading="lazy" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
                      )}
                      <span>{getCountryLabel(artist.country)}</span>
                      <span>·</span>
                      <span>{artist.trackCount} tracks</span>
                    </div>
                    {artist.genres.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {artist.genres.slice(0, 3).map((g) => (
                          <span key={g} className="tag tag-sm">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
                );
              })}
            </div>
          ) : (
            <div className="artist-directory-list">
              {paginated.map((artist) => {
                const flagUrl = getCountryFlagUrl(artist.country, 40);
                return (
                <Link
                  key={artist.slug}
                  to={`/artists/${artist.slug}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--wk-bg-subtle)] md:gap-5 md:px-6 border-b border-[var(--wk-divider)] last:border-b-0"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)] md:h-14 md:w-14">
                    {artist.imageUrl && String(artist.imageUrl).startsWith("http") ? (
                      <img src={artist.imageUrl} alt={artist.name} loading="lazy" className="h-full w-full object-cover object-top" />
                    ) : (
                      <Ch19GradientImage slug={artist.slug} name={artist.name} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-bold text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] md:text-[15px]">{artist.name}</h4>
                      {artist.isChartArtist && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-[var(--wk-brand)]">
                          <i className="ri-bar-chart-line text-[9px]" />
                          Chart
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--wk-text-muted)]">
                      {flagUrl && (
                        <img src={flagUrl} alt="" loading="lazy" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
                      )}
                      <span>{getCountryLabel(artist.country)}</span>
                      <span className="opacity-40">·</span>
                      <span>{artist.trackCount} tracks</span>
                      <span className="opacity-40">·</span>
                      <span>{artist.releaseCount} releases</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-[var(--wk-text-faint)] transition-all group-hover:translate-x-1 group-hover:text-[var(--wk-brand)]">
                    <i className="ri-arrow-right-s-line text-lg" />
                  </div>
                </Link>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={loadMore}
                className="group inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] px-6 py-3 text-[13px] font-bold text-[var(--wk-text)] transition-all duration-[var(--wk-d-standard)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
              >
                Load {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more artists
                <i className="ri-arrow-down-line text-[14px] transition-transform group-hover:translate-y-0.5" />
              </button>
              <span className="ml-4 self-center text-[12px] text-[var(--wk-text-faint)]">
                {visibleCount} of {sorted.length}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="px-4 md:px-6 pb-14">
        <div className="wk-container-wide border-t border-[var(--wk-border)] pt-14 text-center">
          <span className="block text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3">
            WAKILISHA Artists
          </span>
          <p className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] leading-snug max-w-[380px] mx-auto">
            {artists.length.toLocaleString()} artists shaping the sound of the continent.
          </p>
          <p className="mt-3 text-[12px] font-semibold text-[var(--wk-text-faint)]">
            More voices, more places, more music.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ═════════════════════════════════════════
   FULL-BLEED MASONRY COLLAGE HERO
   ═════════════════════════════════════════ */

interface SplitHeroProps {
  artists: ReturnType<typeof enrichArtist>[];
}

function SplitHeroWrapper(props: SplitHeroProps) {
  return <SplitHero {...props} />;
}

function SplitHero({ artists }: SplitHeroProps) {
  // All artists with valid HTTP image URLs — tiling handles sparse counts; no arbitrary cap
  // Filter out non-URL values (like genre names from bad CSV data) so the collage stays clean
  const collageArtists = useMemo(
    () => artists.filter((a) => a.imageUrl && String(a.imageUrl).startsWith("http")),
    [artists]
  );
  // Column count is viewport-driven → identical in canvas and production
  const columnCount = useHeroColumnCount();
  const isSingleImage = collageArtists.length <= 1;

  const columns = useMemo(() => {
    if (collageArtists.length === 0 || isSingleImage) return [];
    // 14 cells per column: at ~3/4 ratio each cell is ~1.33× its width → plenty to fill any viewport height
    const needed = Math.max(collageArtists.length, columnCount * 14);
    const tiled: typeof collageArtists = [];
    while (tiled.length < needed) tiled.push(...collageArtists);
    const sliced = tiled.slice(0, needed);
    const cols: typeof collageArtists[] = Array.from({ length: columnCount }, () => []);
    sliced.forEach((img, i) => cols[i % columnCount].push(img));
    return cols;
  }, [collageArtists, columnCount, isSingleImage]);

  const [scrollY, setScrollY] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const sy = window.scrollY;
        setScrollY(sy);
        if (sy > 40 && !hasScrolledRef.current) {
          hasScrolledRef.current = true;
          setHasScrolled(true);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const gap = getHeroGap(columnCount);
  const radius = columnCount >= 14 ? "2px" : columnCount >= 9 ? "3px" : columnCount >= 5 ? "5px" : "8px";

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black"
    >
      <style>{`
        @keyframes wkColFadeIn {
          from { opacity: 0; filter: blur(10px); }
          to   { opacity: 1; filter: blur(0px); }
        }
        @keyframes wkColDrift {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes wkShimmer {
          0%   { transform: translateX(-120%); opacity: 0; }
          8%   { opacity: 1; }
          85%  { opacity: 0.9; }
          100% { transform: translateX(120%);  opacity: 0; }
        }
        @keyframes wkPortraitIn {
          from { transform: scale(1.06); opacity: 0; filter: blur(6px); }
          to   { transform: scale(1);    opacity: 1; filter: blur(0px); }
        }
      `}</style>

      <div className="absolute inset-x-0 z-0" style={{ top: -100, bottom: -100 }}>
        {isSingleImage && collageArtists.length > 0 ? (
          <img
            src={collageArtists[0].imageUrl!}
            alt={collageArtists[0].name}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "top",
              display: "block",
              animation: "wkPortraitIn 1.4s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          />
        ) : (
          <div className="flex h-full w-full" style={{ gap: `${gap}px` }}>
            {columns.map((colImages, colIdx) => {
              const speed = colIdx % 3 === 0 ? -1 : colIdx % 3 === 1 ? 0.55 : -0.75;
              const colParallax = speed * scrollY * 0.016;
              const entranceDelay = colIdx * 55;
              const driftPeriod = 5.5 + (colIdx % 5) * 0.7;
              const driftPhase = -(colIdx * 0.85);

              return (
                <div
                  key={colIdx}
                  className="flex flex-1 min-w-0"
                  style={{
                    transform: `translateY(${colParallax}px)`,
                    transition: "transform 0.45s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  }}
                >
                  <div
                    className="flex w-full flex-col"
                    style={{
                      gap: `${gap}px`,
                      animation:
                        `wkColFadeIn ${900 + colIdx * 20}ms ${entranceDelay}ms cubic-bezier(0.16, 1, 0.3, 1) both,` +
                        `wkColDrift  ${driftPeriod}s     ${driftPhase}s             ease-in-out           infinite`,
                    }}
                  >
                    {colImages.map((artist, rowIdx) => (
                      <div
                        key={`${artist.slug}-${colIdx}-${rowIdx}`}
                        className="group relative w-full cursor-pointer overflow-hidden"
                        style={{
                          /* aspect-ratio is width-driven → portrait crop is identical on every screen size */
                          aspectRatio: CELL_ASPECTS[(colIdx + rowIdx * 3) % CELL_ASPECTS.length],
                          flexShrink: 0,
                          borderRadius: radius,
                        }}
                      >
                        <img
                          src={artist.imageUrl!}
                          alt={artist.name}
                          className="absolute inset-0 h-full w-full object-cover object-top transition-all duration-500 ease-out group-hover:brightness-110 group-hover:saturate-[1.15]"
                          loading={colIdx * colImages.length + rowIdx < 20 ? "eager" : "lazy"}
                        />

                        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 backdrop-blur-md opacity-0 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-y-[-2px]">
                          <span className="text-[10px] font-bold tracking-[0.08em] text-white">{artist.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasScrolled && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,220,120,0.10) 30%, " +
                "rgba(255,235,160,0.24) 50%, rgba(255,220,120,0.10) 70%, transparent 100%)",
              animation: "wkShimmer 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards",
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* Overlays — localized scrim only behind text, collage edges stay visible */}
      {/* Top dark fade — theme-neutral, won't bleach in light mode */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-black/30 to-transparent" />
      {/* Radial spotlight scrim — dark only in the text zone, transparent at edges */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 50% 50%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--wk-brand)] opacity-[0.04] blur-[160px]" />

      {/* Content — frosted pill so text pops cleanly in both light + dark mode */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 py-24 text-center md:px-6 md:py-32">
        {/* Eyebrow + headline + body copy — all inside a lightweight frosted pill */}
        <div className="hero-text-reveal mb-8 flex flex-col items-center gap-5 rounded-3xl px-6 py-8 backdrop-blur-[6px] md:px-12"
          style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.22) 0%, transparent 80%)" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)] animate-pulse" />
            The continent's voices
          </span>

          <h1 className="hero-text-reveal-d1 font-black text-[clamp(42px,9vw,130px)] leading-[0.85] tracking-[-0.06em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.7)]">
            Artists<br />
            <span className="text-[var(--wk-brand)] drop-shadow-[0_2px_24px_rgba(0,0,0,0.7)]">in focus</span>
          </h1>

          <p className="hero-text-reveal-d2 max-w-[52ch] text-[14px] leading-[1.75] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)] md:text-[16px]" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.5)" }}>
            Find the artists shaping African music, from familiar names to rising voices,
            deep catalog acts, scene builders, and people you are about to start pretending you knew all along.
          </p>
        </div>




      </div>



      <div
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 transition-all duration-700"
        style={{ opacity: hasScrolled ? 0 : 1, pointerEvents: "none" }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Scroll</span>
          <div className="h-10 w-[1px] animate-pulse bg-white/25" />
        </div>
      </div>
    </section>
  );
}

