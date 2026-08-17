import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { TrackActionsMenu } from "@/components/tracks/TrackActionsMenu";
import { usePlayer } from "@/context/PlayerContext";
import type { PostTrack } from "@/services/community/posts";

export function PostTrackAttachment({
  track,
  compact = false,
  showActions = true,
  className = "",
}: {
  track: PostTrack;
  compact?: boolean;
  showActions?: boolean;
  className?: string;
}) {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
  } = usePlayer();

  const artistName = track.artistName || "Unknown Artist";
  const playable = Boolean(track.previewUrl);
  const current = Boolean(
    currentTrack &&
    (
      currentTrack.registryTrackId === track.id ||
      currentTrack.id === track.id
    ),
  );

  const play = () => {
    if (!playable) return;
    if (current) {
      togglePlay();
      return;
    }

    const playerTrack = {
      id: track.id,
      registryTrackId: track.id,
      title: track.title,
      artist: artistName,
      artworkUrl: track.artworkUrl || undefined,
      duration: track.durationMs == null
        ? undefined
        : Math.max(0, Math.round(track.durationMs / 1000)),
      isPlayable: true,
      source: "Post",
      previewUrl: track.previewUrl || undefined,
      artistSlug: track.artistSlug || undefined,
      trackSlug: track.trackSlug || undefined,
    };

    playTrack(
      playerTrack,
      [playerTrack],
      {
        pageType: "post",
        entityType: "track",
        entitySlug: track.trackSlug || undefined,
        sourceSection: "post_track_attachment",
      },
    );
  };

  const artworkSize = compact
    ? "h-12 w-12 rounded-lg"
    : "h-14 w-14 rounded-xl";

  return (
    <div
      data-post-track-attachment={track.id}
      className={`flex items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/55 p-3 ${className}`}
    >
      <PlayableArtwork
        label={track.title}
        onPlay={(event) => {
          event.preventDefault();
          event.stopPropagation();
          play();
        }}
        isPlaying={current && isPlaying}
        disabled={!playable}
        className={`${artworkSize} bg-[var(--wk-bg)]`}
        iconClassName={compact ? "h-7 w-7 text-[12px]" : "h-8 w-8 text-[13px]"}
      >
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Ch19GradientImage
            slug={track.trackSlug || track.id}
            name={track.title}
          />
        )}
      </PlayableArtwork>

      <div className="min-w-0 flex-1">
        {track.canonicalPath ? (
          <Link
            to={track.canonicalPath}
            className={`${compact ? "text-[12px]" : "text-[13px]"} line-clamp-2 font-black leading-tight text-[var(--wk-text)] hover:text-[var(--wk-brand)]`}
          >
            {track.title}
          </Link>
        ) : (
          <div className={`${compact ? "text-[12px]" : "text-[13px]"} line-clamp-2 font-black leading-tight text-[var(--wk-text)]`}>
            {track.title}
          </div>
        )}

        {track.artistSlug ? (
          <Link
            to={`/artists/${track.artistSlug}`}
            className="mt-1 block truncate text-[10px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)]"
          >
            {artistName}
          </Link>
        ) : (
          <div className="mt-1 truncate text-[10px] font-semibold text-[var(--wk-text-muted)]">
            {artistName}
          </div>
        )}
      </div>

      {showActions ? (
        <TrackActionsMenu
          registryTrackId={track.id}
          trackTitle={track.title}
          artistName={artistName}
          artistSlug={track.artistSlug}
          artworkUrl={track.artworkUrl}
          trackSlug={track.trackSlug}
          trackHref={track.canonicalPath}
          releaseTitle={track.releaseTitle}
          releaseSlug={track.releaseSlug}
        />
      ) : null}
    </div>
  );
}
