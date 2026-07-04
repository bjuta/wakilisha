import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { trackEvent } from "@/services/analytics";
import {
  getChartFamily,
  getLatestChartEditionWithEntries,
  getChartEdition,
  getChartEditionEntries,
  getChartEditionsForFamily,
} from "@/services/chartsPublic/client";
import type { ChartEditionEntry } from "@/services/chartsPublic/types";
import {
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  toChartArchiveViewModel,
  type ChartEditionViewModel,
  type ChartEntryRowViewModel,
  type ChartArchiveViewModel,
} from "@/services/chartsPublic/viewModels";
import {
  getLegacyRedirectTarget,
  normalizeChartProgramSlug,
  getCanonicalChartPath,
  isLegacyChartSlug,
  getSourceFamilySlug,
  getCanonicalChartPathFromSlugs,
} from "@/services/chartsPublic/chartRoutes";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";
import { WkIcon } from "@/components/design-system/Icon";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ArtistRolodex } from "@/pages/charts/directory/components/ArtistRolodex";
import { SkeletonChartEdition } from "@/components/skeletons/Skeletons";
import { trackUrl } from "@/utils/trackUrl";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import { enrichChartEntriesWithPlaybackData } from "@/services/chartsPublic/playbackEnrichment";
import {
  ContextAnchorCommentDrawer,
  ContextAnchorSummary,
  type ContextAnchorTarget,
} from "@/components/feature/community/ContextAnchorCommentDrawer";
import type { ContextAnchorSummaryItem } from "@/services/community";
import { PlaybackAccessNotice } from "@/components/playback/PlaybackAccessNotice";

const rankTone = (rank: number) =>
  rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("chart-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -36px 0px" },
    );
    const els = document.querySelectorAll(".chart-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

export default function ChartEdition() {
  const {
    family,
    market,
    series,
    edition: editionSlug,
  } = useParams<{ family?: string; market?: string; series?: string; edition?: string }>();

  const rawChartProgramSlug = family && market && series
    ? `${family}/${market}/${series}`
    : series ?? "";

  const chartProgramSlug = normalizeChartProgramSlug(rawChartProgramSlug);
  const chartMarketSlug = (market ?? "").toLowerCase();
  const navigate = useNavigate();
  const { playTrack } = usePlayer();

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string; diagnostics?: string; retryable?: boolean }
    | { status: "family_not_found" }
    | { status: "edition_not_found"; familySlug: string; familyLabel: string; marketSlug: string; latestEditionSlug?: string }
    | { status: "empty" }
    | {
        status: "loaded";
        edition: ChartEditionViewModel;
        entries: ChartEntryRowViewModel[];
        familyLabel: string;
        familySlug: string;
        publicSlug: string;
        marketSlug: string;
        sourceFamilySlug: string;
        archive: ChartArchiveViewModel;
        meta: { dataSource: "mock" | "wordpress" | "cache"; fetchedAt: string; isStale: boolean };
        canonicalized: boolean;
        requestedSlug: string;
      }
  >({ status: "loading" });

  const load = useCallback(async () => {
    if (!chartProgramSlug) {
      setState({ status: "family_not_found" });
      return;
    }
    setState({ status: "loading" });
    try {
      const { data: family } = await getChartFamily(chartProgramSlug, chartMarketSlug);
      if (!family) {
        setState({ status: "family_not_found" });
        return;
      }

      const publicSlug = family.publicSlug ?? family.slug ?? family.familyKey;
      const marketSlug = (family.marketSlug ?? "").toLowerCase();
      const sourceFamilySlug = getSourceFamilySlug(family);

      // Redirect legacy slugs to canonical family slug
      const canonicalized = isLegacyChartSlug(series);
      if (canonicalized) {
        const redirectTarget = getLegacyRedirectTarget(rawChartProgramSlug, editionSlug);
        if (redirectTarget) {
          navigate(redirectTarget, { replace: true });
          return;
        }
      }

      // Redirect 2-segment URLs to canonical 3-segment when market is available
      if (!market && editionSlug && (family.marketSlug)) {
        navigate(`/charts/${publicSlug}/${marketSlug.toLowerCase()}/${editionSlug}`, { replace: true });
        return;
      }

      let editionResult: Awaited<ReturnType<typeof getChartEdition>>;
      let editionMeta: { source: "mock" | "wordpress" | "cache"; fetchedAt: string; isStale: boolean };
      let rawEntries: ChartEditionEntry[] = [];

      if (editionSlug) {
        const result = await getChartEdition(chartProgramSlug, editionSlug, chartMarketSlug);
        editionResult = result;
        editionMeta = result.meta;
        if (result.data) {
          const entriesResult = await getChartEditionEntries(chartProgramSlug, result.data.slug, chartMarketSlug);
          rawEntries = entriesResult.data;
        }
      } else {
        const result = await getLatestChartEditionWithEntries(chartProgramSlug, chartMarketSlug);
        editionMeta = result.meta;
        if (result.data.edition) {
          editionResult = {
            data: result.data.edition,
            meta: result.meta,
          };
          rawEntries = result.data.entries;
        } else {
          editionResult = { data: null as any, meta: result.meta };
        }
      }

      if (!editionResult.data) {
        const { data: latestResult } = await getLatestChartEditionWithEntries(chartProgramSlug, chartMarketSlug);
        setState({
          status: "edition_not_found",
          familySlug: chartProgramSlug,
          familyLabel: family.label,
          marketSlug: (family.marketSlug ?? "").toLowerCase(),
          latestEditionSlug: latestResult.edition?.slug,
        });
        return;
      }

      if (rawEntries.length === 0) {
        setState({ status: "empty" });
        return;
      }

      // Entries are auto-enriched with real movement data by getChartEditionEntries

      rawEntries = await enrichChartEntriesWithPlaybackData(rawEntries);

      const entries = rawEntries.map(toChartEntryRowViewModel);
      const editionVM = toChartEditionViewModel(editionResult.data, family, rawEntries);

      // Load all editions for archive and navigation
      const { data: allEditions } = await getChartEditionsForFamily(chartProgramSlug, chartMarketSlug);
      const sortedEditions = [...allEditions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const archiveEditions = sortedEditions.slice(0, 4);

      const entriesMap: Record<string, import("@/services/chartsPublic/types").ChartEditionEntry[]> = {
        [editionResult.data.slug]: rawEntries,
      };

      const otherArchiveEditions = archiveEditions.filter(
        (e) => e.slug !== editionResult.data!.slug
      );
      await Promise.all(
        otherArchiveEditions.slice(0, 3).map(async (ed) => {
          try {
            const { data: edEntries } = await getChartEditionEntries(chartProgramSlug, ed.slug, chartMarketSlug);
            entriesMap[ed.slug] = edEntries;
          } catch {
            entriesMap[ed.slug] = [];
          }
        })
      );

      const archive = toChartArchiveViewModel(allEditions, entriesMap);

      setState({
        status: "loaded",
        edition: editionVM,
        entries,
        familyLabel: family.label,
        familySlug: chartProgramSlug,
        publicSlug,
        marketSlug: family.marketSlug ?? "",
        sourceFamilySlug,
        archive,
        meta: editionMeta,
        canonicalized,
        requestedSlug: chartProgramSlug,
      });
    } catch (err) {
      const isRetryable = err instanceof Error && (err.message.includes("timeout") || err.message.includes("Network error"));
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        diagnostics: err instanceof Error ? err.stack : undefined,
        retryable: isRetryable,
      });
    }
  }, [chartProgramSlug, chartMarketSlug, series, editionSlug, navigate]);

  useEffect(() => { load(); setDisplayedCount(20); }, [load]);
  const handleRetry = () => load();

  const loadedState = state.status === "loaded" ? state : null;

  const chartTracks = useMemo(
    () => loadedState?.entries.map(toChartTrackPlayerModel) ?? [],
    [loadedState?.entries]
  );

  const newEntries = useMemo(
    () => loadedState?.entries.filter((e) => e.movement === "new").slice(0, 5) ?? [],
    [loadedState?.entries]
  );
  const climbers = useMemo(
    () =>
      (loadedState?.entries ?? [])
        .filter((e) => e.movement === "up")
        .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))
        .slice(0, 5),
    [loadedState?.entries]
  );

  const genreBreakdown = useMemo(() => {
    const counts = (loadedState?.entries ?? []).reduce<Record<string, number>>((acc, entry) => {
      const genre = entry.genre || "Unknown";
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, count]) => ({ genre, count }));
  }, [loadedState?.entries]);

  const biggestUpMover = useMemo(() => {
    const upMovers = (loadedState?.entries ?? []).filter(
      (e) => e.movement === "up" && e.previousRank !== null
    );
    if (upMovers.length === 0) return null;
    return upMovers.reduce((best, e) =>
      ((e.movementAmount ?? 0) > (best.movementAmount ?? 0)) ? e : best
    );
  }, [loadedState?.entries]);

  const biggestDownMover = useMemo(() => {
    const downMovers = (loadedState?.entries ?? []).filter(
      (e) => e.movement === "down" && e.previousRank !== null
    );
    if (downMovers.length === 0) return null;
    return downMovers.reduce((worst, e) =>
      ((e.movementAmount ?? 0) > (worst.movementAmount ?? 0)) ? e : worst
    );
  }, [loadedState?.entries]);

  // Detect whether ANY entry has usable movement data
  const hasMovementData = useMemo(
    () => (loadedState?.entries ?? []).some(
      (e) => e.previousRank !== null && (e.movement === "up" || e.movement === "down")
    ),
    [loadedState?.entries]
  );

  const [displayedCount, setDisplayedCount] = useState(20);
  const PAGE_SIZE = 12;
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const [selectedChartAnchor, setSelectedChartAnchor] = useState<ContextAnchorTarget | null>(null);

  const handleJumpTo = useCallback((slug: string) => {
    setHighlightedSlug(slug);
    setTimeout(() => {
      document.getElementById(`edition-entry-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 280);
    setTimeout(() => setHighlightedSlug(null), 2600);
  }, []);

  const playAt = useCallback((idx: number, sourceSection = "chart_leaderboard") => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks, {
      pageType: "charts_edition",
      entitySlug: editionSlug,
      entityType: "chart_edition",
      sourceSection,
    });
  }, [chartTracks, playTrack, editionSlug]);

  const playChart = useCallback((sourceSection = "chart_hero") => {
    const firstPlayable = chartTracks.find((track) => track.isPlayable !== false);
    if (!firstPlayable) return;
    playTrack(firstPlayable, chartTracks, {
      pageType: "charts_edition",
      entitySlug: editionSlug,
      entityType: "chart_edition",
      sourceSection,
    });
  }, [chartTracks, playTrack, editionSlug]);

  const openChartEntryDiscussion = useCallback((
    entry: ChartEntryRowViewModel,
    chartLabel?: string,
  ) => {
    const movement =
      entry.movement === "new"
        ? "New entry"
        : entry.movement === "up"
          ? `Up ${entry.movementAmount ?? 0}`
          : entry.movement === "down"
            ? `Down ${entry.movementAmount ?? 0}`
            : "Holding";

    setSelectedChartAnchor({
      anchorType: "chart_entry",
      contextEntityType: "chart_entry",
      contextEntityId: `${editionSlug || "latest"}:${entry.rank}:${entry.slug}`,
      contextEntitySlug: `${editionSlug || "latest"}-${entry.slug}`,
      contextLabel: `#${entry.rank} · ${entry.title}`,
      anchorLabel: `#${entry.rank}`,
      title: `${entry.title} at #${entry.rank}`,
      subtitle: `${chartLabel || "Chart edition"} · ${entry.artist} · ${movement}`,
      imageUrl: entry.artworkUrl || undefined,
      placeholder: `Talk about why ${entry.title} is #${entry.rank}...`,
    });
  }, [editionSlug]);

  // ─── Parallax hero scroll ───
  const heroImgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (state.status !== "loaded") return;
    const img = heroImgRef.current;
    if (!img) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const p = Math.min(scrollY / 600, 1);
      img.style.transform = `scale(${1 + p * 0.06})`;
      img.style.opacity = String(Math.max(0.7 - p * 0.25, 0.35));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [state.status]);

  useScrollReveal([state.status]);

  // ─── Loading state ───
  if (state.status === "loading") {
    return <SkeletonChartEdition />;
  }

  // ─── Error state ───
  if (state.status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="max-w-md mx-auto text-center px-6">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="text-[24px] font-black tracking-[-.03em] text-[var(--wk-text)] mb-2">Could not load chart</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6">{state.error}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRetry} className="chart-hero-v2-cta">
              <i className="ri-refresh-line" /> Retry
            </button>
            <Link to="/charts" className="chart-hero-v2-cta chart-hero-v2-cta-ghost">
              Back to charts
            </Link>
          </div>
          <PlaybackAccessNotice
            hasApplePlayback={hasApplePlaybackTracks}
            className="mt-3 max-w-xl"
          />
        </div>
      </main>
    );
  }

  // ─── Family not found ───
  if (state.status === "family_not_found") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="max-w-md mx-auto text-center px-6">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="text-[24px] font-black tracking-[-.03em] text-[var(--wk-text)] mb-2">Chart not found</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6">The chart family you are looking for does not exist.</p>
          <Link to="/charts" className="chart-hero-v2-cta">
            <i className="ri-arrow-left-line" /> Back to charts
          </Link>
        </div>
      </main>
    );
  }

  // ─── Edition not found ───
  if (state.status === "edition_not_found") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="max-w-md mx-auto text-center px-6">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="text-[24px] font-black tracking-[-.03em] text-[var(--wk-text)] mb-2">Edition not found</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6">
            The edition <code className="font-mono text-[12px] bg-[var(--wk-bg)] px-1 rounded">{editionSlug}</code> does not exist in the <strong>{state.familyLabel}</strong> family.
          </p>
          <div className="flex items-center justify-center gap-3">
            {state.latestEditionSlug && (
              <Link to={getCanonicalChartPathFromSlugs(state.familySlug, state.latestEditionSlug, state.marketSlug)} className="chart-hero-v2-cta">
                <i className="ri-arrow-right-line" /> Latest edition
              </Link>
            )}
            <Link to="/charts" className="chart-hero-v2-cta chart-hero-v2-cta-ghost">
              Back to charts
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ─── Empty state ───
  if (state.status === "empty") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="max-w-md mx-auto text-center px-6">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="text-[24px] font-black tracking-[-.03em] text-[var(--wk-text)] mb-2">This chart isn't live yet</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6">Check back once this edition has been compiled.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRetry} className="chart-hero-v2-cta">
              <i className="ri-refresh-line" /> Refresh
            </button>
            <Link to="/charts" className="chart-hero-v2-cta chart-hero-v2-cta-ghost">
              Back to charts
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ─── Loaded state ───
  const { edition, entries, familyLabel, familySlug, publicSlug, marketSlug, archive, meta, requestedSlug, canonicalized, sourceFamilySlug } = state;
  const topTrack = entries[0];
  const hasApplePlaybackTracks = chartTracks.some((track) => Boolean(track.appleMusicCatalogId || track.appleMusicId));
  const top3 = entries.slice(0, 3);
  const rows = entries.slice(3);
  const INITIAL_DISPLAY_COUNT = 20;
  const hasMoreEntries = rows.length > displayedCount;
  const canCollapse = displayedCount > INITIAL_DISPLAY_COUNT;
  const displayedRows = rows.slice(0, displayedCount);
  const nextLoadCount = Math.min(PAGE_SIZE, rows.length - displayedCount);
  const totalRemaining = rows.length - displayedCount;

  if (!entries.length || !topTrack) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="text-[24px] font-black text-[var(--wk-text)] mb-2">This chart is empty</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)]">No songs have been added to this edition yet.</p>
        </div>
      </main>
    );
  }

  const chartCommunityEntity = {
    type: "chart_edition" as const,
    id: edition.slug,
    slug: edition.slug,
    url: typeof window !== "undefined"
      ? window.location.href
      : getCanonicalChartPathFromSlugs(publicSlug, edition.slug, marketSlug),
    title: edition.publicLabel,
    subtitle: edition.label,
    imageUrl: topTrack.artworkUrl,
  };

  const openChartSummaryDiscussion = (item: ContextAnchorSummaryItem) => {
    setSelectedChartAnchor({
      anchorType: "chart_entry",
      contextEntityType: item.contextEntityType || "chart_entry",
      contextEntityId: item.contextEntityId,
      contextEntitySlug: item.contextEntitySlug,
      contextLabel: item.contextLabel || item.anchorLabel,
      anchorLabel: item.anchorLabel,
      title: item.contextLabel || item.anchorLabel,
      subtitle: edition.publicLabel,
      imageUrl: topTrack.artworkUrl,
      placeholder: `Add to the discussion about ${item.contextLabel || item.anchorLabel}...`,
    });
  };

  const metaLine = meta.isStale
    ? `Updated ${new Date(meta.fetchedAt).toLocaleString()}`
    : meta.dataSource === "cache"
    ? `Refreshed ${new Date(meta.fetchedAt).toLocaleString()}`
    : `Live · ${new Date(meta.fetchedAt).toLocaleTimeString()}`;

  // diagnostics kept server-side only

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="chart-hero-v2 -mt-16">
        <div className="chart-hero-v2-media">
          <img
            ref={heroImgRef}
            src={topTrack.artworkUrl}
            alt=""
            className="chart-hero-v2-img"
          />
        </div>
        <div className="chart-hero-v2-overlay" />
        <div className="chart-hero-v2-grain" />

        <div className="chart-hero-v2-content">
          {/* Date badge */}
          <div className="chart-hero-v2-issue-badge">
            <span className="chart-hero-v2-badge-num">{edition.date}</span>
            <span className="chart-hero-v2-badge-sep">·</span>
            <span>{edition.totalEntries} positions</span>
          </div>

          {/* Chart family eyebrow */}
          <div className="chart-hero-v2-eyebrow">
            <i className="ri-bar-chart-2-line text-[13px]" />
            {familyLabel}
          </div>

          <h1 className="chart-hero-v2-title">{edition.publicLabel}</h1>

          <p className="chart-hero-v2-sub">
            {edition.label}. {edition.totalEntries} ranked positions across {edition.totalArtists} artists, with {edition.newEntries} new entries this week.
          </p>

          {/* Metadata pills */}
          <div className="chart-hero-v2-meta-strip">
            <span className="chart-hero-v2-meta-pill">
              <span className="font-bold text-white/90">Chart series:</span> {edition.seriesLabel}
            </span>
            <span className="chart-hero-v2-meta-pill">
              <span className="font-bold text-white/90">Scene:</span> {edition.marketLabel}
            </span>
          </div>

          {/* CTAs */}
          <div className="chart-hero-v2-actions">
            <button onClick={() => playChart("chart_hero")} className="chart-hero-v2-cta">
              <WkIcon name="ListMusic" size={16} /> Play chart
            </button>
            <button onClick={() => playAt(0, "chart_no1")} className="chart-hero-v2-cta chart-hero-v2-cta-ghost">
              <WkIcon name="Play" size={16} /> Play #1
            </button>
            <button onClick={() => openChartEntryDiscussion(topTrack, edition.publicLabel)} className="chart-hero-v2-cta chart-hero-v2-cta-ghost">
              <WkIcon name="MessageCircle" size={16} /> Discuss #1
            </button>
            <Link to="/charts" className="chart-hero-v2-cta chart-hero-v2-cta-ghost">
              <WkIcon name="Archive" size={16} /> All charts
            </Link>
            <ShareButton
              item={{
                title: edition.publicLabel,
                subtitle: edition.label || "Current edition",
                description: edition.methodology,
                imageUrl: topTrack.artworkUrl,
                type: "chart",
              }}
            />
          </div>
        </div>

        {/* Scroll hint */}
        <div className="chart-hero-v2-scroll-hint">
          <div className="chart-hero-v2-scroll-line" />
          <span className="chart-hero-v2-scroll-text">Scroll to explore</span>
        </div>
      </section>

      {/* ═══════════════════════ STICKY SUBNAV ═══════════════════════ */}
      <nav className="chart-subnav">
        <div className="chart-subnav-inner">
          <div className="chart-subnav-label">
            <span className="chart-subnav-dot" />
            {familyLabel} · {edition.date}
          </div>
          <div className="chart-subnav-actions">
            <button onClick={() => playChart("chart_subnav")} className="chart-subnav-btn">
              <WkIcon name="ListMusic" size={13} /> Play chart
            </button>
            <Link to="/charts" className="chart-subnav-btn">
              <WkIcon name="Archive" size={13} /> All charts
            </Link>
            <ChartRefreshButton onRefresh={load} size="sm" />
          </div>
        </div>
      </nav>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="chart-page-body">

        {/* ── Archive Carousel ── */}
        {archive.previous.length > 0 && (
          <section className="chart-reveal">
            <div className="chart-section-header">
              <div className="chart-section-eyebrow">Edition history</div>
              <h2 className="chart-section-title">Recent editions</h2>
              <p className="chart-section-sub">Browse through previous editions of this chart family.</p>
            </div>
            <div className="chart-archive-carousel">
              {archive.latest && (
                <Link
                  to={`/charts/${publicSlug}/${marketSlug}/${archive.latest.slug}`}
                  className={`chart-archive-card ${archive.latest.slug === edition.slug ? "active" : ""}`}
                >
                  <span className="chart-archive-card-badge">Latest</span>
                  <span className="chart-archive-card-label">{archive.latest.label}</span>
                  <span className="chart-archive-card-date">{archive.latest.date} · {archive.latest.entryCount} entries</span>
                  {(archive.latest.newCount !== undefined || archive.latest.droppedCount !== undefined) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {archive.latest.newCount !== undefined && archive.latest.newCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--wk-success)]">
                          <i className="ri-arrow-up-line text-[10px]" />
                          {archive.latest.newCount} new
                        </span>
                      )}
                      {archive.latest.droppedCount !== undefined && archive.latest.droppedCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">
                          <i className="ri-arrow-down-line text-[10px]" />
                          {archive.latest.droppedCount} out
                        </span>
                      )}
                      {archive.latest.newCount === 0 && archive.latest.droppedCount === 0 && (
                        <span className="text-[10px] text-[var(--wk-text-faint)]">No changes</span>
                      )}
                    </div>
                  )}
                  {archive.latest.no1Track && (
                    <div className="chart-archive-card-no1">
                      <div className="chart-archive-card-art">
                        {archive.latest.no1Track.artworkUrl ? (
                          <img src={archive.latest.no1Track.artworkUrl} alt="" />
                        ) : (
                          <Ch19GradientImage slug={archive.latest.no1Track.slug || `archive-${archive.latest.slug}`} name={archive.latest.no1Track.title} />
                        )}
                      </div>
                      <span className="chart-archive-card-track">#{archive.latest.no1Track.title}</span>
                    </div>
                  )}
                </Link>
              )}
              {archive.previous.slice(0, 8).map((item) => (
                <Link
                  key={item.slug}
                  to={`/charts/${publicSlug}/${marketSlug}/${item.slug}`}
                  className={`chart-archive-card ${item.slug === edition.slug ? "active" : ""}`}
                >
                  <span className="chart-archive-card-label">{item.label}</span>
                  <span className="chart-archive-card-date">{item.date} · {item.entryCount} songs</span>
                  {(item.newCount !== undefined || item.droppedCount !== undefined) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.newCount !== undefined && item.newCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--wk-success)]">
                          <i className="ri-arrow-up-line text-[10px]" />
                          {item.newCount} new
                        </span>
                      )}
                      {item.droppedCount !== undefined && item.droppedCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--wk-danger)]">
                          <i className="ri-arrow-down-line text-[10px]" />
                          {item.droppedCount} out
                        </span>
                      )}
                      {item.newCount === 0 && item.droppedCount === 0 && (
                        <span className="text-[10px] text-[var(--wk-text-faint)]">No changes</span>
                      )}
                    </div>
                  )}
                  {item.no1Track && (
                    <div className="chart-archive-card-no1">
                      <div className="chart-archive-card-art">
                        {item.no1Track.artworkUrl ? (
                          <img src={item.no1Track.artworkUrl} alt="" />
                        ) : (
                          <Ch19GradientImage slug={item.no1Track.slug || `archive-${item.slug}`} name={item.no1Track.title} />
                        )}
                      </div>
                      <span className="chart-archive-card-track">#{item.no1Track.title}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Top 3 Podium ── */}
        <section className="chart-reveal">
          <div className="chart-section-header">
            <div className="chart-section-eyebrow">Podium</div>
            <h2 className="chart-section-title">Top 3 this week</h2>
          </div>
          <div className="chart-podium-v2">
            {top3.map((entry, idx) => (
              <Link
                key={`${entry.rank}-${entry.slug}`}
                to={trackUrl(entry.slug, entry.artistSlugs)}
                className="chart-podium-v2-card"
              >
                <img src={entry.artworkUrl} alt="" className="chart-podium-v2-img" />
                <div className="chart-podium-v2-overlay" />
                <div className={`chart-podium-v2-rank ${rankTone(entry.rank)}`}>{entry.rank}</div>
                <div className="chart-podium-v2-body">
                  <div className="chart-podium-v2-title">{entry.title}</div>
                  <div className="chart-podium-v2-artist">
                    {entry.artist}
                    {entry.movement === "new" ? " · NEW" : entry.movement === "up" ? ` · +${entry.movementAmount ?? 0}` : entry.movement === "down" ? ` · -${entry.movementAmount ?? 0}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(e) => { e.preventDefault(); playAt(idx); }}
                      className="chart-podium-v2-play"
                    >
                      <WkIcon name="Play" size={13} /> Play
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); openChartEntryDiscussion(entry, edition.publicLabel); }}
                      className="chart-podium-v2-play"
                    >
                      <WkIcon name="MessageCircle" size={13} /> Discuss
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Biggest Movers ── */}
        <section className="chart-reveal">
          <div className="chart-section-header">
            <div className="chart-section-eyebrow">Movement radar</div>
            <h2 className="chart-section-title">Biggest movers this week</h2>
            {hasMovementData ? (
              <p className="chart-section-sub">The tracks with the biggest rank changes this week. One moved up, one moved down.</p>
            ) : (
              <p className="chart-section-sub">This is the earliest edition available. Movement data will appear once a second edition is published.</p>
            )}
          </div>

          {hasMovementData ? (
            <div className="chart-movers-duet">
              {/* ── Biggest climber ── */}
              {biggestUpMover ? (
                <Link
                  to={trackUrl(biggestUpMover.slug, biggestUpMover.artistSlugs)}
                  className="chart-mover-card chart-mover-card--up"
                >
                  <div className="chart-mover-card-badge chart-mover-card-badge--up">
                    <i className="ri-arrow-up-line" />
                    <span>Biggest climber</span>
                  </div>

                  <div className="chart-mover-card-body">
                    <div className="chart-mover-card-art">
                      <img src={biggestUpMover.artworkUrl ?? undefined} alt="" />
                      <div className="chart-mover-card-rank-pip chart-mover-card-rank-pip--up">
                        #{biggestUpMover.rank}
                      </div>
                    </div>

                    <div className="chart-mover-card-info">
                      <div className="chart-mover-card-title">{biggestUpMover.title}</div>
                      <div className="chart-mover-card-artist">{biggestUpMover.artist}</div>

                      <div className="chart-mover-card-delta">
                        <span className="chart-mover-card-delta-val chart-mover-card-delta-val--up">
                          +{biggestUpMover.movementAmount ?? 0}
                        </span>
                        <span className="chart-mover-card-delta-range">
                          from #{biggestUpMover.previousRank} to #{biggestUpMover.rank}
                        </span>
                      </div>

                      <p className="chart-mover-card-story">
                        {biggestUpMover.rank <= 10
                          ? `This track climbed ${biggestUpMover.movementAmount ?? 0} positions into the top 10. No other entry moved up further this week.`
                          : biggestUpMover.rank <= 20
                          ? `This track climbed ${biggestUpMover.movementAmount ?? 0} positions in one week. No other entry gained more ground this edition.`
                          : `Biggest climb this week: ${biggestUpMover.movementAmount ?? 0} positions gained. This track made the strongest upward move in the edition.`}
                      </p>

                      <div className="chart-mover-card-context">
                        <span>{biggestUpMover.weeksOnChart || 0} weeks on chart</span>
                        <span className="opacity-40">·</span>
                        <span>Peak #{biggestUpMover.peakPosition}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="chart-mover-card chart-mover-card--empty">
                  <div className="chart-mover-card-badge chart-mover-card-badge--neutral">
                    <span>No climbers</span>
                  </div>
                  <p className="text-[14px] text-[var(--wk-text-muted)] text-center py-8">
                    No tracks moved up this week.
                  </p>
                </div>
              )}

              {/* ── Biggest fall ── */}
              {biggestDownMover ? (
                <Link
                  to={trackUrl(biggestDownMover.slug, biggestDownMover.artistSlugs)}
                  className="chart-mover-card chart-mover-card--down"
                >
                  <div className="chart-mover-card-badge chart-mover-card-badge--down">
                    <i className="ri-arrow-down-line" />
                    <span>Steepest drop</span>
                  </div>

                  <div className="chart-mover-card-body">
                    <div className="chart-mover-card-art">
                      <img src={biggestDownMover.artworkUrl ?? undefined} alt="" />
                      <div className="chart-mover-card-rank-pip chart-mover-card-rank-pip--down">
                        #{biggestDownMover.rank}
                      </div>
                    </div>

                    <div className="chart-mover-card-info">
                      <div className="chart-mover-card-title">{biggestDownMover.title}</div>
                      <div className="chart-mover-card-artist">{biggestDownMover.artist}</div>

                      <div className="chart-mover-card-delta">
                        <span className="chart-mover-card-delta-val chart-mover-card-delta-val--down">
                          −{biggestDownMover.movementAmount ?? 0}
                        </span>
                        <span className="chart-mover-card-delta-range">
                          from #{biggestDownMover.previousRank} to #{biggestDownMover.rank}
                        </span>
                      </div>

                      <p className="chart-mover-card-story">
                        {biggestDownMover.previousRank !== null && biggestDownMover.previousRank <= 10
                          ? `This track dropped ${biggestDownMover.movementAmount ?? 0} positions from the top 10. No other entry fell further this week.`
                          : biggestDownMover.previousRank !== null && biggestDownMover.previousRank <= 20
                          ? `This track slipped ${biggestDownMover.movementAmount ?? 0} positions. That is the largest downward move in this edition.`
                          : `Biggest drop this week: down ${biggestDownMover.movementAmount ?? 0} positions. No other entry lost more ground in this edition.`}
                      </p>

                      <div className="chart-mover-card-context">
                        <span>{biggestDownMover.weeksOnChart || 0} weeks on chart</span>
                        <span className="opacity-40">·</span>
                        <span>Peak #{biggestDownMover.peakPosition}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="chart-mover-card chart-mover-card--empty">
                  <div className="chart-mover-card-badge chart-mover-card-badge--neutral">
                    <span>No drops</span>
                  </div>
                  <p className="text-[14px] text-[var(--wk-text-muted)] text-center py-8">
                    No tracks dropped this week.
                  </p>
                </div>
              )}
            </div>
          ) : null}
          </section>

        {/* ── Full Leaderboard + Sidebar ── */}
        <section className="chart-reveal" id="chart-leaderboard">
          <div className="chart-section-header">
            <div className="chart-section-eyebrow">Full ranking</div>
            <h2 className="chart-section-title">Positions 4–{entries.length}</h2>
            <p className="chart-section-sub">Follow the full chart from number one to the new entries, big jumps, and songs refusing to leave.</p>
          </div>
          <div className="chart-body-grid">
            {/* Table */}
            <div className="chart-table-card-v2 flex flex-col gap-0.5 p-2">
              {displayedRows.map((entry, idx) => (
                <div
                  key={`${entry.rank}-${entry.slug}`}
                  id={`edition-entry-${entry.slug}`}
                  className={`rounded-xl transition-colors duration-700 ${highlightedSlug === entry.slug ? "bg-[var(--wk-brand-soft)]" : ""}`}
                >
                  <ChartRow
                    rank={entry.rank}
                    artworkUrl={entry.artworkUrl ?? undefined}
                    title={entry.title}
                    artist={entry.artist}
                    artistNames={entry.artistNames}
                    artistSlugs={entry.artistSlugs}
                    movement={entry.movement}
                    movementAmount={entry.movementAmount ?? undefined}
                    previousRank={entry.previousRank}
                    weeksOnChart={entry.weeksOnChart}
                    peakPosition={entry.peakPosition}
                    isPlayable={entry.isPlayable}
                    source={entry.source}
                    genre={entry.genre ?? undefined}
                    slug={entry.slug}
                    score={entry.score}
                    duration={entry.duration}
                    onPlay={() => playAt(idx + 3)}
                  />
                  <div className="flex justify-end px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => openChartEntryDiscussion(entry, edition.publicLabel)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)] transition-colors hover:border-[var(--wk-brand)]/35 hover:text-[var(--wk-brand)]"
                    >
                      <WkIcon name="MessageCircle" size={11} />
                      Discuss entry
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <aside className="chart-sidebar-v2">
              {/* New entries */}
              <div className="chart-sidebox-v2">
                <div className="chart-sidebox-v2-title">New entries</div>
                {newEntries.map((entry) => (
                  <Link
                    key={`new-${entry.rank}-${entry.slug}`}
                    to={trackUrl(entry.slug, entry.artistSlugs)}
                    className="chart-sidebox-v2-row"
                  >
                    <span className="chart-sidebox-v2-row-metric">NEW</span>
                    <div className="chart-sidebox-v2-row-art">
                      <img src={entry.artworkUrl} alt="" />
                    </div>
                    <div className="min-w-0">
                      <div className="chart-sidebox-v2-row-name">{entry.title}</div>
                      <div className="chart-sidebox-v2-row-sub">{entry.artist}</div>
                    </div>
                    <WkIcon name="ArrowRightS" size={13} />
                  </Link>
                ))}
                {newEntries.length === 0 && (
                  <p className="text-[12px] text-[var(--wk-text-faint)] py-2">No new entries this week.</p>
                )}
              </div>

              <ContextAnchorSummary
                entity={chartCommunityEntity}
                anchorType="chart_entry"
                eyebrow="Chart conversations"
                title="Entry discussions"
                subtitle="Where listeners are talking about chart movement."
                onSelect={openChartSummaryDiscussion}
              />

              {/* Biggest climbers */}
              <div className="chart-sidebox-v2">
                <div className="chart-sidebox-v2-title">Biggest climbers</div>
                {climbers.map((entry) => (
                  <Link
                    key={`climb-${entry.rank}-${entry.slug}`}
                    to={trackUrl(entry.slug, entry.artistSlugs)}
                    className="chart-sidebox-v2-row"
                  >
                    <span className="chart-sidebox-v2-row-metric">+{entry.movementAmount ?? 0}</span>
                    <div className="chart-sidebox-v2-row-art">
                      <img src={entry.artworkUrl} alt="" />
                    </div>
                    <div className="min-w-0">
                      <div className="chart-sidebox-v2-row-name">{entry.title}</div>
                      <div className="chart-sidebox-v2-row-sub">{entry.artist}</div>
                    </div>
                    <WkIcon name="ArrowRightS" size={13} />
                  </Link>
                ))}
                {climbers.length === 0 && (
                  <p className="text-[12px] text-[var(--wk-text-faint)] py-2">No climbers this week.</p>
                )}
              </div>

              {/* Genre breakdown */}
              <div className="chart-sidebox-v2">
                <div className="chart-sidebox-v2-title">Genre breakdown</div>
                {genreBreakdown.map((g) => {
                  const pct = entries.length ? Math.round((g.count / entries.length) * 100) : 0;
                  return (
                    <div key={g.genre} className="chart-sidebox-v2-genre-row">
                      <div className="chart-sidebox-v2-genre-label">
                        <span>{g.genre}</span>
                        <span className="chart-sidebox-v2-genre-pct">{pct}%</span>
                      </div>
                      <div className="chart-sidebox-v2-genre-bar">
                        <div className="chart-sidebox-v2-genre-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick links */}
              <div className="chart-sidebox-v2">
                <div className="chart-sidebox-v2-title">Quick links</div>
                <Link to="/charts" className="chart-sidebox-v2-link">
                  <span>All charts</span>
                  <WkIcon name="ArrowRight" size={14} />
                </Link>
                <Link to={`/charts/${publicSlug}`} className="chart-sidebox-v2-link">
                  <span>Latest edition</span>
                  <WkIcon name="ArrowRight" size={14} />
                </Link>
              </div>
            </aside>
          </div>

          {/* Load more / collapse */}
          {(hasMoreEntries || canCollapse) && (
            <div className="chart-load-more-v2">
              <div className="flex items-center gap-3">
                {hasMoreEntries && (
                  <button
                    onClick={() => setDisplayedCount((n) => Math.min(n + PAGE_SIZE, rows.length))}
                    className="chart-load-more-v2-btn"
                  >
                    <WkIcon name="ArrowDownS" size={14} />
                    Load {nextLoadCount} more
                    <span className="opacity-50 text-[11px]">({totalRemaining} left)</span>
                  </button>
                )}
                {canCollapse && (
                  <button
                    onClick={() => {
                      setDisplayedCount(INITIAL_DISPLAY_COUNT);
                      document.getElementById("chart-leaderboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="chart-load-more-v2-btn"
                    style={{ opacity: 0.6 }}
                  >
                    <WkIcon name="ArrowUpS" size={14} /> Collapse
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Artist Rolodex ── */}
        <ArtistRolodex
          entries={entries}
          onJumpTo={handleJumpTo}
          familyLabel={familyLabel}
        />

        {/* ── Newsletter ── */}
        <section className="chart-reveal">
          <NewsletterSubscribe
            formId="charts-edition-newsletter-form"
            headline="Stay in the loop"
            description={`Weekly roundups of ${familyLabel} chart movements, new entries, and analysis. No spam, ever.`}
            contextFields={{
              wk_page_type: "charts_edition",
              wk_source_section: "edition_newsletter",
              wk_entity_slug: edition.slug,
              wk_entity_type: "chart_edition",
              chart_family_slug: familySlug,
              chart_program: familyLabel,
            }}
            analytics={{
              pageType: "charts_edition",
              entitySlug: edition.slug,
              entityType: "chart_edition",
              context: {
                chart_family_slug: familySlug,
                chart_program: familyLabel,
              },
            }}
          />
        </section>
      </div>

      <ContextAnchorCommentDrawer
        open={Boolean(selectedChartAnchor)}
        onClose={() => setSelectedChartAnchor(null)}
        entity={chartCommunityEntity}
        target={selectedChartAnchor}
      />

      {/* data freshness bar */}
      <div className="chart-meta-bar">
        <div className="chart-meta-bar-inner">
          <span className="chart-meta-bar-text">{metaLine}</span>
        </div>
      </div>
    </main>
  );
}