import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

export default function MobileCharts() {
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

  const handlePlayTop10 = () => {
    const top10 = chartTracks.slice(0, 10);
    if (top10.length > 0) {
      playTrack(top10[0], top10);
    }
  };

  const series = CHART_SERIES.find((s) => s.id === activeSeries) || CHART_SERIES[0];

  const stats = [
    { label: "Entries", value: CHART_EDITION.totalEntries },
    { label: "Artists", value: CHART_EDITION.totalArtists },
    { label: "New", value: CHART_EDITION.newEntries },
  ];

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — current #1 takes center stage */}
      <section className="relative min-h-[480px] flex items-end overflow-hidden">
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

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            WAKILISHA charts
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(32px, 10vw, 48px)" }}>
            {series.label}
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {series.description}. The definitive ranking of African music.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handlePlayTop10}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap"
            >
              <i className="ri-play-fill" />
              Listen to top 10
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap">
              <i className="ri-share-line" />
              Share
            </button>
          </div>

          {/* Current #1 card — overlapping the hero */}
          <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                <span className="text-[12px] font-black">1</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                <img src={CHART_DATA[0].artworkUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[16px] font-black text-[var(--wk-text)]">{CHART_DATA[0].title}</h3>
                <div className="truncate text-[13px] text-[var(--wk-text-muted)]">{CHART_DATA[0].artist}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1 text-[var(--wk-success)]">
                    <i className="ri-arrow-up-line" /> {CHART_DATA[0].movementAmount}
                  </span>
                  <span>{CHART_DATA[0].weeksOnChart} weeks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Edition header */}
      <div className="border-y border-[var(--wk-border)] px-5 py-3 flex items-center justify-between text-[11px] text-[var(--wk-text-muted)]">
        <span className="font-bold text-[var(--wk-text)]">{CHART_EDITION.date}</span>
        <span>Week {CHART_EDITION.weekNumber}</span>
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
      <div className="border-b border-[var(--wk-border)] px-5 py-3 flex gap-2 overflow-x-auto">
        {CHART_SERIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSeries(s.id)}
            className={`flex-none rounded-xl border px-3 py-2 text-left transition-all ${
              activeSeries === s.id
                ? "border-[var(--wk-brand)]/40 bg-[var(--wk-brand)]/10"
                : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:border-[var(--wk-border-2)]"
            }`}
          >
            <div className={`text-[12px] font-bold ${activeSeries === s.id ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>
              {s.label}
            </div>
            <div className="text-[10px] text-[var(--wk-text-muted)]">{s.count} entries</div>
          </button>
        ))}
      </div>

      {/* Top 3 Spotlight */}
      {!loading && (
        <div className="px-5 py-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Top 3</div>
          <div className="space-y-3">
            {top3.map((entry, i) => (
              <Link
                key={entry.rank}
                to={`/tracks/${entry.slug}`}
                className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-brand)]/40"
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
                    <span style={{ color: entry.movement === "up" ? "var(--wk-success)" : entry.movement === "down" ? "var(--wk-danger)" : "var(--wk-text-faint)" }}>
                      {entry.movementAmount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main chart body */}
      <div className="px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Positions 4–{CHART_DATA.length}</div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
            <span className="inline-flex items-center gap-1"><i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up</span>
            <span className="inline-flex items-center gap-1"><i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="divide-y divide-[var(--wk-divider)]">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonChartRow key={i} />)
              : restOfChart.map((entry, idx) => <ChartRow key={entry.rank} {...entry} onPlay={() => handlePlayChart(idx + 3)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}