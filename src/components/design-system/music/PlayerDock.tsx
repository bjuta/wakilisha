import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  isMusicAppPath,
} from "@/components/music/MusicDesktopShell";
import { usePlayer } from "@/context/PlayerContext";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";

export function PlayerDock() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    openFullPlayer,
    closeFullPlayer,
    next,
    prev,
    progress,
    currentTime,
    duration,
    seek,
    canGoNext,
    canGoPrev,
    isFullPlayerOpen,
    playbackSourceLabel,
    volume,
    setVolume,
    repeatMode,
    isShuffle,
    toggleRepeat,
    toggleShuffle,
  } = usePlayer();

  const location = useLocation();
  const isMusicRoute =
    isMusicAppPath(
      location.pathname,
    );

  if (!currentTrack) return null;

  const activeSourceLabel = playbackSourceLabel || currentTrack.source || null;
  const hasAppleCatalog = Boolean(currentTrack.appleMusicCatalogId || currentTrack.appleMusicId);
  const hasProviderPlayback =
    currentTrack.playbackEngine ===
      "youtube" ||
    currentTrack.playbackEngine ===
      "soundcloud";

  const isPlayable =
    currentTrack.isPlayable !== false &&
    (
      !!currentTrack.previewUrl ||
      hasAppleCatalog ||
      hasProviderPlayback
    );

  const seekFromClientX = (
    clientX: number,
    element: HTMLDivElement,
  ) => {
    if (
      !duration ||
      duration <= 0
    ) {
      return;
    }

    const rect =
      element
        .getBoundingClientRect();

    const ratio =
      Math.max(
        0,
        Math.min(
          1,
          (
            clientX -
            rect.left
          ) /
            rect.width,
        ),
      );

    seek(
      ratio *
        duration,
    );
  };

  const handleExpandToggle = () => {
    if (isFullPlayerOpen) {
      closeFullPlayer();
    } else {
      openFullPlayer();
    }
  };

  const formatClock = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "0:00";
    }

    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const remainder = String(whole % 60).padStart(2, "0");
    return `${minutes}:${remainder}`;
  };

  if (isMusicRoute) {
    return createPortal(
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-[100] border-t border-[var(--wk-border-2)] bg-[var(--wk-overlay)] text-[var(--wk-text)] shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl",
          isFullPlayerOpen ? "hidden" : "",
        ].join(" ")}
      >
        <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-2 sm:px-5 lg:grid-cols-[290px_minmax(360px,1fr)_260px]">
          <button
            type="button"
            onClick={openFullPlayer}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
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
              <div className="truncate text-[13px] font-black text-[var(--wk-text)]">
                {currentTrack.title}
              </div>
              <div className="mt-1 truncate text-[10px] font-medium text-[var(--wk-text-muted)]">
                {currentTrack.artist}
              </div>
            </div>
          </button>

          <div className="hidden min-w-0 lg:block">
            <div className="flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="Shuffle"
                className={isShuffle ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}
              >
                <i className="ri-shuffle-line" />
              </button>
              <button
                type="button"
                onClick={prev}
                disabled={!canGoPrev}
                aria-label="Previous"
                className="text-[var(--wk-text-soft)] disabled:opacity-25"
              >
                <i className="ri-skip-back-fill text-xl" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                disabled={!isPlayable}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] disabled:opacity-35"
              >
                <i className={isPlaying ? "ri-pause-fill text-xl" : "ri-play-fill text-xl"} />
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!canGoNext}
                aria-label="Next"
                className="text-[var(--wk-text-soft)] disabled:opacity-25"
              >
                <i className="ri-skip-forward-fill text-xl" />
              </button>
              <button
                type="button"
                onClick={toggleRepeat}
                aria-label="Repeat"
                className={repeatMode !== "off" ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]"}
              >
                <i className={repeatMode === "one" ? "ri-repeat-one-line" : "ri-repeat-line"} />
              </button>
            </div>

            <div className="mt-1.5 flex items-center gap-3">
              <span className="w-9 text-right text-[9px] font-medium tabular-nums text-[var(--wk-text-faint)]">
                {formatClock(currentTime)}
              </span>
              <div
                role="slider"
                tabIndex={duration > 0 ? 0 : -1}
                aria-label={`Seek ${currentTrack.title}`}
                aria-valuemin={0}
                aria-valuemax={Math.max(0, Math.round(duration || 0))}
                aria-valuenow={Math.max(0, Math.round(currentTime || 0))}
                className="group relative h-4 min-w-0 flex-1 cursor-pointer"
                onPointerDown={(event) => {
                  if (!duration || duration <= 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  seekFromClientX(event.clientX, event.currentTarget);
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  seekFromClientX(event.clientX, event.currentTarget);
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
              >
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--wk-surface-strong)]">
                  <div
                    className="h-full rounded-full bg-[var(--wk-brand)]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
              <span className="w-9 text-[9px] font-medium tabular-nums text-[var(--wk-text-faint)]">
                {formatClock(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <AddToPlaylistButton trackId={currentTrack.registryTrackId} trackTitle={currentTrack.title} compact iconOnly />
            <button
              type="button"
              onClick={togglePlay}
              disabled={!isPlayable}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-text)] text-[var(--wk-bg)] lg:hidden"
            >
              <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} />
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              <i className="ri-volume-up-line text-[var(--wk-text-muted)]" />
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="h-1 w-24 accent-[var(--wk-brand)]"
              />
            </div>

            <button
              type="button"
              onClick={openFullPlayer}
              aria-label="Open full player"
              className="flex h-8 w-8 items-center justify-center text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-expand-diagonal-line" />
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className={`sticky bottom-0 border-t border-[var(--wk-border)] bg-[var(--wk-surface)] ${isFullPlayerOpen ? 'z-[100]' : 'z-[80]'}`}>
      {/* Universal seek bar */}
      <div
        role="slider"
        tabIndex={
          duration > 0
            ? 0
            : -1
        }
        aria-label={`Seek ${currentTrack.title}`}
        aria-valuemin={0}
        aria-valuemax={
          Math.max(
            0,
            Math.round(
              duration || 0,
            ),
          )
        }
        aria-valuenow={
          Math.max(
            0,
            Math.round(
              currentTime || 0,
            ),
          )
        }
        className={[
          "group relative h-8 w-full touch-none md:h-3",
          duration > 0
            ? "cursor-pointer"
            : "cursor-default",
        ].join(" ")}
        onPointerDown={(event) => {
          if (
            !duration ||
            duration <= 0
          ) {
            return;
          }

          event.currentTarget
            .setPointerCapture(
              event.pointerId,
            );

          seekFromClientX(
            event.clientX,
            event.currentTarget,
          );
        }}
        onPointerMove={(event) => {
          if (
            !event.currentTarget
              .hasPointerCapture(
                event.pointerId,
              )
          ) {
            return;
          }

          seekFromClientX(
            event.clientX,
            event.currentTarget,
          );
        }}
        onPointerUp={(event) => {
          if (
            event.currentTarget
              .hasPointerCapture(
                event.pointerId,
              )
          ) {
            event.currentTarget
              .releasePointerCapture(
                event.pointerId,
              );
          }
        }}
        onPointerCancel={(event) => {
          if (
            event.currentTarget
              .hasPointerCapture(
                event.pointerId,
              )
          ) {
            event.currentTarget
              .releasePointerCapture(
                event.pointerId,
              );
          }
        }}
        onKeyDown={(event) => {
          if (
            event.key ===
            "ArrowLeft"
          ) {
            event.preventDefault();
            seek(
              Math.max(
                0,
                currentTime -
                  5,
              ),
            );
          }

          if (
            event.key ===
            "ArrowRight"
          ) {
            event.preventDefault();
            seek(
              Math.min(
                duration,
                currentTime +
                  5,
              ),
            );
          }
        }}
      >
        <div className="absolute inset-x-0 top-1 h-1 bg-[var(--wk-surface-raised)]">
          <div
            className="h-full bg-[var(--wk-brand)]"
            style={{
              width:
                `${progress * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="flex h-[var(--wk-player-dock-h)] items-center gap-3 px-4">
        {/* Track info. Clickable. */}
        <button
          onClick={() => {
            if (!isFullPlayerOpen) openFullPlayer();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
            {currentTrack.artworkUrl ? (
              <img
                src={currentTrack.artworkUrl}
                alt=""
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <Ch19GradientImage slug={currentTrack.id} name={currentTrack.title} />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">
              {currentTrack.title}
            </div>
            <div className="flex items-center gap-2">
              <div className="truncate text-[11px] text-[var(--wk-text-muted)]">
                {currentTrack.artist}
              </div>
              {activeSourceLabel && (
                <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                  {activeSourceLabel}
                </span>
              )}
            </div>
          </div>
        </button>

        <AddToPlaylistButton trackId={currentTrack.registryTrackId} trackTitle={currentTrack.title} compact iconOnly />

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={prev}
            disabled={!canGoPrev}
            aria-label="Previous"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] disabled:opacity-30"
          >
            <i className="ri-skip-back-mini-fill" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!isPlayable}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} />
          </button>

          <button
            onClick={next}
            disabled={!canGoNext}
            aria-label="Next"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] disabled:opacity-30"
          >
            <i className="ri-skip-forward-mini-fill" />
          </button>
        </div>

        {/* Expand / Collapse toggle */}
        <button
          onClick={handleExpandToggle}
          aria-label={isFullPlayerOpen ? "Close full player" : "Open full player"}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
        >
          <i className={isFullPlayerOpen ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"} />
        </button>
      </div>
    </div>
  );
}