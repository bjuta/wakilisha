import { WkIcon } from "@/components/design-system/Icon";

export interface TrackItem {
  track_id: string;
  track_slug: string;
  track_title: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  isrc: string | null;
  preview_url: string | null;
  track_artwork_url: string | null;
  track_status: string;
  link_status: string;
}

export interface TrackArtistRecord {
  track_id: string;
  artist_id: string;
  artist_slug: string;
  artist_name_text: string;
  role: string;
  is_primary: boolean;
  is_featured: boolean;
  credit_order: number;
  display_credit: string | null;
}

interface AdminReleaseTracklistProps {
  tracks: TrackItem[];
  trackArtists: TrackArtistRecord[];
  releaseArtistName: string;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getFeaturedArtists(trackId: string, trackArtists: TrackArtistRecord[]): TrackArtistRecord[] {
  return trackArtists
    .filter((ta) => ta.track_id === trackId && ta.is_featured)
    .sort((a, b) => a.credit_order - b.credit_order);
}

export default function AdminReleaseTracklist({ tracks, trackArtists, releaseArtistName }: AdminReleaseTracklistProps) {
  const sorted = [...tracks].sort((a, b) => {
    if (a.disc_number !== b.disc_number) return a.disc_number - b.disc_number;
    return a.track_number - b.track_number;
  });

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
        <WkIcon name="ListMusic" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="text-[14px] font-semibold text-[var(--wk-text-muted)]">No tracks linked to this release yet.</p>
        <p className="text-[12px] text-[var(--wk-text-faint)] mt-1">Run canonicalize to populate the tracklist.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--wk-border)]">
        <div className="flex items-center gap-2">
          <WkIcon name="ListMusic" size={14} className="text-[var(--wk-text-muted)]" />
          <h3 className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Tracklist
          </h3>
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-[var(--wk-bg)] text-[var(--wk-text-faint)]">
            {sorted.length}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-[var(--wk-text-faint)] uppercase tracking-wider">
          Primary · Featured Artists
        </span>
      </div>

      {/* Track rows */}
      <div className="divide-y divide-[var(--wk-divider)]">
        {sorted.map((track) => {
          const featured = getFeaturedArtists(track.track_id, trackArtists);
          const trackUrl = `/admin/registry/tracks/${track.track_slug}`;

          return (
            <div
              key={track.track_id}
              className="group flex items-center gap-3 px-5 py-3 hover:bg-[var(--wk-bg)] transition-colors"
            >
              {/* Track number */}
              <div className="flex-shrink-0 w-8 text-center">
                <span className="text-[12px] font-extrabold text-[var(--wk-text-faint)] tabular-nums">
                  {track.track_number}
                </span>
              </div>

              {/* Track artwork thumbnail */}
              <div className="flex-shrink-0 w-9 h-9 rounded-md overflow-hidden bg-[var(--wk-bg)] border border-[var(--wk-border)]">
                {track.track_artwork_url ? (
                  <img src={track.track_artwork_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <WkIcon name="Music" size={12} className="text-[var(--wk-text-faint)]" />
                  </div>
                )}
              </div>

              {/* Title + artists */}
              <div className="flex-1 min-w-0">
                <a
                  href={trackUrl}
                  className="text-[13px] font-extrabold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors truncate block"
                >
                  {track.track_title}
                </a>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    {releaseArtistName}
                  </span>
                  {featured.length > 0 && (
                    <>
                      <span className="text-[9px] text-[var(--wk-text-faint)]">ft.</span>
                      {featured.map((fa, i) => (
                        <span key={fa.artist_id} className="text-[11px] font-medium text-[var(--wk-text-muted)]">
                          <a
                            href={`/admin/registry/artists/${fa.artist_slug}`}
                            className="hover:text-[var(--wk-brand)] transition-colors"
                          >
                            {fa.artist_name_text}
                          </a>
                          {i < featured.length - 1 && <span className="text-[var(--wk-text-faint)]">,</span>}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* ISRC */}
              <div className="hidden lg:block flex-shrink-0 w-[100px] text-right">
                {track.isrc && (
                  <span className="text-[10px] font-mono font-semibold text-[var(--wk-text-faint)]">{track.isrc}</span>
                )}
              </div>

              {/* Duration */}
              <div className="flex-shrink-0 w-[42px] text-right">
                <span className="text-[11px] font-semibold text-[var(--wk-text-muted)] tabular-nums">
                  {formatDuration(track.duration_ms)}
                </span>
              </div>

              {/* Status */}
              <div className="flex-shrink-0 w-[72px] text-right">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  track.track_status === "active" ? "bg-green-100 text-green-700" :
                  track.track_status === "draft" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {track.track_status}
                </span>
              </div>

              {/* Nav arrow */}
              <div className="flex-shrink-0 w-5 text-right">
                <a href={trackUrl} className="text-[var(--wk-text-faint)] group-hover:text-[var(--wk-text-muted)] transition-colors">
                  <WkIcon name="ChevronRight" size={12} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}