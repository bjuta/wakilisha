import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { usePlayer } from "@/context/PlayerContext";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import {
  listArtists,
  listReleases,
  listMagazineStories,
  type RepairedArtist,
  type RepairedRelease,
  type RepairedStory,
} from "@/services/repairedContent/client";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
  type ChartEditionEntry,
} from "@/services/chartsPublic/client";

// ══════════════════════════════════════════════════════════════
//  ANIMATION HOOK — Scroll-triggered reveals
// ══════════════════════════════════════════════════════════════
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ══════════════════════════════════════════════════════════════
//  PILLARS DATA
// ══════════════════════════════════════════════════════════════
const PILLARS = [
  { key: "music", label: "Music", icon: "ri-music-2-fill", colorVar: "--wk-v-music", href: "/charts", status: "active" as const, imageSeq: "pillar-music-v2" },
  { key: "guides", label: "Guides", icon: "ri-compass-3-fill", colorVar: "--wk-v-intel", href: "/guides", status: "new" as const, imageSeq: "pillar-guides-v2" },
  { key: "film", label: "Film", icon: "ri-film-fill", colorVar: "--wk-v-film", href: "/film", status: "coming" as const, imageSeq: "pillar-film-v2" },
  { key: "fashion", label: "Fashion", icon: "ri-t-shirt-fill", colorVar: "--wk-v-fashion", href: "/fashion", status: "coming" as const, imageSeq: "pillar-fashion-v2" },
  { key: "food", label: "Food", icon: "ri-restaurant-fill", colorVar: "--wk-v-food", href: "/food", status: "coming" as const, imageSeq: "pillar-food-v2" },
  { key: "language", label: "Language", icon: "ri-global-fill", colorVar: "--wk-v-language", href: "/language", status: "coming" as const, imageSeq: "pillar-language-v2" },
  { key: "places", label: "Places", icon: "ri-map-pin-fill", colorVar: "--wk-v-places", href: "/places", status: "coming" as const, imageSeq: "pillar-places-v2" },
] as const;

// ══════════════════════════════════════════════════════════════
//  ANIMATED COUNTER
// ══════════════════════════════════════════════════════════════
function AnimatedCounter({ value, suffix = "", duration = 800 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, visible } = useScrollReveal(0.3);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, value, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ══════════════════════════════════════════════════════════════
//  FLOATING PARTICLES — Decorative cultural motifs
// ══════════════════════════════════════════════════════════════
function FloatingParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {[...Array(18)].map((_, i) => {
        const shapes = ["◆", "○", "◈", "◇", "●"];
        const shape = shapes[i % shapes.length];
        const left = 5 + (i * 5.2) % 90;
        const delay = (i * 0.7) % 8;
        const duration = 6 + (i % 4) * 3;
        const size = 6 + (i % 3) * 4;
        return (
          <span
            key={i}
            className="absolute text-[var(--wk-brand)]/15 animate-float-slow"
            style={{
              left: `${left}%`,
              top: `${20 + (i * 13) % 60}%`,
              fontSize: `${size}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          >
            {shape}
          </span>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  VERTICAL COLOR DOT
// ══════════════════════════════════════════════════════════════
function ColorDot({ colorVar }: { colorVar: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: `var(${colorVar})` }}
    />
  );
}

// ══════════════════════════════════════════════════════════════
//  HOME PAGE
// ══════════════════════════════════════════════════════════════
export default function Home() {
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const { playTrack } = usePlayer();

  const [chartEntries, setChartEntries] = useState<ChartEditionEntry[]>([]);
  const [stories, setStories] = useState<RepairedStory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [storiesData] = await Promise.all([
        listMagazineStories(),
      ]);
      setStories(storiesData);

      const { data: families } = await getChartFamilies();
      if (families.length > 0) {
        const featuredSlug = families[0].publicSlug ?? families[0].slug ?? families[0].familyKey;
        const { data: edition } = await getLatestChartEdition(featuredSlug);
        if (edition) {
          const { data: entries } = await getChartEditionEntries(featuredSlug, edition.slug);
          setChartEntries(entries);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load data";
      setLoadError(message);
      // eslint-disable-next-line no-console
      console.error("Home page data load failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const topEntry = chartEntries[0];
  const chartRest = chartEntries.slice(1, 9);

  const chartTracks = chartEntries.map((entry) => ({
    id: entry.trackSlug || `${entry.trackTitle}-${entry.artistNames?.[0] || ""}`.toLowerCase().replace(/\s+/g, "-"),
    title: entry.trackTitle,
    artist: entry.artistNames?.[0] || "Unknown",
    artworkUrl: entry.artworkUrl || undefined,
    isPlayable: entry.isPlayable ?? true,
  }));

  const handlePlayChart = (idx: number) => {
    playTrack(chartTracks[idx], chartTracks);
  };

  const editorialStories = stories.slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  HERO — Immersive, layered, breathing with life   │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="relative h-[100dvh] flex items-end overflow-hidden">
        {/* Parallax background layer */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{ transform: `translateY(${scrollY * 0.08}px) scale(${1 + scrollY * 0.00015})` }}
        >
          <img
            src="https://readdy.ai/api/search-image?query=Warm%20rich%20textured%20abstract%20composition%20evoking%20African%20cultural%20heritage%20with%20layered%20woven%20textile%20patterns%20flowing%20musical%20rhythm%20lines%20and%20organic%20handcrafted%20surfaces%2C%20amber%20ochre%20terracotta%20and%20deep%20olive%20green%20tones%2C%20golden%20light%20filtering%20through%20like%20gallery%20illumination%2C%20museum%20archival%20quality%20with%20contemporary%20artistic%20sensibility%2C%20subtle%20geometric%20motifs%20inspired%20by%20traditional%20African%20craft%20dissolving%20into%20abstract%20expression%2C%20atmospheric%20depth%20with%20soft%20painterly%20edges%2C%20warm%20emotional%20resonance%20no%20cold%20corporate%20aesthetic%2C%20editorial%20art%20direction%20with%20soul%20and%20texture&width=1600&height=900&seq=hero-wakilisha-art-v3&orientation=landscape"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        {/* Gradient overlays — layered for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />

        {/* Floating cultural particles */}
        <FloatingParticles />

        {/* Content */}
        <div className="relative z-10 w-full px-6 pb-28 md:pb-36">
          <div className="wk-container-wide">
            {/* Five verbs — visual rhythm, not a text list */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8 animate-hero-fade" style={{ animationDelay: "0.15s" }}>
              {["Discovered", "Documented", "Funded", "Valued", "Sustained"].map((verb, i) => (
                <span key={verb} className="inline-flex items-center gap-2 text-[12px] md:text-[13px] font-semibold text-white/50 uppercase tracking-[0.2em]">
                  {verb}
                  {i < 4 && (
                    <span className="w-1 h-1 rounded-full bg-[var(--wk-brand)]/40 hidden sm:inline-block" />
                  )}
                </span>
              ))}
            </div>

            {/* Headline — big, confident, artistic */}
            <h1
              className="max-w-[900px] font-black leading-[0.88] tracking-[-0.05em] text-white animate-hero-fade"
              style={{ fontSize: "clamp(40px, 6.5vw, 104px)", animationDelay: "0.3s" }}
            >
              African culture,{" "}
              <span className="relative inline-block">
                <span className="text-[var(--wk-brand)]">built to last</span>
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[var(--wk-brand)]/30 rounded-full" />
              </span>.
            </h1>

            {/* Subtitle */}
            <p
              className="mt-7 max-w-[580px] text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/60 animate-hero-fade"
              style={{ animationDelay: "0.5s" }}
            >
              WAKILISHA builds the infrastructure African creativity deserves —
              so music, film, fashion, food, language, and place become easier to
              find, easier to support, and harder to erase.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap gap-4 animate-hero-fade" style={{ animationDelay: "0.7s" }}>
              <Link to="/charts" className="whitespace-nowrap group">
                <span className="inline-flex items-center gap-2.5 rounded-full bg-[var(--wk-brand)] px-6 py-3.5 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all duration-300 hover:gap-3.5 hover:shadow-[0_0_30px_rgba(var(--wk-brand-rgb),0.25)] cursor-pointer">
                  <i className="ri-bar-chart-fill text-base" />
                  Explore the Charts
                  <i className="ri-arrow-right-line text-sm transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </Link>
              <Link to="/guides" className="whitespace-nowrap group">
                <span className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-6 py-3.5 text-[14px] font-semibold text-white transition-all duration-300 hover:bg-white/10 hover:border-white/30 cursor-pointer">
                  <i className="ri-compass-3-fill text-base" />
                  Browse Guides
                  <i className="ri-arrow-right-line text-sm transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </div>

            {/* Scroll indicator — subtle, artistic */}
            <div className="mt-12 animate-hero-fade hidden md:block" style={{ animationDelay: "1s" }}>
              <div className="flex flex-col items-start gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/25">Scroll</span>
                <span className="block w-px h-10 bg-gradient-to-b from-white/30 to-transparent animate-scroll-line" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error banner */}
      {loadError && (
        <div className="border-b border-[var(--wk-danger-soft)] bg-[var(--wk-danger-soft)] px-6 py-3">
          <div className="wk-container-wide flex items-center gap-2 text-[13px] text-[var(--wk-danger)]">
            <i className="ri-error-warning-line" />
            <span>Some data could not load: {loadError}</span>
            <button onClick={loadData} className="ml-auto font-bold underline underline-offset-2">Retry</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  CHARTS SHOWCASE — Front and center, album art    │
          │  treated as art. Living, breathing chart object.   │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-24 overflow-hidden" style={{ background: "var(--wk-bg)" }}>
        {/* Decorative texture strip */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--wk-brand)]/20 to-transparent" />

        <div className="wk-container-wide px-6 relative z-10">
          {/* Section header — more character */}
          <div className="mb-10 md:mb-14">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-[2px] bg-[var(--wk-brand)]/60 rounded-full" />
              <span className="text-[10px] font-black text-[var(--wk-brand)] uppercase tracking-[0.22em]">
                Flagship Product
              </span>
            </div>
            <h2 className="font-black text-[clamp(32px,4vw,56px)] leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
              The Charts
            </h2>
            <p className="mt-2 text-[15px] text-[var(--wk-text-muted)] max-w-[500px]">
              The most complete index of African sound. Updated weekly. Built to be cited, studied, and celebrated.
            </p>
          </div>

          {/* #1 — The centerpiece */}
          {topEntry ? (
            <div className="group relative mb-8 rounded-2xl overflow-hidden" style={{ background: "var(--wk-surface)" }}>
              {/* Subtle glow behind #1 */}
              <div
                className="absolute top-0 right-0 w-[500px] h-[500px] opacity-[0.06] pointer-events-none"
                style={{ background: `radial-gradient(circle at center, var(--wk-v-music), transparent 70%)` }}
              />

              <div className="grid md:grid-cols-[minmax(300px,400px)_1fr] relative z-10">
                {/* Album art — large, treated as art */}
                <div className="relative aspect-square bg-[var(--wk-surface-raised)] overflow-hidden">
                  {topEntry.artworkUrl ? (
                    <img
                      src={topEntry.artworkUrl}
                      alt={topEntry.trackTitle}
                      className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <Ch19GradientImage slug={topEntry.trackSlug} name={topEntry.trackTitle} />
                  )}
                  {/* Rank badge — artistic treatment */}
                  <div className="absolute top-5 left-5 md:top-6 md:left-6">
                    <div className="relative">
                      <span className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-[var(--wk-brand)]/90 backdrop-blur-sm text-[var(--wk-brand-on)] font-black text-[24px] md:text-[28px] leading-none">
                        1
                      </span>
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--wk-v-music)] animate-pulse-slow" />
                    </div>
                  </div>
                </div>

                {/* Track info */}
                <div className="p-6 md:p-10 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-2.5 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand-soft)] px-3 py-1 text-[11px] font-bold text-[var(--wk-brand)] uppercase tracking-[0.06em]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)] animate-pulse-slow" />
                      #1 This Week
                    </span>
                    <span className="text-[12px] text-[var(--wk-text-faint)]">
                      {topEntry.weeksOnChart ?? 1} weeks on chart
                    </span>
                  </div>

                  <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
                    {topEntry.trackTitle}
                  </h3>

                  <div className="mt-2 text-[17px] font-medium text-[var(--wk-text-muted)]">
                    {topEntry.artistNames?.[0] || "Unknown"}
                  </div>

                  {/* Stats row — visual, not just text */}
                  <div className="mt-5 flex flex-wrap items-center gap-5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--wk-surface-raised)]">
                        <i className="ri-headphone-line text-[var(--wk-text-soft)]" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-[var(--wk-text-faint)] uppercase tracking-[0.1em]">Score</div>
                        <div className="text-[15px] font-bold text-[var(--wk-text)]">
                          {topEntry.score ? `${Math.round(topEntry.score / 100)}K` : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--wk-surface-raised)]">
                        <i className="ri-arrow-up-line text-[var(--wk-success)]" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-[var(--wk-text-faint)] uppercase tracking-[0.1em]">Movement</div>
                        <div className="text-[15px] font-bold text-[var(--wk-success)]">
                          +{topEntry.movementAmount ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--wk-surface-raised)]">
                        <i className="ri-music-2-line text-[var(--wk-text-soft)]" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-[var(--wk-text-faint)] uppercase tracking-[0.1em]">Genre</div>
                        <div className="text-[15px] font-bold text-[var(--wk-text)]">
                          {topEntry.genre || "Afrobeats"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      onClick={() => handlePlayChart(0)}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all duration-300 hover:gap-3 hover:shadow-[0_0_25px_rgba(var(--wk-brand-rgb),0.3)] active:scale-[0.97] cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-play-fill text-base" /> Play #1
                    </button>
                    <Link
                      to={`/tracks/${topEntry.trackSlug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] px-6 py-3 text-[13px] font-bold text-[var(--wk-text)] transition-all duration-300 hover:bg-[var(--wk-surface-raised)] hover:border-[var(--wk-border-strong)] active:scale-[0.97] cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-information-line" /> Track Details
                    </Link>
                    <Link
                      to="/charts"
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] px-6 py-3 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all duration-300 hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-bar-chart-line" /> Full Chart
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="mb-8 rounded-2xl bg-[var(--wk-surface)] p-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse mb-4" />
              <div className="h-6 w-48 mx-auto rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          ) : null}

          {/* Positions 2-9 — flowing list with character */}
          {chartRest.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--wk-surface)" }}>
              <div className="border-b px-5 py-3.5 flex items-center justify-between" style={{ borderColor: "var(--wk-divider)" }}>
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)]">
                  Positions 2–{Math.min(chartRest.length + 1, 10)}
                </span>
                <div className="flex items-center gap-4 text-[10px] font-semibold text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-arrow-up-line text-[var(--wk-success)] text-xs" /> Rising
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-arrow-down-line text-[var(--wk-danger)] text-xs" /> Falling
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-star-line text-[var(--wk-brand)] text-xs" /> New
                  </span>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: "var(--wk-divider)" }}>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                        <div className="h-10 w-10 rounded-lg bg-[var(--wk-surface-raised)]" />
                        <div className="h-10 w-10 rounded-lg bg-[var(--wk-surface-raised)]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-36 rounded bg-[var(--wk-surface-raised)]" />
                          <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
                        </div>
                      </div>
                    ))
                  : chartRest.map((entry) => (
                      <Link
                        key={entry.rank}
                        to={`/tracks/${entry.trackSlug}`}
                        className="group flex items-center gap-4 px-5 py-3.5 transition-all duration-200 hover:bg-[var(--wk-surface-raised)] cursor-pointer"
                      >
                        {/* Rank */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center font-black text-[17px] text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)] transition-colors">
                          {entry.rank}
                        </div>

                        {/* Album art thumbnail */}
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                          {entry.artworkUrl ? (
                            <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
                          ) : (
                            <Ch19GradientImage slug={entry.trackSlug} name={entry.trackTitle} />
                          )}
                        </div>

                        {/* Track info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="truncate text-[14px] font-bold text-[var(--wk-text)] group-hover:text-[var(--wk-text)]">
                              {entry.trackTitle}
                            </h4>
                            {entry.movement === "new" && (
                              <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                                New
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[13px] text-[var(--wk-text-muted)]">
                            {entry.artistNames?.[0] || "Unknown"}
                          </div>
                        </div>

                        {/* Stats — visible on larger screens */}
                        <div className="hidden sm:flex items-center gap-4 text-[12px] text-[var(--wk-text-faint)] shrink-0">
                          <span className="inline-flex items-center gap-1">
                            <i className="ri-headphone-line text-[11px]" />
                            {entry.score ? `${Math.round(entry.score / 100)}K` : "—"}
                          </span>
                          <span className="w-10 text-right">{entry.weeksOnChart ?? 1} wks</span>
                        </div>

                        {/* Movement indicator */}
                        <div className="flex items-center gap-1 text-[13px] font-bold shrink-0 min-w-[30px] justify-end">
                          {entry.movement === "up" && (
                            <i className="ri-arrow-up-line text-[var(--wk-success)]" />
                          )}
                          {entry.movement === "down" && (
                            <i className="ri-arrow-down-line text-[var(--wk-danger)]" />
                          )}
                          {entry.movement === "new" && (
                            <i className="ri-star-line text-[var(--wk-brand)]" />
                          )}
                          {entry.movementAmount && entry.movementAmount > 0 && entry.movement !== "new" && (
                            <span style={{ color: entry.movement === "up" ? "var(--wk-success)" : "var(--wk-danger)" }}>
                              {entry.movementAmount}
                            </span>
                          )}
                        </div>

                        {/* Play button — reveals on hover */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const idx = chartEntries.findIndex((c) => c.rank === entry.rank);
                            if (idx >= 0) handlePlayChart(idx);
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 cursor-pointer"
                          aria-label={`Play ${entry.trackTitle}`}
                        >
                          <i className="ri-play-fill text-sm" />
                        </button>
                      </Link>
                    ))}
              </div>

              {/* Footer link */}
              <div className="border-t px-5 py-3.5 text-center" style={{ borderColor: "var(--wk-divider)" }}>
                <Link
                  to="/charts"
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors cursor-pointer"
                >
                  View full chart directory
                  <i className="ri-arrow-right-line text-xs" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  MISSION — Woven as a visual pull-quote, not a     │
          │  standalone text block. Integrated into the flow.  │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-24 overflow-hidden" style={{ background: "var(--wk-bg-subtle)" }}>
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, var(--wk-brand) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="wk-container-wide px-6 relative z-10">
          <div className="max-w-[760px] mx-auto">
            {/* Opening line — large, weighty */}
            <p className="text-[clamp(20px,2.4vw,28px)] leading-[1.45] font-semibold text-[var(--wk-text)] tracking-[-0.01em]">
              African culture does not lack talent, imagination, or relevance.
            </p>

            {/* The thesis */}
            <p className="mt-6 text-[clamp(17px,2vw,22px)] leading-[1.55] text-[var(--wk-text-soft)]">
              What it often lacks are the{" "}
              <span className="relative inline-block">
                <span className="text-[var(--wk-brand)] font-bold">structures</span>
                <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-[var(--wk-brand)]/25 rounded-full" />
              </span>{" "}
              that help creative work travel further, last longer, and generate
              meaningful value for the people and communities behind it.
            </p>

            {/* Divider — artistic */}
            <div className="my-8 flex items-center gap-4">
              <span className="flex-1 h-px bg-[var(--wk-divider)]" />
              <span className="w-2 h-2 rounded-full bg-[var(--wk-brand)]/40" />
              <span className="flex-1 h-px bg-[var(--wk-divider)]" />
            </div>

            {/* The commitment */}
            <p className="text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              WAKILISHA exists to build those structures — so that music, film,
              fashion, food, language, and every expression of African creativity
              becomes easier to find, easier to support, easier to study, and
              harder to erase.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  VERTICALS GALLERY — Visual exhibition, each        │
          │  vertical treated as a distinct artistic vignette   │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6">
          {/* Section header */}
          <div className="mb-10 md:mb-14">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-[2px] bg-[var(--wk-v-fashion)]/60 rounded-full" />
              <span className="text-[10px] font-black text-[var(--wk-text-faint)] uppercase tracking-[0.22em]">
                Cultural Verticals
              </span>
            </div>
            <h2 className="font-black text-[clamp(28px,3.5vw,48px)] leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
              Seven pillars.<br />One ecosystem.
            </h2>
          </div>

          {/* Gallery grid — organic, varied sizes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {/* Music — spans 2 cols on lg, it's the flagship */}
            <Link
              to="/charts"
              className="group relative sm:col-span-2 lg:col-span-2 lg:row-span-2 rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: "var(--wk-surface)" }}
            >
              {/* Image backdrop */}
              <div className="absolute inset-0">
                <img
                  src="https://readdy.ai/api/search-image?query=Rich%20warm%20amber%20textured%20abstract%20celebrating%20African%20music%20culture%2C%20flowing%20organic%20shapes%20suggesting%20sound%20waves%20and%20rhythm%20patterns%2C%20deep%20ochre%20and%20olive%20green%20tones%20with%20golden%20highlights%2C%20layered%20textures%20evoking%20vinyl%20grooves%20woven%20textiles%20and%20musical%20notation%2C%20atmospheric%20gallery%20lighting%20with%20warm%20glow%2C%20artistic%20interpretation%20of%20sound%20as%20visual%20form%2C%20no%20text%20no%20logos%2C%20editorial%20quality%20with%20depth%20and%20soul&width=800&height=600&seq=pillar-music-v2&orientation=landscape"
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              </div>

              <div className="relative z-10 h-full min-h-[280px] md:min-h-[340px] p-6 md:p-8 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[var(--wk-v-music)]" />
                  <span className="text-[10px] font-black text-[var(--wk-v-music)] uppercase tracking-[0.15em]">Active</span>
                </div>
                <h3 className="text-[clamp(22px,2.5vw,32px)] font-black text-white tracking-[-0.03em]">
                  Music
                </h3>
                <p className="mt-2 text-[13px] md:text-[14px] text-white/60 max-w-[320px] leading-relaxed">
                  Charts, artists, tracks, releases, labels, genres — the most complete index of African sound.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold text-white/80 group-hover:text-white group-hover:gap-2.5 transition-all">
                  Explore Music <i className="ri-arrow-right-line" />
                </div>
              </div>
            </Link>

            {/* Guides — spans 2 cols */}
            <Link
              to="/guides"
              className="group relative sm:col-span-2 lg:col-span-2 rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: "var(--wk-surface)" }}
            >
              <div className="absolute inset-0">
                <img
                  src="https://readdy.ai/api/search-image?query=Artistic%20abstract%20composition%20in%20deep%20purple%20and%20violet%20tones%20evoking%20discovery%20exploration%20and%20cultural%20navigation%2C%20layered%20textures%20suggesting%20maps%20compass%20roses%20and%20journey%20paths%2C%20rich%20atmospheric%20depth%20with%20soft%20glowing%20highlights%2C%20contemporary%20gallery%20aesthetic%20with%20warm%20undertones%2C%20abstract%20interpretation%20of%20guidance%20wayfinding%20and%20cultural%20discovery%2C%20editorial%20quality%20no%20text%20no%20logos&width=800&height=350&seq=pillar-guides-v2&orientation=landscape"
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
              </div>

              <div className="relative z-10 min-h-[180px] p-6 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--wk-v-intel)]" />
                  <span className="inline-flex items-center rounded-full bg-[var(--wk-v-intel)]/20 px-2 py-0.5 text-[9px] font-bold text-[var(--wk-v-intel)] uppercase">New</span>
                </div>
                <h3 className="text-[22px] font-black text-white tracking-[-0.03em]">Guides</h3>
                <p className="mt-1.5 text-[13px] text-white/55 max-w-[280px] leading-relaxed">
                  Where to go, what to experience, who to know — your practical discovery layer.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-white/80 group-hover:text-white group-hover:gap-2.5 transition-all">
                  Browse Guides <i className="ri-arrow-right-line" />
                </div>
              </div>
            </Link>

            {/* Film, Fashion, Food, Language, Places — smaller cards */}
            {PILLARS.filter((p) => !["music", "guides"].includes(p.key)).map((pillar, i) => (
              <Link
                key={pillar.key}
                to={pillar.href}
                className="group relative rounded-2xl overflow-hidden cursor-pointer"
                style={{ background: "var(--wk-surface)" }}
              >
                {/* Color accent bar at top */}
                <div
                  className="absolute top-0 left-3 right-3 h-[3px] rounded-b-full opacity-70 transition-opacity group-hover:opacity-100 z-10"
                  style={{ background: `var(${pillar.colorVar})` }}
                />

                <div className="p-5 md:p-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `var(${pillar.colorVar})`, color: "#fff" }}
                    >
                      <i className={`${pillar.icon} text-lg`} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
                        {pillar.label}
                      </h3>
                      <span className="text-[10px] font-semibold text-[var(--wk-text-faint)] uppercase tracking-[0.1em]">Coming Soon</span>
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] line-clamp-2">
                    {pillar.key === "film" && "Filmmaker profiles, cinema calendars, festival coverage, documentary showcases."}
                    {pillar.key === "fashion" && "Designers, textiles, street style, beauty — African aesthetic systems documented."}
                    {pillar.key === "food" && "Chefs, street food, regional histories, culinary routes, food as memory."}
                    {pillar.key === "language" && "Indigenous language archives, lyric annotation, oral histories, vernacular documentation."}
                    {pillar.key === "places" && "Venues, cities, galleries, festivals, cultural routes, travel itineraries."}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  GUIDES FEATURE — Warm, inviting, practical        │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-20" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--wk-surface)" }}>
            {/* Decorative corner gradient */}
            <div
              className="absolute -top-20 -right-20 w-[300px] h-[300px] opacity-[0.05] pointer-events-none rounded-full"
              style={{ background: `var(--wk-v-intel)` }}
            />

            <div className="relative z-10 grid lg:grid-cols-[1fr_320px] gap-0">
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-v-intel)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-v-intel)] uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-v-intel)]" />
                    Just Launched
                  </span>
                </div>
                <h2 className="font-black text-[clamp(22px,2.5vw,34px)] leading-[0.95] tracking-[-0.03em] text-[var(--wk-text)] mb-3">
                  WAKILISHA Guides
                </h2>
                <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] max-w-[480px]">
                  Your practical discovery layer for African creative life.
                  Where to go, what to experience, what to listen to, what to watch,
                  who to know, and how to navigate the culture.
                </p>
                <div className="mt-5">
                  <Link to="/guides" className="whitespace-nowrap">
                    <WkButton variant="primary">
                      <i className="ri-compass-3-fill" /> Browse Guides
                    </WkButton>
                  </Link>
                </div>
              </div>

              {/* Guide categories — visual grid */}
              <div className="hidden lg:grid grid-cols-2 gap-2 p-6 pl-0">
                {[
                  { label: "Where to go", icon: "ri-map-pin-line" },
                  { label: "What to hear", icon: "ri-headphone-line" },
                  { label: "What to watch", icon: "ri-film-line" },
                  { label: "Who to know", icon: "ri-user-star-line" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-colors hover:bg-[var(--wk-surface-raised)] cursor-default"
                    style={{ background: "var(--wk-surface-raised)" }}
                  >
                    <i className={`${item.icon} text-xl`} style={{ color: "var(--wk-v-intel)" }} />
                    <span className="text-[11px] font-bold text-[var(--wk-text)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  MAGAZINE — Editorial gallery, not just cards       │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6">
          <div className="flex items-end justify-between mb-10 md:mb-14">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-[2px] bg-[var(--wk-v-film)]/60 rounded-full" />
                <span className="text-[10px] font-black text-[var(--wk-text-faint)] uppercase tracking-[0.22em]">Magazine</span>
              </div>
              <h2 className="font-black text-[clamp(28px,3.5vw,48px)] leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                Editorial
              </h2>
            </div>
            <Link to="/magazine" className="hidden md:block whitespace-nowrap">
              <WkButton variant="ghost">
                Open Magazine <i className="ri-arrow-right-line" />
              </WkButton>
            </Link>
          </div>

          <div className="grid gap-3 md:gap-4 lg:grid-cols-[1.3fr_1fr]">
            {loading ? (
              <>
                <div className="animate-pulse rounded-xl bg-[var(--wk-surface)] h-[360px]" />
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl bg-[var(--wk-surface)] h-[100px]" />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="lg:row-span-2">
                  {editorialStories[0] && <StoryCard {...editorialStories[0]} isFeatured />}
                </div>
                <div className="flex flex-col gap-3">
                  {editorialStories.slice(1, 4).map((story) => (
                    <StoryCard key={story.slug} {...story} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ┌──────────────────────────────────────────────────┐
          │  NEWSLETTER — Warm community invitation              │
          └──────────────────────────────────────────────────┘
      ═══════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--wk-surface)" }}>
            {/* Subtle decorative gradient */}
            <div
              className="absolute -bottom-20 -left-20 w-[350px] h-[350px] opacity-[0.04] pointer-events-none rounded-full"
              style={{ background: `var(--wk-brand)` }}
            />

            <div className="relative z-10 p-8 md:p-12 max-w-[600px]">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-6 h-[2px] bg-[var(--wk-brand)]/50 rounded-full" />
                <span className="text-[10px] font-black text-[var(--wk-brand)] uppercase tracking-[0.2em]">
                  Stay Connected
                </span>
              </div>
              <h2 className="font-black text-[clamp(22px,2.5vw,32px)] leading-[1.0] tracking-[-0.03em] text-[var(--wk-text)] mb-3">
                The ecosystem, in your inbox.
              </h2>
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-6">
                Chart updates, new guides, editorial deep-dives, and early access to
                new verticals as they launch across African creative life.
              </p>
              <form
                className="flex flex-col sm:flex-row gap-3"
                action="https://readdy.ai/api/form/d8gs0igb91vaa813drjg"
                method="POST"
                data-readdy-form=""
              >
                <div className="flex-1">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3.5 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/40 transition-colors"
                    required
                  />
                </div>
                <WkButton variant="primary">
                  <i className="ri-mail-send-line" /> Subscribe
                </WkButton>
              </form>
              <div className="mt-4 flex items-center gap-4 text-[11px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-shield-check-line text-xs" /> No spam, ever
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-close-circle-line text-xs" /> Unsubscribe anytime
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(3deg); }
          66% { transform: translateY(4px) rotate(-2deg); }
        }
        @keyframes scrollLine {
          0%, 100% { opacity: 0.3; transform: scaleY(1); }
          50% { opacity: 0.1; transform: scaleY(0.4); }
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes heroFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-hero-fade {
          opacity: 0;
          animation: heroFade 0.8s var(--wk-ease-snap) forwards;
        }
        .animate-float-slow {
          animation: floatSlow 8s ease-in-out infinite;
        }
        .animate-scroll-line {
          animation: scrollLine 2.5s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulseSlow 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-hero-fade, .animate-float-slow, .animate-scroll-line, .animate-pulse-slow {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}