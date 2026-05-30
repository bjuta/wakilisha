import { useState } from "react";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkButton } from "@/components/design-system/primitives/Button";

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  previewUrl?: string;
  provider?: string;
  isPlayable: boolean;
}

interface PlayerDockProps {
  track: PlayerTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenSheet?: () => void;
}

interface PlayerSheetProps {
  open: boolean;
  onClose: () => void;
  track: PlayerTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function PlayerDock({ track, isPlaying, onTogglePlay, onOpenSheet }: PlayerDockProps) {
  if (!track) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[80] border-t border-[var(--wk-border)] bg-[var(--wk-surface)]"
      style={{ height: "var(--wk-player-dock-h)" }}
    >
      <div className="flex h-full items-center gap-3 px-4">
        <button
          onClick={onOpenSheet}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
            {track.artworkUrl ? (
              <img src={track.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <i className="ri-music-2-line text-[var(--wk-text-faint)]" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{track.title}</div>
            <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{track.artist}</div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {track.provider && (
            <WkTag>{track.provider}</WkTag>
          )}
          <button
            onClick={onTogglePlay}
            disabled={!track.isPlayable}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] disabled:opacity-40"
          >
            <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlayerSheet({ open, onClose, track, isPlaying, onTogglePlay }: PlayerSheetProps) {
  if (!track) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Now playing">
      <div className="space-y-6">
        <div className="aspect-square w-full overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <i className="ri-music-2-line text-5xl text-[var(--wk-text-faint)]" />
            </div>
          )}
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-[var(--wk-text)]">{track.title}</h2>
          <div className="text-[15px] text-[var(--wk-text-muted)]">{track.artist}</div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onTogglePlay}
            disabled={!track.isPlayable}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] disabled:opacity-40"
          >
            <i className={`text-2xl ${isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
          </button>
        </div>

        {track.provider && (
          <div className="flex items-center justify-center gap-2 text-[12px] text-[var(--wk-text-faint)]">
            <span>Playback via</span>
            <WkTag>{track.provider}</WkTag>
          </div>
        )}

        {!track.isPlayable && (
          <div className="rounded-lg border border-[var(--wk-border)] p-3 text-center text-[13px] text-[var(--wk-text-muted)]">
            No preview available for this track.
          </div>
        )}
      </div>
    </Sheet>
  );
}