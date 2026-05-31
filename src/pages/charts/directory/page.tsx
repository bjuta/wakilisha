import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
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

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div
          className="absolute inset-0 opacity-25 blur-3xl"
          style={{ backgroundImage: `url(${topTrack?.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="relative wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
              <h1 className="text-[clamp(40px,6vw,84px)] font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]">
                Chart universe
              </h1>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--wk-text-soft)]">
                {CHART_EDITION.totalEntries} imported chart positions across {CHART_SERIES.length} series, powered by the current WAKILISHA registry.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => handlePlayChart(0)} disabled={!chartTracks.length} className="wk-button wk-button-primary disabled:opacity-40">
                  <i className="ri-play-fill" /> Play top 10
                </button>
                {CHART_SERIES[0]?.latestEdition && (
                  <Link to={`/charts/${CHART_SERIES[0].id}/${CHART_SERIES[0].latestEdition.slug}`} className="wk-button wk-button-ghost">
                    Current edition <i className="ri-arrow-right-line" />
                  </Link>
                )}
              </div>
            </div>
            {topTrack && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/90 p-5 backdrop-blur">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</div>
                <div className="flex items-center gap-4">
                  <img src={topTrack.artworkUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-[22px] font-black text-[var(--wk-text)]">{topTrack.title}</div>
                    <div className="truncate text-[14px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
                    <div className="mt-2 text-[12px] text-[var(--wk-text-faint)]">{topTrack.weeksOnChart} weeks · Peak #{topTrack.peakPosition}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="wk-container px-4 py-8 md:px-6 md:py-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <main>
            <div className="mb-4 flex items-center justify-between">
              <div className="wk-eyebrow">Full chart · {CHART_DATA.length} positions</div>
              <div className="text-[11px] text-[var(--wk-text-faint)]">Real imported chart entries only</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="divide-y divide-[var(--wk-divider)]">
                {CHART_DATA.map((entry) => (
                  <ChartRow key={`${entry.editionId}-${entry.rank}-${entry.slug}`} {...entry} onPlay={() => handlePlayChart((entry.rank ?? 1) - 1)} />
                ))}
              </div>
            </div>
          </main>

          <aside className="space-y-5">
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">This edition</div>
              <div className="grid grid-cols-2 gap-3">
                <Stat value={CHART_EDITION.totalEntries} label="Entries" />
                <Stat value={CHART_EDITION.totalArtists} label="Artists" />
                <Stat value={CHART_EDITION.newEntries} label="New" />
                <Stat value={CHART_EDITION.longestRunning.weeks} label="Longest run" />
              </div>
            </div>

            <Signal title="New entries" entries={newEntries} empty="No new entries in this edition." />
            <Signal title="Biggest climbers" entries={climbers} empty="No climbers in this edition." />

            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Genre breakdown</div>
              <div className="space-y-2">
                {genreBreakdown.map((g) => (
                  <div key={g.genre} className="flex items-center gap-2">
                    <div className="w-24 text-[13px] font-semibold text-[var(--wk-text)]">{g.genre}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--wk-bg)]">
                      <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${CHART_DATA.length ? (g.count / CHART_DATA.length) * 100 : 0}%` }} />
                    </div>
                    <div className="w-8 text-right text-[12px] font-bold text-[var(--wk-text-muted)]">{g.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6">
          <div className="mb-4 wk-eyebrow">Chart archive</div>
          <div className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="divide-y divide-[var(--wk-divider)]">
              {archiveRows.map((row) => (
                <Link key={`${row.series}-${row.edition}`} to={row.href} className="grid gap-3 px-4 py-3 hover:bg-[var(--wk-bg)] md:grid-cols-[1.5fr_1.5fr_1fr_1fr] md:items-center">
                  <div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.series}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{row.edition}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={row.no1?.artworkUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{row.no1?.title}</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{row.no1?.artist}</div>
                    </div>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">{row.entries} entries</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)] md:text-right">{row.date}</div>
                </Link>
              ))}
              {archiveRows.length === 0 && <div className="px-4 py-6 text-[13px] text-[var(--wk-text-muted)]">No chart archive rows available yet.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-8 md:px-6">
          <div className="mb-4 wk-eyebrow">Playable preview · {playableTracks.length} tracks</div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {playableTracks.map((entry) => (
              <button key={`${entry.editionId}-${entry.rank}`} onClick={() => handlePlayChart(Math.max(0, entry.rank - 1))} className="group w-[160px] flex-none text-left">
                <img src={entry.artworkUrl} alt="" className="mb-2 aspect-square w-full rounded-xl object-cover" />
                <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
              </button>
            ))}
            {playableTracks.length === 0 && <div className="text-[13px] text-[var(--wk-text-muted)]">No playable chart tracks available.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-[var(--wk-bg)] p-3">
      <div className="text-[20px] font-black leading-none text-[var(--wk-brand)]">{value}</div>
      <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">{label}</div>
    </div>
  );
}

function Signal({ title, entries, empty }: { title: string; entries: typeof CHART_DATA; empty: string }) {
  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{title}</div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={`${entry.editionId}-${entry.rank}`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-[var(--wk-bg)]">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">{entry.rank}</div>
            <img src={entry.artworkUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
              <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="py-2 text-[12px] text-[var(--wk-text-faint)]">{empty}</div>}
      </div>
    </div>
  );
}
