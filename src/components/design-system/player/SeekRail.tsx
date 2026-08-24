import {
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type SeekRailVariant =
  | "edge"
  | "inline";

export function SeekRail({
  label,
  currentTime,
  duration,
  progress,
  onSeek,
  variant = "inline",
}: {
  label: string;
  currentTime: number;
  duration: number;
  progress?: number;
  onSeek: (time: number) => void;
  variant?: SeekRailVariant;
}) {
  const draggingRef = useRef(false);
  const safeDuration =
    Number.isFinite(duration) && duration > 0
      ? duration
      : 0;
  const ratio =
    progress !== undefined
      ? Math.max(0, Math.min(1, progress))
      : safeDuration > 0
        ? Math.max(
            0,
            Math.min(1, currentTime / safeDuration),
          )
        : 0;

  const seekFromClientX = (
    clientX: number,
    element: HTMLDivElement,
  ) => {
    if (safeDuration <= 0) return;

    const rect =
      element.getBoundingClientRect();

    if (rect.width <= 0) return;

    const nextRatio = Math.max(
      0,
      Math.min(
        1,
        (clientX - rect.left) / rect.width,
      ),
    );

    onSeek(nextRatio * safeDuration);
  };

  const handlePointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    seekFromClientX(
      event.clientX,
      event.currentTarget,
    );
  };

  return (
    <div
      role="slider"
      tabIndex={safeDuration > 0 ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(
        0,
        Math.round(safeDuration),
      )}
      aria-valuenow={Math.max(
        0,
        Math.round(currentTime || 0),
      )}
      className={[
        "group relative w-full cursor-pointer touch-none select-none",
        variant === "edge"
          ? "h-2"
          : "h-5",
      ].join(" ")}
      onPointerDown={(event) => {
        if (safeDuration <= 0) return;
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(
          event.pointerId,
        );
        handlePointer(event);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        handlePointer(event);
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return;
        handlePointer(event);
        draggingRef.current = false;

        if (
          event.currentTarget.hasPointerCapture(
            event.pointerId,
          )
        ) {
          event.currentTarget.releasePointerCapture(
            event.pointerId,
          );
        }
      }}
      onPointerCancel={(event) => {
        draggingRef.current = false;

        if (
          event.currentTarget.hasPointerCapture(
            event.pointerId,
          )
        ) {
          event.currentTarget.releasePointerCapture(
            event.pointerId,
          );
        }
      }}
      onKeyDown={(event) => {
        if (safeDuration <= 0) return;

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onSeek(
            Math.max(0, currentTime - 5),
          );
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          onSeek(
            Math.min(
              safeDuration,
              currentTime + 5,
            ),
          );
        }

        if (event.key === "Home") {
          event.preventDefault();
          onSeek(0);
        }

        if (event.key === "End") {
          event.preventDefault();
          onSeek(safeDuration);
        }
      }}
    >
      <div
        className={[
          "absolute inset-x-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]",
          variant === "edge"
            ? "top-0 h-0.5 rounded-none"
            : "top-2 h-1",
        ].join(" ")}
      >
        <div
          className="h-full rounded-full bg-[var(--wk-brand)]"
          style={{
            width: `${ratio * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
