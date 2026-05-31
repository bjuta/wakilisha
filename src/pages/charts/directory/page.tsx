import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ChartTop3 } from "@/pages/charts/components/ChartTop3";
import { ChartsHero } from "@/components/design-system/music/ChartsHero";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();

  const chartTracks = useMemo(
    () =>
      CHART_DATA.map((entry) => ({
        id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
        title: entry.title,
        artist: entry.artist,
        artworkUrl: entry.artworkUrl,
        isPlayable: entry.isPlayable,
        source: entry.source,
      })),
    []
  );

  const playableTracks = useMemo(() => CHART_DATA.filter((entry) => entry.isPlayable), []);
  const climbers = useMemo(
    () => CHART_DATA.filter((entry) => entry.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 6),
    []
  );
  const newEntries = useMemo(() => CHART_DATA.filter((entry) => entry.movement === "new").slice(0, 6), []);

  const handlePlayChart = (idx = 0) => {
    if (!chartTracks[idx]) return;
    playTrack(chartTracks[idx], chartTracks);
  };

  const handlePlayTrack = (entry: (typeof CHART_DATA)[0]) => {
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

  const hasChartData = CHART_DATA.length > 0;
  const topTrack = CHART_DATA[0] ?? null;

  if (!hasChartData) {
    return (
      <div className="min-h-screen">
        <section className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-bar-chart-box-line text-2xl" />
            </div>
            <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
            <h1 className="text-[clamp(32px,5vw,64px)] font-black leading-[0.95] tracking-[-0.05em] text-[var(--wk-text)]">
              Chart data has not been seeded yet.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              The charts page now renders only imported registry data. Run the CSV registry generation and seed the app before showing chart entries, editions, archive rows, and #1 artwork.
            </p>
            <div className="mt-6 rounded-xl bg-[var(--wk-bg)] p-4 font-mono text-[12px] text-[var(--wk-text-soft)]">
              WAKILISHA_IMPORT_DIR="$RAW_DIR" npm run migration:generate-registry
            </div>
          </div>
        </section>
      </div>
    );
  }

  const genreBreakdown = Object.entries(
    CHART_DATA.reduce<Record<string, number>>((acc, entry) => {
      const genre = entry.genre ?? "Unknown";
      acc[genre] = (acc[genre] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, count]) => ({ genre, count }));

  const archiveRows = CHART_SERIES.map((series) => ({
    series: series.label,
    edition: series.latestEdition?.label ?? "Latest edition",
    date: series.latestEdition?.date ?? CHART_EDITION.date,
    no1: topTrack,
    entries: series.count,
    sources: 1,
    href: series.latestEdition ? `/charts/${series.id}/${series.latestEdition.slug}` : `/charts/${series.id}`,
  })).filter((row) => row.no1);

  const top3 = CHART_DATA.slice(0, 3);

  return (
    <div className="min-h-screen">
      <ChartsHero
        variant="directory"
        topTrack={topTrack}
        chartMeta={{
          seriesLabel: CHART_SERIES[0]?.label ?? "Weekly Top 40",
          editionLabel: CHART_EDITION.date ? `Week ${CHART_EDITION.weekNumber}` : "Latest Edition",
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

      {/* Top 3 spotlight */}
      <ChartTop3 entries={top3} onPlayTrack={(entry) => handlePlayTrack(entry as unknown as (typeof CHART_DATA)[0])} />

      {/* Main chart body */}
      <div className="wk-container px-4 py-6 md:px-6 md:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: Chart list */}
          <main>
            {/* Section header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="wk-eyebrow">Full chart</div>
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {CHART_DATA.length} positions
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--wk-text-faint)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-subtract-line text-[var(--wk-text-faint)]" /> Same
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-star-smile-line text-[var(--wk-brand)]" /> New
                </span>
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

            {/* Chart rows */}
            <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="divide-y divide-[var(--wk-divider)]">
                {CHART_DATA.map((entry) => (
                  <ChartRow
                    key={`${entry.editionId}-${entry.rank}-${entry.slug}`}
                    {...entry}
                    onPlay={() => handlePlayChart((entry.rank ?? 1) - 1)}
                  />
                ))}
              </div>
            </div>
          </main>

          {/* Right: Sidebar */}
          <aside className="space-y-5">
            {/* Stats */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
                This edition
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat value={CHART_EDITION.totalEntries} label="Entries" />
                <Stat value={CHART_EDITION.totalArtists} label="Artists" />
                <Stat value={CHART_EDITION.newEntries} label="New" accent="success" />
                <Stat value={CHART_EDITION.longestRunning.weeks} label="Longest run" accent="info" />
              </div>
              <div className="mt-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                <div className="flex items-center gap-2">
                  <i className="ri-trophy-line text-[var(--wk-brand)]" />
                  <div>
                    <div className="text-[12px] font-bold text-[var(--wk-text)]">
                      {CHART_EDITION.longestRunning.title}
                    </div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">
                      {CHART_EDITION.longestRunning.artist} · {CHART_EDITION.longestRunning.weeks} weeks on chart
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Genre breakdown */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
                Genre breakdown
              </div>
              <div className="space-y-3">
                {genreBreakdown.map((g) => {
                  const pct = CHART_DATA.length ? (g.count / CHART_DATA.length) * 100 : 0;
                  return (
                    <div key={g.genre}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-[13px] font-semibold text-[var(--wk-text)]">{g.genre}</div>
                        <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{g.count} ({Math.round(pct)}%)</div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--wk-bg)]">
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

            {/* New entries */}
            <SignalPanel title="New entries" entries={newEntries} badge="New" />
            {/* Climbers */}
            <SignalPanel title="Biggest climbers" entries={climbers} badge="Climber" />

            {/* Editor's note */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-quill-pen-line text-[var(--wk-brand)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
                  Editor's Note
                </span>
              </div>
              <p className="text-[13px] leading-[1.7] text-[var(--wk-text-soft)]">
                <strong className="text-[var(--wk-text)]">{CHART_EDITION.biggestMover.title}</strong> makes the biggest move this week, climbing {CHART_EDITION.biggestMover.amount} positions. The {CHART_EDITION.topGenre} genre dominates with {CHART_EDITION.topGenreCount} entries in this edition.
              </p>
              <Link to="/magazine" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-brand)]">
                Full analysis <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Playable rail */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
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
              <button
                key={`${entry.editionId}-${entry.rank}`}
                onClick={() => handlePlayTrack(entry)}
                className="group flex-none w-[172px] text-left"
              >
                <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                  <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-[var(--wk-d-fast)] group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                      <i className="ri-play-fill text-lg" />
                    </div>
                  </div>
                  <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-black text-white">
                    {entry.rank}
                  </div>
                </div>
                <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">{entry.source}</div>
              </button>
            ))}
            {playableTracks.length === 0 && (
              <div className="text-[13px] text-[var(--wk-text-muted)]">No playable chart tracks available.</div>
            )}
          </div>
        </div>
      </section>

      {/* Chart archive */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6 md:py-10">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="wk-eyebrow">Chart archive</div>
              <span className="text-[11px] text-[var(--wk-text-faint)]">{archiveRows.length} series</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold text-[var(--wk-brand-on)]">All</button>
              <button className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]">2024</button>
              <button className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-bold text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]">2023</button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            {/* Header */}
            <div className="hidden grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)] md:grid">
              <div>Series</div>
              <div>#1 Track</div>
              <div>Entries</div>
              <div>Sources</div>
              <div className="text-right">Date</div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {archiveRows.map((row) => (
                <Link
                  key={`${row.series}-${row.edition}`}
                  to={row.href}
                  className="grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-[var(--wk-bg)] md:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] md:items-center md:gap-3"
                >
                  <div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.series}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{row.edition}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                      <img src={row.no1?.artworkUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{row.no1?.title}</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{row.no1?.artist}</div>
                    </div>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{row.entries} entries</div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{row.sources} source{row.sources !== 1 ? "s" : ""}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)] md:text-right">{row.date}</div>
                </Link>
              ))}
              {archiveRows.length === 0 && (
                <div className="px-4 py-6 text-[13px] text-[var(--wk-text-muted)]">No chart archive rows available yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Chart series selector */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6 md:py-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="wk-eyebrow">Chart series</div>
            <span className="text-[11px] text-[var(--wk-text-faint)]">{CHART_SERIES.length} active</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHART_SERIES.map((s) => (
              <Link
                key={s.id}
                to={`/charts/${s.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-4 transition-all hover:border-[var(--wk-brand)]/30 hover:bg-[var(--wk-brand)]/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-surface-raised)] transition-colors group-hover:bg-[var(--wk-brand)]/10">
                  <i className="ri-bar-chart-line text-[var(--wk-brand)] text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[var(--wk-text)]">{s.label}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{s.count} entries · {s.description}</div>
                </div>
                <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: "brand" | "success" | "info" | "danger" }) {
  const accentMap = {
    brand: "var(--wk-brand)",
    success: "var(--wk-success)",
    info: "var(--wk-info)",
    danger: "var(--wk-danger)",
  };
  const color = accent ? accentMap[accent] : "var(--wk-brand)";
  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
      <div className="text-[22px] font-black leading-none" style={{ color }}>{value}</div>
      <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">{label}</div>
    </div>
  );
}

function SignalPanel({ title, entries, badge }: { title: string; entries: typeof CHART_DATA; badge: string }) {
  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{title}</div>
        <span className="text-[11px] font-bold text-[var(--wk-brand)]">{entries.length}</span>
      </div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={`${entry.editionId}-${entry.rank}`} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">
              {entry.rank}
            </div>
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
              <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
              <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
            </div>
            <span className="text-[10px] font-bold text-[var(--wk-brand)]">{badge}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-2 text-[12px] text-[var(--wk-text-faint)]">No entries this week.</div>
        )}
      </div>
    </div>
  );
}