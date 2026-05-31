import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

const HERO_IMAGE = "https://readdy.ai/api/search-image?query=abstract%20dark%20minimalist%20music%20visualization%20with%20subtle%20green%20neon%20light%20streaks%20on%20deep%20black%20background%20geometric%20waveforms%20and%20floating%20particles%20premium%20cinematic%20atmosphere%20no%20text%20high%20contrast%20editorial%20photography%20style&width=1600&height=640&seq=charts-hero-01&orientation=landscape";

const SERIES_ACCENT: Record<string, string> = {
  "weekly-top-40": "#84C241",
  "rising-voices": "#E8A23A",
  "genre-pulse": "#D6766A",
  "classics": "#C9A96E",
  "breakout": "#4FD9C2",
};

const SERIES_ICON: Record<string, string> = {
  "weekly-top-40": "ri-bar-chart-line",
  "rising-voices": "ri-rocket-line",
  "genre-pulse": "ri-pulse-line",
  "classics": "ri-vip-crown-line",
  "breakout": "ri-fire-line",
};

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();

  const topTrack = CHART_DATA[0] ?? null;
  const hasData = CHART_DATA.length > 0;

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

  const handlePlay = (idx: number) => {
    if (!chartTracks[idx]) return;
    playTrack(chartTracks[idx], chartTracks);
  };

  const handlePlayTop5 = () => {
    const top5 = chartTracks.slice(0, 5);
    if (top5.length > 0) playTrack(top5[0], top5);
  };

  const latestEditionHref =
    CHART_SERIES[0]?.latestEdition
      ? `/charts/${CHART_SERIES[0].id}/${CHART_SERIES[0].latestEdition.slug}`
      : `/charts/${CHART_SERIES[0]?.id ?? "weekly-top-40"}`;

  const totalEditions = CHART_SERIES.reduce((sum, s) => sum + (s.editionCount ?? 0), 0);

  // Get recent editions across all series (mocked from series data)
  const recentEditions = useMemo(() => {
    const rows: Array<{
      seriesLabel: string;
      seriesId: string;
      editionLabel: string;
      editionSlug: string;
      date: string;
      no1Title: string;
      no1Artist: string;
      no1Artwork: string;
      entryCount: number;
    }> = [];

    CHART_SERIES.forEach((series) => {
      if (series.latestEdition) {
        rows.push({
          seriesLabel: series.label,
          seriesId: series.id,
          editionLabel: series.latestEdition.label,
          editionSlug: series.latestEdition.slug,
          date: series.latestEdition.date ?? CHART_EDITION.date,
          no1Title: topTrack?.title ?? "",
          no1Artist: topTrack?.artist ?? "",
          no1Artwork: topTrack?.artworkUrl ?? "",
          entryCount: series.count,
        });
      }
    });

    return rows;
  }, []);

  if (!hasData) {
    return (
      <div className="min-h-screen">
        <section className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-bar-chart-box-line text-2xl" />
            </div>
            <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
            <h1 className="wk-h-page">Chart data has not been seeded yet.</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              The charts directory now renders only imported registry data. Run the CSV registry generation and seed the app before showing chart entries, editions, archive rows, and #1 artwork.
            </p>
            <div className="mt-6 rounded-xl bg-[var(--wk-bg)] p-4 font-mono text-[12px] text-[var(--wk-text-soft)]">
              WAKILISHA_IMPORT_DIR="$RAW_DIR" npm run migration:generate-registry
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[520px] md:min-h-[600px] overflow-hidden flex items-end">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/70 via-transparent to-[var(--wk-bg)]/70" />
        <div className="absolute inset-0 bg-[var(--wk-brand)]/[0.03]" />

        <div className="relative wk-container px-4 pb-10 pt-20 md:px-6 md:pb-14 md:pt-24">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="wk-eyebrow">WAKILISHA charts</div>
              <span className="inline-block h-1 w-1 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--wk-brand)]">
                Directory
              </span>
            </div>

            <h1 className="text-[clamp(44px,7vw,88px)] font-black leading-[0.9] tracking-[-0.055em] text-[var(--wk-text)]">
              Chart Universe
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
              The definitive index of African music charts. Track what is rising, what has stayed, and what is breaking through across every series.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={latestEditionHref}
                className="wk-button wk-button-primary whitespace-nowrap"
              >
                <i className="ri-bar-chart-line" /> Latest edition
              </Link>
              <button
                onClick={handlePlayTop5}
                className="wk-button wk-button-ghost whitespace-nowrap"
              >
                <i className="ri-play-fill" /> Play top 5
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-5 md:px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Active series" value={CHART_SERIES.length} />
            <Stat label="Total editions" value={totalEditions} />
            <Stat label="Chart entries" value={CHART_DATA.length} />
            <Stat label="Latest update" value={CHART_EDITION.date || "—"} />
          </div>
        </div>
      </section>

      {/* Featured latest edition */}
      <section className="wk-container px-4 py-10 md:px-6 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-2">Current edition</div>
            <h2 className="wk-h-section">
              {CHART_SERIES[0]?.label ?? "Weekly Top 40"}
            </h2>
            <p className="mt-1 text-[14px] text-[var(--wk-text-muted)]">
              Week {CHART_EDITION.weekNumber} · {CHART_EDITION.date} · Top {CHART_SERIES[0]?.entryCount ?? 40}
            </p>
          </div>
          <Link
            to={latestEditionHref}
            className="hidden md:inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)] whitespace-nowrap"
          >
            View full chart <i className="ri-arrow-right-line" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
          {/* Top 5 preview */}
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            {/* Header */}
            <div className="grid grid-cols-[48px_56px_1fr_80px_40px] items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
              <div className="text-center">#</div>
              <div></div>
              <div>Track</div>
              <div className="hidden md:block text-right">Stats</div>
              <div></div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {CHART_DATA.slice(0, 5).map((entry) => (
                <div
                  key={entry.rank}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)]"
                >
                  {/* Rank */}
                  <div className="flex w-10 shrink-0 flex-col items-center">
                    <span
                      className="text-[20px] font-black leading-none"
                      style={{
                        color:
                          entry.rank === 1
                            ? "#C9A96E"
                            : entry.rank === 2
                              ? "#A8A8A8"
                              : entry.rank === 3
                                ? "#B87333"
                                : "var(--wk-text-muted)",
                      }}
                    >
                      {entry.rank}
                    </span>
                    {entry.movement && (
                      <span
                        className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold"
                        style={{
                          color:
                            entry.movement === "up"
                              ? "var(--wk-success)"
                              : entry.movement === "down"
                                ? "var(--wk-danger)"
                                : entry.movement === "new"
                                  ? "var(--wk-brand)"
                                  : "var(--wk-text-faint)",
                        }}
                      >
                        <i
                          className={`text-[10px] ${
                            entry.movement === "up"
                              ? "ri-arrow-up-line"
                              : entry.movement === "down"
                                ? "ri-arrow-down-line"
                                : entry.movement === "new"
                                  ? "ri-star-smile-line"
                                  : "ri-subtract-line"
                          }`}
                        />
                        {entry.movementAmount && entry.movementAmount > 0
                          ? entry.movementAmount
                          : ""}
                      </span>
                    )}
                  </div>

                  {/* Artwork */}
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                    {entry.artworkUrl ? (
                      <img
                        src={entry.artworkUrl}
                        alt=""
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                        <i className="ri-music-2-line text-lg" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-[var(--wk-text)]">
                        {entry.title}
                      </span>
                      {entry.peakPosition === entry.rank && (
                        <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                          PEAK
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-[var(--wk-text-muted)]">
                      {entry.artist}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="hidden shrink-0 flex-col items-end gap-0.5 md:flex">
                    {entry.weeksOnChart !== undefined && (
                      <span className="text-[11px] text-[var(--wk-text-faint)]">
                        {entry.weeksOnChart} wk
                        {entry.weeksOnChart !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Play */}
                  <button
                    onClick={() => handlePlay((entry.rank ?? 1) - 1)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all duration-[var(--wk-d-fast)] group-hover:opacity-100"
                  >
                    <i className="ri-play-mini-fill text-xs" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--wk-divider)] px-4 py-3">
              <Link
                to={latestEditionHref}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)]"
              >
                View all {CHART_SERIES[0]?.entryCount ?? CHART_DATA.length} positions
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>

          {/* #1 card */}
          <div className="flex flex-col gap-5">
            {topTrack && (
              <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                <div className="relative h-44 bg-[var(--wk-surface-raised)]">
                  <img
                    src={topTrack.artworkUrl}
                    alt={topTrack.title}
                    className="h-full w-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-surface)] via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C9A96E]/20 text-[#C9A96E]">
                        <i className="ri-vip-crown-2-fill text-sm" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#C9A96E]">
                        Current #1
                      </span>
                    </div>
                    <div className="truncate text-[22px] font-black text-[var(--wk-text)]">
                      {topTrack.title}
                    </div>
                    <div className="truncate text-[14px] text-[var(--wk-text-muted)]">
                      {topTrack.artist}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-[20px] font-black text-[var(--wk-brand)]">
                        {topTrack.weeksOnChart ?? 0}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">
                        Weeks
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[20px] font-black text-[var(--wk-brand)]">
                        #{topTrack.peakPosition ?? 1}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">
                        Peak
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[20px] font-black text-[var(--wk-brand)]">
                        {topTrack.genre ?? "—"}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-faint)]">
                        Genre
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handlePlay(0)}
                      className="wk-button wk-button-primary flex-1 justify-center text-[12px]"
                    >
                      <i className="ri-play-fill" /> Play
                    </button>
                    <Link
                      to={`/tracks/${topTrack.slug}`}
                      className="wk-button wk-button-ghost flex-1 justify-center text-[12px]"
                    >
                      <i className="ri-music-2-line" /> Track
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Quick signals */}
            <SignalStrip title="New entries" entries={CHART_DATA.filter((e) => e.movement === "new").slice(0, 3)} badge="New" />
            <SignalStrip title="Biggest climbers" entries={CHART_DATA.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 3)} badge="Climber" />
          </div>
        </div>
      </section>

      {/* Chart series grid */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="wk-eyebrow mb-2">Chart series</div>
              <h2 className="wk-h-section">Browse by series</h2>
            </div>
            <span className="text-[13px] text-[var(--wk-text-muted)]">
              {CHART_SERIES.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHART_SERIES.map((series) => {
                const accent = SERIES_ACCENT[series.id] ?? "var(--wk-brand)";
                const icon = SERIES_ICON[series.id] ?? "ri-bar-chart-line";
                const href = series.latestEdition
                  ? `/charts/${series.id}/${series.latestEdition.slug}`
                  : `/charts/${series.id}`;
                return (
                  <Link
                    key={series.id}
                    to={href}
                    className="group flex flex-col rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-all duration-[var(--wk-d-standard)] hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface)]"
                  >
                    {/* Top row */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                          style={{ backgroundColor: `${accent}15` }}
                        >
                          <i
                            className={`${icon} text-xl`}
                            style={{ color: accent }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[16px] font-bold text-[var(--wk-text)]">
                            {series.label}
                          </div>
                          <div className="text-[12px] text-[var(--wk-text-muted)]">
                            {series.description}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]">
                        Active
                      </span>
                    </div>

                    {/* Mini #1 preview */}
                    <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                        {topTrack?.artworkUrl ? (
                          <img
                            src={topTrack.artworkUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                            <i className="ri-music-2-line" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-[var(--wk-text)]">
                          Latest #1
                        </div>
                        <div className="truncate text-[11px] text-[var(--wk-text-muted)]">
                          {topTrack?.title ?? "No data"}
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--wk-divider)] pt-4">
                      <div className="flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                        <span className="font-bold text-[var(--wk-text)]">
                          Top {series.entryCount}
                        </span>
                        <span className="text-[var(--wk-text-faint)]">·</span>
                        <span>
                          <span className="font-bold text-[var(--wk-text)]">
                            {series.editionCount ?? 1}
                          </span>{" "}
                          editions
                        </span>
                      </div>
                      <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      </section>

      {/* Recent editions */}
      <section className="wk-container px-4 py-10 md:px-6 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-2">Archive</div>
            <h2 className="wk-h-section">Recent editions</h2>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          {/* Header */}
          <div className="hidden grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)] md:grid">
            <div>Series</div>
            <div>Edition</div>
            <div className="text-right">Entries</div>
            <div className="text-right">Date</div>
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {recentEditions.map((row) => (
              <Link
                key={`${row.seriesId}-${row.editionSlug}`}
                to={`/charts/${row.seriesId}/${row.editionSlug}`}
                className="grid grid-cols-1 items-center gap-2 px-5 py-3 transition-colors hover:bg-[var(--wk-bg)] md:grid-cols-[1.5fr_1.5fr_1fr_1fr] md:gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                    {row.no1Artwork ? (
                      <img
                        src={row.no1Artwork}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                        <i className="ri-bar-chart-line text-sm" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">
                      {row.seriesLabel}
                    </div>
                    <div className="text-[11px] text-[var(--wk-text-muted)] md:hidden">
                      {row.editionLabel}
                    </div>
                  </div>
                </div>
                <div className="hidden text-[13px] text-[var(--wk-text)] md:block">
                  {row.editionLabel}
                </div>
                <div className="text-[12px] font-bold text-[var(--wk-text-muted)] md:text-right">
                  Top {CHART_SERIES.find((s) => s.id === row.seriesId)?.entryCount ?? row.entryCount}
                </div>
                <div className="text-[12px] text-[var(--wk-text-muted)] md:text-right">
                  {row.date}
                </div>
              </Link>
            ))}
            {recentEditions.length === 0 && (
              <div className="px-5 py-6 text-[13px] text-[var(--wk-text-muted)]">
                No recent editions available.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-6">
            <div className="wk-eyebrow mb-2">Trust</div>
            <h2 className="wk-h-section">How the charts are compiled</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "ri-database-2-line",
                title: "Verified data",
                desc: "Streaming data from Spotify, Apple Music, YouTube, and Boomplay.",
              },
              {
                icon: "ri-radio-line",
                title: "Radio airplay",
                desc: "Monitored across 12 African countries and major FM networks.",
              },
              {
                icon: "ri-line-chart-line",
                title: "Digital activity",
                desc: "Social engagement, playlist adds, and search volume combined.",
              },
              {
                icon: "ri-shield-check-line",
                title: "Verified tracks",
                desc: "All tracks verified against ISRC and graph relationship data.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                  <i className={`${item.icon} text-lg`} />
                </div>
                <div className="text-[15px] font-bold text-[var(--wk-text)] mb-1">
                  {item.title}
                </div>
                <div className="text-[13px] leading-[1.6] text-[var(--wk-text-muted)]">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)] mb-1">
                  Methodology
                </div>
                <div className="text-[13px] text-[var(--wk-text-muted)]">
                  {CHART_EDITION.methodology}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-[var(--wk-text-muted)] shrink-0">
                <span>
                  <span className="font-bold text-[var(--wk-text)]">{totalEditions}</span>{" "}
                  editions
                </span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span>
                  <span className="font-bold text-[var(--wk-text)]">
                    {CHART_DATA.length}
                  </span>{" "}
                  entries tracked
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-[28px] font-black leading-none text-[var(--wk-brand)]">
        {value}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
        {label}
      </div>
    </div>
  );
}

function SignalStrip({
  title,
  entries,
  badge,
}: {
  title: string;
  entries: typeof CHART_DATA;
  badge: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">
          {title}
        </div>
        <span className="text-[11px] font-bold text-[var(--wk-brand)]">
          {entries.length}
        </span>
      </div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.rank}
            className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)]"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">
              {entry.rank}
            </div>
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
              <img
                src={entry.artworkUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">
                {entry.title}
              </div>
              <div className="truncate text-[11px] text-[var(--wk-text-muted)]">
                {entry.artist}
              </div>
            </div>
            <span className="text-[10px] font-bold text-[var(--wk-brand)]">
              {badge}
            </span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-2 text-[12px] text-[var(--wk-text-faint)]">
            No entries this week.
          </div>
        )}
      </div>
    </div>
  );
}