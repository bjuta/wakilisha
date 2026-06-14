import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
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
  tracks?: Array<{ title: string; duration: string }>;
}

interface AlbumModalProps {
  release: ModalRelease | null;
  open: boolean;
  onClose: () => void;
}

function resolveTracks(release: ModalRelease): Array<{ title: string; artist: string; duration: string }> {
  if (release.tracks && release.tracks.length > 0) {
    return release.tracks
      .filter((t) => t.title && !t.title.startsWith("Track ") && !t.title.startsWith("Unknown"))
      .map((t) => ({
        title: t.title,
        artist: release.artist,
        duration: t.duration || "",
      }));
  }
  return [];
}

export function AlbumModal({ release, open, onClose }: AlbumModalProps) {
  useScrollLock(open);

  if (!open || !release) return null;
  const tracks = resolveTracks(release);

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
              <button className="wk-button wk-button-primary"><WkIcon name="Play" size={16} /> Play</button>
              <ShareButton item={{ title: release.title, subtitle: release.artist, description: `${release.releaseType} by ${release.artist}`, imageUrl: release.artworkUrl, type: "album" }} />
              <Link to={releaseUrl(release)} className="wk-button wk-button-ghost"><WkIcon name="ArrowUpRight" size={16} /> Full page</Link>
            </div>
          </div>
          <button className="chart-btn album-modal-close" onClick={onClose} aria-label="Close album modal"><WkIcon name="X" size={18} /></button>
        </div>
        <div className="album-modal-body">
          <div className="album41-tracklist">
            {tracks.map((track, index) => (
              <div key={`${track.title}-${index}`} className="album41-track">
                <div className="album41-track-num">{index + 1}</div>
                <div className="min-w-0"><div className="album41-track-title">{track.title}</div><div className="album41-track-sub">{track.artist}</div></div>
                <div className="album41-duration">{track.duration}</div>
                <button className="chart-btn"><WkIcon name="Play" size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}