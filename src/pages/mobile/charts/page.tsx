import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
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

export default function MobileCharts() {
  const [activeSeries, setActiveSeries] = useState("weekly-top-40");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [data, setData] = useState<ChartDirectoryViewModel | null>(null);
  const { playTrack } = usePlayer();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmpty(false);
    try {
      const { data: families } = await getChartFamilies();
      if (families.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const active = families.find((f) => (f.slug ?? f.familyKey) === activeSeries) ?? families[0];
      const activeSlug = active.slug ?? active.familyKey;
      const { data: edition, meta } = await getLatestChartEdition(activeSlug);
      if (!edition) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const { data: entries } = await getChartEditionEntries(activeSlug, edition.slug);
      const vm = toChartDirectoryViewModel(families, [edition], activeSlug, edition, entries, meta);
      setData(vm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [activeSeries]);

  useEffect(() => {
    load();
  }, [load]);

  const chartTracks = useMemo(() => {
    if (!data) return [];
    return toChartTrackPlayerModels(data.topEntries);
  }, [data]);

  const handlePlayChart = (idx: number) => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks);
  };

  const handlePlayTop10 = () => {
    const top10 = chartTracks.slice(0, 10);
    if (top10.length > 0) {
      playTrack(top10[0], top10);
    }
  };

  const top3 = useMemo(() => data?.topEntries.slice(0, 3) ?? [], [data]);
  const restOfChart = useMemo(() => data?.topEntries.slice(3) ?? [], [data]);

  const stats = useMemo(() => {
    if (!data || !data.featuredEdition) return [];
    return [
      { label: "Entries", value: data.featuredEdition.totalEntries },
      { label: "Artists", value: data.featuredEdition.totalArtists },
      { label: "New", value: data.featuredEdition.newEntries },
    ];
  }, [data]);

  const metaLine = data?.meta.isStale
    ? `Loaded from cache (stale) · ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : data?.meta.dataSource === "cache"
    ? `Loaded from cache · ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : data?.meta
    ? `Loaded from ${data.meta.dataSource === "mock" ? "mock data" : "WordPress API"}`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen">
        <section className="relative min-h-[480px] flex items-end overflow-hidden">
          <div className="absolute inset-0 bg-[var(--wk-surface-raised)] animate-pulse" />
          <div className="relative w-full px-5 pb-10 pt-20">
            <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-3" />
            <div className="h-12 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-3" />
            <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-5" />
            <div className="flex gap-3">
              <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
        <div className="grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
              <div className="h-5 w-8 rounded bg-[var(--wk-surface-raised)] animate-pulse mx-auto mb-1" />
              <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)] animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="px-5 py-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonChartRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)] mx-auto">
          <i className="ri-error-warning-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Could not load chart data</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">{error}</p>
        <button onClick={load} className="wk-button wk-button-primary text-[13px]">
          <i className="ri-refresh-line" /> Retry
        </button>
      </div>
    );
  }

  if (empty || !data) {
    return (
      <div className="min-h-screen px-5 py-16 text-center">
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

  const series = data.featuredFamily;
  const topTrack = data.topEntries[0];

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[480px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${topTrack?.artworkUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) saturate(1.2)",
            transform: "scale(1.2)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/60 via-transparent to-[var(--wk-bg)]/60" />

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            WAKILISHA charts
          </div>
          <h1
            className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(32px, 10vw, 48px)" }}
          >
            {series?.label ?? "Charts"}
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {series?.description ?? "The definitive ranking of African music."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handlePlayTop10}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap active:scale-[0.97] transition-transform"
            >
              <i className="ri-play-fill" />
              Listen to top 10
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap active:scale-[0.97] transition-transform">
              <i className="ri-share-line" />
              Share
            </button>
          </div>

          {/* Current #1 card */}
          {topTrack && (
            <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                  <span className="text-[12px] font-black">1</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                  <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[16px] font-black text-[var(--wk-text)]">{topTrack.title}</h3>
                  <div className="truncate text-[13px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    <span className="inline-flex items-center gap-1 text-[var(--wk-success)]">
                      <i className="ri-arrow-up-line" /> {topTrack.movementAmount}
                    </span>
                    <span>{topTrack.weeksOnChart} weeks</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Edition header */}
      <div className="border-y border-[var(--wk-border)] px-5 py-3 flex items-center justify-between text-[11px] text-[var(--wk-text-muted)]">
        <span className="font-bold text-[var(--wk-text)]">{data.featuredEdition?.date ?? ""}</span>
        <span>{data.featuredEdition?.weekNumber ? `Week ${data.featuredEdition.weekNumber}` : data.featuredEdition?.label ?? ""}</span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
            <div className="text-[18px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Series selector */}
      <div className="border-b border-[var(--wk-border)] px-5 py-3 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {data.families.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSeries(s.slug)}
            className={`flex-none rounded-xl border px-3 py-2 text-left transition-all ${
              activeSeries === s.slug
                ? "border-[var(--wk-brand)]/40 bg-[var(--wk-brand)]/10"
                : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:border-[var(--wk-border-2)]"
            }`}
          >
            <div className={`text-[12px] font-bold ${activeSeries === s.slug ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>
              {s.label}
            </div>
            <div className="text-[10px] text-[var(--wk-text-muted)]">{s.entryCount} entries</div>
          </button>
        ))}
      </div>

      {/* Top 3 Spotlight */}
      <div className="px-5 py-6">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Top 3</div>
        <div className="space-y-3">
          {top3.map((entry, i) => (
            <Link
              key={entry.rank}
              to={`/tracks/${entry.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-brand)]/40 active:scale-[0.98] active:opacity-80"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                <span className="font-black text-[22px] text-[var(--wk-brand)]">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{entry.title}</h3>
                  {entry.movement === "new" && (
                    <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">New</span>
                  )}
                </div>
                <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                  <span>{entry.weeksOnChart} weeks</span>
                  {entry.peakPosition === entry.rank && <span className="text-[var(--wk-brand)]">· Peak</span>}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePlayChart(i);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
                aria-label="Play"
              >
                <i className="ri-play-fill text-sm" />
              </button>
              <div className="flex items-center gap-1 text-[12px] font-bold">
                {entry.movement === "up" && <i className="ri-arrow-up-line text-[var(--wk-success)]" />}
                {entry.movement === "down" && <i className="ri-arrow-down-line text-[var(--wk-danger)]" />}
                {entry.movement === "same" && <i className="ri-subtract-line text-[var(--wk-text-faint)]" />}
                {entry.movementAmount && entry.movementAmount > 0 && (
                  <span
                    style={{
                      color: entry.movement === "up" ? "var(--wk-success)" : entry.movement === "down" ? "var(--wk-danger)" : "var(--wk-text-faint)",
                    }}
                  >
                    {entry.movementAmount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main chart body */}
      <div className="px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Positions 4–{data.stats.entries}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
            <span className="inline-flex items-center gap-1">
              <i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="divide-y divide-[var(--wk-divider)]">
            {restOfChart.map((entry, idx) => (
              <ChartRow key={entry.rank} {...entry} onPlay={() => handlePlayChart(idx + 3)} />
            ))}
          </div>
        </div>
      </div>

      {/* Subtle metadata */}
      {metaLine && (
        <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3">
          <div className="text-[10px] text-[var(--wk-text-faint)]">{metaLine}</div>
        </div>
      )}
    </div>
  );
}