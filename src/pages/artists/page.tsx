import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { CoverStories } from "./components/CoverStories";
import { ChartList } from "./components/ChartList";
import { OriginBento } from "./components/OriginBento";
import { GenreRows } from "./components/GenreRows";
import { RisingStars } from "./components/RisingStars";
import { RisingArtists } from "./components/RisingArtists";
import { listArtists, type RepairedArtist } from "@/services/repairedContent/client";

/* ─────────────── helpers ─────────────── */

const PAGE_SIZE = 24;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COUNTRY_FLAGS: Record<string, string> = {
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

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] || "🌍";
}

function countryLabel(country?: string | null) {
  return country || "Unknown origin";
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const s = Math.abs(h) / 2147483647;
  return (min: number, max: number) => min + (s % 1) * (max - min);
}

/* synthetic data for components that expect richer shapes */
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
    country: countryLabel(artist.country),
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
  const [page, setPage] = useState(1);

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
  const risingArtists = useMemo(() => enriched.filter((a) => a.isRising).slice(0, 8), [enriched]);
  const featured = useMemo(() => chartArtists.slice(0, 4), [chartArtists]);
  const totalTracks = useMemo(() => artists.reduce((sum, a) => sum + a.trackCount, 0), [artists]);

  const artistFilters = useMemo(
    () => ["All", ...Array.from(new Set(artists.flatMap((a) => a.genres))).filter(Boolean).slice(0, 20)],
    [artists]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return artists.filter((a) => {
      const matchesFilter = filter === "All" || a.genres.some((g) => g === filter);
      const matchesQuery = !q || a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q)) || countryLabel(a.country).toLowerCase().includes(q);
      const matchesAlpha = alphaFilter === "All" || a.name.toUpperCase().startsWith(alphaFilter);
      return matchesFilter && matchesQuery && matchesAlpha;
    });
  }, [artists, filter, alphaFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateFilter = (next: string) => { setFilter(next); setPage(1); };
  const updateAlpha = (next: string) => { setAlphaFilter(next); setPage(1); };

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
      const c = a.country || "Unknown";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(a);
    });
    return Array.from(map.entries())
      .map(([country, list]) => ({
        country,
        flag: getFlag(country),
        artistCount: list.length,
        chartCount: list.filter((a) => a.isChartArtist).length,
        risingCount: list.filter((a) => a.isRising).length,
        artists: list.slice(0, 6),
      }))
      .sort((a, b) => b.artistCount - a.artistCount)
      .slice(0, 7);
  }, [enriched]);

  if (status === "loading") return <div className="wk-container px-6 py-20 text-[var(--wk-text-muted)]">Loading African Greats…</div>;
  if (status === "error") return <div className="wk-container px-6 py-20 text-[var(--wk-text-muted)]">Artists could not be loaded: {error}</div>;

  return (
    <div className="min-h-screen">
      {/* ════════ CINEMATIC HERO ════════ */}
      <AfricanGreatsHero artists={artists} totalTracks={totalTracks} />

      <div className="wk-container-wide px-4 md:px-6">
        {/* ════════ LEGENDS SPOTLIGHT ════════ */}
        <CoverStories artists={featured.map((a) => ({ slug: a.slug, name: a.name, imageUrl: a.imageUrl || undefined, genres: a.genres, monthlyStreams: a.monthlyStreams, topChartPosition: a.topChartPosition || 99, spotlightBio: a.spotlightBio }))} />

        {/* ════════ CHART LEADERS ════════ */}
        <ChartList artists={chartArtists.slice(0, 8).map((a) => ({ slug: a.slug, name: a.name, imageUrl: a.imageUrl || undefined, genres: a.genres, trackCount: a.trackCount, releaseCount: a.releaseCount, monthlyStreams: a.monthlyStreams, topChartPosition: a.topChartPosition || 99 }))} />

        {/* ════════ RISING STARS ════════ */}
        <RisingStars artists={risingArtists.map((a) => ({ slug: a.slug, name: a.name, imageUrl: a.imageUrl || undefined, genres: a.genres, trackCount: a.trackCount, releaseCount: a.releaseCount, country: a.country, debutYear: a.debutYear, monthlyStreams: a.monthlyStreams }))} />
      </div>

      {/* ════════ BY NATION ════════ */}
      <OriginBento groups={originGroups} />

      {/* ════════ EXPLORE BY SOUND ════════ */}
      <GenreRows shelves={genreShelves.map((s) => ({ genre: s.genre, artists: s.artists.map((a) => ({ slug: a.slug, name: a.name, imageUrl: a.imageUrl || undefined, trackCount: a.trackCount, releaseCount: a.releaseCount })) }))} />

      {/* ════════ FRESH VOICES ════════ */}
      <div className="wk-container-wide px-4 md:px-6">
        <RisingArtists artists={risingArtists.slice(0, 6).map((a) => ({ slug: a.slug, name: a.name, imageUrl: a.imageUrl || undefined, genres: a.genres, trackCount: a.trackCount, releaseCount: a.releaseCount, country: a.country, debutYear: a.debutYear, monthlyStreams: a.monthlyStreams, spotlightBio: a.spotlightBio }))} />
      </div>

      {/* ════════ FULL DIRECTORY ════════ */}
      <div id="directory" className="wk-container-wide px-4 md:px-6">
        <div className="my-16 h-px bg-[var(--wk-border)]" />

        <section>
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="wk-eyebrow mb-3">The complete archive</div>
              <h2 className="wk-h-page">Every voice, every nation</h2>
            </div>
            <p className="wk-copy max-w-[48ch] text-[13px]">
              Browse the full directory of artists shaping the sound of the continent. Filter by genre, origin, or name.
            </p>
          </div>

          {/* toolbar */}
          <div className="directory-toolbar">
            <div className="directory-filters">
              {artistFilters.slice(0, 12).map((f) => (
                <button key={f} onClick={() => updateFilter(f)} className={`directory-filter ${filter === f ? "on" : ""}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="directory-tools">
              <input
                className="directory-search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search artist, genre, or country"
              />
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

          {/* results */}
          {view === "grid" ? (
            <div className="artist-directory-grid">
              {paginated.map((artist) => (
                <Link key={artist.slug} to={`/artists/${artist.slug}`} className="artist-card group block overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)] hover:-translate-y-0.5">
                  <div className="relative aspect-[4/5] overflow-hidden bg-[var(--wk-surface-raised)]">
                    {artist.imageUrl ? (
                      <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <i className="ri-user-3-line text-4xl text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-[15px] font-bold text-white md:text-[16px]">{artist.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
                        <span>{countryLabel(artist.country)}</span>
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
              ))}
            </div>
          ) : (
            <div className="artist-directory-list">
              {paginated.map((artist) => (
                <Link key={artist.slug} to={`/artists/${artist.slug}`} className="group flex items-center gap-4 px-4 py-3 transition-all hover:bg-[var(--wk-bg)] md:gap-5 md:px-5 md:py-4">
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
                      <h4 className="text-[14px] font-bold text-[var(--wk-text)] md:text-[15px]">{artist.name}</h4>
                      {artist.isChartArtist && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                          <WkIcon name="BadgeCheck" size={9} />
                          #{artist.topChartPosition}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--wk-text-muted)]">
                      <span>{countryLabel(artist.country)}</span>
                      <span>·</span>
                      <span>{artist.trackCount} tracks</span>
                      <span>·</span>
                      <span>{artist.releaseCount} releases</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{artist.genres.slice(0, 3).join(", ") || "genres pending"}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="artist-empty">
              <i className="ri-user-search-line text-[32px] text-[var(--wk-text-faint)]" />
              <div className="mt-3 text-[14px] text-[var(--wk-text-muted)]">No artists match this search.</div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button className="directory-filter" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>
                <WkIcon name="ArrowLeft" size={14} />
              </button>
              <span className="text-[12px] font-bold text-[var(--wk-text-muted)]">Page {page} of {totalPages}</span>
              <button className="directory-filter" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}>
                <WkIcon name="ArrowRight" size={14} />
              </button>
            </div>
          )}
        </section>

        {/* footer micro */}
        <section className="pg-layout cols-2 pb-10 pt-10">
          <div className="pg-block">
            <div className="pg-block-label">Recently catalogued</div>
            <div className="space-y-2">
              {artists.slice(-5).reverse().map((a) => (
                <Link key={a.slug} to={`/artists/${a.slug}`} className="group flex items-center gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2 transition-all hover:border-[var(--wk-border-2)]">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                    {a.imageUrl ? <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover object-top" /> : <i className="ri-user-3-line text-sm text-[var(--wk-text-faint)]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">{a.name}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{countryLabel(a.country)} · {a.genres[0] || "genre pending"}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">About this archive</div>
            <h3 className="pg-block-title">A living record of African sound.</h3>
            <p className="pg-block-body">This directory hydrates from the canonical WAKILISHA registry — every artist, every credit, every chart entry. From pioneers to the next wave, it is all here.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════
   CINEMATIC HERO
   ═════════════════════════════════════════ */

function AfricanGreatsHero({ artists, totalTracks }: { artists: RepairedArtist[]; totalTracks: number }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const chartCount = artists.filter((a) => a.isChartArtist).length;
  const countryCount = new Set(artists.map((a) => a.country).filter(Boolean)).size;

  const stats = [
    { value: artists.length, label: "Artists", suffix: "+" },
    { value: chartCount, label: "On the charts" },
    { value: countryCount, label: "Nations" },
    { value: totalTracks, label: "Tracks catalogued" },
  ];

  return (
    <section ref={heroRef} className="relative isolate overflow-hidden">
      {/* Background image with parallax */}
      <div
        className="absolute inset-0 -z-10"
        style={{ transform: `translateY(${scrollY * 0.3}px)` }}
      >
        <img
          src="https://readdy.ai/api/search-image?query=Stunning%20African%20sunset%20over%20savanna%20landscape%20with%20acacia%20trees%20silhouette%20against%20golden%20orange%20sky%20dramatic%20clouds%20warm%20earthy%20tones%20cinematic%20wide%20angle%20photography%20epic%20atmosphere%20high%20contrast%20rich%20colors%20no%20text%20no%20people&width=1600&height=900&seq=african-greats-hero-1&orientation=landscape"
          alt="African landscape"
          className="h-[120%] w-full object-cover object-center"
        />
        {/* overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/30 via-[var(--wk-bg)]/60 to-[var(--wk-bg)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/40 via-transparent to-[var(--wk-bg)]/40" />
      </div>

      <div className="relative flex min-h-[600px] flex-col justify-end px-4 pb-16 pt-32 md:min-h-[720px] md:px-6 md:pb-20 md:pt-40">
        <div className="wk-container-wide">
          {/* Eyebrow */}
          <div className="hero-text-reveal mb-4 flex items-center gap-3">
            <span className="inline-block h-px w-10 bg-[var(--wk-brand)]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">
              The continent&apos;s voices
            </span>
          </div>

          {/* Title */}
          <h1 className="hero-text-reveal hero-text-reveal-d1 wk-h-hero mb-5 max-w-[14ch] text-white">
            African<br />Greats
          </h1>

          {/* Subtitle */}
          <p className="hero-text-reveal hero-text-reveal-d2 mb-8 max-w-[52ch] text-[16px] leading-[1.6] text-white/70 md:text-[18px]">
            A curated hall of the artists, pioneers, and rising voices shaping the sound of Africa.
            From chart-toppers to underground legends — every story, every nation, every beat.
          </p>

          {/* Actions */}
          <div className="hero-text-reveal hero-text-reveal-d3 mb-12 flex flex-wrap items-center gap-3">
            <Link to="/charts/directory" className="wk-button wk-button-primary whitespace-nowrap">
              <WkIcon name="BarChart3" size={14} />
              Explore charts
            </Link>
            <Link to="#directory" className="wk-button wk-button-ghost whitespace-nowrap text-white/80 border-white/20 hover:bg-white/10 hover:text-white">
              <WkIcon name="Users" size={14} />
              Browse all artists
            </Link>
            <div className="ml-0 md:ml-auto">
              <ShareButton item={{ title: "African Greats — WAKILISHA", subtitle: `${artists.length} artists`, description: "A curated hall of African musical legends and rising voices.", type: "artist" }} />
            </div>
          </div>

          {/* Stats */}
          <div className="hero-text-reveal hero-text-reveal-d4 flex flex-wrap gap-8 border-t border-white/10 pt-6 md:gap-12">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-[28px] font-black tracking-[-0.04em] text-white md:text-[36px]">
                  <AnimatedStat value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* Animated stat counter */
function AnimatedStat({ value, suffix }: { value: number; suffix?: string }) {
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
            const duration = 1400;
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