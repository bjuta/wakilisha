import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useEntityActions } from "@/hooks/useCommunityActions";
import {
  connectAppleMusicForPlayback,
  getApplePlaybackPrefsSnapshot,
} from "@/services/appleMusicConnection";

function ActionMenu({
  open,
  onClose,
  track,
  saved,
  savePending,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  track: { title: string; artist: string; artworkUrl?: string };
  saved: boolean;
  savePending: boolean;
  onSave: () => void;
}) {
  useScrollLock(open);
  const [shareOpen, setShareOpen] = useState(false);

  if (!open) return null;

  const actions = [
    { label: "Share", icon: "Share2" as const, onClick: () => setShareOpen(true) },
    { label: "View artist", icon: "User" as const, onClick: () => onClose() },
    { label: saved ? "Saved" : savePending ? "Saving..." : "Save track", icon: "Heart" as const, onClick: onSave },
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
    playTrack,
    playbackBackend,
    playbackSourceLabel,
  } = usePlayer();
  const { save: saveEntityAction, loading: savePending } = useEntityActions();
  const [liked, setLiked] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [appleConnected, setAppleConnected] = useState(() => getApplePlaybackPrefsSnapshot().appleMusicConnected);
  const [appleConnecting, setAppleConnecting] = useState(false);
  const [appleConnectError, setAppleConnectError] = useState<string | null>(null);
  const [showFullPlaybackToast, setShowFullPlaybackToast] = useState(false);

  const collapsePlayer = () => closeFullPlayer();

  useEffect(() => {
    setLiked(false);
    setSaveError(null);
    setAppleConnectError(null);

    const syncAppleState = () => {
      setAppleConnected(getApplePlaybackPrefsSnapshot().appleMusicConnected);
    };

    syncAppleState();
    window.addEventListener("wk-playback-changed", syncAppleState);
    window.addEventListener("wk-apple-music-connected", syncAppleState);

    return () => {
      window.removeEventListener("wk-playback-changed", syncAppleState);
      window.removeEventListener("wk-apple-music-connected", syncAppleState);
    };
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack?.id || playbackBackend !== "apple") {
      setShowFullPlaybackToast(false);
      return;
    }

    const toastKey = `wk-full-playback-toast:${currentTrack.id}`;
    if (sessionStorage.getItem(toastKey) === "seen") {
      setShowFullPlaybackToast(false);
      return;
    }

    sessionStorage.setItem(toastKey, "seen");
    setShowFullPlaybackToast(true);

    const timeout = window.setTimeout(() => {
      setShowFullPlaybackToast(false);
    }, 3600);

    return () => window.clearTimeout(timeout);
  }, [currentTrack?.id, playbackBackend]);

  const handleConnectFullPlayback = async () => {
    if (!currentTrack || appleConnecting) return;

    setAppleConnecting(true);
    setAppleConnectError(null);

    try {
      await connectAppleMusicForPlayback();
      setAppleConnected(true);

      const nextQueue = queue.length ? queue : [currentTrack];
      playTrack(currentTrack, nextQueue, {
        pageType: "player",
        entityType: "track",
        entitySlug: currentTrack.trackSlug || currentTrack.id,
        sourceSection: "apple_music_full_track_cta",
      });
    } catch (err) {
      console.error("Could not connect Apple Music from player", err);
      setAppleConnectError(err instanceof Error ? err.message : "Could not connect Apple Music.");
    } finally {
      setAppleConnecting(false);
    }
  };

  const handleSaveCurrentTrack = async () => {
    if (!currentTrack || savePending) return;

    const trackSlug = currentTrack.trackSlug || currentTrack.id;
    const entityUrl = currentTrack.artistSlug && trackSlug
      ? `/tracks/${currentTrack.artistSlug}/${trackSlug}`
      : `/tracks/${trackSlug}`;

    setSaveError(null);

    try {
      const result = await saveEntityAction({
        entityType: "track",
        entityId: currentTrack.id,
        entitySlug: trackSlug,
        entityUrl,
        title: currentTrack.title,
        subtitle: currentTrack.artist,
        imageUrl: currentTrack.artworkUrl,
      });

      if (result) setLiked(result.saved);
    } catch (err) {
      console.error("Could not save current track", err);
      setSaveError(err instanceof Error ? err.message : "Could not save this track.");
    }
  };

  if (!currentTrack) {
    return (
      <div className="full-player mobile-full-player flex h-[100dvh] flex-col items-center justify-center overflow-y-auto px-6 text-center">
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
  const activeSourceLabel = playbackSourceLabel || currentTrack.source || null;
  const activeSourceIcon = playbackBackend === "apple" ? "Music2" : "Radio";
  const playbackEyebrow = playbackBackend === "apple" ? "Now playing" : "Preview";
  const hasAppleCatalog = Boolean(currentTrack.appleMusicCatalogId || currentTrack.appleMusicId);
  const showFullTrackUnlock = hasAppleCatalog && playbackBackend !== "apple" && !appleConnected;
  const pct = Math.max(0, Math.min(1, progress || 0));

  const remainingCount = queue.length - queueIndex - 1;
  const upcoming = queue.slice(queueIndex + 1);
  const hasQueue = queue.length > 1;

  return (
    <div
      data-scroll-lock="container"
      className="full-player mobile-full-player"
      style={{
        height: "100dvh",
        minHeight: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        touchAction: "pan-y",
      }}
    >
      <div
        className="fp-ambient"
        style={{
          backgroundImage: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fp-topbar" style={{ position: "sticky", top: 0 }}>
        <button
          className="fp-topbar-btn mobile-pressable"
          onClick={collapsePlayer}
          onTouchEnd={(e) => {
            e.preventDefault();
            collapsePlayer();
          }}
          aria-label="Collapse player"
        >
          <WkIcon name="ChevronDown" size={22} />
        </button>
        <div className="fp-topbar-title">
          <span>Now playing</span>
          <strong>{playbackBackend === "apple" ? "Apple Music" : "WAKILISHA"}</strong>
        </div>
        <button
          className="fp-topbar-btn mobile-pressable"
          onClick={() => setActionMenuOpen(true)}
          aria-label="More player actions"
        >
          <WkIcon name="MoreHorizontal" size={20} />
        </button>
      </div>

      <div className="fp-art-zone">
        <div className="fp-art-shell">
          <div
            className="fp-art-glow"
            style={{
              backgroundImage: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined,
            }}
          />
          <div className="fp-art-card">
            {currentTrack.artworkUrl ? (
              <img src={currentTrack.artworkUrl} alt={currentTrack.title} />
            ) : (
              <div className="fp-art-placeholder">
                <WkIcon name="Music2" size={40} />
              </div>
            )}
            <div className="fp-art-shine" />
            <div className="fp-art-badges">
              {activeSourceLabel && (
                <span className={`fp-source-pill ${playbackBackend === "apple" ? "apple" : ""}`}>
                  <WkIcon name={activeSourceIcon} size={12} /> {activeSourceLabel}
                </span>
              )}
              {isPlaying && (
                <span className="fp-live-pill">
                  <span /> Live
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fp-controls">
        <section className="fp-control-deck">
        {showFullPlaybackToast && (
          <div className="fp-fullplayback-toast" role="status" aria-live="polite">
            <span className="fp-fullplayback-dot" />
            <div>
              <strong>Full track playing</strong>
              <p>Unlocked through Apple Music.</p>
            </div>
          </div>
        )}

        <div className="fp-track-info">
          <div className="min-w-0">
            <div className="fp-kicker">{playbackEyebrow}</div>
            <h1 className="fp-track-name">{currentTrack.title}</h1>
            <div className="fp-track-artist">
              {currentTrack.artist}
            </div>
          </div>
          <button
            onClick={handleSaveCurrentTrack}
            disabled={savePending}
            className={`fp-like mobile-pressable ${liked ? "text-[var(--wk-brand)]" : ""}`}
            aria-label={liked ? "Remove from saved tracks" : "Save track"}
          >
            <WkIcon name="Heart" size={23} fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        {saveError && (
          <p className="mt-2 text-center text-[11px] font-bold text-red-500">
            {saveError}
          </p>
        )}

        {showFullTrackUnlock && (
          <div className="fp-fulltrack-card">
            <div className="fp-fulltrack-copy">
              <span className="fp-fulltrack-eyebrow">Full track available</span>
              <strong>Play the whole song on WAKILISHA</strong>
              <p>Connect Apple Music once. Keep listening here without leaving the app.</p>
              {appleConnectError && <em>{appleConnectError}</em>}
            </div>
            <button
              type="button"
              onClick={handleConnectFullPlayback}
              disabled={appleConnecting}
              className="fp-fulltrack-btn mobile-pressable"
            >
              <WkIcon name={appleConnecting ? "Loader2" : "Music2"} size={15} />
              {appleConnecting ? "Connecting..." : "Play full track"}
            </button>
          </div>
        )}

        <div className="fp-meta-pills">
          {activeSourceLabel && (
            <span className="fp-meta-pill">
              <WkIcon name={activeSourceIcon} size={12} /> {activeSourceLabel}
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



        </section>

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
        saved={liked}
        savePending={savePending}
        onSave={handleSaveCurrentTrack}
      />
    </div>
  );
}