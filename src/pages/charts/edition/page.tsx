import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import {
  getChartFamily,
  getLatestChartEdition,
  getChartEdition,
  getChartEditionEntries,
} from "@/services/chartsPublic/client";
import {
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  type ChartEditionViewModel,
  type ChartEntryRowViewModel,
} from "@/services/chartsPublic/viewModels";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
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
    | { status: "error"; error: string }
    | { status: "not_found" }
    | { status: "empty" }
    | {
        status: "loaded";
        edition: ChartEditionViewModel;
        entries: ChartEntryRowViewModel[];
        familyLabel: string;
      }
  >({ status: "loading" });
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const load = useCallback(async () => {
    if (!series) {
      setState({ status: "not_found" });
      return;
    }
    setState({ status: "loading" });
    try {
      const family = await getChartFamily(series);
      if (!family) {
        setState({ status: "not_found" });
        return;
      }

      let edition: Awaited<ReturnType<typeof getChartEdition>>;
      if (editionSlug) {
        edition = await getChartEdition(series, editionSlug);
      } else {
        edition = await getLatestChartEdition(series);
      }

      if (!edition) {
        setState({ status: "empty" });
        return;
      }

      const rawEntries = await getChartEditionEntries(series, edition.slug);
      if (rawEntries.length === 0) {
        setState({ status: "empty" });
        return;
      }

      const entries = rawEntries.map(toChartEntryRowViewModel);
      const editionVM = toChartEditionViewModel(edition, family, rawEntries);

      setState({
        status: "loaded",
        edition: editionVM,
        entries,
        familyLabel: family.label,
      });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [series, editionSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = () => load();

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
        </div>
      </main>
    );
  }

  if (state.status === "not_found") {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="BarChart3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Chart not found</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">The chart series or edition you are looking for does not exist.</p>
          <Link to="/charts" className="wk-button wk-button-primary">
            <i className="ri-arrow-left-line" /> Back to charts
          </Link>
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

  const { edition, entries, familyLabel } = state;
  const topTrack = entries[0] ?? null;
  const top3 = entries.slice(0, 3);
  const rows = entries.slice(3);

  const chartTracks = useMemo(
    () => entries.map(toChartTrackPlayerModel),
    [entries]
  );

  const newEntries = useMemo(
    () => entries.filter((entry) => entry.movement === "new").slice(0, 5),
    [entries]
  );
  const climbers = useMemo(
    () =>
      entries
        .filter((entry) => entry.movement === "up")
        .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))
        .slice(0, 5),
    [entries]
  );

  const genreBreakdown = useMemo(() => {
    const counts = entries.reduce<Record<string, number>>((acc, entry) => {
      const genre = entry.genre || "Unknown";
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, count]) => ({ genre, count }));
  }, [entries]);

  const trajectory = useMemo(() => {
    const weeks = Math.max(6, Math.min(12, topTrack?.weeksOnChart || 8));
    return Array.from(
      { length: weeks },
      (_, i) => Math.max(8, 90 - (i * 5 + (topTrack?.rank || 1) * 2))
    );
  }, [topTrack]);

  const playAt = (idx: number) => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks);
  };

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
              <h1 className="chart-edition-title">Chart edition</h1>
              <p className="chart-edition-sub">
                {edition.totalEntries} ranked positions, {edition.totalArtists} artists, {edition.newEntries} new entries. Dense, playable, archive-ready chart infrastructure.
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