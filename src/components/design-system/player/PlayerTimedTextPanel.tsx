import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { formatPlayerClock } from "@/services/player/playerExperience";

export interface PlayerTimedTextLine {
  id: string;
  text: string;
  startSeconds: number | null;
}

export function PlayerTimedTextPanel({
  variant,
  lines,
  currentTime,
  loading,
  error,
  emptyMessage,
  emptyAction,
  footer,
  onSeek,
  sourceUrl,
}: {
  variant: "lyrics" | "transcript";
  lines: PlayerTimedTextLine[];
  currentTime: number;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  emptyAction?: ReactNode;
  footer?: ReactNode;
  onSeek: (time: number) => void;
  sourceUrl?: string | null;
}) {
  const activeIndex = useMemo(() => {
    let match = -1;

    for (let index = 0; index < lines.length; index += 1) {
      const start = lines[index]?.startSeconds;
      if (start === null || start === undefined) continue;
      if (start <= currentTime + 0.2) match = index;
      else break;
    }

    return match;
  }, [currentTime, lines]);

  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeIndex < 0) return;
    activeRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeIndex]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--wk-text-muted)]">
        {variant === "lyrics"
          ? "Loading published Lyrics…"
          : "Loading Transcript…"}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm leading-6 text-[var(--wk-text-muted)]">
        {error}
      </p>
    );
  }

  if (!lines.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-[var(--wk-text-muted)]">
          {emptyMessage}
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div>
      {sourceUrl ? (
        <div className="mb-4 flex justify-end">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-black text-[var(--wk-brand)]"
          >
            Open Source
          </a>
        </div>
      ) : null}

      <div className="space-y-1">
        {lines.map((line, index) => {
          const active = index === activeIndex;
          const timed = line.startSeconds !== null;

          return (
            <button
              key={line.id}
              ref={active ? activeRef : null}
              type="button"
              disabled={!timed}
              onClick={() => {
                if (line.startSeconds !== null) {
                  onSeek(line.startSeconds);
                }
              }}
              className={[
                "flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left transition-all disabled:cursor-default",
                active
                  ? "bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                  : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)] hover:text-[var(--wk-text)] disabled:hover:bg-transparent",
              ].join(" ")}
            >
              {timed ? (
                <span className="w-12 shrink-0 pt-1 font-mono text-[10px] font-bold text-[var(--wk-brand)]">
                  {formatPlayerClock(line.startSeconds ?? 0)}
                </span>
              ) : null}
              <span
                className={[
                  "min-w-0 flex-1",
                  variant === "lyrics"
                    ? "text-[18px] font-black leading-7 tracking-[-0.02em]"
                    : "text-[13px] leading-6",
                ].join(" ")}
              >
                {line.text}
              </span>
            </button>
          );
        })}
      </div>

      {footer ? (
        <div className="mt-5 border-t border-[var(--wk-border)] pt-4 text-[11px] leading-5 text-[var(--wk-text-faint)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
