import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

const rankClass = (rank: number) => rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
const deltaClass = (movement?: string) => movement === "up" ? "delta-up" : movement === "down" ? "delta-dn" : "delta-new";
const deltaLabel = (entry: typeof CHART_DATA[number]) => entry.movement === "new" ? "NEW" : entry.movement === "same" ? "—" : `${entry.movement === "up" ? "+" : "-"}${entry.movementAmount ?? 0}`;

export default function MobileChartsDirectory() {
  const { playTrack } = usePlayer();
  const top = CHART_DATA.slice(0, 3);
  const rows = CHART_DATA.slice(3, 20);
  const chartTracks = CHART_DATA.map((entry) => ({ id: entry.slug, title: entry.title, artist: entry.artist, artworkUrl: entry.artworkUrl, isPlayable: entry.isPlayable, source: entry.source }));
  const latestEditionHref = CHART_SERIES[0]?.latestEdition ? `/charts/${CHART_SERIES[0].id}/${CHART_SERIES[0].latestEdition.slug}` : `/charts/${CHART_SERIES[0]?.id ?? "imported-chart"}`;

  if (!CHART_DATA.length) {
    return <div className="wk-mobile-v5 px-5 py-16 text-white/50">No imported chart entries are available yet.</div>;
  }

  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><i className="ri-bar-chart-line" /> {CHART_SERIES[0]?.label ?? "WAKILISHA Charts"}</div>
        <h1 className="charts-title">Charts</h1>
        <p className="charts-meta">{CHART_DATA.length} entries · {CHART_SERIES.length} series · {CHART_EDITION.date || "Imported edition"}</p>
      </section>

      <div className="charts-filter-row">
        <Link to={latestEditionHref} className="charts-filter on">Latest edition</Link>
        {CHART_SERIES.slice(0, 5).map((series) => <Link key={series.id} to={`/charts/${series.id}`} className="charts-filter">{series.label}</Link>)}
      </div>

      <div className="chart-hero-cards">
        {top.map((entry, idx) => (
          <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-hero-card">
            <img src={entry.artworkUrl} alt="" />
            <div className="chart-hero-overlay">
              <div className={`chart-hero-rank ${rankClass(entry.rank)}`}>{entry.rank}</div>
              <div className="min-w-0 flex-1">
                <div className="chart-row-title">{entry.title}</div>
                <div className="chart-row-sub">{entry.artist}</div>
              </div>
              <button onClick={(e) => { e.preventDefault(); playTrack(chartTracks[idx], chartTracks); }} className="phn-mp-btn phn-mp-play"><i className="ri-play-fill" /></button>
            </div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Positions 4–20</div>
      <div className="chart-row-list">
        {rows.map((entry, idx) => (
          <Link key={`${entry.rank}-${entry.slug}`} to={`/tracks/${entry.slug}`} className="chart-row">
            <div className="chart-row-num">{entry.rank}</div>
            <div className="chart-row-art"><img src={entry.artworkUrl} alt="" /></div>
            <div className="min-w-0">
              <div className="chart-row-title">{entry.title}</div>
              <div className="chart-row-sub">{entry.artist}</div>
            </div>
            <div className={`chart-delta ${deltaClass(entry.movement)}`}>{deltaLabel(entry)}</div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Chart series</div>
      <div className="labels-list">
        {CHART_SERIES.map((series) => (
          <Link key={series.id} to={series.latestEdition ? `/charts/${series.id}/${series.latestEdition.slug}` : `/charts/${series.id}`} className="lbl-row">
            <div className="lbl-avatar"><i className="ri-bar-chart-grouped-line" /></div>
            <div>
              <div className="lbl-name">{series.label}</div>
              <div className="lbl-meta">{series.count} entries · {series.editionCount ?? 1} editions</div>
            </div>
            <i className="ri-arrow-right-s-line lbl-chevron" />
          </Link>
        ))}
      </div>
    </div>
  );
}
