import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ChartTop3 } from "../components/ChartTop3";
import { ChartsHero } from "@/components/design-system/music/ChartsHero";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

export default function ChartEdition() {
  const { series, edition } = useParams<{ series: string; edition: string }>();
  const [activeSeries, setActiveSeries] = useState(series || "weekly-top-40");
  const { playTrack } = usePlayer();

  useEffect(() => {
    if (series) setActiveSeries(series);
  }, [series]);

  const top3 = useMemo(() => CHART_DATA.slice(0, 3), []);
  const chartList = useMemo(() => CHART_DATA, []);
  const playableTracks = useMemo(() => CHART_DATA.filter((e) => e.isPlayable), []);

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

  const handlePlayTrack = (entry: typeof CHART_DATA[0]) => {
    const track = {
      id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
      title: entry.title,
      artist: entry.artist,
      artworkUrl: entry.artworkUrl,
      isPlayable: entry.isPlayable,
      source: entry.source,
    };
    playTrack(track, chartTracks);
  };

  const seriesData = CHART_SERIES.find((s) => s.id === activeSeries) || CHART_SERIES[0];

  const climbers = useMemo(
    () => CHART_DATA.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 5),
    []
  );
  const newEntries = useMemo(() => CHART_DATA.filter((e) => e.movement === "new").slice(0, 5), []);

  const genreBreakdown = [
    { genre: "Afrobeats", count: 18 },
    { genre: "Afropop", count: 10 },
    { genre: "Amapiano", count: 6 },
    { genre: "Afrofusion", count: 4 },
    { genre: "R&B", count: 2 },
  ];

  const archiveRows = [
    { series: "Weekly Top 40", edition: "Week 132", date: "2024-05-24", no1: CHART_DATA[0], entries: 40, sources: 3 },
    { series: "Weekly Top 40", edition: "Week 131", date: "2024-05-17", no1: CHART_DATA[1], entries: 40, sources: 3 },
    { series: "Weekly Top 40", edition: "Week 130", date: "2024-05-10", no1: CHART_DATA[2], entries: 40, sources: 3 },
    { series: "Rising Voices", edition: "May 2024", date: "2024-05-01", no1: CHART_DATA[3], entries: 20, sources: 2 },
    { series: "Genre Pulse", edition: "Q2 2024", date: "2024-04-15", no1: CHART_DATA[4], entries: 25, sources: 2 },
  ];

  return (
    <div className="min-h-screen">
      <ChartsHero
        variant="edition"
        topTrack={CHART_DATA[0] ?? null}
        chartMeta={{
          seriesLabel: seriesData?.label ?? "Weekly Top 40",
          editionLabel: `Week ${CHART_EDITION.weekNumber}`,
          weekNumber: CHART_EDITION.weekNumber,
          date: CHART_EDITION.date,
          totalEntries: CHART_EDITION.totalEntries,
          totalArtists: CHART_EDITION.totalArtists,
          newEntries: CHART_EDITION.newEntries,
          methodology: CHART_EDITION.methodology,
        }}
        onPlay={() => handlePlayChart(0)}
        onPlayTop10={() => handlePlayChart(0)}
      />

      {/* Top 3 */}
      <ChartTop3 entries={top3} onPlayTrack={(entry) => handlePlayTrack(entry as unknown as (typeof CHART_DATA)[0])} />

      {/* Chart body */}
      <div className="wk-container px-4 py-6 md:px-6 md:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: Chart list */}
          <div>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="wk-eyebrow">Full chart</div>
                <span className="text-[11px] text-[var(--wk-text-faint)]">{CHART_DATA.length} positions</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1"><i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up</span>
                <span className="inline-flex items-center gap-1"><i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down</span>
                <span className="inline-flex items-center gap-1"><i className="ri-subtract-line text-[var(--wk-text-faint)]" /> Same</span>
                <span className="inline-flex items-center gap-1"><i className="ri-star-smile-line text-[var(--wk-brand)]" /> New</span>
              </div>
            </div>

            {/* Table header */}
            <div className="mb-1 grid grid-cols-[48px_56px_1fr_80px_40px] items-center gap-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
              <div className="text-center">#</div>
              <div></div>
              <div>Track</div>
              <div className="hidden md:block text-right">Stats</div>
              <div></div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="divide-y divide-[var(--wk-divider)]">
                {chartList.map((entry) => (
                  <ChartRow
                    key={entry.rank}
                    rank={entry.rank}
                    artworkUrl={entry.artworkUrl}
                    title={entry.title}
                    artist={entry.artist}
                    movement={entry.movement}
                    movementAmount={entry.movementAmount}
                    weeksOnChart={entry.weeksOnChart}
                    peakPosition={entry.peakPosition}
                    isPlayable={entry.isPlayable}
                    source={entry.source}
                    genre={entry.genre}
                    label={entry.label}
                    previousWeek={entry.previousWeek}
                    slug={entry.slug}
                    onPlay={() => handlePlayChart((entry.rank ?? 0) - 1)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-5">
            {/* Stats */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">This edition</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                  <div className="text-[22px] font-black leading-none text-[var(--wk-brand)]">{CHART_EDITION.totalEntries}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">Entries</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                  <div className="text-[22px] font-black leading-none text-[var(--wk-brand)]">{CHART_EDITION.totalArtists}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">Artists</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                  <div className="text-[22px] font-black leading-none text-[var(--wk-success)]">{CHART_EDITION.newEntries}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">New</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                  <div className="text-[22px] font-black leading-none text-[var(--wk-info)]">{CHART_EDITION.longestRunning.weeks}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">Longest run</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                <div className="flex items-center gap-2">
                  <i className="ri-trophy-line text-[var(--wk-brand)]" />
                  <div>
                    <div className="text-[12px] font-bold text-[var(--wk-text)]">{CHART_EDITION.longestRunning.title}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{CHART_EDITION.longestRunning.artist} · {CHART_EDITION.longestRunning.weeks} weeks on chart</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Genre breakdown */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Genre breakdown</div>
              <div className="space-y-3">
                {genreBreakdown.map((g) => {
                  const pct = (g.count / CHART_EDITION.totalEntries) * 100;
                  return (
                    <div key={g.genre}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-[13px] font-semibold text-[var(--wk-text)]">{g.genre}</div>
                        <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{g.count} ({Math.round(pct)}%)</div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--wk-bg)]">
                        <div className="h-full rounded-full bg-[var(--wk-brand)] transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* New entries */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">New entries</div>
                <span className="text-[11px] font-bold text-[var(--wk-brand)]">{newEntries.length}</span>
              </div>
              <div className="space-y-1">
                {newEntries.map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">{entry.rank}</div>
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                      <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--wk-brand)]">New</span>
                  </div>
                ))}
                {newEntries.length === 0 && <div className="py-2 text-[12px] text-[var(--wk-text-faint)]">No new entries this week.</div>}
              </div>
            </div>

            {/* Climbers */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Biggest climbers</div>
              <div className="space-y-1">
                {climbers.map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)]">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-success)] text-[10px] font-black text-white">+{entry.movementAmount}</div>
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                      <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                    </div>
                    <span className="text-[12px] font-bold text-[var(--wk-text-muted)]">#{entry.rank}</span>
                  </div>
                ))}
                {climbers.length === 0 && <div className="py-2 text-[12px] text-[var(--wk-text-faint)]">No climbers this week.</div>}
              </div>
            </div>

            {/* Editor's Note */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-quill-pen-line text-[var(--wk-brand)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Editor's Note</span>
              </div>
              <p className="text-[13px] leading-[1.7] text-[var(--wk-text-soft)]">
                <strong className="text-[var(--wk-text)]">{CHART_EDITION.biggestMover.title}</strong> makes the biggest move this week, climbing {CHART_EDITION.biggestMover.amount} positions. The {CHART_EDITION.topGenre} genre dominates with {CHART_EDITION.topGenreCount} entries.
              </p>
              <Link to="/magazine" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-brand)]">
                Full analysis <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Playable rail */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6 md:py-10">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="wk-eyebrow">Playable preview</div>
              <span className="text-[11px] text-[var(--wk-text-faint)]">{playableTracks.length} tracks</span>
            </div>
            <button onClick={() => handlePlayChart(0)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-brand)]">
              <i className="ri-play-fill" /> Play all
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
            {playableTracks.map((entry) => (
              <button key={entry.rank} onClick={() => handlePlayTrack(entry)} className="group flex-none w-[172px] text-left">
                <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                  <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-[var(--wk-d-fast)] group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                      <i className="ri-play-fill text-lg" />
                    </div>
                  </div>
                  <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-black text-white">{entry.rank}</div>
                </div>
                <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">{entry.source}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-sell grid */}
      <div className="wk-container px-4 py-6 md:px-6 md:py-10">
        <div className="mb-5 flex items-center gap-3">
          <div className="wk-eyebrow">Discover more</div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Artist Spotlight */}
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="relative h-32 bg-[var(--wk-surface-raised)]">
              <img src="https://readdy.ai/api/search-image?query=dramatic%20dark%20moody%20portrait%20of%20an%20african%20male%20music%20artist%20with%20studio%20lighting%20and%20colorful%20neon%20accents%20on%20a%20dark%20background%20high%20contrast%20professional%20photography" alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Artist spotlight</div>
                <div className="text-[18px] font-black text-white">Oxlade</div>
                <div className="text-[12px] text-white/80">#1 this week · Afropop</div>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]">
                  <i className="ri-music-2-line text-[var(--wk-brand)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[var(--wk-text)]">12 tracks on WAKILISHA</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">3 chart appearances · 2 releases</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/artists/oxlade" className="wk-button wk-button-primary flex-1 justify-center text-[12px]">
                  <i className="ri-user-line" /> Profile
                </Link>
                <Link to="/artists/oxlade" className="wk-button wk-button-ghost flex-1 justify-center text-[12px]">
                  <i className="ri-album-line" /> Releases
                </Link>
              </div>
            </div>
          </div>

          {/* Magazine Story */}
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="relative h-32 bg-[var(--wk-surface-raised)]">
              <img src="https://readdy.ai/api/search-image?query=abstract%20african%20musical%20culture%20artistic%20photography%20with%20vibrant%20warm%20colors%20and%20dark%20background%20showing%20musical%20instruments%20and%20rhythm%20patterns%20editorial%20style" alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Magazine</div>
                <div className="text-[18px] font-black text-white">The Amapiano wave</div>
                <div className="text-[12px] text-white/80">6 min read · Culture</div>
              </div>
            </div>
            <div className="p-4">
              <p className="mb-3 text-[13px] leading-[1.7] text-[var(--wk-text-soft)]">
                How South African house music became the dominant sound on African charts. Amapiano entries are up 87% year-over-year.
              </p>
              <Link to="/magazine/amapiano-wave" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-brand)]">
                Read story <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>

          {/* Methodology */}
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)]">
                <i className="ri-shield-check-line text-[var(--wk-brand)]" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)]">How we compile the charts</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Verified data methodology</div>
              </div>
            </div>
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-soft)]">
                <i className="ri-checkbox-circle-line text-[var(--wk-success)]" />
                Streaming data from 3 verified sources
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-soft)]">
                <i className="ri-checkbox-circle-line text-[var(--wk-success)]" />
                Radio playlist monitoring across 12 cities
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-soft)]">
                <i className="ri-checkbox-circle-line text-[var(--wk-success)]" />
                Weekly refresh every Friday at 00:00 UTC
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--wk-text-soft)]">
                <i className="ri-checkbox-circle-line text-[var(--wk-success)]" />
                Repaired cultural registry backing
              </div>
            </div>
            <div className="border-t border-[var(--wk-divider)] pt-3">
              <div className="text-[11px] text-[var(--wk-text-muted)]">
                <span className="font-bold text-[var(--wk-text)]">132 editions</span> published · <span className="font-bold text-[var(--wk-text)]">4,800+</span> chart entries tracked
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Archive */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6 md:py-10">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="wk-eyebrow">Chart archive</div>
              <span className="text-[11px] text-[var(--wk-text-faint)]">{archiveRows.length} editions</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold text-[var(--wk-brand-on)]">All</button>
              <button className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]">2024</button>
              <button className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]">2023</button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="hidden grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)] md:grid">
              <div>Series</div>
              <div>#1 Track</div>
              <div>Entries</div>
              <div>Sources</div>
              <div className="text-right">Date</div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {archiveRows.map((row) => (
                <Link key={`${row.series}-${row.edition}`} to={`/charts/weekly-top-40/week-132`} className="grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-[var(--wk-bg)] md:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] md:items-center md:gap-3">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.series}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{row.edition}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                      <img src={row.no1.artworkUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{row.no1.title}</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{row.no1.artist}</div>
                    </div>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{row.entries}</div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{row.sources}</div>
                  <div className="text-right text-[12px] text-[var(--wk-text-muted)]">{row.date}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Series selector */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6 md:py-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="wk-eyebrow">Chart series</div>
            <span className="text-[11px] text-[var(--wk-text-faint)]">{CHART_SERIES.length} active</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHART_SERIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSeries(s.id)}
                className={`group flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
                  activeSeries === s.id
                    ? "border-[var(--wk-brand)]/40 bg-[var(--wk-brand)]/10"
                    : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:border-[var(--wk-border-2)]"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-surface-raised)]">
                  <i className={`text-[var(--wk-brand)] text-lg ${activeSeries === s.id ? "ri-bar-chart-fill" : "ri-bar-chart-line"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[14px] font-bold ${activeSeries === s.id ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>
                    {s.label}
                  </div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{s.count} entries · {s.description}</div>
                </div>
                <i className="ri-arrow-right-line text-[var(--wk-text-faint)]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}