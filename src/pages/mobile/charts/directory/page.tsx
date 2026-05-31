import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

const rankClass = (rank: number) =>
  rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

const deltaClass = (movement?: string) =>
  movement === "up" ? "delta-up" : movement === "down" ? "delta-dn" : "delta-new";

const deltaLabel = (entry: (typeof CHART_DATA)[number]) =>
  entry.movement === "new"
    ? "NEW"
    : entry.movement === "same"
    ? "—"
    : `${entry.movement === "up" ? "+" : "-"}${entry.movementAmount ?? 0}`;

const SERIES_ICON: Record<string, string> = {
  "weekly-top-40": "ri-bar-chart-line",
  "rising-voices": "ri-rocket-line",
  "genre-pulse": "ri-pulse-line",
  classics: "ri-vip-crown-line",
  breakout: "ri-fire-line",
};

export default function MobileChartsDirectory() {
  const { playTrack } = usePlayer();
  const top3 = CHART_DATA.slice(0, 3);
  const allRows = CHART_DATA.slice(3);
  const chartTracks = CHART_DATA.map((entry) => ({
    id: entry.slug,
    title: entry.title,
    artist: entry.artist,
    artworkUrl: entry.artworkUrl,
    isPlayable: entry.isPlayable,
    source: entry.source,
  }));

  const latestEditionHref = CHART_SERIES[0]?.latestEdition
    ? `/charts/${CHART_SERIES[0].id}/${CHART_SERIES[0].latestEdition.slug}`
    : `/charts/${CHART_SERIES[0]?.id ?? "imported-chart"}`;

  const totalEditions = CHART_SERIES.reduce(
    (sum, s) => sum + (s.editionCount ?? 0),
    0
  );

  // Recent editions — same as desktop
  const recentEditions = CHART_SERIES.filter((s) => s.latestEdition).map(
    (series) => ({
      seriesLabel: series.label,
      seriesId: series.id,
      editionLabel: series.latestEdition!.label,
      editionSlug: series.latestEdition!.slug,
      date: series.latestEdition!.date ?? CHART_EDITION.date,
      no1Artwork: CHART_DATA[0]?.artworkUrl ?? "",
      no1Title: CHART_DATA[0]?.title ?? "",
      entryCount: series.count,
    })
  );

  if (!CHART_DATA.length) {
    return (
      <div className="wk-mobile-v5 px-5 py-16 text-[var(--wk-text-muted)]">
        No imported chart entries are available yet.
      </div>
    );
  }

  return (
    <div className="wk-mobile-v5">
      {/* Header */}
      <section className="charts-hdr">
        <div className="charts-ed-badge">
          <i className="ri-bar-chart-line" />{" "}
          {CHART_SERIES[0]?.label ?? "WAKILISHA Charts"}
        </div>
        <h1 className="charts-title">Chart Universe</h1>
        <p className="charts-meta">
          {CHART_DATA.length} entries · {CHART_SERIES.length} series ·{" "}
          {CHART_EDITION.date || "Imported edition"}
        </p>
      </section>

      {/* Stats strip — same as desktop */}
      <div
        className="grid grid-cols-4 gap-px border-y border-[var(--wk-border)]"
        style={{ background: "var(--wk-border)" }}
      >
        {[
          { label: "Series", value: CHART_SERIES.length },
          { label: "Editions", value: totalEditions },
          { label: "Entries", value: CHART_DATA.length },
          { label: "Updated", value: CHART_EDITION.date || "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--wk-surface)] px-2 py-3 text-center"
          >
            <div className="text-[14px] font-black text-[var(--wk-brand)] truncate px-1">
              {stat.value}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="charts-filter-row">
        <Link to={latestEditionHref} className="charts-filter on">
          Latest edition
        </Link>
        {CHART_SERIES.slice(0, 5).map((series) => (
          <Link
            key={series.id}
            to={
              series.latestEdition
                ? `/charts/${series.id}/${series.latestEdition.slug}`
                : `/charts/${series.id}`
            }
            className="charts-filter"
          >
            {series.label}
          </Link>
        ))}
      </div>

      {/* Top 3 hero cards */}
      <div className="chart-hero-cards">
        {top3.map((entry, idx) => (
          <Link
            key={`${entry.rank}-${entry.slug}`}
            to={`/tracks/${entry.slug}`}
            className="chart-hero-card"
          >
            <img src={entry.artworkUrl} alt="" />
            <div className="chart-hero-overlay">
              <div className={`chart-hero-rank ${rankClass(entry.rank)}`}>
                {entry.rank}
              </div>
              <div className="min-w-0 flex-1">
                <div className="chart-row-title">{entry.title}</div>
                <div className="chart-row-sub">{entry.artist}</div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  playTrack(chartTracks[idx], chartTracks);
                }}
                className="phn-mp-btn phn-mp-play"
              >
                <i className="ri-play-fill" />
              </button>
            </div>
          </Link>
        ))}
      </div>

      {/* All remaining positions — same as desktop (shows everything) */}
      <div className="spec-section-hd">
        Positions 4–{CHART_DATA.length}
      </div>
      <div className="chart-row-list">
        {allRows.map((entry, idx) => (
          <Link
            key={`${entry.rank}-${entry.slug}`}
            to={`/tracks/${entry.slug}`}
            className="chart-row"
          >
            <div className="chart-row-num">{entry.rank}</div>
            <div className="chart-row-art">
              <img src={entry.artworkUrl} alt="" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="chart-row-title">{entry.title}</div>
              <div className="chart-row-sub">{entry.artist}</div>
            </div>
            <div className={`chart-delta ${deltaClass(entry.movement)}`}>
              {deltaLabel(entry)}
            </div>
          </Link>
        ))}
      </div>

      {/* Chart series cards — same as desktop */}
      <div className="spec-section-hd">Chart series</div>
      <div className="px-5 pb-4 flex flex-col gap-3">
        {CHART_SERIES.map((series) => {
          const icon = SERIES_ICON[series.id] ?? "ri-bar-chart-line";
          const href = series.latestEdition
            ? `/charts/${series.id}/${series.latestEdition.slug}`
            : `/charts/${series.id}`;
          return (
            <Link
              key={series.id}
              to={href}
              className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 active:scale-[0.98] active:opacity-80 transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)]">
                <i className={`${icon} text-lg text-[var(--wk-brand)]`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-[var(--wk-text)]">
                  {series.label}
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  Top {series.entryCount} · {series.editionCount ?? 1} editions
                </div>
                <div className="text-[11px] text-[var(--wk-text-faint)]">
                  {series.description}
                </div>
              </div>
              <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
            </Link>
          );
        })}
      </div>

      {/* Recent editions archive — same as desktop */}
      {recentEditions.length > 0 && (
        <>
          <div className="spec-section-hd">Recent editions</div>
          <div className="px-5 pb-4">
            <div className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="divide-y divide-[var(--wk-divider)]">
                {recentEditions.map((row) => (
                  <Link
                    key={`${row.seriesId}-${row.editionSlug}`}
                    to={`/charts/${row.seriesId}/${row.editionSlug}`}
                    className="flex items-center gap-3 px-4 py-3 active:scale-[0.98] active:opacity-80 transition-all"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {row.no1Artwork ? (
                        <img src={row.no1Artwork} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-bar-chart-line text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-[var(--wk-text)]">
                        {row.seriesLabel}
                      </div>
                      <div className="text-[11px] text-[var(--wk-text-muted)]">
                        {row.editionLabel} · Top {row.entryCount}
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--wk-text-faint)] shrink-0">
                      {row.date}
                    </div>
                    <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Methodology — same as desktop */}
      <div className="spec-section-hd">How charts are compiled</div>
      <div className="px-5 pb-8 grid grid-cols-2 gap-3">
        {[
          { icon: "ri-database-2-line", title: "Verified data", desc: "Streaming from Spotify, Apple Music, YouTube, Boomplay." },
          { icon: "ri-radio-line", title: "Radio airplay", desc: "Monitored across 12 African countries." },
          { icon: "ri-line-chart-line", title: "Digital activity", desc: "Social, playlist adds, search volume." },
          { icon: "ri-shield-check-line", title: "Verified tracks", desc: "All tracks verified against ISRC data." },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)]">
              <i className={`${item.icon} text-[var(--wk-brand)]`} />
            </div>
            <div className="text-[12px] font-bold text-[var(--wk-text)] mb-0.5">
              {item.title}
            </div>
            <div className="text-[10px] text-[var(--wk-text-muted)] leading-relaxed">
              {item.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}