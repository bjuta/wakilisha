import { useState, useEffect, useMemo } from "react";
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

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const top3 = useMemo(() => CHART_DATA.slice(0, 3), []);
  const restOfChart = useMemo(() => CHART_DATA.slice(3), []);

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
    <>
      {/* Hero with chart edition background */}
      <PageHero
        eyebrow="WAKILISHA charts"
        title={series.label}
        subtitle={series.description}
        variant="full"
        imageUrl="https://readdy.ai/api/search-image?query=abstract%20music%20visualization%20background%2C%20sound%20waveforms%20and%20equalizer%20bars%20in%20dark%20environment%2C%20green%20and%20gold%20accent%20lights%2C%20dark%20atmospheric%20background%2C%20professional%20music%20industry%20aesthetic%2C%20cinematic%20lighting%2C%20no%20text&width=1400&height=600&seq=chart-hero&orientation=landscape"
        actions={
          <>
            <button className="wk-button wk-button-primary">
              <i className="ri-play-fill" />
              Listen to top 10
            </button>
            <button className="wk-button wk-button-ghost">
              <i className="ri-share-line" />
              Share edition
            </button>
          </>
        }
      />

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

      {/* Series selector */}
      <div className="border-b border-[var(--wk-border)] bg-[var(--wk-bg)]"
      >
        <div className="wk-container flex flex-wrap gap-2 px-6 py-4"
        >
          {CHART_SERIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSeries(s.id)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeSeries === s.id
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {s.label}
              <span className="ml-1.5 text-[11px] opacity-70"
              >
                {s.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <ChartStatsStrip stats={stats} />

      {/* Top 3 Spotlight */}
      {!loading && <ChartTop3 entries={top3} />}

      {/* Main chart table */}
      <div className="wk-container px-6 py-10 md:py-14"
      >
        <div className="mb-4"
        >
          <div className="wk-eyebrow"
          >
            Positions 4–{CHART_DATA.length}
          </div>
        </div>

        <WkSurface className="overflow-hidden"
        >
          <div className="divide-y divide-[var(--wk-divider)]"
          >
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonChartRow key={i} />)
              : restOfChart.map((entry) => (
                  <ChartRow key={entry.rank} {...entry} />
                ))}
          </div>
        </WkSurface>
      </div>

      {/* New Entries */}
      {!loading && <ChartNewEntries entries={NEW_ENTRIES} />}

      {/* Biggest Movers */}
      {!loading && <ChartMovers entries={BIGGEST_MOVERS} />}

      {/* Milestones section */}
      {!loading && (
        <section className="wk-container px-6 py-12 md:py-16"
        >
          <div className="mb-6"
          >
            <div className="wk-eyebrow mb-2"
            >
              Endurance
            </div>
            <h3 className="wk-h-section"
            >
              Chart milestones
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5"
            >
              <div className="mb-3 flex items-center gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]"
                >
                  <i className="ri-time-line text-[var(--wk-brand)]" />
                </div>
                <span className="text-[13px] font-bold text-[var(--wk-text)]"
                >
                  Longest running
                </span>
              </div>
              <div className="mb-1 text-[22px] font-black text-[var(--wk-brand)]"
              >
                {CHART_EDITION.longestRunning.weeks} weeks
              </div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]"
              >
                {CHART_EDITION.longestRunning.title}
              </div>
              <div className="text-[12px]" style={{ color: "var(--wk-text-muted)" }}
              >
                {CHART_EDITION.longestRunning.artist}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5"
            >
              <div className="mb-3 flex items-center gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-success-soft)]"
                >
                  <i className="ri-trophy-line text-[var(--wk-success)]" />
                </div>
                <span className="text-[13px] font-bold text-[var(--wk-text)]"
                >
                  Biggest climb
                </span>
              </div>
              <div className="mb-1 text-[22px] font-black text-[var(--wk-success)]"
              >
                +{CHART_EDITION.biggestMover.amount} positions
              </div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]"
              >
                {CHART_EDITION.biggestMover.title}
              </div>
              <div className="text-[12px]" style={{ color: "var(--wk-text-muted)" }}
              >
                {CHART_EDITION.biggestMover.artist}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5"
            >
              <div className="mb-3 flex items-center gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-info-soft)]"
                >
                  <i className="ri-fire-line text-[var(--wk-info)]" />
                </div>
                <span className="text-[13px] font-bold text-[var(--wk-text)]"
                >
                  Dominant genre
                </span>
              </div>
              <div className="mb-1 text-[22px] font-black text-[var(--wk-info)]"
              >
                {CHART_EDITION.topGenre}
              </div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]"
              >
                {CHART_EDITION.topGenreCount} entries
              </div>
              <div className="text-[12px]" style={{ color: "var(--wk-text-muted)" }}
              >
                {(CHART_EDITION.topGenreCount / CHART_EDITION.totalEntries * 100).toFixed(0)}% of this week&apos;s chart
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}