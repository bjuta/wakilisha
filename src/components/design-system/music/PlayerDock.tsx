import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

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
    canGoNext,
    canGoPrev,
    isFullPlayerOpen,
  } = usePlayer();
  const navigate = useNavigate();

  if (!currentTrack) return null;

  const isPlayable = currentTrack.isPlayable !== false && !!currentTrack.previewUrl;

  const handleExpandToggle = () => {
    if (isFullPlayerOpen) {
      closeFullPlayer();
      navigate(-1);
    } else {
      openFullPlayer();
    }
  };

  return (
    <div className="sticky bottom-0 z-[80] border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
      {/* Progress bar */}
      <div className="h-1 w-full bg-[var(--wk-surface-raised)]">
        <div
          className="h-full bg-[var(--wk-brand)] transition-all duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex h-[var(--wk-player-dock-h)] items-center gap-3 px-4">
        {/* Track info — clickable */}
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
              {currentTrack.source && (
                <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                  {currentTrack.source}
                </span>
              )}
            </div>
          </div>
        </button>

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
        {isFullPlayerOpen ? (
          <button
            onClick={handleExpandToggle}
            aria-label="Close full player"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
          >
            <i className="ri-arrow-down-s-line" />
          </button>
        ) : (
          <Link
            to="/player"
            onClick={() => openFullPlayer()}
            aria-label="Open full player"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)]"
          >
            <i className="ri-arrow-up-s-line" />
          </Link>
        )}
      </div>
    </div>
  );
}