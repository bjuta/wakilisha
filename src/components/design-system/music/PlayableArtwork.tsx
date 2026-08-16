import type {
  MouseEvent,
  ReactNode,
} from "react";

export interface PlayableArtworkProps {
  children: ReactNode;
  label: string;
  onPlay: (
    event:
      MouseEvent<HTMLButtonElement>,
  ) => void;
  isPlaying?: boolean;
  disabled?: boolean;
  pending?: boolean;
  className?: string;
  iconClassName?: string;
}

export function PlayableArtwork({
  children,
  label,
  onPlay,
  isPlaying = false,
  disabled = false,
  pending = false,
  className = "",
  iconClassName = "h-8 w-8 text-[14px]",
}: PlayableArtworkProps) {
  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled || pending}
      aria-label={
        pending
          ? `Loading ${label}`
          : isPlaying
            ? `Pause ${label}`
            : `Play ${label}`
      }
      className={[
        "group/playable-art relative block shrink-0 overflow-hidden text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wk-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--wk-bg)]",
        "disabled:cursor-default",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}

      {!disabled ? (
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-0 flex items-center justify-center",
            "bg-black/0 transition-colors duration-150",
            "group-hover/playable-art:bg-black/30 group-focus-visible/playable-art:bg-black/30 group-active/playable-art:bg-black/30",
          ].join(" ")}
        >
          <span
            className={[
              "flex items-center justify-center rounded-full bg-black/78 text-white shadow-lg backdrop-blur-sm",
              "scale-90 opacity-0 transition-all duration-150",
              "group-hover/playable-art:scale-100 group-hover/playable-art:opacity-100",
              "group-focus-visible/playable-art:scale-100 group-focus-visible/playable-art:opacity-100",
              "group-active/playable-art:scale-100 group-active/playable-art:opacity-100",
              iconClassName,
            ].join(" ")}
          >
            <i
              className={
                pending
                  ? "ri-loader-4-line animate-spin"
                  : isPlaying
                    ? "ri-pause-fill"
                    : "ri-play-fill"
              }
            />
          </span>
        </span>
      ) : null}
    </button>
  );
}
