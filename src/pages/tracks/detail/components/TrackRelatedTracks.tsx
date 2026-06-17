import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { trackUrl } from "@/utils/trackUrl";
import { getArtistDiscographyFromRegistry } from "@/services/publicContent/client";
import type { RegistryDiscographyRelease } from "@/services/publicContent/client";

interface TrackRelatedTracksProps {
  trackSlug: string;
  artistSlug: string;
  artistName: string;
  albumSlug?: string;
  albumTitle?: string;
  genreSlug?: string;
  genreName?: string;
}

interface RelatedTrack {
  slug: string;
  title: string;
  artist: string;
  artistSlug: string;
  duration: string;
  artworkUrl: string;
  albumTitle?: string;
  relation: "album" | "artist" | "genre";
}

export default function TrackRelatedTracks({
  trackSlug,
  artistSlug,
  artistName,
  albumSlug,
  albumTitle,
  genreSlug,
  genreName,
}: TrackRelatedTracksProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>(0.1);
  const [related, setRelated] = useState<RelatedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    async function load() {
      try {
        const discography = await getArtistDiscographyFromRegistry(artistSlug);
        if (!alive) return;

        const tracks: RelatedTrack[] = [];
        const seenSlugs = new Set<string>();
        seenSlugs.add(trackSlug);

        // 1. Album siblings (tracks from the same release)
        if (albumSlug) {
          const albumRelease = discography.find((r) => r.slug === albumSlug || r.slug.includes(albumSlug));
          if (albumRelease) {
            albumRelease.tracks.forEach((t) => {
              const tSlug = (t as any).slug || (t.title ? t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "");
              if (tSlug && !seenSlugs.has(tSlug)) {
                seenSlugs.add(tSlug);
                tracks.push({
                  slug: tSlug,
                  title: t.title,
                  artist: artistName,
                  artistSlug,
                  duration: t.duration,
                  artworkUrl: albumRelease.artworkUrl,
                  albumTitle: albumRelease.title,
                  relation: "album",
                });
              }
            });
          }
        }

        // 2. Other tracks from the same artist
        discography.forEach((release) => {
          release.tracks.forEach((t) => {
            const tSlug = (t as any).slug || (t.title ? t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "");
            if (tSlug && !seenSlugs.has(tSlug)) {
              seenSlugs.add(tSlug);
              tracks.push({
                slug: tSlug,
                title: t.title,
                artist: artistName,
                artistSlug,
                duration: t.duration,
                artworkUrl: release.artworkUrl,
                albumTitle: release.title,
                relation: "artist",
              });
            }
          });
        });

        if (!alive) return;
        setRelated(tracks.slice(0, 8));
        setLoading(false);
      } catch {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [trackSlug, artistSlug, artistName, albumSlug]);

  if (!loading && related.length === 0) return null;

  const albumSiblings = related.filter((t) => t.relation === "album");
  const artistTracks = related.filter((t) => t.relation === "artist");

  return (
    <div ref={ref} className={`${revealed ? "is-visible" : ""} reveal-up`}>
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            <WkIcon name="Music2" size={12} />
            More to explore
          </div>
          <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
            Related tracks
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-surface)] p-3 animate-pulse">
                <div className="aspect-square rounded-lg bg-[var(--wk-surface-raised)] mb-3" />
                <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] mb-2" />
                <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Album siblings section */}
            {albumSiblings.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1 h-3 rounded-full bg-[var(--wk-brand)]" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">
                    From {albumTitle || "the same release"}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {albumSiblings.slice(0, 4).map((t) => (
                    <RelatedTrackCard key={t.slug} track={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Artist tracks section */}
            {artistTracks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1 h-3 rounded-full bg-[var(--wk-brand)]" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">
                    More by {artistName}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {artistTracks.slice(0, 4).map((t) => (
                    <RelatedTrackCard key={t.slug} track={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function RelatedTrackCard({ track }: { track: RelatedTrack }) {
  return (
    <Link
      to={trackUrl(track.slug, [track.artistSlug])}
      className="group border border-[var(--wk-border)] rounded-xl bg-[var(--wk-surface)] p-3 hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-surface-raised)] transition-all duration-200"
    >
      <div className="aspect-square rounded-lg overflow-hidden bg-[var(--wk-bg)] mb-3 border border-[var(--wk-border)]">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--wk-surface-raised)]">
            <WkIcon name="Music" size={20} className="text-[var(--wk-text-faint)]" />
          </div>
        )}
      </div>
      <div className="text-[13px] font-extrabold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors">
        {track.title}
      </div>
      <div className="text-[11px] font-semibold text-[var(--wk-text-muted)] truncate mt-0.5">
        {track.artist}
        {track.albumTitle && track.albumTitle !== track.title && (
          <span> · {track.albumTitle}</span>
        )}
      </div>
      {track.duration && (
        <div className="text-[10px] font-semibold text-[var(--wk-text-faint)] mt-1">
          {track.duration}
        </div>
      )}
    </Link>
  );
}