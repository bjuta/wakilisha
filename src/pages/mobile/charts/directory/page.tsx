import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
} from "@/services/chartsPublic/client";
import {
  toChartDirectoryViewModel,
  toChartTrackPlayerModels,
  type ChartDirectoryViewModel,
  type ChartEntryRowViewModel,
} from "@/services/chartsPublic/viewModels";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";
import { WkIcon } from "@/components/design-system/Icon";


const rankClass = (rank: number) =>
  rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

const deltaClass = (movement?: string) =>
  movement === "up" ? "delta-up" : movement === "down" ? "delta-dn" : "delta-new";

const deltaLabel = (entry: ChartEntryRowViewModel) =>
  entry.movement === "new"
    ? "NEW"
    : entry.movement === "same"
    ? "—"
    : `${entry.movement === "up" ? "+" : "-"}${entry.movementAmount ?? 0}`;

const SERIES_ICON: Record<string, string> = {
  "weekly-top-40": "BarChart3",
  "rising-voices": "Rocket",
  "genre-pulse": "Activity",
  "classics": "Crown",
  "breakout": "Flame",
};

const methodology = [
  { icon: "Database", title: "Verified data", desc: "Streaming from Spotify, Apple Music, YouTube, Boomplay." },
  { icon: "Radio", title: "Radio airplay", desc: "Monitored across 12 African countries." },
  { icon: "LineChart", title: "Digital activity", desc: "Social, playlist adds, search volume." },
  { icon: "ShieldCheck", title: "Verified tracks", desc: "All tracks verified against ISRC data." },
] as const;

export default function MobileChartsDirectory() {
  const { playTrack } = usePlayer();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "empty" }
    | { status: "loaded"; data: ChartDirectoryViewModel }
  >({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data: families } = await getChartFamilies();
      if (families.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const featuredFamily = families[0];
      const featuredSlug = featuredFamily.slug ?? featuredFamily.familyKey;
      const { data: edition, meta } = await getLatestChartEdition(featuredSlug);
      if (!edition) {
        setState({ status: "empty" });
        return;
      }
      const { data: entries } = await getChartEditionEntries(featuredSlug, edition.slug);
      const vm = toChartDirectoryViewModel(families, [edition], featuredSlug, edition, entries, meta);
      setState({ status: "loaded", data: vm });
    } catch (err) {
      setState({ status: "error", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadedData = state.status === "loaded" ? state.data : null;
  const chartTracks = useMemo(
    () => (loadedData ? toChartTrackPlayerModels(loadedData.topEntries) : []),
    [loadedData]
  );

  if (state.status === "loading") {
    return (
      <div className="wk-mobile-v5 px-5 py-10 space-y-4">
        <div className="h-48 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
        <div className="flex gap-3">
          <div className="h-10 flex-1 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" />
          <div className="h-10 flex-1 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" />
        </div>
        <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-6 w-6 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            <div className="h-12 w-12 rounded-lg bg-[var(--wk-surface-raised)] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="wk-mobile-v5 px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)] mx-auto">
          <i className="ri-error-warning-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Could not load chart data</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">{state.error}</p>
        <button onClick={load} className="wk-button wk-button-primary text-[13px]">
          <i className="ri-refresh-line" /> Retry
        </button>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="wk-mobile-v5 px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] mx-auto">
          <i className="ri-bar-chart-box-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">No published chart edition found</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">Check back soon for new chart editions.</p>
        <button onClick={load} className="wk-button wk-button-primary text-[13px]">
          <i className="ri-refresh-line" /> Refresh
        </button>
      </div>
    );
  }

  const data = state.data;
  const featured = data.featuredFamily;
  const edition = data.featuredEdition;
  const topTrack = data.topEntries[0] ?? null;
  const allEntries = data.topEntries;
  const top3 = allEntries.slice(0, 3);
  const allRows = allEntries.slice(3);
  const top10 = chartTracks.slice(0, 10);
  const handlePlayTop10 = () => {
    if (top10.length > 0) playTrack(top10[0], top10);
  };
  const latestEditionHref = featured?.latestEditionSlug
    ? `/charts/${featured.slug}/${featured.latestEditionSlug}`
    : `/charts/${featured?.slug ?? "weekly-top-40"}`;
  const totalEditions = data.families.reduce((sum, s) => sum + (s.editionCount ?? 0), 0);

  const recentEditions = data.families
    .filter((s) => s.latestEditionSlug)
    .map((series) => ({
      seriesLabel: series.label,
      seriesId: series.slug,
      editionLabel: series.latestEditionLabel!,
      editionSlug: series.latestEditionSlug!,
      date: series.latestEditionDate ?? edition?.date ?? "",
      no1Artwork: topTrack?.artworkUrl ?? "",
      no1Title: topTrack?.title ?? "",
      entryCount: series.entryCount,
    }));

  const metaLine = data.meta.isStale
    ? `Loaded from cache (stale) · ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : data.meta.dataSource === "cache"
    ? `Loaded from cache · ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : `Loaded from ${data.meta.dataSource === "mock" ? "mock data" : "WordPress API"}`;

  return (
    <div className="wk-mobile-v5">
      {/* Fullwidth visual hero */}
      <section className="charts-visual-hero">
        {topTrack?.artworkUrl && (
          <div className="charts-visual-hero-bg" style={{ backgroundImage: `url(${topTrack.artworkUrl})` }} />
        )}
        {!topTrack?.artworkUrl && (
          <div className="charts-visual-hero-bg" style={{ background: "linear-gradient(135deg,#1a3a0a,#2a5a1a)" }} />
        )}
        <div className="charts-visual-hero-overlay" />
        <div className="charts-visual-hero-content">
          <div className="charts-ed-badge">
            <WkIcon name="BarChart3" size={14} /> {featured?.label ?? "WAKILISHA Charts"}
          </div>
          <h1 className="charts-title">{featured?.label ?? "Chart Universe"}</h1>
          <p className="charts-meta">{featured?.description ?? "The definitive index of African music charts."}</p>
        </div>
        {topTrack && (
          <div className="charts-hero-no1-card">
            <div className="charts-hero-no1-art">
              <img src={topTrack.artworkUrl} alt={topTrack.title} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="charts-hero-no1-crown">
                <WkIcon name="Crown" size={12} />
                <span>Current #1</span>
              </div>
              <div className="charts-hero-no1-title">{topTrack.title}</div>
              <div className="charts-hero-no1-artist">{topTrack.artist}</div>
            </div>
            <button
              onClick={() => playTrack(chartTracks[0], chartTracks)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
              aria-label={`Play ${topTrack.title}`}
            >
              <WkIcon name="Play" size={14} />
            </button>
          </div>
        )}
      </section>

      {/* Action buttons */}
      <div className="charts-hero-actions">
        <button onClick={handlePlayTop10} className="charts-hero-btn charts-hero-btn-primary">
          <WkIcon name="Play" size={14} /> Listen to top 10
        </button>
        <button className="charts-hero-btn charts-hero-btn-secondary">
          <WkIcon name="Share2" size={14} /> Share
        </button>
      </div>

      {/* Stats row */}
      <div className="charts-hero-stats-row">
        <div>
          <div className="stat-val">{data.stats.entries}</div>
          <div className="stat-lbl">Entries</div>
        </div>
        <div>
          <div className="stat-val">{data.stats.series}</div>
          <div className="stat-lbl">Series</div>
        </div>
        <div>
          <div className="stat-val">{totalEditions}</div>
          <div className="stat-lbl">Editions</div>
        </div>
        <div>
          <div className="stat-val">{data.stats.newThisWeek}</div>
          <div className="stat-lbl">New</div>
        </div>
      </div>

      {/* Filter row */}
      <div className="charts-filter-row">
        <Link to={latestEditionHref} className="charts-filter on">Latest edition</Link>
        {data.families.slice(0, 5).map((series) => (
          <Link
            key={series.id}
            to={series.latestEditionSlug ? `/charts/${series.slug}/${series.latestEditionSlug}` : `/charts/${series.slug}`}
            className="charts-filter"
          >
            {series.label}
          </Link>
        ))}
      </div>

      {/* Top 3 cards */}
      <div className="chart-hero-cards">
        {top3.map((entry, idx) => (
          <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-hero-card mobile-pressable">
            <img src={entry.artworkUrl} alt="" />
            <div className="chart-hero-overlay">
              <div className={`chart-hero-rank ${rankClass(entry.rank)}`}>{entry.rank}</div>
              <div className="min-w-0 flex-1">
                <div className="chart-row-title">{entry.title}</div>
                <div className="chart-row-sub">{entry.artist}</div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  playTrack(chartTracks[idx], chartTracks);
                }}
                className="phn-mp-btn phn-mp-play"
                aria-label={`Play ${entry.title}`}
              >
                <WkIcon name="Play" size={15} />
              </button>
            </div>
          </Link>
        ))}
      </div>

      {/* Rest of chart */}
      <div className="spec-section-hd">Positions 4–{data.stats.entries}</div>
      <div className="chart-row-list">
        {allRows.map((entry) => (
          <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-row mobile-pressable">
            <div className="chart-row-num">{entry.rank}</div>
            <div className="chart-row-art">
              <img src={entry.artworkUrl} alt="" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="chart-row-title">{entry.title}</div>
              <div className="chart-row-sub">{entry.artist}</div>
            </div>
            <div className={`chart-delta ${deltaClass(entry.movement)}`}>{deltaLabel(entry)}</div>
          </Link>
        ))}
      </div>

      {/* Chart series */}
      <div className="spec-section-hd">Chart series</div>
      <div className="px-5 pb-4 flex flex-col gap-3">
        {data.families.map((series) => {
          const icon = SERIES_ICON[series.id] ?? "BarChart3";
          const href = series.latestEditionSlug ? `/charts/${series.slug}/${series.latestEditionSlug}` : `/charts/${series.slug}`;
          return (
            <Link key={series.id} to={href} className="mobile-pressable flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)]">
                <WkIcon name={icon as any} size={18} className="text-[var(--wk-brand)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-[var(--wk-text)]">{series.label}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Top {series.entryCount} · {series.editionCount} editions</div>
                <div className="text-[11px] text-[var(--wk-text-faint)]">{series.description}</div>
              </div>
              <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
            </Link>
          );
        })}
      </div>

      {/* Recent editions */}
      {recentEditions.length > 0 && (
        <>
          <div className="spec-section-hd">Recent editions</div>
          <div className="px-5 pb-4">
            <div className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="divide-y divide-[var(--wk-divider)]">
                {recentEditions.map((row) => (
                  <Link key={`${row.seriesId}-${row.editionSlug}`} to={`/charts/${row.seriesId}/${row.editionSlug}`} className="mobile-pressable flex items-center gap-3 px-4 py-3 transition-all">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {row.no1Artwork ? (
                        <img src={row.no1Artwork} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <WkIcon name="BarChart3" size={16} className="text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.seriesLabel}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)]">{row.editionLabel} · Top {row.entryCount}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-[var(--wk-text-faint)]">{row.date}</div>
                    <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Methodology */}
      <div className="spec-section-hd">How charts are compiled</div>
      <div className="px-5 pb-8 grid grid-cols-2 gap-3">
        {methodology.map((item) => (
          <div key={item.title} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)]">
              <WkIcon name={item.icon as any} size={16} className="text-[var(--wk-brand)]" />
            </div>
            <div className="mb-0.5 text-[12px] font-bold text-[var(--wk-text)]">{item.title}</div>
            <div className="text-[10px] leading-relaxed text-[var(--wk-text-muted)]">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Subtle metadata */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] text-[var(--wk-text-faint)]">{metaLine}</div>
          <ChartRefreshButton onRefresh={load} size="sm" />
        </div>
      </div>
    </div>
  );
}