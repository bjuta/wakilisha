import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkButton } from "@/components/design-system/primitives/Button";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { SkeletonChartRow, SkeletonCard, SkeletonStoryCard } from "@/components/skeletons/Skeletons";
import { HOME_CHART_ENTRIES, HOME_FEATURED_ARTISTS, HOME_EDITORIAL_STORIES, HOME_GENRE_VERTICALS, HOME_RECENT_RELEASES, HOME_TRENDING_TRACKS } from "@/mocks/home";

function AnimatedEq() {
  return (
    <div className="eq-bars">
      <div className="eq-bar" />
      <div className="eq-bar" />
      <div className="eq-bar" />
      <div className="eq-bar" />
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const { playTrack } = usePlayer();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const top3 = HOME_CHART_ENTRIES.slice(0, 3);
  const restChart = HOME_CHART_ENTRIES.slice(3);

  const chartTracks = HOME_CHART_ENTRIES.map((entry) => ({
    id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
    title: entry.title,
    artist: entry.artist,
    artworkUrl: entry.artworkUrl,
    isPlayable: entry.isPlayable,
  }));

  const handlePlayChart = (idx: number) => {
    playTrack(chartTracks[idx], chartTracks);
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — full viewport, living graph feel */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex flex-col justify-end overflow-hidden">
        {/* Animated gradient background instead of static image */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f0a] via-[#141a10] to-[#0d1208]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(ellipse at 20% 80%, rgba(132,194,65,.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(132,194,65,.08) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            transform: `translateY(${scrollY * 0.3}px)`,
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20African%20music%20culture%20visual%20art%2C%20sound%20wave%20patterns%2C%20green%20and%20gold%20particles%20on%20dark%20background%2C%20cinematic%20artistic%20representation%20of%20rhythm%20and%20culture%2C%20digital%20art%2C%20no%20text%2C%20dramatic%20lighting%2C%20high%20contrast&width=1440&height=900&seq=hero-home-v2&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.35,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/60 to-transparent" />

        {/* Top bar — live indicator */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="wk-container-wide px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand)]/10 px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-[var(--wk-brand)] animate-pulse" />
                <span className="text-[11px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">Live graph</span>
              </div>
              <span className="hidden sm:inline text-[12px] text-[var(--wk-text-muted)]">4,200+ artists · 18,000+ tracks · 340+ editions</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <AnimatedEq />
              <span className="text-[11px] text-[var(--wk-text-faint)] font-mono">Now tracking</span>
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 wk-container-wide px-6 pb-16 pt-32">
          <div className="wk-eyebrow mb-6" style={{ color: "var(--wk-brand)" }}>
            The African music intelligence platform
          </div>
          <h1 className="max-w-[900px] font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(48px, 8vw, 120px)" }}>
            Where the music graph lives.
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed" style={{ color: "var(--wk-text-soft)" }}>
            Charts, artists, releases, labels, and editorial — rebuilt from the repaired cultural registry.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/charts">
              <WkButton variant="primary">
                <i className="ri-bar-chart-line" />
                View charts
              </WkButton>
            </Link>
            <Link to="/artists">
              <WkButton variant="ghost">
                Browse artists
              </WkButton>
            </Link>
          </div>

          {/* Stats strip — living numbers */}
          <div className="mt-14 flex flex-wrap gap-8 border-t border-[var(--wk-border)] pt-6">
            {[
              { label: "Artists indexed", value: "4,200+", delta: "+12 this week" },
              { label: "Tracks catalogued", value: "18,000+", delta: "+89 this week" },
              { label: "Chart editions", value: "340+", delta: "Week 132" },
              { label: "Releases", value: "6,800+", delta: "+34 this week" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[28px] font-black tracking-[-0.04em] text-[var(--wk-brand)]">{stat.value}</div>
                <div className="text-[12px] font-semibold text-[var(--wk-text)] mt-1">{stat.label}</div>
                <div className="text-[11px] text-[var(--wk-text-faint)] mt-0.5">{stat.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charts Section — asymmetric, data-dense */}
      <section className="py-20 md:py-28">
        <div className="wk-container-wide px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
              <h2 className="font-black text-[clamp(28px,3.5vw,42px)] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">
                Current rankings
              </h2>
            </div>
            <Link to="/charts" className="hidden md:block">
              <WkButton variant="ghost">All charts <i className="ri-arrow-right-line" /></WkButton>
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            {/* Left: Top 3 spotlight — cinematic, large */}
            <div className="space-y-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-lg bg-[var(--wk-surface-raised)]" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                          <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                        </div>
                      </div>
                    </div>
                  ))
                : top3.map((entry, idx) => (
                    <Link
                      key={entry.rank}
                      to={`/tracks/${entry.slug}`}
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-brand)]/40"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-brand)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                        <span className="font-black text-[28px] text-[var(--wk-brand)]">{entry.rank}</span>
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-[15px] font-bold text-[var(--wk-text)]">{entry.title}</h3>
                          {entry.movement === "new" && (
                            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase">New</span>
                          )}
                        </div>
                        <div className="truncate text-[13px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                          <span>{entry.weeksOnChart} weeks</span>
                          {entry.peakPosition === entry.rank && <span className="text-[var(--wk-brand)]">· Peak position</span>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePlayChart(idx);
                        }}
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
                        aria-label="Play"
                      >
                        <i className="ri-play-fill" />
                      </button>
                      <div className="relative flex items-center gap-1 text-[13px] font-bold">
                        {entry.movement === "up" && <i className="ri-arrow-up-line text-[var(--wk-success)]" />}
                        {entry.movement === "down" && <i className="ri-arrow-down-line text-[var(--wk-danger)]" />}
                        {entry.movement === "same" && <i className="ri-subtract-line text-[var(--wk-text-faint)]" />}
                        {entry.movementAmount && entry.movementAmount > 0 && (
                          <span style={{ color: entry.movement === "up" ? "var(--wk-success)" : entry.movement === "down" ? "var(--wk-danger)" : "var(--wk-text-faint)" }}>
                            {entry.movementAmount}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
            </div>

            {/* Right: Dense chart rows */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
              <div className="border-b border-[var(--wk-divider)] px-5 py-3 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Positions 4–{HOME_CHART_ENTRIES.length}</span>
                <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1"><i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up</span>
                  <span className="inline-flex items-center gap-1"><i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down</span>
                  <span className="inline-flex items-center gap-1"><i className="ri-subtract-line text-[var(--wk-text-faint)]" /> Same</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--wk-divider)]">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonChartRow key={i} />)
                  : restChart.map((entry, idx) => <ChartRow key={entry.rank} {...entry} onPlay={() => handlePlayChart(idx + 3)} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Tracks — horizontal shelf, like a music app */}
      <section className="py-16 md:py-20" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="wk-eyebrow mb-2">Discovery</div>
              <h2 className="font-black text-[clamp(24px,3vw,36px)] leading-[1.02] tracking-[-0.038em] text-[var(--wk-text)]">Trending tracks</h2>
            </div>
            <Link to="/charts" className="hidden md:block">
              <WkButton variant="ghost">View charts <i className="ri-arrow-right-line" /></WkButton>
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-none w-[260px] animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                    <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)] mb-2" />
                    <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] mb-1" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ))
              : HOME_TRENDING_TRACKS.map((track) => (
                  <Link
                    key={track.slug}
                    to={`/tracks/${track.slug}`}
                    className="group flex-none w-[260px] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                        <i className="ri-fire-line text-xs" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Trending</span>
                    </div>
                    <h3 className="text-[15px] font-bold text-[var(--wk-text)]">{track.title}</h3>
                    <div className="text-[13px] text-[var(--wk-text-muted)]">{track.artist}</div>
                    <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
                      <span className="inline-flex items-center gap-1"><i className="ri-headphone-line" /> {track.streamCount}</span>
                      <span className="inline-flex items-center gap-1"><i className="ri-bar-chart-line" /> #{track.chartPosition}</span>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Artists — asymmetric grid, cultural figures */}
      <section className="py-20 md:py-28">
        <div className="wk-container-wide px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="wk-eyebrow mb-3">Registry</div>
              <h2 className="font-black text-[clamp(28px,3.5vw,42px)] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">Featured artists</h2>
            </div>
            <Link to="/artists" className="hidden md:block">
              <WkButton variant="ghost">Artist directory <i className="ri-arrow-right-line" /></WkButton>
            </Link>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : HOME_FEATURED_ARTISTS.map((artist, idx) => (
                  <div key={artist.slug} className={idx === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""}>
                    <ArtistCard {...artist} />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* Recent Releases — horizontal shelf, album art focus */}
      <section className="py-16 md:py-20" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="wk-eyebrow mb-2">Fresh from the graph</div>
              <h2 className="font-black text-[clamp(24px,3vw,36px)] leading-[1.02] tracking-[-0.038em] text-[var(--wk-text)]">Recent releases</h2>
            </div>
            <Link to="/releases" className="hidden md:block">
              <WkButton variant="ghost">All releases <i className="ri-arrow-right-line" /></WkButton>
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex-none w-[200px] animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                    <div className="aspect-square rounded-lg bg-[var(--wk-surface-raised)] mb-3" />
                    <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] mb-1" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ))
              : HOME_RECENT_RELEASES.map((release) => (
                  <Link
                    key={release.slug}
                    to={`/releases/${release.slug}`}
                    className="group flex-none w-[200px] block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                      {release.artworkUrl ? (
                        <img
                          src={release.artworkUrl}
                          alt={release.title}
                          className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-album-line text-4xl text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="truncate text-[13px] font-bold text-[var(--wk-text)]">{release.title}</h3>
                      <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{release.artist}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <WkTag>{release.releaseType}</WkTag>
                        <span className="text-[11px] text-[var(--wk-text-faint)]">{release.year}</span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Genres — visual territory cards, image-led */}
      <section className="py-20 md:py-28">
        <div className="wk-container-wide px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="wk-eyebrow mb-3">Discovery</div>
              <h2 className="font-black text-[clamp(28px,3.5vw,42px)] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">Browse by genre</h2>
            </div>
            <Link to="/genres" className="hidden md:block">
              <WkButton variant="ghost">All genres <i className="ri-arrow-right-line" /></WkButton>
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                    <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)] mb-1" />
                    <div className="h-5 w-32 rounded bg-[var(--wk-surface-raised)] mb-2" />
                    <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ))
              : HOME_GENRE_VERTICALS.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/genres/${g.slug}`}
                    className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div
                      className="absolute right-0 top-0 h-32 w-32 rounded-bl-full opacity-[0.08] transition-opacity group-hover:opacity-[0.14]"
                      style={{ background: `var(${g.accentVar})` }}
                    />
                    <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: `var(${g.accentVar})` }}>
                      Genre
                    </div>
                    <h3 className="text-[18px] font-black tracking-tight text-[var(--wk-text)]">{g.name}</h3>
                    <div className="mt-3 flex items-center gap-4 text-[13px] text-[var(--wk-text-muted)]">
                      <span className="inline-flex items-center gap-1"><i className="ri-user-line" /> {g.artistCount}</span>
                      <span className="inline-flex items-center gap-1"><i className="ri-music-2-line" /> {g.trackCount}</span>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Magazine — editorial, asymmetric, dense */}
      <section className="py-16 md:py-20" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <div className="wk-eyebrow mb-3">WAKILISHA magazine</div>
              <h2 className="font-black text-[clamp(28px,3.5vw,42px)] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">Editorial</h2>
            </div>
            <Link to="/magazine" className="hidden md:block">
              <WkButton variant="ghost">Open magazine <i className="ri-arrow-right-line" /></WkButton>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="lg:row-span-2">
              {loading ? <SkeletonStoryCard /> : <StoryCard {...HOME_EDITORIAL_STORIES[0]} isFeatured />}
            </div>
            <div className="flex flex-col gap-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonStoryCard key={i} />)
                : HOME_EDITORIAL_STORIES.slice(1, 4).map((story) => <StoryCard key={story.slug} {...story} />)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}