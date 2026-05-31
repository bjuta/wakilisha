import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
} from "@/services/chartsPublic/client";
import {
  toChartDirectoryViewModel,
  toChartTrackPlayerModels,
  type ChartDirectoryViewModel,
  type ChartEntryRowViewModel,
} from "@/services/chartsPublic/viewModels";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";

const HERO_IMAGE = "https://readdy.ai/api/search-image?query=abstract%20dark%20minimalist%20music%20visualization%20with%20subtle%20green%20neon%20light%20streaks%20on%20deep%20black%20background%20geometric%20waveforms%20and%20floating%20particles%20premium%20cinematic%20atmosphere%20no%20text%20high%20contrast%20editorial%20photography%20style&width=1600&height=640&seq=charts-hero-01&orientation=landscape";

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string; diagnostics?: string }
    | { status: "empty" }
    | { status: "loaded"; data: ChartDirectoryViewModel }
  >({ status: "loading" });
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data: families, meta: familiesMeta } = await getChartFamilies();
      if (families.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const featuredFamily = families[0];
      const featuredSlug = featuredFamily.slug ?? featuredFamily.familyKey;
      const { data: edition, meta: editionMeta } = await getLatestChartEdition(featuredSlug);
      if (!edition) {
        setState({ status: "empty" });
        return;
      }
      const { data: entries } = await getChartEditionEntries(featuredSlug, edition.slug);
      const data = toChartDirectoryViewModel(
        families,
        [edition],
        featuredSlug,
        edition,
        entries,
        editionMeta.source === "cache" ? { ...editionMeta, isStale: editionMeta.isStale || familiesMeta.isStale } : editionMeta
      );
      setState({ status: "loaded", data });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        diagnostics: err instanceof Error ? err.stack : undefined,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = () => load();

  const loadedData = state.status === "loaded" ? state.data : null;
  const chartTracks = useMemo(() => loadedData ? toChartTrackPlayerModels(loadedData.topEntries) : [], [loadedData]);
  const top10 = useMemo(() => loadedData ? toChartTrackPlayerModels(loadedData.topEntries) : [], [loadedData]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen">
        <section className="relative min-h-[560px] md:min-h-[640px] overflow-hidden flex items-end">
          <div className="absolute inset-0 bg-[var(--wk-bg)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/85 to-[var(--wk-bg)]/30" />
          <div className="relative wk-container px-4 pb-10 pt-20 md:px-6 md:pb-16 md:pt-28 w-full">
            <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[1fr_420px]">
              <div className="space-y-4">
                <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-16 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-10 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="flex gap-6 mt-6">
                  <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
              <div className="h-64 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
        <section className="wk-container px-4 pt-14 md:px-6 md:pt-20">
          <div className="h-6 w-48 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-6" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-12 w-12 rounded-lg bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="h-40 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-40 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen">
        <section className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
              <i className="ri-error-warning-line text-2xl" />
            </div>
            <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
            <h1 className="wk-h-page">Could not load chart data</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              Something went wrong while fetching the chart directory. Please try again.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={handleRetry} className="wk-button wk-button-primary">
                <i className="ri-refresh-line" /> Retry
              </button>
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="wk-button wk-button-ghost text-[13px]"
              >
                {showErrorDetails ? "Hide" : "Show"} details
              </button>
            </div>
            {showErrorDetails && (
              <div className="mt-4 rounded-xl bg-[var(--wk-bg)] p-4 font-mono text-[12px] text-[var(--wk-text-soft)] overflow-auto">
                <div className="mb-2 font-bold text-[var(--wk-text)]">Diagnostics</div>
                <div className="space-y-1">
                  <div>Mode: {import.meta.env.VITE_CHARTS_PUBLIC_MODE ?? "mock"}</div>
                  <div>Endpoint: GET /charts</div>
                  <div>Error: {state.error}</div>
                </div>
                {state.diagnostics && (
                  <div className="mt-2 text-[var(--wk-text-faint)]">{state.diagnostics}</div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="min-h-screen">
        <section className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-bar-chart-box-line text-2xl" />
            </div>
            <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
            <h1 className="wk-h-page">No published chart edition found</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              There are no published chart editions available at the moment. Check back soon.
            </p>
            <div className="mt-6">
              <button onClick={handleRetry} className="wk-button wk-button-primary">
                <i className="ri-refresh-line" /> Refresh
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const data = state.data;
  const featured = data.featuredFamily;
  const edition = data.featuredEdition;
  const topTrack = data.topEntries[0] ?? null;
  const top5 = data.topEntries;
  const allEntries = data.topEntries;
  const newEntries = allEntries.filter((e) => e.movement === "new");
  const climbers = allEntries
    .filter((e) => e.movement === "up")
    .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0));

  const handlePlay = (idx: number) => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks);
  };
  const handlePlayTop10 = () => {
    if (top10.length > 0) playTrack(top10[0], top10);
  };
  const handlePlayTop5 = () => {
    if (top5.length > 0) playTrack(chartTracks[0], chartTracks);
  };

  const latestEditionHref =
    edition
      ? `/charts/${featured?.slug ?? "weekly-top-40"}/${edition.slug}`
      : `/charts/${featured?.slug ?? "weekly-top-40"}`;

  const totalEditions = data.families.reduce((sum, s) => sum + (s.editionCount ?? 0), 0);

  // Subtle metadata
  const metaLine = data.meta.isStale
    ? `Loaded from cache (stale) · Last updated ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : data.meta.dataSource === "cache"
    ? `Loaded from cache · Last updated ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : `Loaded from ${data.meta.dataSource === "mock" ? "mock data" : "WordPress API"} · ${new Date(data.meta.fetchedAt).toLocaleTimeString()}`;

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[560px] md:min-h-[640px] overflow-hidden flex items-end">
        {topTrack?.artworkUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${topTrack.artworkUrl})`,
              filter: "blur(60px) saturate(1.3)",
              transform: "scale(1.15)",
            }}
          />
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/85 to-[var(--wk-bg)]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/80 via-transparent to-[var(--wk-bg)]/80" />
        <div className="absolute inset-0 bg-[var(--wk-brand)]/[0.03]" />

        <div className="relative wk-container px-4 pb-10 pt-20 md:px-6 md:pb-16 md:pt-28 w-full">
          <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[1fr_420px]">
            <div className="pb-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="wk-eyebrow">WAKILISHA charts</div>
                <span className="inline-block h-1 w-1 rounded-full bg-[var(--wk-brand)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--wk-brand)]">
                  Directory
                </span>
              </div>

              <h1 className="text-[clamp(44px,6vw,84px)] font-black leading-[0.9] tracking-[-0.055em] text-[var(--wk-text)]">
                {featured?.label ?? "Chart Universe"}
              </h1>

              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
                {featured?.description ?? "The definitive index of African music charts."}
                {" "}Track what is rising, what has stayed, and what is breaking through.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={handlePlayTop10} className="wk-button wk-button-primary">
                  <i className="ri-play-fill" /> Listen to top 10
                </button>
                <button className="wk-button wk-button-ghost">
                  <i className="ri-share-line" /> Share
                </button>
                <Link
                  to={latestEditionHref}
                  className="hidden md:inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)] whitespace-nowrap"
                >
                  View edition <i className="ri-arrow-right-line" />
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-6">
                <Stat label="Chart entries" value={data.stats.entries} />
                <Stat label="Series" value={data.stats.series} />
                <Stat label="Editions" value={totalEditions} />
                <Stat label="New this week" value={data.stats.newThisWeek} />
              </div>
            </div>

            {topTrack && (
              <div className="relative lg:-mb-8">
                <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/90 backdrop-blur-xl p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A96E]/15 text-[#C9A96E]">
                      <i className="ri-vip-crown-2-fill" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#C9A96E]">
                      Current #1
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl">
                      <img src={topTrack.artworkUrl ?? ""} alt={topTrack.title} className="h-full w-full object-cover object-top" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 truncate text-[20px] font-black text-[var(--wk-text)]">{topTrack.title}</div>
                      <div className="truncate text-[14px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {topTrack.genre && (
                          <span className="rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--wk-brand)]">
                            {topTrack.genre}
                          </span>
                        )}
                        {topTrack.weeksOnChart !== undefined && (
                          <span className="text-[11px] text-[var(--wk-text-faint)]">
                            {topTrack.weeksOnChart} wk{topTrack.weeksOnChart !== 1 ? "s" : ""} on chart
                          </span>
                        )}
                        {topTrack.peakPosition === 1 && (
                          <span className="rounded-full bg-[#C9A96E]/15 border border-[#C9A96E]/30 px-2 py-0.5 text-[10px] font-bold text-[#C9A96E]">
                            PEAK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                    <div className="text-center">
                      <div className="text-[18px] font-black text-[var(--wk-brand)]">{topTrack.weeksOnChart ?? 0}</div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Weeks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[18px] font-black text-[var(--wk-brand)]">#{topTrack.peakPosition ?? 1}</div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Peak</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[18px] font-black text-[var(--wk-brand)]">{topTrack.genre ?? "—"}</div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Genre</div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => handlePlay(0)} className="wk-button wk-button-primary flex-1 justify-center text-[12px]">
                      <i className="ri-play-fill" /> Play
                    </button>
                    <Link to={`/tracks/${topTrack.slug}`} className="wk-button wk-button-ghost flex-1 justify-center text-[12px]">
                      <i className="ri-music-2-line" /> Track
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Current edition section */}
      <section className="wk-container px-4 pt-14 md:px-6 md:pt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-2">This week</div>
            <h2 className="wk-h-section">Top positions</h2>
            <p className="mt-1 text-[14px] text-[var(--wk-text-muted)]">
              {edition?.weekNumber ? `Week ${edition.weekNumber} · ` : ""}
              {edition?.date ?? ""} · Top {featured?.entryCount ?? data.stats.entries}
            </p>
          </div>
          <Link to={latestEditionHref} className="hidden md:inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)] whitespace-nowrap">
            View full chart <i className="ri-arrow-right-line" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="grid grid-cols-[48px_56px_1fr_80px_40px] items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
              <div className="text-center">#</div>
              <div></div>
              <div>Track</div>
              <div className="hidden md:block text-right">Stats</div>
              <div></div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {top5.map((entry) => (
                <ChartRow entry={entry} key={entry.rank} onPlay={() => handlePlay((entry.rank ?? 1) - 1)} />
              ))}
            </div>
            <div className="border-t border-[var(--wk-divider)] px-4 py-3">
              <Link to={latestEditionHref} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)]">
                View all {featured?.entryCount ?? data.stats.entries} positions
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <SignalStrip title="New entries" entries={newEntries} badge="New" />
            <SignalStrip title="Biggest climbers" entries={climbers} badge="Climber" />
          </div>
        </div>
      </section>

      {/* Chart series grid */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] mt-10">
        <div className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="wk-eyebrow mb-2">Chart series</div>
              <h2 className="wk-h-section">Browse by series</h2>
            </div>
            <span className="text-[13px] text-[var(--wk-text-muted)]">{data.families.length} active</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.families.map((series) => {
              const href = series.latestEditionSlug
                ? `/charts/${series.slug}/${series.latestEditionSlug}`
                : `/charts/${series.slug}`;
              return (
                <Link
                  key={series.id}
                  to={href}
                  className="group flex flex-col rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-all duration-[var(--wk-d-standard)] hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors"
                        style={{ backgroundColor: `${series.accentColor}15` }}
                      >
                        <i className={`${series.icon} text-xl`} style={{ color: series.accentColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-bold text-[var(--wk-text)]">{series.label}</div>
                        <div className="text-[12px] text-[var(--wk-text-muted)]">{series.description}</div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]">
                      Active
                    </span>
                  </div>

                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {topTrack?.artworkUrl ? (
                        <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                          <i className="ri-music-2-line" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-[var(--wk-text)]">Latest #1</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{topTrack?.title ?? "No data"}</div>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--wk-divider)] pt-4">
                    <div className="flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                      <span className="font-bold text-[var(--wk-text)]">Top {series.entryCount}</span>
                      <span className="text-[var(--wk-text-faint)]">·</span>
                      <span><span className="font-bold text-[var(--wk-text)]">{series.editionCount}</span> editions</span>
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
          <div className="hidden grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)] md:grid">
            <div>Series</div>
            <div>Edition</div>
            <div className="text-right">Entries</div>
            <div className="text-right">Date</div>
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {data.families
              .filter((f) => f.latestEditionSlug)
              .map((row) => (
                <Link
                  key={`${row.id}-${row.latestEditionSlug}`}
                  to={`/charts/${row.slug}/${row.latestEditionSlug}`}
                  className="grid grid-cols-1 items-center gap-2 px-5 py-3 transition-colors hover:bg-[var(--wk-bg)] md:grid-cols-[1.5fr_1.5fr_1fr_1fr] md:gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                      {topTrack?.artworkUrl ? (
                        <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                          <i className="ri-bar-chart-line text-sm" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.label}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)] md:hidden">{row.latestEditionLabel}</div>
                    </div>
                  </div>
                  <div className="hidden text-[13px] text-[var(--wk-text)] md:block">{row.latestEditionLabel}</div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)] md:text-right">Top {row.entryCount}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)] md:text-right">{row.latestEditionDate}</div>
                </Link>
              ))}
            {data.families.filter((f) => f.latestEditionSlug).length === 0 && (
              <div className="px-5 py-6 text-[13px] text-[var(--wk-text-muted)]">No recent editions available.</div>
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
              { icon: "ri-database-2-line", title: "Verified data", desc: "Streaming data from Spotify, Apple Music, YouTube, and Boomplay." },
              { icon: "ri-radio-line", title: "Radio airplay", desc: "Monitored across 12 African countries and major FM networks." },
              { icon: "ri-line-chart-line", title: "Digital activity", desc: "Social engagement, playlist adds, and search volume combined." },
              { icon: "ri-shield-check-line", title: "Verified tracks", desc: "All tracks verified against ISRC and graph relationship data." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                  <i className={`${item.icon} text-lg`} />
                </div>
                <div className="text-[15px] font-bold text-[var(--wk-text)] mb-1">{item.title}</div>
                <div className="text-[13px] leading-[1.6] text-[var(--wk-text-muted)]">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)] mb-1">Methodology</div>
                <div className="text-[13px] text-[var(--wk-text-muted)]">
                  {edition?.methodology ?? "Combined streaming data from Spotify, Apple Music, YouTube, and Boomplay. Radio airplay monitored across 12 African countries."}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-[var(--wk-text-muted)] shrink-0">
                <span><span className="font-bold text-[var(--wk-text)]">{totalEditions}</span> editions</span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span><span className="font-bold text-[var(--wk-text)]">{data.stats.entries}</span> entries tracked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subtle metadata footer */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="wk-container px-4 py-3 md:px-6 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--wk-text-faint)]">{metaLine}</div>
          <ChartRefreshButton onRefresh={load} size="sm" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-[28px] font-black leading-none text-[var(--wk-brand)]">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{label}</div>
    </div>
  );
}

function ChartRow({ entry, onPlay }: { entry: ChartEntryRowViewModel; onPlay: () => void }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)]">
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span
          className="text-[20px] font-black leading-none"
          style={{
            color:
              entry.rank === 1 ? "#C9A96E" : entry.rank === 2 ? "#A8A8A8" : entry.rank === 3 ? "#B87333" : "var(--wk-text-muted)",
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
            <i className={`text-[10px] ${
              entry.movement === "up" ? "ri-arrow-up-line" : entry.movement === "down" ? "ri-arrow-down-line" : entry.movement === "new" ? "ri-star-smile-line" : "ri-subtract-line"
            }`} />
            {entry.movementAmount && entry.movementAmount > 0 ? entry.movementAmount : ""}
          </span>
        )}
      </div>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
        {entry.artworkUrl ? (
          <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
            <i className="ri-music-2-line text-lg" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="truncate text-[14px] font-bold text-[var(--wk-text)]">{entry.title}</span>
          {entry.peakPosition === entry.rank && (
            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
              PEAK
            </span>
          )}
        </div>
        <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-0.5 md:flex">
        {entry.weeksOnChart !== undefined && (
          <span className="text-[11px] text-[var(--wk-text-faint)]">
            {entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <button
        onClick={onPlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all duration-[var(--wk-d-fast)] group-hover:opacity-100"
      >
        <i className="ri-play-mini-fill text-xs" />
      </button>
    </div>
  );
}

function SignalStrip({
  title,
  entries,
  badge,
}: {
  title: string;
  entries: ChartEntryRowViewModel[];
  badge: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{title}</div>
        <span className="text-[11px] font-bold text-[var(--wk-brand)]">{entries.length}</span>
      </div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div key={entry.rank} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">
              {entry.rank}
            </div>
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
              <img src={entry.artworkUrl ?? ""} alt="" className="h-full w-full object-cover" />
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