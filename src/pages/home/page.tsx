import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkButton } from "@/components/design-system/primitives/Button";
import { usePlayer } from "@/context/PlayerContext";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import {
  SkeletonCard,
  SkeletonStoryCard,
} from "@/components/skeletons/Skeletons";
import {
  listArtists,
  listReleases,
  listMagazineStories,
  releaseUrl,
  type RepairedArtist,
  type RepairedRelease,
  type RepairedStory,
} from "@/services/repairedContent/client";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
  type ChartEditionEntry,
} from "@/services/chartsPublic/client";

function SectionHeader({
  eyebrow,
  title,
  action,
  actionHref,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <div className="wk-eyebrow mb-3">{eyebrow}</div>
        <h2 className="font-black text-[clamp(26px,3vw,38px)] leading-[0.95] tracking-[-0.04em] text-[var(--wk-text)]">
          {title}
        </h2>
      </div>
      {action && actionHref && (
        <Link to={actionHref} className="hidden md:block">
          <WkButton variant="ghost">
            {action} <i className="ri-arrow-right-line" />
          </WkButton>
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const { playTrack } = usePlayer();

  const [chartEntries, setChartEntries] = useState<ChartEditionEntry[]>([]);
  const [artists, setArtists] = useState<RepairedArtist[]>([]);
  const [releases, setReleases] = useState<RepairedRelease[]>([]);
  const [stories, setStories] = useState<RepairedStory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [artistsData, releasesData, storiesData] = await Promise.all([
        listArtists(),
        listReleases(),
        listMagazineStories(),
      ]);
      setArtists(artistsData);
      setReleases(releasesData);
      setStories(storiesData);

      const { data: families } = await getChartFamilies();
      if (families.length > 0) {
        const featuredSlug =
          families[0].publicSlug ??
          families[0].slug ??
          families[0].familyKey;
        const { data: edition } = await getLatestChartEdition(featuredSlug);
        if (edition) {
          const { data: entries } = await getChartEditionEntries(
            featuredSlug,
            edition.slug
          );
          setChartEntries(entries);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load data";
      setLoadError(message);
      // eslint-disable-next-line no-console
      console.error("Home page data load failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const topEntry = chartEntries[0];
  const chartRest = chartEntries.slice(1, 10);

  const chartTracks = chartEntries.map((entry) => ({
    id:
      entry.trackSlug ||
      `${entry.trackTitle}-${entry.artistNames?.[0] || ""}`
        .toLowerCase()
        .replace(/\s+/g, "-"),
    title: entry.trackTitle,
    artist: entry.artistNames?.[0] || "Unknown",
    artworkUrl: entry.artworkUrl || undefined,
    isPlayable: entry.isPlayable ?? true,
  }));

  const handlePlayChart = (idx: number) => {
    playTrack(chartTracks[idx], chartTracks);
  };

  const featuredArtists = artists.filter((a) => a.isChartArtist).slice(0, 6);
  const recentReleases = releases.slice(0, 6);
  const trendingTracks = chartEntries.slice(1, 7).map((entry) => ({
    slug: entry.trackSlug,
    title: entry.trackTitle,
    artist: entry.artistNames?.[0] || "Unknown",
    streamCount: entry.score ? `${Math.round(entry.score / 100)}K` : "—",
    chartPosition: entry.rank,
    isPlayable: entry.isPlayable ?? true,
    source: entry.source || "WAKILISHA",
    artworkUrl: entry.artworkUrl || "",
  }));

  const editorialStories = stories.slice(0, 5);

  return (
    <div className="min-h-screen">
      {/* Hero — full-bleed, cinematic, minimal copy */}
      <section
        ref={heroRef}
        className="relative h-[100dvh] flex items-end overflow-hidden"
      >
        {/* Background image — full bleed with parallax + zoom */}
        <div
          className="absolute inset-0 animate-hero-img"
          style={{
            transform: `translateY(${scrollY * 0.12}px) scale(${1 + scrollY * 0.0002})`,
          }}
        >
          <img
            src="https://readdy.ai/api/search-image?query=Dynamic%20cinematic%20close-up%20of%20a%20vinyl%20record%20spinning%20on%20a%20turntable%20with%20dramatic%20warm%20golden%20and%20green%20neon%20lighting%20streaks%2C%20dark%20moody%20African%20music%20studio%20atmosphere%2C%20professional%20editorial%20photography%2C%20abstract%20bokeh%20light%20particles%2C%20high%20contrast%20between%20vibrant%20colors%20and%20deep%20black%20background%2C%20premium%20music%20culture%20aesthetic%2C%20no%20text%2C%20sharp%20focus%2C%20ultra%20detailed&width=1600&height=900&seq=hero-home-cinematic-v2&orientation=landscape"
            alt="African music culture"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

        {/* Content — minimal, staggered entrance */}
        <div className="relative z-10 w-full px-6 pb-20 md:pb-28">
          <div className="wk-container-wide">
            <div
              className="mb-4 flex items-center gap-3 animate-hero-fade"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)] animate-pulse" />
              <span className="text-[11px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">
                Week 132 — May 2026
              </span>
            </div>

            <h1
              className="max-w-[720px] font-black leading-[0.92] tracking-[-0.05em] text-white animate-hero-fade"
              style={{
                fontSize: "clamp(40px, 5.5vw, 88px)",
                animationDelay: "0.5s",
              }}
            >
              The definitive voice in African music.
            </h1>

            <div
              className="mt-8 animate-hero-fade"
              style={{ animationDelay: "0.7s" }}
            >
              <Link to="/charts">
                <WkButton variant="primary">
                  <i className="ri-bar-chart-line" />
                  View the chart
                </WkButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Error banner */}
      {loadError && (
        <section className="bg-[var(--wk-danger-soft)] px-6 py-3">
          <div className="wk-container-wide flex items-center gap-2 text-[13px] text-[var(--wk-danger)]">
            <i className="ri-error-warning-line" />
            <span>Some data could not load: {loadError}</span>
            <button
              onClick={loadData}
              className="ml-auto font-bold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </section>
      )}

      {/* Official Chart — the main event, full-width, artwork-driven */}
      <section className="py-16 md:py-24">
        <div className="wk-container-wide px-6">
          <SectionHeader
            eyebrow="Official Chart"
            title="Top 10"
            action="Full chart"
            actionHref="/charts"
          />

          {/* #1 Spotlight */}
          {topEntry ? (
            <div className="mb-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
              <div className="grid md:grid-cols-[280px_1fr]">
                <div className="relative aspect-square md:aspect-auto bg-[var(--wk-surface-raised)]">
                  {topEntry.artworkUrl ? (
                    <img
                      src={topEntry.artworkUrl}
                      alt={topEntry.trackTitle}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <i className="ri-album-line text-5xl text-[var(--wk-text-faint)]" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-black text-[20px]">
                      1
                    </div>
                  </div>
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <WkTag variant="brand">#1 This Week</WkTag>
                    <span className="text-[12px] text-[var(--wk-text-muted)]">
                      {topEntry.weeksOnChart ?? 1} weeks on chart
                    </span>
                  </div>
                  <h3 className="text-[clamp(24px,3vw,36px)] font-black tracking-tight text-[var(--wk-text)]">
                    {topEntry.trackTitle}
                  </h3>
                  <div className="text-[16px] text-[var(--wk-text-muted)] mt-1">
                    {topEntry.artistNames?.[0] || "Unknown"}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-[13px] text-[var(--wk-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-headphone-line" />{" "}
                      {topEntry.score
                        ? `${Math.round(topEntry.score / 100)}K`
                        : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-arrow-up-line text-[var(--wk-success)]" />{" "}
                      +{topEntry.movementAmount ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-music-2-line" />{" "}
                      {topEntry.genre || "Afrobeats"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-global-line" />{" "}
                      {topEntry.source || "WAKILISHA"}
                    </span>
                  </div>
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => handlePlayChart(0)}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90"
                    >
                      <i className="ri-play-fill" /> Play
                    </button>
                    <Link
                      to={`/tracks/${topEntry.trackSlug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)]"
                    >
                      <i className="ri-information-line" /> Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center text-[var(--wk-text-muted)]">
              {loading
                ? "Loading chart data…"
                : "No chart data available."}
            </div>
          )}

          {/* Positions 2-10 */}
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="border-b border-[var(--wk-divider)] px-5 py-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                Positions 2–10
              </span>
              <div className="flex items-center gap-3 text-[11px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-arrow-up-line text-[var(--wk-success)]" />{" "}
                  Up
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-arrow-down-line text-[var(--wk-danger)]" />{" "}
                  Down
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-subtract-line text-[var(--wk-text-faint)]" />{" "}
                  Same
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-star-line text-[var(--wk-brand)]" /> New
                </span>
              </div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5 py-3 animate-pulse"
                    >
                      <div className="h-12 w-12 rounded-lg bg-[var(--wk-surface-raised)]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)]" />
                        <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)]" />
                      </div>
                    </div>
                  ))
                : chartRest.map((entry) => (
                    <Link
                      key={entry.rank}
                      to={`/tracks/${entry.trackSlug}`}
                      className="group flex items-center gap-4 px-5 py-3 transition-all hover:bg-[var(--wk-surface-raised)]"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center font-black text-[18px] text-[var(--wk-text-faint)]">
                        {entry.rank}
                      </div>
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                        {entry.artworkUrl ? (
                          <img
                            src={entry.artworkUrl}
                            alt={entry.trackTitle}
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <i className="ri-music-2-line text-lg text-[var(--wk-text-faint)]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">
                            {entry.trackTitle}
                          </h3>
                          {entry.movement === "new" && (
                            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase">
                              New
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[13px] text-[var(--wk-text-muted)]">
                          {entry.artistNames?.[0] || "Unknown"}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-headphone-line" />{" "}
                          {entry.score
                            ? `${Math.round(entry.score / 100)}K`
                            : "—"}
                        </span>
                        <span>
                          {entry.weeksOnChart ?? 1} wks
                        </span>
                        <span className="rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px]">
                          {entry.genre || "Afrobeats"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[13px] font-bold shrink-0">
                        {entry.movement === "up" && (
                          <i className="ri-arrow-up-line text-[var(--wk-success)]" />
                        )}
                        {entry.movement === "down" && (
                          <i className="ri-arrow-down-line text-[var(--wk-danger)]" />
                        )}
                        {entry.movement === "same" && (
                          <i className="ri-subtract-line text-[var(--wk-text-faint)]" />
                        )}
                        {entry.movement === "new" && (
                          <i className="ri-star-line text-[var(--wk-brand)]" />
                        )}
                        {entry.movementAmount &&
                          entry.movementAmount > 0 &&
                          entry.movement !== "new" && (
                            <span
                              style={{
                                color:
                                  entry.movement === "up"
                                    ? "var(--wk-success)"
                                    : "var(--wk-danger)",
                              }}
                            >
                              {entry.movementAmount}
                            </span>
                          )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const idx = chartEntries.findIndex(
                            (c) => c.rank === entry.rank
                          );
                          if (idx >= 0) handlePlayChart(idx);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
                        aria-label="Play"
                      >
                        <i className="ri-play-fill text-sm" />
                      </button>
                    </Link>
                  ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trending Tracks — image-driven horizontal shelf */}
      <section
        className="py-16 md:py-24"
        style={{ background: "var(--wk-bg-subtle)" }}
      >
        <div className="wk-container-wide px-6">
          <SectionHeader
            eyebrow="Trending"
            title="Rising fast"
            action="All charts"
            actionHref="/charts"
          />

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-none w-[220px] animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden"
                  >
                    <div className="aspect-square bg-[var(--wk-surface-raised)]" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                      <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                    </div>
                  </div>
                ))
              : trendingTracks.map((track) => (
                  <Link
                    key={track.slug}
                    to={`/tracks/${track.slug}`}
                    className="group flex-none w-[220px] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-music-2-line text-3xl text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold">
                          <i className="ri-fire-line" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-[14px] font-bold text-[var(--wk-text)] truncate">
                        {track.title}
                      </h3>
                      <div className="text-[12px] text-[var(--wk-text-muted)] truncate">
                        {track.artist}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-headphone-line" />{" "}
                          {track.streamCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-bar-chart-line" /> #{track.chartPosition}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* New Releases — image grid */}
      <section className="py-16 md:py-24">
        <div className="wk-container-wide px-6">
          <SectionHeader
            eyebrow="Fresh"
            title="New releases"
            action="All releases"
            actionHref="/search"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden"
                  >
                    <div className="aspect-square bg-[var(--wk-surface-raised)]" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                      <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                    </div>
                  </div>
                ))
              : recentReleases.map((release) => (
                  <Link
                    key={release.slug}
                  to={releaseUrl(release)}
                    className="group block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                      {release.artworkUrl ? (
                        <img
                          src={release.artworkUrl}
                          alt={release.title}
                          className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-standard)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-album-line text-3xl text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-[13px] font-bold text-[var(--wk-text)] truncate">
                        {release.title}
                      </h3>
                      <div className="text-[12px] text-[var(--wk-text-muted)] truncate">
                        {release.artist}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <WkTag>{release.releaseType}</WkTag>
                        <span className="text-[11px] text-[var(--wk-text-faint)]">
                          {release.year}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Featured Artists */}
      <section
        className="py-16 md:py-24"
        style={{ background: "var(--wk-bg-subtle)" }}
      >
        <div className="wk-container-wide px-6">
          <SectionHeader
            eyebrow="Registry"
            title="Featured artists"
            action="All artists"
            actionHref="/artists"
          />

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : featuredArtists.map((artist) => (
                  <ArtistCard key={artist.slug} {...artist} />
                ))}
          </div>
        </div>
      </section>

      {/* Editorial / Magazine */}
      <section className="py-16 md:py-24">
        <div className="wk-container-wide px-6">
          <SectionHeader
            eyebrow="Magazine"
            title="Editorial"
            action="Open magazine"
            actionHref="/magazine"
          />

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="lg:row-span-2">
              {loading ? (
                <SkeletonStoryCard />
              ) : editorialStories[0] ? (
                <StoryCard {...editorialStories[0]} isFeatured />
              ) : null}
            </div>
            <div className="flex flex-col gap-3">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonStoryCard key={i} />)
                : editorialStories.slice(1, 5).map((story) => (
                    <StoryCard key={story.slug} {...story} />
                  ))}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section
        className="py-16 md:py-24"
        style={{ background: "var(--wk-bg-subtle)" }}
      >
        <div className="wk-container-wide px-6">
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 md:p-12">
            <div className="max-w-[520px]">
              <div className="wk-eyebrow mb-4">WAKILISHA Weekly</div>
              <h2 className="font-black text-[clamp(22px,2.5vw,32px)] leading-[1.02] tracking-[-0.03em] text-[var(--wk-text)] mb-3">
                The chart, in your inbox.
              </h2>
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-6">
                Weekly chart updates, artist spotlights, and breaking stories
                from the African music ecosystem.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:outline-none focus:border-[var(--wk-brand)]/50"
                  />
                </div>
                <WkButton variant="primary">
                  <i className="ri-mail-send-line" />
                  Subscribe
                </WkButton>
              </div>
              <div className="mt-4 flex items-center gap-4 text-[11px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-shield-check-line" /> No spam
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-close-circle-line" /> Unsubscribe anytime
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}