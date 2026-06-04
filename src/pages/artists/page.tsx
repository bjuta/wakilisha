import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { CoverStories } from "./components/CoverStories";
import { ChartList } from "./components/ChartList";
import { OriginBento } from "./components/OriginBento";
import { GenreRows } from "./components/GenreRows";
import { RisingStars } from "./components/RisingStars";
import { normalizeCountry, getCountryFlagUrl, getCountryLabel } from "@/utils/countries";
import { listArtists, type RepairedArtist } from "@/services/repairedContent/client";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { getFrontendAppearanceSettings } from "@/services/adminSettings/settingsStore";

/* ── Dynamic column count from image count ── */
function getHeroColumnCount(imageCount: number): number {
  if (imageCount <= 1) return 1;
  if (imageCount <= 3) return 2;
  if (imageCount <= 8) return 3;
  if (imageCount <= 20) return 4;
  if (imageCount <= 40) return 5;
  if (imageCount <= 60) return 7;
  if (imageCount <= 90) return 9;
  if (imageCount <= 120) return 11;
  if (imageCount <= 160) return 14;
  if (imageCount <= 200) return 18;
  return Math.ceil(imageCount / 11);
}

/* ── Gap in px based on column density ── */
function getHeroGap(cols: number): number {
  if (cols <= 3) return 5;
  if (cols <= 7) return 4;
  if (cols <= 12) return 3;
  return 2;
}

/* ── Varying flex weights for organic rhythm ── */
const FLEX_WEIGHTS = [1.2, 0.9, 1.35, 0.85, 1.15, 1.3, 0.95, 1.05, 1.4, 0.8];

/* ── Reactive settings hook ── */
function useArtistHeroCount(): number {
  const [count, setCount] = useState<number>(() => {
    try { return getFrontendAppearanceSettings().artistHeroImageCount || 40; } catch { return 40; }
  });

  useEffect(() => {
    const handler = () => {
      try { setCount(getFrontendAppearanceSettings().artistHeroImageCount || 40); } catch { /* ignore */ }
    };
    window.addEventListener("wk_settings_changed", handler);
    return () => window.removeEventListener("wk_settings_changed", handler);
  }, []);

  return count;
}

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

function enrichArtist(artist: RepairedArtist) {
  const rng = seededRandom(artist.slug);
  const bioSnippets = [
    "Redefining the sound of a generation with fearless originality.",
    "A voice that carries the rhythm of the continent.",
    "From underground circles to chart-topping anthems.",
    "Bridging tradition and modernity in every bar.",
    "The architect of a new African sonic era.",
    "Unapologetic, bold, and unmistakably original.",
  ];
  return {
    ...artist,
    spotlightBio: bioSnippets[Math.floor(rng(0, bioSnippets.length))],
    monthlyStreams: Number(rng(0.5, 12).toFixed(1)),
    debutYear: 2010 + Math.floor(rng(0, 14)),
    country: normalizeCountry(artist.country),
  };
}

/* ─────────────── page ─────────────── */

type ViewMode = "grid" | "list";

export default function Artists() {
  const [artists, setArtists] = useState<RepairedArtist[]>([]);
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
        setError(err instanceof Error ? err.message : "Could not load artists.");
        setStatus("error");
      });
    return () => { alive = false; };
  }, []);

  const enriched = useMemo(() => artists.map(enrichArtist), [artists]);
  const chartArtists = useMemo(() => enriched.filter((a) => a.isChartArtist).sort((a, b) => (a.topChartPosition || 999) - (b.topChartPosition || 999)), [enriched]);
  const risingArtists = useMemo(() => enriched.filter((a) => a.isRising).slice(0, 12), [enriched]);
  const featured = useMemo(() => chartArtists.slice(0, 7), [chartArtists]);
  const totalTracks = useMemo(() => artists.reduce((sum, a) => sum + a.trackCount, 0), [artists]);
  const chartCount = useMemo(() => artists.filter((a) => a.isChartArtist).length, [artists]);
  const countryCount = useMemo(() => new Set(artists.map((a) => normalizeCountry(a.country)).filter(Boolean)).size, [artists]);

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

  /* ── Smart sorting: intentional by default, never just alphabetical ── */
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortMode) {
      case "featured":
        // Chart artists first (by peak position), then by track count, then name
        list.sort((a, b) => {
          const aChart = a.isChartArtist ? 1 : 0;
          const bChart = b.isChartArtist ? 1 : 0;
          if (aChart !== bChart) return bChart - aChart;
          if (a.isChartArtist && b.isChartArtist) {
            return (a.topChartPosition || 999) - (b.topChartPosition || 999);
          }
          // Non-chart: sort by track count desc, then name
          if (a.trackCount !== b.trackCount) return b.trackCount - a.trackCount;
          return a.name.localeCompare(b.name);
        });
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        list.sort((a, b) => (b.debutYear || 0) - (a.debutYear || 0));
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
    const map = new Map<string, RepairedArtist[]>();
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
    const map = new Map<string, RepairedArtist[]>();
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
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">Loading African Greats</span>
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
          Every artist image woven into a single
          breathing tapestry — the continent's faces,
          unframed, ungridded, alive.
          ═══════════════════════════════════════════ */}
      <SplitHeroWrapper
        artists={enriched}
        totalArtists={artists.length}
        chartCount={chartCount}
        countryCount={countryCount}
        totalTracks={totalTracks}
      />

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

      {/* ════════ FULL DIRECTORY — intentional, not alphabetical ════════ */}
      <section id="directory" className="px-4 md:px-6 py-14 md:py-20">
        <div className="wk-container-wide">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="wk-eyebrow mb-3">Complete archive</div>
              <h2 className="wk-h-page">Every voice, every nation</h2>
            </div>
            <p className="wk-copy max-w-[44ch] text-[13px]">
              Browse {artists.length.toLocaleString()} artists shaping the sound of the continent — ranked by impact, not alphabet.
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
                  placeholder="Search artist, genre, or country"
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

          {/* Sort bar — intentional curation, not A-Z luck */}
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
              <div className="mt-3 text-[14px] text-[var(--wk-text-muted)]">No artists match this search.</div>
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
                    {artist.imageUrl ? (
                      <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105" />
                    ) : (
                      <Ch19GradientImage slug={artist.slug} name={artist.name} />
                    )}
                    {/* Chart artist indicator */}
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
                        <img src={flagUrl} alt="" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
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
                    {artist.imageUrl ? (
                      <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover object-top" />
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
                        <img src={flagUrl} alt="" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
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
    </div>
  );
}

/* ═════════════════════════════════════════
   FULL-BLEED MASONRY COLLAGE HERO
   Every artist image woven into a single
   breathing tapestry — the continent's faces,
   unframed, ungridded, alive.
   ═════════════════════════════════════════ */

interface SplitHeroProps {
  artists: ReturnType<typeof enrichArtist>[];
  totalArtists: number;
  chartCount: number;
  countryCount: number;
  totalTracks: number;
}

/** Wrapper reads the admin-configured count and passes it down */
function SplitHeroWrapper(props: SplitHeroProps) {
  const imageCount = useArtistHeroCount();
  return <SplitHero {...props} imageCount={imageCount} />;
}

function SplitHero({ artists, totalArtists, chartCount, countryCount, totalTracks, imageCount }: SplitHeroProps & { imageCount: number }) {
  const collageArtists = useMemo(() => {
    // Use the admin-configured count
    return artists.filter((a) => a.imageUrl).slice(0, imageCount);
  }, [artists, imageCount]);

  const columnCount = useMemo(() => getHeroColumnCount(imageCount), [imageCount]);
  const isSingleImage = imageCount <= 1;

  // Tile images and distribute into columns — guarantees full-height coverage
  const columns = useMemo(() => {
    if (collageArtists.length === 0 || isSingleImage) return [];
    // Each column needs at least 8 items for good visual rhythm
    const needed = Math.max(collageArtists.length, columnCount * 8);
    const tiled: typeof collageArtists = [];
    while (tiled.length < needed) tiled.push(...collageArtists);
    const sliced = tiled.slice(0, needed);
    // Distribute round-robin into column arrays
    const cols: typeof collageArtists[] = Array.from({ length: columnCount }, () => []);
    sliced.forEach((img, i) => cols[i % columnCount].push(img));
    return cols;
  }, [collageArtists, columnCount, isSingleImage]);

  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

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

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--wk-bg)]"
    >
      {/* ═══ MASONRY COLLAGE — full-bleed background ═══
           Container extends 100px past top & bottom so parallax motion
           never exposes raw background. Section overflow:hidden clips it. */}
      <div className="absolute inset-x-0 z-0" style={{ top: -100, bottom: -100 }}>
        {isSingleImage && collageArtists.length > 0 ? (
          /* 1 image — fullwidth portrait, edge to edge */
          <img
            src={collageArtists[0].imageUrl!}
            alt={collageArtists[0].name}
            className="h-full w-full object-cover object-top"
            loading="eager"
          />
        ) : (
          /* Flex column layout — each column stretches to full hero height,
             each image flex-grows to fill its share. Zero gaps at top/bottom. */
          <div
            className="flex h-full w-full"
            style={{ gap: `${getHeroGap(columnCount)}px` }}
          >
            {columns.map((colImages, colIdx) => {
              // Alternate columns drift at different parallax speeds
              const speed = (colIdx % 3 === 0 ? -1 : colIdx % 3 === 1 ? 0.5 : -0.7);
              const colParallax = speed * scrollY * 0.018;
              return (
                <div
                  key={colIdx}
                  className="flex flex-1 flex-col"
                  style={{
                    gap: `${getHeroGap(columnCount)}px`,
                    transform: `translateY(${colParallax}px)`,
                    transition: "transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  }}
                >
                  {colImages.map((artist, rowIdx) => {
                    const flexVal = FLEX_WEIGHTS[(colIdx + rowIdx * 3) % FLEX_WEIGHTS.length];
                    return (
                      <div
                        key={`${artist.slug}-${colIdx}-${rowIdx}`}
                        className="overflow-hidden"
                        style={{
                          flex: flexVal,
                          borderRadius: columnCount >= 14 ? "2px" : columnCount >= 9 ? "3px" : columnCount >= 5 ? "5px" : "8px",
                          minHeight: 0,
                          /* Make cell a flex container so img h-full resolves correctly */
                          display: "flex",
                        }}
                      >
                        <img
                          src={artist.imageUrl!}
                          alt={artist.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
                          loading={colIdx * colImages.length + rowIdx < 20 ? "eager" : "lazy"}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ GRADIENT OVERLAYS — depth and text readability ═══ */}
      {/* Dark base fade from edges */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[var(--wk-bg)]/70 via-[var(--wk-bg)]/30 to-[var(--wk-bg)]/70" />
      {/* Stronger radial vignette for text contrast */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />
      {/* Brand-tinted ambient glow behind text zone */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--wk-brand)] opacity-[0.04] blur-[160px]" />

      {/* ═══ CONTENT — floating over the collage ═══ */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 py-24 text-center md:px-6 md:py-32">
        {/* Eyebrow */}
        <div className="hero-text-reveal mb-6 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)] animate-pulse" />
            The continent&apos;s voices
          </span>
        </div>

        {/* Title — massive, centered, commanding */}
        <h1 className="hero-text-reveal hero-text-reveal-d1 mb-6 font-black text-[clamp(64px,10vw,140px)] leading-[0.82] tracking-[-0.06em] text-white drop-shadow-[0_4px_40px_rgba(0,0,0,0.5)]">
          African<br />
          <span className="text-[var(--wk-brand)] drop-shadow-[0_4px_40px_rgba(0,0,0,0.5)]">Greats</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-text-reveal hero-text-reveal-d2 mb-10 max-w-[56ch] text-[17px] leading-[1.7] text-white/80 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] md:text-[19px]">
          A curated hall of the artists, pioneers, and rising voices shaping the sound of Africa.
          From chart-toppers to underground legends — every story, every nation, every beat.
        </p>

        {/* CTAs */}
        <div className="hero-text-reveal hero-text-reveal-d3 mb-12 flex flex-wrap items-center justify-center gap-3">
          <Link to="/charts/directory" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all duration-[var(--wk-d-fast)] hover:bg-[var(--wk-brand)]/80 hover:scale-[1.03] whitespace-nowrap">
            <WkIcon name="BarChart3" size={14} />
            Explore charts
          </Link>
          <Link to="#directory" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-[13px] font-bold text-white backdrop-blur-md transition-all duration-[var(--wk-d-fast)] hover:bg-white/20 hover:border-white/50 whitespace-nowrap">
            <WkIcon name="Users" size={14} />
            Browse all artists
          </Link>
          <div className="ml-0 md:ml-3">
            <ShareButton item={{ title: "African Greats — WAKILISHA", subtitle: `${totalArtists} artists`, description: "A curated hall of African musical legends and rising voices.", type: "artist" }} />
          </div>
        </div>

        {/* Stats row — glass-morphism cards */}
        <div className="hero-text-reveal hero-text-reveal-d4 flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {[
            { value: totalArtists, label: "Artists", suffix: "+" },
            { value: chartCount, label: "On the charts" },
            { value: countryCount, label: "Nations" },
            { value: totalTracks, label: "Tracks" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-2xl border border-white/15 bg-white/8 px-6 py-4 backdrop-blur-lg md:px-8 md:py-5"
            >
              <div className="text-[32px] font-black tracking-[-0.04em] text-white md:text-[40px]">
                <AnimatedStatHero value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ BOTTOM FADE — transition to next section ═══ */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-32 bg-gradient-to-t from-[var(--wk-bg)] to-transparent" />

      {/* Scroll hint */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Scroll</span>
          <div className="h-10 w-[1px] animate-pulse bg-white/25" />
        </div>
      </div>
    </section>
  );
}

function AnimatedStatHero({ value, suffix }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const start = performance.now();
            const duration = 1600;
            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setDisplay(Math.round(value * eased));
              if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}{suffix || ""}
    </span>
  );
}