import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import {
  HOME_CHART_ENTRIES,
  HOME_FEATURED_ARTISTS,
  HOME_EDITORIAL_STORIES,
  HOME_RECENT_RELEASES,
  HOME_TRENDING_TRACKS,
} from "@/mocks/home";

const trackPayload = (track: {
  slug?: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlayable?: boolean;
  source?: string;
}) => ({
  id: track.slug || `${track.title}-${track.artist}`.toLowerCase().replace(/\s+/g, "-"),
  title: track.title,
  artist: track.artist,
  artworkUrl: track.artworkUrl,
  isPlayable: track.isPlayable,
  source: track.source,
});

export default function MobileHome() {
  const { playTrack } = usePlayer();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const chartTracks = HOME_CHART_ENTRIES.map(trackPayload);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="wk-mobile-v5">
      {/* Hero — full-bleed, cinematic, minimal copy */}
      <section ref={heroRef} className="relative h-[100dvh] flex items-end overflow-hidden">
        {/* Background image — full bleed with parallax + zoom */}
        <div
          className="absolute inset-0 animate-hero-img"
          style={{
            transform: `translateY(${scrollY * 0.12}px) scale(${1 + scrollY * 0.0002})`,
          }}
        >
          <img
            src="https://readdy.ai/api/search-image?query=Dynamic%20cinematic%20close-up%20of%20a%20vinyl%20record%20spinning%20on%20a%20turntable%20with%20dramatic%20warm%20golden%20and%20green%20neon%20lighting%20streaks%2C%20dark%20moody%20African%20music%20studio%20atmosphere%2C%20professional%20editorial%20photography%2C%20abstract%20bokeh%20light%20particles%2C%20high%20contrast%20between%20vibrant%20colors%20and%20deep%20black%20background%2C%20premium%20music%20culture%20aesthetic%2C%20no%20text%2C%20sharp%20focus%2C%20ultra%20detailed&width=1600&height=900&seq=hero-home-cinematic-v2&orientation=landscape"
            alt="African music culture"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

        {/* Content — minimal, staggered entrance */}
        <div className="relative z-10 w-full px-6 pb-20">
          <div className="mb-4 flex items-center gap-3 animate-hero-fade" style={{ animationDelay: '0.3s' }}>
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)] animate-pulse" />
            <span className="text-[11px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">
              Week 132 — May 2026
            </span>
          </div>

          <h1
            className="font-black leading-[0.92] tracking-[-0.05em] text-white animate-hero-fade"
            style={{ fontSize: "clamp(32px, 10vw, 52px)" }}
          >
            The definitive voice in African music.
          </h1>

          <div className="mt-6 animate-hero-fade" style={{ animationDelay: '0.5s' }}>
            <Link
              to="/charts"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform"
            >
              <i className="ri-bar-chart-line" />
              View the chart
            </Link>
          </div>
        </div>
      </section>

      {/* Current #1 */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Current #1</div>
          <Link to="/charts" className="home-section-more">Charts</Link>
        </div>
        {HOME_CHART_ENTRIES[0] && (
          <Link
            to={`/tracks/${HOME_CHART_ENTRIES[0].slug}`}
            className="mx-5 mb-5 block overflow-hidden rounded-[16px] border border-[var(--wk-border)] bg-[var(--wk-surface)]"
          >
            <div className="chart-hero-card h-[132px]">
              <img src={HOME_CHART_ENTRIES[0].artworkUrl} alt="" />
              <div className="chart-hero-overlay">
                <div className="chart-hero-rank gold">1</div>
                <div className="min-w-0 flex-1">
                  <div className="chart-row-title">{HOME_CHART_ENTRIES[0].title}</div>
                  <div className="chart-row-sub">{HOME_CHART_ENTRIES[0].artist}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    playTrack(chartTracks[0], chartTracks);
                  }}
                  className="phn-mp-btn phn-mp-play"
                >
                  <i className="ri-play-fill" />
                </button>
              </div>
            </div>
          </Link>
        )}
      </section>

      {/* All chart entries — same 10 as desktop */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Top 10 chart</div>
          <Link to="/charts" className="home-section-more">View all</Link>
        </div>
        <div className="chart-row-list">
          {HOME_CHART_ENTRIES.map((entry, idx) => (
            <Link
              key={`${entry.rank}-${entry.slug}`}
              to={`/tracks/${entry.slug}`}
              className="chart-row"
            >
              <div className="chart-row-num">{entry.rank}</div>
              <div className="chart-row-art">
                <img src={entry.artworkUrl} alt="" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="chart-row-title">{entry.title}</div>
                <div className="chart-row-sub">{entry.artist}</div>
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold shrink-0">
                {entry.movement === "up" && <i className="ri-arrow-up-line text-[var(--wk-success)]" />}
                {entry.movement === "down" && <i className="ri-arrow-down-line text-[var(--wk-danger)]" />}
                {entry.movement === "same" && <i className="ri-subtract-line text-[var(--wk-text-faint)]" />}
                {entry.movement === "new" && <i className="ri-star-line text-[var(--wk-brand)]" />}
                {entry.movementAmount && entry.movementAmount > 0 && entry.movement !== "new" && (
                  <span
                    style={{
                      color: entry.movement === "up" ? "var(--wk-success)" : "var(--wk-danger)",
                    }}
                  >
                    {entry.movementAmount}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  playTrack(chartTracks[idx], chartTracks);
                }}
                className="chart-delta delta-new"
              >
                <i className="ri-play-fill" />
              </button>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending tracks */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Trending tracks</div>
          <Link to="/search" className="home-section-more">Search</Link>
        </div>
        <div className="home-shelf">
          {HOME_TRENDING_TRACKS.map((track) => (
            <button
              key={track.slug}
              onClick={() => playTrack(trackPayload(track), [trackPayload(track)])}
              className="hcard"
            >
              <div className="hcard-art">
                {track.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <i className="ri-music-2-line text-2xl text-[var(--wk-text-faint)]" />
                  </div>
                )}
              </div>
              <div className="hcard-title">{track.title}</div>
              <div className="hcard-sub">{track.artist}</div>
              <div className="mt-1 flex items-center gap-2 text-[9px] text-[var(--wk-text-faint)] px-2">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-headphone-line" /> {track.streamCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-bar-chart-line" /> #{track.chartPosition}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* New releases */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Recent releases</div>
          <Link to="/releases" className="home-section-more">Releases</Link>
        </div>
        <div className="home-shelf">
          {HOME_RECENT_RELEASES.map((release) => (
            <Link key={release.slug} to={`/releases/${release.slug}`} className="hcard">
              <div className="hcard-art">
                <img src={release.artworkUrl} alt="" />
              </div>
              <div className="hcard-title">{release.title}</div>
              <div className="hcard-sub">{release.artist}</div>
              <div className="mt-1 flex items-center gap-1.5 px-2">
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                  {release.releaseType}
                </span>
                <span className="text-[9px] text-[var(--wk-text-faint)]">{release.year}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* All 6 featured artists — same as desktop */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">Featured artists</div>
          <Link to="/artists" className="home-section-more">Artists</Link>
        </div>
        <div className="artist-grid-2col pt-0">
          {HOME_FEATURED_ARTISTS.map((artist) => (
            <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard">
              <img src={artist.imageUrl} alt="" />
              <div className="acard-overlay">
                <div className="acard-name">{artist.name}</div>
                <div className="acard-meta">
                  {artist.genres?.[0]} ·{" "}
                  {artist.isChartArtist ? "Chart artist" : "Registry"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* All 5 editorial stories — same as desktop */}
      <section className="home-section">
        <div className="home-section-header">
          <div className="home-section-title">WAKILISHA magazine</div>
          <Link to="/magazine" className="home-section-more">Read</Link>
        </div>
        <div className="mag-cards pt-0">
          {HOME_EDITORIAL_STORIES.map((story) => (
            <Link key={story.slug} to={`/magazine/${story.slug}`} className="mag-card">
              <div className="mag-card-art">
                <img src={story.heroUrl} alt="" />
              </div>
              <div>
                <div className="mag-card-tag">{story.section}</div>
                <div className="mag-card-title">{story.title}</div>
                <div className="mag-card-meta">
                  {story.readingTime} min read · {story.date}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Newsletter — same as desktop */}
      <section className="home-section pb-8">
        <div className="mx-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
          <div className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
            <span className="w-4 h-px bg-[var(--wk-brand)]" />
            WAKILISHA Weekly
          </div>
          <h2 className="text-[18px] font-black tracking-[-0.04em] text-[var(--wk-text)] mb-1">
            The chart, in your inbox.
          </h2>
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] mb-4">
            Weekly chart updates, artist spotlights, and breaking stories from the African music ecosystem.
          </p>
          {subscribed ? (
            <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--wk-brand)]">
              <i className="ri-check-line" /> Subscribed! Check your inbox.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]"
              />
              <button
                onClick={() => {
                  if (email.trim()) setSubscribed(true);
                }}
                className="w-full rounded-xl bg-[var(--wk-brand)] py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform"
              >
                <i className="ri-mail-send-line mr-1" />
                Subscribe
              </button>
              <div className="flex items-center gap-4 text-[10px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-shield-check-line" /> No spam
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-close-circle-line" /> Unsubscribe anytime
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}