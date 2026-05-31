import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { TRACK_DETAILS, getTrackBySlug, getRelatedTracks } from "@/mocks/trackDetails";

const TABS = ["Overview", "Chart stats", "Lyrics", "Credits"] as const;
type Tab = typeof TABS[number];

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

function ChartSparklineMobile({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300;
  const h = 64;
  const padX = 4;
  const padY = 6;
  const step = (w - padX * 2) / (data.length - 1);
  const points = data.map((val, i) => {
    const x = padX + i * step;
    const y = h - padY - ((val - min) / range) * (h - padY * 2);
    return `${x},${y}`;
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].split(",")[0]},${h} L ${points[0].split(",")[0]},${h} Z`;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[64px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFillMob" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wk-brand)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--wk-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkFillMob)" />
        <path d={path} fill="none" stroke="var(--wk-brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex items-center justify-between text-[9px] text-[var(--wk-text-faint)] mt-1">
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
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wk-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--wk-text)]">
      <i className={iconMap[platform] || "ri-music-fill"} style={{ color: colorMap[platform] || "var(--wk-brand)" }} />
      {platform}
    </span>
  );
}

export default function MobileTrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);

  const track = getTrackBySlug(slug || "");
  const related = track?.artistSlug ? getRelatedTracks(track.artistSlug, track.slug) : [];

  if (!track) {
    return (
      <div className="px-5 py-20 text-center">
        <i className="ri-music-2-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
        <p className="text-[var(--wk-text-muted)]">Track not found</p>
        <Link to="/charts" className="mt-4 inline-block text-[var(--wk-brand)] font-bold text-[14px]">
          Back to charts
        </Link>
      </div>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) { togglePlay(); return; }
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source, duration: track.duration },
      TRACK_DETAILS.filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: t.source, duration: t.duration }))
    );
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Track Hero */}
      <section className="relative min-h-[300px] flex items-end overflow-hidden">
        {track.artworkUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${track.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />
          </>
        )}
        <div className="relative w-full px-5 pb-6 pt-16">
          <div className="mb-2 flex items-center gap-2">
            <Link to="/charts" className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              Charts
            </Link>
            <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
              #{track.rank}
            </span>
            {track.movement === "new" && (
              <span className="rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand-on)] uppercase">
                New Entry
              </span>
            )}
          </div>
          <h1
            className="font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(28px, 9vw, 44px)" }}
          >
            {track.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--wk-text-muted)]">
            {track.artistSlug ? (
              <Link to={`/artists/${track.artistSlug}`} className="font-semibold text-[var(--wk-text-soft)]">
                {track.artist}
              </Link>
            ) : (
              <span className="font-semibold text-[var(--wk-text-soft)]">{track.artist}</span>
            )}
            <span>·</span>
            <span>{track.genre}</span>
            <span>·</span>
            <span>{track.label}</span>
          </div>
          {/* Stream + duration row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--wk-text-muted)]">
            {track.streamCount && (
              <span className="inline-flex items-center gap-1">
                <i className="ri-headphone-line text-[var(--wk-brand)]" />
                {track.streamCount}
              </span>
            )}
            {track.duration && (
              <span className="inline-flex items-center gap-1">
                <i className="ri-time-line" />
                {formatDuration(track.duration)}
              </span>
            )}
            {track.peakPosition && (
              <span className="inline-flex items-center gap-1">
                <i className="ri-trophy-line text-[var(--wk-brand)]" />
                Peak #{track.peakPosition}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="px-5 py-4 flex gap-3">
        <button
          onClick={handlePlay}
          disabled={!track.isPlayable}
          className="flex-1 h-12 rounded-xl bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
        >
          <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
          {isTrackPlaying ? "Pause" : track.isPlayable ? "Play" : "Preview"}
        </button>
        <button
          onClick={handleShare}
          className="flex-1 h-12 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          <i className={`${copied ? "ri-check-line text-[var(--wk-success)]" : "ri-share-line"}`} />
          {copied ? "Copied" : "Share"}
        </button>
      </div>

      {/* Streaming badges — same as desktop */}
      {track.streamingLinks && track.streamingLinks.length > 0 && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] w-full mb-1">
            Listen on
          </span>
          {track.streamingLinks.map((link) => (
            <StreamingBadge key={link.platform} platform={link.platform} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--wk-divider)] px-4 gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 pr-4 text-[12px] font-bold transition-all whitespace-nowrap active:scale-[0.97] ${
              activeTab === tab
                ? "text-[var(--wk-brand)] border-b-[1.5px] border-[var(--wk-brand)]"
                : "text-[var(--wk-text-faint)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-4">
        {/* Overview */}
        {activeTab === "Overview" && (
          <div>
            <div className="grid grid-cols-4 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
              {[
                { label: "Rank", value: `#${track.rank}` },
                { label: "Peak", value: `#${track.peakPosition}` },
                { label: "Weeks", value: track.weeksOnChart },
                { label: "Year", value: track.releaseYear || "—" },
              ].map((stat) => (
                <div key={stat.label} className="bg-[var(--wk-surface)] px-2 py-3 text-center">
                  <div className="text-[16px] font-black text-[var(--wk-brand)]">{stat.value}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Genre</span>
                <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.genre}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Label</span>
                <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.label}</span>
              </div>
              {track.albumTitle && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Album</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.albumTitle}</span>
                </div>
              )}
              {track.releaseYear && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Released</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.releaseYear}</span>
                </div>
              )}
              {track.source && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Source</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.source}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Playable</span>
                <span className={`text-[14px] font-bold ${track.isPlayable ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>
                  {track.isPlayable ? "Full track" : "Preview only"}
                </span>
              </div>
            </div>

            {/* More from this artist */}
            {related.length > 0 && (
              <div className="px-5 py-5">
                <div className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  More from {track.artist.split(" ft.")[0].split(" ft ")[0]}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {related.map((rel) => (
                    <Link
                      key={rel.slug}
                      to={`/tracks/${rel.slug}`}
                      className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden active:scale-[0.98] active:opacity-80 transition-all"
                    >
                      <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                        <img
                          src={rel.artworkUrl}
                          alt={rel.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-[10px] font-black">
                          #{rel.rank}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{rel.title}</div>
                        <div className="text-[10px] text-[var(--wk-text-muted)] truncate">{rel.artist}</div>
                        <div className="mt-1 text-[9px] text-[var(--wk-text-faint)]">{rel.weeksOnChart} wks on chart</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chart stats tab */}
        {activeTab === "Chart stats" && (
          <div>
            {/* Sparkline */}
            {track.chartHistory && track.chartHistory.length > 1 && (
              <div className="px-5 py-5 border-b border-[var(--wk-divider)]">
                <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">
                  Chart journey · {track.chartHistory.length} weeks
                </div>
                <div className="flex items-end gap-4 mb-3">
                  <div>
                    <div className="text-[9px] text-[var(--wk-text-faint)] uppercase tracking-wider">Current</div>
                    <div className="text-[24px] font-black text-[var(--wk-brand)]">#{track.rank}</div>
                  </div>
                  <div className="w-px h-8 bg-[var(--wk-divider)]" />
                  <div>
                    <div className="text-[9px] text-[var(--wk-text-faint)] uppercase tracking-wider">Peak</div>
                    <div className="text-[18px] font-black text-[var(--wk-text)]">#{track.peakPosition}</div>
                  </div>
                  <div className="w-px h-8 bg-[var(--wk-divider)]" />
                  <div>
                    <div className="text-[9px] text-[var(--wk-text-faint)] uppercase tracking-wider">Weeks</div>
                    <div className="text-[18px] font-black text-[var(--wk-text)]">{track.weeksOnChart}</div>
                  </div>
                </div>
                <ChartSparklineMobile data={track.chartHistory} />
              </div>
            )}
            <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Current position</span>
                <span className="text-[18px] font-black text-[var(--wk-brand)]">#{track.rank}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Peak position</span>
                <span className="text-[14px] font-bold text-[var(--wk-text)]">#{track.peakPosition}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Weeks on chart</span>
                <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.weeksOnChart}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Movement</span>
                <MovementBadge movement={track.movement} amount={track.movementAmount} />
              </div>
              {track.previousWeek && track.previousWeek > 0 && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Previous week</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">#{track.previousWeek}</span>
                </div>
              )}
              {track.duration && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Duration</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{formatDuration(track.duration)}</span>
                </div>
              )}
              {track.streamCount && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Verified streams</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.streamCount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lyrics tab — same as desktop */}
        {activeTab === "Lyrics" && (
          <div className="px-5 py-5">
            {track.lyrics ? (
              <>
                {track.lyricsContributor && (
                  <div className="mb-4 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2">
                    <i className="ri-user-star-line text-[var(--wk-brand)]" />
                    <span>
                      Contributed by{" "}
                      <span className="font-bold text-[var(--wk-text)]">{track.lyricsContributor.name}</span>
                      {track.lyricsContributor.source && (
                        <span className="text-[var(--wk-text-faint)]"> · {track.lyricsContributor.source}</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                  <p className="text-[15px] leading-[2] text-[var(--wk-text)]">
                    <span
                      className="float-left mr-2 mt-1 font-black leading-none text-[var(--wk-brand)]"
                      style={{ fontSize: "clamp(36px, 8vw, 48px)" }}
                    >
                      {track.lyrics.charAt(0)}
                    </span>
                    <span className="whitespace-pre-line">{track.lyrics.slice(1)}</span>
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                  <i className="ri-article-line text-3xl text-[var(--wk-text-faint)]" />
                </div>
                <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">No lyrics yet</h3>
                <p className="text-[13px] text-[var(--wk-text-muted)] max-w-[260px] mx-auto mb-4 leading-relaxed">
                  Be the first to add lyrics and get credited as the contributor.
                </p>
                <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-user-star-line" /> You get credit
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-time-line" /> Reviewed in 24h
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Credits tab — same as desktop */}
        {activeTab === "Credits" && (
          <div>
            {track.credits && track.credits.length > 0 ? (
              <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">
                {track.credits.map((credit, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-[12px] text-[var(--wk-text-faint)]">{credit.role}</span>
                    <span className="text-[13px] font-bold text-[var(--wk-text)]">{credit.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center text-[var(--wk-text-muted)]">
                <i className="ri-team-line mb-3 block text-3xl" />
                No credit information available.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Artist card — same as desktop */}
      {track.artistSlug && (
        <div className="px-5 py-5 border-t border-[var(--wk-border)]">
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Artist</h3>
          <Link
            to={`/artists/${track.artistSlug}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 active:scale-[0.98] active:opacity-80 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] overflow-hidden">
              {track.artistImage ? (
                <img src={track.artistImage} alt={track.artist} className="h-full w-full object-cover" />
              ) : (
                <i className="ri-user-line text-[var(--wk-text-muted)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{track.artist}</div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">View artist page</div>
            </div>
            <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
          </Link>
        </div>
      )}
    </div>
  );
}