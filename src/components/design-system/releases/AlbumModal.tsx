import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { usePlayer } from "@/context/PlayerContext";
import { releaseUrl } from "@/services/repairedContent/client";

export interface ModalRelease {
  slug: string;
  title: string;
  artist: string;
  releaseType: string;
  year: string | number;
  labelName?: string;
  artworkUrl: string;
  trackCount: number;
  tracks?: Array<{ title: string; duration: string; artists?: string; previewUrl?: string }>;
}

interface AlbumModalProps {
  release: ModalRelease | null;
  open: boolean;
  onClose: () => void;
}

function resolveTracks(release: ModalRelease): Array<{ title: string; artist: string; duration: string; featuredArtists: string; previewUrl?: string }> {
  if (release.tracks && release.tracks.length > 0) {
    return release.tracks
      .filter((t) => t.title && !t.title.startsWith("Track ") && !t.title.startsWith("Unknown"))
      .map((t) => {
        const allArtists = t.artists || "";
        const displayArtist = allArtists || release.artist;
        return {
          title: t.title,
          artist: displayArtist,
          duration: t.duration || "",
          featuredArtists: allArtists,
          previewUrl: t.previewUrl,
        };
      });
  }
  return [];
}

export function AlbumModal({ release, open, onClose }: AlbumModalProps) {
  useScrollLock(open);
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();

  if (!open || !release) return null;
  const tracks = resolveTracks(release);

  const handlePlayAll = () => {
    if (!tracks.length) return;

    const queueTracks = tracks.map((t, i) => ({
      id: `${release.slug}-${i}`,
      title: t.title,
      artist: t.artist,
      artworkUrl: release.artworkUrl,
      duration: parseDuration(t.duration),
      previewUrl: t.previewUrl,
      album: release.title,
    }));

    // If the first track is already playing, toggle instead
    if (currentTrack?.id === queueTracks[0].id) {
      togglePlay();
      return;
    }

    playTrack(queueTracks[0], queueTracks);
  };

  const handlePlayTrack = (trackIndex: number) => {
    if (!tracks.length) return;

    // Build queue starting from the clicked index
    const queueTracks = tracks.slice(trackIndex).map((t, i) => ({
      id: `${release.slug}-${trackIndex + i}`,
      title: t.title,
      artist: t.artist,
      artworkUrl: release.artworkUrl,
      duration: parseDuration(t.duration),
      previewUrl: t.previewUrl,
      album: release.title,
    }));

    const remainingTracks = tracks.slice(0, trackIndex).map((t, i) => ({
      id: `${release.slug}-${i}`,
      title: t.title,
      artist: t.artist,
      artworkUrl: release.artworkUrl,
      duration: parseDuration(t.duration),
      previewUrl: t.previewUrl,
      album: release.title,
    }));

    const fullQueue = [...queueTracks, ...remainingTracks];

    if (currentTrack?.id === queueTracks[0].id) {
      togglePlay();
      return;
    }

    playTrack(queueTracks[0], fullQueue);
  };

  const isThisReleasePlaying = currentTrack?.album === release.title && isPlaying;

  const modal = (
    <div className="album-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div data-scroll-lock="container" className="album-modal" onClick={(event) => event.stopPropagation()}>
        <div className="album-modal-head">
          <div className="album-modal-cover"><img src={release.artworkUrl} alt={release.title} className="h-full w-full object-cover" /></div>
          <div>
            <div className="album41-kicker"><WkIcon name="Album" size={14} /> {release.releaseType}</div>
            <h2 className="album-modal-title">{release.title}</h2>
            <div className="album-modal-sub">{release.artist} · {release.year}{release.labelName ? ` · ${release.labelName}` : ""}</div>
            <div className="album-modal-actions">
              <button
                className="wk-button wk-button-primary whitespace-nowrap cursor-pointer"
                onClick={handlePlayAll}
              >
                <WkIcon name={isThisReleasePlaying ? "Pause" : "Play"} size={16} />
                {isThisReleasePlaying ? "Pause" : "Play"}
              </button>
              <ShareButton item={{ title: release.title, subtitle: release.artist, description: `${release.releaseType} by ${release.artist}`, imageUrl: release.artworkUrl, type: "album" }} />
              <Link to={releaseUrl(release)} className="wk-button wk-button-ghost"><WkIcon name="ArrowUpRight" size={16} /> Full page</Link>
            </div>
          </div>
          <button className="chart-btn album-modal-close" onClick={onClose} aria-label="Close album modal"><WkIcon name="X" size={18} /></button>
        </div>
        <div className="album-modal-body">
          <div className="album41-tracklist">
            {tracks.map((track, index) => {
              const trackId = `${release.slug}-${index}`;
              const isCurrentTrack = currentTrack?.id === trackId;
              const isThisPlaying = isCurrentTrack && isPlaying;

              return (
                <div key={trackId} className="album41-track">
                  <div className="album41-track-num">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="album41-track-title">{track.title}</div>
                    <div className="album41-track-sub">{track.artist}</div>
                  </div>
                  <div className="album41-duration">{track.duration}</div>
                  <button
                    className="chart-btn cursor-pointer whitespace-nowrap"
                    onClick={() => handlePlayTrack(index)}
                    aria-label={isThisPlaying ? "Pause" : `Play ${track.title}`}
                  >
                    <WkIcon name={isThisPlaying ? "Pause" : "Play"} size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function parseDuration(duration: string): number {
  if (!duration) return 0;
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(duration) || 0;
}