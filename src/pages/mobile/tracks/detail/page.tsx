import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { TRACK_DETAILS } from "@/mocks/trackDetails";

const TABS = ["Overview", "Chart stats"];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MovementBadge({ movement, amount }: { movement?: string; amount?: number }) {
  if (movement === "new") {
    return <span className="rounded bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">New</span>;
  }
  if (movement === "up") {
    return <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-brand)]"><i className="ri-arrow-up-line" /> {amount}</span>;
  }
  if (movement === "down") {
    return <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-danger)]"><i className="ri-arrow-down-line" /> {amount}</span>;
  }
  return <span className="text-[12px] text-[var(--wk-text-faint)]">—</span>;
}

export default function MobileTrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [activeTab, setActiveTab] = useState("Overview");
  const track = TRACK_DETAILS.find((t) => t.slug === slug);

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

  return (
    <div className="min-h-screen">
      {/* Track Hero */}
      <section className="relative min-h-[300px] flex items-end overflow-hidden">
        {track.artworkUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${track.artworkUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />
          </>
        )}
        <div className="relative w-full px-5 pb-6 pt-16">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              Charts
            </div>
            <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">#{track.rank}</span>
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]" style={{ fontSize: "clamp(32px, 10vw, 48px)" }}>
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
        </div>
      </section>

      {/* Actions */}
      <div className="px-5 py-4 flex gap-3">
        <button
          onClick={handlePlay}
          disabled={!track.isPlayable}
          className="flex-1 h-12 rounded-xl bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i className={`${isTrackPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
          {isTrackPlaying ? "Pause" : track.isPlayable ? "Play" : "Preview"}
        </button>
        <Link
          to={`/artists/${track.artistSlug || ""}`}
          className="flex-1 h-12 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] font-bold text-[14px] flex items-center justify-center gap-2"
        >
          <i className="ri-user-line" />
          Artist
        </Link>
      </div>

      {/* Source + Duration */}
      <div className="px-5 pb-4 flex items-center gap-4 text-[12px] text-[var(--wk-text-muted)]">
        {track.source && <span>Source: {track.source}</span>}
        {track.duration && <span>{formatDuration(track.duration)}</span>}
        {track.streamCount && <span>{track.streamCount} streams</span>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--wk-divider)] px-5 gap-0 overflow-hidden">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 pr-5 text-[13px] font-bold transition-all whitespace-nowrap ${
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
        {activeTab === "Overview" && (
          <div>
            {/* Track info */}
            <div className="grid grid-cols-4 gap-px border-y border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
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

            {/* Details list */}
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
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-[var(--wk-text-soft)]">Playable</span>
                <span className={`text-[14px] font-bold ${track.isPlayable ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>
                  {track.isPlayable ? "Yes" : "Preview only"}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Chart stats" && (
          <div>
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
                  <span className="text-[13px] text-[var(--wk-text-soft)]">Streams</span>
                  <span className="text-[14px] font-bold text-[var(--wk-text)]">{track.streamCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Artist link */}
      {track.artistSlug && (
        <div className="px-5 py-6 border-t border-[var(--wk-border)]">
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Artist</h3>
          <Link
            to={`/artists/${track.artistSlug}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
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