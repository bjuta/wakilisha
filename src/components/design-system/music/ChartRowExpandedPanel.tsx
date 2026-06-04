import { useMemo } from "react";
import { Link } from "react-router-dom";

export interface ChartRowExpandedPanelProps {
  rank: number;
  slug?: string;
  artistNames: string[];
  artistSlugs?: string[];
  peakPosition: number;
  weeksOnChart: number;
  movement?: "up" | "down" | "same" | "new" | "re_entry";
  movementAmount?: number | null;
  previousRank?: number | null;
  duration?: number;
  genre?: string | null;
  score?: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MovementDelta({
  movement,
  movementAmount,
}: {
  movement?: "up" | "down" | "same" | "new" | "re_entry";
  movementAmount?: number | null;
}) {
  const amt = movementAmount ?? 0;

  switch (movement) {
    case "up":
      return (
        <span
          className="text-[20px] font-black leading-none flex items-center gap-1"
          style={{ color: "var(--wk-success)" }}
        >
          <i className="ri-arrow-up-line text-[15px]" />
          +{amt > 0 ? amt : "—"}
        </span>
      );
    case "down":
      return (
        <span
          className="text-[20px] font-black leading-none flex items-center gap-1"
          style={{ color: "var(--wk-danger)" }}
        >
          <i className="ri-arrow-down-line text-[15px]" />
          −{amt > 0 ? amt : "—"}
        </span>
      );
    case "new":
      return (
        <span
          className="rounded-full px-2.5 py-1 text-[13px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: "var(--wk-brand-soft)",
            color: "var(--wk-brand)",
          }}
        >
          NEW
        </span>
      );
    case "re_entry":
      return (
        <span
          className="rounded-full px-2.5 py-1 text-[13px] font-black uppercase tracking-wider flex items-center gap-1"
          style={{
            backgroundColor: "var(--wk-brand-soft)",
            color: "var(--wk-brand)",
          }}
        >
          <i className="ri-refresh-line text-[12px]" />
          RE
        </span>
      );
    case "same":
      return (
        <span
          className="text-[20px] font-black leading-none"
          style={{ color: "var(--wk-text-faint)" }}
        >
          —
        </span>
      );
    default:
      return null;
  }
}

export function ChartRowExpandedPanel({
  rank,
  slug,
  artistNames,
  artistSlugs = [],
  peakPosition,
  weeksOnChart,
  movement,
  movementAmount,
  duration,
  genre,
}: ChartRowExpandedPanelProps) {
  const isAtPeak = peakPosition === rank;

  const artists = useMemo(
    () =>
      artistNames.map((name, i) => ({
        name,
        slug: artistSlugs[i] ?? null,
      })),
    [artistNames, artistSlugs]
  );

  return (
    <div className="overflow-hidden">
      <div className="mx-3 mb-3 rounded-xl border border-[var(--wk-divider)] bg-[var(--wk-surface-raised)]/60 px-4 py-3.5">

        {/* Stat strip */}
        <div className="mb-3.5 flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-[var(--wk-divider)] pb-3.5">
          {/* Peak */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
              Peak
            </span>
            <span
              className="text-[20px] font-black leading-none"
              style={{ color: isAtPeak ? "#C9A96E" : "var(--wk-text)" }}
            >
              #{peakPosition}
              {isAtPeak && (
                <i className="ri-vip-crown-line ml-1 text-[13px]" style={{ color: "#C9A96E" }} />
              )}
            </span>
          </div>

          <div className="h-7 w-px self-end mb-0.5 bg-[var(--wk-divider)]" />

          {/* Weeks on chart */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
              On chart
            </span>
            <span className="text-[20px] font-black leading-none text-[var(--wk-text)]">
              {weeksOnChart}
              <span className="ml-0.5 text-[12px] font-bold text-[var(--wk-text-muted)]">wk</span>
            </span>
          </div>

          {/* Movement delta */}
          {movement && movement !== "same" ? (
            <>
              <div className="h-7 w-px self-end mb-0.5 bg-[var(--wk-divider)]" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
                  Move
                </span>
                <MovementDelta movement={movement} movementAmount={movementAmount} />
              </div>
            </>
          ) : movement === "same" ? (
            <>
              <div className="h-7 w-px self-end mb-0.5 bg-[var(--wk-divider)]" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
                  Move
                </span>
                <MovementDelta movement="same" movementAmount={movementAmount} />
              </div>
            </>
          ) : null}

          {/* Duration */}
          {duration !== undefined && duration > 0 && (
            <>
              <div className="h-7 w-px self-end mb-0.5 bg-[var(--wk-divider)]" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">
                  Length
                </span>
                <span className="text-[20px] font-black leading-none text-[var(--wk-text)]">
                  {formatDuration(duration)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Bottom row: artist chips + genre + track link */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {artists.map(({ name, slug: artistSlug }) =>
              artistSlug ? (
                <Link
                  key={artistSlug}
                  to={`/artists/${artistSlug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text)] transition-colors hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-brand-soft)] hover:text-[var(--wk-brand)] cursor-pointer whitespace-nowrap"
                >
                  {name}
                  <i className="ri-arrow-right-up-line text-[10px]" />
                </Link>
              ) : (
                <span
                  key={name}
                  className="flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] whitespace-nowrap"
                >
                  {name}
                </span>
              )
            )}
            {genre && (
              <span className="rounded-full border border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-brand)] whitespace-nowrap">
                {genre}
              </span>
            )}
          </div>

          {slug && (
            <Link
              to={`/tracks/${slug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] font-bold text-[var(--wk-brand)] transition-opacity hover:opacity-70 cursor-pointer whitespace-nowrap"
            >
              View track
              <i className="ri-arrow-right-line text-[10px]" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}