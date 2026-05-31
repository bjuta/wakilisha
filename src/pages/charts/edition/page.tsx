import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";

const rankTone = (rank: number) => rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
const movementLabel = (entry: typeof CHART_DATA[number]) => entry.movement === "new" ? "NEW" : entry.movement === "same" ? "—" : `${entry.movement === "up" ? "+" : "-"}${entry.movementAmount ?? 0}`;

export default function ChartEdition() {
  const { series, edition } = useParams<{ series: string; edition: string }>();
  const { playTrack } = usePlayer();
  const seriesData = CHART_SERIES.find((item) => item.id === series) ?? CHART_SERIES[0];
  const topTrack = CHART_DATA[0] ?? null;
  const top3 = CHART_DATA.slice(0, 3);
  const rows = CHART_DATA.slice(3);

  const chartTracks = useMemo(() => CHART_DATA.map((entry) => ({
    id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
    title: entry.title,
    artist: entry.artist,
    artworkUrl: entry.artworkUrl,
    isPlayable: entry.isPlayable,
    source: entry.source,
  })), []);

  const newEntries = useMemo(() => CHART_DATA.filter((entry) => entry.movement === "new").slice(0, 5), []);
  const climbers = useMemo(() => CHART_DATA.filter((entry) => entry.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 5), []);
  const archives = CHART_SERIES.slice(0, 6);

  const genreBreakdown = useMemo(() => {
    const counts = CHART_DATA.reduce<Record<string, number>>((acc, entry) => {
      const genre = entry.genre || "Unknown";
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({ genre, count }));
  }, []);

  const trajectory = useMemo(() => {
    const weeks = Math.max(6, Math.min(12, topTrack?.weeksOnChart || 8));
    return Array.from({ length: weeks }, (_, i) => Math.max(8, 90 - (i * 5 + (topTrack?.rank || 1) * 2)));
  }, [topTrack]);

  const playAt = (idx: number) => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks);
  };

  if (!CHART_DATA.length || !topTrack) {
    return (
      <main className="wk-container px-6 py-20 text-center">
        <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">No chart entries available</h1>
        <p className="text-[var(--wk-text-muted)]">Import the WAKILISHA chart registry to render this edition.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="chart-edition-hero">
        <div className="chart-edition-bg" style={{ backgroundImage: `url(${topTrack.artworkUrl})` }} />
        <div className="chart-edition-shade" />
        <div className="chart-edition-inner wk-container-wide">
          <div className="chart-edition-grid">
            <div>
              <div className="chart-edition-kicker"><WkIcon name="BarChart3" size={14} /> {seriesData?.label ?? "WAKILISHA Charts"}</div>
              <h1 className="chart-edition-title">Chart edition</h1>
              <p className="chart-edition-sub">{CHART_EDITION.totalEntries} ranked positions, {CHART_EDITION.totalArtists} artists, {CHART_EDITION.newEntries} new entries. Dense, playable, archive-ready chart infrastructure.</p>
              <div className="chart-edition-actions">
                <button className="wk-button wk-button-primary" onClick={() => playAt(0)}><WkIcon name="Play" size={16} /> Play #1</button>
                <button className="wk-button wk-button-ghost" onClick={() => playAt(0)}><WkIcon name="ListMusic" size={16} /> Play chart</button>
                <Link to="/charts" className="wk-button wk-button-ghost"><WkIcon name="Archive" size={16} /> Archive</Link>
                <ShareButton item={{ title: seriesData?.label ?? "WAKILISHA Chart Edition", subtitle: edition || CHART_EDITION.date || "Current edition", description: CHART_EDITION.methodology, imageUrl: topTrack.artworkUrl, type: "chart" }} />
              </div>
              <div className="chart-stats-strip">
                <Stat value={CHART_EDITION.totalEntries} label="Entries" />
                <Stat value={CHART_EDITION.totalArtists} label="Artists" />
                <Stat value={CHART_EDITION.newEntries} label="New" />
                <Stat value={CHART_EDITION.longestRunning.weeks} label="Longest" />
              </div>
            </div>
            <aside className="chart-no1-card">
              <div className="chart-no1-art"><img src={topTrack.artworkUrl} alt="" /><div className="chart-no1-badge">#1</div></div>
              <div className="chart-no1-title">{topTrack.title}</div>
              <div className="chart-no1-artist">{topTrack.artist} · Peak #{topTrack.peakPosition}</div>
            </aside>
          </div>
        </div>
      </section>

      <div className="wk-container-wide px-4 py-10 md:px-6">
        <section className="chart-top3-grid">
          {top3.map((entry, idx) => (
            <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-podium-card">
              <img src={entry.artworkUrl} alt="" />
              <div className={`chart-podium-rank ${rankTone(entry.rank)}`}>{entry.rank}</div>
              <div className="chart-podium-body">
                <div className="chart-podium-title">{entry.title}</div>
                <div className="chart-podium-artist">{entry.artist} · {movementLabel(entry)}</div>
                <button onClick={(e) => { e.preventDefault(); playAt(idx); }} className="wk-button wk-button-sm wk-button-primary mt-3"><WkIcon name="Play" size={14} /> Play</button>
              </div>
            </Link>
          ))}
        </section>

        <section className="chart-trajectory">
          <div className="chart-trajectory-head">
            <div><div className="section-kicker">#1 trajectory</div><div className="section-title" style={{ fontSize: 24 }}>{topTrack.title}</div></div>
            <div className="artist-list-sub">{topTrack.weeksOnChart || 0} weeks · Peak #{topTrack.peakPosition}</div>
          </div>
          <div className="chart-trajectory-line">
            {trajectory.map((height, i) => <div key={i} className="chart-trajectory-bar" style={{ height: `${height}%` }} />)}
          </div>
        </section>

        <section className="chart-table-shell">
          <div>
            <div className="section-head">
              <div><div className="section-kicker">Positions 4–{CHART_DATA.length}</div><h2 className="section-title">Full ranked list</h2></div>
              <p className="section-copy">Rows after the podium stay dense for comparison, movement, weeks, peak, source, and play actions.</p>
            </div>
            <div className="chart-table-card">
              {rows.map((entry, idx) => (
                <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-row-39">
                  <div className="chart-row-rank">{entry.rank}</div>
                  <div className="chart-row-art"><img src={entry.artworkUrl} alt="" /></div>
                  <div className="min-w-0"><div className="chart-row-name">{entry.title}</div><div className="chart-row-sub">{entry.artist} · {entry.genre || "Genre pending"}</div></div>
                  <div className="chart-row-stats">Peak #{entry.peakPosition}<br />{entry.weeksOnChart || 0} weeks</div>
                  <button onClick={(e) => { e.preventDefault(); playAt(idx + 3); }} className="chart-btn"><WkIcon name="Play" size={14} /></button>
                </Link>
              ))}
            </div>
          </div>

          <aside className="chart-side-stack">
            <SideCard title="New entries" entries={newEntries} metric={(entry) => "NEW"} />
            <SideCard title="Biggest climbers" entries={climbers} metric={(entry) => `+${entry.movementAmount ?? 0}`} />
            <div className="chart-side-card">
              <div className="chart-side-title">Genre breakdown</div>
              {genreBreakdown.map((g) => {
                const pct = CHART_DATA.length ? Math.round((g.count / CHART_DATA.length) * 100) : 0;
                return <div key={g.genre} className="mb-3"><div className="flex justify-between text-[12px]"><b>{g.genre}</b><span className="text-[var(--wk-text-muted)]">{pct}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--wk-bg)]"><div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${pct}%` }} /></div></div>;
              })}
            </div>
            <div className="chart-side-card">
              <div className="chart-side-title">Archive / series</div>
              {archives.map((item) => <Link key={item.id} to={item.latestEdition ? `/charts/${item.id}/${item.latestEdition.slug}` : `/charts/${item.id}`} className="chart-archive-link"><span>{item.label}</span><WkIcon name="ArrowRight" size={14} /></Link>)}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="chart-stat-card"><div className="chart-stat-value">{value}</div><div className="chart-stat-label">{label}</div></div>;
}

function SideCard({ title, entries, metric }: { title: string; entries: typeof CHART_DATA; metric: (entry: typeof CHART_DATA[number]) => string }) {
  return (
    <div className="chart-side-card">
      <div className="chart-side-title">{title}</div>
      {entries.map((entry) => (
        <Link key={`${title}-${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-signal-row">
          <div className="chart-row-rank text-[12px]">{metric(entry)}</div>
          <div className="chart-signal-art"><img src={entry.artworkUrl} alt="" /></div>
          <div className="min-w-0"><div className="chart-row-name text-[12px]">{entry.title}</div><div className="chart-row-sub">{entry.artist}</div></div>
          <WkIcon name="ArrowRight" size={13} />
        </Link>
      ))}
      {entries.length === 0 && <div className="artist-list-sub">No entries for this signal.</div>}
    </div>
  );
}
