import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { MetaTags } from "@/components/seo/MetaTags";
import { usePlayer } from "@/context/PlayerContext";
import { getRelease, slugify, listReleases, type PublicReleaseDetail, type PublicRelease } from "@/services/publicContent/client";
import { trackUrl } from "@/utils/trackUrl";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";
import { MobileShareButton } from "@/components/design-system/share/ShareSheet";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { useAuthUser } from "@/hooks/useAuthUser";

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDurationLong(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rm = minutes % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

// ─── Prose generator (same logic as desktop ReleaseExcerpt) ──────────────────

function releaseTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "album" || t === "studio album") return "studio album";
  if (t === "ep" || t === "extended play") return "extended play";
  if (t === "single") return "single";
  if (t === "compilation") return "compilation";
  if (t === "mixtape") return "mixtape";
  return t;
}

function articleize(word: string): string {
  const first = word.charAt(0).toLowerCase();
  return "aeiou".includes(first) ? `an ${word}` : `a ${word}`;
}

function formatDurationApprox(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `approximately ${m} minutes`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `approximately ${h} hour${h > 1 ? "s" : ""}`;
  return `approximately ${h} hour${h > 1 ? "s" : ""} and ${rm} minutes`;
}

function buildDescription(opts: {
  title: string;
  artist: string;
  year: string;
  releaseType: string;
  labelName: string;
  trackCount: number;
  tracks: PublicReleaseDetail["tracks"];
  totalDuration: number;
}): string {
  const { title, artist, year, releaseType, labelName, trackCount, tracks, totalDuration } = opts;
  const rType = releaseTypeLabel(releaseType);
  const parts: string[] = [];

  let open = `"${title}" is ${articleize(rType)} by ${artist}`;
  if (year && year !== "Unknown year") open += `, released in ${year}`;
  if (labelName && labelName !== "Independent" && labelName !== "Unknown" && labelName !== "WAKILISHA Registry" && labelName !== "WAKILISHA") {
    open += ` through ${labelName}`;
  }
  open += ".";
  parts.push(open);

  const sorted = [...tracks].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  const first = sorted[0]?.title;
  const last = sorted.length > 1 ? sorted[sorted.length - 1]?.title : "";

  if (trackCount === 1 && first) {
    parts.push(`The release consists of a single track, "${first}."`);
  } else if (trackCount > 1 && first) {
    let s = `The ${trackCount}-track project opens with "${first}"`;
    if (last && last !== first) s += `, concluding with "${last}"`;
    s += ".";
    parts.push(s);
  }

  if (totalDuration > 0) {
    const durLabel = formatDurationApprox(totalDuration);
    if (trackCount <= 4) {
      parts.push(`With a total runtime of ${durLabel}, the project delivers a concise but complete statement.`);
    } else if (trackCount <= 10) {
      parts.push(`Clocking in at ${durLabel}, the release balances breadth with cohesion.`);
    } else {
      parts.push(`At ${durLabel}, the project offers a substantial listening experience.`);
    }
  }

  parts.push(`"${title}" stands as a notable entry in ${artist}'s discography.`);

  return parts.join(" ");
}

export default function MobileReleaseDetail() {
  const { artistSlug, releaseSlug } = useParams<{ artistSlug: string; releaseSlug: string }>();
  const user = useAuthUser();

  useScrollDepthTracking({
    pageType: "release_detail",
    entitySlug: releaseSlug,
    entityType: "release",
  });

  const [release, setRelease] = useState<PublicReleaseDetail | null>(null);
  const [related, setRelated] = useState<PublicRelease[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);

  const { currentTrack, isPlaying, playTrack, togglePlay, toggleShuffle, isShuffle } = usePlayer();

  useEffect(() => {
    let alive = true;
    if (!artistSlug || !releaseSlug) {
      setStatus("error");
      setError("No release slug provided");
      return;
    }
    setStatus("loading");
    setError(null);
    Promise.all([getRelease(artistSlug, releaseSlug), listReleases()])
      .then(([data, allReleases]) => {
        if (!alive) return;
        if (!data) {
          setStatus("error");
          setError("This release does not exist in the catalog.");
          return;
        }
        setRelease(data);
        const rel = allReleases
          .filter((r) => r.slug !== releaseSlug && (r.artist === data.artist || r.labelName === data.labelName))
          .slice(0, 6);
        setRelated(rel);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load release.");
        setStatus("error");
      });
    return () => { alive = false; };
  }, [artistSlug, releaseSlug]);

  useEffect(() => {
    setArtworkFailed(false);
  }, [release?.artworkUrl]);

  const buildPlayerTrack = (track: PublicReleaseDetail["tracks"][number]) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    artworkUrl: track.artworkUrl,
    duration: track.duration,
    previewUrl: track.previewUrl,
    appleMusicId: track.appleMusicId || track.appleMusicCatalogId || null,
    appleMusicCatalogId: track.appleMusicCatalogId || track.appleMusicId || null,
    album: release?.title,
    artistSlug: release ? slugify(release.artist) : artistSlug,
    trackSlug: track.slug,
  });

  const buildReleaseQueue = (startIndex = 0) => {
    if (!release) return [];
    const tracks = release.tracks;
    return [
      ...tracks.slice(startIndex).map(buildPlayerTrack),
      ...tracks.slice(0, startIndex).map(buildPlayerTrack),
    ];
  };

  const isThisReleasePlaying = Boolean(release?.tracks.some((track) => track.id === currentTrack?.id));

  const handlePlayRelease = () => {
    if (!release?.tracks.length) return;

    if (isThisReleasePlaying) {
      togglePlay();
      return;
    }

    const queue = buildReleaseQueue(0);
    if (!queue.length) return;

    playTrack(queue[0], queue, {
      pageType: "release_detail",
      entitySlug: releaseSlug || "",
      entityType: "release",
      sourceSection: "release_hero",
    });
  };

  const handleShuffleRelease = () => {
    if (!release?.tracks.length) return;

    if (!isShuffle) {
      toggleShuffle();
    }

    const randomIndex = Math.floor(Math.random() * release.tracks.length);
    const queue = buildReleaseQueue(randomIndex);
    if (!queue.length) return;

    playTrack(queue[0], queue, {
      pageType: "release_detail",
      entitySlug: releaseSlug || "",
      entityType: "release",
      sourceSection: "release_hero_shuffle",
    });
  };

  const handlePlayTrack = (track: PublicReleaseDetail["tracks"][number], trackIndex: number) => {
    if (!release) return;
    if (currentTrack?.id === track.id) { togglePlay(); return; }

    const queue = buildReleaseQueue(trackIndex);
    playTrack(queue[0], queue, {
      pageType: "release_detail",
      entitySlug: releaseSlug || "",
      entityType: "release",
      sourceSection: "tracklist",
    });
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wk-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--wk-brand)]" />
          </div>
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--wk-text-faint)]">Loading release...</span>
        </div>
      </div>
    );
  }

  if (status === "error" || !release) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center bg-[var(--wk-bg)]">
        <i className="ri-album-line text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="text-[20px] font-black text-[var(--wk-text)]">Release not found</h1>
        <p className="text-[14px] text-[var(--wk-text-muted)]">{error || "This release is not in the catalog."}</p>
        <Link to="/releases" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)]">
          <i className="ri-arrow-left-line" />
          Back to Releases
        </Link>
      </div>
    );
  }

  const canUseArtwork = Boolean(release.artworkUrl && !artworkFailed);
  const durationLabel = formatDurationLong(release.totalDuration || release.trackCount * 180);
  const initial = release.title.trim()[0]?.toUpperCase() || "W";

  // Always regenerate description from structured data — ignore the API placeholder
  const descriptionText = buildDescription({
    title: release.title,
    artist: release.artist,
    year: release.year,
    releaseType: release.releaseType,
    labelName: release.labelName,
    trackCount: release.trackCount,
    tracks: release.tracks,
    totalDuration: release.totalDuration,
  });
  const sentences = descriptionText.split(". ").filter(Boolean);
  const previewSentences = sentences.slice(0, 2).join(". ") + ".";
  const restSentences = sentences.slice(2).join(". ").trim();
  const hasMoreDescription = restSentences.length > 0;

  const communityEntity = {
    type: "release" as const,
    id: releaseSlug || undefined,
    slug: releaseSlug || undefined,
    url: typeof window !== "undefined" ? window.location.href : `/releases/${artistSlug}/${releaseSlug}`,
    title: release.title,
    subtitle: release.artist,
    imageUrl: release.artworkUrl,
  };

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* SEO */}
      <MetaTags
        title={`${release.title} by ${release.artist}`}
        description={descriptionText ? descriptionText.slice(0, 160) : `${release.title} is a ${release.releaseType} by ${release.artist}, released in ${release.year}.`}
        imageUrl={release.artworkUrl}
        type="music.album"
        artistName={release.artist}
        releaseDate={release.releaseDate}
      />

      {/* Floating top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-safe-top pt-4 pointer-events-none">
        <Link
          to="/releases"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all active:scale-95"
          aria-label="Back to Releases"
        >
          <i className="ri-arrow-left-line text-lg" />
        </Link>
        <MobileShareButton
          item={{
            title: release?.title || "Release",
            subtitle: release?.artist,
            description: release ? `${release.title} by ${release.artist} — ${release.releaseType} released in ${release.year}` : undefined,
            imageUrl: release?.artworkUrl,
            type: "album",
          }}
          className="pointer-events-auto"
        />
      </div>

      {/* Hero */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden">
        {canUseArtwork ? (
          <div className="absolute inset-0" style={{ backgroundImage: `url(${release.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/35" />

        <div className="relative w-full px-5 pb-8 pt-20">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-brand)]/90 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur">
            <i className="ri-album-line text-xs" />
            {release.releaseType}
          </span>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(28px, 8vw, 42px)" }}>
            {release.title}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)] border border-[var(--wk-border)]">
              {canUseArtwork ? (
                <img src={release.artworkUrl} alt="" className="h-full w-full object-cover" onError={() => setArtworkFailed(true)} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[16px] font-black text-[#101510] bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)]">{initial}</div>
              )}
            </div>
            <div>
              <Link to={`/artists/${slugify(release.artist)}`} className="text-[14px] font-bold text-[var(--wk-text)] active:opacity-70">
                {release.artist}
              </Link>
              <div className="text-[11px] text-[var(--wk-text-muted)]">{release.year} · {release.trackCount} tracks{release.labelName && release.labelName !== "WAKILISHA Registry" && release.labelName !== "WAKILISHA" ? ` · ${release.labelName}` : ""}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handlePlayRelease}
              disabled={!release.tracks.length}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-white active:scale-[0.97] transition-transform whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className={`${isThisReleasePlaying && isPlaying ? "ri-pause-fill" : "ri-play-fill"} text-base`} />
              {isThisReleasePlaying && isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={handleShuffleRelease}
              disabled={!release.tracks.length}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur px-5 py-2.5 text-[12px] font-semibold text-[var(--wk-text)] active:scale-[0.97] transition-transform whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="ri-shuffle-line text-base" />
              Shuffle
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="px-5 py-6 space-y-8">

        {/* Description */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">About this release</span>
          </div>
          <p className="text-[13px] leading-[1.75] text-[var(--wk-text-soft)]">
            {expandedDescription ? descriptionText : previewSentences}
          </p>
          {hasMoreDescription && (
            <button onClick={() => setExpandedDescription(!expandedDescription)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--wk-brand)] active:opacity-70">
              {expandedDescription ? "Show less" : "Read more"}
              <i className={expandedDescription ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
            </button>
          )}
          <p className="mt-4 text-[10px] text-[var(--wk-text-faint)] leading-relaxed border-t border-[var(--wk-border)] pt-4">
            This summary is automatically generated from catalog data.
          </p>
        </section>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Tracks</div>
            <div className="mt-0.5 text-[20px] font-black text-[var(--wk-text)]">{release.trackCount}</div>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Year</div>
            <div className="mt-0.5 text-[20px] font-black text-[var(--wk-text)]">{release.year}</div>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Runtime</div>
            <div className="mt-0.5 text-[20px] font-black text-[var(--wk-text)]">{durationLabel || "—"}</div>
          </div>
        </div>

        {/* Chart stats */}
        {release.chartStats && release.chartStats.totalChartAppearances > 0 && (
          <div className="rounded-2xl border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Chart impact</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[22px] font-black text-[var(--wk-brand)]">{release.chartStats.totalChartAppearances}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Entries</div>
              </div>
              {release.chartStats.topPeakPosition != null && (
                <div className="text-center">
                  <div className="text-[22px] font-black text-[var(--wk-text)]">#{release.chartStats.topPeakPosition}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Best rank</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-[22px] font-black text-[var(--wk-text)]">{release.chartStats.totalWeeksOnChart}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Weeks</div>
              </div>
            </div>
          </div>
        )}

        {/* Tracklist */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Tracklist</span>
            </div>
            <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">{release.trackCount} tracks</span>
          </div>

          {release.tracks.length > 0 ? (
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
              {release.tracks.map((track, index) => {
                const isCurrentTrack = currentTrack?.id === track.id;
                const isThisPlaying = isCurrentTrack && isPlaying;
                return (
                  <div key={track.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--wk-divider)] last:border-b-0 active:bg-[var(--wk-surface-raised)] transition-colors">
                    <button
                      onClick={() => handlePlayTrack(track, index)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-white active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
                      aria-label={isCurrentTrack && isPlaying ? "Pause" : `Play ${track.title}`}
                    >
                      <i className={`${isCurrentTrack && isPlaying ? "ri-pause-fill" : "ri-play-fill"} text-sm`} />
                    </button>
                    <Link to={trackUrl(track.slug, [slugify(release.artist)])} className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{track.title}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{track.artist}</div>
                    </Link>
                    <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] tabular-nums">{formatDuration(track.duration)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-10 text-center">
              <i className="ri-play-list-line text-3xl text-[var(--wk-text-faint)] mb-2 block" />
              <p className="text-[13px] font-semibold text-[var(--wk-text-muted)]">No tracklist available.</p>
            </div>
          )}
        </section>

        {/* Registry info */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Catalogue details</span>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] divide-y divide-[var(--wk-divider)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Type</span>
              <span className="text-[13px] font-bold text-[var(--wk-text)]">{release.releaseType}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Release date</span>
              <span className="text-[13px] font-bold text-[var(--wk-text)]">{release.releaseDate || release.year}</span>
            </div>
            {release.labelName && release.labelName !== "WAKILISHA Registry" && release.labelName !== "WAKILISHA" && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Label</span>
                <span className="text-[13px] font-bold text-[var(--wk-text)]">{release.labelName}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Tracklist source</span>
              <span className="text-[13px] font-bold text-[var(--wk-text)] capitalize">
                {String(release.metadata?.tracklistSource || "shell").replaceAll("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Artwork source</span>
              <span className="text-[13px] font-bold text-[var(--wk-text)] capitalize">
                {String(release.metadata?.artworkSource || "generated").replaceAll("_", " ")}
              </span>
            </div>
            {release.metadata?.source && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Data source</span>
                <span className="text-[13px] font-bold text-[var(--wk-text)] capitalize">
                  {String(release.metadata.source).replaceAll("_", " ")}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Artist link */}
        <Link
          to={`/artists/${slugify(release.artist)}`}
          className="flex items-center justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-4 active:bg-[var(--wk-surface-raised)] transition-colors"
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">Artist</div>
            <div className="text-[15px] font-bold text-[var(--wk-text)]">{release.artist}</div>
          </div>
          <i className="ri-arrow-right-line text-[var(--wk-text-muted)] text-lg" />
        </Link>

        {release.labelName && release.labelName !== "WAKILISHA Registry" && (
          <Link
            to={`/labels/${slugify(release.labelName)}`}
            className="flex items-center justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-4 active:bg-[var(--wk-surface-raised)] transition-colors"
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">Label</div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{release.labelName}</div>
            </div>
            <i className="ri-arrow-right-line text-[var(--wk-text-muted)] text-lg" />
          </Link>
        )}

        {/* Related Releases */}
        {related.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]">More releases</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {related.slice(0, 6).map((r) => (
                <Link
                  key={r.slug}
                  to={`/releases/${slugify(r.artist)}/${r.slug}`}
                  className="group flex flex-col"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-[var(--wk-bg)] border border-[var(--wk-border)] mb-2">
                    {r.artworkUrl ? (
                      <img src={r.artworkUrl} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-album-line text-[var(--wk-text-faint)] text-2xl" />
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] font-extrabold text-[var(--wk-text)] truncate">{r.title}</div>
                  <div className="text-[10px] text-[var(--wk-text-muted)] truncate">{r.year}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Browse catalog CTA */}
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-center">
          <p className="text-[13px] font-semibold text-[var(--wk-text-soft)]">Browse the full release catalog</p>
          <Link to="/releases" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-white active:scale-[0.97] transition-transform whitespace-nowrap">
            <i className="ri-album-line" />
            All releases
          </Link>
        </div>
      </div>

      {/* Community Section */}
      <div className="px-5 pb-6">
        <CommunitySection entity={communityEntity} user={user} />
      </div>

    </div>
  );
}