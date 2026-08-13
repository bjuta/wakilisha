import { useMemo } from "react";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import type { ChartEntryRowViewModel } from "@/services/chartsPublic/viewModels";

interface ChartHighlightsProps {
  entries: ChartEntryRowViewModel[];
  onJumpTo: (slug: string) => void;
}

const RANK_COLOR: Record<number, string> = {
  1: "#C9A96E",
  2: "#A8A8A8",
  3: "#B87333",
};

// ─── Fresh Arrivals card ──────────────────────────────────────────────────────

function FreshCard({
  entry,
  onJump,
}: {
  entry: ChartEntryRowViewModel;
  onJump: (s: string) => void;
}) {
  const isReEntry = entry.movement === "re_entry";

  return (
    <button
      onClick={() => onJump(entry.slug)}
      className="group relative flex h-[220px] w-[155px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:scale-[1.03]"
    >
      {/* Artwork */}
      <div className="absolute inset-0">
        {entry.artworkUrl ? (
          <img
            src={entry.artworkUrl}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <Ch19GradientImage slug={entry.slug} name={entry.title} />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Badge */}
      <div className="relative flex-1 p-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
            isReEntry
              ? "bg-white/15 text-white backdrop-blur-sm"
              : "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
          }`}
        >
          {isReEntry ? (
            <><i className="ri-refresh-line text-[9px]" /> Returns</>
          ) : (
            <><i className="ri-star-smile-line text-[9px]" /> New</>
          )}
        </span>
      </div>

      {/* Bottom info */}
      <div className="relative px-3 pb-3.5">
        <div
          className="mb-1 text-[11px] font-black leading-none"
          style={{ color: RANK_COLOR[entry.rank] ?? "rgba(255,255,255,0.55)" }}
        >
          #{entry.rank}
        </div>
        <div className="text-[13px] font-black leading-snug text-white line-clamp-2">
          {entry.title}
        </div>
        <div className="mt-1 truncate text-[11px] text-white/60">{entry.artist}</div>
      </div>

      {/* Hover reveal */}
      <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center py-3 transition-transform duration-200 group-hover:translate-y-0">
        <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1.5 text-[10px] font-bold text-[var(--wk-brand-on)]">
          Jump to track
        </span>
      </div>
    </button>
  );
}

// ─── Built to Last card ───────────────────────────────────────────────────────

function EnduranceCard({
  entry,
  maxWeeks,
  onJump,
}: {
  entry: ChartEntryRowViewModel;
  maxWeeks: number;
  onJump: (s: string) => void;
}) {
  const isAtPeak = entry.rank === entry.peakPosition;
  const longevityPct = Math.round((entry.weeksOnChart / maxWeeks) * 100);
  const rankColor = RANK_COLOR[entry.rank] ?? "var(--wk-text-muted)";

  return (
    <button
      onClick={() => onJump(entry.slug)}
      className="group relative flex cursor-pointer overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-200 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)]"
    >
      {/* Longevity fill — faint tinted background bar */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-l-2xl transition-all duration-700"
        style={{
          width: `${longevityPct}%`,
          background: "oklch(var(--primary-500) / 0.055)",
        }}
      />

      {/* Artwork — square left panel */}
      <div className="relative h-[100px] w-[100px] shrink-0 overflow-hidden">
        {entry.artworkUrl ? (
          <img
            src={entry.artworkUrl}
            alt=""
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Ch19GradientImage slug={entry.slug} name={entry.title} />
        )}
        {/* Rank pill */}
        <div
          className="absolute bottom-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-black leading-none"
          style={{
            backgroundColor: rankColor === "var(--wk-text-muted)" ? "rgba(0,0,0,0.7)" : rankColor,
            color: entry.rank <= 3 ? "#0a0a0a" : "#fff",
          }}
        >
          #{entry.rank}
        </div>
      </div>

      {/* Track info */}
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3">
        <div className="truncate text-[14px] font-black text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
          {entry.title}
        </div>
        <div className="truncate text-[12px] text-[var(--wk-text-muted)]">
          {entry.artist}
        </div>
        {isAtPeak && (
          <div
            className="mt-1 flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "#C9A96E22", color: "#C9A96E" }}
          >
            <i className="ri-vip-crown-line text-[9px]" />
            Peak position
          </div>
        )}
      </div>

      {/* Weeks — the hero stat */}
      <div className="relative flex shrink-0 flex-col items-center justify-center px-5 py-3">
        <span
          className="text-[42px] font-black leading-none tabular-nums"
          style={{ color: "var(--wk-brand)" }}
        >
          {entry.weeksOnChart}
        </span>
        <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
          wks
        </span>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChartHighlights({ entries, onJumpTo }: ChartHighlightsProps) {
  const freshArrivals = useMemo(
    () =>
      entries
        .filter((e) => e.movement === "new" || e.movement === "re_entry")
        .slice(0, 20),
    [entries]
  );

  const longRunning = useMemo(
    () =>
      [...entries]
        .filter((e) => (e.weeksOnChart ?? 0) >= 2)
        .sort((a, b) => (b.weeksOnChart ?? 0) - (a.weeksOnChart ?? 0))
        .slice(0, 10),
    [entries]
  );

  const maxWeeks = longRunning[0]?.weeksOnChart ?? 1;

  return (
    <>
      {/* ── Fresh Arrivals ────────────────────────────────────────────── */}
      {freshArrivals.length > 0 && (
        <section className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <div className="wk-eyebrow mb-2">Fresh arrivals</div>
              <h2 className="wk-h-section leading-none">New in the Latest Editions</h2>
              <p className="mt-2 max-w-[480px] text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                Songs landing in the latest chart editions for the first time. Debuts and
                returns that moved fast enough to break in.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-brand-on)]"
                style={{ backgroundColor: "var(--wk-brand)" }}
              >
                <i className="ri-star-smile-line text-[14px]" />
              </span>
              <span className="tabular-nums text-[13px] font-black text-[var(--wk-brand)]">
                {freshArrivals.length}
              </span>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 md:-mx-6 md:px-6">
            {freshArrivals.map((entry) => (
              <FreshCard key={entry.slug} entry={entry} onJump={onJumpTo} />
            ))}
          </div>
        </section>
      )}

      {/* ── Built to Last ─────────────────────────────────────────────── */}
      {longRunning.length > 0 && (
        <section className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <div className="wk-eyebrow mb-2">Built to last</div>
              <h2 className="wk-h-section leading-none">Long-running tracks</h2>
              <p className="mt-2 max-w-[480px] text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                These tracks refuse to leave. Every chart appearance is a
                statement, and they're making theirs loud.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#0a0a0a] text-[13px] font-black"
                style={{ backgroundColor: "#C9A96E" }}
              >
                <i className="ri-time-line" />
              </span>
              <span
                className="tabular-nums text-[13px] font-black"
                style={{ color: "#C9A96E" }}
              >
                {longRunning.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {longRunning.map((entry) => (
              <EnduranceCard
                key={entry.slug}
                entry={entry}
                maxWeeks={maxWeeks}
                onJump={onJumpTo}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}