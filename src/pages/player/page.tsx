import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";

const LYRICS = [
  "The culture lives in the numbers",
  "From the coast to the valley",
  "We index the rhythm of the continent",
  "Charts in motion, every week",
  "One by one, we count the rise",
  "From Lagos to Nairobi, we're alive",
  "Every beat, every rhyme, every soul",
  "This is where the story gets told",
  "The numbers don't lie, they don't pretend",
  "We chart the truth from start to end",
  "Afrobeats to the world, it's our time",
  "WAKILISHA, the sound that climbs",
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <WkIcon name="VolumeX" size={20} />;
  if (volume < 0.4) return <WkIcon name="Volume" size={20} />;
  if (volume < 0.7) return <WkIcon name="Volume1" size={20} />;
  return <WkIcon name="Volume2" size={20} />;
}

export default function DesktopPlayerPage() {
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
    volume,
    setVolume,
    playFromQueue,
  } = usePlayer();

  const [liked, setLiked] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [showLyrics, setShowLyrics] = useState(false);

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(pct * duration);
    },
    [duration, seek]
  );

  const handleScrubMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrubbing) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(pct * duration);
    },
    [scrubbing, duration, seek]
  );

  const handleVolumeChange = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(pct);
    },
    [setVolume]
  );

  if (!currentTrack) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <WkIcon name="Music2" size={32} className="text-[var(--wk-text-faint)]" />
        </div>
        <h1 className="text-[22px] font-black text-[var(--wk-text)]">No track playing</h1>
        <p className="mt-2 text-[14px] text-[var(--wk-text-muted)]">
          Start playing a track from anywhere on the site.
        </p>
        <button
          onClick={() => nav(-1)}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90"
        >
          <WkIcon name="ArrowLeft" size={16} /> Go back
        </button>
      </main>
    );
  }

  const pct = Math.max(0, Math.min(1, progress || 0));
  const activeLyric = Math.floor((currentTime / (duration || 1)) * LYRICS.length) % LYRICS.length;
  const remainingCount = queue.length - queueIndex - 1;
  const upcoming = queue.slice(queueIndex + 1);
  const hasQueue = queue.length > 1;

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[var(--wk-bg)]">
      {/* Ambient background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(80px) saturate(1.4)",
          transform: "scale(1.2)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--wk-bg)]/40 via-[var(--wk-bg)]/80 to-[var(--wk-bg)]" />

      {/* Content */}
      <div className="relative z-10 flex w-full flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 lg:px-10 lg:py-5">
          <button
            onClick={() => nav(-1)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <WkIcon name="ChevronLeft" size={18} /> Back
          </button>
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--wk-text-faint)]">
            Now Playing
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLyrics((v) => !v)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-[var(--wk-surface-raised)] ${showLyrics ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
              aria-label="Toggle lyrics"
            >
              <WkIcon name="Text" size={18} />
            </button>
            <button
              onClick={() => setShowQueue((v) => !v)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-[var(--wk-surface-raised)] ${showQueue ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
              aria-label="Toggle queue"
            >
              <WkIcon name="ListMusic" size={18} />
            </button>
          </div>
        </div>

        {/* Main body */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 lg:flex-row lg:items-center lg:justify-center lg:gap-12 lg:px-10 xl:gap-16">
          {/* Artwork + track info column */}
          <div className="flex flex-col items-center">
            <div className="relative w-[320px] h-[320px] overflow-hidden rounded-2xl bg-[var(--wk-surface-raised)] shadow-2xl lg:w-[420px] lg:h-[420px] xl:w-[480px] xl:h-[480px]">
              {currentTrack.artworkUrl ? (
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <WkIcon name="Music2" size={64} className="text-[var(--wk-text-faint)]" />
                </div>
              )}
              {/* Playing indicator */}
              {isPlaying && (
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--wk-brand)]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">Playing</span>
                </div>
              )}
            </div>

            {/* Track info below artwork */}
            <div className="mt-6 w-full max-w-[480px] text-center lg:mt-8">
              <h1 className="text-[22px] font-black leading-tight tracking-tight text-[var(--wk-text)] lg:text-[28px]">
                {currentTrack.title}
              </h1>
              <div className="mt-2 flex items-center justify-center gap-2 text-[14px] text-[var(--wk-text-muted)]">
                <span className="font-semibold text-[var(--wk-text-soft)]">{currentTrack.artist}</span>
                {currentTrack.source && (
                  <>
                    <span className="text-[var(--wk-text-faint)]">·</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--wk-brand)]">
                      <WkIcon name="Radio" size={10} /> {currentTrack.source}
                    </span>
                  </>
                )}
              </div>
              {currentTrack.album && (
                <div className="mt-1 text-[13px] text-[var(--wk-text-faint)]">{currentTrack.album}</div>
              )}
            </div>
          </div>

          {/* Controls + queue column */}
          <div className="mt-8 flex w-full max-w-[520px] flex-col lg:mt-0 lg:w-[420px] xl:w-[480px]">
            {/* Scrub bar */}
            <div className="mb-2">
              <div
                className="group relative h-1.5 w-full cursor-pointer rounded-full bg-[var(--wk-border-strong)]"
                onClick={handleScrub}
                onMouseDown={() => setScrubbing(true)}
                onMouseUp={() => setScrubbing(false)}
                onMouseLeave={() => setScrubbing(false)}
                onMouseMove={handleScrubMove}
              >
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-[var(--wk-brand)] transition-all duration-100"
                  style={{ width: `${pct * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--wk-text)] opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                  style={{ left: `${pct * 100}%`, transform: "translate(-50%, -50%)" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] font-medium tabular-nums text-[var(--wk-text-faint)]">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="mb-6 flex items-center justify-center gap-4 lg:gap-6">
              <button
                onClick={toggleShuffle}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-[var(--wk-surface-raised)] ${isShuffle ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
                aria-label="Shuffle"
              >
                <WkIcon name="Shuffle" size={20} />
              </button>
              <button
                onClick={prev}
                disabled={!canGoPrev}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous"
              >
                <WkIcon name="SkipBack" size={24} />
              </button>
              <button
                onClick={togglePlay}
                disabled={currentTrack.isPlayable === false}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-brand-on)] transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                <WkIcon name={isPlaying ? "Pause" : "Play"} size={28} fill="currentColor" />
              </button>
              <button
                onClick={next}
                disabled={!canGoNext}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next"
              >
                <WkIcon name="SkipForward" size={24} />
              </button>
              <button
                onClick={toggleRepeat}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-[var(--wk-surface-raised)] ${repeatMode !== "off" ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
                aria-label="Repeat"
              >
                <WkIcon name={repeatMode === "one" ? "Repeat1" : "Repeat2"} size={20} />
              </button>
            </div>

            {/* Volume + like row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                <button
                  onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                  className="text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)]"
                >
                  <VolumeIcon volume={volume} />
                </button>
                <div
                  className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-[var(--wk-border-strong)]"
                  onClick={handleVolumeChange}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-[var(--wk-brand)]"
                    style={{ width: `${volume * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--wk-text)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    style={{ left: `${volume * 100}%`, transform: "translate(-50%, -50%)" }}
                  />
                </div>
                <span className="w-8 text-right text-[11px] font-medium tabular-nums text-[var(--wk-text-faint)]">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <button
                onClick={() => setLiked((v) => !v)}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-[var(--wk-surface-raised)] ${liked ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}`}
                aria-label={liked ? "Unlike" : "Like"}
              >
                <WkIcon name="Heart" size={22} fill={liked ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Lyrics panel */}
            {showLyrics && (
              <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 lg:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Lyrics</span>
                  <span className="text-[11px] text-[var(--wk-text-faint)]">Live preview</span>
                </div>
                <div className="space-y-2">
                  <p className="text-[16px] font-bold leading-relaxed text-[var(--wk-text)] lg:text-[18px]">
                    {LYRICS[activeLyric]}
                  </p>
                  <p className="text-[14px] leading-relaxed text-[var(--wk-text-faint)]">
                    {LYRICS[(activeLyric + 1) % LYRICS.length]}
                  </p>
                </div>
              </div>
            )}

            {/* Queue panel */}
            {showQueue && hasQueue && (
              <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 lg:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Up next</span>
                  <span className="text-[11px] tabular-nums text-[var(--wk-text-faint)]">
                    {queueIndex + 1} / {queue.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {/* Current track */}
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--wk-brand-soft)] px-3 py-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {currentTrack.artworkUrl ? (
                        <img src={currentTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <WkIcon name="Music2" size={14} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-[var(--wk-brand)]">{currentTrack.title}</div>
                      <div className="truncate text-[12px] text-[var(--wk-brand)]/70">{currentTrack.artist}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--wk-brand)]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Now</span>
                    </div>
                  </div>
                  {/* Upcoming tracks */}
                  {upcoming.map((track, idx) => (
                    <button
                      key={track.id}
                      onClick={() => playFromQueue(queueIndex + 1 + idx)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-[var(--wk-surface-raised)]"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <WkIcon name="Music2" size={14} className="text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{track.title}</div>
                        <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{track.artist}</div>
                      </div>
                      <WkIcon name="Play" size={14} className="text-[var(--wk-text-faint)]" />
                    </button>
                  ))}
                </div>
                {remainingCount > upcoming.length && (
                  <div className="mt-2 text-center text-[12px] text-[var(--wk-text-faint)]">
                    +{remainingCount - upcoming.length} more tracks
                  </div>
                )}
              </div>
            )}

            {/* Empty queue message */}
            {showQueue && !hasQueue && (
              <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-center">
                <WkIcon name="ListMusic" size={24} className="mx-auto mb-2 text-[var(--wk-text-faint)]" />
                <p className="text-[13px] text-[var(--wk-text-muted)]">Queue is empty</p>
                <p className="mt-1 text-[12px] text-[var(--wk-text-faint)]">Play a track from a playlist or album to fill the queue.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}