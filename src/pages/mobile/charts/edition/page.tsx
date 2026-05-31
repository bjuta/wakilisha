import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

export default function MobileChartEdition() {
  const { series } = useParams<{ series: string; edition: string }>();
  const [activeSeries, setActiveSeries] = useState(series || "weekly-top-40");
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (series) setActiveSeries(series);
  }, [series]);

  const top3 = useMemo(() => CHART_DATA.slice(0, 3), []);
  const restOfChart = useMemo(() => CHART_DATA.slice(3), []);

  const chartTracks = useMemo(
    () =>
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
    if (top10.length > 0) playTrack(top10[0], top10);
  };

  const seriesData = CHART_SERIES.find((s) => s.id === activeSeries) || CHART_SERIES[0];

  const stats = [
    { label: "Entries", value: CHART_EDITION.totalEntries },
    { label: "Artists", value: CHART_EDITION.totalArtists },
    { label: "New", value: CHART_EDITION.newEntries },
  ];

  const genreBreakdown = [
    { genre: "Afrobeats", count: 18 },
    { genre: "Afropop", count: 10 },
    { genre: "Amapiano", count: 6 },
    { genre: "Afrofusion", count: 4 },
    { genre: "R&B", count: 2 },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Cinematic Hero */}
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
            {seriesData.label}
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {seriesData.description}. The definitive ranking of African music.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={handlePlayTop10} className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap active:scale-[0.97] transition-transform">
              <i className="ri-play-fill" /> Listen to top 10
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap active:scale-[0.97] transition-transform">
              <i className="ri-share-line" /> Share
            </button>
          </div>

          {/* Current #1 card */}
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
      <div className="border-b border-[var(--wk-border)] px-5 py-3 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: 'none' }}>
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
            <div className={`text-[12px] font-bold ${activeSeries === s.id ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>{s.label}</div>
            <div className="text-[10px] text-[var(--wk-text-muted)]">{s.count} entries</div>
          </button>
        ))}
      </div>

      {/* Top 3 */}
      {!loading && (
        <div className="px-5 py-6">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Top 3</div>
          <div className="space-y-3">
            {top3.map((entry, i) => (
              <Link key={entry.rank} to={`/tracks/${entry.slug}`} className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-brand)]/40 active:scale-[0.98] active:opacity-80">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                  <span className="font-black text-[22px] text-[var(--wk-brand)]">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{entry.title}</h3>
                    {entry.movement === "new" && <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">New</span>}
                  </div>
                  <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                    <span>{entry.weeksOnChart} weeks</span>
                    {entry.peakPosition === entry.rank && <span className="text-[var(--wk-brand)]">· Peak</span>}
                  </div>
                </div>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePlayChart(i); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100" aria-label="Play">
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

      {/* Edition stats — same as desktop sidebar */}
      <div className="px-5 pb-5">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">This edition</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            { label: "Entries", value: CHART_EDITION.totalEntries },
            { label: "Artists", value: CHART_EDITION.totalArtists },
            { label: "New", value: CHART_EDITION.newEntries, color: "var(--wk-success)" },
            { label: "Longest run", value: CHART_EDITION.longestRunning.weeks, color: "var(--wk-info)" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-center">
              <div className="text-[18px] font-black" style={{ color: stat.color || "var(--wk-brand)" }}>
                {stat.value}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 flex items-center gap-2">
          <i className="ri-trophy-line text-[var(--wk-brand)]" />
          <div>
            <div className="text-[12px] font-bold text-[var(--wk-text)]">{CHART_EDITION.longestRunning.title}</div>
            <div className="text-[10px] text-[var(--wk-text-muted)]">
              {CHART_EDITION.longestRunning.artist} · {CHART_EDITION.longestRunning.weeks} weeks on chart
            </div>
          </div>
        </div>
      </div>

      {/* Genre breakdown — same as desktop sidebar */}
      <div className="px-5 pb-5">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Genre breakdown</div>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-3">
          {genreBreakdown.map((g) => {
            const pct = (g.count / CHART_EDITION.totalEntries) * 100;
            return (
              <div key={g.genre}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-[var(--wk-text)]">{g.genre}</div>
                  <div className="text-[11px] font-bold text-[var(--wk-text-muted)]">
                    {g.count} ({Math.round(pct)}%)
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wk-bg)]">
                  <div
                    className="h-full rounded-full bg-[var(--wk-brand)] transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New entries — same as desktop sidebar */}
      {useMemo(() => CHART_DATA.filter((e) => e.movement === "new").slice(0, 5), []).length > 0 && (
        <div className="px-5 pb-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">New entries</div>
            <span className="text-[10px] font-bold text-[var(--wk-brand)]">
              {CHART_DATA.filter((e) => e.movement === "new").length}
            </span>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="divide-y divide-[var(--wk-divider)]">
              {CHART_DATA.filter((e) => e.movement === "new").slice(0, 5).map((entry) => (
                <div key={entry.rank} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">
                    {entry.rank}
                  </div>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                    <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                    <div className="truncate text-[10px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--wk-brand)]">New</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Biggest climbers — same as desktop sidebar */}
      {useMemo(() => CHART_DATA.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 5), []).length > 0 && (
        <div className="px-5 pb-5">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Biggest climbers</div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="divide-y divide-[var(--wk-divider)]">
              {CHART_DATA.filter((e) => e.movement === "up")
                .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))
                .slice(0, 5)
                .map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-success)] text-[10px] font-black text-white">
                      +{entry.movementAmount}
                    </div>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                      <div className="truncate text-[10px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                    </div>
                    <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">#{entry.rank}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor's note — same as desktop sidebar */}
      <div className="px-5 pb-5">
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-quill-pen-line text-[var(--wk-brand)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
              Editor's Note
            </span>
          </div>
          <p className="text-[12px] leading-[1.7] text-[var(--wk-text-soft)]">
            <strong className="text-[var(--wk-text)]">{CHART_EDITION.biggestMover.title}</strong> makes the biggest move this week, climbing {CHART_EDITION.biggestMover.amount} positions. The {CHART_EDITION.topGenre} genre dominates with {CHART_EDITION.topGenreCount} entries.
          </p>
          <Link
            to="/magazine"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--wk-brand)]"
          >
            Full analysis <i className="ri-arrow-right-line" />
          </Link>
        </div>
      </div>

      {/* Playable preview shelf — same as desktop */}
      {useMemo(() => CHART_DATA.filter((t) => t.isPlayable), []).length > 0 && (
        <div className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Playable preview · {CHART_DATA.filter((t) => t.isPlayable).length} tracks
            </div>
            <button
              onClick={handlePlayTop10}
              className="text-[11px] font-semibold text-[var(--wk-brand)] flex items-center gap-1"
            >
              <i className="ri-play-fill" /> Play all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {CHART_DATA.filter((e) => e.isPlayable).map((entry, idx) => (
              <button
                key={entry.rank}
                onClick={() => handlePlayChart(idx)}
                className="group flex-none w-[136px] text-left active:scale-[0.97] transition-transform"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)] mb-2">
                  <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-active:opacity-100 transition-opacity">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                      <i className="ri-play-fill" />
                    </div>
                  </div>
                  <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-black text-white">
                    {entry.rank}
                  </div>
                </div>
                <div className="truncate text-[11px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                <div className="truncate text-[10px] text-[var(--wk-text-muted)]">{entry.artist}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}