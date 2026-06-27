import { useState } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { usePlayer, type PlaySource } from "@/context/PlayerContext";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { ChartRowExpandedPanel } from "@/components/design-system/music/ChartRowExpandedPanel";
import { trackUrl } from "@/utils/trackUrl";

export interface ChartRowProps {
  rank: number;
  artworkUrl?: string;
  title: string;
  artist: string;
  artistNames?: string[];
  artistSlugs?: string[];
  movement?: "up" | "down" | "new" | "same" | "re_entry";
  movementAmount?: number;
  previousRank?: number | null;
  weeksOnChart?: number;
  peakPosition?: number;
  isPlayable?: boolean;
  source?: string;
  onPlay?: () => void;
  isPlaying?: boolean;
  genre?: string;
  label?: string;
  previousWeek?: number;
  slug?: string;
  artistSlug?: string;
  score?: number;
  duration?: number;
  compact?: boolean;
  previewUrl?: string;
  playSource?: PlaySource;
}


const RANK_COLORS: Record<number, string> = {
  1: "#C9A96E",
  2: "#A8A8A8",
  3: "#B87333",
};

export function ChartRow({
  rank,
  artworkUrl,
  title,
  artist,
  artistNames,
  artistSlugs,
  movement,
  movementAmount,
  previousRank,
  weeksOnChart,
  peakPosition,
  isPlayable,
  source,
  onPlay,
  genre,
  label,
  previousWeek,
  slug,
  score,
  duration,
  compact,
  previewUrl,
  playSource,
}: ChartRowProps) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const [isExpanded, setIsExpanded] = useState(false);

  const trackId = slug || `${title}-${artist}`.toLowerCase().replace(/\s+/g, "-");
  const isCurrentTrack = currentTrack?.id === trackId;
  const isTop3 = rank <= 3;
  // Derive isPlayable from whether we have a previewUrl
  const resolvedPlayable = isPlayable ?? (!!previewUrl);
  const playable = resolvedPlayable !== false;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playable) return;
    if (onPlay) { onPlay(); return; }
    const track = { id: trackId, title, artist, artworkUrl, isPlayable: playable, source, previewUrl };
    playTrack(track, [track], playSource);
  };

  const toggleExpand = () => {
    if (!compact) setIsExpanded((v) => !v);
  };

  // Resolve artist names array from the artist string if not provided explicitly
  const resolvedArtistNames = artistNames ?? artist.split(", ");
  const resolvedArtistSlugs = artistSlugs ?? [];
  const resolvedArtistLinks = resolvedArtistNames
    .map((name, index) => ({
      name: name.trim(),
      slug: resolvedArtistSlugs[index]?.trim() || "",
    }))
    .filter((item) => item.name);

  // ─── Compact variant — no expansion ───
  if (compact) {
    return (
      <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--wk-surface-raised)]">
        <div className="flex w-6 shrink-0 flex-col items-center">
          <span
            className="text-sm font-black leading-none"
            style={{ color: RANK_COLORS[rank] || "var(--wk-text-muted)" }}
          >
            {rank}
          </span>
        </div>
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <Ch19GradientImage slug={slug || trackId} name={title} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{title}</div>
          <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{artist}</div>
        </div>
        {movement === "up" && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: "var(--wk-success)" }}>
            <i className="ri-arrow-up-line text-[10px]" />+{movementAmount && movementAmount > 0 ? movementAmount : ""}
          </span>
        )}
        {movement === "down" && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: "var(--wk-danger)" }}>
            <i className="ri-arrow-down-line text-[10px]" />−{movementAmount && movementAmount > 0 ? movementAmount : ""}
          </span>
        )}
        {movement === "new" && (
          <span className="rounded-full px-1 py-px text-[8px] font-black uppercase" style={{ backgroundColor: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>N</span>
        )}
      </div>
    );
  }

  // ─── Full variant with expansion ───
  return (
    <div
      className={`group rounded-xl transition-all duration-200 ${isTop3 ? "bg-[var(--wk-surface-raised)]/50" : ""} ${isExpanded ? "bg-[var(--wk-surface-raised)]" : "hover:bg-[var(--wk-surface-raised)]"}`}
    >
      {/* Row */}
      <div
        onClick={toggleExpand}
        className="flex cursor-pointer items-center gap-3 px-3 py-3 select-none"
      >
        {/* Rank */}
        <div className="flex w-12 shrink-0 flex-col items-center">
          <span
            className="text-[22px] font-black leading-none"
            style={{ color: RANK_COLORS[rank] || "var(--wk-text-muted)" }}
          >
            {rank}
          </span>
          {movement === "up" && (
            <span className="mt-0.5 flex items-center gap-0.5 text-[11px] font-bold" style={{ color: "var(--wk-success)" }}>
              <i className="ri-arrow-up-line text-[11px]" />
              +{movementAmount && movementAmount > 0 ? movementAmount : ""}
            </span>
          )}
          {movement === "down" && (
            <span className="mt-0.5 flex items-center gap-0.5 text-[11px] font-bold" style={{ color: "var(--wk-danger)" }}>
              <i className="ri-arrow-down-line text-[11px]" />
              −{movementAmount && movementAmount > 0 ? movementAmount : ""}
            </span>
          )}
          {movement === "new" && (
            <span className="mt-0.5 rounded-full px-1 py-px text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>NEW</span>
          )}
          {movement === "re_entry" && (
            <span className="mt-0.5 rounded-full px-1 py-px text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>RE</span>
          )}
          {movement === "same" && (
            <span className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--wk-text-faint)" }}>,</span>
          )}
        </div>

        {/* Artwork */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <Ch19GradientImage slug={slug || trackId} name={title} />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            {slug ? (
              <Link
                to={trackUrl(slug, artistSlugs)}
                onClick={(e) => e.stopPropagation()}
                className="truncate text-[14px] font-bold text-[var(--wk-text)] hover:underline"
              >
                {title}
              </Link>
            ) : (
              <span className="truncate text-[14px] font-bold text-[var(--wk-text)]">{title}</span>
            )}
            {peakPosition !== undefined && peakPosition === rank && (
              <span className="shrink-0 rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                PEAK
              </span>
            )}
            {!playable && (
              <span className="shrink-0 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-text-faint)]">
                Preview
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-[var(--wk-text-muted)]">
            {resolvedArtistLinks.length > 0 ? (
              resolvedArtistLinks.map((item, index) => (
                <span key={`${item.slug || item.name}-${index}`} className="inline-flex min-w-0 items-center">
                  {index > 0 && <span className="mr-1 text-[var(--wk-text-faint)]">,</span>}
                  {item.slug ? (
                    <Link
                      to={`/artists/${item.slug}`}
                      onClick={(event) => event.stopPropagation()}
                      className="truncate hover:text-[var(--wk-brand)] hover:underline"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span className="truncate">{item.name}</span>
                  )}
                </span>
              ))
            ) : (
              <span className="truncate">{artist}</span>
            )}
          </div>
          {(genre || label || previousWeek !== undefined) && (
            <div className="mt-1 hidden items-center gap-2 text-[11px] md:flex" style={{ color: "var(--wk-text-faint)" }}>
              {genre && <span>{genre}</span>}
              {genre && label && <span>·</span>}
              {label && <span>{label}</span>}
              {previousWeek !== undefined && previousWeek > 0 && (
                <>
                  <span>·</span>
                  <span>Was #{previousWeek}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
          {weeksOnChart !== undefined && (
            <WkTag>{weeksOnChart} wk{weeksOnChart !== 1 ? "s" : ""}</WkTag>
          )}
          {peakPosition !== undefined && (
            <span className="text-[11px] text-[var(--wk-text-faint)]">
              Peak #{peakPosition}
            </span>
          )}
        </div>

        {/* Play button */}
        <button
          onClick={handlePlay}
          disabled={!playable}
          aria-label={isCurrentTrack && isPlaying ? "Pause" : "Play"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <i className={`text-sm ${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-mini-fill"}`} />
        </button>

        {/* Expand chevron */}
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-faint)] transition-all duration-200 ${isExpanded ? "rotate-180 bg-[var(--wk-surface-raised)] text-[var(--wk-text)]" : "group-hover:text-[var(--wk-text-muted)]"}`}
        >
          <i className="ri-arrow-down-s-line text-[16px]" />
        </div>
      </div>

      {/* Expandable panel — smooth grid-rows animation */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.25s ease",
        }}
      >
        <ChartRowExpandedPanel
          rank={rank}
          slug={slug}
          artistNames={resolvedArtistNames}
          artistSlugs={artistSlugs}
          peakPosition={peakPosition ?? rank}
          weeksOnChart={weeksOnChart ?? 1}
          movement={movement}
          movementAmount={movementAmount}
          previousRank={previousRank}
          duration={duration}
          genre={genre}
          score={score}
        />
      </div>
    </div>
  );
}