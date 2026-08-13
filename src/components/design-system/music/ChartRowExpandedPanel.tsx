import { useMemo } from "react";
import { Link } from "react-router-dom";
import { trackUrl } from "@/utils/trackUrl";

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
  onDiscuss?: () => void;
}

function formatDuration(secs: number): string {
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function MovementValue({
  movement,
  movementAmount,
}: {
  movement?: "up" | "down" | "same" | "new" | "re_entry";
  movementAmount?: number | null;
}) {
  const amount =
    movementAmount ?? 0;

  if (movement === "up") {
    return (
      <span
        className="flex items-center gap-1 text-[18px] font-black leading-none"
        style={{
          color: "var(--wk-success)",
        }}
      >
        <i className="ri-arrow-up-line text-[14px]" />
        +{amount > 0 ? amount : 0}
      </span>
    );
  }

  if (movement === "down") {
    return (
      <span
        className="flex items-center gap-1 text-[18px] font-black leading-none"
        style={{
          color: "var(--wk-danger)",
        }}
      >
        <i className="ri-arrow-down-line text-[14px]" />
        −{amount > 0 ? amount : 0}
      </span>
    );
  }

  if (movement === "new") {
    return (
      <span className="text-[16px] font-black text-[var(--wk-brand)]">
        New
      </span>
    );
  }

  if (movement === "re_entry") {
    return (
      <span className="text-[16px] font-black text-[var(--wk-brand)]">
        Re-entry
      </span>
    );
  }

  return (
    <span className="text-[16px] font-black text-[var(--wk-text)]">
      No change
    </span>
  );
}

function PerformanceStat({
  label,
  value,
  context,
}: {
  label: string;
  value: React.ReactNode;
  context?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--wk-surface)] px-3 py-3">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
        {label}
      </div>

      <div className="mt-1 text-[20px] font-black leading-none text-[var(--wk-text)]">
        {value}
      </div>

      {context && (
        <div className="mt-1.5 text-[10px] leading-[1.35] text-[var(--wk-text-muted)]">
          {context}
        </div>
      )}
    </div>
  );
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
  previousRank,
  duration,
  genre,
  onDiscuss,
}: ChartRowExpandedPanelProps) {
  const isAtBestPosition =
    peakPosition === rank;

  const artists = useMemo(
    () =>
      artistNames.map(
        (name, index) => ({
          name,
          slug:
            artistSlugs[index]
            ?? null,
        }),
      ),
    [
      artistNames,
      artistSlugs,
    ],
  );

  const previousPosition =
    movement === "new"
      ? "First Week"
      : previousRank
        ? `#${previousRank}`
        : "Not Available";

  return (
    <div className="overflow-hidden">
      <div className="mx-3 mb-3 rounded-xl border border-[var(--wk-divider)] bg-[var(--wk-surface-raised)]/60 px-4 py-4">
        <section>
          <div className="mb-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">
              Chart Performance
            </div>

            <div className="mt-1 text-[11px] leading-[1.45] text-[var(--wk-text-muted)]">
              How this track is moving across published editions.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <PerformanceStat
              label="Current Position"
              value={`#${rank}`}
              context="Where the track sits in this edition."
            />

            <PerformanceStat
              label="Best Position"
              value={`#${peakPosition}`}
              context={
                isAtBestPosition
                  ? "Currently at its highest position on this chart."
                  : "Highest position reached on this chart."
              }
            />

            <PerformanceStat
              label="Weeks On Chart"
              value={`${weeksOnChart}`}
              context={
                weeksOnChart === 1
                  ? "First published edition in this run."
                  : "Published editions in this chart run."
              }
            />

            <PerformanceStat
              label="Movement"
              value={
                <MovementValue
                  movement={movement}
                  movementAmount={movementAmount}
                />
              }
              context="Change from the previous published edition."
            />

            <PerformanceStat
              label="Previous Position"
              value={previousPosition}
              context="The track's position in the prior edition."
            />
          </div>
        </section>

        <section className="mt-4 border-t border-[var(--wk-divider)] pt-4">
          <div className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            Track Details
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {artists.map(
                ({
                  name,
                  slug: artistSlug,
                }) =>
                  artistSlug ? (
                    <Link
                      key={artistSlug}
                      to={`/artists/${artistSlug}`}
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      className="flex items-center gap-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text)] transition-colors hover:border-[var(--wk-brand)]/40 hover:bg-[var(--wk-brand-soft)] hover:text-[var(--wk-brand)]"
                    >
                      {name}
                      <i className="ri-arrow-right-up-line text-[10px]" />
                    </Link>
                  ) : (
                    <span
                      key={name}
                      className="flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)]"
                    >
                      {name}
                    </span>
                  ),
              )}

              {genre && (
                <span className="rounded-full border border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-brand)]">
                  {genre}
                </span>
              )}

              {duration !== undefined
                && duration > 0 && (
                  <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    {formatDuration(duration)}
                  </span>
                )}
            </div>

            {slug && (
              <Link
                to={trackUrl(
                  slug,
                  artistSlugs,
                )}
                onClick={(event) =>
                  event.stopPropagation()
                }
                className="flex items-center gap-1 text-[11px] font-bold text-[var(--wk-brand)] transition-opacity hover:opacity-70"
              >
                View Track
                <i className="ri-arrow-right-line text-[10px]" />
              </Link>
            )}
          </div>
        </section>

        {onDiscuss && (
          <section className="mt-4 border-t border-[var(--wk-divider)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                  Community
                </div>

                <div className="mt-1 text-[11px] leading-[1.45] text-[var(--wk-text-muted)]">
                  Add context, reactions, or perspective to this chart position.
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDiscuss();
                }}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)] px-3.5 py-2 text-[11px] font-black text-[var(--wk-brand)] transition-colors hover:border-[var(--wk-brand)]/45"
              >
                <i className="ri-chat-1-line text-[14px]" />
                Discuss Entry
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
