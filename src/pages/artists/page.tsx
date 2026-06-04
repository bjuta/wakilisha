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

/* ─────────────── helpers ─────────────── */

const PAGE_SIZE = 12;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
  const [alphaFilter, setAlphaFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
      const matchesAlpha = alphaFilter === "All" || a.name.toUpperCase().startsWith(alphaFilter);
      return matchesFilter && matchesQuery && matchesAlpha;
    });
  }, [artists, filter, alphaFilter, query]);

  const hasMore = visibleCount < filtered.length;
  const paginated = filtered.slice(0, visibleCount);

  const loadMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  const updateFilter = (next: string) => { setFilter(next); setVisibleCount(PAGE_SIZE); };
  const updateAlpha = (next: string) => { setAlphaFilter(next); setVisibleCount(PAGE_SIZE); };

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
          SPLIT HERO — massive type + image mosaic
          ═══════════════════════════════════════════ */}
      <SplitHero
        artists={enriched.slice(0, 18)}
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

      {/* ════════ FULL DIRECTORY ════════ */}
      <section id="directory" className="px-4 md:px-6 py-14 md:py-20">
        <div className="wk-container-wide">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="wk-eyebrow mb-3">Complete archive</div>
              <h2 className="wk-h-page">Every voice, every nation</h2>
            </div>
            <p className="wk-copy max-w-[44ch] text-[13px]">
              Browse {artists.length.toLocaleString()} artists shaping the sound of the continent.
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

          {/* A-Z strip */}
          <div className="az-strip">
            <button onClick={() => updateAlpha("All")} className={`az-btn ${alphaFilter === "All" ? "on" : ""}`}>All</button>
            {ALPHABET.map((letter) => (
              <button key={letter} onClick={() => updateAlpha(letter)} className={`az-btn ${alphaFilter === letter ? "on" : ""}`}>
                {letter}
              </button>
            ))}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
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
                  <div className="relative aspect-[4/5] overflow-hidden bg-[var(--wk-surface-raised)]">
                    {artist.imageUrl ? (
                      <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <i className="ri-user-3-line text-4xl text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-[15px] font-bold text-white md:text-[16px]">{artist.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55">
                        {flagUrl && (
                          <img src={flagUrl} alt="" className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover" />
                        )}
                        <span>{getCountryLabel(artist.country)}</span>
                        <span>·</span>
                        <span>{artist.trackCount} tracks</span>
                      </div>
                    </div>
                    {artist.isChartArtist && (
                      <div className="absolute left-3 top-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                          <WkIcon name="BadgeCheck" size={9} />
                          Chart
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {artist.genres.slice(0, 2).map((g) => (
                        <span key={g} className="tag tag-sm">{g}</span>
                      ))}
                    </div>
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
                      <div className="flex h-full w-full items-center justify-center">
                        <i className="ri-user-3-line text-xl text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[14px] font-bold text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] md:text-[15px]">{artist.name}</h4>
                      {artist.isChartArtist && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                          <WkIcon name="BadgeCheck" size={9} />
                          #{artist.topChartPosition}
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
                Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more artists
                <i className="ri-arrow-down-line text-[14px] transition-transform group-hover:translate-y-0.5" />
              </button>
              <span className="ml-4 self-center text-[12px] text-[var(--wk-text-faint)]">
                {visibleCount} of {filtered.length}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ═════════════════════════════════════════
   SPLIT HERO
   Left: massive typography + stats + CTAs
   Right: artist image mosaic collage
   ═════════════════════════════════════════ */

interface SplitHeroProps {
  artists: ReturnType<typeof enrichArtist>[];
  totalArtists: number;
  chartCount: number;
  countryCount: number;
  totalTracks: number;
}

function SplitHero({ artists, totalArtists, chartCount, countryCount, totalTracks }: SplitHeroProps) {
  const mosaicArtists = useMemo(() => {
    return artists.filter((a) => a.imageUrl).slice(0, 12);
  }, [artists]);

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[var(--wk-bg)]">
      {/* Subtle ambient gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[20%] -top-[10%] h-[600px] w-[600px] rounded-full bg-[var(--wk-brand)] opacity-[0.03] blur-[120px]" />
        <div className="absolute -right-[10%] bottom-[10%] h-[500px] w-[500px] rounded-full bg-[var(--wk-brand-2)] opacity-[0.02] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 py-24 md:px-6 lg:flex-row lg:items-center lg:gap-16 lg:py-32 xl:px-8">
        {/* LEFT: Typography + content */}
        <div className="flex flex-col lg:w-[52%]">
          {/* Eyebrow */}
          <div className="hero-text-reveal mb-5 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-[var(--wk-surface)] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)]" />
              The continent&apos;s voices
            </span>
          </div>

          {/* Title */}
          <h1 className="hero-text-reveal hero-text-reveal-d1 mb-6 font-black text-[clamp(56px,8vw,120px)] leading-[0.85] tracking-[-0.055em] text-[var(--wk-text)]">
            African<br />
            <span className="text-[var(--wk-brand)]">Greats</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-text-reveal hero-text-reveal-d2 mb-8 max-w-[48ch] text-[16px] leading-[1.65] text-[var(--wk-text-muted)] md:text-[18px]">
            A curated hall of the artists, pioneers, and rising voices shaping the sound of Africa.
            From chart-toppers to underground legends — every story, every nation, every beat.
          </p>

          {/* CTAs */}
          <div className="hero-text-reveal hero-text-reveal-d3 mb-10 flex flex-wrap items-center gap-3">
            <Link to="/charts/directory" className="wk-button wk-button-primary whitespace-nowrap">
              <WkIcon name="BarChart3" size={14} />
              Explore charts
            </Link>
            <Link to="#directory" className="wk-button wk-button-ghost whitespace-nowrap">
              <WkIcon name="Users" size={14} />
              Browse all artists
            </Link>
            <div className="ml-0 md:ml-auto">
              <ShareButton item={{ title: "African Greats — WAKILISHA", subtitle: `${totalArtists} artists`, description: "A curated hall of African musical legends and rising voices.", type: "artist" }} />
            </div>
          </div>

          {/* Stats row */}
          <div className="hero-text-reveal hero-text-reveal-d4 flex flex-wrap gap-8 border-t border-[var(--wk-divider)] pt-6 md:gap-12">
            {[
              { value: totalArtists, label: "Artists", suffix: "+" },
              { value: chartCount, label: "On the charts" },
              { value: countryCount, label: "Nations" },
              { value: totalTracks, label: "Tracks" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[28px] font-black tracking-[-0.04em] text-[var(--wk-text)] md:text-[36px]">
                  <AnimatedStatHero value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Artist image mosaic */}
        <div className="lg:w-[48%]">
          <div className="hero-text-reveal hero-text-reveal-d2 relative grid grid-cols-3 gap-2 md:gap-3">
            {mosaicArtists.slice(0, 9).map((artist, i) => {
              const spans = [
                "md:row-span-2 md:col-span-2",
                "",
                "md:row-span-2",
                "",
                "md:col-span-2",
                "",
                "md:col-span-2",
                "",
                "md:row-span-2",
              ];
              return (
                <Link
                  key={artist.slug}
                  to={`/artists/${artist.slug}`}
                  className={`group relative overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] transition-all duration-[var(--wk-d-standard)] hover:z-10 hover:scale-[1.03] hover:shadow-2xl ${spans[i] || ""}`}
                  style={{ minHeight: i === 0 || i === 2 || i === 8 ? "200px" : "120px" }}
                >
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--wk-surface-raised)]">
                      <i className="ri-user-3-line text-2xl text-[var(--wk-text-faint)]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-[11px] font-bold text-white">{artist.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">Scroll</span>
          <div className="h-8 w-[1px] animate-pulse bg-[var(--wk-text-faint)]" />
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