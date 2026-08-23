import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import type {
  PlayerTrack,
  RepeatMode,
} from "@/context/PlayerContext";

function QueueArtwork({
  item,
  size,
}: {
  item: PlayerTrack;
  size: "large" | "small";
}) {
  const className =
    size === "large"
      ? "h-16 w-16 rounded-2xl"
      : "h-11 w-11 rounded-xl";

  return (
    <div
      className={`shrink-0 overflow-hidden bg-[var(--wk-surface-raised)] ${className}`}
    >
      {item.artworkUrl ? (
        <img
          src={item.artworkUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <Ch19GradientImage
          slug={item.id}
          name={item.title}
        />
      )}
    </div>
  );
}

export function PlayerQueuePanel({
  queue,
  queueIndex,
  queueOrder,
  isShuffle,
  repeatMode,
  isPlaying,
  onPlay,
  onMove,
  onRemove,
  onClearUpcoming,
  onToggleShuffle,
  onToggleRepeat,
  showMusicControls,
}: {
  queue: PlayerTrack[];
  queueIndex: number;
  queueOrder: number[];
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  onClearUpcoming: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  showMusicControls: boolean;
}) {
  const [rowMenuIndex, setRowMenuIndex] =
    useState<number | null>(null);

  const current = queue[queueIndex] ?? null;
  const currentOrderPosition = queueOrder.indexOf(queueIndex);
  const safeCurrentPosition =
    currentOrderPosition >= 0
      ? currentOrderPosition
      : 0;
  const historyIndices = queueOrder.slice(0, safeCurrentPosition);
  const upNextIndices = queueOrder.slice(safeCurrentPosition + 1);

  if (!current) {
    return (
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 text-sm text-[var(--wk-text-muted)]">
        Nothing is queued right now.
      </div>
    );
  }

  return (
    <div>
      {showMusicControls ? (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={[
              "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[12px] font-black transition-colors",
              isShuffle
                ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)]",
            ].join(" ")}
          >
            <WkIcon name="Shuffle" size={16} />
            Shuffle
          </button>
          <button
            type="button"
            onClick={onToggleRepeat}
            className={[
              "flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[12px] font-black transition-colors",
              repeatMode !== "off"
                ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)]",
            ].join(" ")}
          >
            <WkIcon
              name={repeatMode === "one" ? "Repeat1" : "Repeat2"}
              size={16}
            />
            {repeatMode === "one" ? "Repeat One" : "Repeat"}
          </button>
        </div>
      ) : null}

      <section>
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--wk-text-faint)]">
          Now Playing
        </div>
        <button
          type="button"
          onClick={() => onPlay(queueIndex)}
          className="flex w-full items-center gap-3 rounded-[22px] bg-[var(--wk-brand-soft)] p-3 text-left"
        >
          <QueueArtwork item={current} size="large" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[15px] font-black text-[var(--wk-text)]">
                {current.title}
              </span>
              {isPlaying ? (
                <WkIcon
                  name="AudioLines"
                  size={15}
                  className="shrink-0 text-[var(--wk-brand)]"
                />
              ) : null}
            </span>
            <span className="mt-1 block truncate text-[12px] font-semibold text-[var(--wk-text-muted)]">
              {current.artist}
            </span>
          </span>
        </button>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--wk-text-faint)]">
              Up Next
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
              {upNextIndices.length === 1
                ? "1 item"
                : `${upNextIndices.length} items`}
            </div>
          </div>
          {upNextIndices.length ? (
            <button
              type="button"
              onClick={onClearUpcoming}
              className="rounded-full px-3 py-1.5 text-[11px] font-black text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]"
            >
              Clear Up Next
            </button>
          ) : null}
        </div>

        {isShuffle && upNextIndices.length > 1 ? (
          <div className="mb-3 rounded-2xl bg-[var(--wk-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--wk-text-muted)]">
            Shuffle sets the play order. Turn it off to reorder Up Next.
          </div>
        ) : null}

        {upNextIndices.length ? (
          <div className="space-y-1">
            {upNextIndices.map((index, position) => {
              const item = queue[index];
              if (!item) return null;
              const menuOpen = rowMenuIndex === index;

              return (
                <div
                  key={`${item.id}-${index}`}
                  className="overflow-hidden rounded-2xl border border-transparent hover:border-[var(--wk-border)] hover:bg-[var(--wk-bg)]/65"
                >
                  <div className="flex items-center gap-3 p-2">
                    <button
                      type="button"
                      onClick={() => onPlay(index)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <QueueArtwork item={item} size="small" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black text-[var(--wk-text)]">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
                          {item.artist}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setRowMenuIndex(
                          menuOpen ? null : index,
                        )
                      }
                      aria-label={`Queue Options for ${item.title}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
                    >
                      <WkIcon name="MoreHorizontal" size={17} />
                    </button>
                  </div>

                  {menuOpen ? (
                    <div className="grid grid-cols-3 gap-1 border-t border-[var(--wk-divider)] px-2 py-2">
                      <button
                        type="button"
                        disabled={isShuffle || position === 0}
                        onClick={() => {
                          const target = upNextIndices[position - 1];
                          if (target !== undefined) onMove(index, target);
                          setRowMenuIndex(null);
                        }}
                        className="rounded-xl px-2 py-2 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:opacity-30"
                      >
                        Move Earlier
                      </button>
                      <button
                        type="button"
                        disabled={
                          isShuffle ||
                          position === upNextIndices.length - 1
                        }
                        onClick={() => {
                          const target = upNextIndices[position + 1];
                          if (target !== undefined) onMove(index, target);
                          setRowMenuIndex(null);
                        }}
                        className="rounded-xl px-2 py-2 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:opacity-30"
                      >
                        Move Later
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRemove(index);
                          setRowMenuIndex(null);
                        }}
                        className="rounded-xl px-2 py-2 text-[10px] font-black text-red-500 hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4 text-[12px] leading-5 text-[var(--wk-text-muted)]">
            Nothing else is queued.
          </div>
        )}
      </section>

      {historyIndices.length ? (
        <details className="mt-6 border-t border-[var(--wk-divider)] pt-4">
          <summary className="cursor-pointer text-[11px] font-black text-[var(--wk-text-muted)]">
            Played Earlier ({historyIndices.length})
          </summary>
          <div className="mt-2 space-y-1">
            {historyIndices.map((index) => {
              const item = queue[index];
              if (!item) return null;

              return (
                <button
                  key={`${item.id}-history-${index}`}
                  type="button"
                  onClick={() => onPlay(index)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--wk-bg)]"
                >
                  <QueueArtwork item={item} size="small" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-[var(--wk-text)]">
                      {item.title}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--wk-text-muted)]">
                      {item.artist}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}
