import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import { useScrollLock } from "@/hooks/useScrollLock";

function ActionMenu({
  open,
  onClose,
  track,
}: {
  open: boolean;
  onClose: () => void;
  track: { title: string; artist: string; artworkUrl?: string };
}) {
  useScrollLock(open);
  const [shareOpen, setShareOpen] = useState(false);

  if (!open) return null;

  const actions = [
    { label: "Share", icon: "Share2" as const, onClick: () => setShareOpen(true) },
    { label: "View artist", icon: "User" as const, onClick: () => onClose() },
    { label: "Add to favorites", icon: "Heart" as const, onClick: () => onClose() },
    { label: "Go to album", icon: "Album" as const, onClick: () => onClose() },
  ];

  return (
    <>
      <div className="fp-action-backdrop" onClick={onClose} />
      <div data-scroll-lock="container" className="fp-action-sheet">
        <div className="fp-action-handle" />
        {actions.map((action) => (
          <button key={action.label} className="fp-action-row" onClick={action.onClick}>
            <WkIcon name={action.icon} size={18} />
            <span>{action.label}</span>
          </button>
        ))}
        <button className="fp-action-cancel" onClick={onClose}>Cancel</button>
      </div>
      <ShareSheet
        item={{
          title: track.title,
          subtitle: track.artist,
          description: `${track.title} by ${track.artist}`,
          imageUrl: track.artworkUrl || null,
          type: "track",
        }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}

export function MobileFullPlayer() {
  const nav = useNavigate();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    next,
    prev,
    canGoNext,
    canGoPrev,
    currentTime,
    duration,
    progress,
    seek,
    queue,
    queueIndex,
    isShuffle,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    closeFullPlayer,
    playFromQueue,
  } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  if (!currentTrack) {
    return (
      <div className="full-player mobile-full-player flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <WkIcon name="Music2" size={26} className="text-[var(--wk-text-faint)]" />
        </div>
        <h2 className="fp-track-name">No track playing</h2>
        <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">
          Tap play on any track to start listening.
        </p>
        <button onClick={() => { closeFullPlayer(); nav(-1); }} className="mt-6 auth-btn auth-btn-primary mobile-pressable">
          Go back
        </button>
      </div>
    );
  }

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const pct = Math.max(0, Math.min(1, progress || 0));

  const remainingCount = queue.length - queueIndex - 1;
  const upcoming = queue.slice(queueIndex + 1);
  const hasQueue = queue.length > 1;

  return (
    <div className="full-player mobile-full-player">
      <div
        className="fp-ambient"
        style={{
          backgroundImage: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fp-topbar">
        <button
          className="fp-topbar-btn mobile-pressable"
          onClick={() => closeFullPlayer()}
          aria-label="Collapse player"
        >
          <WkIcon name="ChevronDown" size={22} />
        </button>
        <div className="fp-topbar-title">Now Playing</div>
        <button
          className="fp-topbar-btn mobile-pressable"
          onClick={() => setActionMenuOpen(true)}
          aria-label="More player actions"
        >
          <WkIcon name="MoreHorizontal" size={20} />
        </button>
      </div>

      <div className="fp-art-zone">
        {currentTrack.artworkUrl ? (
          <img src={currentTrack.artworkUrl} alt={currentTrack.title} />
        ) : (
          <div className="aspect-square bg-[var(--wk-surface-raised)]" />
        )}
      </div>

      <div className="fp-controls">
        <div className="fp-track-info">
          <div className="min-w-0">
            <h1 className="fp-track-name">{currentTrack.title}</h1>
            <div className="fp-track-artist">
              {currentTrack.artist}
              {currentTrack.source ? ` · ${currentTrack.source}` : ""}
            </div>
          </div>
          <button
            onClick={() => setLiked((v) => !v)}
            className={`fp-like mobile-pressable ${liked ? "text-[var(--wk-brand)]" : ""}`}
            aria-label={liked ? "Remove from favorites" : "Save track"}
          >
            <WkIcon name="Heart" size={23} fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="fp-meta-pills">
          {currentTrack.source && (
            <span className="fp-meta-pill">
              <WkIcon name="Radio" size={12} /> {currentTrack.source}
            </span>
          )}
          <span className="fp-meta-pill">
            <WkIcon name="Clock3" size={12} /> {formatTime(duration || currentTrack.duration || 0)}
          </span>
          <span className="fp-meta-pill">
            <WkIcon name="ListMusic" size={12} /> {queue.length} in queue
          </span>
        </div>

        <div className="fp-scrub">
          <div
            className="fp-scrub-bar"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - r.left) / r.width) * duration);
            }}
          >
            <div className="fp-scrub-fill" style={{ width: `${pct * 100}%` }} />
            <div className="fp-scrub-thumb" style={{ left: `${pct * 100}%` }} />
          </div>
          <div className="fp-times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="fp-btns">
          <button
            onClick={toggleShuffle}
            className={`fp-btn mobile-pressable ${isShuffle ? "on" : ""}`}
            aria-label="Shuffle"
          >
            <WkIcon name="Shuffle" size={22} />
          </button>
          <button
            className="fp-btn mobile-pressable"
            onClick={prev}
            disabled={!canGoPrev}
            aria-label="Previous"
          >
            <WkIcon name="SkipBack" size={24} />
          </button>
          <button
            className="fp-play-btn mobile-pressable"
            onClick={togglePlay}
            disabled={currentTrack.isPlayable === false}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <WkIcon name={isPlaying ? "Pause" : "Play"} size={28} fill="currentColor" />
          </button>
          <button
            className="fp-btn mobile-pressable"
            onClick={next}
            disabled={!canGoNext}
            aria-label="Next"
          >
            <WkIcon name="SkipForward" size={24} />
          </button>
          <button
            onClick={toggleRepeat}
            className={`fp-btn mobile-pressable ${repeatMode !== "off" ? "on" : ""}`}
            aria-label="Repeat"
          >
            <WkIcon name={repeatMode === "one" ? "Repeat1" : "Repeat2"} size={22} />
          </button>
        </div>



        {hasQueue && (
          <div className="fp-queue-strip">
            <div className="fp-queue-head">
              <span>Up next</span>
              <span>{remainingCount} remaining</span>
            </div>
            <div className="fp-queue-list">
              {/* Current track indicator */}
              <div className="fp-queue-row fp-queue-row--current">
                <div className="fp-queue-art">
                  {currentTrack.artworkUrl ? (
                    <img src={currentTrack.artworkUrl} alt="" />
                  ) : (
                    <WkIcon name="Music2" size={14} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="fp-queue-title">{currentTrack.title}</div>
                  <div className="fp-queue-sub">{currentTrack.artist}</div>
                </div>
                <div className="fp-queue-playing">
                  <span className="fp-queue-playing-dot" />
                  <span className="fp-queue-playing-label">Now</span>
                </div>
              </div>

              {/* Upcoming tracks */}
              {upcoming.map((track, idx) => (
                <button
                  key={track.id}
                  className="fp-queue-row"
                  onClick={() => playFromQueue(queueIndex + 1 + idx)}
                  aria-label={`Play ${track.title} by ${track.artist}`}
                >
                  <div className="fp-queue-art">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" />
                    ) : (
                      <WkIcon name="Music2" size={14} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="fp-queue-title">{track.title}</div>
                    <div className="fp-queue-sub">{track.artist}</div>
                  </div>
                  <WkIcon name="Play" size={14} className="text-[var(--wk-text-faint)]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lyrics — contribute if no lyrics, link to contribute page if slugs available */}
        <div className="fp-lyrics">
          <div className="text-center py-5">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]/50">
              <WkIcon name="FileText" size={20} className="text-[var(--wk-brand)]" />
            </div>
            <p className="text-[13px] font-extrabold text-[var(--wk-text)] mb-1">
              No lyrics yet
            </p>
            <p className="text-[11px] text-[var(--wk-text-muted)] mb-4 max-w-[280px] mx-auto leading-relaxed">
              Be the first to add timed lyrics for <strong className="text-[var(--wk-text)]">{currentTrack.title}</strong>.
            </p>
            {currentTrack.artistSlug && currentTrack.trackSlug ? (
              <Link
                to={`/tracks/${currentTrack.artistSlug}/${currentTrack.trackSlug}/lyrics/contribute`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] text-white px-5 py-2.5 text-[12px] font-extrabold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <WkIcon name="Edit3" size={14} />
                Contribute lyrics
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] px-5 py-2.5 text-[12px] font-bold whitespace-nowrap">
                <WkIcon name="Edit3" size={14} />
                Contribute lyrics
              </span>
            )}
          </div>
        </div>
      </div>

      <ActionMenu
        open={actionMenuOpen}
        onClose={() => setActionMenuOpen(false)}
        track={{
          title: currentTrack.title,
          artist: currentTrack.artist,
          artworkUrl: currentTrack.artworkUrl,
        }}
      />
    </div>
  );
}