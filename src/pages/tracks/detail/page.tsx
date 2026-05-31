import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkButton } from "@/components/design-system/primitives/Button";
import { TRACK_DETAILS, getTrackBySlug, getRelatedTracks } from "@/mocks/trackDetails";
import LyricsModal from "./components/LyricsModal";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MovementBadge({ movement, amount }: { movement?: string; amount?: number }) {
  if (movement === "new") {
    return (
      <span className="rounded bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">
        New
      </span>
    );
  }
  if (movement === "up") {
    return (
      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-brand)]">
        <i className="ri-arrow-up-line" /> {amount}
      </span>
    );
  }
  if (movement === "down") {
    return (
      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-danger)]">
        <i className="ri-arrow-down-line" /> {amount}
      </span>
    );
  }
  return <span className="text-[12px] text-[var(--wk-text-faint)]">—</span>;
}

function ChartSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 280;
  const h = 80;
  const padX = 4;
  const padY = 8;
  const step = (w - padX * 2) / (data.length - 1);

  const points = data.map((val, i) => {
    const x = padX + i * step;
    const y = h - padY - ((val - min) / range) * (h - padY * 2);
    return `${x},${y}`;
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p}`)
    .join(" ");

  const areaPath = `${path} L ${points[points.length - 1].split(",")[0]},${h} L ${points[0].split(",")[0]},${h} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[80px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wk-brand)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--wk-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkFill)" />
        <path d={path} fill="none" stroke="var(--wk-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const [x, y] = p.split(",");
          const isFirst = i === 0;
          const isLast = i === points.length - 1;
          const isPeak = data[i] === Math.min(...data);
          if (!isFirst && !isLast && !isPeak) return null;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isPeak ? 4 : 3}
              fill="var(--wk-surface)"
              stroke="var(--wk-brand)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-[var(--wk-text-faint)] mt-1">
        <span>Week {data.length} ago</span>
        <span>Current</span>
      </div>
    </div>
  );
}

function StreamingBadge({ platform }: { platform: string }) {
  const iconMap: Record<string, string> = {
    Spotify: "ri-spotify-fill",
    "Apple Music": "ri-apple-fill",
    YouTube: "ri-youtube-fill",
    Tidal: "ri-sound-module-fill",
    Deezer: "ri-music-fill",
    Audiomack: "ri-headphone-fill",
    Boomplay: "ri-play-circle-fill",
  };
  const colorMap: Record<string, string> = {
    Spotify: "#1DB954",
    "Apple Music": "#FA243C",
    YouTube: "#FF0000",
    Tidal: "#000000",
    Deezer: "#EF5466",
    Audiomack: "#FF8A00",
    Boomplay: "#E91E63",
  };
  return (
    <a
      href="#"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] hover:border-[var(--wk-border-2)]"
      onClick={(e) => e.preventDefault()}
    >
      <i className={iconMap[platform] || "ri-music-fill"} style={{ color: colorMap[platform] || "var(--wk-brand)" }} />
      {platform}
    </a>
  );
}

export default function TrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const track = getTrackBySlug(slug || "");
  const related = track?.artistSlug ? getRelatedTracks(track.artistSlug, track.slug) : [];

  if (!track) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-music-2-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Track not found</h1>
        <p className="text-[var(--wk-text-muted)]">This track does not exist in the charts.</p>
        <Link to="/charts" className="mt-6 inline-block">
          <WkButton variant="primary">Back to charts</WkButton>
        </Link>
      </div>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) {
      togglePlay();
      return;
    }
    playTrack(
      {
        id: track.slug,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        isPlayable: track.isPlayable,
        source: track.source,
        duration: track.duration,
      },
      TRACK_DETAILS
        .filter((t) => t.isPlayable)
        .map((t) => ({
          id: t.slug,
          title: t.title,
          artist: t.artist,
          artworkUrl: t.artworkUrl,
          isPlayable: t.isPlayable,
          source: t.source,
          duration: t.duration,
        }))
    );
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allTracks = TRACK_DETAILS.filter((t) => t.isPlayable).map((t) => ({
    id: t.slug,
    title: t.title,
    artist: t.artist,
    artworkUrl: t.artworkUrl,
    isPlayable: t.isPlayable,
    source: t.source,
    duration: t.duration,
  }));

  const handlePlayRelated = (relatedTrack: typeof track) => {
    if (!relatedTrack.isPlayable) return;
    playTrack(
      {
        id: relatedTrack.slug,
        title: relatedTrack.title,
        artist: relatedTrack.artist,
        artworkUrl: relatedTrack.artworkUrl,
        isPlayable: relatedTrack.isPlayable,
        source: relatedTrack.source,
        duration: relatedTrack.duration,
      },
      allTracks
    );
  };

  return (
    <>
      {/* Hero — split layout with artwork prominent */}
      <section className="relative overflow-hidden" style={{ background: "var(--wk-bg)" }}>
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${track.artworkUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(80px) saturate(1.5)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/80 to-[var(--wk-bg)]" />
        </div>

        <div className="relative wk-container px-6 py-12 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[380px_1fr] items-start">
            {/* Artwork */}
            <div className="mx-auto lg:mx-0 w-full max-w-[380px]">
              <div className="relative aspect-square rounded-2xl overflow-hidden shadow-xl">
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="h-full w-full object-cover object-top"
                />
                <div className="absolute top-4 left-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-black text-[22px] shadow-lg">
                    #{track.rank}
                  </div>
                </div>
                {track.movement === "new" && (
                  <div className="absolute top-4 right-4">
                    <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                      New Entry
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col justify-center min-h-0">
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <Link to="/charts">
                  <span className="text-[11px] font-bold text-[var(--wk-brand)] uppercase tracking-wider hover:underline">
                    Charts
                  </span>
                </Link>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <WkTag variant="brand">Week {track.weeksOnChart}</WkTag>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span className="text-[12px] text-[var(--wk-text-muted)]">{track.genre}</span>
              </div>

              <h1 className="font-black text-[clamp(32px,4vw,56px)] leading-[1.02] tracking-[-0.04em] text-[var(--wk-text)] mb-3">
                {track.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-[16px] text-[var(--wk-text-muted)] mb-6">
                {track.artistSlug ? (
                  <Link to={`/artists/${track.artistSlug}`} className="font-semibold text-[var(--wk-text)] hover:underline">
                    {track.artist}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--wk-text)]">{track.artist}</span>
                )}
                <span>·</span>
                <span>{track.label}</span>
                {track.releaseYear && (
                  <>
                    <span>·</span>
                    <span>{track.releaseYear}</span>
                  </>
                )}
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-5 mb-8 text-[13px] text-[var(--wk-text-muted)]">
                {track.streamCount && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-headphone-line text-[var(--wk-brand)]" />
                    <span className="font-bold text-[var(--wk-text)]">{track.streamCount}</span>
                    <span>streams</span>
                  </span>
                )}
                {track.duration && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-time-line text-[var(--wk-text-faint)]" />
                    {formatDuration(track.duration)}
                  </span>
                )}
                {track.peakPosition && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-trophy-line text-[var(--wk-brand)]" />
                    Peak <span className="font-bold text-[var(--wk-text)]">#{track.peakPosition}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-bar-chart-line text-[var(--wk-text-faint)]" />
                  <MovementBadge movement={track.movement} amount={track.movementAmount} />
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <WkButton
                  variant="primary"
                  size="lg"
                  onClick={handlePlay}
                  disabled={!track.isPlayable}
                  className="!w-auto"
                >
                  <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"} text-lg`} />
                  {isTrackPlaying ? "Pause" : track.isPlayable ? "Play" : "Preview only"}
                </WkButton>

                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] hover:border-[var(--wk-border-2)]"
                >
                  <i className={`${copied ? "ri-check-line text-[var(--wk-success)]" : "ri-share-line"}`} />
                  {copied ? "Copied" : "Share"}
                </button>
              </div>

              {/* Streaming badges */}
              {track.streamingLinks && track.streamingLinks.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mr-2">
                    Listen on
                  </span>
                  {track.streamingLinks.map((link) => (
                    <StreamingBadge key={link.platform} platform={link.platform} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="wk-container px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {/* Chart Journey */}
            {track.chartHistory && track.chartHistory.length > 1 && (
              <div>
                <h2 className="mb-1 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Chart Journey
                </h2>
                <p className="text-[12px] text-[var(--wk-text-faint)] mb-4">
                  Position history over {track.chartHistory.length} weeks on the chart
                </p>
                <WkSurface className="p-5">
                  <div className="flex items-end justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-[10px] text-[var(--wk-text-faint)] uppercase tracking-wider">Current</div>
                        <div className="text-[28px] font-black text-[var(--wk-brand)]">#{track.rank}</div>
                      </div>
                      <div className="h-10 w-px bg-[var(--wk-divider)]" />
                      <div>
                        <div className="text-[10px] text-[var(--wk-text-faint)] uppercase tracking-wider">Peak</div>
                        <div className="text-[20px] font-black text-[var(--wk-text)]">#{track.peakPosition}</div>
                      </div>
                      <div className="h-10 w-px bg-[var(--wk-divider)]" />
                      <div>
                        <div className="text-[10px] text-[var(--wk-text-faint)] uppercase tracking-wider">Weeks</div>
                        <div className="text-[20px] font-black text-[var(--wk-text)]">{track.weeksOnChart}</div>
                      </div>
                    </div>
                    {track.previousWeek && track.previousWeek > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] text-[var(--wk-text-faint)] uppercase tracking-wider">Previous</div>
                        <div className="text-[14px] font-bold text-[var(--wk-text)]">#{track.previousWeek}</div>
                      </div>
                    )}
                  </div>
                  <ChartSparkline data={track.chartHistory} />
                </WkSurface>
              </div>
            )}

            {/* Lyrics Section */}
            {track.lyrics ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                      Lyrics
                    </h2>
                    {track.lyricsContributor && (
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--wk-text-muted)]">
                        <i className="ri-user-star-line text-[var(--wk-brand)]" />
                        <span>
                          Contributed by{" "}
                          <span className="font-bold text-[var(--wk-text)]">
                            {track.lyricsContributor.name}
                          </span>
                          {track.lyricsContributor.source && (
                            <span className="text-[var(--wk-text-faint)]">
                              {" "}
                              · {track.lyricsContributor.source}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowLyricsModal(true)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)] hover:underline transition-colors"
                  >
                    <i className="ri-edit-line" />
                    Suggest correction
                  </button>
                </div>
                <WkSurface className="p-6 md:p-8">
                  <div className="text-[14px] leading-[2] text-[var(--wk-text)] whitespace-pre-line">
                    {track.lyrics}
                  </div>
                </WkSurface>
              </div>
            ) : (
              <div>
                <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Lyrics
                </h2>
                <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 md:p-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                    <i className="ri-article-line text-3xl text-[var(--wk-text-faint)]" />
                  </div>
                  <h3 className="mb-2 text-[18px] font-bold text-[var(--wk-text)]">
                    No lyrics yet
                  </h3>
                  <p className="mx-auto mb-6 max-w-[380px] text-[14px] text-[var(--wk-text-muted)] leading-relaxed">
                    We do not have lyrics for this track yet. Be the first to add them and get credited as the contributor.
                  </p>
                  <button
                    onClick={() => setShowLyricsModal(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90"
                  >
                    <i className="ri-add-line" />
                    Add lyrics
                  </button>
                  <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-[var(--wk-text-faint)]">
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-user-star-line" /> You get credit
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-time-line" /> Reviewed in 24h
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Chart Performance Table */}
            <div>
              <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                Chart Performance
              </h2>
              <WkSurface className="overflow-hidden">
                <div className="divide-y divide-[var(--wk-divider)]">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Current position</span>
                    <span className="text-[18px] font-black text-[var(--wk-brand)]">#{track.rank}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Peak position</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">#{track.peakPosition}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Weeks on chart</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.weeksOnChart}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Movement</span>
                    <MovementBadge movement={track.movement} amount={track.movementAmount} />
                  </div>
                  {track.previousWeek && track.previousWeek > 0 && (
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-[13px] text-[var(--wk-text-soft)]">Previous week</span>
                      <span className="text-[14px] font-bold text-[var(--wk-text)]">#{track.previousWeek}</span>
                    </div>
                  )}
                  {track.duration && (
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-[13px] text-[var(--wk-text-soft)]">Duration</span>
                      <span className="text-[14px] font-bold text-[var(--wk-text)]">{formatDuration(track.duration)}</span>
                    </div>
                  )}
                  {track.streamCount && (
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-[13px] text-[var(--wk-text-soft)]">Verified streams</span>
                      <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.streamCount}</span>
                    </div>
                  )}
                </div>
              </WkSurface>
            </div>

            {/* More from this artist */}
            {related.length > 0 && (
              <div>
                <h2 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  More from {track.artist.split(" ft.")[0].split(" ft ")[0]}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {related.map((rel) => (
                    <div
                      key={rel.slug}
                      className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
                    >
                      <Link to={`/tracks/${rel.slug}`} className="block">
                        <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                          <img
                            src={rel.artworkUrl}
                            alt={rel.title}
                            className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                          />
                          <div className="absolute top-3 left-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-black">
                              #{rel.rank}
                            </div>
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="text-[13px] font-bold text-[var(--wk-text)] truncate">{rel.title}</h3>
                          <div className="text-[12px] text-[var(--wk-text-muted)] truncate">{rel.artist}</div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-[var(--wk-text-faint)]">{rel.weeksOnChart} wks</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePlayRelated(rel);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
                              aria-label="Play"
                            >
                              <i className="ri-play-fill text-xs" />
                            </button>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Track Info */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <h3 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                Track Info
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Genre</span>
                  <Link to={`/genres`}>
                    <span className="text-[14px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">{track.genre}</span>
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Label</span>
                  <Link to={`/labels`}>
                    <span className="text-[14px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">{track.label}</span>
                  </Link>
                </div>
                {track.releaseYear && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Released</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.releaseYear}</span>
                  </div>
                )}
                {track.albumTitle && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Album</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.albumTitle}</span>
                  </div>
                )}
                {track.duration && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Duration</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{formatDuration(track.duration)}</span>
                  </div>
                )}
                {track.streamCount && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Streams</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.streamCount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Playable</span>
                  <span className={`text-[14px] font-bold ${track.isPlayable ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>
                    {track.isPlayable ? "Full track" : "Preview only"}
                  </span>
                </div>
                {track.source && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--wk-text-soft)]">Source</span>
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.source}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Credits */}
            {track.credits && track.credits.length > 0 && (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                <h3 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Credits
                </h3>
                <div className="space-y-3">
                  {track.credits.map((credit, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--wk-text-faint)]">{credit.role}</span>
                      <span className="text-[13px] font-bold text-[var(--wk-text)]">{credit.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artist */}
            {track.artistSlug && (
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Artist
                </h3>
                <Link
                  to={`/artists/${track.artistSlug}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--wk-surface-raised)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] overflow-hidden">
                    {track.artistImage ? (
                      <img src={track.artistImage} alt={track.artist} className="h-full w-full object-cover object-top" />
                    ) : (
                      <i className="ri-user-line text-[var(--wk-text-muted)] text-xl" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-[var(--wk-text)] truncate">{track.artist.split(" ft.")[0].split(" ft ")[0]}</div>
                    <div className="text-[12px] text-[var(--wk-text-muted)]">View artist page</div>
                  </div>
                  <i className="ri-arrow-right-s-line ml-auto text-[var(--wk-text-faint)] text-lg" />
                </Link>
                {related.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--wk-divider)]">
                    <div className="text-[11px] text-[var(--wk-text-faint)] mb-2">
                      {related.length} more track{related.length > 1 ? "s" : ""} on the chart
                    </div>
                    <div className="flex gap-2">
                      {related.slice(0, 3).map((rel) => (
                        <Link
                          key={rel.slug}
                          to={`/tracks/${rel.slug}`}
                          className="h-10 w-10 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] flex-shrink-0"
                        >
                          <img src={rel.artworkUrl} alt={rel.title} className="h-full w-full object-cover object-top" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Lyrics Modal */}
      <LyricsModal
        isOpen={showLyricsModal}
        onClose={() => setShowLyricsModal(false)}
        trackTitle={track.title}
        artistName={track.artist}
        existingLyrics={track.lyrics}
        existingContributors={track.lyricsContributor ? [track.lyricsContributor] : undefined}
      />
    </>
  );
}