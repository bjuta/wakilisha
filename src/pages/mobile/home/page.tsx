import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
import { HOME_CHART_ENTRIES, HOME_FEATURED_ARTISTS, HOME_EDITORIAL_STORIES, HOME_RECENT_RELEASES, HOME_TRENDING_TRACKS } from "@/mocks/home";

function AnimatedEq() {
  return (
    <div className="flex items-end gap-0.5 h-3">
      <div className="w-0.5 bg-[var(--wk-brand)] animate-pulse h-2" />
      <div className="w-0.5 bg-[var(--wk-brand)] animate-pulse h-3" style={{ animationDelay: "0.1s" }} />
      <div className="w-0.5 bg-[var(--wk-brand)] animate-pulse h-1.5" style={{ animationDelay: "0.2s" }} />
      <div className="w-0.5 bg-[var(--wk-brand)] animate-pulse h-2.5" style={{ animationDelay: "0.3s" }} />
    </div>
  );
}

export default function MobileHome() {
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

  const handlePlayTrending = (track: typeof HOME_TRENDING_TRACKS[0]) => {
    const playerTrack = {
      id: track.slug,
      title: track.title,
      artist: track.artist,
      isPlayable: false,
    };
    playTrack(playerTrack, [playerTrack]);
  };

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — full viewport, same as desktop */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--wk-bg)] via-[var(--wk-bg-subtle)] to-[var(--wk-bg)]" />
        <div
          className="absolute inset-0 opacity-30"
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

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand)]/10 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-[var(--wk-brand)] animate-pulse" />
            <span className="text-[10px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-2">
            <AnimatedEq />
            <span className="text-[10px] text-[var(--wk-text-faint)] font-mono">Tracking</span>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 px-5 pb-14 pt-24">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-4 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            The African music intelligence platform
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(36px, 12vw, 56px)" }}>
            Where the music graph lives.
          </h1>
          <p className="mt-5 max-w-[400px] text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
            Charts, artists, releases, labels, and editorial — rebuilt from the repaired cultural registry.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/charts" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap">
              <i className="ri-bar-chart-line" />
              View charts
            </Link>
            <Link to="/artists" className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap">
              Browse artists
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-[var(--wk-border)] pt-5">
            {[
              { label: "Artists", value: "4,200+" },
              { label: "Tracks", value: "18,000+" },
              { label: "Editions", value: "340+" },
              { label: "Releases", value: "6,800+" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[22px] font-black tracking-[-0.04em] text-[var(--wk-brand)]">{stat.value}</div>
                <div className="text-[11px] font-semibold text-[var(--wk-text)]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charts Section */}
      <section className="px-5 py-12">
        <div className="mb-6">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            WAKILISHA charts
          </div>
          <h2 className="font-black text-[28px] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">
            Current rankings
          </h2>
        </div>

        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-[var(--wk-surface-raised)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                      <div className="h-2 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                    </div>
                  </div>
                </div>
              ))
            : top3.map((entry, idx) => (
                <Link
                  key={entry.rank}
                  to="/charts"
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-brand)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <span className="font-black text-[24px] text-[var(--wk-brand)]">{entry.rank}</span>
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{entry.title}</h3>
                      {entry.movement === "new" && (
                        <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">New</span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                      <span>{entry.weeksOnChart} weeks</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePlayChart(idx);
                    }}
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
                    aria-label="Play"
                  >
                    <i className="ri-play-fill text-sm" />
                  </button>
                  <div className="relative flex items-center gap-1 text-[12px] font-bold">
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

        {/* Dense rows */}
        <div className="mt-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="border-b border-[var(--wk-divider)] px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Positions 4–{HOME_CHART_ENTRIES.length}</span>
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonChartRow key={i} />)
              : restChart.map((entry, idx) => <ChartRow key={entry.rank} {...entry} onPlay={() => handlePlayChart(idx + 3)} />)}
          </div>
        </div>
      </section>

      {/* Trending Tracks */}
      <section className="py-10" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="px-5 mb-6">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Discovery
          </div>
          <h2 className="font-black text-[24px] leading-[1.02] tracking-[-0.038em] text-[var(--wk-text)]">Trending tracks</h2>
        </div>

        <div className="mobile-scroll-row px-5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="hcard animate-pulse">
                  <div className="hcard-art bg-[var(--wk-surface-raised)]" />
                  <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)] mt-2" />
                </div>
              ))
            : HOME_TRENDING_TRACKS.map((track) => (
                <button
                  key={track.slug}
                  onClick={() => handlePlayTrending(track)}
                  className="hcard text-left"
                >
                  <div className="hcard-art relative">
                    <div className="flex h-full w-full items-center justify-center bg-[var(--wk-surface-raised)]">
                      <i className="ri-music-2-line text-2xl text-[var(--wk-text-faint)]" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                      <i className="ri-play-fill text-2xl text-white" />
                    </div>
                  </div>
                  <div className="hcard-title">{track.title}</div>
                  <div className="hcard-sub">{track.artist}</div>
                </button>
              ))}
        </div>
      </section>

      {/* Featured Artists */}
      <section className="px-5 py-12">
        <div className="mb-6">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Registry
          </div>
          <h2 className="font-black text-[28px] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">Featured artists</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
              ))
            : HOME_FEATURED_ARTISTS.slice(0, 4).map((artist) => (
                <Link
                  key={artist.slug}
                  to={`/artists/${artist.slug}`}
                  className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]"
                >
                  <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover" />
                  <div className="acard-overlay">
                    <div className="acard-name">{artist.name}</div>
                    <div className="acard-meta">{artist.genres?.[0]} · {artist.origin}</div>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Recent Releases */}
      <section className="py-10" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="px-5 mb-6">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Fresh from the graph
          </div>
          <h2 className="font-black text-[24px] leading-[1.02] tracking-[-0.038em] text-[var(--wk-text)]">Recent releases</h2>
        </div>

        <div className="mobile-scroll-row px-5">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mobile-card-sm animate-pulse">
                  <div className="mobile-card-sm-img bg-[var(--wk-surface-raised)]" />
                </div>
              ))
            : HOME_RECENT_RELEASES.map((release) => (
                <Link key={release.slug} to={`/releases/${release.slug}`} className="mobile-card-sm">
                  <div className="mobile-card-sm-img">
                    <img src={release.artworkUrl} alt={release.title} />
                  </div>
                  <div className="mobile-card-sm-body">
                    <div className="mobile-card-sm-title">{release.title}</div>
                    <div className="mobile-card-sm-sub">{release.artist}</div>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Editorial */}
      <section className="px-5 py-12">
        <div className="mb-6">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            WAKILISHA magazine
          </div>
          <h2 className="font-black text-[28px] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">Editorial</h2>
        </div>

        <div className="space-y-4">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                  <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)] mb-2" />
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              ))
            : HOME_EDITORIAL_STORIES.slice(0, 3).map((story, idx) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex gap-4 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
                >
                  <div className={`relative shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] ${idx === 0 ? "w-24 h-24" : "w-20 h-20"}`}>
                    <img src={story.heroUrl} alt={story.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">{story.section}</span>
                    <h3 className="mt-1 text-[14px] font-bold leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">{story.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                      <span className="font-semibold text-[var(--wk-text-soft)]">{story.author}</span>
                      <span>·</span>
                      <span>{story.readingTime} min</span>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </section>
    </div>
  );
}