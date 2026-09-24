import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer, type PlaySource } from "@/context/PlayerContext";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { ChartRowExpandedPanel } from "@/components/design-system/music/ChartRowExpandedPanel";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";
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
  onDiscuss?: () => void;
  isPlaying?: boolean;
  genre?: string;
  label?: string;
  previousWeek?: number;
  slug?: string;
  registryTrackId?: string | null;
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
  onDiscuss,
  genre,
  label,
  previousWeek,
  slug,
  registryTrackId,
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
    const track = { id: trackId, registryTrackId, title, artist, artworkUrl, isPlayable: playable, source, previewUrl, trackSlug: slug };
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
        <PlayableArtwork
          label={title}
          onPlay={handlePlay}
          isPlaying={isCurrentTrack && isPlaying}
          disabled={!playable}
          className="h-8 w-8 rounded-md bg-[var(--wk-surface-raised)]"
          iconClassName="h-6 w-6 text-[11px]"
        >
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <Ch19GradientImage slug={slug || trackId} name={title} />
          )}
        </PlayableArtwork>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{title}</div>
          <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{artist}</div>
        </div>
        {registryTrackId ? (
          <div onClick={(event) => event.stopPropagation()}>
            <AddToPlaylistButton
              trackId={registryTrackId}
              trackTitle={title}
              compact
              iconOnly
            />
          </div>
        ) : null}
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
        className="flex cursor-pointer items-center gap-2 px-3 py-3 select-none md:gap-3"
      >
        {/* Rank */}
        <div className="flex w-10 shrink-0 flex-col items-center md:w-12">
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
            <span className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--wk-text-faint)" }}>—</span>
          )}
        </div>

        {/* Artwork owns playback. */}
        <PlayableArtwork
          label={title}
          onPlay={handlePlay}
          isPlaying={isCurrentTrack && isPlaying}
          disabled={!playable}
          className="h-14 w-14 rounded-lg bg-[var(--wk-surface-raised)]"
        >
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <Ch19GradientImage slug={slug || trackId} name={title} />
          )}
        </PlayableArtwork>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex min-w-0 items-start gap-2">
            {slug ? (
              <Link
                to={trackUrl(slug, artistSlugs)}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 line-clamp-2 text-[14px] font-bold leading-tight text-[var(--wk-text)] hover:underline md:line-clamp-1"
              >
                {title}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 line-clamp-2 text-[14px] font-bold leading-tight text-[var(--wk-text)] md:line-clamp-1">{title}</span>
            )}
            {!playable && (
              <span className="shrink-0 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-text-faint)]">
                Preview
              </span>
            )}
          </div>
          <div className="min-w-0 line-clamp-2 text-[12px] leading-[1.35] text-[var(--wk-text-muted)] md:line-clamp-1">
            {resolvedArtistLinks.length > 0 ? (
              resolvedArtistLinks.map((item, index) => (
                <span key={`${item.slug || item.name}-${index}`} className="inline">
                  {index > 0 && <span className="mr-1 text-[var(--wk-text-faint)]">,</span>}
                  {item.slug ? (
                    <Link
                      to={`/artists/${item.slug}`}
                      onClick={(event) => event.stopPropagation()}
                      className="hover:text-[var(--wk-brand)] hover:underline"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span>{item.name}</span>
                  )}
                </span>
              ))
            ) : (
              <span>{artist}</span>
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

        {registryTrackId ? (
          <div onClick={(event) => event.stopPropagation()}>
            <AddToPlaylistButton
              trackId={registryTrackId}
              trackTitle={title}
              compact
              iconOnly
            />
          </div>
        ) : null}


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
          registryTrackId={registryTrackId}
          trackTitle={title}
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
          onDiscuss={onDiscuss}
        />
      </div>
    </div>
  );
}