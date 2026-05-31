import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ChartTop3 } from "../components/ChartTop3";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();
  const [activeSeries, setActiveSeries] = useState("weekly-top-40");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("in-view");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

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

  const climbers = useMemo(
    () => CHART_DATA.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 5),
    []
  );
  const newEntries = useMemo(() => CHART_DATA.filter((e) => e.movement === "new").slice(0, 5), []);

  const series = CHART_SERIES.find((s) => s.id === activeSeries) || CHART_SERIES[0];

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
      {/* ===== COMPACT HEADER BAR ===== */}
      <div className="border-b border-[var(--wk-border)]" style={{ background: "var(--wk-surface)" }}>
        <div className="wk-container flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
              <i className="ri-bar-chart-box-line text-[16px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--wk-brand)]">Week {CHART_EDITION.weekNumber}</span>
                <span className="text-[12px] text-[var(--wk-text-faint)]">·</span>
                <span className="text-[12px] text-[var(--wk-text-soft)]">{CHART_EDITION.date}</span>
              </div>
              <div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">
                {CHART_EDITION.totalEntries} entries · {CHART_EDITION.totalArtists} artists · {CHART_EDITION.newEntries} new · {CHART_EDITION.methodology}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePlayChart(0)} className="wk-button wk-button-primary">
              <i className="ri-play-fill" />
              Play top 10
            </button>
            <button className="wk-button wk-button-ghost">
              <i className="ri-share-line" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* ===== TOP 3 SPOTLIGHT ===== */}
      <ChartTop3 entries={top3} />

      {/* ===== MAIN CHART BODY ===== */}
      <div className="wk-container px-4 py-6 md:px-6 md:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: Chart List */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="wk-eyebrow">Full chart · {CHART_DATA.length} positions</div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1"><i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up</span>
                <span className="inline-flex items-center gap-1"><i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down</span>
                <span className="inline-flex items-center gap-1"><i className="ri-subtract-line text-[var(--wk-text-faint)]" /> Same</span>
                <span className="inline-flex items-center gap-1"><i className="ri-star-smile-line text-[var(--wk-brand)]" /> New</span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
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
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">This edition</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[var(--wk-bg)] p-3">
                  <div className="text-[20px] font-black leading-none text-[var(--wk-brand)]">{CHART_EDITION.totalEntries}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">Entries</div>
                </div>
                <div className="rounded-lg bg-[var(--wk-bg)] p-3">
                  <div className="text-[20px] font-black leading-none text-[var(--wk-brand)]">{CHART_EDITION.totalArtists}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">Artists</div>
                </div>
                <div className="rounded-lg bg-[var(--wk-bg)] p-3">
                  <div className="text-[20px] font-black leading-none text-[var(--wk-success)]">{CHART_EDITION.newEntries}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">New</div>
                </div>
                <div className="rounded-lg bg-[var(--wk-bg)] p-3">
                  <div className="text-[20px] font-black leading-none text-[var(--wk-info)]">{CHART_EDITION.longestRunning.weeks}</div>
                  <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">Longest run</div>
                </div>
              </div>
            </div>

            {/* Genre breakdown */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Genre breakdown</div>
              <div className="space-y-2">
                {genreBreakdown.map((g) => (
                  <div key={g.genre} className="flex items-center gap-2">
                    <div className="text-[13px] font-semibold text-[var(--wk-text)] w-24">{g.genre}</div>
                    <div className="flex-1 h-2 rounded-full bg-[var(--wk-bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${(g.count / CHART_EDITION.totalEntries) * 100}%` }} />
                    </div>
                    <div className="text-[12px] font-bold text-[var(--wk-text-muted)] w-8 text-right">{g.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* New Entries */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">New entries</div>
                <span className="text-[11px] text-[var(--wk-brand)] font-bold">{newEntries.length}</span>
              </div>
              <div className="space-y-1">
                {newEntries.map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-2 rounded-lg p-2 hover:bg-[var(--wk-bg)] transition-colors">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">{entry.rank}</div>
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
                {newEntries.length === 0 && (
                  <div className="text-[12px] text-[var(--wk-text-faint)] py-2">No new entries this week.</div>
                )}
              </div>
            </div>

            {/* Movers */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Biggest climbers</div>
              <div className="space-y-1">
                {climbers.map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-2 rounded-lg p-2 hover:bg-[var(--wk-bg)] transition-colors">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-success)] text-[10px] font-black text-white">+{entry.movementAmount}</div>
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
                {climbers.length === 0 && (
                  <div className="text-[12px] text-[var(--wk-text-faint)] py-2">No climbers this week.</div>
                )}
              </div>
            </div>

            {/* Editor's Note */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-quill-pen-line text-[var(--wk-brand)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Editor's Note</span>
              </div>
              <p className="text-[13px] leading-[1.6] text-[var(--wk-text-soft)]">
                <strong className="text-[var(--wk-text)]">Oxlade's "Alone"</strong> reaches #1 after 8 weeks of steady growth. <strong className="text-[var(--wk-text)]">Asake's "Sungba"</strong> enters as the only Amapiano new entry. Amapiano now makes up 15% of the Top 40.
              </p>
              <Link to="/magazine" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--wk-brand)] items-center gap-1">
                Full analysis <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PLAYABLE RAIL ===== */}
      <div className="border-t border-[var(--wk-border)]" style={{ background: "var(--wk-surface)" }}>
        <div className="wk-container px-4 py-6 md:px-6 md:py-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="wk-eyebrow">Playable preview · {playableTracks.length} tracks</div>
            <button onClick={() => handlePlayChart(0)} className="text-[12px] font-semibold text-[var(--wk-brand)] flex items-center gap-1">
              <i className="ri-play-fill" /> Play all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {playableTracks.map((entry, idx) => {
              const trackIdx = CHART_DATA.findIndex((t) => t.rank === entry.rank);
              return (
                <button
                  key={entry.rank}
                  onClick={() => handlePlayTrack(entry)}
                  className="group flex-none w-[160px] text-left"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--wk-surface-raised)] mb-2">
                    <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                        <i className="ri-play-fill text-lg" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-black text-white">
                      {entry.rank}
                    </div>
                  </div>
                  <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                  <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                  <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">{entry.source}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== CROSS-SELL GRID ===== */}
      <div className="wk-container px-4 py-6 md:px-6 md:py-10">
        <div className="mb-4 wk-eyebrow">Discover more</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Artist Spotlight */}
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="relative h-32 bg-[var(--wk-surface-raised)]">
              <img src="https://picsum.photos/seed/wk-artist-oxlade/400/200" alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Artist spotlight</div>
                <div className="text-[18px] font-black text-white">Oxlade</div>
                <div className="text-[12px] text-white/80">#1 this week · Afropop</div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-[var(--wk-brand-soft)] flex items-center justify-center shrink-0">
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
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="relative h-32 bg-[var(--wk-surface-raised)]">
              <img src="https://picsum.photos/seed/wk-magazine-amapiano/400/200" alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Magazine</div>
                <div className="text-[18px] font-black text-white">The Amapiano wave</div>
                <div className="text-[12px] text-white/80">6 min read · Culture</div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-[13px] leading-[1.6] text-[var(--wk-text-soft)] mb-3">
                How South African house music became the dominant sound on African charts. Amapiano entries are up 87% year-over-year.
              </p>
              <Link to="/magazine/amapiano-wave" className="inline-flex text-[12px] font-semibold text-[var(--wk-brand)] items-center gap-1">
                Read story <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>

          {/* Methodology / Trust */}
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--wk-brand-soft)] flex items-center justify-center shrink-0">
                <i className="ri-shield-check-line text-[var(--wk-brand)]" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)]">How we compile the charts</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Verified data methodology</div>
              </div>
            </div>
            <div className="space-y-2 mb-3">
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
            <div className="pt-3 border-t border-[var(--wk-divider)]">
              <div className="text-[11px] text-[var(--wk-text-muted)]">
                <span className="font-bold text-[var(--wk-text)]">132 editions</span> published · <span className="font-bold text-[var(--wk-text)]">4,800+</span> chart entries tracked
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ARCHIVE ===== */}
      <div className="border-t border-[var(--wk-border)]" style={{ background: "var(--wk-surface)" }}>
        <div className="wk-container px-4 py-6 md:px-6 md:py-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="wk-eyebrow">Chart archive</div>
            <div className="flex items-center gap-2">
              <button className="rounded-full px-3 py-1 text-[11px] font-bold bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">All</button>
              <button className="rounded-full px-3 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] border border-[var(--wk-border)] hover:bg-[var(--wk-bg)]">2024</button>
              <button className="rounded-full px-3 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] border border-[var(--wk-border)] hover:bg-[var(--wk-bg)]">2023</button>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
              <div>Series</div>
              <div>#1 Track</div>
              <div>Entries</div>
              <div>Sources</div>
              <div className="text-right">Date</div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {archiveRows.map((row) => (
                <Link key={`${row.series}-${row.edition}`} to={`/charts/weekly-top-40/week-132`} className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 items-center hover:bg-[var(--wk-bg)] transition-colors">
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

      {/* ===== SERIES SELECTOR ===== */}
      <div className="border-t border-[var(--wk-border)]" style={{ background: "var(--wk-surface)" }}>
        <div className="wk-container px-4 py-6 md:px-6 md:py-10">
          <div className="mb-4 wk-eyebrow">Chart series</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHART_SERIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSeries(s.id)}
                className={`group flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                  activeSeries === s.id
                    ? "border-[var(--wk-brand)]/40 bg-[var(--wk-brand)]/10"
                    : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:border-[var(--wk-border-2)]"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)] shrink-0">
                  <i className={`text-[var(--wk-brand)] ${activeSeries === s.id ? "ri-bar-chart-fill" : "ri-bar-chart-line"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] font-bold ${activeSeries === s.id ? "text-[var(--wk-brand)]" : "text-[var(--wk-text)]"}`}>
                    {s.label}
                  </div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">{s.count} entries · {s.description}</div>
                </div>
                <i className="ri-arrow-right-line text-[var(--wk-text-faint)]" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.in-view {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}