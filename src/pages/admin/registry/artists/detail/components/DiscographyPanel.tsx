import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

interface RegistryRelease {
  id: string;
  slug: string;
  title: string;
  release_type: string | null;
  release_date: string | null;
  artwork_url: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

interface ReleaseArtistLink {
  release_id: string;
  role: string;
  is_primary: boolean;
  source: string | null;
  confidence: number | null;
}

interface RegistryTrack {
  id: string;
  title: string;
  slug: string;
  duration_ms: number | null;
  track_number: number | null;
  disc_number: number | null;
  artwork_url: string | null;
}

interface ReleaseTrackLink {
  track_id: string;
  track_number: number | null;
  disc_number: number | null;
}

interface DiscographyRelease {
  id: string;
  slug: string;
  title: string;
  releaseType: string;
  releaseDate: string;
  year: string;
  artworkUrl: string;
  role: string;
  isPrimary: boolean;
  source: string;
  confidence: number;
  trackCount: number;
  tracks: DiscographyTrack[];
  expanded: boolean;
}

interface DiscographyTrack {
  id: string;
  slug: string;
  title: string;
  duration: string;
  trackNumber: number;
  artworkUrl: string;
}

/* ─── Helpers ─── */

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatYear(dateStr: string | null): string {
  if (!dateStr) return "—";
  const match = String(dateStr).match(/\d{4}/);
  return match ? match[0] : "—";
}

function sourceLabel(source: string): string {
  switch (source) {
    case "wkcharts_release_shell_artists":
      return "WP Charts";
    case "artist_page_import":
      return "WP Import";
    case "wkcharts_track_artists":
      return "WP Tracks";
    case "apple_music":
      return "Apple Music";
    case "spotify":
      return "Spotify";
    default:
      return source.replace(/_/g, " ").replace(/wkcharts/g, "WP");
  }
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "album":
      return "bg-wk-brand/10 text-wk-brand border-wk-brand/20";
    case "ep":
      return "bg-wk-accent/10 text-wk-accent border-wk-accent/20";
    case "single":
      return "bg-wk-surface-raised text-wk-text-muted border-wk-border";
    default:
      return "bg-wk-surface-raised text-wk-text-muted border-wk-border";
  }
}

/* ─── Component ─── */

export function DiscographyPanel({ artistSlug }: { artistSlug: string }) {
  const navigate = useNavigate();
  const [releases, setReleases] = useState<DiscographyRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artistSlug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      /* 1. Get artist-release links */
      const { data: links, error: linkErr } = await supabase
        .from("registry_release_artists")
        .select("release_id, role, is_primary, source, confidence")
        .eq("artist_slug", artistSlug)
        .order("created_at", { ascending: false });

      if (linkErr) {
        if (!cancelled) { setError(linkErr.message); setLoading(false); }
        return;
      }

      if (!links || links.length === 0) {
        if (!cancelled) { setReleases([]); setLoading(false); }
        return;
      }

      /* 2. Get release metadata */
      const releaseIds = [...new Set(links.map((l) => l.release_id))];
      const { data: releaseRows, error: releaseErr } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_type, release_date, artwork_url, status, metadata")
        .in("id", releaseIds);

      if (releaseErr) {
        if (!cancelled) { setError(releaseErr.message); setLoading(false); }
        return;
      }

      const releaseById = new Map((releaseRows || []).map((r) => [r.id, r]));

      /* 3. Get track count per release via registry_release_tracks */
      const { data: trackLinks, error: trackLinkErr } = await supabase
        .from("registry_release_tracks")
        .select("release_id, track_id, track_number, disc_number")
        .in("release_id", releaseIds);

      if (trackLinkErr) {
        if (!cancelled) { setError(trackLinkErr.message); setLoading(false); }
        return;
      }

      const trackCountByRelease = new Map<string, number>();
      const trackLinksByRelease = new Map<string, ReleaseTrackLink[]>();

      for (const tl of (trackLinks || [])) {
        const rid = tl.release_id;
        trackCountByRelease.set(rid, (trackCountByRelease.get(rid) || 0) + 1);
        if (!trackLinksByRelease.has(rid)) trackLinksByRelease.set(rid, []);
        trackLinksByRelease.get(rid)!.push(tl);
      }

      /* 4. Get track details */
      const allTrackIds = [...new Set((trackLinks || []).map((tl) => tl.track_id))];
      const trackById = new Map<string, RegistryTrack>();

      if (allTrackIds.length > 0) {
        const { data: trackRows } = await supabase
          .from("registry_tracks")
          .select("id, title, slug, duration_ms, track_number, disc_number, artwork_url")
          .in("id", allTrackIds);

        for (const t of (trackRows || [])) {
          trackById.set(t.id, t as RegistryTrack);
        }
      }

      /* 5. Build release objects, sorted by date */
      const built: DiscographyRelease[] = (links as ReleaseArtistLink[])
        .filter((l) => releaseById.has(l.release_id))
        .map((l) => {
          const r = releaseById.get(l.release_id)!;
          const tls = trackLinksByRelease.get(r.id) || [];
          const tracks: DiscographyTrack[] = tls
            .map((tl) => {
              const t = trackById.get(tl.track_id);
              return {
                id: tl.track_id,
                slug: t?.slug || tl.track_id,
                title: t?.title || `Track ${tl.track_number || "?"}`,
                duration: formatDuration(t?.duration_ms || null),
                trackNumber: tl.track_number || t?.track_number || 0,
                artworkUrl: t?.artwork_url || r.artwork_url || "",
              };
            })
            .sort((a, b) => a.trackNumber - b.trackNumber);

          return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            releaseType: r.release_type || "album",
            releaseDate: r.release_date || "",
            year: formatYear(r.release_date),
            artworkUrl: r.artwork_url || "",
            role: l.role || "primary_artist",
            isPrimary: l.is_primary,
            source: l.source || "unknown",
            confidence: l.confidence || 0,
            trackCount: tracks.length || trackCountByRelease.get(r.id) || 0,
            tracks,
            expanded: false,
          };
        });

      // Sort by date descending
      built.sort((a, b) => {
        if (!a.releaseDate && !b.releaseDate) return 0;
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return b.releaseDate.localeCompare(a.releaseDate);
      });

      if (!cancelled) {
        setReleases(built);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [artistSlug]);

  const toggleExpand = (releaseId: string) => {
    setReleases((prev) =>
      prev.map((r) =>
        r.id === releaseId ? { ...r, expanded: !r.expanded } : r
      )
    );
  };

  if (loading) {
    return (
      <WkSurface className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <WkIcon name="Album" size={14} className="text-wk-text-faint" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
            Discography
          </h3>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-16 w-full rounded-lg bg-wk-surface-raised" />
          <div className="h-16 w-full rounded-lg bg-wk-surface-raised" />
          <div className="h-16 w-full rounded-lg bg-wk-surface-raised" />
        </div>
      </WkSurface>
    );
  }

  if (error) {
    return (
      <WkSurface className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <WkIcon name="Album" size={14} className="text-wk-text-faint" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
            Discography
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-wk-danger-soft border border-wk-danger/20 p-3">
          <WkIcon name="AlertTriangle" size={14} className="text-wk-danger" />
          <p className="text-[12px] text-wk-danger font-semibold">{error}</p>
        </div>
      </WkSurface>
    );
  }

  const primaryReleases = releases.filter((r) => r.isPrimary);
  const featureReleases = releases.filter((r) => !r.isPrimary);

  return (
    <WkSurface className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <WkIcon name="Album" size={14} className="text-wk-text-faint" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">
            Discography
          </h3>
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold bg-wk-surface-raised text-wk-text-faint">
            {releases.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-wk-text-faint">
            {primaryReleases.length} primary
          </span>
          {featureReleases.length > 0 && (
            <>
              <span className="text-[10px] text-wk-text-faint">·</span>
              <span className="text-[10px] text-wk-text-faint">
                {featureReleases.length} feature
              </span>
            </>
          )}
        </div>
      </div>

      {releases.length === 0 ? (
        <p className="text-[12px] text-wk-text-faint italic py-4 text-center">
          No releases linked to this artist in the registry.
        </p>
      ) : (
        <div className="space-y-2">
          {releases.map((release) => (
            <div
              key={release.id}
              className="rounded-lg border border-wk-border bg-wk-bg-subtle overflow-hidden"
            >
              {/* Release row */}
              <div className="flex items-center gap-3 p-3">
                {/* Artwork thumbnail */}
                <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-wk-surface-raised border border-wk-border">
                  {release.artworkUrl ? (
                    <img
                      src={release.artworkUrl}
                      alt={release.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full text-wk-text-faint">
                      <WkIcon name="Album" size={18} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/admin/registry/releases/${release.slug}`)}
                      className="text-[13px] font-bold text-wk-text hover:text-wk-brand transition-colors truncate max-w-[320px] text-left cursor-pointer"
                    >
                      {release.title}
                    </button>
                    {!release.isPrimary && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-wk-warning-soft text-wk-warning uppercase">
                        feat
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${typeBadgeColor(release.releaseType)}`}>
                      {release.releaseType}
                    </span>
                    <span className="text-[11px] text-wk-text-faint">
                      {release.year}
                    </span>
                    {release.trackCount > 0 && (
                      <span className="text-[11px] text-wk-text-faint">
                        · {release.trackCount} tracks
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] text-wk-text-faint">
                      <span className="h-1.5 w-1.5 rounded-full bg-wk-text-faint/40" />
                      {sourceLabel(release.source)}
                    </span>
                  </div>
                </div>

                {/* Expand button */}
                {release.trackCount > 0 && (
                  <button
                    onClick={() => toggleExpand(release.id)}
                    className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md border border-wk-border bg-wk-surface hover:bg-wk-surface-raised transition-colors cursor-pointer"
                  >
                    <WkIcon
                      name={release.expanded ? "ChevronUp" : "ChevronDown"}
                      size={14}
                      className="text-wk-text-muted"
                    />
                  </button>
                )}

                {/* Confidence badge */}
                {release.confidence < 95 && (
                  <span
                    className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-wk-warning-soft text-wk-warning"
                    title={`Confidence: ${release.confidence}%`}
                  >
                    {release.confidence}%
                  </span>
                )}
              </div>

              {/* Expanded tracklist */}
              {release.expanded && release.tracks.length > 0 && (
                <div className="border-t border-wk-border">
                  <div className="divide-y divide-wk-border/50">
                    {release.tracks.map((track, idx) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-wk-surface-raised transition-colors"
                      >
                        <span className="text-[11px] font-mono text-wk-text-faint w-6 text-right shrink-0">
                          {track.trackNumber || idx + 1}
                        </span>
                        <span className="flex-1 text-[12px] text-wk-text-soft truncate">
                          {track.title}
                        </span>
                        {track.duration && (
                          <span className="text-[11px] font-mono text-wk-text-faint shrink-0">
                            {track.duration}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </WkSurface>
  );
}