import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { TrackActionsMenu } from "@/components/tracks/TrackActionsMenu";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { usePlayer } from "@/context/PlayerContext";
import { canonicalTrackUrl } from "@/utils/trackUrl";
import type { PublicReleaseDetail } from "@/services/publicContent/client";

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ReleaseTracklist({
  release,
  tracks,
  artistSlug,
  onDiscussTrack,
}: {
  release: PublicReleaseDetail;
  tracks: PublicReleaseDetail["tracks"];
  artistSlug: string;
  onDiscussTrack?: (track: PublicReleaseDetail["tracks"][number], index: number) => void;
}) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);

  const handlePlayTrack = (track: typeof tracks[number], trackIndex: number) => {
    // If this track is already the current track, toggle play/pause
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    // Build queue from all tracks starting at the clicked index
    const queueTracks = tracks.slice(trackIndex).map((t, i) => ({
      id: t.id,
      registryTrackId: t.id,
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl,
      duration: t.duration,
      previewUrl: t.previewUrl,
      appleMusicId: t.appleMusicId || t.appleMusicCatalogId || null,
      appleMusicCatalogId: t.appleMusicCatalogId || t.appleMusicId || null,
      album: release.title,
      releaseId: release.id,
      artistSlug,
      trackSlug: t.slug,
    }));

    // Also include tracks before the clicked index (for a full queue)
    const remainingTracks = tracks.slice(0, trackIndex).map((t) => ({
      id: t.id,
      registryTrackId: t.id,
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl,
      duration: t.duration,
      previewUrl: t.previewUrl,
      appleMusicId: t.appleMusicId || t.appleMusicCatalogId || null,
      appleMusicCatalogId: t.appleMusicCatalogId || t.appleMusicId || null,
      album: release.title,
      releaseId: release.id,
      artistSlug,
      trackSlug: t.slug,
    }));

    const fullQueue = [...queueTracks, ...remainingTracks];

    playTrack(queueTracks[0], fullQueue, {
      pageType: "release_detail",
      entitySlug: release.slug,
      entityType: "release",
      sourceSection: "tracklist",
    });
  };

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="ListMusic" size={12} />
            Tracklist
          </div>
          <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
            {release.trackCount} tracks
          </h2>
        </div>

        <div className="border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)]">
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isThisPlaying = isCurrentTrack && isPlaying;
            const trackHref = canonicalTrackUrl(
              artistSlug,
              track.slug,
              release.slug,
              release.trackCount,
            );

            return (
              <div
                key={track.id}
                className="group grid items-center gap-3 px-4 py-3.5 border-b border-[var(--wk-divider)] last:border-b-0 transition-colors hover:bg-[var(--wk-surface-raised)]"
                style={{ gridTemplateColumns: "44px minmax(0, 1fr) auto 40px" }}
              >
                {/* Artwork owns playback; number sits on the artwork. */}
                <PlayableArtwork
                  label={track.title}
                  onPlay={(event) => {
                    event.stopPropagation();
                    handlePlayTrack(track, index);
                  }}
                  isPlaying={isThisPlaying}
                  className="h-10 w-10 rounded-md bg-[var(--wk-surface-raised)]"
                  iconClassName="h-7 w-7 text-[12px]"
                >
                  {track.artworkUrl || release.artworkUrl ? (
                    <img
                      src={track.artworkUrl || release.artworkUrl}
                      alt=""
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[12px] font-black text-[var(--wk-text-muted)]">
                      {index + 1}
                    </div>
                  )}
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/65 px-1 text-[8px] font-black leading-4 text-white">
                    {index + 1}
                  </span>
                </PlayableArtwork>

                {/* Track info — clicking navigates to track detail */}
                <Link
                  to={trackHref}
                  className="min-w-0 block"
                  onClick={(e) => {
                    // Don't navigate if we're interacting with the play button area
                    if ((e.target as HTMLElement).closest("button")) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="line-clamp-2 text-[14px] font-extrabold leading-tight text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
                    {track.title}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    {track.artist}
                  </div>
                </Link>

                {/* Duration */}
                <div className="text-[12px] font-bold text-[var(--wk-text-faint)] text-right tabular-nums">
                  {formatDuration(track.duration)}
                </div>

                {/* Track actions */}
                <TrackActionsMenu
                  registryTrackId={track.id}
                  trackTitle={track.title}
                  artistName={track.artist}
                  artistSlug={artistSlug}
                  artworkUrl={track.artworkUrl || release.artworkUrl}
                  trackSlug={track.slug}
                  trackHref={trackHref}
                  onDiscuss={
                    onDiscussTrack
                      ? () => onDiscussTrack(track, index)
                      : null
                  }
                />
              </div>
            );
          })}

          {tracks.length === 0 && (
            <div className="px-4 py-10 text-center text-[14px] font-semibold text-[var(--wk-text-muted)]">
              <WkIcon name="ListMusic" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              No tracklist available for this release.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}