import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePlayer } from "@/context/PlayerContext";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

interface ChartEntry {
  rank: number;
  title: string;
  artist: string;
  movement?: "up" | "down" | "new" | "same";
  movementAmount?: number;
  weeksOnChart?: number;
  peakPosition?: number;
  isPlayable?: boolean;
  slug?: string;
  editionDate?: string;
  artworkUrl?: string;
}

interface TrackChartSummary {
  title: string;
  artist: string;
  slug: string;
  peakPosition: number;
  weeksOnChart: number;
  entryCount: number;
  debutDate: string;
  latestRank: number;
  latestMovement: "up" | "down" | "new" | "same";
  latestMovementAmount: number;
  artworkUrl?: string;
  entries: ChartEntry[];
}

interface EnrichedEntry extends ChartEntry {
  previousRank: number | null;
  positionDelta: number;
  isDebut: boolean;
  isReEntry: boolean;
  isPeak: boolean;
  isRecordPeak: boolean;
  isCurrent: boolean;
}

function Movement({ movement, amount }: { movement: ChartEntry["movement"]; amount?: number }) {
  if (movement === "up") {
    return (
      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-success)]">
        <i className="ri-arrow-up-line" />
        {amount}
      </span>
    );
  }
  if (movement === "down") {
    return (
      <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-danger)]">
        <i className="ri-arrow-down-line" />
        {amount}
      </span>
    );
  }
  if (movement === "new") {
    return (
      <span className="rounded bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--wk-brand)]">
        NEW
      </span>
    );
  }
  return (
    <span className="text-[12px] font-bold text-[var(--wk-text-faint)]">—</span>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function enrichEntries(entries: ChartEntry[]): EnrichedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const da = a.editionDate ? new Date(a.editionDate).getTime() : 0;
    const db = b.editionDate ? new Date(b.editionDate).getTime() : 0;
    return da - db;
  });

  const peakRank = Math.min(...entries.map((e) => e.peakPosition || e.rank));
  let bestSoFar = Infinity;

  return sorted.map((entry, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const prevRank = prev ? prev.rank : null;
    const delta = prevRank !== null ? prevRank - entry.rank : 0;
    const isDebut = idx === 0;
    const isReEntry = entry.movement === "new" && !isDebut;
    const isPeak = entry.rank === peakRank;
    const isRecordPeak = entry.rank < bestSoFar;
    if (isRecordPeak) bestSoFar = entry.rank;
    const isCurrent = idx === sorted.length - 1;

    return {
      ...entry,
      previousRank: prevRank,
      positionDelta: delta,
      isDebut,
      isReEntry,
      isPeak,
      isRecordPeak,
      isCurrent,
    };
  });
}

function getStoryText(entry: EnrichedEntry): string {
  if (entry.isDebut) {
    return `Debut at #${entry.rank}`;
  }
  if (entry.isReEntry) {
    return `Re-entered at #${entry.rank}`;
  }
  if (entry.isRecordPeak && entry.positionDelta > 0) {
    return `New peak at #${entry.rank} (+${entry.positionDelta})`;
  }
  if (entry.isRecordPeak) {
    return `New peak at #${entry.rank}`;
  }
  if (entry.isPeak && entry.positionDelta > 0) {
    return `Peak at #${entry.rank} (+${entry.positionDelta})`;
  }
  if (entry.isPeak) {
    return `Peak at #${entry.rank}`;
  }
  if (entry.positionDelta > 0) {
    return `Climbed ${entry.positionDelta} to #${entry.rank}`;
  }
  if (entry.positionDelta < 0) {
    return `Slipped ${Math.abs(entry.positionDelta)} to #${entry.rank}`;
  }
  return `Held at #${entry.rank}`;
}

function WeeklyTimeline({ entries }: { entries: ChartEntry[] }) {
  const enriched = enrichEntries(entries);

  return (
    <div className="relative">
      {/* Vertical timeline line — runs through the dot column */}
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--wk-border)]" />

      <div className="space-y-3">
        {enriched.map((entry, idx) => {
          const isNew = entry.isDebut || entry.isReEntry;
          const isPeak = entry.isPeak;
          const isRecordPeak = entry.isRecordPeak;
          const isCurrent = entry.isCurrent;

          return (
            <div key={idx} className="flex items-start gap-3">
              {/* Dot column — narrow, aligned with the timeline line */}
              <div className="relative z-10 flex h-8 w-10 shrink-0 items-center justify-center">
                <div className={`h-2.5 w-2.5 rounded-full border-2 ${
                  isNew ? "bg-[var(--wk-brand)] border-[var(--wk-brand)]" :
                  isRecordPeak ? "bg-amber-400 border-amber-400" :
                  isPeak ? "bg-amber-300 border-amber-300" :
                  isCurrent ? "bg-[var(--wk-surface)] border-[var(--wk-brand)]" :
                  "bg-[var(--wk-surface)] border-[var(--wk-border)]"
                }`} />
              </div>

              {/* Entry card — flex-1 so it fills the remaining width naturally */}
              <div className="flex-1 min-w-0 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 transition-colors hover:bg-[var(--wk-surface)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank badge */}
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${
                      entry.rank <= 3 ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" :
                      entry.rank <= 10 ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
                      "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                    }`}>
                      {entry.rank}
                    </span>
                    <div className="min-w-0">
                      {/* Date + movement */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-[var(--wk-text)]">
                          {entry.editionDate ? formatShortDate(entry.editionDate) : `Week ${idx + 1}`}
                        </span>
                        <Movement movement={entry.movement} amount={entry.movementAmount} />
                      </div>
                      {/* Story line — the actual chronological narrative */}
                      <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">
                        <span className="text-[var(--wk-brand)] font-semibold">
                          {getStoryText(entry)}
                        </span>
                        {entry.weeksOnChart ? (
                          <span>
                            {" · "}{entry.weeksOnChart} week{entry.weeksOnChart !== 1 ? "s" : ""} on chart
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrackChartRow({
  track,
  isExpanded,
  onToggle,
}: {
  track: TrackChartSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const trackSlug = track.slug || track.title.toLowerCase().replace(/\s+/g, "-");
  const trackId = trackSlug;
  const isCurrentTrack = currentTrack?.id === trackId;
  const playable = true;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack(
      { id: trackId, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: playable },
      [],
    );
  };

  return (
    <div className="group border-b border-[var(--wk-divider)] last:border-b-0">
      {/* Main row */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 px-4 py-4 md:px-5 md:py-4 select-none transition-colors hover:bg-[var(--wk-surface-raised)]/60"
      >
        {/* Peak position — big visual anchor */}
        <div className="flex flex-col items-center justify-center w-[52px] md:w-[60px] shrink-0">
          <span className={`text-[28px] md:text-[32px] font-black leading-none ${
            track.peakPosition === 1 ? "text-amber-500" :
            track.peakPosition <= 3 ? "text-[var(--wk-brand)]" :
            track.peakPosition <= 10 ? "text-[var(--wk-text)]" :
            "text-[var(--wk-text-muted)]"
          }`}>
            #{track.peakPosition}
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mt-1">
            Peak
          </span>
        </div>

        {/* Artwork */}
        <div className="relative h-12 w-12 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <Ch19GradientImage slug={trackSlug} name={track.title} />
          )}
          {playable && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
            >
              <i className={`text-white text-lg ${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-fill"}`} />
            </button>
          )}
        </div>

        {/* Song info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {trackSlug ? (
              <Link
                to={`/tracks/${trackSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate text-[14px] md:text-[15px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors"
              >
                {track.title}
              </Link>
            ) : (
              <span className="truncate text-[14px] md:text-[15px] font-bold text-[var(--wk-text)]">{track.title}</span>
            )}
            {track.peakPosition === 1 && (
              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-amber-700 border border-amber-200">
                <i className="ri-vip-crown-line text-[9px]" />
                #1
              </span>
            )}
            {track.peakPosition !== 1 && track.peakPosition <= 3 && (
              <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[var(--wk-brand)]">
                Top 3
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--wk-text-muted)]">
            <span>{track.artist}</span>
            <span className="text-[var(--wk-divider)]">·</span>
            <span>{track.weeksOnChart} wk{track.weeksOnChart !== 1 ? "s" : ""}</span>
            <span className="text-[var(--wk-divider)]">·</span>
            <span>Debut {formatDate(track.debutDate)}</span>
          </div>
        </div>

        {/* Latest + movement */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-[var(--wk-text)]">
                #{track.latestRank}
              </span>
              {track.latestMovement === "up" && (
                <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--wk-success)]">
                  <i className="ri-arrow-up-line text-[11px]" />{track.latestMovementAmount || ""}
                </span>
              )}
              {track.latestMovement === "down" && (
                <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--wk-danger)]">
                  <i className="ri-arrow-down-line text-[11px]" />{track.latestMovementAmount || ""}
                </span>
              )}
              {track.latestMovement === "new" && (
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--wk-brand)]">
                  NEW
                </span>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
              Latest
            </span>
          </div>
        </div>

        {/* Expand chevron */}
        <div
          className={`hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-faint)] transition-all duration-200 ${
            isExpanded ? "rotate-180 bg-[var(--wk-surface)] text-[var(--wk-text)]" : "hover:text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)]"
          }`}
        >
          <i className="ri-arrow-down-s-line text-[16px]" />
        </div>
      </div>

      {/* Expanded weekly timeline */}
      {isExpanded && (
        <div className="px-4 md:px-5 pb-4 animate-in slide-in-from-top-2 duration-200">
          <div className="mb-3">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">
              Weekly Journey — {track.entryCount} entries
            </div>
          </div>
          <WeeklyTimeline entries={track.entries} />
        </div>
      )}
    </div>
  );
}

export function ArtistChartSection({ entries }: { entries: ChartEntry[] }) {
  const { ref: ref1, revealed: r1 } = useScrollReveal<HTMLElement>(0.1);
  const { ref: ref2, revealed: r2 } = useScrollReveal<HTMLElement>(0.1);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());

  // Group entries by track title
  const trackSummaries = useMemo(() => {
    const groups = new Map<string, ChartEntry[]>();

    for (const entry of entries) {
      const key = entry.title || "Unknown";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    const summaries: TrackChartSummary[] = [];
    for (const [title, trackEntries] of groups) {
      const sortedByDate = [...trackEntries].sort((a, b) => {
        const da = a.editionDate ? new Date(a.editionDate).getTime() : 0;
        const db = b.editionDate ? new Date(b.editionDate).getTime() : 0;
        return da - db;
      });

      const latest = sortedByDate[sortedByDate.length - 1];
      const peakPosition = Math.min(...trackEntries.map((e) => e.peakPosition || e.rank));
      const weeksOnChart = Math.max(...trackEntries.map((e) => e.weeksOnChart || 0));

      // Pick artwork: prefer the most recent entry's artwork, fallback to any
      const artworkUrl = latest?.artworkUrl || trackEntries.find((e) => e.artworkUrl)?.artworkUrl;

      summaries.push({
        title,
        artist: trackEntries[0].artist || "",
        slug: trackEntries[0].slug || "",
        peakPosition,
        weeksOnChart,
        entryCount: trackEntries.length,
        debutDate: sortedByDate[0]?.editionDate || "",
        latestRank: latest?.rank || 0,
        latestMovement: latest?.movement || "same",
        latestMovementAmount: latest?.movementAmount || 0,
        artworkUrl,
        entries: trackEntries,
      });
    }

    // Sort by peak position (best first), then by weeks on chart
    return summaries.sort((a, b) => {
      if (a.peakPosition !== b.peakPosition) {
        return a.peakPosition - b.peakPosition;
      }
      return b.weeksOnChart - a.weeksOnChart;
    });
  }, [entries]);

  const overallPeak = trackSummaries.length > 0 ? Math.min(...trackSummaries.map((t) => t.peakPosition)) : 0;
  const totalWeeks = trackSummaries.reduce((sum, t) => sum + t.weeksOnChart, 0);
  const uniqueSongs = trackSummaries.length;

  const toggleTrack = (title: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  return (
    <div>
      {/* Chart Highlights */}
      <section ref={ref1} className={`${r1 ? "is-visible" : ""} reveal-up mb-8`}>
        <div className="mb-6">
          <div className="wk-eyebrow mb-2">Chart Performance</div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Chart Journey
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center">
            <div className={`text-[36px] font-black leading-[1] md:text-[44px] ${
              overallPeak === 1 ? "text-amber-500" : "text-[var(--wk-brand)]"
            }`}>
              #{overallPeak || "—"}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
              Overall Peak
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center">
            <div className="text-[36px] font-black leading-[1] text-[var(--wk-text)] md:text-[44px]">
              {uniqueSongs}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
              Charting Songs
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center">
            <div className="text-[36px] font-black leading-[1] text-[var(--wk-text)] md:text-[44px]">
              {totalWeeks}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
              Total Weeks
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center">
            <div className="text-[36px] font-black leading-[1] text-[var(--wk-text)] md:text-[44px]">
              {trackSummaries[0]?.latestRank || "—"}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">
              Latest Entry
            </div>
          </div>
        </div>
      </section>

      {/* Chart Honors List */}
      <section ref={ref2} className={`${r2 ? "is-visible" : ""} reveal-up`}>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 md:px-5 border-b border-[var(--wk-divider)]">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">
              {uniqueSongs} unique song{uniqueSongs !== 1 ? "s" : ""} on the chart
            </span>
          </div>

          {/* Track rows */}
          <div>
            {trackSummaries.map((track) => (
              <TrackChartRow
                key={track.title}
                track={track}
                isExpanded={expandedTracks.has(track.title)}
                onToggle={() => toggleTrack(track.title)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}