import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import type { RELEASES } from "@/mocks/releases";

type Release = typeof RELEASES[number];

type AlbumModalProps = {
  release: Release | null;
  open: boolean;
  onClose: () => void;
};

const fakeTracks = (release: Release) =>
  Array.from({ length: Math.max(1, Math.min(release.trackCount || 1, 10)) }, (_, index) => ({
    title: index === 0 ? release.title : `${release.title} · Track ${index + 1}`,
    artist: release.artist,
    duration: `${2 + (index % 3)}:${String(18 + index * 7).padStart(2, "0").slice(0, 2)}`,
  }));

export function AlbumModal({ release, open, onClose }: AlbumModalProps) {
  if (!open || !release) return null;
  const tracks = fakeTracks(release);

  return (
    <div className="album-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="album-modal" onClick={(event) => event.stopPropagation()}>
        <div className="album-modal-head">
          <div className="album-modal-cover"><img src={release.artworkUrl} alt={release.title} /></div>
          <div>
            <div className="album41-kicker"><WkIcon name="Album" size={14} /> {release.releaseType}</div>
            <h2 className="album-modal-title">{release.title}</h2>
            <div className="album-modal-sub">{release.artist} · {release.year} · {release.labelName}</div>
            <div className="album-modal-actions">
              <button className="btn btn-md btn-primary"><WkIcon name="Play" size={16} /> Play</button>
              <button className="btn btn-md btn-ghost"><WkIcon name="Shuffle" size={16} /> Shuffle</button>
              <ShareButton item={{ title: release.title, subtitle: release.artist, description: `${release.releaseType} by ${release.artist}`, imageUrl: release.artworkUrl, type: "album" }} />
              <Link to={`/releases/${release.slug}`} className="btn btn-md btn-ghost"><WkIcon name="ArrowUpRight" size={16} /> Full page</Link>
            </div>
          </div>
          <button className="chart-btn album-modal-close" onClick={onClose} aria-label="Close album modal"><WkIcon name="X" size={18} /></button>
        </div>
        <div className="album-modal-body">
          <div className="album41-card-title mt-5"><WkIcon name="ListMusic" size={15} /> Tracklist preview</div>
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
}
