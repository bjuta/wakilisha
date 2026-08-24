import { createPortal } from "react-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { SeekRail } from "./SeekRail";
import { usePlayer } from "@/context/PlayerContext";
import {
  formatPlayerClock,
  resolvePlayerExperience,
} from "@/services/player/playerExperience";

export type PlayerCompactMode =
  | "desktop"
  | "mobile";

function hasPlayableSource(
  track: NonNullable<ReturnType<typeof usePlayer>["currentTrack"]>,
): boolean {
  const providerPlayable =
    track.playbackEngine === "youtube" ||
    track.playbackEngine === "soundcloud";
  const applePlayable = Boolean(
    track.appleMusicCatalogId ||
    track.appleMusicId,
  );

  return (
    track.isPlayable !== false &&
    Boolean(
      track.previewUrl ||
      providerPlayable ||
      applePlayable,
    )
  );
}

export function PlayerCompactSurface({
  mode,
}: {
  mode: PlayerCompactMode;
}) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    progress,
    playbackBackend,
    togglePlay,
    openFullPlayer,
    next,
    prev,
    canGoNext,
    canGoPrev,
    seek,
    isFullPlayerOpen,
  } = usePlayer();

  if (
    !currentTrack ||
    isFullPlayerOpen
  ) {
    return null;
  }

  const experience =
    resolvePlayerExperience(
      currentTrack,
      playbackBackend,
    );
  const playable =
    hasPlayableSource(currentTrack);
  const jump =
    experience.capabilities.jumpBySeconds;

  const skipBack = () => {
    if (!jump) return;
    seek(
      Math.max(
        0,
        currentTime - jump,
      ),
    );
  };

  const skipForward = () => {
    if (!jump) return;
    seek(
      Math.min(
        duration || currentTime + jump,
        currentTime + jump,
      ),
    );
  };

  const isMobile = mode === "mobile";

  return createPortal(
    <aside
      data-wk-player-compact={mode}
      aria-label="Now playing"
      className={[
        "fixed z-[100] overflow-hidden border border-[var(--wk-border)] bg-[color:var(--wk-surface)]/96 text-[var(--wk-text)] shadow-2xl backdrop-blur-xl",
        isMobile
          ? "left-2 right-2 rounded-[18px]"
          : "inset-x-0 bottom-0 border-x-0 border-b-0",
      ].join(" ")}
      style={
        isMobile
          ? {
              bottom:
                "calc(52px + max(env(safe-area-inset-bottom), 8px) + 8px)",
            }
          : undefined
      }
    >
      <SeekRail
        label={`Seek ${currentTrack.title}`}
        currentTime={currentTime}
        duration={duration}
        progress={progress}
        onSeek={seek}
        variant="edge"
      />

      <div
        className={[
          "flex items-center gap-3",
          isMobile
            ? "min-h-[66px] px-3 py-2"
            : "min-h-[76px] px-5 py-2",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={openFullPlayer}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div
            className={[
              "shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]",
              isMobile
                ? "h-11 w-11"
                : "h-12 w-12",
            ].join(" ")}
          >
            {currentTrack.artworkUrl ? (
              <img
                src={currentTrack.artworkUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Ch19GradientImage
                slug={currentTrack.id}
                name={currentTrack.title}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-[13px] font-black tracking-[-0.01em] text-[var(--wk-text)]">
              {currentTrack.title}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-[var(--wk-text-muted)]">
              {experience.creatorLabel}
              {experience.contextLabel
                ? ` · ${experience.contextLabel}`
                : ""}
            </div>
          </div>
        </button>

        {!isMobile ? (
          <div className="hidden min-w-[220px] flex-1 items-center gap-3 md:flex">
            <span className="w-10 text-right text-[10px] tabular-nums text-[var(--wk-text-faint)]">
              {formatPlayerClock(currentTime)}
            </span>
            <SeekRail
              label={`Seek ${currentTrack.title}`}
              currentTime={currentTime}
              duration={duration}
              progress={progress}
              onSeek={seek}
            />
            <span className="w-10 text-[10px] tabular-nums text-[var(--wk-text-faint)]">
              {formatPlayerClock(duration)}
            </span>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          {experience.spokenAudio ? (
            <>
              <button
                type="button"
                onClick={skipBack}
                aria-label={`Back ${jump ?? 15} seconds`}
                className="flex h-9 min-w-9 items-center justify-center rounded-full px-1 text-[11px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              >
                ↺{jump ?? 15}
              </button>
              <button
                type="button"
                onClick={togglePlay}
                disabled={!playable}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] disabled:opacity-35"
              >
                <WkIcon
                  name={isPlaying ? "Pause" : "Play"}
                  size={19}
                  fill="currentColor"
                />
              </button>
              <button
                type="button"
                onClick={skipForward}
                aria-label={`Forward ${jump ?? 15} seconds`}
                className="flex h-9 min-w-9 items-center justify-center rounded-full px-1 text-[11px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              >
                {jump ?? 15}↻
              </button>
            </>
          ) : (
            <>
              {canGoPrev ? (
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Previous"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                >
                  <WkIcon name="SkipBack" size={18} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={togglePlay}
                disabled={!playable}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] disabled:opacity-35"
              >
                <WkIcon
                  name={isPlaying ? "Pause" : "Play"}
                  size={19}
                  fill="currentColor"
                />
              </button>
              {canGoNext ? (
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                >
                  <WkIcon name="SkipForward" size={18} />
                </button>
              ) : null}
            </>
          )}

          <button
            type="button"
            onClick={openFullPlayer}
            aria-label="Open full player"
            className="ml-1 hidden h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)] sm:flex"
          >
            <i className="ri-expand-diagonal-line" />
          </button>
        </div>
      </div>
    </aside>,
    document.body,
  );
}
