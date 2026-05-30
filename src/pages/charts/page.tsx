import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
import { ChartTop3 } from "./components/ChartTop3";
import { ChartEditionHeader } from "./components/ChartEditionHeader";
import { ChartStatsStrip } from "./components/ChartStatsStrip";
import { ChartNewEntries } from "./components/ChartNewEntries";
import { ChartMovers } from "./components/ChartMovers";
import { CHART_DATA, CHART_SERIES, CHART_EDITION, NEW_ENTRIES, BIGGEST_MOVERS } from "@/mocks/charts";

export default function Charts() {
  const [activeSeries, setActiveSeries] = useState("weekly-top-40");
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const top3 = useMemo(() => CHART_DATA.slice(0, 3), []);
  const restOfChart = useMemo(() => CHART_DATA.slice(3), []);

  const chartTracks = useMemo(() =>
    CHART_DATA.map((entry) => ({
      id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
      title: entry.title,
      artist: entry.artist,
      artworkUrl: entry.artworkUrl,
      isPlayable: entry.isPlayable,
    })),
    []
  );

  const handlePlayChart = (idx: number) => {
    playTrack(chartTracks[idx], chartTracks);
  };

  const series = CHART_SERIES.find((s) => s.id === activeSeries) || CHART_SERIES[0];

  const stats = [
    { label: "Entries", value: CHART_EDITION.totalEntries },
    { label: "Artists", value: CHART_EDITION.totalArtists },
    { label: "New this week", value: CHART_EDITION.newEntries },
    { label: "Weeks on chart", value: CHART_EDITION.longestRunning.weeks },
    { label: "Top genre", value: CHART_EDITION.topGenreCount, suffix: ` ${CHART_EDITION.topGenre}` },
    { label: "Editions", value: CHART_EDITION.weekNumber },
  ];

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — current #1 takes center stage */}
      <section className="relative min-h-[520px] md:min-h-[680px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${CHART_DATA[0].artworkUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) saturate(1.2)",
            transform: "scale(1.2)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/60 via-transparent to-[var(--wk-bg)]/60" />

        <div className="relative wk-container-wide w-full px-6 pb-12 pt-20 md:pb-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_420px] items-end">
            {/* Left: Text */}
            <div>
              <div className="wk-eyebrow mb-4">WAKILISHA charts</div>
              <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(40px, 6vw, 84px)" }}>
                {series.label}
              </h1>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed" style={{ color: "var(--wk-text-soft)" }}>
                {series.description}. The definitive ranking of African music, rebuilt from the repaired cultural registry.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="wk-button wk-button-primary">
                  <i className="ri-play-fill" />
                  Listen to top 10
                </button>
                <button className="wk-button wk-button-ghost">
                  <i className="ri-share-line" />
                  Share edition
                </button>
              </div>
            </div>

            {/* Right: Current #1 card */}
            <div className="hidden lg:block">
              <div className="relative rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                    <span className="text-[14px] font-black">1</span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img src={CHART_DATA[0].artworkUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-black text-[var(--wk-text)]">{CHART_DATA[0].title}</h3>
                    <div className="truncate text-[14px] text-[var(--wk-text-muted)]">{CHART_DATA[0].artist}</div>
                    <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
                      <span className="inline-flex items-center gap-1 text-[var(--wk-success)]">
                        <i className="ri-arrow-up-line" /> {CHART_DATA[0].movementAmount}
                      </span>
                      <span>{CHART_DATA[0].weeksOnChart} weeks</span>
                      <span>{CHART_DATA[0].genre}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Edition header bar */}
      <ChartEditionHeader
        date={CHART_EDITION.date}
        weekNumber={CHART_EDITION.weekNumber}
        methodology={CHART_EDITION.methodology}
        totalEntries={CHART_EDITION.totalEntries}
        totalArtists={CHART_EDITION.totalArtists}
        newEntries={CHART_EDITION.newEntries}
        topGenre={CHART_EDITION.topGenre}
      />

      {/* Series selector — horizontal shelf with visual weight */}
      <div className="border-b border-[var(--wk-border)]" style={{ background: "var(--wk-surface)" }}>
        <div className="wk-container-wide flex gap-3 overflow-x-auto px-6 py-4 scrollbar-hide">
          {CHART_SERIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSeries(s.id)}
              className={`group flex-none rounded-xl border px-4 py-3 text-left transition-all ${
                activeSeries === s.id
                  ? "border-[var(--wk-brand)]/40 bg-[var(--wk-brand)]/10"
                  : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:border-[var(--wk-border-2)]"
              }`}
            >
              <div className={`text-[13px] font-bold ${activeSeries === s.id ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>
                {s.label}
              </div>
              <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">{s.count} entries</div>
              <div className="mt-1 text-[11px] text-[var(--wk-text-faint)]">{s.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <ChartStatsStrip stats={stats} />

      {/* Top 3 Spotlight — dramatic, large cards */}
      {!loading && <ChartTop3 entries={top3} />}

      {/* Main chart body — dense data */}
      <div className="wk-container-wide px-6 py-10 md:py-14">
        <div className="mb-5 flex items-center justify-between">
          <div className="wk-eyebrow">Positions 4–{CHART_DATA.length}</div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
            <span className="inline-flex items-center gap-1"><i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up</span>
            <span className="inline-flex items-center gap-1"><i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down</span>
            <span className="inline-flex items-center gap-1"><i className="ri-subtract-line text-[var(--wk-text-faint)]" /> Same</span>
          </div>
        </div>

        <WkSurface className="overflow-hidden">
          <div className="divide-y divide-[var(--wk-divider)]">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonChartRow key={i} />)
              : restOfChart.map((entry) => (
                  <ChartRow key={entry.rank} {...entry} onPlay={() => handlePlayChart((entry.rank ?? 0) - 1)} />
                ))}
          </div>
        </WkSurface>
      </div>

      {/* Bottom sections — grid layout */}
      <div className="grid gap-px md:grid-cols-2">
        {/* New Entries */}
        {!loading && <ChartNewEntries entries={NEW_ENTRIES} />}

        {/* Biggest Movers */}
        {!loading && <ChartMovers entries={BIGGEST_MOVERS} />}
      </div>

      {/* Milestones — end of page */}
      {!loading && (
        <section className="wk-container-wide px-6 py-12 md:py-20">
          <div className="mb-8">
            <div className="wk-eyebrow mb-3">Endurance</div>
            <h3 className="font-black text-[clamp(24px,3vw,36px)] leading-[1.02] tracking-[-0.038em] text-[var(--wk-text)]">Chart milestones</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)]">
                  <i className="ri-time-line text-[var(--wk-brand)]" />
                </div>
                <span className="text-[13px] font-bold text-[var(--wk-text)]">Longest running</span>
              </div>
              <div className="mb-2 text-[32px] font-black leading-none tracking-[-0.04em] text-[var(--wk-brand)]">
                {CHART_EDITION.longestRunning.weeks} <span className="text-[16px] font-bold text-[var(--wk-text-muted)]">weeks</span>
              </div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{CHART_EDITION.longestRunning.title}</div>
              <div className="text-[13px] text-[var(--wk-text-muted)]">{CHART_EDITION.longestRunning.artist}</div>
            </div>

            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-success-soft)]">
                  <i className="ri-trophy-line text-[var(--wk-success)]" />
                </div>
                <span className="text-[13px] font-bold text-[var(--wk-text)]">Biggest climb</span>
              </div>
              <div className="mb-2 text-[32px] font-black leading-none tracking-[-0.04em] text-[var(--wk-success)]">
                +{CHART_EDITION.biggestMover.amount}
              </div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{CHART_EDITION.biggestMover.title}</div>
              <div className="text-[13px] text-[var(--wk-text-muted)]">{CHART_EDITION.biggestMover.artist}</div>
            </div>

            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-info-soft)]">
                  <i className="ri-fire-line text-[var(--wk-info)]" />
                </div>
                <span className="text-[13px] font-bold text-[var(--wk-text)]">Dominant genre</span>
              </div>
              <div className="mb-2 text-[32px] font-black leading-none tracking-[-0.04em] text-[var(--wk-info)]">
                {CHART_EDITION.topGenre}
              </div>
              <div className="text-[15px] font-bold text-[var(--wk-text)]">{CHART_EDITION.topGenreCount} entries</div>
              <div className="text-[13px] text-[var(--wk-text-muted)]">
                {((CHART_EDITION.topGenreCount / CHART_EDITION.totalEntries) * 100).toFixed(0)}% of this week&apos;s chart
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}