import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { usePlayer } from "@/context/PlayerContext";

const LYRICS = [
  "Sana, we run the graph",
  "Data from the motherland",
  "Charts in motion, every week",
  "Wakilisha keeps the heat",
  "Streaming, streaming, everywhere",
  "The culture lives in the numbers",
  "From the coast to the valley",
  "We index the rhythm of the continent",
];

export default function MobilePlayer() {
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
    repeatMode,
    toggleRepeat,
    isShuffle,
    toggleShuffle,
    queue,
    queueIndex,
  } = usePlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  if (!currentTrack) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--wk-bg)] px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <i className="ri-music-2-line text-2xl text-[var(--wk-text-faint)]" />
        </div>
        <h2 className="text-[18px] font-black text-[var(--wk-text)]">No track playing</h2>
        <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">
          Tap play on any track to start listening.
        </p>
        <button
          onClick={() => nav(-1)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)]"
        >
          <i className="ri-arrow-left-line" />
          Go back
        </button>
      </div>
    );
  }

  const isPlayable = currentTrack.isPlayable !== false;
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const activeLyric = Math.floor((currentTime / (duration || 1)) * LYRICS.length) % LYRICS.length;

  const repeatIcon = {
    off: "ri-repeat-line",
    all: "ri-repeat-fill",
    one: "ri-repeat-one-fill",
  }[repeatMode];

  const handleSeekStart = () => {
    setIsDragging(true);
    setDragProgress(progress);
  };

  const handleSeekMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setDragProgress(ratio);
  };

  const handleSeekEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    seek(dragProgress * duration);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--wk-bg)]">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-surface)] text-[var(--wk-text)] transition-all active:scale-95"
          onClick={() => nav(-1)}
        >
          <i className="ri-arrow-down-s-line text-xl" />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
          Now Playing
        </span>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-surface)] text-[var(--wk-text)] transition-all active:scale-95">
          <i className="ri-more-2-line text-xl" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {/* Artwork */}
        <div className="flex justify-center pt-2 pb-6">
          <div className="relative w-[65%] max-w-[280px] aspect-square overflow-hidden rounded-[var(--wk-r-5)] bg-[var(--wk-surface-raised)] shadow-lg">
            {currentTrack.artworkUrl ? (
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <i className="ri-music-2-line text-4xl text-[var(--wk-text-faint)]" />
              </div>
            )}
          </div>
        </div>

        {/* Track info */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-[var(--wk-text)]">
              {currentTrack.title}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[13px] font-medium text-[var(--wk-text-muted)]">
                {currentTrack.artist}
                {currentTrack.album && ` — ${currentTrack.album}`}
              </span>
              {currentTrack.source && (
                <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                  {currentTrack.source}
                </span>
              )}
            </div>
            {!isPlayable && (
              <div className="mt-2 rounded-lg bg-[var(--wk-danger-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--wk-danger)]">
                Preview unavailable — no playback source
              </div>
            )}
          </div>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all active:scale-95">
            <i className="ri-heart-line text-xl" />
          </button>
        </div>

        {/* Scrub bar */}
        <div className="mt-6 select-none">
          <div
            className="h-1.5 w-full cursor-pointer rounded-full bg-[var(--wk-divider)]"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seek(ratio * duration);
            }}
            onMouseDown={handleSeekStart}
            onMouseMove={handleSeekMove}
            onMouseUp={handleSeekEnd}
            onMouseLeave={handleSeekEnd}
            onTouchStart={handleSeekStart}
            onTouchMove={handleSeekMove}
            onTouchEnd={handleSeekEnd}
          >
            <div
              className="relative h-full rounded-full bg-[var(--wk-brand)]"
              style={{ width: `${(isDragging ? dragProgress : progress) * 100}%` }}
            >
              <div className="absolute -top-1 right-0 h-3.5 w-3.5 rounded-full bg-[var(--wk-brand)] shadow-sm" />
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-mono text-[var(--wk-text-faint)]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all active:scale-90 disabled:opacity-30"
            onClick={prev}
            disabled={!canGoPrev}
          >
            <i className="ri-skip-back-fill text-lg" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all active:scale-90"
            onClick={() => seek(Math.max(0, currentTime - 10))}
          >
            <i className="ri-skip-back-mini-fill text-lg" />
          </button>
          <button
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={togglePlay}
            disabled={!isPlayable}
          >
            <i className={isPlaying ? "ri-pause-fill text-[32px]" : "ri-play-fill text-[32px]"} />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all active:scale-90"
            onClick={() => seek(Math.min(duration, currentTime + 10))}
          >
            <i className="ri-skip-forward-mini-fill text-lg" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all active:scale-90 disabled:opacity-30"
            onClick={next}
            disabled={!canGoNext}
          >
            <i className="ri-skip-forward-fill text-lg" />
          </button>
        </div>

        {/* Secondary controls */}
        <div className="mt-5 flex items-center justify-center gap-8">
          <button
            onClick={toggleShuffle}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] transition-all active:scale-90 ${isShuffle ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
            aria-label="Toggle shuffle"
          >
            <i className="ri-shuffle-line" />
          </button>
          <button
            onClick={toggleRepeat}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] transition-all active:scale-90 ${repeatMode !== "off" ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
            aria-label="Toggle repeat"
          >
            <i className={repeatIcon} />
          </button>
          <span className="text-[11px] font-medium text-[var(--wk-text-faint)]">
            {queueIndex + 1} / {queue.length}
          </span>
        </div>

        {/* Lyrics */}
        <div className="mt-6 rounded-[var(--wk-r-5)] bg-[var(--wk-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Lyrics</span>
            {isPlaying && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--wk-brand)]" />
                Live
              </span>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[18px] font-bold leading-relaxed text-[var(--wk-text)]">
              {LYRICS[activeLyric]}
            </p>
            <p className="text-[15px] font-medium leading-relaxed text-[var(--wk-text-muted)]">
              {LYRICS[(activeLyric + 1) % LYRICS.length]}
            </p>
          </div>
        </div>

        {/* Up next */}
        {queue.length > 1 && (
          <div className="mt-6">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Up next
            </div>
            <div className="space-y-2">
              {queue.slice(queueIndex + 1, queueIndex + 4).map((track, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[var(--wk-r-4)] bg-[var(--wk-surface)] p-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt={track.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <i className="ri-music-2-line text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{track.title}</div>
                    <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{track.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}