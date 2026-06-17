import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkButton } from "@/components/design-system/primitives/Button";
import { MetaTags } from "@/components/seo/MetaTags";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { getRelease, listReleases, releaseUrl, slugify, type RepairedReleaseDetail, type RepairedRelease } from "@/services/repairedContent/client";
import { buildReleaseSeoDescription, releaseEmptyStateCopy } from "@/services/cultureContext/releaseAdapters";
import ReleaseDetailHero from "./components/ReleaseDetailHero";
import ReleaseTracklist from "./components/ReleaseTracklist";
import ReleaseMetadata from "./components/ReleaseMetadata";
import ReleaseRelatedReleases from "./components/ReleaseRelatedReleases";
import ReleaseExcerpt from "./components/ReleaseExcerpt";
import ReleaseFeaturedArtists from "./components/ReleaseFeaturedArtists";

export default function ReleaseDetail() {
  const { artistSlug, releaseSlug } = useParams<{ artistSlug: string; releaseSlug: string }>();
  const [release, setRelease] = useState<RepairedReleaseDetail | null>(null);
  const [related, setRelated] = useState<RepairedRelease[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const { ref: artistRef, revealed: artistRevealed } = useScrollReveal<HTMLDivElement>(0.1);

  const load = useCallback(async () => {
    if (!artistSlug || !releaseSlug) {
      setStatus("error");
      setError("We need an artist and release before we can open this shelf.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const [data, allReleases] = await Promise.all([
        getRelease(artistSlug, releaseSlug),
        listReleases(),
      ]);
      if (data) {
        setRelease(data);
        const rel = allReleases
          .filter((r) => r.slug !== releaseSlug && (r.artist === data.artist || r.labelName === data.labelName || r.releaseType === data.releaseType))
          .slice(0, 4);
        setRelated(rel);
        setStatus("ready");
        return;
      }
    } catch (err) {
      console.error("Release fetch failed:", err);
    }
    setStatus("error");
    setError("We do not have this release page ready yet.");
  }, [artistSlug, releaseSlug]);

  useEffect(() => {
    let alive = true;
    load().then(() => {
      if (!alive) return;
    });
    return () => { alive = false; };
  }, [load]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center">
          <i className="ri-album-line mb-4 block text-5xl text-[var(--wk-text-faint)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Opening release...</p>
        </div>
      </main>
    );
  }

  if (status === "error" || !release) {
    const empty = releaseEmptyStateCopy(false);
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-md mx-auto text-center">
          <i className="ri-album-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">{empty.title}</h1>
          <p className="text-[var(--wk-text-muted)]">{error || empty.body}</p>
          <Link to="/releases" className="mt-6 inline-block">
            <WkButton variant="primary">{empty.action}</WkButton>
          </Link>
        </div>
      </main>
    );
  }

  const minutes = release.totalDuration ? Math.round(release.totalDuration / 60) : release.trackCount * 3;
  const chartStats = release.chartStats;
  const seoDescription = buildReleaseSeoDescription(release);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* SEO */}
      <MetaTags
        title={`${release.title} by ${release.artist}`}
        description={seoDescription}
        imageUrl={release.artworkUrl}
        type="music.album"
        artistName={release.artist}
        releaseDate={release.releaseDate}
      />

      {/* Hero */}
      <ReleaseDetailHero release={release} minutes={minutes} />

      {/* Content */}
      <div className="wk-container-wide px-6 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-10 md:space-y-14">
            {/* Editorial Excerpt */}
            <ReleaseExcerpt release={release} />

            {/* Chart Performance if release tracks have chart data */}
            {chartStats && chartStats.totalChartAppearances > 0 && (
              <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5 md:p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                    <WkIcon name="BarChart3" size={12} />
                    Chart moments
                  </div>
                  <h2 className="text-[18px] md:text-[22px] font-black text-[var(--wk-text)] tracking-[-0.02em]">
                    How this release moved
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-4 text-center">
                    <div className="text-[28px] font-black text-[var(--wk-brand)] leading-none">
                      {chartStats.totalChartAppearances}
                    </div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-2">
                      Chart moments
                    </div>
                  </div>
                  {chartStats.topPeakPosition != null && (
                    <div className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-4 text-center">
                      <div className="text-[28px] font-black text-[var(--wk-text)] leading-none">
                        #{chartStats.topPeakPosition}
                      </div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-2">
                        Highest position
                      </div>
                    </div>
                  )}
                  <div className="border border-[var(--wk-border)] rounded-xl bg-[var(--wk-bg)] p-4 text-center">
                    <div className="text-[28px] font-black text-[var(--wk-text)] leading-none">
                      {chartStats.totalWeeksOnChart}
                    </div>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-2">
                      Weeks here
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Tracklist */}
            <ReleaseTracklist release={release} tracks={release.tracks} artistSlug={artistSlug} />

            {/* Featured Artists Grid */}
            <ReleaseFeaturedArtists
              artists={release.featuredArtists || []}
              releaseArtist={release.artist}
            />

            {/* Related Releases */}
            <ReleaseRelatedReleases
              releases={related}
              currentReleaseSlug={releaseSlug || ""}
              artistName={release.artist}
            />

            {/* Artist link */}
            <div ref={artistRef} className={`${artistRevealed ? "is-visible" : ""} reveal-up`}>
              <section className="border border-[var(--wk-border)] rounded-2xl bg-[var(--wk-surface)] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-1">
                      <WkIcon name="User" size={12} className="inline mr-1" />
                      Artist
                    </div>
                    <div className="text-[18px] font-extrabold text-[var(--wk-text)]">{release.artist}</div>
                    <div className="text-[12px] font-semibold text-[var(--wk-text-muted)] mt-1">
                      Start here if this release put you on.
                    </div>
                  </div>
                  <Link
                    to={`/artists/${slugify(release.artist)}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-2.5 text-[13px] font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors whitespace-nowrap"
                  >
                    View artist
                    <WkIcon name="ArrowUpRight" size={13} />
                  </Link>
                </div>
              </section>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[340px] flex-shrink-0">
            <ReleaseMetadata
              release={release}
              related={related}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
