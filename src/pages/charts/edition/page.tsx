import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import {
  getChartFamily,
  getLatestChartEdition,
  getChartEdition,
  getChartEditionEntries,
  getChartEditionsForFamily,
} from "@/services/chartsPublic/client";
import {
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  toChartArchiveViewModel,
  type ChartEditionViewModel,
  type ChartEntryRowViewModel,
  type ChartArchiveViewModel,
} from "@/services/chartsPublic/viewModels";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";
import { WkIcon } from "@/components/design-system/Icon";

const rankTone = (rank: number) =>
  rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

const movementLabel = (entry: ChartEntryRowViewModel) =>
  entry.movement === "new"
    ? "NEW"
    : entry.movement === "same"
    ? "—"
    : `${entry.movement === "up" ? "+" : "-"}${entry.movementAmount ?? 0}`;

export default function ChartEdition() {
  const { series, edition: editionSlug } = useParams<{
    series: string;
    edition: string;
  }>();
  const { playTrack } = usePlayer();

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string; diagnostics?: string; retryable?: boolean }
    | { status: "family_not_found" }
    | { status: "edition_not_found"; familySlug: string; familyLabel: string; latestEditionSlug?: string }
    | { status: "empty" }
    | {
        status: "loaded";
        edition: ChartEditionViewModel;
        entries: ChartEntryRowViewModel[];
        familyLabel: string;
        familySlug: string;
        archive: ChartArchiveViewModel;
        meta: { dataSource: "mock" | "wordpress" | "cache"; fetchedAt: string; isStale: boolean };
      }
  >({ status: "loading" });
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const load = useCallback(async () => {
    if (!series) {
      setState({ status: "family_not_found" });
      return;
    }
    setState({ status: "loading" });
    try {
      const { data: family } = await getChartFamily(series);
      if (!family) {
        setState({ status: "family_not_found" });
        return;
      }

      let editionResult: Awaited<ReturnType<typeof getChartEdition>>;
      let editionMeta: { source: "mock" | "wordpress" | "cache"; fetchedAt: string; isStale: boolean };

      if (editionSlug) {
        const result = await getChartEdition(series, editionSlug);
        editionResult = result;
        editionMeta = result.meta;
      } else {
        const result = await getLatestChartEdition(series);
        editionResult = result;
        editionMeta = result.meta;
      }

      if (!editionResult.data) {
        const { data: latestEdition } = await getLatestChartEdition(series);
        setState({
          status: "edition_not_found",
          familySlug: series,
          familyLabel: family.label,
          latestEditionSlug: latestEdition.data?.slug,
        });
        return;
      }

      const { data: rawEntries } = await getChartEditionEntries(series, editionResult.data.slug);
      if (rawEntries.length === 0) {
        setState({ status: "empty" });
        return;
      }

      const entries = rawEntries.map(toChartEntryRowViewModel);
      const editionVM = toChartEditionViewModel(editionResult.data, family, rawEntries);

      // Load archive
      const { data: allEditions } = await getChartEditionsForFamily(series);
      const entriesMap: Record<string, import("@/services/chartsPublic/types").ChartEditionEntry[]> = {
        [editionResult.data.slug]: rawEntries,
      };
      const archive = toChartArchiveViewModel(allEditions, entriesMap);

      setState({
        status: "loaded",
        edition: editionVM,
        entries,
        familyLabel: family.label,
        familySlug: series,
        archive,
        meta: editionMeta,
      });
    } catch (err) {
      const isRetryable = err instanceof Error && err.message.includes("timeout") || err instanceof Error && err.message.includes("Network error");
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        diagnostics: err instanceof Error ? err.stack : undefined,
        retryable: isRetryable,
      });
    }
  }, [series, editionSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = () => load();

  // Hoist all hooks before any early return
  const loadedState = state.status === "loaded" ? state : null;

  const chartTracks = useMemo(
    () => loadedState?.entries.map(toChartTrackPlayerModel) ?? [],
    [loadedState?.entries]
  );

  const newEntries = useMemo(
    () => loadedState?.entries.filter((e) => e.movement === "new").slice(0, 5) ?? [],
    [loadedState?.entries]
  );
  const climbers = useMemo(
    () =>
      (loadedState?.entries ?? [])
        .filter((e) => e.movement === "up")
        .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))
        .slice(0, 5),
    [loadedState?.entries]
  );

  const genreBreakdown = useMemo(() => {
    const counts = (loadedState?.entries ?? []).reduce<Record<string, number>>((acc, entry) => {
      const genre = entry.genre || "Unknown";
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, count]) => ({ genre, count }));
  }, [loadedState?.entries]);

  const topTrackForTrajectory = loadedState?.entries[0] ?? null;
  const trajectory = useMemo(() => {
    const weeks = Math.max(6, Math.min(12, topTrackForTrajectory?.weeksOnChart || 8));
    return Array.from(
      { length: weeks },
      (_, i) => Math.max(8, 90 - (i * 5 + (topTrackForTrajectory?.rank || 1) * 2))
    );
  }, [topTrackForTrajectory]);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen">
        <section className="chart-edition-hero">
          <div className="chart-edition-shade" />
          <div className="chart-edition-inner wk-container-wide">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-12 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="flex gap-3 mt-6">
                  <div className="h-10 w-28 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-10 w-28 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
                <div className="flex gap-4 mt-6">
                  <div className="h-16 w-24 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-16 w-24 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-16 w-24 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-16 w-24 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
              <div className="h-64 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
        <div className="wk-container-wide px-4 py-10 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="h-6 w-6 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-12 w-12 rounded-lg bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="h-48 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-48 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load chart data</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">Something went wrong while loading this chart edition.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRetry} className="wk-button wk-button-primary">
              <i className="ri-refresh-line" /> Retry
            </button>
            <button onClick={() => setShowErrorDetails(!showErrorDetails)} className="wk-button wk-button-ghost">
              {showErrorDetails ? "Hide" : "Show"} details
            </button>
          </div>
          {showErrorDetails && (
            <div className="mt-4 text-left rounded-xl bg-[var(--wk-bg)] p-4 font-mono text-[12px] text-[var(--wk-text-soft)] overflow-auto">
              {state.error}
            </div>
          )}

          {/* Collapsible diagnostics */}
          <div className="mt-6 border-t border-[var(--wk-border)] pt-4">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center gap-2 text-[12px] text-[var(--wk-text-muted)] mx-auto"
            >
              <i className={`ri-${showDiagnostics ? "arrow-up" : "arrow-down"}-s-line`} />
              {showDiagnostics ? "Hide" : "Show"} diagnostics
            </button>
            {showDiagnostics && (
              <div className="mt-3 text-left rounded-lg bg-[var(--wk-bg)] p-3 space-y-1 font-mono text-[11px] text-[var(--wk-text-soft)]">
                <div className="grid grid-cols-[100px_1fr] gap-1">
                  <span className="text-[var(--wk-text-faint)]">Mode</span>
                  <span>{import.meta.env.VITE_CHARTS_PUBLIC_MODE ?? "mock"}</span>
                  <span className="text-[var(--wk-text-faint)]">Family slug</span>
                  <span>{series ?? "—"}</span>
                  <span className="text-[var(--wk-text-faint)]">Edition slug</span>
                  <span>{editionSlug ?? "latest"}</span>
                  <span className="text-[var(--wk-text-faint)]">Endpoint</span>
                  <span>GET /charts/{series}{editionSlug ? `/${editionSlug}` : "/latest"}</span>
                  <span className="text-[var(--wk-text-faint)]">Error status</span>
                  <span>{state.error.includes("HTTP") ? state.error.match(/HTTP\s+(\d+)/)?.[1] ?? "—" : "—"}</span>
                  <span className="text-[var(--wk-text-faint)]">Message</span>
                  <span className="text-[var(--wk-danger)]">{state.error}</span>
                  <span className="text-[var(--wk-text-faint)]">Retryable</span>
                  <span>{state.retryable ? "Yes" : "No"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "family_not_found") {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Chart not found</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">The chart series you are looking for does not exist.</p>
          <Link to="/charts" className="wk-button wk-button-primary">
            <i className="ri-arrow-left-line" /> Back to charts
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === "edition_not_found") {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Edition not found</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">
            The edition <code className="font-mono text-[12px] bg-[var(--wk-bg)] px-1 rounded">{editionSlug}</code> does not exist in the <strong>{state.familyLabel}</strong> series.
          </p>
          <div className="flex items-center justify-center gap-3">
            {state.latestEditionSlug && (
              <Link to={`/charts/${state.familySlug}/${state.latestEditionSlug}`} className="wk-button wk-button-primary">
                <i className="ri-arrow-right-line" /> Latest edition
              </Link>
            )}
            <Link to="/charts" className="wk-button wk-button-ghost">
              <i className="ri-arrow-left-line" /> Back to charts
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "empty") {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">No published chart edition found</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">There are no entries for this chart edition yet.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleRetry} className="wk-button wk-button-primary">
              <i className="ri-refresh-line" /> Refresh
            </button>
            <Link to="/charts" className="wk-button wk-button-ghost">
              <i className="ri-arrow-left-line" /> Back to charts
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { edition, entries, familyLabel, familySlug, archive, meta } = state;
  const topTrack = entries[0] ?? null;
  const top3 = entries.slice(0, 3);
  const rows = entries.slice(3);

  const playAt = (idx: number) => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks);
  };

  // Subtle metadata
  const metaLine = meta.isStale
    ? `Loaded from cache (stale) · Last updated ${new Date(meta.fetchedAt).toLocaleString()}`
    : meta.dataSource === "cache"
    ? `Loaded from cache · Last updated ${new Date(meta.fetchedAt).toLocaleString()}`
    : `Loaded from ${meta.dataSource === "mock" ? "mock data" : "WordPress API"} · ${new Date(meta.fetchedAt).toLocaleTimeString()}`;

  if (!entries.length || !topTrack) {
    return (
      <main className="wk-container px-6 py-20 text-center">
        <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">No chart entries available</h1>
        <p className="text-[var(--wk-text-muted)]">This chart edition has no entries to display.</p>
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
              <div className="chart-edition-kicker">
                <WkIcon name="BarChart3" size={14} /> {familyLabel}
              </div>
              <h1 className="chart-edition-title">{edition.label}</h1>
              <p className="chart-edition-sub">
                {edition.totalEntries} ranked positions, {edition.totalArtists} artists, {edition.newEntries} new entries. {edition.date} · {edition.weekNumber ? `Week ${edition.weekNumber}` : edition.label}.
              </p>
              <div className="chart-edition-actions">
                <button className="wk-button wk-button-primary" onClick={() => playAt(0)}>
                  <WkIcon name="Play" size={16} /> Play #1
                </button>
                <button className="wk-button wk-button-ghost" onClick={() => playAt(0)}>
                  <WkIcon name="ListMusic" size={16} /> Play chart
                </button>
                <Link to="/charts" className="wk-button wk-button-ghost">
                  <WkIcon name="Archive" size={16} /> Archive
                </Link>
                <ShareButton
                  item={{
                    title: familyLabel,
                    subtitle: edition.label || "Current edition",
                    description: edition.methodology,
                    imageUrl: topTrack.artworkUrl,
                    type: "chart",
                  }}
                />
              </div>
              <div className="chart-stats-strip">
                <Stat value={edition.totalEntries} label="Entries" />
                <Stat value={edition.totalArtists} label="Artists" />
                <Stat value={edition.newEntries} label="New" />
                <Stat value={edition.longestRunning?.weeks ?? "—"} label="Longest" />
              </div>
            </div>
            <aside className="chart-no1-card">
              <div className="chart-no1-art">
                <img src={topTrack.artworkUrl} alt="" />
                <div className="chart-no1-badge">#1</div>
              </div>
              <div className="chart-no1-title">{topTrack.title}</div>
              <div className="chart-no1-artist">
                {topTrack.artist} · Peak #{topTrack.peakPosition}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className="wk-container-wide px-4 py-10 md:px-6">
        {/* Archive switcher */}
        {archive.previous.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="section-kicker">Archive</div>
                <h2 className="section-title">Edition history</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {archive.latest && (
                <Link
                  to={`/charts/${familySlug}/${archive.latest.slug}`}
                  className={`rounded-xl border p-4 transition-all hover:border-[var(--wk-brand)]/40 ${
                    archive.latest.slug === edition.slug
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5"
                      : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)] mb-1">Latest</div>
                  <div className="text-[14px] font-bold text-[var(--wk-text)]">{archive.latest.label}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{archive.latest.date} · {archive.latest.entryCount} entries</div>
                  {archive.latest.no1Track && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-6 w-6 rounded overflow-hidden bg-[var(--wk-surface-raised)]">
                        {archive.latest.no1Track.artworkUrl ? (
                          <img src={archive.latest.no1Track.artworkUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <i className="ri-music-2-line text-[10px] flex items-center justify-center h-full" />
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{archive.latest.no1Track.title}</div>
                    </div>
                  )}
                </Link>
              )}
              {archive.previous.slice(0, 3).map((item) => (
                <Link
                  key={item.slug}
                  to={`/charts/${familySlug}/${item.slug}`}
                  className={`rounded-xl border p-4 transition-all hover:border-[var(--wk-brand)]/40 ${
                    item.slug === edition.slug
                      ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5"
                      : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                  }`}
                >
                  <div className="text-[14px] font-bold text-[var(--wk-text)]">{item.label}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{item.date} · {item.entryCount} entries</div>
                  {item.no1Track && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-6 w-6 rounded overflow-hidden bg-[var(--wk-surface-raised)]">
                        {item.no1Track.artworkUrl ? (
                          <img src={item.no1Track.artworkUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <i className="ri-music-2-line text-[10px] flex items-center justify-center h-full" />
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{item.no1Track.title}</div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="chart-top3-grid">
          {top3.map((entry, idx) => (
            <Link
              key={`${entry.rank}-${entry.slug}`}
              to={`/tracks/${entry.slug}`}
              className="chart-podium-card"
            >
              <img src={entry.artworkUrl} alt="" />
              <div className={`chart-podium-rank ${rankTone(entry.rank)}`}>{entry.rank}</div>
              <div className="chart-podium-body">
                <div className="chart-podium-title">{entry.title}</div>
                <div className="chart-podium-artist">
                  {entry.artist} · {movementLabel(entry)}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    playAt(idx);
                  }}
                  className="wk-button wk-button-sm wk-button-primary mt-3"
                >
                  <WkIcon name="Play" size={14} /> Play
                </button>
              </div>
            </Link>
          ))}
        </section>

        <section className="chart-trajectory">
          <div className="chart-trajectory-head">
            <div>
              <div className="section-kicker">#1 trajectory</div>
              <div className="section-title" style={{ fontSize: 24 }}>
                {topTrack.title}
              </div>
            </div>
            <div className="artist-list-sub">
              {topTrack.weeksOnChart || 0} weeks · Peak #{topTrack.peakPosition}
            </div>
          </div>
          <div className="chart-trajectory-line">
            {trajectory.map((height, i) => (
              <div key={i} className="chart-trajectory-bar" style={{ height: `${height}%` }} />
            ))}
          </div>
        </section>

        <section className="chart-table-shell">
          <div>
            <div className="section-head">
              <div>
                <div className="section-kicker">Positions 4–{entries.length}</div>
                <h2 className="section-title">Full ranked list</h2>
              </div>
              <p className="section-copy">
                Rows after the podium stay dense for comparison, movement, weeks, peak, source, and play actions.
              </p>
            </div>
            <div className="chart-table-card">
              {rows.map((entry, idx) => (
                <Link
                  key={`${entry.rank}-${entry.slug}`}
                  to={`/tracks/${entry.slug}`}
                  className="chart-row-39"
                >
                  <div className="chart-row-rank">{entry.rank}</div>
                  <div className="chart-row-art">
                    <img src={entry.artworkUrl} alt="" />
                  </div>
                  <div className="min-w-0">
                    <div className="chart-row-name">{entry.title}</div>
                    <div className="chart-row-sub">
                      {entry.artist} · {entry.genre || "Genre pending"}
                    </div>
                  </div>
                  <div className="chart-row-stats">
                    Peak #{entry.peakPosition}
                    <br />
                    {entry.weeksOnChart || 0} weeks
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      playAt(idx + 3);
                    }}
                    className="chart-btn"
                  >
                    <WkIcon name="Play" size={14} />
                  </button>
                </Link>
              ))}
            </div>
          </div>

          <aside className="chart-side-stack">
            <SideCard
              title="New entries"
              entries={newEntries}
              metric={(entry) => "NEW"}
            />
            <SideCard
              title="Biggest climbers"
              entries={climbers}
              metric={(entry) => `+${entry.movementAmount ?? 0}`}
            />
            <div className="chart-side-card">
              <div className="chart-side-title">Genre breakdown</div>
              {genreBreakdown.map((g) => {
                const pct = entries.length ? Math.round((g.count / entries.length) * 100) : 0;
                return (
                  <div key={g.genre} className="mb-3">
                    <div className="flex justify-between text-[12px]">
                      <b>{g.genre}</b>
                      <span className="text-[var(--wk-text-muted)]">{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--wk-bg)]">
                      <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chart-side-card">
              <div className="chart-side-title">Archive / series</div>
              <Link to="/charts" className="chart-archive-link">
                <span>All charts</span>
                <WkIcon name="ArrowRight" size={14} />
              </Link>
            </div>
          </aside>
        </section>
      </div>

      {/* Subtle metadata */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="wk-container-wide px-4 py-3 md:px-6 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--wk-text-faint)]">{metaLine}</div>
          <ChartRefreshButton onRefresh={load} size="sm" />
        </div>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="chart-stat-card">
      <div className="chart-stat-value">{value}</div>
      <div className="chart-stat-label">{label}</div>
    </div>
  );
}

function SideCard({
  title,
  entries,
  metric,
}: {
  title: string;
  entries: ChartEntryRowViewModel[];
  metric: (entry: ChartEntryRowViewModel) => string;
}) {
  return (
    <div className="chart-side-card">
      <div className="chart-side-title">{title}</div>
      {entries.map((entry) => (
        <Link
          key={`${title}-${entry.rank}-${entry.slug}`}
          to={`/tracks/${entry.slug}`}
          className="chart-signal-row"
        >
          <div className="chart-row-rank text-[12px]">{metric(entry)}</div>
          <div className="chart-signal-art">
            <img src={entry.artworkUrl} alt="" />
          </div>
          <div className="min-w-0">
            <div className="chart-row-name text-[12px]">{entry.title}</div>
            <div className="chart-row-sub">{entry.artist}</div>
          </div>
          <WkIcon name="ArrowRight" size={13} />
        </Link>
      ))}
      {entries.length === 0 && (
        <div className="artist-list-sub">No entries for this signal.</div>
      )}
    </div>
  );
}